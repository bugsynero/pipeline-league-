import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { PlayerModel, TeamModel, AuditLogModel } from '@/lib/server/models'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { apiError } from '@/lib/server/http'
import { playerSchema } from '@/lib/validation'
export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }
function serialize(player: any) {
  const team = player.teamId && typeof player.teamId === 'object' ? player.teamId : null
  return { id: String(player._id), name: player.name, teamId: String(team?._id ?? player.teamId), number: player.number, appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, ...(team ? { team: { id: String(team._id), name: team.name, initials: team.initials, active: team.active } } : {}) }
}
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    await connectToDatabase()
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Player not found.' }, { status: 404 })
    const player = await PlayerModel.findById(id).populate('teamId', 'name initials active').lean()
    if (!player) return NextResponse.json({ code: 'NOT_FOUND', message: 'Player not found.' }, { status: 404 })
    return NextResponse.json(serialize(player))
  } catch (error) { return apiError(error) }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'players')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot manage players.' }, { status: 403 })
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Player not found.' }, { status: 404 })
    const parsed = playerSchema.partial().safeParse(await request.json())
    if (!parsed.success) return apiError(parsed.error)
    if (parsed.data.teamId && (!isValidObjectId(parsed.data.teamId) || !(await TeamModel.exists({ _id: parsed.data.teamId })))) return NextResponse.json({ code: 'INVALID_TEAM', message: 'Select an existing team.' }, { status: 400 })
    const player = await PlayerModel.findByIdAndUpdate(id, { $set: parsed.data }, { new: true, runValidators: true }).populate('teamId', 'name initials active')
    if (!player) return NextResponse.json({ code: 'NOT_FOUND', message: 'Player not found.' }, { status: 404 })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'player.updated', resource: 'player', resourceId: id, metadata: parsed.data })
    return NextResponse.json(serialize(player))
  } catch (error) { return apiError(error) }
}
export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!['super_admin','tournament_admin'].includes(auth.user.role)) return NextResponse.json({ code: 'FORBIDDEN', message: 'Only tournament administrators can delete players.' }, { status: 403 })
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Player not found.' }, { status: 404 })
    const player = await PlayerModel.findByIdAndDelete(id)
    if (!player) return NextResponse.json({ code: 'NOT_FOUND', message: 'Player not found.' }, { status: 404 })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'player.deleted', resource: 'player', resourceId: id, metadata: { name: player.name } })
    return new NextResponse(null, { status: 204 })
  } catch (error) { return apiError(error) }
}
