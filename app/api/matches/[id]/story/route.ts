import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { MatchModel, AuditLogModel } from '@/lib/server/models'
import { resultStorySchema } from '@/lib/validation'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'matches')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot edit match reports.' }, { status: 403 })
    const { id } = await context.params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'MATCH_NOT_FOUND', message: 'Match not found.' }, { status: 404 })
    const parsed = resultStorySchema.safeParse(await request.json())
    if (!parsed.success) return apiError(parsed.error)
    if (parsed.data.highlightImageUrl && !/^https?:\/\//i.test(parsed.data.highlightImageUrl)) return NextResponse.json({ code: 'INVALID_IMAGE_URL', message: 'Use a publicly accessible http or https image URL.' }, { status: 400 })
    const match = await MatchModel.findById(id)
    if (!match) return NextResponse.json({ code: 'MATCH_NOT_FOUND', message: 'Match not found.' }, { status: 404 })
    const before = { resultHeadline: match.resultHeadline, resultSummary: match.resultSummary, highlightImageUrl: match.highlightImageUrl, featured: match.featured }
    if (parsed.data.resultHeadline !== undefined) match.resultHeadline = parsed.data.resultHeadline
    if (parsed.data.resultSummary !== undefined) match.resultSummary = parsed.data.resultSummary
    if (parsed.data.highlightImageUrl !== undefined) match.highlightImageUrl = parsed.data.highlightImageUrl
    if (parsed.data.featured !== undefined) match.featured = parsed.data.featured
    await match.save()
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'match.story.updated', resource: 'match', resourceId: id, metadata: { before, after: parsed.data } })
    return NextResponse.json({ ok: true, id, resultHeadline: match.resultHeadline, resultSummary: match.resultSummary, highlightImageUrl: match.highlightImageUrl, featured: match.featured })
  } catch (error) { return apiError(error) }
}
