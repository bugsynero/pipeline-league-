'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { api } from '@/lib/services/api'
import { loginSchema } from '@/lib/validation'

export function AdminLogin() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = loginSchema.safeParse({ email: form.get('email'), password: form.get('password') })
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? 'Enter your administrator credentials.'); return }
    setPending(true); setMessage('')
    try { await api.auth.login(parsed.data.email, parsed.data.password); router.replace('/admin') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Sign-in could not be completed. Please try again.') }
    finally { setPending(false) }
  }
  return <main className="public-page"><section className="panel settings-card admin-login-panel"><div className="eyebrow">TOURNAMENT MANAGEMENT</div><h1>Admin login</h1><p>Sign in with an administrator account to manage the tournament.</p><form onSubmit={submit} className="admin-login-form"><label htmlFor="admin-email">Email address</label><input id="admin-email" name="email" type="email" autoComplete="username" required/><label htmlFor="admin-password">Password</label><input id="admin-password" name="password" type="password" autoComplete="current-password" required/>{message && <p role="alert" className="form-error">{message}</p>}<button className="button-primary" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button></form><Link className="text-link" href="/">← Back to tournament</Link></section></main>
}
