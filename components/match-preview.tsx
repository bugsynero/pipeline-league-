'use client'

import Image from 'next/image'
import { Activity, ArrowRight, CalendarDays, Clock3, Crosshair, Shield, Trophy } from 'lucide-react'
import type { LeagueStanding, Match, PlayerPerformance, Team } from '@/lib/types'

type FormMark = { result: 'W' | 'D' | 'L'; label: string }
type TeamProfile = {
  team: Team
  position: number | null
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  form: FormMark[]
  index: number | null
  players: PlayerPerformance[]
  topScorer?: PlayerPerformance
  assistLeader?: PlayerPerformance
}

function profileFor(team: Team, standings: LeagueStanding[], matches: Match[], players: PlayerPerformance[]): TeamProfile {
  const row = standings.find(item => item.team.id === team.id)
  const teamMatches = matches
    .filter(match => match.status === 'completed' && match.homeScore != null && match.awayScore != null && (match.homeId === team.id || match.awayId === team.id))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const form = teamMatches.slice(0, 5).map(match => {
    const home = match.homeId === team.id
    const scored = home ? Number(match.homeScore) : Number(match.awayScore)
    const conceded = home ? Number(match.awayScore) : Number(match.homeScore)
    const result: FormMark['result'] = scored > conceded ? 'W' : scored < conceded ? 'L' : 'D'
    return { result, label: result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss' }
  })
  const played = row?.played ?? team.played ?? 0
  const wins = row?.wins ?? team.wins ?? 0
  const draws = row?.draws ?? team.draws ?? 0
  const losses = row?.losses ?? team.losses ?? 0
  const goalsFor = row?.gf ?? team.gf ?? 0
  const goalsAgainst = row?.ga ?? team.ga ?? 0
  const points = row?.points ?? team.points ?? 0
  const goalDifference = goalsFor - goalsAgainst
  const recentFormPoints = form.reduce((total, mark) => total + (mark.result === 'W' ? 3 : mark.result === 'D' ? 1 : 0), 0)
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  // Transparent advisory index: league points per game (45%), last-five form (35%), and goal difference per game (20%).
  const recentFormRatio = form.length ? recentFormPoints / (form.length * 3) : 0
  const index = played > 0
    ? Math.round(clamp(points / (played * 3), 0, 1) * 45 + recentFormRatio * 35 + ((clamp(goalDifference / played, -1, 1) + 1) / 2) * 20)
    : null
  const teamPlayers = players.filter(player => player.teamId === team.id).sort((a, b) =>
    (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name),
  )
  const topScorer = [...teamPlayers].filter(player => player.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0]
  const assistLeader = [...teamPlayers].filter(player => player.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0]
  return { team, position: row?.position ?? null, played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, points, form, index, players: teamPlayers, topScorer, assistLeader }
}

function TeamCrest({ team, large = false }: { team: Team; large?: boolean }) {
  return <div className={'match-centre-crest' + (large ? ' is-large' : '')}>
    {team.logoUrl
      ? <Image src={team.logoUrl} alt={team.name + ' crest'} fill sizes={large ? '112px' : '54px'} />
      : <span>{team.initials}</span>}
  </div>
}

function PlayerMini({ player, role }: { player?: PlayerPerformance; role: string }) {
  if (!player) return <div className="match-centre-player-empty"><span>{role}</span><b>Awaiting published stats</b></div>
  return <div className="match-centre-player">
    <div className="match-centre-player-photo">
      {player.photoUrl ? <Image src={player.photoUrl} alt={player.name} fill sizes="56px"/> : <span>{player.name.slice(0, 1).toUpperCase()}</span>}
    </div>
    <div className="match-centre-player-copy"><small>{role} · #{player.number}</small><b>{player.name}</b><span>{player.goals} goals · {player.assists} assists</span></div>
    <strong>{role === 'TOP SCORER' ? player.goals : player.assists}</strong>
  </div>
}

function TeamPanel({ profile, side }: { profile: TeamProfile; side: 'home' | 'away' }) {
  const { team } = profile
  return <section className={'match-centre-team-panel ' + side}>
    <div className="match-centre-team-head"><TeamCrest team={team} large/><div><span className="match-centre-overline">{side === 'home' ? 'HOME TEAM' : 'AWAY TEAM'}</span><h2>{team.name}</h2><small>{profile.position ? 'League position #' + profile.position + ' · ' : ''}{profile.played} league matches played</small></div></div>
    <div className="match-centre-strength"><div><span>TOURNAMENT PERFORMANCE INDEX</span><b>{profile.index == null ? '—' : profile.index + '/100'}</b></div><div className="match-centre-meter"><span style={{ width: (profile.index ?? 0) + '%' }}/></div><small>{profile.index == null ? 'Not enough confirmed matches to calculate a rating.' : 'Advisory index from league points, last-five form and goal difference.'}</small></div>
    <div className="match-centre-form"><span>LAST FIVE</span><div>{profile.form.length ? profile.form.map((mark, index) => <span key={index} className={'form-mark form-' + mark.result.toLowerCase()} title={mark.label}>{mark.result}</span>) : <small>No confirmed results yet</small>}</div></div>
    <div className="match-centre-record"><div><strong>{profile.wins}</strong><span>WINS</span></div><div><strong>{profile.draws}</strong><span>DRAWS</span></div><div><strong>{profile.losses}</strong><span>LOSSES</span></div><div><strong>{profile.points}</strong><span>POINTS</span></div></div>
  </section>
}

function Comparison({ home, away }: { home: TeamProfile; away: TeamProfile }) {
  const rows: { label: string; home: number; away: number; neutral?: boolean; lowerBetter?: boolean }[] = [
    { label: 'Matches played', home: home.played, away: away.played, neutral: true },
    { label: 'Wins', home: home.wins, away: away.wins },
    { label: 'Goals scored', home: home.goalsFor, away: away.goalsFor },
    { label: 'Goals conceded', home: home.goalsAgainst, away: away.goalsAgainst, lowerBetter: true },
    { label: 'Goal difference', home: home.goalDifference, away: away.goalDifference },
    { label: 'League points', home: home.points, away: away.points },
  ]
  return <section className="match-centre-comparison panel">
    <div className="match-centre-section-title"><span className="match-centre-section-icon"><Activity/></span><div><span className="match-centre-overline">HEAD-TO-HEAD</span><h2>Team comparison</h2></div></div>
    {rows.map(row => {
      const homeWins = !row.neutral && (row.lowerBetter ? row.home < row.away : row.home > row.away)
      const awayWins = !row.neutral && (row.lowerBetter ? row.away < row.home : row.away > row.home)
      const max = Math.max(Math.abs(row.home), Math.abs(row.away), 1)
      const homeWidth = Math.max(row.home === 0 ? 0 : 4, Math.min(100, Math.abs(row.home) / max * 100))
      const awayWidth = Math.max(row.away === 0 ? 0 : 4, Math.min(100, Math.abs(row.away) / max * 100))
      return <div className="match-centre-stat-row" key={row.label}>
        <div className="match-centre-stat-values"><b className={homeWins ? 'is-ahead' : ''}>{row.home}</b><span>{row.label}</span><b className={awayWins ? 'is-ahead' : ''}>{row.away}</b></div>
        <div className="match-centre-stat-bars"><div><span style={{ width: homeWidth + '%' }}/></div><div><span style={{ width: awayWidth + '%' }}/></div></div>
      </div>
    })}
  </section>
}

function KeyPlayers({ profile }: { profile: TeamProfile }) {
  const keyPlayers = profile.players.filter(player => player.goals > 0 || player.assists > 0).slice(0, 3)
  return <section className="match-centre-key-players panel">
    <div className="match-centre-section-title"><span className="match-centre-section-icon"><Shield/></span><div><span className="match-centre-overline">PLAYERS TO WATCH</span><h2>{profile.team.name}</h2></div></div>
    <div className="match-centre-leaders">
      <PlayerMini player={profile.topScorer} role="TOP SCORER"/>
      <PlayerMini player={profile.assistLeader} role="ASSIST LEADER"/>
    </div>
    <div className="match-centre-roster-title"><span>IN-FORM PLAYERS</span><small>Admin-published goal contributions</small></div>
    {keyPlayers.length ? <div className="match-centre-player-list">{keyPlayers.map(player => <div className="match-centre-form-player" key={player.id}><span>#{player.number}</span><b>{player.name}</b><small>{player.goals} G · {player.assists} A</small></div>)}</div> : <p className="match-centre-no-stats">Player performance records will appear after the tournament administrator publishes goals and assists.</p>}
  </section>
}

export function MatchPreview({ match, teams, standings, matches, players }: {
  match: Match
  teams: Team[]
  standings: LeagueStanding[]
  matches: Match[]
  players: PlayerPerformance[]
}) {
  const homeTeam = teams.find(team => team.id === match.homeId) ?? standings.find(row => row.team.id === match.homeId)?.team
  const awayTeam = teams.find(team => team.id === match.awayId) ?? standings.find(row => row.team.id === match.awayId)?.team
  if (!homeTeam || !awayTeam) return <section className="panel match-centre-notice">Team information is not available for this fixture yet.</section>
  const home = profileFor(homeTeam, standings, matches, players)
  const away = profileFor(awayTeam, standings, matches, players)
  const completed = match.status === 'completed' && match.homeScore != null && match.awayScore != null
  const date = new Date(match.date + 'T00:00:00')
  const dateLabel = Number.isNaN(date.getTime()) ? match.date : date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return <div className="match-centre">
    <section className="match-centre-hero">
      <div className="match-centre-topline"><span><Trophy/> PIPELINE TOURNAMENT · MATCH CENTRE</span><strong>{match.round}</strong></div>
      <div className="match-centre-identity">
        <div className="match-centre-side"><TeamCrest team={homeTeam} large/><b>{homeTeam.name}</b><small>HOME</small></div>
        <div className="match-centre-score">
          <span>{completed ? 'FULL TIME' : match.status === 'live' ? 'LIVE MATCH' : 'UPCOMING FIXTURE'}</span>
          <strong>{completed ? homeTeam && String(match.homeScore) + ' : ' + String(match.awayScore) : 'VS'}</strong>
          <small>{match.status.toUpperCase()}</small>
        </div>
        <div className="match-centre-side"><TeamCrest team={awayTeam} large/><b>{awayTeam.name}</b><small>AWAY</small></div>
      </div>
      <div className="match-centre-meta"><span><CalendarDays/>{dateLabel}</span><span><Clock3/>{match.time}</span><span><Crosshair/>{match.venue}</span></div>
    </section>
    {match.resultHeadline && <section className="match-centre-result panel"><span className="match-centre-overline">OFFICIAL MATCH REPORT</span><h2>{match.resultHeadline}</h2>{match.resultSummary && <p>{match.resultSummary}</p>}{match.highlightImageUrl && <a href={match.highlightImageUrl} target="_blank" rel="noreferrer">View match photograph <ArrowRight/></a>}</section>}
    <div className="match-centre-teams-grid"><TeamPanel profile={home} side="home"/><TeamPanel profile={away} side="away"/></div>
    <Comparison home={home} away={away}/>
    <div className="match-centre-player-grid"><KeyPlayers profile={home}/><KeyPlayers profile={away}/></div>
    <p className="match-centre-data-note">Performance figures are based on published tournament standings, confirmed match results and player statistics entered by tournament administrators. The performance index is an advisory comparison, not an official governing-body rating.</p>
  </div>
}
