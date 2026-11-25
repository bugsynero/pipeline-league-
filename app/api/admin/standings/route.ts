import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { TeamModel, StandingsPublicationModel, AuditLogModel } from '@/lib/server/models'
import { calculateStandings } from '@/lib/server/statistics'
import { standingsDraftSchema } from '@/lib/validation'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function rowOut(row: any) {
  const team = row.teamId && typeof row.teamId === 'object' ? row.teamId : null
  return {
    teamId: String(team?._id ?? row.teamId),
    team: team ? { id: String(team._id), name: team.name, initials: team.initials, active: team.active } : undefined,
    position: row.position, played: row.played, wins: row.wins, draws: row.draws,
    losses: row.losses, gf: row.gf, ga: row.ga, gd: row.gf - row.ga, points: row.points,
  }
}

async function guard(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.user) return { user: null, response: NextResponse.json(auth.response, { status: auth.status }) }
  if (!canManage(auth.user.role, 'statistics')) return { user: null, response: NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot manage standings.' }, { status: 403 }) }
  return { user: auth.user, response: null }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const gate = await guard(request)
    if (gate.response) return gate.response
    const [calculatedRows, publication] = await Promise.all([
      calculateStandings(),
      StandingsPublicationModel.findOne({ key: 'current' }).populate('draftRows.teamId').populate('publishedRows.teamId').lean(),
    ])
    return NextResponse.json({
      calculatedRows,
      draftRows: publication?.draftRows?.length ? publication.draftRows.map(rowOut) : calculatedRows.map(row => ({ ...row, teamId: row.team.id })),
      publishedRows: publication?.publishedRows?.map(rowOut) ?? [],
      publishedAt: publication?.publishedAt ?? null,
      publishedBy: publication?.publishedBy ?? null,
      draftUpdatedAt: publication?.draftUpdatedAt ?? null,
      draftUpdatedBy: publication?.draftUpdatedBy ?? null,
      isPublished: Boolean(publication?.publishedAt && publication.publishedRows?.length),
    })
  } catch (error) {
    return apiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    const gate = await guard(request)
    if (gate.response || !gate.user) return gate.response
    const parsed = standingsDraftSchema.safeParse(await request.json())
    if (!parsed.success) return apiError(parsed.error)
    const rows = parsed.data.rows
    const ids = rows.map(row => row.teamId)
    if (ids.some(id => !isValidObjectId(id)) || new Set(ids).size !== ids.length) {
      return NextResponse.json({ code: 'INVALID_STANDINGS', message: 'Every team must appear once with a valid team record.' }, { status: 400 })
    }
    if (rows.some(row => row.played !== row.wins + row.draws + row.losses)) {
      return NextResponse.json({ code: 'INVALID_STANDINGS', message: 'Played must equal wins plus draws plus losses for every team.' }, { status: 400 })
    }
    if (new Set(rows.map(row => row.position)).size !== rows.length) {
      return NextResponse.json({ code: 'INVALID_STANDINGS', message: 'Each team must have a unique table position.' }, { status: 400 })
    }
    const activeTeams = await TeamModel.find({ active: true }).select('_id').lean()
    const allowed = new Set(activeTeams.map(team => String(team._id)))
    if (ids.length !== activeTeams.length || ids.some(id => !allowed.has(id))) {
      return NextResponse.json({ code: 'INCOMPLETE_STANDINGS', message: 'Include every active participating team exactly once before saving the table.' }, { status: 400 })
    }
    const normalized = [...rows].sort((a, b) => a.position - b.position)
    const saved = await StandingsPublicationModel.findOneAndUpdate(
      { key: 'current' },
      { $set: { draftRows: normalized, draftUpdatedAt: new Date(), draftUpdatedBy: gate.user.email } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )
    await AuditLogModel.create({ actorId: gate.user.id, actor: gate.user.email, action: 'standings.draft.saved', resource: 'standings', resourceId: 'current', metadata: { teams: normalized.length } })
    return NextResponse.json({ ok: true, draftUpdatedAt: saved.draftUpdatedAt, draftUpdatedBy: saved.draftUpdatedBy })
  } catch (error) {
    return apiError(error)
  }
}
