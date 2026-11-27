'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Activity, CalendarDays, Cloud, Flag, Play, Save, ShieldAlert, Square, Trophy, Upload, Wind } from 'lucide-react'
import { api } from '@/lib/services/api'
import type { Match, MatchEvent, MatchEventType, Player, Team } from '@/lib/types'

type Props = { rows: Match[]; teams: Team[]; players: Player[]; loading: boolean; error: unknown; refresh: () => Promise<unknown> | void }
const eventLabels: Record<MatchEventType, string> = { goal: 'Goal', assist: 'Assist', yellow_card: 'Yellow card', red_card: 'Red card', own_goal: 'Own goal' }
const dateLabel = (value: string) => { const parsed = new Date(value + 'T00:00:00'); return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }

export function AdminMatchManager({ rows, teams, players, loading, error, refresh }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [homeScore, setHomeScore] = useState('0')
  const [awayScore, setAwayScore] = useState('0')
  const [minute, setMinute] = useState('0')
  const [playerId, setPlayerId] = useState('')
  const [eventType, setEventType] = useState<MatchEventType>('goal')
  const [eventMinute, setEventMinute] = useState('1')
  const [eventNote, setEventNote] = useState('')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [eventCorrectionReason, setEventCorrectionReason] = useState('')
  const [fixtureHomeId, setFixtureHomeId] = useState('')
  const [fixtureAwayId, setFixtureAwayId] = useState('')
  const [fixtureDate, setFixtureDate] = useState('')
  const [fixtureTime, setFixtureTime] = useState('')
  const [fixtureVenue, setFixtureVenue] = useState('')
  const [fixtureRound, setFixtureRound] = useState('')
  const [fixtureReason, setFixtureReason] = useState('')
  const [headline, setHeadline] = useState('')
  const [summary, setSummary] = useState('')
  const [weather, setWeather] = useState('')
  const [pitchCondition, setPitchCondition] = useState('')
  const [attendance, setAttendance] = useState('')
  const [referee, setReferee] = useState('')
  const [playerOfTheMatch, setPlayerOfTheMatch] = useState('')
  const [incidents, setIncidents] = useState('')
  const [notes, setNotes] = useState('')
  const [featured, setFeatured] = useState(false)
  const imageRef = useRef<HTMLInputElement>(null)
  const match = rows.find(item => item.id === selectedId) ?? rows[0]
  const teamNames = useMemo(() => new Map(teams.map(team => [team.id, team.name])), [teams])
  const eligiblePlayers = useMemo(() => match ? players.filter(player => [match.homeId, match.awayId].includes(player.teamId)) : [], [match, players])
  const eventQuery = useSWR<MatchEvent[]>(match ? ['admin-match-events', match.id] : null, () => match ? api.matches.events(match.id) : Promise.resolve([]), { refreshInterval: 5000, revalidateOnFocus: true })
  const events = eventQuery.data ?? []

  useEffect(() => {
    if (!match) return
    setSelectedId(match.id)
    setHomeScore(String(match.homeScore ?? 0))
    setAwayScore(String(match.awayScore ?? 0))
    setMinute(String(match.matchMinute ?? 0))
    setFixtureHomeId(match.homeId)
    setFixtureAwayId(match.awayId)
    setFixtureDate(match.date)
    setFixtureTime(match.time)
    setFixtureVenue(match.venue)
    setFixtureRound(match.round)
    setFixtureReason('')
    setEditingEventId(null)
    setEventCorrectionReason('')
    setEventNote('')
    setHeadline(match.resultHeadline ?? '')
    setSummary(match.resultSummary ?? '')
    setWeather(match.matchReport?.weather ?? '')
    setPitchCondition(match.matchReport?.pitchCondition ?? '')
    setAttendance(match.matchReport?.attendance ?? '')
    setReferee(match.matchReport?.referee ?? '')
    setPlayerOfTheMatch(match.matchReport?.playerOfTheMatch ?? '')
    setIncidents(match.matchReport?.incidents ?? '')
    setNotes(match.matchReport?.notes ?? '')
    setFeatured(Boolean(match.featured))
    setPlayerId('')
  // Keep an administrator's unsaved form edits while the match list polls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id])

  async function run(task: () => Promise<unknown>, success: string) {
    setPending(true)
    setNotice('')
    try {
      await task()
      await refresh()
      await eventQuery.mutate()
      setNotice(success)
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'The action could not be completed.')
    } finally {
      setPending(false)
    }
  }
  function scores() {
    const home = Number(homeScore), away = Number(awayScore), currentMinute = Number(minute)
    if (!Number.isInteger(home) || home < 0 || home > 99 || !Number.isInteger(away) || away < 0 || away > 99) throw new Error('Enter whole-number scores between 0 and 99.')
    if (!Number.isInteger(currentMinute) || currentMinute < 0 || currentMinute > 150) throw new Error('Enter a match minute between 0 and 150.')
    return { home, away, currentMinute }
  }
  async function startMatch() {
    if (!match) return
    await run(() => api.matches.start(match.id), 'Match started. The fixture remains visible as PLAYING NOW.')
  }
  async function saveLiveScore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!match) return
    try {
      const score = scores()
      await run(() => api.matches.updateLiveScore(match.id, { homeScore: score.home, awayScore: score.away, matchMinute: score.currentMinute }), 'Live scoreboard updated and published.')
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Invalid score.') }
  }
  async function addEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!match) return
    const value = Number(eventMinute)
    if (!playerId || !Number.isInteger(value) || value < 0 || value > 150) { setNotice('Choose a player and enter a valid event minute.'); return }
    if (editingEventId && eventCorrectionReason.trim().length < 5) { setNotice('Enter a correction reason of at least five characters before editing this event.'); return }
    if (editingEventId) {
      await run(async () => {
        const result = await api.matches.updateEvent(match.id, editingEventId, { playerId, type: eventType, minute: value, note: eventNote.trim() || undefined, reason: eventCorrectionReason.trim() })
        if (result.score) { setHomeScore(String(result.score.home)); setAwayScore(String(result.score.away)) }
      }, 'Match timeline event corrected and recorded in the audit log.')
      setEditingEventId(null)
      setEventCorrectionReason('')
    } else {
      await run(async () => { const result = await api.matches.addEvent(match.id, { playerId, type: eventType, minute: value, note: eventNote.trim() || undefined }); if (result.score) { setHomeScore(String(result.score.home)); setAwayScore(String(result.score.away)) } }, 'Match event added to the live timeline.')
    }
    setEventNote('')
    setPlayerId('')
  }
  function editEvent(item: MatchEvent) {
    setEditingEventId(item.id)
    setPlayerId(item.playerId)
    setEventType(item.type)
    setEventMinute(String(item.minute))
    setEventNote(item.note ?? '')
    setEventCorrectionReason('')
    setNotice('Editing an existing timeline event. Enter a reason before saving the correction.')
  }
  function cancelEventEdit() {
    setEditingEventId(null)
    setPlayerId('')
    setEventNote('')
    setEventCorrectionReason('')
  }
  async function deleteEvent(item: MatchEvent) {
    if (!match) return
    const reason = window.prompt('Reason for removing this timeline event (at least five characters):')
    if (!reason || reason.trim().length < 5) return
    await run(() => api.matches.removeEvent(match.id, item.id, reason.trim()), 'Match timeline event removed and recorded in the audit log.')
    if (editingEventId === item.id) cancelEventEdit()
  }
  async function saveFixtureDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!match) return
    if (fixtureHomeId === fixtureAwayId) { setNotice('Choose two different teams for this fixture.'); return }
    const teamsChanged = fixtureHomeId !== match.homeId || fixtureAwayId !== match.awayId
    const requiresReason = match.status !== 'scheduled' || teamsChanged
    if (requiresReason && fixtureReason.trim().length < 5) { setNotice('Enter a correction reason of at least five characters for this fixture correction.'); return }
    await run(() => api.matches.updateDetails(match.id, {
      homeId: fixtureHomeId, awayId: fixtureAwayId, date: fixtureDate, time: fixtureTime, venue: fixtureVenue, round: fixtureRound,
      ...(requiresReason ? { reason: fixtureReason.trim() } : {}),
    }), 'Fixture details corrected and recorded. Public fixtures and results will refresh automatically.')
    setFixtureReason('')
  }
  async function saveReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!match) return
    await run(() => api.matches.updateReport(match.id, {
      resultHeadline: headline, resultSummary: summary, weather, pitchCondition, attendance, referee,
      playerOfTheMatch, incidents, notes, featured,
    }), 'Match report saved. Public match centre will refresh automatically.')
  }
  async function publishFullTime() {
    if (!match) return
    try {
      const score = scores()
      await run(() => api.matches.publishResult(match.id, {
        homeScore: score.home, awayScore: score.away, matchMinute: score.currentMinute || 90,
        resultHeadline: headline, resultSummary: summary, featured,
        matchReport: { weather, pitchCondition, attendance, referee, playerOfTheMatch, incidents, notes },
      }), 'Full-time result and match report published to the public site.')
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Enter a valid final score.') }
  }
  async function correctFinalScore() {
    if (!match) return
    const reason = window.prompt('Reason for correcting this confirmed result (at least 5 characters):')
    if (!reason || reason.trim().length < 5) return
    try {
      const score = scores()
      await run(() => api.matches.correct(match.id, { homeScore: score.home, awayScore: score.away, reason: reason.trim() }), 'Confirmed score corrected. The correction is recorded in the audit log.')
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Enter a valid score.') }
  }
  async function deleteMatch() {
    if (!match) return
    const reason = window.prompt('Reason for deleting this match/fixture and its result (at least five characters):')
    if (!reason || reason.trim().length < 5) return
    const label = homeName + ' ' + (match.homeScore ?? '—') + '–' + (match.awayScore ?? '—') + ' ' + awayName
    if (!window.confirm('Permanently delete ' + label + '? Its match events will also be removed from active records. A complete snapshot and your reason will remain in the audit log.')) return
    setPending(true)
    setNotice('')
    try {
      await api.matches.removeWithReason(match.id, reason.trim())
      const nextMatch = rows.find(item => item.id !== match.id)
      setSelectedId(nextMatch?.id ?? '')
      await refresh()
      setNotice('Match/fixture deleted. The deletion snapshot is retained in the audit log and public standings have been recalculated.')
      setEditingEventId(null)
      setEventCorrectionReason('')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'The match could not be deleted.')
    } finally {
      setPending(false)
    }
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file || !match) return
    await run(async () => {
      const uploaded = await api.uploads.image(file)
      await api.matches.updateReport(match.id, { highlightImageUrl: uploaded.url })
    }, 'Match photograph uploaded and linked to this match.')
  }

  if (loading) return <div className="empty-state">Loading match records…</div>
  if (error) return <div className="empty-state" role="alert">{error instanceof Error ? error.message : 'Matches could not be loaded.'}</div>
  if (!rows.length) return <div className="panel empty-state">No matches are available yet. Create fixtures in the Fixtures section first.</div>
  const homeName = teamNames.get(match?.homeId ?? '') ?? 'Home team'
  const awayName = teamNames.get(match?.awayId ?? '') ?? 'Away team'
  const isLive = match?.status === 'live'
  const completed = match?.status === 'completed'

  return <div className="admin-live-match-manager">
    {notice && <div className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    <div className="admin-live-match-layout">
      <aside className="panel admin-live-match-list">
        <div className="admin-match-section-heading"><div><span className="eyebrow">MATCHDAY CONTROL</span><h2>All fixtures</h2></div><span>{rows.length} matches</span></div>
        {rows.slice().sort((a, b) => (a.status === 'live' ? -1 : 0) - (b.status === 'live' ? -1 : 0) || (a.date + a.time).localeCompare(b.date + b.time)).map(item => {
          const selected = item.id === match?.id
          const home = teamNames.get(item.homeId) ?? 'Home'
          const away = teamNames.get(item.awayId) ?? 'Away'
          return <button type="button" key={item.id} className={'admin-live-match-card' + (selected ? ' is-selected' : '')} onClick={() => setSelectedId(item.id)}>
            <span className="admin-live-match-card-top"><small>{item.date} · {item.time}</small><b className={'admin-live-status status-' + item.status}>{item.status === 'live' ? 'PLAYING NOW' : item.status.toUpperCase()}</b></span>
            <strong>{home} <span>vs</span> {away}</strong>
            <span className="admin-live-match-card-bottom">{item.status === 'completed' ? (item.homeScore ?? 0) + ' – ' + (item.awayScore ?? 0) + ' · Full time' : item.status === 'live' ? (item.homeScore ?? 0) + ' – ' + (item.awayScore ?? 0) + ' · ' + (item.matchMinute ?? 0) + "'" : item.round}</span>
          </button>
        })}
      </aside>

      {match && <section className="admin-live-match-detail">
        <section className="panel admin-live-scoreboard">
          <div className="admin-match-section-heading"><div><span className="eyebrow">{match.round} · {match.venue}</span><h2>{dateLabel(match.date)}</h2></div><span className={'admin-live-status status-' + match.status}>{isLive ? '● PLAYING NOW' : match.status.toUpperCase()}</span></div>
          <div className="admin-live-score-teams">
            <div><span className="admin-live-team-label">HOME</span><b>{homeName}</b></div>
            <div className="admin-live-score-value"><strong>{match.homeScore ?? 0} <i>:</i> {match.awayScore ?? 0}</strong><small>{isLive ? 'LIVE · ' + (match.matchMinute ?? 0) + "'" : completed ? 'FULL TIME' : 'NOT STARTED'}</small></div>
            <div><span className="admin-live-team-label">AWAY</span><b>{awayName}</b></div>
          </div>
          {match.status === 'scheduled' && <button type="button" className="button-publish" disabled={pending} onClick={startMatch}><Play/> Start match — publish LIVE status</button>}
          {match.status === 'cancelled' && <p className="admin-editor-footnote">This fixture has been cancelled and cannot be started.</p>}
          <div className="admin-editor-actions admin-match-danger-actions"><button type="button" className="button-outline" disabled={pending} onClick={deleteMatch}>Delete match / result</button></div>
        </section>

        <form className="panel admin-match-manager-form" onSubmit={saveFixtureDetails}>
          <div className="admin-match-section-heading"><div><span className="eyebrow">FIXTURE DETAILS</span><h2>Edit match information</h2><p>Correct the teams, schedule, venue or matchday details for any fixture. Live, cancelled and completed corrections require a reason; recorded player events must still belong to the selected teams.</p></div><CalendarDays/></div>
          <div className="admin-match-report-grid">
            <label>Home team<select value={fixtureHomeId} onChange={e => setFixtureHomeId(e.target.value)}>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label>Away team<select value={fixtureAwayId} onChange={e => setFixtureAwayId(e.target.value)}>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label>Match date<input type="date" required value={fixtureDate} onChange={e => setFixtureDate(e.target.value)}/></label>
            <label>Kick-off time<input type="time" required value={fixtureTime} onChange={e => setFixtureTime(e.target.value)}/></label>
            <label>Venue<input required maxLength={120} value={fixtureVenue} onChange={e => setFixtureVenue(e.target.value)}/></label>
            <label>Round / matchday<input required maxLength={80} value={fixtureRound} onChange={e => setFixtureRound(e.target.value)}/></label>
          </div>
          {(completed || isLive || match.status === 'cancelled' || fixtureHomeId !== match.homeId || fixtureAwayId !== match.awayId) && <label>Correction reason (required)<input required minLength={5} maxLength={500} value={fixtureReason} onChange={e => setFixtureReason(e.target.value)} placeholder="Why are these fixture details being corrected?"/></label>}
          <button className="button-outline" type="submit" disabled={pending}><Save/> Save fixture changes</button>
        </form>

        {(isLive || !completed) && <form className="panel admin-match-manager-form" onSubmit={saveLiveScore}>
          <div className="admin-match-section-heading"><div><span className="eyebrow">LIVE CONTROL</span><h2>Manual live scoreboard</h2><p>Update the score and match minute from the touchline. Viewers see the new values on the next live refresh.</p></div><Activity/></div>
          <div className="admin-match-score-fields"><label>{homeName} score<input type="number" min="0" max="99" value={homeScore} onChange={e => setHomeScore(e.target.value)}/></label><label>{awayName} score<input type="number" min="0" max="99" value={awayScore} onChange={e => setAwayScore(e.target.value)}/></label><label>Match minute<input type="number" min="0" max="150" value={minute} onChange={e => setMinute(e.target.value)}/></label></div>
          <button className="button-publish" type="submit" disabled={pending || !isLive}><Save/> {pending ? 'Saving…' : 'Update live score'}</button>
          {!isLive && <small className="admin-editor-footnote">Start the match before saving a live scoreboard update.</small>}
        </form>}

        {(isLive || match.status === 'scheduled' || Boolean(editingEventId)) && <section className="panel admin-match-manager-form">
          <div className="admin-match-section-heading"><div><span className="eyebrow">LIVE MATCH ACTIONS</span><h2>{editingEventId ? 'Correct timeline event' : 'Record goals and discipline'}</h2><p>Goals and own goals update the live score automatically. Corrected events recalculate the score and are recorded in the audit log.</p></div><ShieldAlert/></div>
          <form onSubmit={addEvent} className="admin-match-event-form">
            <label>Player<select required value={playerId} onChange={e => setPlayerId(e.target.value)}><option value="">Choose a player</option>{eligiblePlayers.map(player => <option key={player.id} value={player.id}>{player.name} · {teamNames.get(player.teamId) ?? 'Team'} · #{player.number}</option>)}</select></label>
            <label>Event type<select value={eventType} onChange={e => setEventType(e.target.value as MatchEventType)}>{Object.entries(eventLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
            <label>Minute<input type="number" min="0" max="150" value={eventMinute} onChange={e => setEventMinute(e.target.value)}/></label>
            <label>Event note (optional)<input value={eventNote} onChange={e => setEventNote(e.target.value)} placeholder="e.g. penalty, second yellow card"/></label>
            {editingEventId && <label>Correction reason<input required minLength={5} maxLength={500} value={eventCorrectionReason} onChange={e => setEventCorrectionReason(e.target.value)} placeholder="Explain the correction (5+ characters)"/></label>}
            <button className="button-primary" type="submit" disabled={pending || !eligiblePlayers.length}><Flag/> {editingEventId ? 'Save event correction' : 'Add match event'}</button>
            {editingEventId && <button type="button" className="button-outline" onClick={cancelEventEdit} disabled={pending}>Cancel edit</button>}
          </form>
          {!eligiblePlayers.length && <p className="admin-editor-footnote">Register players for both teams before recording player events.</p>}
        </section>}

        <section className="panel admin-match-manager-form">
          <div className="admin-match-section-heading"><div><span className="eyebrow">MATCHDAY REPORT</span><h2>Match details and circumstances</h2><p>Record observed conditions and match-day incidents. Weather is entered by the match official; it is not guessed or automatically generated.</p></div><Cloud/></div>
          <form onSubmit={saveReport} className="admin-match-report-form">
            <label>Report headline<input maxLength={140} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. Late winner seals hard-fought contest"/></label>
            <label>Match summary<textarea maxLength={2000} rows={4} value={summary} onChange={e => setSummary(e.target.value)} placeholder="Describe the match, key moments and outcome…"/></label>
            <div className="admin-match-report-grid">
              <label><span><Cloud/> Weather during match</span><input maxLength={100} value={weather} onChange={e => setWeather(e.target.value)} placeholder="e.g. Light rain, cloudy, hot"/></label>
              <label><span><Wind/> Pitch condition</span><input maxLength={160} value={pitchCondition} onChange={e => setPitchCondition(e.target.value)} placeholder="e.g. Wet surface, good condition"/></label>
              <label>Attendance<input maxLength={60} value={attendance} onChange={e => setAttendance(e.target.value)} placeholder="e.g. Approx. 350"/></label>
              <label>Referee / officials<input maxLength={100} value={referee} onChange={e => setReferee(e.target.value)}/></label>
              <label>Player of the match<input maxLength={120} value={playerOfTheMatch} onChange={e => setPlayerOfTheMatch(e.target.value)}/></label>
            </div>
            <label>Red cards, yellow cards and major incidents<textarea maxLength={2000} rows={3} value={incidents} onChange={e => setIncidents(e.target.value)} placeholder="Summarise dismissals, bookings, injuries, delays, protests or other unforeseen circumstances. Individual card events can also be recorded above."/></label>
            <label>Additional match notes<textarea maxLength={2000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Other relevant information for viewers…"/></label>
            <label className="admin-match-featured"><input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)}/> Feature this result on the tournament homepage</label>
            {match.highlightImageUrl && <div className="admin-match-image-preview"><span className="eyebrow">CURRENT MATCH PHOTOGRAPH</span><a href={match.highlightImageUrl} target="_blank" rel="noreferrer" aria-label="Open current match photograph in a new tab" style={{ backgroundImage: 'url("' + match.highlightImageUrl + '")' }}/></div>}
            <div className="admin-editor-actions"><button className="button-publish" type="submit" disabled={pending}><Save/> Save match report</button><input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={uploadImage}/><button type="button" className="button-outline" disabled={pending} onClick={() => imageRef.current?.click()}><Upload/> {match.highlightImageUrl ? 'Replace match image' : 'Upload match image'}</button></div>
          </form>
        </section>

        <section className="panel admin-match-manager-form">
          <div className="admin-match-section-heading"><div><span className="eyebrow">MATCH TIMELINE</span><h2>Events recorded</h2></div><span>{events.length} events</span></div>
          {eventQuery.error ? <p className="form-error">Event timeline could not be loaded. {eventQuery.error instanceof Error ? eventQuery.error.message : ''}</p> : !events.length ? <p className="admin-editor-footnote">No goal, assist or card events have been recorded for this match.</p> :
            <div className="admin-match-events">{events.map(item => <div className="admin-match-event-row" key={item.id}><b>{item.minute}'</b><span className={'admin-event-icon event-' + item.type}>{item.type === 'yellow_card' ? '🟨' : item.type === 'red_card' ? '🟥' : item.type === 'goal' || item.type === 'own_goal' ? '⚽' : '↗'}</span><div><strong>{eventLabels[item.type]}</strong><small>{item.player?.name ?? 'Player'} · {item.player?.teamName ?? 'Team'}{item.note ? ' · ' + item.note : ''}</small></div><div className="admin-event-actions"><button type="button" className="button-outline" disabled={pending} onClick={() => editEvent(item)}>Edit</button><button type="button" className="button-outline" disabled={pending} onClick={() => deleteEvent(item)}>Remove</button></div></div>)}</div>}
        </section>

        {(isLive || match.status === 'scheduled') && <section className="admin-match-finish-row"><div><h3>Ready to confirm full time?</h3><p>Publish the final score, timeline and report. This locks match events as an official result.</p></div><button type="button" className="button-publish" disabled={pending} onClick={publishFullTime}><Square/> Confirm full time and publish</button></section>}
        {completed && <div className="panel admin-match-manager-form"><div className="admin-match-section-heading"><div><span className="eyebrow">CONFIRMED RESULT</span><h2>Result correction</h2><p>Correcting a confirmed score requires a reason and is written to the audit log.</p></div></div><div className="admin-match-score-fields"><label>{homeName} score<input type="number" min="0" max="99" value={homeScore} onChange={e => setHomeScore(e.target.value)}/></label><label>{awayName} score<input type="number" min="0" max="99" value={awayScore} onChange={e => setAwayScore(e.target.value)}/></label><label>Match minute<input type="number" min="0" max="150" value={minute} onChange={e => setMinute(e.target.value)}/></label></div><button type="button" className="button-outline" disabled={pending} onClick={correctFinalScore}>Correct final score (audited)</button></div>}
      </section>}
    </div>
  </div>
}
