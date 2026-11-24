import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { AdminSessionModel, AdminUserModel } from './models'

const scrypt = promisify(scryptCallback)
export const ADMIN_SESSION_COOKIE = 'pipeline_admin_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error('Administrator passwords must be between 12 and 256 characters.')
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64) as Buffer
  return `scrypt:${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, stored] = encoded.split(':')
  if (scheme !== 'scrypt' || !salt || !stored || !/^[a-f0-9]{128}$/i.test(stored)) return false
  const derived = await scrypt(password, salt, 64) as Buffer
  const expected = Buffer.from(stored, 'hex')
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}

async function ensureBootstrapAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD
  if (!email || !password) throw new Error('The first administrator has not been configured. Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD.')
  const existing = await AdminUserModel.findOne({ email })
  if (existing) return
  const passwordHash = await hashPassword(password)
  try {
    await AdminUserModel.create({ name: 'Tournament Super Admin', email, passwordHash, role: 'super_admin', active: true })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
  }
}

export async function authenticateAdmin(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase()
  await ensureBootstrapAdmin()
  const admin = await AdminUserModel.findOne({ email }).select('+passwordHash')
  if (!admin || !admin.active || !(await verifyPassword(password, admin.passwordHash))) return null
  return admin
}

export async function createAdminSession(adminId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await AdminSessionModel.create({ tokenHash: hashToken(token), adminId, expiresAt })
  return { token, expiresAt }
}

export async function findAdminSession(token: string) {
  if (!token || token.length > 200) return null
  const session = await AdminSessionModel.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).populate({ path: 'adminId', select: 'name email role active' })
  const admin = session?.adminId as unknown as { _id: unknown; name: string; email: string; role: string; active: boolean } | undefined
  if (!admin || !admin.active) return null
  return { id: String(admin._id), name: admin.name, email: admin.email, role: admin.role }
}

export async function deleteAdminSession(token: string) {
  if (token) await AdminSessionModel.deleteOne({ tokenHash: hashToken(token) })
}
