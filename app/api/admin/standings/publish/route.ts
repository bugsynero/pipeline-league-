import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { StandingsPublicationModel, AuditLogModel } from '@/lib/server/models'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'statistics')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot publish standings.' }, { status: 403 })
    const publication = await StandingsPublicationModel.findOne({ key: 'current' })
    if (!publication?.draftRows?.length) return NextResponse.json({ code: 'NO_STANDINGS_DRAFT', message: 'Save a complete standings draft before publishing.' }, { status: 409 })
    publication.publishedRows = publication.draftRows
    publication.publishedAt = new Date()
    publication.publishedBy = auth.user.email
    await publication.save()
    await AuditLogModel.create({ actorId: auth.user.id, actor: auth.user.email, action: 'standings.published', resource: 'standings', resourceId: 'current', metadata: { teams: publication.publishedRows.length } })
    return NextResponse.json({ ok: true, publishedAt: publication.publishedAt, publishedBy: publication.publishedBy })
  } catch (error) {
    return apiError(error)
  }
}
