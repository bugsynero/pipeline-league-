'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { api } from '@/lib/services/api'

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { data, error, isLoading } = useSWR('admin-session', api.auth.session, { revalidateOnFocus: true })
  if (isLoading) return <main className="public-page"><div className="empty-state" role="status">Checking administrator session…</div></main>
  if (error || !data) return <main className="public-page"><section className="panel admin-login-panel"><div className="eyebrow">RESTRICTED AREA</div><h1>Administrator sign-in required</h1><p>{error instanceof Error && error.message.includes('API is not configured') ? 'The authentication service is not connected. Administration is unavailable until the backend is configured.' : 'A valid administrator session is required to access tournament management.'}</p><Link className="button-primary" href="/admin/login">Go to admin login</Link></section></main>
  return <>{children}</>
}
