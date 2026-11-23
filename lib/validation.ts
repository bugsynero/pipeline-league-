import { z } from 'zod'

const requiredText = (label: string, max = 120) => z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`)
const nonNegativeInt = z.coerce.number().int().min(0, 'Must be zero or greater')
export const teamSchema = z.object({ name: requiredText('Team name', 60).min(2), initials: requiredText('Initials', 4).max(4), active: z.boolean().default(true) })
export const playerSchema = z.object({ name: requiredText('Player name', 80), teamId: requiredText('Team'), number: z.coerce.number().int().min(1).max(99) })
export const matchSchema = z.object({ homeId: requiredText('Home team'), awayId: requiredText('Away team'), date: z.string().date(), time: requiredText('Kick-off time', 40), venue: requiredText('Venue', 120), round: requiredText('Matchday', 80) }).refine(match => match.homeId !== match.awayId, { message: 'Choose two different teams', path: ['awayId'] })
export const matchEventSchema = z.object({ playerId: requiredText('Player'), type: z.enum(['goal', 'assist', 'yellow_card', 'red_card', 'own_goal']), minute: z.coerce.number().int().min(0).max(150), note: z.string().max(300).optional() })
export const announcementSchema = z.object({ title: requiredText('Title', 120), body: requiredText('Announcement', 2000).min(10), pinned: z.boolean().default(false) })
export const tournamentSettingsSchema = z.object({ tournament: z.object({ name: requiredText('Tournament name', 120), venue: requiredText('Venue', 120), startDate: z.string().date() }), points: z.object({ win: nonNegativeInt, draw: nonNegativeInt, loss: nonNegativeInt }), contactEmail: z.union([z.email(), z.literal('')]).optional(), rules: z.string().max(10000).optional() })
export const adminInviteSchema = z.object({ name: requiredText('Administrator name', 80), email: z.email(), role: z.enum(['super_admin', 'tournament_admin', 'match_manager', 'statistician', 'content_manager']) })
export const loginSchema = z.object({ email: z.email('Enter a valid email address'), password: z.string().min(1, 'Password is required').max(256) })
export const searchSchema = z.string().trim().max(120)
