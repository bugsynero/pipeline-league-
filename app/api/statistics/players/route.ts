import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { getManualPlayerStatistics } from '@/lib/server/statistics'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await connectToDatabase()
    const rows = await getManualPlayerStatistics(true)
    return NextResponse.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      teamId: row.teamId,
      team: row.team,
      number: row.number,
      photoUrl: row.photoUrl,
      goals: row.goals,
      assists: row.assists,
      appearances: row.appearances,
    })))
  } catch (error) {
    return apiError(error)
  }
}
