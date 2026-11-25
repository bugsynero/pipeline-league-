import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { AnnouncementModel, AuditLogModel } from '@/lib/server/models'
import { announcementSchema } from '@/lib/validation'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function output(item: any) {
  return { id: String(item._id), title: item.title, body: item.body, date: item.publishedAt ?? item.createdAt, published: item.published, pinned: item.pinned, featured: Boolean(item.featured), category: item.category ?? 'general', imageUrl: item.imageUrl, imageAlt: item.imageAlt, matchId: item.matchId ? String(item.matchId) : undefined }
}
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const session = await requireAdmin(request)
    const isEditor = Boolean(session.user && canManage(session.user.role, 'content'))
    const rows = await AnnouncementModel.find(isEditor ? {} : { published: true }).sort({ featured: -1, pinned: -1, publishedAt: -1, createdAt: -1 }).lean()
    return NextResponse.json(rows.map(output))
  } catch (error) { return apiError(error) }
}
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'content')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot publish tournament news.' }, { status: 403 })
    const parsed = announcementSchema.safeParse(await request.json())
    if (!parsed.success) return apiError(parsed.error)
    const data = parsed.data
    if (data.imageUrl && !/^https?:\/\//i.test(data.imageUrl)) return NextResponse.json({ code: 'INVALID_IMAGE_URL', message: 'Use a publicly accessible http or https image URL.' }, { status: 400 })
    if (data.matchId && !/^[a-f0-9]{24}$/i.test(data.matchId)) return NextResponse.json({ code: 'INVALID_MATCH', message: 'Select a valid linked match.' }, { status: 400 })
    const item = await AnnouncementModel.create({ ...data, matchId: data.matchId || undefined, published: false })
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'announcement.created', resource: 'announcement', resourceId: String(item._id), metadata: { category: item.category, hasImage: Boolean(item.imageUrl), featured: item.featured } })
    return NextResponse.json(output(item), { status: 201 })
  } catch (error) { return apiError(error) }
}
