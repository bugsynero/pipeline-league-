import mongoose, { Schema, type Model } from 'mongoose'

const options = { timestamps: true, versionKey: false }
const teamSchema = new Schema({ name: { type: String, required: true, trim: true, unique: true, maxlength: 60 }, initials: { type: String, required: true, uppercase: true, maxlength: 4 }, active: { type: Boolean, default: true }, logoUrl: String }, options)
const playerSchema = new Schema({ name: { type: String, required: true, trim: true, maxlength: 80 }, teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true }, number: { type: Number, min: 1, max: 99, required: true } }, options)
playerSchema.index({ teamId: 1, number: 1 }, { unique: true })
const matchSchema = new Schema({ homeId: { type: Schema.Types.ObjectId, ref: 'Team', required: true }, awayId: { type: Schema.Types.ObjectId, ref: 'Team', required: true }, date: { type: String, required: true }, time: { type: String, required: true }, venue: { type: String, required: true }, round: { type: String, required: true }, status: { type: String, enum: ['scheduled','live','completed','cancelled'], default: 'scheduled', index: true }, homeScore: { type: Number, min: 0 }, awayScore: { type: Number, min: 0 }, confirmedAt: Date, confirmedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' } }, options)
const eventSchema = new Schema({ matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true, index: true }, playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true }, type: { type: String, enum: ['goal','assist','yellow_card','red_card','own_goal'], required: true }, minute: { type: Number, min: 0, max: 150, required: true }, note: { type: String, maxlength: 300 } }, options)
const adminSchema = new Schema({ name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, passwordHash: { type: String, required: true, select: false }, role: { type: String, enum: ['super_admin','tournament_admin','match_manager','statistician','content_manager'], required: true }, active: { type: Boolean, default: true } }, options)
const announcementSchema = new Schema({ title: { type: String, required: true, maxlength: 120 }, body: { type: String, required: true, maxlength: 2000 }, published: { type: Boolean, default: false }, pinned: { type: Boolean, default: false }, publishedAt: Date }, options)
const settingsSchema = new Schema({ key: { type: String, unique: true, default: 'tournament' }, tournament: { name: { type: String, default: 'Pipeline Annual Football Tournament 2026' }, tagline: String, venue: { type: String, default: 'Pipeline Field' }, startDate: { type: String, default: '2026-11-23' }, kickOff: { type: String, default: '16:00' }, status: { type: String, enum: ['upcoming','ongoing','completed'], default: 'upcoming' }, format: String }, points: { win: { type: Number, default: 3 }, draw: { type: Number, default: 1 }, loss: { type: Number, default: 0 } }, tieBreakers: { type: [String], default: ['points','goalDifference','goalsFor'] }, contactEmail: String, organizerPhone: { type: String, default: '09061206522' }, rules: String }, options)
const auditSchema = new Schema({ actorId: { type: Schema.Types.ObjectId, ref: 'AdminUser' }, actor: String, action: { type: String, required: true }, resource: { type: String, required: true }, resourceId: String, metadata: Schema.Types.Mixed }, options)
const sessionSchema = new Schema({ tokenHash: { type: String, required: true, unique: true }, adminId: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true, index: true }, expiresAt: { type: Date, required: true, expires: 0 } }, options)

function model<T>(name: string, schema: Schema): Model<T> { return (mongoose.models[name] as Model<T>) || mongoose.model<T>(name, schema) }
export const TeamModel = model('Team', teamSchema)
export const PlayerModel = model('Player', playerSchema)
export const MatchModel = model('Match', matchSchema)
export const MatchEventModel = model('MatchEvent', eventSchema)
export const AdminUserModel = model('AdminUser', adminSchema)
export const AnnouncementModel = model('Announcement', announcementSchema)
export const TournamentSettingsModel = model('TournamentSettings', settingsSchema)
export const AuditLogModel = model('AuditLog', auditSchema)
export const AdminSessionModel = model('AdminSession', sessionSchema)
