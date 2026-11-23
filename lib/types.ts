export type MatchStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'
export type AdminRole = 'super_admin' | 'tournament_admin' | 'match_manager' | 'statistician' | 'content_manager'
export type MatchEventType = 'goal' | 'assist' | 'yellow_card' | 'red_card' | 'own_goal'
export interface Tournament { id: string; name: string; tagline?: string; venue: string; startDate: string; kickOff?: string; status: 'upcoming' | 'ongoing' | 'completed'; format?: string }
export interface Team { id: string; name: string; initials: string; active: boolean; logoUrl?: string; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; points: number; form: string[] }
export interface Player { id: string; name: string; teamId: string; number: number; appearances: number; goals: number; assists?: number; yellowCards: number; redCards: number }
export interface Match { id: string; homeId: string; awayId: string; date: string; time: string; venue: string; round: string; status: MatchStatus; homeScore?: number; awayScore?: number }
export interface MatchEvent { id: string; matchId: string; playerId: string; type: MatchEventType; minute: number; note?: string }
export interface LeagueStanding { position: number; team: Team; played: number; wins: number; draws: number; losses: number; gf: number; ga: number; gd: number; points: number; form: string[] }
export interface TopScorer extends Player { team: Team }
export interface DisciplineRecord extends Player { team: Team; yellow: number; red: number }
export interface Announcement { id: string; title: string; body: string; date: string; published: boolean; pinned: boolean }
export interface AdminUser { id: string; name: string; email: string; role: AdminRole; active: boolean }
export interface AuditLog { id: string; actor: string; action: string; resource: string; resourceId: string; createdAt: string; metadata?: Record<string, unknown> }
export interface TournamentSettings { tournament: Tournament; points: { win: number; draw: number; loss: number }; tieBreakers: string[]; contactEmail?: string; rules?: string }
export interface DashboardSummary { teams: number; players: number; matches: number; goals: number; upcoming: Match[]; recentResults: Match[]; recentActivity: AuditLog[] }
export interface ApiError { code: string; message: string; details?: unknown }
