import { useParams } from '@tanstack/react-router'
import { ClientProjectPage } from '@/features/client-portal/components/ClientProjectPage'

export function ClientProjectRoutePage() {
  const params = useParams({ strict: false }) as { id?: string }
  const id = params.id ?? ''
  return <ClientProjectPage projectId={id} />
}
