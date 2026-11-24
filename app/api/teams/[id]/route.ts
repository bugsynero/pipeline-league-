import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { TeamModel, AuditLogModel, PlayerModel } from '@/lib/server/models'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { apiError } from '@/lib/server/http'
import { teamSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string }> }
function serialize(team: any) {
  return { id: String(team._id), name: team.name, initials: team.initials, active: team.active, ...(team.logoUrl ? { logoUrl: team.logoUrl } : {}), played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0, form: [] }
}

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    await connectToDatabase()
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 })
    const team = await TeamModel.findById(id).lean()
    if (!team) return NextResponse.json({ code: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 })
    return NextResponse.json(serialize(team))
  } catch (error) { return apiError(error) }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'teams')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot manage teams.' }, { status: 403 })
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 })
    const body = await request.json()
    const parsed = teamSchema.partial().safeParse(body)
    if (!parsed.success) return apiError(parsed.error)
    const team = await TeamModel.findByIdAndUpdate(id, { $set: parsed.data }, { new: true, runValidators: true })
    if (!team) return NextResponse.json({ code: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'team.updated', resource: 'team', resourceId: id, metadata: parsed.data })
    return NextResponse.json(serialize(team))
  } catch (error) { return apiError(error) }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!['super_admin','tournament_admin'].includes(auth.user.role)) return NextResponse.json({ code: 'FORBIDDEN', message: 'Only tournament administrators can delete teams.' }, { status: 403 })
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 })
    const linkedPlayers = await PlayerModel.countDocuments({ teamId: id })
    if (linkedPlayers) return NextResponse.json({ code: 'TEAM_HAS_PLAYERS', message: 'Remove or reassign this team’s players before deleting the team.' }, { status: 409 })
    const team = await TeamModel.findByIdAndDelete(id)
    if (!team) return NextResponse.json({ code: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'team.deleted', resource: 'team', resourceId: id, metadata: { name: team.name } })
    return new NextResponse(null, { status: 204 })
  } catch (error) { return apiError(error) }
}
