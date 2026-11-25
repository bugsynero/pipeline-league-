import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { StandingsPublicationModel } from '@/lib/server/models'
import { calculateStandings } from '@/lib/server/statistics'
import { apiError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function manualRow(row: any, publishedAt: Date) {
  const team = row.teamId && typeof row.teamId === 'object' ? row.teamId : null
  return {
    position: row.position,
    team: team ? { id: String(team._id), name: team.name, initials: team.initials, active: team.active, logoUrl: team.logoUrl } : null,
    played: row.played, wins: row.wins, draws: row.draws, losses: row.losses,
    gf: row.gf, ga: row.ga, gd: row.gf - row.ga, points: row.points, form: [],
    source: 'manual' as const, publishedAt: publishedAt.toISOString(),
  }
}

export async function GET() {
  try {
    await connectToDatabase()
    const publication = await StandingsPublicationModel.findOne({ key: 'current' }).populate('publishedRows.teamId').lean()
    if (publication?.publishedAt && publication.publishedRows?.length) {
      return NextResponse.json(publication.publishedRows.map((row: any) => manualRow(row, publication.publishedAt!)))
    }
    return NextResponse.json(await calculateStandings())
  } catch (error) {
    return apiError(error)
  }
}
