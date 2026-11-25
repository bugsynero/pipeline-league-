import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { PlayerModel, MatchModel, PlayerTournamentStatsModel, AuditLogModel } from '@/lib/server/models'
import { getManualPlayerStatistics } from '@/lib/server/statistics'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
type Context = { params: Promise<{ playerId: string }> }
const numericFields = ['goals', 'assists', 'appearances', 'yellowCards', 'redCards'] as const

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'statistics')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot edit player statistics.' }, { status: 403 })

    const { playerId } = await context.params
    if (!isValidObjectId(playerId)) return NextResponse.json({ code: 'PLAYER_NOT_FOUND', message: 'Registered player not found.' }, { status: 404 })
    const player = await PlayerModel.findById(playerId).lean()
    if (!player) return NextResponse.json({ code: 'PLAYER_NOT_FOUND', message: 'Registered player not found.' }, { status: 404 })

    const body = await request.json()
    const patch: Record<string, unknown> = {}
    for (const field of numericFields) {
      if (body[field] === undefined) continue
      const value = Number(body[field])
      const max = field === 'yellowCards' || field === 'redCards' ? 99 : 999
      if (!Number.isInteger(value) || value < 0 || value > max) {
        return NextResponse.json({ code: 'INVALID_STATISTIC', message: field + ' must be a whole number between 0 and ' + max + '.' }, { status: 400 })
      }
      patch[field] = value
    }

    if (body.suspendedForMatchId !== undefined) {
      const matchId = body.suspendedForMatchId == null ? '' : String(body.suspendedForMatchId).trim()
      if (!matchId) {
        patch.suspendedForMatchId = null
      } else {
        if (!isValidObjectId(matchId)) return NextResponse.json({ code: 'INVALID_MATCH', message: 'Choose a valid upcoming match.' }, { status: 400 })
        const match = await MatchModel.findOne({ _id: matchId, status: 'scheduled' }).lean()
        if (!match) return NextResponse.json({ code: 'INVALID_MATCH', message: 'A suspension can only be assigned to a scheduled match.' }, { status: 400 })
        if (String(match.homeId) !== String(player.teamId) && String(match.awayId) !== String(player.teamId)) {
          return NextResponse.json({ code: 'PLAYER_NOT_IN_MATCH', message: 'The selected match does not involve this player’s team.' }, { status: 400 })
        }
        patch.suspendedForMatchId = matchId
      }
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const disciplineChanged = ['yellowCards', 'redCards', 'suspendedForMatchId'].some(field => body[field] !== undefined)
    if (disciplineChanged && reason.length < 5) return NextResponse.json({ code: 'REASON_REQUIRED', message: 'Enter a reason of at least five characters for a card or suspension update.' }, { status: 400 })
    if (reason) {
      if (reason.length > 500) return NextResponse.json({ code: 'INVALID_REASON', message: 'The reason must be 500 characters or fewer.' }, { status: 400 })
      patch.reason = reason
    }
    if (!Object.keys(patch).length) return NextResponse.json({ code: 'EMPTY_UPDATE', message: 'No statistics were supplied.' }, { status: 400 })

    const updated = await PlayerTournamentStatsModel.findOneAndUpdate(
      { playerId },
      { $set: { ...patch, playerId, updatedBy: auth.user.email } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )
    await AuditLogModel.create({
      actorId: auth.user.id,
      actor: auth.user.email,
      action: disciplineChanged ? 'player.discipline.updated' : 'player.scorers.updated',
      resource: 'player-statistics',
      resourceId: playerId,
      metadata: { fields: Object.keys(patch), reason: updated.reason ?? '' },
    })
    const rows = await getManualPlayerStatistics(true)
    return NextResponse.json(rows.find(row => row.id === playerId) ?? { playerId, ...updated.toObject() })
  } catch (error) {
    return apiError(error)
  }
}
