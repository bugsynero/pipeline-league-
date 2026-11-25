import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { getManualPlayerStatistics } from '@/lib/server/statistics'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectToDatabase()
    return NextResponse.json((await getManualPlayerStatistics(false)).filter(row => row.yellowCards > 0 || row.redCards > 0 || row.suspensionMatch))
  } catch (error) {
    return apiError(error)
  }
}
