import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Button } from '@/shared/ui/Button/Button'
import { downloadBlob } from '@/shared/lib/downloads'

export interface DocumentPreviewTab {
  key: string
  label: string
  type: 'html' | 'xml'
  content: string
}

export function DocumentPreviewModal({
  open,
  onClose,
  title,
  tabs,
}: {
  open: boolean
  onClose: () => void
  title: string
  tabs: DocumentPreviewTab[]
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? 'preview')
  const [downloading, setDownloading] = useState(false)
  useEffect(() => {
    setActive(tabs[0]?.key ?? 'preview')
  }, [tabs])
  const tab = useMemo(() => tabs.find((item) => item.key === active) ?? tabs[0], [active, tabs])

  // ── Download PDF ──────────────────────────────────────────────────────────
  // Generates a real binary PDF file and triggers a browser download (anchor).
  // Does NOT open a print dialog. Does NOT open a new tab.
  async function downloadPdf() {
    if (!tab || downloading) return
    setDownloading(true)
    try {
      const { generatePdfBlob } = await import('@/services/pdf/pdfGenerator')
      const pdfBlob = await generatePdfBlob(tab.content)
      const filename = `${title.replace(/\s+/g, '_')}.pdf`
      console.log('[LoftDesk] PDF Download', {
        action: 'downloadPdf',
        isBlob: pdfBlob instanceof Blob,
        type: pdfBlob.type,
        size: pdfBlob.size,
        filename,
      })
      await downloadBlob(filename, pdfBlob)
    } catch (err) {
      console.error('[LoftDesk] PDF generation failed – falling back to HTML download', err)
      // Fallback so the user gets something even if the PDF renderer fails
      await downloadBlob(
        `${title.replace(/\s+/g, '_')}.html`,
        new Blob([tab.content], { type: 'text/html;charset=utf-8' }),
      )
    } finally {
      setDownloading(false)
    }
  }

  // ── Download XML ──────────────────────────────────────────────────────────
  function downloadXml() {
    if (!tab) return
    void downloadBlob(
      `${title.replace(/\s+/g, '_')}.xml`,
      new Blob([tab.content], { type: 'application/xml;charset=utf-8' }),
    )
  }

  // ── Print ─────────────────────────────────────────────────────────────────
  // Opens the browser print dialog. This is the ONLY action that calls print().
  // In Capacitor native, window.open popups are not supported — fall back to PDF download.
  function printCurrent() {
    if (!tab || tab.type !== 'html') return
    if ((window as any).Capacitor?.isNativePlatform?.()) {
      void downloadPdf()
      return
    }
    const win = window.open('', '_blank', 'width=960,height=720')
    if (!win) return
    win.document.write(tab.content)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      <div className="doc-preview">
        <div className="doc-preview__tabs">
          {tabs.map((item) => (
            <Button key={item.key} variant={item.key === tab?.key ? 'primary' : 'secondary'} size="sm" onClick={() => setActive(item.key)}>
              {item.label}
            </Button>
          ))}
          <div className="doc-preview__actions">
            {tab?.type === 'xml' ? (
              <Button size="sm" variant="secondary" onClick={downloadXml}>Pobierz XML</Button>
            ) : (
              <Button size="sm" variant="secondary" loading={downloading} onClick={downloadPdf}>
                {downloading ? 'Generowanie PDF…' : 'Pobierz PDF'}
              </Button>
            )}
            {tab?.type === 'html' ? <Button size="sm" variant="ghost" onClick={printCurrent}>Drukuj</Button> : null}
          </div>
        </div>
        {tab?.type === 'html' ? (
          <iframe className="doc-preview__frame" title={tab.label} srcDoc={tab.content} />
        ) : (
          <pre className="doc-preview__xml">{tab?.content}</pre>
        )}
      </div>
    </Modal>
  )
}
