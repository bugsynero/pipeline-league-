import { TeamModel, TournamentSettingsModel } from './models'

const initialTeams = [
  ['Ability FC','ABI'], ['Adams FC','ADA'], ['Atlantis FA','ATL'], ['Corinthians','COR'],
  ['Elite Ballers','ELI'], ['Heineken FC','HEI'], ['Kingz FC','KIN'], ['Madrid FC','MAD'],
  ['Predators FC','PRE'], ['Prime FC','PRI'], ['Rangers FC','RAN'], ['Silver and Gold','SAG'],
  ['Target Young A','TYA'], ['Target Young B','TYB'], ['Universal FC','UNI'],
] as const

export async function seedTournamentDefaults() {
  const existingCount = await TeamModel.countDocuments()
  if (existingCount === 0) {
    await TeamModel.insertMany(initialTeams.map(([name, initials]) => ({ name, initials, active: true })), { ordered: false })
  }
  await TournamentSettingsModel.updateOne(
    { key: 'tournament' },
    { $setOnInsert: {
      key: 'tournament',
      tournament: {
        name: 'Pipeline Annual Football Tournament 2026',
        tagline: 'Talent • Skills • Passion • Football at its Best',
        venue: 'Pipeline Field',
        startDate: '2026-11-23',
        kickOff: '16:00',
        status: 'ongoing',
        format: 'To be confirmed',
      },
      points: { win: 3, draw: 1, loss: 0 },
      tieBreakers: ['points', 'goalDifference', 'goalsFor'],
      organizerPhone: '09061206522',
    } },
    { upsert: true },
  )
}
