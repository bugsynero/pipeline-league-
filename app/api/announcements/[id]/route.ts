import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { AnnouncementModel, AuditLogModel } from '@/lib/server/models'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }
export async function PATCH(request: NextRequest, context: Context) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'content')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot edit tournament news.' }, { status: 403 })
    const { id } = await context.params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Announcement not found.' }, { status: 404 })
    const body = await request.json()
    const patch: Record<string, unknown> = {}
    if (body.title !== undefined) { if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120) return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Enter a title of up to 120 characters.' }, { status: 400 }); patch.title = body.title.trim() }
    if (body.body !== undefined) { if (typeof body.body !== 'string' || body.body.trim().length < 10 || body.body.length > 2000) return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'The story must be between 10 and 2,000 characters.' }, { status: 400 }); patch.body = body.body.trim() }
    if (body.category !== undefined) { if (!['match_report','team_news','tournament_update','general'].includes(body.category)) return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Select a valid news category.' }, { status: 400 }); patch.category = body.category }
    if (body.imageUrl !== undefined) { const value = String(body.imageUrl).trim(); if (value && !/^https?:\/\//i.test(value)) return NextResponse.json({ code: 'INVALID_IMAGE_URL', message: 'Use a publicly accessible http or https image URL.' }, { status: 400 }); patch.imageUrl = value }
    if (body.imageAlt !== undefined) patch.imageAlt = String(body.imageAlt).trim().slice(0, 180)
    if (body.matchId !== undefined) { if (body.matchId && !isValidObjectId(String(body.matchId))) return NextResponse.json({ code: 'INVALID_MATCH', message: 'Select a valid linked match.' }, { status: 400 }); patch.matchId = body.matchId || null }
    if (body.pinned !== undefined) patch.pinned = Boolean(body.pinned)
    if (body.featured !== undefined) patch.featured = Boolean(body.featured)
    if (!Object.keys(patch).length) return NextResponse.json({ code: 'EMPTY_UPDATE', message: 'No editable news fields were supplied.' }, { status: 400 })
    const item = await AnnouncementModel.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
    if (!item) return NextResponse.json({ code: 'NOT_FOUND', message: 'Announcement not found.' }, { status: 404 })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'announcement.updated', resource: 'announcement', resourceId: id, metadata: { fields: Object.keys(patch) } })
    return NextResponse.json({ id: String(item._id), title: item.title, body: item.body, date: item.publishedAt ?? item.createdAt, published: item.published, pinned: item.pinned, featured: item.featured, category: item.category, imageUrl: item.imageUrl, imageAlt: item.imageAlt, matchId: item.matchId ? String(item.matchId) : undefined })
  } catch (error) { return apiError(error) }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'content')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot delete tournament news.' }, { status: 403 })
    const { id } = await context.params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Announcement not found.' }, { status: 404 })
    const item = await AnnouncementModel.findByIdAndDelete(id)
    if (!item) return NextResponse.json({ code: 'NOT_FOUND', message: 'Announcement not found.' }, { status: 404 })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'announcement.deleted', resource: 'announcement', resourceId: id, metadata: { title: item.title } })
    return new NextResponse(null, { status: 204 })
  } catch (error) { return apiError(error) }
}
