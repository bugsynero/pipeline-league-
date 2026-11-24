import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { TeamModel, MatchModel, TournamentSettingsModel, AuditLogModel } from '@/lib/server/models'
import { seedTournamentDefaults } from '@/lib/server/seed'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { apiError } from '@/lib/server/http'
import { teamSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function serialize(team: any) {
  return { id: String(team._id), name: team.name, initials: team.initials, active: team.active, ...(team.logoUrl ? { logoUrl: team.logoUrl } : {}) }
}

export async function GET() {
  try {
    await connectToDatabase()
    await seedTournamentDefaults()
    const [teams, matches, settings] = await Promise.all([
      TeamModel.find().sort({ name: 1 }).lean(),
      MatchModel.find({ status: 'completed', confirmedAt: { $exists: true } }).lean(),
      TournamentSettingsModel.findOne({ key: 'tournament' }).lean(),
    ])
    const points = settings?.points ?? { win: 3, draw: 1, loss: 0 }
    const table = new Map<string, { played:number; wins:number; draws:number; losses:number; gf:number; ga:number; points:number; form:string[] }>()
    for (const team of teams) table.set(String(team._id), { played:0, wins:0, draws:0, losses:0, gf:0, ga:0, points:0, form:[] })
    for (const match of matches) {
      const home = table.get(String(match.homeId)); const away = table.get(String(match.awayId))
      if (!home || !away || match.homeScore == null || match.awayScore == null) continue
      home.played++; away.played++; home.gf += match.homeScore; home.ga += match.awayScore; away.gf += match.awayScore; away.ga += match.homeScore
      if (match.homeScore > match.awayScore) { home.wins++; away.losses++; home.points += points.win; away.points += points.loss; home.form.push('W'); away.form.push('L') }
      else if (match.homeScore < match.awayScore) { away.wins++; home.losses++; away.points += points.win; home.points += points.loss; away.form.push('W'); home.form.push('L') }
      else { home.draws++; away.draws++; home.points += points.draw; away.points += points.draw; home.form.push('D'); away.form.push('D') }
    }
    return NextResponse.json(teams.map(team => { const stats = table.get(String(team._id))!; return { ...serialize(team), ...stats, gd: stats.gf - stats.ga } }))
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
