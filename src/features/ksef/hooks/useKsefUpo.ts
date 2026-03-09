import { useState, useCallback } from 'react'
import { ksefService, type KsefEnv, type UpoData } from '@/services/ksef/ksef.service'

export function useKsefUpo() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upoHtml, setUpoHtml] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const fetchAndShow = useCallback(
    async (
      ksefRef: string,
      invoiceNumber: string,
      accessToken: string,
      env: KsefEnv = 'test',
      isDemo = false,
      referenceNumber?: string,
    ) => {
      setLoading(true)
      setError(null)
      setUpoHtml(null)
      try {
        let upoData: UpoData
        if (isDemo) {
          // Demo mode — generate a synthetic UPO without calling KSeF
          upoData = {
            ksefReferenceNumber: ksefRef,
            invoiceReferenceNumber: invoiceNumber,
            acquisitionTimestamp: new Date().toISOString(),
            hashSHA: btoa(ksefRef).slice(0, 44) + '=',
            isDemo: true,
          }
        } else {
          if (!referenceNumber) throw new Error(`Brak numeru referencyjnego sesji (referenceNumber) — nie można pobrać UPO.`)
          const raw = await ksefService.fetchUpo(ksefRef, accessToken, env, referenceNumber)
          upoData = {
            ksefReferenceNumber:
              (raw.ksefReferenceNumber as string) || ksefRef,
            invoiceReferenceNumber:
              (raw.invoiceReferenceNumber as string) || invoiceNumber,
            acquisitionTimestamp:
              (raw.acquisitionTimestamp as string) || new Date().toISOString(),
            hashSHA:
              (raw.hashSHA as string) || '—',
          }
        }
        setUpoHtml(ksefService.buildUpoHtml(upoData))
        setOpen(true)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { loading, error, upoHtml, open, fetchAndShow, close: () => setOpen(false) }
}
