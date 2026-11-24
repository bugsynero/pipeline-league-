import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/server/db'
import { ADMIN_SESSION_COOKIE, authenticateAdmin, createAdminSession, deleteAdminSession, findAdminSession } from '@/lib/server/auth'
import { apiError } from '@/lib/server/http'
import { loginSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cookieOptions(expires?: Date) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', ...(expires ? { expires } : {}) }
}

function rejectCrossOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return Boolean(origin && origin !== request.nextUrl.origin)
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? ''
    const user = await findAdminSession(token)
    if (!user) return NextResponse.json({ code: 'UNAUTHENTICATED', message: 'A valid administrator session is required.' }, { status: 401 })
    return NextResponse.json({ user, roles: [user.role] })
  } catch (error) { return apiError(error) }
}

export async function POST(request: NextRequest) {
  if (rejectCrossOrigin(request)) return NextResponse.json({ code: 'ORIGIN_REJECTED', message: 'Cross-origin requests are not allowed.' }, { status: 403 })
  try {
    await connectToDatabase()
    const parsed = loginSchema.safeParse(await request.json())
    if (!parsed.success) return apiError(parsed.error)
    const admin = await authenticateAdmin(parsed.data.email, parsed.data.password)
    if (!admin) return NextResponse.json({ code: 'INVALID_CREDENTIALS', message: 'The email or password is incorrect.' }, { status: 401 })
    const { token, expiresAt } = await createAdminSession(String(admin._id))
    const response = NextResponse.json({ user: { id: String(admin._id), name: admin.name, email: admin.email, role: admin.role, active: admin.active } })
    response.cookies.set(ADMIN_SESSION_COOKIE, token, cookieOptions(expiresAt))
    return response
  } catch (error) { return apiError(error) }
}

export async function DELETE(request: NextRequest) {
  if (rejectCrossOrigin(request)) return NextResponse.json({ code: 'ORIGIN_REJECTED', message: 'Cross-origin requests are not allowed.' }, { status: 403 })
  try {
    await connectToDatabase()
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? ''
    await deleteAdminSession(token)
    const response = new NextResponse(null, { status: 204 })
    response.cookies.set(ADMIN_SESSION_COOKIE, '', { ...cookieOptions(new Date(0)), maxAge: 0 })
    return response
  } catch (error) { return apiError(error) }
}
