import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { getDisciplineRows } from '@/lib/server/statistics'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectToDatabase()
    return NextResponse.json(await getDisciplineRows(false))
  } catch (error) {
    return apiError(error)
  }
}
