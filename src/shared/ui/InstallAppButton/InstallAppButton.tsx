import { Download } from 'lucide-react'
import { Button } from '@/shared/ui/Button/Button'
import { usePwaInstall } from '@/shared/hooks/usePwaInstall'

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const { canInstall, install, installed } = usePwaInstall()
  if (installed) return <Button variant="ghost" size={compact ? 'sm' : 'md'} disabled icon={<Download size={16} />}>Zainstalowana</Button>
  if (!canInstall) return null
  return (
    <Button variant="secondary" size={compact ? 'sm' : 'md'} onClick={() => void install()} icon={<Download size={16} />}>
      Zainstaluj aplikację
    </Button>
  )
}
