'use client'
import { useEffect, useState } from 'react'
import { useSWRConfig } from 'swr'
import { Save } from 'lucide-react'
import { api } from '@/lib/services/api'

type ScorerRow = { id: string; name: string; number: number; photoUrl?: string; team?: { name: string }; goals: number; assists: number; appearances: number }
type Values = { goals: number; assists: number; appearances: number; reason: string }
const safeNumber = (value: string) => Math.max(0, Math.min(999, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0))

export function AdminScorersEditor({ rows, loading, error, refresh }: { rows: ScorerRow[]; loading: boolean; error: unknown; refresh: () => unknown }) {
  const { mutate } = useSWRConfig()
  const [values, setValues] = useState<Record<string, Values>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState('')
  useEffect(() => {
    setValues(current => {
      const next = { ...current }
      rows.forEach(row => { if (!dirty[row.id]) next[row.id] = { goals: row.goals, assists: row.assists, appearances: row.appearances, reason: '' } })
      return next
    })
  }, [rows, dirty])
  function update(id: string, field: keyof Values, value: string) {
    setValues(current => ({ ...current, [id]: { ...(current[id] ?? { goals: 0, assists: 0, appearances: 0, reason: '' }), [field]: field === 'reason' ? value : safeNumber(value) } }))
    setDirty(current => ({ ...current, [id]: true }))
  }
  function addGoal(player: ScorerRow) {
    update(player.id, 'goals', String(Math.min(999, (values[player.id]?.goals ?? player.goals) + 1)))
  }
  async function save(player: ScorerRow) {
    const value = values[player.id] ?? { goals: player.goals, assists: player.assists, appearances: player.appearances, reason: '' }
    setBusy(player.id); setProblem(''); setMessage('')
    try {
      await api.playerStatistics.update(player.id, { goals: value.goals, assists: value.assists, appearances: value.appearances, ...(value.reason.trim() ? { reason: value.reason.trim() } : {}) })
      setMessage('Scorer statistics saved for ' + player.name + '.')
      setDirty(current => ({ ...current, [player.id]: false }))
      await refresh()
      await mutate('public-scorers')
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not save this player’s scorer statistics.')
    } finally {
      setBusy(null)
    }
  }
  if (loading) return <div className="empty-state">Loading registered players…</div>
  if (error) return <div className="empty-state" role="alert">Could not load scorer records. <button onClick={() => refresh()}>Retry</button></div>
  return <section className="panel admin-editor-card">
    <header className="admin-editor-heading"><div><span className="eyebrow">GOLDEN BOOT MANAGEMENT</span><h2>Manually publish player scoring records</h2><p>Register the player first under Players, then set their official goals, assists and appearances here. These admin-saved figures alone control the public Golden Boot ranking. Use +1 goal to record a goal quickly, then save the player’s statistics.</p></div></header>
    {problem && <p className="form-error" role="alert">{problem}</p>}
    {message && <p className="admin-success-message" role="status">{message}</p>}
    <div className="table-wrap"><table className="standings-table admin-edit-table"><thead><tr><th>PLAYER</th><th>TEAM</th><th>APPEARANCES</th><th>GOALS</th><th>ASSISTS</th><th>ADMIN NOTE</th><th>ACTION</th></tr></thead><tbody>
      {rows.map(player => <tr key={player.id}>
        <td><div className="admin-player-identity">{player.photoUrl ? <span className="admin-player-avatar" style={{ backgroundImage: 'url(' + player.photoUrl + ')' }} /> : <span className="admin-player-avatar">{player.name.slice(0,1).toUpperCase()}</span>}<span><b>{player.name}</b><small>#{player.number}</small></span></div></td>
        <td>{player.team?.name ?? '—'}</td>
        <td><input aria-label={'Appearances for ' + player.name} type="number" min="0" max="999" value={values[player.id]?.appearances ?? player.appearances} onChange={e => update(player.id, 'appearances', e.target.value)} /></td>
        <td><div className="admin-stat-control"><input aria-label={'Goals for ' + player.name} type="number" min="0" max="999" value={values[player.id]?.goals ?? player.goals} onChange={e => update(player.id, 'goals', e.target.value)} /><button type="button" className="button-outline admin-quick-increment" aria-label={'Add one goal for ' + player.name} onClick={() => addGoal(player)}>+1</button></div></td>
        <td><input aria-label={'Assists for ' + player.name} type="number" min="0" max="999" value={values[player.id]?.assists ?? player.assists} onChange={e => update(player.id, 'assists', e.target.value)} /></td>
        <td><input aria-label={'Admin note for ' + player.name} value={values[player.id]?.reason ?? ''} placeholder="Optional note for audit" onChange={e => update(player.id, 'reason', e.target.value)} /></td>
        <td><button className="button-primary" disabled={busy !== null} onClick={() => save(player)}><Save />{busy === player.id ? 'Saving…' : 'Save stats'}</button></td>
      </tr>)}
    </tbody></table></div>
    {!rows.length && <p className="empty-state">Register players before adding scorer statistics.</p>}
  </section>
}
