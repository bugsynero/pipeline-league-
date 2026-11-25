import { TeamModel, MatchModel, TournamentSettingsModel, PlayerModel, MatchEventModel, DisciplineOverrideModel } from './models'

const teamOut = (team: any) => ({
  id: String(team._id),
  name: team.name,
  initials: team.initials,
  active: team.active,
  ...(team.logoUrl ? { logoUrl: team.logoUrl } : {}),
})

export async function calculateStandings() {
  const [teams, matches, settings] = await Promise.all([
    TeamModel.find().sort({ name: 1 }).lean(),
    MatchModel.find({ status: 'completed', confirmedAt: { $exists: true } }).sort({ confirmedAt: 1 }).lean(),
    TournamentSettingsModel.findOne({ key: 'tournament' }).lean(),
  ])
  const points = settings?.points ?? { win: 3, draw: 1, loss: 0 }
  const table = new Map<string, any>()
  for (const team of teams) table.set(String(team._id), { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0, form: [] as string[] })
  for (const match of matches) {
    const home = table.get(String(match.homeId))
    const away = table.get(String(match.awayId))
    if (!home || !away || match.homeScore == null || match.awayScore == null) continue
    home.played++; away.played++
    home.gf += match.homeScore; home.ga += match.awayScore
    away.gf += match.awayScore; away.ga += match.homeScore
    if (match.homeScore > match.awayScore) {
      home.wins++; away.losses++; home.points += points.win; away.points += points.loss
      home.form.push('W'); away.form.push('L')
    } else if (match.homeScore < match.awayScore) {
      away.wins++; home.losses++; away.points += points.win; home.points += points.loss
      away.form.push('W'); home.form.push('L')
    } else {
      home.draws++; away.draws++; home.points += points.draw; away.points += points.draw
      home.form.push('D'); away.form.push('D')
    }
  }
  const rows = teams.map(team => {
    const stats = table.get(String(team._id))
    return { team: teamOut(team), ...stats, gd: stats.gf - stats.ga }
  })
  const tieBreakers = (settings?.tieBreakers ?? ['points', 'goalDifference', 'goalsFor'])
    .filter((key: string) => ['points', 'goalDifference', 'goalsFor'].includes(key))
  rows.sort((left: any, right: any) => {
    for (const key of tieBreakers) {
      const a = key === 'points' ? left.points : key === 'goalDifference' ? left.gd : left.gf
      const b = key === 'points' ? right.points : key === 'goalDifference' ? right.gd : right.gf
      if (a !== b) return b - a
    }
    return left.team.name.localeCompare(right.team.name)
  })
  return rows.map((row: any, index: number) => ({ position: index + 1, ...row, source: 'calculated' as const }))
}

export async function getDisciplineRows(includeZero = false) {
  const [players, completedMatches, events, overrides] = await Promise.all([
    PlayerModel.find().populate('teamId', 'name initials active logoUrl').sort({ name: 1 }).lean(),
    MatchModel.find({ status: 'completed', confirmedAt: { $exists: true } }).select('_id').lean(),
    MatchEventModel.find({ type: { $in: ['yellow_card', 'red_card'] } }).sort({ createdAt: 1 }).lean(),
    DisciplineOverrideModel.find().lean(),
  ])
  const confirmedIds = new Set(completedMatches.map(match => String(match._id)))
  const totals = new Map<string, { yellow: number; red: number }>()
  for (const event of events) {
    if (!confirmedIds.has(String(event.matchId))) continue
    const key = String(event.playerId)
    const count = totals.get(key) ?? { yellow: 0, red: 0 }
    if (event.type === 'yellow_card') count.yellow++
    if (event.type === 'red_card') count.red++
    totals.set(key, count)
  }
  const adjusted = new Map(overrides.map(row => [String(row.playerId), row]))
  const rows = players.map((player: any) => {
    const key = String(player._id)
    const computed = totals.get(key) ?? { yellow: 0, red: 0 }
    const override = adjusted.get(key)
    const yellow = override ? override.yellowCards : computed.yellow
    const red = override ? override.redCards : computed.red
    const team = player.teamId && typeof player.teamId === 'object' ? {
      id: String(player.teamId._id),
      name: player.teamId.name,
      initials: player.teamId.initials,
      active: player.teamId.active,
    } : null
    return {
      id: key,
      name: player.name,
      teamId: team?.id ?? String(player.teamId),
      team,
      number: player.number,
      photoUrl: player.photoUrl,
      yellow,
      red,
      yellowCards: yellow,
      redCards: red,
      manuallyAdjusted: Boolean(override),
      adjustmentReason: override?.reason,
      adjustedBy: override?.updatedBy,
      updatedAt: override?.updatedAt,
    }
  })
  return includeZero ? rows : rows.filter(row => row.yellow > 0 || row.red > 0)
}
