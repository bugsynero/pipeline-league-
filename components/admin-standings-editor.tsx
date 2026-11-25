'use client'
import { useEffect, useState } from 'react'
import { useSWRConfig } from 'swr'
import { RefreshCw, Save, Send, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/services/api'

type Row = { teamId: string; team: { id: string; name: string }; position: number; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd?: number; points: number }
type Data = { calculatedRows: Row[]; draftRows: Row[]; publishedAt?: string | null; publishedBy?: string | null; draftUpdatedAt?: string | null; draftUpdatedBy?: string | null; isPublished: boolean }
const num = (value: string) => Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0)

export function AdminStandingsEditor({ data, loading, error, refresh }: { data?: Data; loading: boolean; error: unknown; refresh: () => unknown }) {
  const { mutate } = useSWRConfig()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState('')
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (data?.draftRows && !dirty) setRows(data.draftRows.map(row => ({ ...row }))) }, [data?.draftRows, dirty])
  const sorted = [...rows].sort((a,b) => a.position - b.position)
  function update(teamId: string, field: 'position'|'wins'|'draws'|'losses'|'gf'|'ga'|'points', value: number) {
    setRows(current => current.map(row => row.teamId === teamId ? { ...row, [field]: value } : row))
    setMessage('')
    setDirty(true)
  }
  const payload = sorted.map(row => ({ teamId: row.teamId, position: row.position, played: row.wins + row.draws + row.losses, wins: row.wins, draws: row.draws, losses: row.losses, gf: row.gf, ga: row.ga, points: row.points }))
  async function save(publish: boolean) {
    if (publish && !window.confirm('Submit and publish this standings table to the public website?')) return
    setBusy(true); setMessage(''); setProblem('')
    try {
      await api.standings.saveDraft(payload)
      if (publish) { await api.standings.publish(); setMessage('Standings published successfully. Viewers will see this table on the public website.') }
      else setMessage('Draft saved. The previously published table remains visible to viewers.')
      setDirty(false)
      await refresh()
      if (publish) await mutate('public-standings')
    } catch (e) { setProblem(e instanceof Error ? e.message : 'The standings update failed.') }
    finally { setBusy(false) }
  }
  if (loading) return <div className="empty-state">Loading standings…</div>
  if (error) return <div className="empty-state" role="alert">Could not load standings. <button onClick={() => refresh()}>Retry</button></div>
  if (!data || !rows.length) return <div className="empty-state">No participating teams are available.</div>
  return <div className="admin-editor-stack">
    <section className="admin-publication-status">
      <CheckCircle2/>
      <div><b>{data.isPublished ? 'Manually published standings' : 'Calculated standings currently shown'}</b><span>{data.isPublished ? 'Visitors are viewing the last submitted standings snapshot.' : 'Visitors currently see the table calculated from confirmed results.'}</span>{data.publishedAt && <small>Published {new Date(data.publishedAt).toLocaleString()} by {data.publishedBy}</small>}</div>
      <strong>{data.isPublished ? 'PUBLISHED' : 'AUTO'}</strong>
    </section>
    <section className="panel admin-editor-card">
      <header className="admin-editor-heading"><div><span className="eyebrow">MANUAL STANDINGS CONTROL</span><h2>Edit the league table</h2><p>Played is calculated from wins, draws and losses. Adjust the figures, save a draft, then submit to make them public.</p></div>
        <div className="admin-editor-actions"><button className="button-outline" disabled={busy} onClick={() => { setRows(data.calculatedRows.map(row => ({ ...row, teamId: row.team.id }))); setDirty(true) }}><RefreshCw/> Use calculated</button><button className="button-outline" disabled={busy} onClick={() => save(false)}><Save/>{busy ? 'Saving…' : 'Save draft'}</button><button className="button-publish" disabled={busy} onClick={() => save(true)}><Send/>{busy ? 'Submitting…' : 'Submit & publish'}</button></div>
      </header>
      {data.draftUpdatedAt && <p className="admin-draft-meta">Draft saved {new Date(data.draftUpdatedAt).toLocaleString()} by {data.draftUpdatedBy}</p>}
      {problem && <p className="form-error" role="alert">{problem}</p>}{message && <p className="admin-success-message" role="status">{message}</p>}
      <div className="table-wrap"><table className="standings-table admin-edit-table"><thead><tr><th>POS</th><th>TEAM</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th></tr></thead><tbody>
        {sorted.map(row => <tr key={row.teamId}><td><input aria-label={'Position for '+row.team.name} type="number" min="1" value={row.position} onChange={e => update(row.teamId,'position',Math.max(1,num(e.target.value)))}/></td><td><b>{row.team.name}</b></td><td>{row.wins+row.draws+row.losses}</td>{(['wins','draws','losses','gf','ga','points'] as const).map(field => <td key={field}><input aria-label={field+' for '+row.team.name} type="number" min="0" value={row[field]} onChange={e => update(row.teamId,field,num(e.target.value))}/></td>)}<td>{row.gf-row.ga}</td></tr>)}
      </tbody></table></div>
      <p className="admin-editor-footnote">Each submission is recorded with the administrator and publication time. Draft edits are not visible until published.</p>
    </section>
  </div>
}
