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
  useEffect(() => {
    setActive(tabs[0]?.key ?? 'preview')
  }, [tabs])
  const tab = useMemo(() => tabs.find((item) => item.key === active) ?? tabs[0], [active, tabs])

  function downloadCurrent() {
    if (!tab) return
    if (tab.type === 'xml') {
      downloadBlob(`${title.replace(/\s+/g, '_')}.xml`, new Blob([tab.content], { type: 'application/xml;charset=utf-8' }))
      return
    }
    // Use a hidden iframe to trigger the print dialog without opening a new window.
    // In the print dialog, choose "Zapisz jako PDF" / "Save as PDF".
    const blob = new Blob([tab.content], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style', 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:none;')
    iframe.src = url
    iframe.onload = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch {}
      setTimeout(() => { try { iframe.parentNode?.removeChild(iframe) } catch {}; URL.revokeObjectURL(url) }, 60_000)
    }
    document.body.appendChild(iframe)
  }

  function printCurrent() {
    if (!tab || tab.type !== 'html') return
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
            <Button size="sm" variant="secondary" onClick={downloadCurrent}>Pobierz {tab?.type === 'xml' ? 'XML' : 'PDF'}</Button>
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
