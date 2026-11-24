import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { connectToDatabase } from '@/lib/server/db'
import { PlayerModel } from '@/lib/server/models'
import { apiError } from '@/lib/server/http'
export const runtime = 'nodejs'
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase()
    const { id } = await params
    if (!isValidObjectId(id)) return NextResponse.json({ code: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 })
    const players = await PlayerModel.find({ teamId: id }).sort({ number: 1 }).lean()
    return NextResponse.json(players.map((p: any) => ({ id: String(p._id), name: p.name, teamId: String(p.teamId), number: p.number, appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0 })))
  } catch (error) { return apiError(error) }
}
