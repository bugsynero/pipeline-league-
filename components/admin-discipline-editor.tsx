'use client'
import { useEffect, useState } from 'react'
import { useSWRConfig } from 'swr'
import { Save, Undo2 } from 'lucide-react'
import { api } from '@/lib/services/api'

type PlayerRow = { id: string; name: string; number: number; photoUrl?: string; team?: { name: string }; yellow: number; red: number; yellowCards: number; redCards: number; manuallyAdjusted: boolean; adjustmentReason?: string; updatedBy?: string }
type Value = { yellow: number; red: number; reason: string }
const num = (value: string) => Math.max(0, Math.min(99, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0))

export function AdminDisciplineEditor({ rows, loading, error, refresh }: { rows: PlayerRow[]; loading: boolean; error: unknown; refresh: () => unknown }) {
  const { mutate } = useSWRConfig()
  const [values, setValues] = useState<Record<string, Value>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState('')
  useEffect(() => {
    const next: Record<string, Value> = {}
    rows.forEach(row => { next[row.id] = { yellow: row.yellowCards, red: row.redCards, reason: '' } })
    setValues(next)
  }, [rows])
  function update(id: string, field: keyof Value, value: string) {
    setValues(current => ({ ...current, [id]: { ...(current[id] ?? { yellow: 0, red: 0, reason: '' }), [field]: field === 'reason' ? value : num(value) } }))
  }
  async function save(player: PlayerRow) {
    const value = values[player.id]
    if (!value?.reason.trim() || value.reason.trim().length < 5) { setProblem('Enter a correction reason of at least five characters for '+player.name+'.'); return }
    setBusy(player.id); setProblem(''); setMessage('')
    try {
      await api.discipline.update(player.id,{yellowCards:value.yellow,redCards:value.red,reason:value.reason.trim()})
      setMessage('Discipline corrected for '+player.name+'.')
      await refresh(); await mutate('public-discipline')
    } catch (e) { setProblem(e instanceof Error ? e.message : 'Could not save the discipline correction.') }
    finally { setBusy(null) }
  }
  async function reset(player: PlayerRow) {
    if (!window.confirm('Remove the manual correction for '+player.name+' and return to match-event totals?')) return
    setBusy(player.id); setProblem(''); setMessage('')
    try {
      await api.discipline.reset(player.id)
      setMessage('Manual correction reset for '+player.name+'.')
      await refresh(); await mutate('public-discipline')
    } catch (e) { setProblem(e instanceof Error ? e.message : 'Could not reset this correction.') }
    finally { setBusy(null) }
  }
  if (loading) return <div className="empty-state">Loading player discipline records…</div>
  if (error) return <div className="empty-state" role="alert">Could not load discipline records. <button onClick={() => refresh()}>Retry</button></div>
  return <section className="panel admin-editor-card">
    <header className="admin-editor-heading"><div><span className="eyebrow">DISCIPLINE MANAGEMENT</span><h2>Yellow and red card corrections</h2><p>Totals are calculated from confirmed match events by default. A manual correction overrides those totals until it is reset. Every correction requires a reason and is audited.</p></div></header>
    {problem && <p className="form-error" role="alert">{problem}</p>}{message && <p className="admin-success-message" role="status">{message}</p>}
    <div className="table-wrap"><table className="standings-table admin-edit-table"><thead><tr><th>PLAYER</th><th>TEAM</th><th>YELLOW</th><th>RED</th><th>WHY IS THIS CHANGING?</th><th>ACTIONS</th></tr></thead><tbody>
      {rows.map(player => <tr key={player.id}>
        <td><div className="admin-player-identity">{player.photoUrl ? <span className="admin-player-avatar" style={{backgroundImage:'url('+player.photoUrl+')'}}/> : <span className="admin-player-avatar">{player.name.slice(0,1).toUpperCase()}</span>}<span><b>{player.name}</b><small>#{player.number}</small></span></div></td>
        <td>{player.team?.name ?? '—'}</td>
        <td><input aria-label={'Yellow cards for '+player.name} type="number" min="0" max="99" value={values[player.id]?.yellow ?? player.yellowCards} onChange={e=>update(player.id,'yellow',e.target.value)}/></td>
        <td><input aria-label={'Red cards for '+player.name} type="number" min="0" max="99" value={values[player.id]?.red ?? player.redCards} onChange={e=>update(player.id,'red',e.target.value)}/></td>
        <td><input aria-label={'Correction reason for '+player.name} value={values[player.id]?.reason ?? ''} placeholder={player.manuallyAdjusted?'Reason for the next correction':'Enter correction reason'} onChange={e=>update(player.id,'reason',e.target.value)}/>{player.manuallyAdjusted && <small className="admin-adjusted-label">Manual correction by {player.updatedBy ?? 'admin'}</small>}</td>
        <td><div className="admin-row-actions"><button className="button-primary" disabled={busy!==null} onClick={()=>save(player)}><Save/>{busy===player.id?'Saving…':'Save'}</button>{player.manuallyAdjusted && <button className="button-outline" disabled={busy!==null} onClick={()=>reset(player)}><Undo2/>Reset</button>}</div></td>
      </tr>)}
    </tbody></table></div>
    {!rows.length && <p className="empty-state">No players are registered yet.</p>}
  </section>
}
