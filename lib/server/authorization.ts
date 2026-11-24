import { NextRequest } from 'next/server'
import { connectToDatabase } from './db'
import { ADMIN_SESSION_COOKIE, findAdminSession } from './auth'

export type AdminRole = 'super_admin' | 'tournament_admin' | 'match_manager' | 'statistician' | 'content_manager'

export async function requireAdmin(request: NextRequest, allowedRoles?: AdminRole[]) {
  await connectToDatabase()
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? ''
  const user = await findAdminSession(token)
  if (!user) return { user: null, response: { code: 'UNAUTHENTICATED', message: 'A valid administrator session is required.' }, status: 401 as const }
  if (allowedRoles && !allowedRoles.includes(user.role as AdminRole)) {
    return { user: null, response: { code: 'FORBIDDEN', message: 'Your administrator role cannot perform this action.' }, status: 403 as const }
  }
  return { user, response: null, status: 200 as const }
}

export function canManage(role: string, area: 'teams' | 'players' | 'fixtures' | 'matches' | 'statistics' | 'content' | 'settings' | 'users') {
  const access: Record<AdminRole, string[]> = {
    super_admin: ['teams','players','fixtures','matches','statistics','content','settings','users'],
    tournament_admin: ['teams','players','fixtures','matches','statistics','content','settings','users'],
    match_manager: ['teams','players','fixtures','matches'],
    statistician: ['matches','statistics'],
    content_manager: ['content'],
  }
  return (access[role as AdminRole] ?? []).includes(area)
}
