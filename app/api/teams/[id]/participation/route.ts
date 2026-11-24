import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { TeamModel, AuditLogModel } from '@/lib/server/models'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { apiError } from '@/lib/server/http'
export const runtime = 'nodejs'
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'teams')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot manage teams.' }, { status: 403 })
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 })
    const body = await request.json()
    if (typeof body.active !== 'boolean') return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'active must be true or false.' }, { status: 400 })
    const team = await TeamModel.findByIdAndUpdate(id, { $set: { active: body.active } }, { new: true, runValidators: true })
    if (!team) return NextResponse.json({ code: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'team.participation_updated', resource: 'team', resourceId: id, metadata: { active: body.active } })
    return NextResponse.json({ id: String(team._id), name: team.name, initials: team.initials, active: team.active, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0, form: [] })
  } catch (error) { return apiError(error) }
}
