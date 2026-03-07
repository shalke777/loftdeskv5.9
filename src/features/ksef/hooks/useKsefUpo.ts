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
      sessionToken: string,
      env: KsefEnv = 'test',
      isDemo = false,
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
          const raw = await ksefService.fetchUpo(ksefRef, sessionToken, env)
          upoData = {
            ksefReferenceNumber:
              (raw.ksefReferenceNumber as string) || ksefRef,
            invoiceReferenceNumber:
              (raw.invoiceReferenceNumber as string) || invoiceNumber,
            acquisitionTimestamp:
              (raw.acquisitionTimestamp as string) || new Date().toISOString(),
            hashSHA:
              (raw.fileSignatureList as Array<{ hashSHA?: { value?: string } }>)?.[0]
                ?.hashSHA?.value || '—',
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
