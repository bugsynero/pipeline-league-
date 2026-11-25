import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { getManualPlayerStatistics } from '@/lib/server/statistics'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectToDatabase()
    const rows = await getManualPlayerStatistics(false)
    return NextResponse.json(rows.filter(row => row.goals > 0).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)))
  } catch (error) {
    return apiError(error)
  }
}
