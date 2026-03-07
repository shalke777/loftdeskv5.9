import { useState, useCallback } from 'react'
import { ksefService, type KsefReceivedDoc, type KsefEnv } from '@/services/ksef/ksef.service'

export function useKsefReceive() {
  const [docs, setDocs] = useState<KsefReceivedDoc[]>(() => ksefService.getReceived())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCount, setNewCount] = useState<number | null>(null)

  const receive = useCallback(
    async (nip: string, sessionToken: string, env: KsefEnv = 'test') => {
      setLoading(true)
      setError(null)
      const before = ksefService.getReceived().length
      try {
        const all = await ksefService.receiveDocuments(nip, sessionToken, env)
        setNewCount(all.length - before)
        setDocs(all)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { docs, loading, error, newCount, receive }
}
