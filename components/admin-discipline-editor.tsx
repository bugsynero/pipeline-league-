'use client'
import { useEffect, useState } from 'react'
import { useSWRConfig } from 'swr'
import { Save } from 'lucide-react'
import { api } from '@/lib/services/api'
import type { Match } from '@/lib/types'

type PlayerRow = { id: string; name: string; number: number; photoUrl?: string; team?: { name: string }; yellowCards: number; redCards: number; suspendedForMatchId?: string; suspensionMatch?: { label: string; date: string }; suspensionReason?: string; updatedBy?: string }
type Value = { yellowCards: number; redCards: number; suspendedForMatchId: string; reason: string }
const num = (value: string) => Math.max(0, Math.min(99, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0))

export function AdminDisciplineEditor({ rows, matches, loading, error, refresh }: { rows: PlayerRow[]; matches: Match[]; loading: boolean; error: unknown; refresh: () => unknown }) {
  const { mutate } = useSWRConfig()
  const [values, setValues] = useState<Record<string, Value>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState('')
  const [dirtyIds, setDirtyIds] = useState<Record<string, boolean>>({})
  const upcoming = matches.filter(match => match.status === 'scheduled')
  useEffect(() => {
    setValues(current => {
      const next = { ...current }
      rows.forEach(row => { if (!dirtyIds[row.id]) next[row.id] = { yellowCards: row.yellowCards, redCards: row.redCards, suspendedForMatchId: row.suspendedForMatchId ?? '', reason: '' } })
      return next
    })
  }, [rows, dirtyIds])
  function update(id: string, field: keyof Value, value: string) {
    setValues(current => ({ ...current, [id]: { ...(current[id] ?? { yellowCards: 0, redCards: 0, suspendedForMatchId: '', reason: '' }), [field]: field === 'reason' || field === 'suspendedForMatchId' ? value : num(value) } }))
    setDirtyIds(current => ({ ...current, [id]: true }))
  }
  async function save(player: PlayerRow) {
    const value = values[player.id]
    if (!value?.reason.trim() || value.reason.trim().length < 5) { setProblem('Enter a reason of at least five characters for ' + player.name + '.'); return }
    setBusy(player.id); setProblem(''); setMessage('')
    try {
      await api.playerStatistics.update(player.id, { yellowCards: value.yellowCards, redCards: value.redCards, suspendedForMatchId: value.suspendedForMatchId || '', reason: value.reason.trim() })
      setMessage('Discipline and availability updated for ' + player.name + '.')
      setDirtyIds(current => ({ ...current, [player.id]: false }))
      await refresh()
      await mutate('public-discipline')
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not save this player’s discipline record.')
    } finally {
      setBusy(null)
    }
  }
  if (loading) return <div className="empty-state">Loading registered players…</div>
  if (error) return <div className="empty-state" role="alert">Could not load discipline records. <button onClick={() => refresh()}>Retry</button></div>
  return <section className="panel admin-editor-card">
    <header className="admin-editor-heading"><div><span className="eyebrow">DISCIPLINE & PLAYER AVAILABILITY</span><h2>Record cards and match suspensions</h2><p>Set the official yellow/red card totals manually. You can also mark a player unavailable for a specific upcoming match. The match-event API will reject events for a player suspended from that fixture.</p></div></header>
    {problem && <p className="form-error" role="alert">{problem}</p>}
    {message && <p className="admin-success-message" role="status">{message}</p>}
    <div className="table-wrap"><table className="standings-table admin-edit-table"><thead><tr><th>PLAYER</th><th>TEAM</th><th>YELLOW</th><th>RED</th><th>NOT AVAILABLE FOR</th><th>REASON / AUDIT NOTE</th><th>ACTION</th></tr></thead><tbody>
      {rows.map(player => <tr key={player.id}>
        <td><div className="admin-player-identity">{player.photoUrl ? <span className="admin-player-avatar" style={{ backgroundImage: 'url(' + player.photoUrl + ')' }} /> : <span className="admin-player-avatar">{player.name.slice(0,1).toUpperCase()}</span>}<span><b>{player.name}</b><small>#{player.number}</small></span></div></td>
        <td>{player.team?.name ?? '—'}</td>
        <td><input aria-label={'Yellow cards for ' + player.name} type="number" min="0" max="99" value={values[player.id]?.yellowCards ?? player.yellowCards} onChange={e => update(player.id, 'yellowCards', e.target.value)} /></td>
        <td><input aria-label={'Red cards for ' + player.name} type="number" min="0" max="99" value={values[player.id]?.redCards ?? player.redCards} onChange={e => update(player.id, 'redCards', e.target.value)} /></td>
        <td><select aria-label={'Suspension match for ' + player.name} value={values[player.id]?.suspendedForMatchId ?? player.suspendedForMatchId ?? ''} onChange={e => update(player.id, 'suspendedForMatchId', e.target.value)}><option value="">Available / no match suspension</option>{upcoming.filter(match => match.homeId === player.teamId || match.awayId === player.teamId).map(match => <option key={match.id} value={match.id}>{match.round} · {match.date} · {match.time}</option>)}</select>{player.suspensionMatch && <small className="admin-adjusted-label">Currently suspended: {player.suspensionMatch.label}</small>}</td>
        <td><input aria-label={'Discipline reason for ' + player.name} value={values[player.id]?.reason ?? ''} placeholder="Reason required for card/suspension update" onChange={e => update(player.id, 'reason', e.target.value)} />{player.updatedBy && <small className="admin-adjusted-label">Last updated by {player.updatedBy}</small>}</td>
        <td><button className="button-primary" disabled={busy !== null} onClick={() => save(player)}><Save />{busy === player.id ? 'Saving…' : 'Save record'}</button></td>
      </tr>)}
    </tbody></table></div>
    {!rows.length && <p className="empty-state">Register players before adding discipline records.</p>}
    {!upcoming.length && <p className="empty-state">There are no scheduled fixtures to assign a match suspension to yet.</p>}
  </section>
}
