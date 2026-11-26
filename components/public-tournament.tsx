'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Flag, Trophy } from 'lucide-react'
import { api } from '@/lib/services/api'
import { MatchPreview } from '@/components/match-preview'
import { tournamentSettings } from '@/lib/tournament-settings'
import type { Announcement, DisciplineRecord, LeagueStanding, Match, PlayerPerformance, Team, TopScorer, TournamentSettings } from '@/lib/types'

const footerLinks = [
  ['Home', '/'], ['About the Tournament', '/about'], ['Participating Teams', '/teams'], ['League Standings', '/standings'], ['Fixtures', '/fixtures'], ['Match Results', '/results'], ['Match History', '/history'], ['Goal & Assist Leaders', '/top-scorers'], ['Yellow and Red Cards', '/discipline'], ['Tournament Rules', '/rules'], ['News and Announcements', '/news'], ['Contact Information', '/contact'], ['Privacy Policy', '/privacy'], ['Terms and Conditions', '/terms'], ['Admin Login', '/admin/login'],
]
const navLinks = [['Home', '/'], ['Teams', '/teams'], ['Standings', '/standings'], ['Fixtures', '/fixtures'], ['Results', '/results'], ['Match History', '/history'], ['Scorers & Assists', '/top-scorers'], ['Discipline', '/discipline'], ['News', '/news'], ['About', '/about'], ['Contact', '/contact']]
function usePublicData() {
  const [updatedAt, setUpdatedAt] = useState<Record<string, number>>({})
  const refreshed = (key: string) => ({ refreshInterval: key === 'matches' ? 5000 : 10000, revalidateOnFocus: true, onSuccess: () => setUpdatedAt(current => ({ ...current, [key]: Date.now() })) })
  const teams = useSWR<Team[]>('public-teams', api.teams.list, refreshed('teams'))
  const standings = useSWR<LeagueStanding[]>('public-standings', api.standings.list, refreshed('standings'))
  const matches = useSWR<Match[]>('public-matches', api.matches.list, refreshed('matches'))
  const scorers = useSWR<TopScorer[]>('public-scorers', api.scorers.list, refreshed('scorers'))
  const assists = useSWR<TopScorer[]>('public-assists', api.assists.list, refreshed('assists'))
  const playerStats = useSWR<PlayerPerformance[]>('public-player-performance', api.playerStatistics.publicList, refreshed('player-performance'))
  const discipline = useSWR<DisciplineRecord[]>('public-discipline', api.discipline.list, refreshed('discipline'))
  const announcements = useSWR<Announcement[]>('public-announcements', api.announcements.list, refreshed('announcements'))
  const settings = useSWR<TournamentSettings>('public-settings', api.settings.get, refreshed('settings'))
  return { teams, standings, matches, scorers, assists, playerStats, discipline, announcements, settings, updatedAt }
}

