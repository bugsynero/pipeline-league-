import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { TeamModel, AuditLogModel } from '@/lib/server/models'
import { seedTournamentDefaults } from '@/lib/server/seed'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { apiError } from '@/lib/server/http'
import { teamSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function serialize(team: any) {
  return { id: String(team._id), name: team.name, initials: team.initials, active: team.active, ...(team.logoUrl ? { logoUrl: team.logoUrl } : {}), played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0, form: [] }
}

export async function GET() {
  try {
    await connectToDatabase()
    await seedTournamentDefaults()
    const teams = await TeamModel.find().sort({ name: 1 }).lean()
    return NextResponse.json(teams.map(serialize))
  } catch (error) { return apiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'teams')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot manage teams.' }, { status: 403 })
    const parsed = teamSchema.safeParse(await request.json())
    if (!parsed.success) return apiError(parsed.error)
    const team = await TeamModel.create(parsed.data)
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'team.created', resource: 'team', resourceId: String(team._id), metadata: { name: team.name } })
    return NextResponse.json(serialize(team), { status: 201 })
  } catch (error) { return apiError(error) }
}
