import { useState, useCallback } from 'react'
import { useCompanyId } from '@/features/auth/hooks/useAuth'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { ksefService, type KsefEnv, type UpoData } from '@/services/ksef/ksef.service'

export function useKsefUpo() {
  const companyId = useCompanyId()
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
          const submission = await invoicesApi.findKsefSubmission(ksefRef, companyId)
          if (submission?.ksef_env && submission.ksef_env !== env) {
            throw new Error('Wybierz środowisko KSeF zgodne z pierwotną wysyłką faktury.')
          }
          referenceNumber = submission?.ksef_session_ref || referenceNumber
          if (!referenceNumber) throw new Error(`Brak numeru referencyjnego sesji (referenceNumber) — nie można pobrać UPO.`)
          const raw = await ksefService.fetchUpo(ksefRef, accessToken, env, referenceNumber)
          if (raw.statusCode !== 200 || !raw.ksefReferenceNumber) {
            throw new Error(raw.statusDescription as string || 'Brak potwierdzenia przyjęcia faktury przez KSeF. Sprawdź jej status ponownie później.')
          }
          upoData = {
            ksefReferenceNumber: raw.ksefReferenceNumber as string,
            invoiceReferenceNumber:
              (raw.invoiceReferenceNumber as string) || invoiceNumber,
            acquisitionTimestamp:
              (raw.acquisitionTimestamp as string) || undefined,
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
    [companyId],
  )

  return { loading, error, upoHtml, open, fetchAndShow, close: () => setOpen(false) }
}
