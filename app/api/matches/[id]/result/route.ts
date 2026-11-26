import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { MatchModel, AuditLogModel } from '@/lib/server/models'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'matches')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot publish match results.' }, { status: 403 })
    const { id } = await context.params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'MATCH_NOT_FOUND', message: 'Match not found.' }, { status: 404 })
    const body = await request.json()
    const homeScore = Number(body.homeScore)
    const awayScore = Number(body.awayScore)
    if (!Number.isInteger(homeScore) || homeScore < 0 || homeScore > 99 || !Number.isInteger(awayScore) || awayScore < 0 || awayScore > 99) {
      return NextResponse.json({ code: 'INVALID_SCORE', message: 'Enter valid whole-number scores from 0 to 99.' }, { status: 400 })
    }
    const match = await MatchModel.findById(id)
    if (!match) return NextResponse.json({ code: 'MATCH_NOT_FOUND', message: 'Match not found.' }, { status: 404 })
    if (!['scheduled', 'live'].includes(match.status)) {
      return NextResponse.json({ code: 'RESULT_ALREADY_CONFIRMED', message: 'This match is already completed. Use the audited score-correction workflow to change its result.' }, { status: 409 })
    }
    const headline = typeof body.resultHeadline === 'string' ? body.resultHeadline.trim().slice(0, 140) : ''
    const summary = typeof body.resultSummary === 'string' ? body.resultSummary.trim().slice(0, 2000) : ''
    const imageUrl = typeof body.highlightImageUrl === 'string' ? body.highlightImageUrl.trim() : ''
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) return NextResponse.json({ code: 'INVALID_IMAGE_URL', message: 'Use a publicly accessible http or https image URL.' }, { status: 400 })
    const before = { status: match.status, homeScore: match.homeScore, awayScore: match.awayScore }
    match.homeScore = homeScore
    match.awayScore = awayScore
    match.status = 'completed'
    match.finishedAt = new Date()
    match.matchMinute = Number.isInteger(Number(body.matchMinute)) ? Math.min(150, Math.max(0, Number(body.matchMinute))) : (match.matchMinute ?? 90)
    if (body.matchReport && typeof body.matchReport === 'object') match.matchReport = { ...(match.matchReport?.toObject?.() ?? match.matchReport ?? {}), ...body.matchReport }
    match.confirmedAt = new Date()
    match.confirmedBy = auth.user.id as any
    if (headline) match.resultHeadline = headline
    if (summary) match.resultSummary = summary
    if (imageUrl) match.highlightImageUrl = imageUrl
    match.featured = body.featured === true
    await match.save()
    await AuditLogModel.create({
      actorId: auth.user.id, actor: auth.user.email, action: 'match.result.published', resource: 'match', resourceId: id,
      metadata: { before, after: { status: match.status, homeScore, awayScore }, resultHeadline: match.resultHeadline, hasImage: Boolean(match.highlightImageUrl) },
    })
    return NextResponse.json({
      id: String(match._id), homeId: String(match.homeId), awayId: String(match.awayId),
      date: match.date, time: match.time, venue: match.venue, round: match.round,
      status: match.status, homeScore, awayScore, resultHeadline: match.resultHeadline,
      resultSummary: match.resultSummary, highlightImageUrl: match.highlightImageUrl, featured: match.featured, matchMinute: match.matchMinute, matchReport: match.matchReport, finishedAt: match.finishedAt,
      confirmedAt: match.confirmedAt,
    })
  } catch (error) {
    return apiError(error)
  }
}
