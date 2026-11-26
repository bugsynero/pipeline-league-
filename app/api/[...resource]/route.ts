import { NextRequest, NextResponse } from 'next/server'
import { isValidObjectId } from 'mongoose'
import { randomBytes } from 'node:crypto'
import { connectToDatabase } from '@/lib/server/db'
import { requireAdmin, canManage, type AdminRole } from '@/lib/server/authorization'
import { hashPassword } from '@/lib/server/auth'
import { seedTournamentDefaults } from '@/lib/server/seed'
import { apiError } from '@/lib/server/http'
import { matchSchema } from '@/lib/validation'
import { TeamModel, PlayerModel, MatchModel, MatchEventModel, AnnouncementModel, TournamentSettingsModel, AdminUserModel, AuditLogModel, PlayerTournamentStatsModel } from '@/lib/server/models'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ resource: string[] }> }
const roles: AdminRole[] = ['super_admin','tournament_admin','match_manager','statistician','content_manager']
const json = (data: unknown, status = 200) => NextResponse.json(data, { status })
const fail = (message: string, status = 400, code = 'INVALID_REQUEST') => json({ code, message }, status)
const idOK = (id: string) => isValidObjectId(id)
const plain = (v: any) => v?.toObject ? v.toObject() : v
const teamOut = (t: any) => ({ id: String(t._id), name: t.name, initials: t.initials, active: t.active, ...(t.logoUrl ? { logoUrl: t.logoUrl } : {}) })
const playerOut = (p: any) => { const t = p.teamId && typeof p.teamId === 'object' ? p.teamId : null; return { id: String(p._id), name: p.name, teamId: String(t?._id ?? p.teamId), number: p.number, ...(p.photoUrl ? { photoUrl: p.photoUrl } : {}), ...(t ? { team: teamOut(t) } : {}) } }
const matchOut = (m: any) => ({ id: String(m._id), homeId: String(m.homeId?._id ?? m.homeId), awayId: String(m.awayId?._id ?? m.awayId), date: m.date, time: m.time, venue: m.venue, round: m.round, status: m.status, ...(m.homeScore != null ? { homeScore: m.homeScore } : {}), ...(m.awayScore != null ? { awayScore: m.awayScore } : {}), ...(m.matchMinute != null ? { matchMinute: m.matchMinute } : {}), ...(m.startedAt ? { startedAt: m.startedAt } : {}), ...(m.finishedAt ? { finishedAt: m.finishedAt } : {}), ...(m.matchReport ? { matchReport: plain(m.matchReport) } : {}), ...(m.resultHeadline ? { resultHeadline: m.resultHeadline } : {}), ...(m.resultSummary ? { resultSummary: m.resultSummary } : {}), ...(m.highlightImageUrl ? { highlightImageUrl: m.highlightImageUrl } : {}), featured: Boolean(m.featured) })
async function audit(user: any, action: string, resource: string, resourceId = '', metadata: any = {}) { await AuditLogModel.create({ actorId: user.id, actor: user.email, action, resource, resourceId, metadata }) }
async function auth(request: NextRequest, area: Parameters<typeof canManage>[1]) {
  const a = await requireAdmin(request)
  if (!a.user) return { user: null, response: json(a.response, a.status) }
  if (!canManage(a.user.role, area)) return { user: null, response: fail('Your administrator role cannot perform this action.', 403, 'FORBIDDEN') }
  return { user: a.user, response: null }
}
async function stats() {
  const teams = await TeamModel.find().lean()
  const matches = await MatchModel.find({ status: 'completed', confirmedAt: { $exists: true } }).lean()
  const table = new Map<string, any>()
  for (const t of teams) table.set(String(t._id), { played:0,wins:0,draws:0,losses:0,gf:0,ga:0,points:0,form:[] })
  const settings: any = await TournamentSettingsModel.findOne({ key:'tournament' }).lean()
  const points = settings?.points ?? { win:3,draw:1,loss:0 }
  for (const m of matches) {
    const h = table.get(String(m.homeId)), a = table.get(String(m.awayId))
    if (!h || !a || m.homeScore == null || m.awayScore == null) continue
    h.played++; a.played++; h.gf += m.homeScore; h.ga += m.awayScore; a.gf += m.awayScore; a.ga += m.homeScore
    if (m.homeScore > m.awayScore) { h.wins++; a.losses++; h.points += points.win; a.points += points.loss; h.form.push('W'); a.form.push('L') }
    else if (m.homeScore < m.awayScore) { a.wins++; h.losses++; a.points += points.win; h.points += points.loss; a.form.push('W'); h.form.push('L') }
    else { h.draws++; a.draws++; h.points += points.draw; a.points += points.draw; h.form.push('D'); a.form.push('D') }
  }
  const standings = teams.map(t => { const s = table.get(String(t._id)); return { team:teamOut(t), ...s, gd:s.gf-s.ga } })
  const tieBreakers = (settings?.tieBreakers ?? ['points','goalDifference','goalsFor']).filter((key:string) => ['points','goalDifference','goalsFor'].includes(key))
  standings.sort((x,y) => { for (const key of tieBreakers) { const xv = key==='points'?x.points:key==='goalDifference'?x.gd:x.gf; const yv = key==='points'?y.points:key==='goalDifference'?y.gd:y.gf; if (xv!==yv) return yv-xv } return x.team.name.localeCompare(y.team.name) })
  return { standings: standings.map((s,i)=>({ position:i+1,...s })), matches }
}
async function playerStats() {
  const events = await MatchEventModel.find().populate({ path: 'playerId', select: 'name teamId number photoUrl', populate: { path: 'teamId', select: 'name initials active' } }).lean()
  const confirmed = await MatchModel.find({ status:'completed', confirmedAt:{ $exists:true } }).select('_id homeId awayId').lean()
  const valid = new Set(confirmed.map(m=>String(m._id)))
  const totals = new Map<string, any>()
  for (const e of events) {
    if (!valid.has(String(e.matchId)) || !e.playerId || typeof e.playerId !== 'object') continue
    const p: any = e.playerId; const key = String(p._id)
    const v = totals.get(key) ?? { player:p, goals:0,assists:0,yellow:0,red:0,appearances:new Set<string>() }
    v.appearances.add(String(e.matchId))
    if (e.type==='goal') v.goals++
    if (e.type==='assist') v.assists++
    if (e.type==='yellow_card') v.yellow++
    if (e.type==='red_card') v.red++
    totals.set(key,v)
  }
  return [...totals.values()].map(v=>({ player:v.player, goals:v.goals, assists:v.assists, yellow:v.yellow, red:v.red }))
}
export async function GET(request: NextRequest, context: Ctx) {
 try {
  await connectToDatabase()
  const parts = (await context.params).resource
  const [resource,id,sub] = parts
  if (resource==='matches' && id && sub==='events') {
    if (!idOK(id)) return fail('Match not found.',404,'NOT_FOUND')
    const rows=await MatchEventModel.find({matchId:id}).populate({path:'playerId',select:'name teamId number',populate:{path:'teamId',select:'name initials'}}).sort({minute:1,createdAt:1}).lean()
    return json(rows.map((e:any)=>({id:String(e._id),matchId:String(e.matchId),playerId:String(e.playerId?._id??e.playerId),type:e.type,minute:e.minute,note:e.note,player:e.playerId?{id:String(e.playerId._id),name:e.playerId.name,number:e.playerId.number,teamId:String(e.playerId.teamId?._id??e.playerId.teamId),teamName:e.playerId.teamId?.name}:null})))
  }
  if (resource==='fixtures' || resource==='matches') {
    const query: any = id ? { _id:id } : {}
    if (request.nextUrl.searchParams.get('status')) query.status=request.nextUrl.searchParams.get('status')
    const rows = await MatchModel.find(query).sort({ date:1,time:1 }).lean()
    if(id && !rows[0]) return fail('Match not found.',404,'NOT_FOUND')
    const output=await Promise.all(rows.map(async m => { const [h,a]=await Promise.all([TeamModel.findById(m.homeId).lean(),TeamModel.findById(m.awayId).lean()]); return { ...matchOut(m), homeTeam:h?teamOut(h):null, awayTeam:a?teamOut(a):null } }))
    return json(id?output[0]:output)
  }
  if (resource==='standings') { const s=await stats(); return json(s.standings) }
  if (resource==='statistics' && id==='scorers') { const rows=await playerStats(); return json(rows.filter(v=>v.goals>0).sort((a,b)=>b.goals-a.goals).map(v=>({...playerOut(v.player),goals:v.goals,assists:v.assists}))) }
  if (resource==='statistics' && id==='discipline') { const rows=await playerStats(); return json(rows.filter(v=>v.yellow||v.red).sort((a,b)=>b.red-a.red||b.yellow-a.yellow).map(v=>({...playerOut(v.player),yellow:v.yellow,red:v.red, yellowCards:v.yellow,redCards:v.red}))) }
  if (resource==='settings') { await seedTournamentDefaults(); const s=await TournamentSettingsModel.findOne({key:'tournament'}).lean(); return json(s ?? {}) }
  if (resource==='announcements') { if(id){if(!idOK(id))return fail('Announcement not found.',404,'NOT_FOUND');const item=await AnnouncementModel.findOne({_id:id,published:true}).lean();return json(item?{id:String(item._id),title:item.title,body:item.body,date:item.publishedAt??item.createdAt,published:item.published,pinned:item.pinned}:null,item?200:404)} const session=await requireAdmin(request);const filter=session.user&&canManage(session.user.role,'content')?{}:{published:true};const rows=await AnnouncementModel.find(filter).sort({pinned:-1,publishedAt:-1,createdAt:-1}).lean();return json(rows.map(a=>({id:String(a._id),title:a.title,body:a.body,date:a.publishedAt??a.createdAt,published:a.published,pinned:a.pinned}))) }
  if (resource==='admin' && id==='dashboard') {
    const gate=await requireAdmin(request); if(!gate.user)return json(gate.response,gate.status)
    const [teams,players,allMatches,confirmedMatches,upcoming,recent,recentActivity]=await Promise.all([TeamModel.countDocuments(),PlayerModel.countDocuments(),MatchModel.countDocuments(),MatchModel.find({status:'completed',confirmedAt:{$exists:true}}).select('_id').lean(),MatchModel.find({status:'scheduled'}).sort({date:1,time:1}).limit(5).lean(),MatchModel.find({status:'completed',confirmedAt:{$exists:true}}).sort({confirmedAt:-1}).limit(5).lean(),AuditLogModel.find().sort({createdAt:-1}).limit(10).lean()]); const goals=await MatchEventModel.countDocuments({type:{$in:['goal','own_goal']},matchId:{$in:confirmedMatches.map(m=>m._id)}})
    return json({teams,players,matches:allMatches,goals,upcoming:upcoming.map(matchOut),recentResults:recent.map(matchOut),recentActivity:recentActivity.map(a=>({id:String(a._id),actor:a.actor,action:a.action,resource:a.resource,resourceId:a.resourceId,createdAt:a.createdAt,metadata:a.metadata}))})
  }
  if (resource==='admin' && id==='audit-logs') { const gate=await auth(request,'users'); if(gate.response)return gate.response; const rows=await AuditLogModel.find().sort({createdAt:-1}).limit(Math.min(Number(request.nextUrl.searchParams.get('limit'))||100,250)).lean(); return json(rows.map(a=>({id:String(a._id),actor:a.actor,action:a.action,resource:a.resource,resourceId:a.resourceId,createdAt:a.createdAt,metadata:a.metadata}))) }
  if (resource==='admin' && id==='users') { const a=await auth(request,'users'); if(a.response)return a.response; const rows=await AdminUserModel.find().select('-passwordHash').sort({createdAt:-1}).lean(); return json(rows.map(u=>({id:String(u._id),name:u.name,email:u.email,role:u.role,active:u.active}))) }
  if (resource==='teams' && id && sub==='players') { const rows=await PlayerModel.find({teamId:id}).populate('teamId','name initials active').sort({number:1}).lean(); return json(rows.map(playerOut)) }
  if (resource==='teams') {
    const rows=await TeamModel.find(id?{_id:id}:{}).sort({name:1}).lean()
    if(id && !rows[0]) return fail('Team not found.',404,'NOT_FOUND')
    return json(id?teamOut(rows[0]):rows.map(teamOut))
  }
  if (resource==='players') {
    const rows=await PlayerModel.find(id?{_id:id}:{}).populate('teamId','name initials active').sort({name:1}).lean()
    if(id && !rows[0]) return fail('Player not found.',404,'NOT_FOUND')
    return json(id?playerOut(rows[0]):rows.map(playerOut))
  }
  return fail('API endpoint not found.',404,'NOT_FOUND')
 } catch(e) { return apiError(e) }
}
export async function POST(request: NextRequest, context: Ctx) {
 try {
  await connectToDatabase()
  const parts=(await context.params).resource; const [resource,id,sub]=parts
  const body=await request.json().catch(()=>({}))
  if(resource==='fixtures' || resource==='matches') {
    const a=await auth(request,resource==='fixtures'?'fixtures':'matches'); if(a.response)return a.response
    if(id && sub==='reschedule') { if(!idOK(id))return fail('Invalid match id.'); const m=await MatchModel.findByIdAndUpdate(id,{$set:{date:body.date,time:body.time,venue:body.venue}},{new:true,runValidators:true}); if(!m)return fail('Fixture not found.',404,'NOT_FOUND'); await audit(a.user,'fixture.rescheduled','match',id,body); return json(matchOut(m)) }
    if(id && sub==='cancel') { const current=await MatchModel.findById(id);if(!current)return fail('Fixture not found.',404,'NOT_FOUND');if(['completed','cancelled'].includes(current.status))return fail('A completed or cancelled match cannot be cancelled again.',409,'MATCH_STATE_CONFLICT');const m=await MatchModel.findByIdAndUpdate(id,{$set:{status:'cancelled'}},{new:true}); await audit(a.user,'fixture.cancelled','match',id,{reason:body.reason}); return json(matchOut(m)) }
    if(id && sub==='start') { const current=await MatchModel.findById(id);if(!current)return fail('Match not found.',404,'NOT_FOUND');if(current.status!=='scheduled')return fail('Only a scheduled match can be started.',409,'MATCH_STATE_CONFLICT');const m=await MatchModel.findByIdAndUpdate(id,{$set:{status:'live',homeScore:current.homeScore??0,awayScore:current.awayScore??0,matchMinute:current.matchMinute??0,startedAt:new Date()}},{new:true}); await audit(a.user,'match.started','match',id); return json(matchOut(m)) }
    if(id && sub==='complete') { const m=await MatchModel.findById(id); if(!m)return fail('Match not found.',404,'NOT_FOUND');if(!['live','scheduled'].includes(m.status))return fail('Only a scheduled or live match can be confirmed.',409,'MATCH_STATE_CONFLICT'); if(m.homeScore==null||m.awayScore==null)return fail('Enter both match scores before confirming the result.'); m.status='completed'; m.finishedAt=new Date(); m.matchMinute=m.matchMinute??90; m.confirmedAt=new Date(); m.confirmedBy=a.user.id; await m.save(); await audit(a.user,'match.confirmed','match',id,{homeScore:m.homeScore,awayScore:m.awayScore}); return json(matchOut(m)) }
    if(id && sub==='corrections') { const m=await MatchModel.findById(id); if(!m)return fail('Match not found.',404,'NOT_FOUND'); const before={homeScore:m.homeScore,awayScore:m.awayScore,status:m.status}; if(body.homeScore!=null)m.homeScore=Number(body.homeScore); if(body.awayScore!=null)m.awayScore=Number(body.awayScore); if(body.reason==null||String(body.reason).trim().length<5)return fail('Provide a correction reason of at least five characters.'); m.confirmedAt=new Date();m.confirmedBy=a.user.id;m.status='completed';m.finishedAt=new Date();m.matchMinute=m.matchMinute??90;await m.save();await audit(a.user,'match.corrected','match',id,{before,after:{homeScore:m.homeScore,awayScore:m.awayScore},reason:body.reason});return json(matchOut(m)) }
    if(id && sub==='events') { if(!idOK(id))return fail('Invalid match id.'); const m=await MatchModel.findById(id); if(!m)return fail('Match not found.',404,'NOT_FOUND'); if(!['live','scheduled'].includes(m.status))return fail('Events can only be added before a match is confirmed.'); const player:any=await PlayerModel.findById(body.playerId).lean(); if(!idOK(body.playerId)||!player)return fail('Select a valid player.'); if(!['goal','assist','yellow_card','red_card','own_goal'].includes(body.type)||!Number.isInteger(Number(body.minute))||Number(body.minute)<0||Number(body.minute)>150)return fail('Invalid match event.'); const playerTeam=String(player.teamId); if(![String(m.homeId),String(m.awayId)].includes(playerTeam))return fail('The selected player does not belong to either team in this match.'); const suspension=await PlayerTournamentStatsModel.findOne({playerId:player._id,suspendedForMatchId:id}).lean(); if(suspension)return fail('This player is marked as suspended for this match and cannot have match events recorded.',409,'PLAYER_SUSPENDED'); const ev=await MatchEventModel.create({matchId:id,playerId:body.playerId,type:body.type,minute:Number(body.minute),note:body.note}); m.matchMinute=Math.max(Number(m.matchMinute??0),Number(body.minute));if(body.type==='goal'||body.type==='own_goal'){const homeScored=(body.type==='goal'&&playerTeam===String(m.homeId))||(body.type==='own_goal'&&playerTeam===String(m.awayId));const field=homeScored?'homeScore':'awayScore';m.set(field,Number(m.get(field)??0)+1);await m.save()}else{await m.save()} await audit(a.user,'match.event.created','match-event',String(ev._id),{matchId:id,type:body.type}); return json({id:String(ev._id),matchId:id,playerId:String(ev.playerId),type:ev.type,minute:ev.minute,note:ev.note,score:{home:m.homeScore??0,away:m.awayScore??0}},201) }
    const parsed=matchSchema.safeParse(body);if(!parsed.success)return apiError(parsed.error);const {homeId,awayId,date,time,venue,round}=parsed.data
    if(!idOK(homeId)||!idOK(awayId)||!(await TeamModel.exists({_id:homeId}))||!(await TeamModel.exists({_id:awayId})))return fail('Select two different existing teams.')
    const m=await MatchModel.create({homeId,awayId,date,time,venue,round,status:'scheduled'})
    await audit(a.user,'fixture.created','match',String(m._id),{homeId,awayId})
    return json(matchOut(m),201)
  }
  if(resource==='teams' || resource==='players') {
    const area=resource as 'teams'|'players'; const a=await auth(request,area); if(a.response)return a.response
    if(resource==='teams') { if(!body.name||!body.initials)return fail('Team name and initials are required.'); if(body.logoUrl && !/^https:\/\//i.test(String(body.logoUrl)))return fail('Use a secure public HTTPS image URL for the team logo.'); const t=await TeamModel.create({name:String(body.name).trim(),initials:String(body.initials).trim().slice(0,4).toUpperCase(),active:body.active!==false,logoUrl:body.logoUrl || undefined}); await audit(a.user,'team.created','team',String(t._id)); return json(teamOut(t),201) }
    if(!body.name||!idOK(body.teamId)||!Number.isInteger(Number(body.number)))return fail('Player name, valid team and squad number are required.'); if(body.photoUrl && !/^https?:\/\//i.test(String(body.photoUrl)))return fail('Use a publicly accessible http or https image URL for the player photo.'); const p=await PlayerModel.create({name:String(body.name).trim(),teamId:body.teamId,number:Number(body.number),photoUrl:body.photoUrl || undefined}); await audit(a.user,'player.created','player',String(p._id)); return json(playerOut(await p.populate('teamId','name initials active')),201)
  }
  if(resource==='announcements' && id && sub==='publish') { const a=await auth(request,'content');if(a.response)return a.response;if(!idOK(id))return fail('Announcement not found.',404,'NOT_FOUND');const x=await AnnouncementModel.findByIdAndUpdate(id,{$set:{published:!!body.published,publishedAt:body.published?new Date():null}},{new:true});if(!x)return fail('Announcement not found.',404,'NOT_FOUND');await audit(a.user,'announcement.published','announcement',id,{published:!!body.published});return json({id:String(x._id),title:x.title,body:x.body,published:x.published,pinned:x.pinned,date:x.publishedAt??x.createdAt}) }
  if(resource==='announcements') { const a=await auth(request,'content');if(a.response)return a.response;if(!body.title||!body.body)return fail('Announcement title and body are required.');const x=await AnnouncementModel.create({title:body.title,body:body.body,pinned:!!body.pinned,published:false});await audit(a.user,'announcement.created','announcement',String(x._id));return json({id:String(x._id),title:x.title,body:x.body,published:x.published,pinned:x.pinned,date:x.createdAt},201) }
  if(resource==='admin'&&id==='users'&&sub==='invitations') { const a=await auth(request,'users');if(a.response)return a.response;if(!body.name||!body.email||!roles.includes(body.role))return fail('Name, email and a valid role are required.');const temporaryPassword=body.password?String(body.password):randomBytes(18).toString('base64url');if(temporaryPassword.length<12)return fail('Administrator password must contain at least 12 characters.');const email=String(body.email).trim().toLowerCase();const exists=await AdminUserModel.exists({email});if(exists)return fail('An administrator with this email already exists.',409,'EMAIL_EXISTS');const u=await AdminUserModel.create({name:body.name,email,role:body.role,passwordHash:await hashPassword(temporaryPassword),active:true});await audit(a.user,'admin.created','admin-user',String(u._id));return json({id:String(u._id),name:u.name,email:u.email,role:u.role,active:u.active,temporaryPassword},201) }
  return fail('API endpoint not found.',404,'NOT_FOUND')
 } catch(e) { return apiError(e) }
}
export async function PATCH(request: NextRequest, context: Ctx) {
 try {
  await connectToDatabase(); const parts=(await context.params).resource;const [resource,id,sub]=parts;const extra=parts[3];const body=await request.json()
  if(resource==='matches'&&id&&sub==='live-score') { const a=await auth(request,'matches');if(a.response)return a.response;if(!idOK(id))return fail('Match not found.',404,'NOT_FOUND');const m=await MatchModel.findById(id);if(!m)return fail('Match not found.',404,'NOT_FOUND');if(m.status!=='live')return fail('Live score updates are only available after the match has been started.',409,'MATCH_STATE_CONFLICT');const homeScore=Number(body.homeScore),awayScore=Number(body.awayScore),matchMinute=Number(body.matchMinute);if(!Number.isInteger(homeScore)||homeScore<0||homeScore>99||!Number.isInteger(awayScore)||awayScore<0||awayScore>99||!Number.isInteger(matchMinute)||matchMinute<0||matchMinute>150)return fail('Enter valid scores from 0 to 99 and a match minute from 0 to 150.');const before={homeScore:m.homeScore,awayScore:m.awayScore,matchMinute:m.matchMinute};m.homeScore=homeScore;m.awayScore=awayScore;m.matchMinute=matchMinute;await m.save();await audit(a.user,'match.live_score.updated','match',id,{before,after:{homeScore,awayScore,matchMinute}});return json(matchOut(m)) }
  if(resource==='matches'&&id&&sub==='report') { const a=await auth(request,'matches');if(a.response)return a.response;if(!idOK(id))return fail('Match not found.',404,'NOT_FOUND');const m=await MatchModel.findById(id);if(!m)return fail('Match not found.',404,'NOT_FOUND');const fields:any={weather:100,pitchCondition:160,attendance:60,referee:100,playerOfTheMatch:120,incidents:2000,notes:2000};const report:any={...(plain(m.matchReport)??{})};for(const [key,max] of Object.entries(fields)){if(body[key]!==undefined){if(typeof body[key]!=='string'||body[key].length>Number(max))return fail(`The ${key} field must be text and no longer than ${max} characters.`);report[key]=body[key].trim()}}if(body.resultHeadline!==undefined)m.resultHeadline=String(body.resultHeadline).trim().slice(0,140);if(body.resultSummary!==undefined)m.resultSummary=String(body.resultSummary).trim().slice(0,2000);if(body.highlightImageUrl!==undefined){const image=String(body.highlightImageUrl).trim();if(image&&!/^https?:\/\//i.test(image))return fail('Use a publicly accessible http or https image URL.');m.highlightImageUrl=image||undefined}if(body.featured!==undefined)m.featured=Boolean(body.featured);m.matchReport=report;await m.save();await audit(a.user,'match.report.updated','match',id,{fields:[...Object.keys(report),...['resultHeadline','resultSummary','highlightImageUrl','featured'].filter(key=>body[key]!==undefined)]});return json(matchOut(m)) }
  if(resource==='settings') { const a=await auth(request,'settings');if(a.response)return a.response; const current:any=await TournamentSettingsModel.findOne({key:'tournament'}); const allowedTournament=['name','tagline','venue','startDate','kickOff','status','format']; const tournamentInput=body.tournament&&typeof body.tournament==='object'?Object.fromEntries(Object.entries(body.tournament).filter(([key])=>allowedTournament.includes(key))):{}; const update:any={}; for(const key of ['contactEmail','organizerPhone','rules']) if(typeof body[key]==='string') update[key]=body[key].trim(); if(body.points&&typeof body.points==='object'){const points:any={}; for(const key of ['win','draw','loss']) if(body.points[key]!==undefined){const n=Number(body.points[key]);if(!Number.isInteger(n)||n<0||n>20)return fail(`Invalid points value for ${key}.`);points[key]=n;} if(Object.keys(points).length)update.points={...(current?.points?.toObject?.()??current?.points??{}),...points};} if(Object.keys(tournamentInput).length)update.tournament={...(current?.tournament?.toObject?.()??current?.tournament??{}),...tournamentInput}; if(Array.isArray(body.tieBreakers)&&body.tieBreakers.every((v:string)=>['points','goalDifference','goalsFor'].includes(v)))update.tieBreakers=body.tieBreakers; const saved=await TournamentSettingsModel.findOneAndUpdate({key:'tournament'},{$set:update},{new:true,upsert:true,runValidators:true,setDefaultsOnInsert:true});await audit(a.user,'settings.updated','settings','tournament',{fields:Object.keys(update)});return json(saved) }
  if(resource==='announcements') { const a=await auth(request,'content');if(a.response)return a.response;if(!idOK(id))return fail('Announcement not found.',404,'NOT_FOUND');const patch:any={};if(body.title!==undefined)patch.title=String(body.title).trim();if(body.body!==undefined)patch.body=String(body.body).trim();if(body.pinned!==undefined)patch.pinned=Boolean(body.pinned);if(!Object.keys(patch).length)return fail('No editable announcement fields were supplied.');const x=await AnnouncementModel.findByIdAndUpdate(id,{$set:patch},{new:true,runValidators:true});if(!x)return fail('Announcement not found.',404,'NOT_FOUND');await audit(a.user,'announcement.updated','announcement',id,{fields:Object.keys(patch)});return json({id:String(x._id),title:x.title,body:x.body,published:x.published,pinned:x.pinned,date:x.publishedAt??x.createdAt}) }
  if(resource==='teams'||resource==='players') { const a=await auth(request,resource as 'teams'|'players');if(a.response)return a.response;if(!idOK(id))return fail('Record not found.',404,'NOT_FOUND');const Model:any=resource==='teams'?TeamModel:PlayerModel;const data={...body};if(resource==='players'&&data.teamId&&!idOK(data.teamId))return fail('Invalid team.');if(resource==='teams'&&data.logoUrl&& !/^https:\/\//i.test(String(data.logoUrl)))return fail('Use a secure public HTTPS image URL for the team logo.');const x=await Model.findByIdAndUpdate(id,{$set:data},{new:true,runValidators:true}).populate?.(resource==='players'?'teamId':'')??await Model.findById(id);if(!x)return fail('Record not found.',404,'NOT_FOUND');await audit(a.user,resource.slice(0,-1)+'.updated',resource,id);return json(resource==='teams'?teamOut(x):playerOut(x)) }
  if(resource==='admin'&&id==='users'&&extra==='role') { const a=await auth(request,'users');if(a.response)return a.response;const userId=sub;if(!userId||!idOK(userId)||!roles.includes(body.role))return fail('Valid administrator id and role are required.');const u=await AdminUserModel.findByIdAndUpdate(userId,{$set:{role:body.role}},{new:true});if(!u)return fail('Administrator not found.',404,'NOT_FOUND');await audit(a.user,'admin.role.updated','admin-user',userId,{role:body.role});return json({id:String(u._id),name:u.name,email:u.email,role:u.role,active:u.active}) }
  if(resource==='admin'&&id==='users'&&sub&&!extra) { const a=await auth(request,'users');if(a.response)return a.response;if(!idOK(sub))return fail('Administrator not found.',404,'NOT_FOUND');const patch:any={};if(body.name!==undefined){if(typeof body.name!=='string'||body.name.trim().length<2||body.name.trim().length>80)return fail('Administrator name must be between 2 and 80 characters.');patch.name=body.name.trim()}if(body.email!==undefined){if(typeof body.email!=='string'||!/^\S+@\S+\.\S+$/.test(body.email.trim()))return fail('Enter a valid administrator email.');const email=body.email.trim().toLowerCase();if(await AdminUserModel.exists({email,_id:{$ne:sub}}))return fail('An administrator with this email already exists.',409,'EMAIL_EXISTS');patch.email=email}if(body.role!==undefined){if(!roles.includes(body.role))return fail('Select a valid administrator role.');if(sub===a.user.id)return fail('You cannot change your own administrator role.',409,'SELF_ROLE_CHANGE');patch.role=body.role}if(!Object.keys(patch).length)return fail('No editable administrator fields were supplied.');const u=await AdminUserModel.findByIdAndUpdate(sub,{$set:patch},{new:true,runValidators:true});if(!u)return fail('Administrator not found.',404,'NOT_FOUND');await audit(a.user,'admin.updated','admin-user',sub,{fields:Object.keys(patch)});return json({id:String(u._id),name:u.name,email:u.email,role:u.role,active:u.active}) }
  if((resource==='matches'||resource==='fixtures')&&id&&!sub) { const a=await auth(request,resource==='fixtures'?'fixtures':'matches');if(a.response)return a.response;if(!idOK(id))return fail('Match not found.',404,'NOT_FOUND');const current=await MatchModel.findById(id);if(!current)return fail('Match not found.',404,'NOT_FOUND');if(current.status!=='scheduled')return fail('Only scheduled fixtures can be edited. Use the score-correction workflow for completed matches.',409,'MATCH_STATE_CONFLICT');const patch:any={};for(const key of ['date','time','venue','round'])if(body[key]!==undefined)patch[key]=body[key];for(const key of ['homeId','awayId'])if(body[key]!==undefined){if(!idOK(body[key])||!(await TeamModel.exists({_id:body[key]})))return fail('Select an existing team.');patch[key]=body[key]}const home=String(patch.homeId??current.homeId),away=String(patch.awayId??current.awayId);if(home===away)return fail('A match must have two different teams.');if(!Object.keys(patch).length)return fail('No editable fixture fields were supplied.');const m=await MatchModel.findByIdAndUpdate(id,{$set:patch},{new:true,runValidators:true});await audit(a.user,'fixture.updated','match',id,{fields:Object.keys(patch)});return json(matchOut(m)) }
  return fail('API endpoint not found.',404,'NOT_FOUND')
 } catch(e) { return apiError(e) }
}
export async function DELETE(request: NextRequest, context: Ctx) {
 try {
  await connectToDatabase();const parts=(await context.params).resource;const [resource,id,sub]=parts
  if(resource==='matches' && id && sub==='events' && parts[3]) {
   const a=await auth(request,'matches');if(a.response)return a.response
   const eventId=parts[3];if(!idOK(id)||!idOK(eventId))return fail('Match event not found.',404,'NOT_FOUND')
   const match=await MatchModel.findById(id);if(!match)return fail('Match not found.',404,'NOT_FOUND')
   if(match.status==='completed'&&match.confirmedAt)return fail('Events on a confirmed result cannot be changed. Correct the result through the audited score-correction workflow.',409,'CONFIRMED_RESULT_PROTECTED')
   const event=await MatchEventModel.findOne({_id:eventId,matchId:id}).populate('playerId','teamId')
   if(!event)return fail('Match event not found.',404,'NOT_FOUND')
   if(event.type==='goal'||event.type==='own_goal'){const player:any=event.playerId;const teamId=String(player?.teamId);const homeScored=(event.type==='goal'&&teamId===String(match.homeId))||(event.type==='own_goal'&&teamId===String(match.awayId));const field=homeScored?'homeScore':'awayScore';match.set(field,Math.max(0,Number(match.get(field)??0)-1));await match.save()}
   await MatchEventModel.deleteOne({_id:eventId,matchId:id});await audit(a.user,'match.event.deleted','match-event',eventId,{matchId:id,type:event.type})
   return new NextResponse(null,{status:204})
  }
  if(resource==='teams'||resource==='players'||resource==='matches'||resource==='fixtures'||resource==='announcements') {
   const area=resource==='announcements'?'content':resource==='teams'?'teams':resource==='players'?'players':resource==='fixtures'?'fixtures':'matches';const a=await auth(request,area);if(a.response)return a.response
   if(!idOK(id))return fail('Record not found.',404,'NOT_FOUND')
   if(resource==='teams'&&await PlayerModel.exists({teamId:id}))return fail('Reassign this team’s players before deleting it.',409,'TEAM_HAS_PLAYERS')
   if((resource==='matches'||resource==='fixtures')){const match=await MatchModel.findById(id);if(match?.status==='completed'&&match.confirmedAt)return fail('Confirmed results cannot be deleted. Use a score correction with an audit reason.',409,'CONFIRMED_RESULT_PROTECTED')}
   const Model:any=resource==='teams'?TeamModel:resource==='players'?PlayerModel:resource==='announcements'?AnnouncementModel:MatchModel
   const x=await Model.findByIdAndDelete(id);if(!x)return fail('Record not found.',404,'NOT_FOUND');if(resource==='matches'||resource==='fixtures')await MatchEventModel.deleteMany({matchId:id});await audit(a.user,resource.slice(0,-1)+'.deleted',resource,id);return new NextResponse(null,{status:204})
  }
  if(resource==='admin'&&id==='users') {const a=await auth(request,'users');if(a.response)return a.response;if(!idOK(sub))return fail('Invalid administrator id.');if(sub===a.user.id)return fail('You cannot delete your own active administrator account.',409);const u=await AdminUserModel.findByIdAndDelete(sub);if(!u)return fail('Administrator not found.',404,'NOT_FOUND');await audit(a.user,'admin.deleted','admin-user',sub);return new NextResponse(null,{status:204})}
  return fail('API endpoint not found.',404,'NOT_FOUND')
 } catch(e) { return apiError(e) }
}
