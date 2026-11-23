'use client'

import { AdminGate } from '@/components/admin-gate'
import { AdminConsole } from '@/components/admin-console'
import { PublicPage } from '@/components/public-tournament'

export function PublicRoute({ section, itemId }: { section: string; itemId?: string }) {
  return <PublicPage section={section} itemId={itemId} />
}

export function AdminRoute() {
  return <AdminGate><AdminConsole /></AdminGate>
}