function Header() {
  const pathname = usePathname() ?? '/'
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => { if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false) }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.body.style.overflow = 'hidden'
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.body.style.overflow = ''; document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [open])
  return <header className="public-header" ref={menuRef}><Link href="/" className="brand-lockup" onClick={() => setOpen(false)}><span className="brand-mark"><Trophy/></span><span><b>PIPELINE</b><small>FOOTBALL TOURNAMENT 2026</small></span></Link><nav className={`public-nav${open ? ' is-open' : ''}`} id="public-navigation" aria-label="Main navigation">{navLinks.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)) ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</Link>)}</nav><Link href="/about" className="header-cta">Tournament info <ArrowRight/></Link><button className="mobile-menu-toggle" type="button" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} aria-controls="public-navigation" onClick={() => setOpen(value => !value)}><span/><span/><span/></button></header>
}
function Footer() {
  const { data: settings } = useSWR<TournamentSettings>('public-settings', api.settings.get, { refreshInterval: 10000, revalidateOnFocus: true })
  const phone = settings?.organizerPhone || tournamentSettings.organizerPhone
  const digits = phone.replace(/\D/g, '')
  const internationalPhone = digits.startsWith('0') ? '234' + digits.slice(1) : digits
  const [activePartnerSlide, setActivePartnerSlide] = useState(0)
  const totalPartnerSlides = 3
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      setActivePartnerSlide(current => (current + 1) % totalPartnerSlides)
    }, 6500)
    return () => window.clearInterval(timer)
  }, [])
  const showPartnerSlide = (direction: number) => {
    setActivePartnerSlide(current => (current + direction + totalPartnerSlides) % totalPartnerSlides)
  }
  const enquiry = 'https://wa.me/' + internationalPhone + '?text=' + encodeURIComponent('Hello, I would like to enquire about advertising or sponsorship opportunities for the Pipeline Annual Football Tournament.')
  return <footer className="public-footer">
    <section className="footer-partners" aria-labelledby="footer-partners-title">
      <div className="footer-partners-heading">
        <div><span className="eyebrow">OUR PARTNERS & SPONSORS</span><h2 id="footer-partners-title">Proudly supported by our sponsors & partners</h2><p>Celebrating the brands that help bring the beautiful game to life</p></div>
        <div className="partner-carousel-controls"><button type="button" aria-label="Previous sponsor" onClick={() => showPartnerSlide(-1)}><ChevronLeft/></button><button type="button" aria-label="Next sponsor" onClick={() => showPartnerSlide(1)}><ChevronRight/></button></div>
      </div>
      <div className="partner-carousel" aria-roledescription="carousel" aria-label="Sponsors and advertising opportunities">
        <div className="partner-slide" key={activePartnerSlide} aria-live="off">
          {activePartnerSlide === 0 ? <div className="partner-feature-logo"><a href="https://ifybugsydtech.com" target="_blank" rel="noreferrer" aria-label="Visit Ifybugsy Digital Technologies website"><Image src="/ifybugsy-logo.png" alt="Ifybugsy Digital Technologies" width={375} height={102}/></a></div> :
          <div className={'partner-ad-art partner-ad-art-' + activePartnerSlide}><span className="partner-ad-orbit"/><span className="partner-ad-number">0{activePartnerSlide}</span><span className="partner-ad-label">ADVERTISING SPACE</span></div>}
          <div className="partner-slide-copy">
            <span className="partner-slide-kicker">{activePartnerSlide === 0 ? 'OFFICIAL DIGITAL PARTNER' : 'FEATURED AD SPACE 0' + activePartnerSlide}</span>
            <h3>{activePartnerSlide === 0 ? 'Website designed & developed by Ifybugsy Digital Technologies Limited' : activePartnerSlide === 1 ? 'Put your business in the spotlight' : 'Reach football fans. Grow your brand.'}</h3>
            <p>{activePartnerSlide === 0 ? 'Technology, creativity and digital solutions powering the tournament experience.' : 'Promote your products or services to the Pipeline football community. Reserve this advertising space for your brand.'}</p>
            {activePartnerSlide === 0 ? <a className="partner-cta" href="https://ifybugsydtech.com" target="_blank" rel="noreferrer">Visit company website <ArrowRight/></a> : <a className="partner-cta" href={enquiry} target="_blank" rel="noreferrer">Enquire about this ad space <ArrowRight/></a>}
          </div>
        </div>
      </div>
      <div className="partner-carousel-dots" role="group" aria-label="Choose sponsor slide">{[0,1,2].map(index => <button key={index} type="button" aria-label={'Show sponsor slide ' + (index + 1)} aria-pressed={activePartnerSlide === index} onClick={() => setActivePartnerSlide(index)}/>)}</div>
    </section>
    <div className="footer-main">
      <div className="footer-brand"><span className="brand-mark"><Trophy/></span><div><b>PIPELINE ANNUAL FOOTBALL TOURNAMENT</b><span>Rukpokwu, Port Harcourt, Rivers State, Nigeria</span><span>Organizer: <a href={'tel:' + phone}>{phone}</a></span><span><a href={'https://wa.me/' + internationalPhone} target="_blank" rel="noreferrer">Contact on WhatsApp</a></span></div></div>
      <nav className="footer-links" aria-label="Footer navigation">{footerLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav>
    </div>
    <div className="footer-bottom">
      <div className="footer-company-credit"><a href="https://ifybugsydtech.com" target="_blank" rel="noreferrer"><Image src="/ifybugsy-logo.png" alt="Ifybugsy Digital Technologies Limited logo" width={375} height={102}/><span><small>Website designed & developed by</small><b>Ifybugsy Digital Technologies Limited</b><small className="footer-company-link">Visit ifybugsydtech.com <ArrowRight/></small></span></a></div>
      <div className="footer-social-wrap"><span className="eyebrow">FOLLOW THE TOURNAMENT</span><div className="footer-social" aria-label="Social media channels"><span title="Facebook page link coming soon" aria-label="Facebook"><b aria-hidden="true">f</b></span><span title="Instagram page link coming soon" aria-label="Instagram"><b aria-hidden="true">◎</b></span><span title="YouTube channel link coming soon" aria-label="YouTube"><b aria-hidden="true">▶</b></span></div><small>Official social links will be added when the pages are confirmed.</small></div>
      <span className="copyright">© 2026 Pipeline Annual Football Tournament. All rights reserved.</span>
    </div>
  </footer>
}
function Shell({ children }: { children: React.ReactNode }) { return <><Header/><main>{children}</main><Footer/></> }
function Empty({ children }: { children: React.ReactNode }) { return <div className="empty-state" role="status">{children}</div> }
function LiveUpdated({ at }: { at?: number }) { return <small className="muted">{at ? `Last updated ${new Date(at).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}` : 'Awaiting published data'}</small> }
function DataState({ loading, error, empty, children }: { loading: boolean; error: unknown; empty: boolean; children: React.ReactNode }) {
  if (loading) return <Empty>Loading published tournament information…</Empty>
  if (error) return <Empty>Information could not be loaded. Please try again later.</Empty>
  if (empty) return <Empty>Information has not been published yet.</Empty>
  return <>{children}</>
}
function Intro({ title, description }: { title: string; description: string }) { return <div className="page-intro"><div><div className="eyebrow">RUKPOKWU · PORT HARCOURT · NIGERIA</div><h1>{title}</h1><p>{description}</p></div></div> }
function TeamList({ list }: { list: Team[] }) { const active = list.filter(team => team.active); return <DataState loading={false} error={undefined} empty={!active.length}><div className="team-grid public-team-grid">{active.map((team, index) => <article className="public-team-card" key={team.id}><div className="team-card-top">{team.logoUrl ? <span className="crest crest-lg" role="img" aria-label={team.name} style={{ backgroundImage: 'url(' + team.logoUrl + ')', backgroundSize: 'cover', backgroundPosition: 'center' }} /> : <span className="crest crest-lg">{team.initials}</span>}<span className="team-position">#{String(index + 1).padStart(2, '0')}</span></div><h3>{team.name}</h3></article>)}</div></DataState> }
function MatchList({ list, teams }: { list: Match[]; teams: Team[] }) {
  const lookup = new Map(teams.map(team => [team.id, team]))
  const ordered = [...list].sort((a,b) => (a.status === 'live' ? -1 : 0) - (b.status === 'live' ? -1 : 0) || Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  return <DataState loading={false} error={undefined} empty={!ordered.length}>
    <div className="match-grid">{ordered.map(match => {
      const home = lookup.get(match.homeId)
      const away = lookup.get(match.awayId)
      const homeWon = match.status === 'completed' && match.homeScore != null && match.awayScore != null && match.homeScore > match.awayScore
      const awayWon = match.status === 'completed' && match.homeScore != null && match.awayScore != null && match.awayScore > match.homeScore
      return <article className={'match-card' + (match.featured ? ' is-featured-match' : '')} key={match.id}>
        {match.highlightImageUrl && <div className="match-card-image" role="img" aria-label={match.resultHeadline || 'Match highlights'} style={{ backgroundImage: 'url(' + match.highlightImageUrl + ')' }}/>}
        <div className="match-card-top"><span>{match.round}</span><span className={'badge' + (match.status === 'live' ? ' live-match-badge' : '')}>{match.status === 'completed' ? 'Confirmed result' : match.status === 'live' ? 'PLAYING NOW' : match.status}</span></div>
        <div className="match-cup-mark"><Trophy/><span>{match.featured ? 'FEATURED MATCH' : 'PIPELINE CUP'}</span></div>
        <div className="match-teams">
          <div className={'match-side' + (homeWon ? ' match-winner' : '')}><span>{home?.name ?? 'Team not published'}</span>{homeWon && <small>WINNER</small>}</div>
          <strong className="match-score">{(match.status === 'completed' || match.status === 'live') && match.homeScore != null && match.awayScore != null ? String(match.homeScore) + ' : ' + String(match.awayScore) : 'VS'}</strong>
          <div className={'match-side away' + (awayWon ? ' match-winner' : '')}><span>{away?.name ?? 'Team not published'}</span>{awayWon && <small>WINNER</small>}</div>
        </div>
        <div className="match-meta"><span><Clock3/> {match.time}</span><span><Flag/> {match.venue}</span>{match.status === 'live' && <strong className="match-live-minute">LIVE · {match.matchMinute ?? 0}'</strong>}</div>
        {match.resultHeadline && <h3 className="match-result-headline">{match.resultHeadline}</h3>}
        {match.resultSummary && <p className="match-result-summary">{match.resultSummary}</p>}
        <Link className="match-details-link" href={'/matches/' + match.id}>{match.status === 'completed' ? 'Match centre' : match.status === 'live' ? 'Follow live match' : 'View match preview'} <ArrowRight/></Link>
      </article>
    })}</div>
  </DataState>
}
function MatchHistory({ list, teams }: { list: Match[]; teams: Team[] }) {
  const [year, setYear] = useState('all')
  const [month, setMonth] = useState('all')
  const [day, setDay] = useState('')
  const years = [...new Set(list.map(match => match.date.slice(0, 4)))].filter(Boolean).sort().reverse()
  const months = [...new Set(list.filter(match => year === 'all' || match.date.startsWith(year)).map(match => match.date.slice(5, 7)))].filter(Boolean).sort()
  const filtered = list.filter(match => (year === 'all' || match.date.startsWith(year)) && (month === 'all' || match.date.slice(5, 7) === month) && (!day || match.date === day)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  const groups = new Map<string, Match[]>()
  for (const match of filtered) groups.set(match.date, [...(groups.get(match.date) ?? []), match])
  return <div className="match-history">
    <section className="panel match-history-filters">
      <label>Year<select value={year} onChange={event => { setYear(event.target.value); setMonth('all'); setDay('') }}><option value="all">All years</option>{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label>Month<select value={month} onChange={event => setMonth(event.target.value)}><option value="all">All months</option>{months.map(value => <option key={value} value={value}>{new Date('2020-' + value + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long' })}</option>)}</select></label>
      <label>Exact day<input type="date" value={day} onChange={event => setDay(event.target.value)} /></label>
      <button type="button" className="button-outline" onClick={() => { setYear('all'); setMonth('all'); setDay('') }}>Clear filters</button>
    </section>
    <div className="match-history-summary"><span>{filtered.length} confirmed matches</span><small>Latest results first · grouped by match date</small></div>
    {!filtered.length ? <Empty>No confirmed matches were found for this date range.</Empty> : [...groups.entries()].map(([date, group]) => {
      const parsed = new Date(date + 'T00:00:00')
      const label = Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      return <section className="match-history-day" key={date}><div className="match-history-day-heading"><h2>{label}</h2><span>{group.length} {group.length === 1 ? 'match' : 'matches'}</span></div><MatchList list={group} teams={teams}/></section>
    })}
  </div>
}
function Standings({ list }: { list: LeagueStanding[] }) {
  const manual = list[0]?.source === 'manual'
  return <DataState loading={false} error={undefined} empty={!list.length}>
    <div className="standings-source-banner"><span>{manual ? 'OFFICIAL MANUAL PUBLICATION' : 'CALCULATED FROM CONFIRMED RESULTS'}</span>{manual && list[0]?.publishedAt && <small>Published {new Date(list[0].publishedAt).toLocaleString()}</small>}{manual && <small>Submitted standings snapshot</small>}</div>
    <div className="panel"><div className="table-wrap"><table className="standings-table"><thead><tr><th>POS</th><th>TEAM</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th></tr></thead><tbody>{list.map(row => <tr key={row.team.id}><td>{row.position}</td><td>{row.team.name}</td><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.gf}</td><td>{row.ga}</td><td>{row.gd}</td><td><b>{row.points}</b></td></tr>)}</tbody></table></div></div>
  </DataState>
}
function Scorers({ list, assists }: { list: TopScorer[]; assists: TopScorer[] }) {
  const [mode, setMode] = useState<'goals' | 'assists'>('goals')
  const rows = mode === 'goals' ? list : assists
  return <section className="panel scorer-leaderboard">
    <div className="scorer-leaderboard-switch" role="group" aria-label="Choose leaderboard">
      <button type="button" className={mode === 'goals' ? 'active' : ''} aria-pressed={mode === 'goals'} onClick={() => setMode('goals')}><Trophy/> Golden Boot</button>
      <button type="button" className={mode === 'assists' ? 'active' : ''} aria-pressed={mode === 'assists'} onClick={() => setMode('assists')}><Flag/> Assist Leaders</button>
    </div>
    <div className="scorer-leaderboard-heading"><span className="eyebrow">{mode === 'goals' ? 'OFFICIAL GOAL RANKING' : 'OFFICIAL ASSIST RANKING'}</span><h2>{mode === 'goals' ? 'Golden Boot race' : 'Playmakers of the tournament'}</h2><p>Statistics manually published by tournament administrators</p></div>
    {rows.length ? <div className="table-wrap"><table className="standings-table"><thead><tr><th>RANK</th><th>PLAYER</th><th>TEAM</th><th>APPS</th><th>{mode === 'goals' ? 'GOALS' : 'ASSISTS'}</th><th>{mode === 'goals' ? 'ASSISTS' : 'GOALS'}</th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.id}><td><strong className="scorer-rank">{String(i + 1).padStart(2, '0')}</strong></td><td><div className="scorer-identity">{row.photoUrl ? <span className="scorer-avatar" style={{backgroundImage:'url('+row.photoUrl+')'}}/> : <span className="scorer-avatar">{row.name.slice(0,1).toUpperCase()}</span>}<b>{row.name}</b></div></td><td>{row.team.name}</td><td>{row.appearances ?? '—'}</td><td><b>{mode === 'goals' ? row.goals : row.assists}</b></td><td>{mode === 'goals' ? row.assists : row.goals}</td></tr>)}</tbody></table></div> : <div className="match-centre-no-stats">{mode === 'goals' ? 'No goal scorer records have been published yet.' : 'No assist records have been published yet.'}</div>}
  </section>
}
function Announcements({ list }: { list: Announcement[] }) {
  const published = [...list].filter(item => item.published).sort((a,b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || String(b.date).localeCompare(String(a.date)))
  return <DataState loading={false} error={undefined} empty={!published.length}><div className="news-grid">{published.map(item => <article className={'panel news-copy' + (item.featured ? ' is-featured-news' : '')} key={item.id}>
    {item.imageUrl && <div className="news-card-image" role="img" aria-label={item.imageAlt || item.title} style={{backgroundImage:'url('+item.imageUrl+')'}}/>}
    <span className="eyebrow">{(item.category || 'general').replaceAll('_',' ')} · {item.date ? new Date(item.date).toLocaleDateString() : ''}</span>
    <h2>{item.title}</h2><p>{item.body}</p>{item.featured && <span className="news-featured-label"><Trophy/> Featured story</span>}
  </article>)}</div></DataState>
}
function NewsSpotlight({ list }: { list: Announcement[] }) {
  const stories = [...list].filter(item => item.published && (item.featured || item.imageUrl)).sort((a,b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || String(b.date).localeCompare(String(a.date)))
  const [active,setActive] = useState(0)
  useEffect(() => {
    if (stories.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActive(current => (current + 1) % stories.length), 6500)
    return () => window.clearInterval(timer)
  }, [stories.length])
  if (!stories.length) return null
  const story = stories[active % stories.length]
  const move = (delta:number) => setActive(current => (current + delta + stories.length) % stories.length)
  return <section className="news-spotlight" aria-roledescription="carousel" aria-label="Featured tournament news">
    <div className="news-spotlight-heading"><div><span className="eyebrow">LATEST FOOTBALL NEWS</span><h2>Matchday stories & highlights</h2></div><div className="news-slider-controls"><button type="button" aria-label="Previous story" onClick={()=>move(-1)}><ChevronLeft/></button><button type="button" aria-label="Next story" onClick={()=>move(1)}><ChevronRight/></button></div></div>
    <article className="news-spotlight-slide" key={story.id}>
      <div className="news-spotlight-image" role="img" aria-label={story.imageAlt || story.title} style={story.imageUrl ? {backgroundImage:'url('+story.imageUrl+')'} : undefined}><span className="news-spotlight-image-tag"><Trophy/> PIPELINE SPORTS NEWS</span></div>
      <div className="news-spotlight-copy"><span className="eyebrow">{(story.category || 'general').replaceAll('_',' ')} · {story.date ? new Date(story.date).toLocaleDateString() : ''}</span><h3>{story.title}</h3><p>{story.body}</p><Link href="/news" className="button-primary">Read all tournament news <ArrowRight/></Link></div>
    </article>
    <div className="news-slider-dots">{stories.map((item,index)=><button key={item.id} type="button" aria-label={'Show story '+(index+1)} aria-pressed={active===index} onClick={()=>setActive(index)}/>)}</div>
  </section>
}

const heroSlides = [
  {
    name: 'Stadium under the lights',
    image: 'https://images.unsplash.com/photo-1781152791898-945ca008c8ef?auto=format&fit=crop&w=2400&q=85',
  },
  {
    name: 'Football crowd and match atmosphere',
    image: 'https://images.unsplash.com/photo-1780766382589-5e517d4f0b81?auto=format&fit=crop&w=2400&q=85',
  },
  {
    name: 'Packed stadium on match night',
    image: 'https://images.unsplash.com/photo-1767916732786-a83902ffc25c?auto=format&fit=crop&w=2400&q=85',
  },
]

function HeroSlideshow() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      setActiveSlide(current => (current + 1) % heroSlides.length)
    }, 7200)
    return () => window.clearInterval(timer)
  }, [paused])

  const move = (direction: number) => {
    setActiveSlide(current => (current + direction + heroSlides.length) % heroSlides.length)
  }

  return <div
    className="hero-slideshow"
    role="group"
    aria-label="Football stadium slideshow"
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
  >
    <div className="hero-slide-images" aria-hidden="true">
      {heroSlides.map((slide, index) => <div
        key={slide.name}
        className={'hero-slide' + (activeSlide === index ? ' is-active' : '')}
        style={{ backgroundImage: 'url("' + slide.image + '")' }}
      />)}
    </div>
    <div className="hero-slider-controls">
      <span className="hero-slide-counter" aria-live="off">
        <strong>{String(activeSlide + 1).padStart(2, '0')}</strong>
        <span>/</span>
        {String(heroSlides.length).padStart(2, '0')}
      </span>
      <div className="hero-slide-dots">
        {heroSlides.map((slide, index) => <button
          type="button"
          key={slide.name}
          aria-label={'Show slide ' + (index + 1) + ': ' + slide.name}
          aria-pressed={activeSlide === index}
          className={activeSlide === index ? 'is-active' : ''}
          onClick={() => setActiveSlide(index)}
        />)}
      </div>
      <button type="button" className="hero-slider-arrow" aria-label="Previous football slide" onClick={() => move(-1)}><ChevronLeft/></button>
      <button type="button" className="hero-slider-arrow" aria-label="Next football slide" onClick={() => move(1)}><ChevronRight/></button>
    </div>
  </div>
}

function Landing() {
  const data = usePublicData()
  const teams = data.teams.data ?? []
  const matches = data.matches.data ?? []
  const active = teams.filter(team => team.active)
  const fixtures = matches.filter(match => match.status === 'scheduled' || match.status === 'live')
  const results = matches.filter(match => match.status === 'completed' && match.homeScore != null && match.awayScore != null)
  const announcements = (data.announcements.data ?? []).filter(item => item.published)
  const featuredResults = [...results].sort((a,b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.date.localeCompare(a.date)).slice(0, 3)
  return <Shell><section className="hero"><HeroSlideshow/><div className="hero-content"><div className="hero-kicker"><span className="live-dot"/> OFFICIAL TOURNAMENT INFORMATION</div><h1>Football brings<br/><em>us together.</em></h1><p>{data.settings.error ? 'Tournament information is unavailable right now.' : data.settings.data?.tournament.name ?? 'Tournament name not published'}</p><div className="hero-info"><span><Flag/>RUKPOKWU, PORT HARCOURT</span><span><CalendarDays/>RIVERS STATE, NIGERIA</span></div><div className="hero-actions"><Link href="/fixtures" className="button-primary">Explore fixtures <ArrowRight/></Link><Link href="/standings" className="button-ghost">View standings</Link></div></div><div className="hero-aside"><div className="tournament-badge"><div className="badge-line">ANNUAL TOURNAMENT</div><Trophy/><strong>2026</strong><span>RUKPOKWU, NIGERIA</span></div></div></section><section className="content-section"><div className="section-title"><div><div className="eyebrow">OFFICIAL UPDATES</div><h2>Tournament at a glance</h2></div><LiveUpdated at={data.updatedAt.teams}/></div><div className="quick-stats"><div><span>ACTIVE TEAMS</span><strong>{data.teams.error ? 'Unavailable' : data.teams.isLoading ? '—' : active.length || '—'}</strong><small>{data.teams.error ? 'Connection error' : active.length ? 'Currently participating' : 'No teams published'}</small></div><div><span>CONFIRMED RESULTS</span><strong>{data.matches.error ? 'Unavailable' : data.matches.isLoading ? '—' : results.length || '—'}</strong><small>{data.matches.error ? 'Connection error' : results.length ? 'Official results' : 'No confirmed results'}</small></div><div><span>UPCOMING FIXTURES</span><strong>{data.matches.error ? 'Unavailable' : data.matches.isLoading ? '—' : fixtures.length || '—'}</strong><small>{data.matches.error ? 'Connection error' : fixtures.length ? 'Published schedule' : 'No upcoming fixtures'}</small></div><div><span>ANNOUNCEMENTS</span><strong>{data.announcements.error ? 'Unavailable' : data.announcements.isLoading ? '—' : announcements.length || '—'}</strong><small>{data.announcements.error ? 'Connection error' : announcements.length ? 'Published updates' : 'No announcements published'}</small></div></div><NewsSpotlight list={announcements}/>{featuredResults.length>0 && <section className="content-section featured-match-section"><div className="section-title"><div><div className="eyebrow">LATEST MATCH RESULTS</div><h2>Matchday highlights</h2></div><div className="match-history-home-links"><Link href="/results">All results <ArrowRight/></Link><Link href="/history">Match history <ArrowRight/></Link></div></div><MatchList list={featuredResults} teams={teams}/></section>}<div className="home-grid"><section className="panel"><div className="section-title"><div><div className="eyebrow">THE TABLE</div><h2>League standings</h2></div><Link href="/standings">Full table <ArrowRight/></Link></div><DataState loading={data.standings.isLoading} error={data.standings.error} empty={!data.standings.isLoading && !(data.standings.data ?? []).length}><Standings list={(data.standings.data ?? []).slice(0, 5)}/></DataState></section><section className="panel"><div className="section-title"><div><div className="eyebrow">NEXT UP</div><h2>Fixtures & live matches</h2></div><Link href="/fixtures">All fixtures <ArrowRight/></Link></div><DataState loading={data.matches.isLoading} error={data.matches.error} empty={!data.matches.isLoading && !fixtures.length}><MatchList list={fixtures.slice(0, 3)} teams={teams}/></DataState></section></div><div className="home-grid"><section className="panel"><div className="section-title"><div><div className="eyebrow">GOLDEN BOOT</div><h2>Top goal scorers</h2></div><Link href="/top-scorers">All scorers <ArrowRight/></Link></div><div className="home-leader-mini-grid"><div><div className="home-leader-subtitle"><span>GOLDEN BOOT</span><small>Goal leaders</small></div><DataState loading={data.scorers.isLoading} error={data.scorers.error} empty={!data.scorers.isLoading && !(data.scorers.data ?? []).some(player => player.goals > 0)}>{(data.scorers.data ?? []).filter(player => player.goals > 0).slice(0, 3).map(player => <p className="scorer-row" key={player.id}>{player.photoUrl ? <span className="scorer-avatar" style={{backgroundImage:'url('+player.photoUrl+')'}}/> : <span className="scorer-avatar">{player.name.slice(0,1).toUpperCase()}</span>}<b>{player.name}</b><span>{player.goals} goals</span></p>)}</DataState></div><div><div className="home-leader-subtitle"><span>PLAYMAKERS</span><small>Assist leaders</small></div><DataState loading={data.assists.isLoading} error={data.assists.error} empty={!data.assists.isLoading && !(data.assists.data ?? []).length}>{(data.assists.data ?? []).slice(0, 3).map(player => <p className="scorer-row" key={player.id}>{player.photoUrl ? <span className="scorer-avatar" style={{backgroundImage:'url('+player.photoUrl+')'}}/> : <span className="scorer-avatar">{player.name.slice(0,1).toUpperCase()}</span>}<b>{player.name}</b><span>{player.assists} assists</span></p>)}</DataState></div></div></section><section className="panel"><div className="section-title"><div><div className="eyebrow">LATEST</div><h2>News and announcements</h2></div><Link href="/news">All news <ArrowRight/></Link></div><DataState loading={data.announcements.isLoading} error={data.announcements.error} empty={!data.announcements.isLoading && !announcements.length}><Announcements list={announcements.slice(0, 2)}/></DataState></section></div></section></Shell>
}

export function PublicHome() { return <Landing/> }
export function PublicPage({ section, itemId }: { section: string; itemId?: string }) {
  const data = usePublicData()
  const teams = data.teams.data ?? []
  const matches = data.matches.data ?? []
  const titles: Record<string, string> = { teams: 'Participating Teams', standings: 'League Standings', fixtures: 'Fixtures', results: 'Match Results', history: 'Match History', 'top-scorers': 'Goal & Assist Leaders', discipline: 'Yellow and Red Cards', news: 'News and Announcements', about: 'About the Tournament', rules: 'Tournament Rules', contact: 'Contact Information', privacy: 'Privacy Policy', terms: 'Terms and Conditions', matches: 'Match Results', 'match-detail': 'Match Details' }
  const descriptions: Record<string, string> = { teams: 'Only teams marked active in the tournament records are listed.', standings: 'Official standings are supplied by tournament records; confirmed results only.', fixtures: 'Upcoming fixtures and matches currently being played live.', results: 'Only confirmed match results are displayed.', history: 'Browse every confirmed match by day, month and year.', 'top-scorers': 'Official goal and assist totals manually entered and published by tournament administrators.', discipline: 'Official card totals and match suspensions entered by tournament administrators.', news: 'Official announcements published by tournament administrators.', about: 'The annual football tournament in Rukpokwu, Port Harcourt, Rivers State, Nigeria.', rules: 'Tournament rules and competition procedures.', contact: 'Contact the official tournament organizers by phone or WhatsApp.', privacy: 'Privacy information for participants and visitors.', terms: 'Terms for using this tournament information service.', 'match-detail': 'Official match information, including confirmed results when published.' }
  const title = titles[section] ?? 'Tournament information'
  const contactPhone = data.settings.data?.organizerPhone || tournamentSettings.organizerPhone
  const contactDigits = contactPhone.replace(/\D/g, '')
  const contactInternationalPhone = contactDigits.startsWith('0') ? '234' + contactDigits.slice(1) : contactDigits
  const teamDetail = itemId ? teams.find(team => team.id === itemId && team.active) : undefined
  const matchDetail = itemId ? matches.find(match => match.id === itemId) : undefined
  const sectionContent = section === 'teams' && itemId ? teamDetail ? <><section className="panel info-panel"><span className="crest crest-lg">{teamDetail.initials}</span><div><div className="eyebrow">ACTIVE PARTICIPANT</div><h2>{teamDetail.name}</h2><p>{teamDetail.played} played · {teamDetail.wins} wins · {teamDetail.draws} draws · {teamDetail.losses} losses</p><p>{teamDetail.gf} goals for · {teamDetail.ga} goals against · {teamDetail.points} points</p></div></section><Link className="text-link" href="/teams">← Back to teams</Link></> : <DataState loading={data.teams.isLoading} error={data.teams.error} empty={false}><Empty>This team is not published as an active participant.</Empty></DataState>
    : section === 'match-detail' ? matchDetail ? <><MatchPreview match={matchDetail} teams={teams} standings={data.standings.data ?? []} matches={matches} players={data.playerStats.data ?? []} points={data.settings.data?.points}/><Link className="text-link" href="/fixtures">← Back to fixtures</Link></> : <DataState loading={data.matches.isLoading} error={data.matches.error} empty={false}><Empty>This match has not been published.</Empty></DataState>
    : section === 'teams' ? <DataState loading={data.teams.isLoading} error={data.teams.error} empty={!data.teams.isLoading && !teams.some(team => team.active)}><TeamList list={teams}/></DataState>
    : section === 'standings' ? <><LiveUpdated at={data.updatedAt.standings}/><DataState loading={data.standings.isLoading} error={data.standings.error} empty={!data.standings.isLoading && !(data.standings.data ?? []).length}><Standings list={data.standings.data ?? []}/></DataState></>
    : section === 'fixtures' || section === 'results' ? <><LiveUpdated at={data.updatedAt.matches}/><DataState loading={data.matches.isLoading} error={data.matches.error} empty={!data.matches.isLoading && !matches.filter(match => section === 'fixtures' ? match.status === 'scheduled' || match.status === 'live' : match.status === 'completed' && match.homeScore != null && match.awayScore != null).length}><MatchList list={matches.filter(match => section === 'fixtures' ? match.status === 'scheduled' || match.status === 'live' : match.status === 'completed' && match.homeScore != null && match.awayScore != null)} teams={teams}/></DataState>{section === 'results' && <Link className="match-details-link" href="/history">Browse full match history <ArrowRight/></Link>}{section === 'fixtures' && !matches.some(match => match.status === 'scheduled' || match.status === 'live') && <p>Fixtures have not been published yet.</p>}</>
    : section === 'history' ? <><LiveUpdated at={data.updatedAt.matches}/><MatchHistory list={matches.filter(match => match.status === 'completed' && match.homeScore != null && match.awayScore != null)} teams={teams}/></>
    : section === 'top-scorers' ? <DataState loading={data.scorers.isLoading || data.assists.isLoading} error={data.scorers.error || data.assists.error} empty={!data.scorers.isLoading && !data.assists.isLoading && !(data.scorers.data ?? []).length && !(data.assists.data ?? []).length}><Scorers list={data.scorers.data ?? []} assists={data.assists.data ?? []}/></DataState>
    : section === 'discipline' ? <DataState loading={data.discipline.isLoading} error={data.discipline.error} empty={!data.discipline.isLoading && !(data.discipline.data ?? []).some(player => player.yellowCards || player.redCards || player.suspensionMatch)}><div className="panel"><div className="table-wrap"><table className="standings-table"><thead><tr><th>PLAYER</th><th>TEAM</th><th>YELLOW</th><th>RED</th><th>AVAILABILITY</th></tr></thead><tbody>{(data.discipline.data ?? []).filter(player => player.yellowCards || player.redCards || player.suspensionMatch).map(player => <tr key={player.id}><td>{player.name}</td><td>{player.team?.name ?? 'Team not published'}</td><td>{player.yellowCards}</td><td>{player.redCards}</td><td>{player.suspensionMatch ? <><b>Suspended</b><small>{player.suspensionMatch.label} · {player.suspensionMatch.date} · {player.suspensionMatch.time}</small></> : 'Available'}</td></tr>)}</tbody></table></div></div></DataState>
    : section === 'news' ? <DataState loading={data.announcements.isLoading} error={data.announcements.error} empty={!data.announcements.isLoading && !(data.announcements.data ?? []).some(item => item.published)}><Announcements list={data.announcements.data ?? []}/></DataState>
    : <section className="panel info-panel"><span className="big-crest"><Trophy/></span><div><h2>{section === 'contact' ? 'Organizer contact' : section === 'rules' ? 'Competition rules' : section === 'privacy' || section === 'terms' ? 'Publication review required' : 'Rukpokwu, Port Harcourt, Rivers State, Nigeria'}</h2>{section === 'contact' || section === 'about' ? <><p>{section === 'contact' ? 'Contact the official tournament organizers.' : 'For official tournament information, contact the organizers.'}</p><div className="organizer-contact"><p>Call: <a href={`tel:${contactPhone}`}>{contactPhone}</a></p><p>WhatsApp: <a href={`https://wa.me/${contactInternationalPhone}`} target="_blank" rel="noreferrer">Message the organizers</a></p>{section === 'contact' && data.settings.data?.contactEmail && <p>Email: <a href={`mailto:${data.settings.data.contactEmail}`}>{data.settings.data.contactEmail}</a></p>}</div></> : section === 'rules' ? data.settings.data?.rules ? <p>{data.settings.data.rules}</p> : <p>Detailed rules are not yet published. Please check back after tournament administrators confirm them.</p> : section === 'privacy' || section === 'terms' ? <p>This page is a publication notice, not legal advice or a substitute for organizer-approved terms. Final policy content must be provided and reviewed before launch.</p> : <p>Tournament schedule, format and venue details will be published when confirmed by the organizers. Based in Rukpokwu, Port Harcourt, Rivers State, Nigeria.</p>}</div></section>
  return <Shell><section className="public-page"><Intro title={title} description={descriptions[section] ?? 'Official tournament information.'}/>{sectionContent}<div className="back-link"><Link className="text-link" href="/">← Back to home</Link></div></section></Shell>
}
