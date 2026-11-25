import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { AnnouncementModel, AuditLogModel } from '@/lib/server/models'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }
export async function POST(request: NextRequest, context: Context) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'content')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot publish tournament news.' }, { status: 403 })
    const { id } = await context.params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Announcement not found.' }, { status: 404 })
    const body = await request.json().catch(() => ({}))
    const published = body.published !== false
    const item = await AnnouncementModel.findByIdAndUpdate(id, { $set: { published, publishedAt: published ? new Date() : null } }, { new: true, runValidators: true })
    if (!item) return NextResponse.json({ code: 'NOT_FOUND', message: 'Announcement not found.' }, { status: 404 })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: published ? 'announcement.published' : 'announcement.unpublished', resource: 'announcement', resourceId: id, metadata: { title: item.title } })
    return NextResponse.json({ id: String(item._id), title: item.title, body: item.body, date: item.publishedAt ?? item.createdAt, published: item.published, pinned: item.pinned, featured: item.featured, category: item.category, imageUrl: item.imageUrl, imageAlt: item.imageAlt, matchId: item.matchId ? String(item.matchId) : undefined })
  } catch (error) { return apiError(error) }
}
