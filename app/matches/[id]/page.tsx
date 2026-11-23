import { PublicRoute } from '@/components/route-pages'
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PublicRoute section="match-detail" itemId={id} /> }
