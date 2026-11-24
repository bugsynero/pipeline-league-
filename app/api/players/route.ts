import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { PlayerModel, TeamModel, AuditLogModel } from '@/lib/server/models'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { apiError } from '@/lib/server/http'
import { playerSchema } from '@/lib/validation'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
function serialize(player: any) {
  const team = player.teamId && typeof player.teamId === 'object' ? player.teamId : null
  return { id: String(player._id), name: player.name, teamId: String(team?._id ?? player.teamId), number: player.number, ...(team ? { team: { id: String(team._id), name: team.name, initials: team.initials, active: team.active } } : {}) }
}
export async function GET() {
  try {
    await connectToDatabase()
    const players = await PlayerModel.find().populate('teamId', 'name initials active').sort({ name: 1 }).lean()
    return NextResponse.json(players.map(serialize))
  } catch (error) { return apiError(error) }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'players')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot manage players.' }, { status: 403 })
    const parsed = playerSchema.safeParse(await request.json())
    if (!parsed.success) return apiError(parsed.error)
    if (!isValidObjectId(parsed.data.teamId) || !(await TeamModel.exists({ _id: parsed.data.teamId }))) return NextResponse.json({ code: 'INVALID_TEAM', message: 'Select an existing team.' }, { status: 400 })
    const player = await PlayerModel.create(parsed.data)
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'player.created', resource: 'player', resourceId: String(player._id), metadata: { name: player.name, teamId: parsed.data.teamId } })
    return NextResponse.json(serialize(await player.populate('teamId', 'name initials active')), { status: 201 })
  } catch (error) { return apiError(error) }
}
