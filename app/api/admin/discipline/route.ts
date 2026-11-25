import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage } from '@/lib/server/authorization'
import { getDisciplineRows } from '@/lib/server/statistics'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const auth = await requireAdmin(request)
    if (!auth.user) return NextResponse.json(auth.response, { status: auth.status })
    if (!canManage(auth.user.role, 'statistics')) return NextResponse.json({ code: 'FORBIDDEN', message: 'Your role cannot manage discipline records.' }, { status: 403 })
    return NextResponse.json(await getDisciplineRows(true))
  } catch (error) {
    return apiError(error)
  }
}
