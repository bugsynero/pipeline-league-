import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { PlayerModel, DisciplineOverrideModel, AuditLogModel } from '@/lib/server/models'
import { disciplineOverrideSchema } from '@/lib/validation'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
type Context = { params: Promise<{ playerId: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'statistics')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot edit discipline records.' }, { status: 403 })
    const { playerId } = await context.params
    if (!isValidObjectId(playerId) || !(await PlayerModel.exists({ _id: playerId }))) return NextResponse.json({ code: 'PLAYER_NOT_FOUND', message: 'Registered player not found.' }, { status: 404 })
    const parsed = disciplineOverrideSchema.safeParse(await request.json())
    if (!parsed.success) return apiError(parsed.error)
    const previous = await DisciplineOverrideModel.findOne({ playerId }).lean()
    const updated = await DisciplineOverrideModel.findOneAndUpdate(
      { playerId },
      { $set: { ...parsed.data, playerId, updatedBy: auth.user.email } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )
    await AuditLogModel.create({
      actorId: auth.user.id, actor: auth.user.email, action: 'discipline.corrected', resource: 'player-discipline', resourceId: playerId,
      metadata: { before: previous ? { yellowCards: previous.yellowCards, redCards: previous.redCards } : null, after: parsed.data, reason: parsed.data.reason },
    })
    return NextResponse.json({ ok: true, playerId, yellowCards: updated.yellowCards, redCards: updated.redCards, reason: updated.reason, updatedBy: updated.updatedBy, updatedAt: updated.updatedAt })
  } catch (error) {
    return apiError(error)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'statistics')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot reset discipline records.' }, { status: 403 })
    const { playerId } = await context.params
    if (!isValidObjectId(playerId)) return NextResponse.json({ code: 'PLAYER_NOT_FOUND', message: 'Registered player not found.' }, { status: 404 })
    const previous = await DisciplineOverrideModel.findOneAndDelete({ playerId })
    if (!previous) return NextResponse.json({ code: 'NO_OVERRIDE', message: 'This player has no manual correction to reset.' }, { status: 404 })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'discipline.override.reset', resource: 'player-discipline', resourceId: playerId, metadata: { previous: { yellowCards: previous.yellowCards, redCards: previous.redCards } } })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return apiError(error)
  }
}
