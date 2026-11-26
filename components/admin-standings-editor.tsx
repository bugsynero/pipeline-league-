'use client'
import { useEffect, useState } from 'react'
import { useSWRConfig } from 'swr'
import { RefreshCw, Save, Send, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/services/api'

type Row = { teamId: string; team: { id: string; name: string }; position: number; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd?: number; points: number }
type PointConfig = { win: number; draw: number; loss: number }
type TieBreaker = 'points' | 'goalDifference' | 'goalsFor'
type Data = { calculatedRows: Row[]; draftRows: Row[]; pointsConfig?: PointConfig; tieBreakers?: TieBreaker[]; publishedAt?: string | null; publishedBy?: string | null; draftUpdatedAt?: string | null; draftUpdatedBy?: string | null; isPublished: boolean }
const DEFAULT_POINTS: PointConfig = { win: 3, draw: 1, loss: 0 }
const DEFAULT_TIE_BREAKERS: TieBreaker[] = ['points', 'goalDifference', 'goalsFor']

function rankRows(source: Row[], pointConfig: PointConfig = DEFAULT_POINTS, tieBreakers: TieBreaker[] = DEFAULT_TIE_BREAKERS): Row[] {
  const keys: TieBreaker[] = ['points', ...tieBreakers.filter(key => key !== 'points' && ['goalDifference', 'goalsFor'].includes(key))]
  const ranked = source.map(row => ({
    ...row,
    played: row.wins + row.draws + row.losses,
    points: row.wins * pointConfig.win + row.draws * pointConfig.draw + row.losses * pointConfig.loss,
    gd: row.gf - row.ga,
  }))
  ranked.sort((a, b) => {
    for (const key of keys) {
      const left = key === 'points' ? a.points : key === 'goalDifference' ? a.gd : a.gf
      const right = key === 'points' ? b.points : key === 'goalDifference' ? b.gd : b.gf
      if (left !== right) return right - left
    }
    return a.team.name.localeCompare(b.team.name)
  })
  return ranked.map((row, index) => ({ ...row, position: index + 1 }))
}

export function AdminStandingsEditor({ data, loading, error, refresh }: { data?: Data; loading: boolean; error: unknown; refresh: () => unknown }) {
  const { mutate } = useSWRConfig()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState('')
  const [dirty, setDirty] = useState(false)
  const pointsConfig = data?.pointsConfig ?? DEFAULT_POINTS
  const tieBreakers = data?.tieBreakers ?? DEFAULT_TIE_BREAKERS

  useEffect(() => {
    if (data?.draftRows && !dirty) setRows(rankRows(data.draftRows, pointsConfig, tieBreakers))
  }, [data?.draftRows, data?.pointsConfig, data?.tieBreakers, dirty])

  const sorted = rankRows(rows, pointsConfig, tieBreakers)

  function update(teamId: string, field: 'wins' | 'draws' | 'losses' | 'gf' | 'ga', value: number) {
    setRows(current => rankRows(
      current.map(row => row.teamId === teamId ? { ...row, [field]: value } : row),
      pointsConfig,
      tieBreakers,
    ))
    setMessage('')
    setDirty(true)
  }

  const payload = sorted.map(row => ({
    teamId: row.teamId,
    position: row.position,
    played: row.wins + row.draws + row.losses,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    gf: row.gf,
    ga: row.ga,
    points: row.points,
  }))

  async function save(publish: boolean) {
    if (publish && !window.confirm('Submit and publish this standings table to the public website?')) return
    setBusy(true); setMessage(''); setProblem('')
    try {
      await api.standings.saveDraft(payload)
      if (publish) { await api.standings.publish(); setMessage('Standings published successfully. Viewers will see the correctly ranked table on the public website.') }
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
      <header className="admin-editor-heading"><div><span className="eyebrow">MANUAL STANDINGS CONTROL</span><h2>Edit the league table</h2><p>Update each team’s wins, draws, losses and goals. Played, points and positions are calculated automatically using the tournament scoring rules and league tie-breakers.</p></div>
        <div className="admin-editor-actions"><button className="button-outline" disabled={busy} onClick={() => { setRows(rankRows(data.calculatedRows.map(row => ({ ...row, teamId: row.team.id })), pointsConfig, tieBreakers)); setDirty(true); setMessage('') }}><RefreshCw/> Use calculated</button><button className="button-outline" disabled={busy} onClick={() => save(false)}><Save/>{busy ? 'Saving…' : 'Save draft'}</button><button className="button-publish" disabled={busy} onClick={() => save(true)}><Send/>{busy ? 'Submitting…' : 'Submit & publish'}</button></div>
      </header>
      {data.draftUpdatedAt && <p className="admin-draft-meta">Draft saved {new Date(data.draftUpdatedAt).toLocaleString()} by {data.draftUpdatedBy}</p>}
      {problem && <p className="form-error" role="alert">{problem}</p>}{message && <p className="admin-success-message" role="status">{message}</p>}
      <div className="table-wrap"><table className="standings-table admin-edit-table"><thead><tr><th>POS</th><th>TEAM</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th></tr></thead><tbody>
        {sorted.map(row => <tr key={row.teamId}><td><strong className="admin-auto-position">{row.position}</strong></td><td><b>{row.team.name}</b></td><td>{row.played}</td>{(['wins','draws','losses','gf','ga'] as const).map(field => <td key={field}><input aria-label={field+' for '+row.team.name} type="number" min="0" value={row[field]} onChange={e => update(row.teamId,field,Math.max(0,Number.isFinite(Number(e.target.value)) ? Math.floor(Number(e.target.value)) : 0))}/></td>)}<td>{row.gd}</td><td><b>{row.points}</b></td></tr>)}
      </tbody></table></div>
      <p className="admin-editor-footnote">Positions update automatically as you edit the statistics. Points are calculated from wins, draws and losses. The public table changes only after you submit and publish.</p>
    </section>
  </div>
}
