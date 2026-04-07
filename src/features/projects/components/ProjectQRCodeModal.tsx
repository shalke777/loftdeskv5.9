// ProjectQRCodeModal — B4: QR kody pomieszczeń / projektu
// Generates QR code for client portal URL using qrserver.com (free, no key)
// Printable/downloadable card with project info
import { useState } from 'react'
import { QrCode, Download, Printer, X } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Button } from '@/shared/ui/Button/Button'

interface Props {
  projectId: string
  projectName: string
  projectNumber: string
  open: boolean
  onClose: () => void
}

const QR_SIZE = 200

function qrUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(data)}&format=png&ecc=M&margin=2`
}

export function ProjectQRCodeModal({ projectId, projectName, projectNumber, open, onClose }: Props) {
  const [downloading, setDownloading] = useState(false)

  const portalUrl = `${window.location.origin}/client/project/${projectId}`

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(qrUrl(portalUrl))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `QR-${projectNumber.replace(/[^a-z0-9]/gi, '-')}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  function handlePrint() {
    const printWindow = window.open('', '_blank', 'width=500,height=600')
    if (!printWindow) return
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <title>QR — ${projectName}</title>
  <style>
    @page { size: A5; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center; padding: 20px; }
    .card { border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; display: inline-block; max-width: 300px; }
    .logo { font-size: 18px; font-weight: 800; letter-spacing: -.5px; margin-bottom: 16px; }
    .number { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
    .name { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #111; }
    .qr img { width: 180px; height: 180px; }
    .hint { font-size: 11px; color: #9ca3af; margin-top: 12px; line-height: 1.5; }
    .url { font-size: 9px; color: #d1d5db; margin-top: 8px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">LoftDesk</div>
    <div class="number">${projectNumber}</div>
    <div class="name">${projectName}</div>
    <div class="qr"><img src="${qrUrl(portalUrl)}" alt="QR" /></div>
    <div class="hint">Zeskanuj aby sprawdzić dokumenty i postęp projektu</div>
    <div class="url">${portalUrl}</div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }</script>
</body>
</html>`)
    printWindow.document.close()
  }

  return (
    <Modal open={open} onClose={onClose} title="Kod QR projektu">
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        {/* QR image */}
        <div style={{
          display: 'inline-block',
          padding: 16,
          background: '#fff',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
          marginBottom: 16,
        }}>
          <img
            src={qrUrl(portalUrl)}
            alt="Kod QR projektu"
            width={QR_SIZE}
            height={QR_SIZE}
            style={{ display: 'block', borderRadius: 4 }}
          />
        </div>

        {/* Project info */}
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{projectNumber}</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{projectName}</div>

        {/* URL */}
        <div style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          background: 'var(--color-surface-soft)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: '6px 10px',
          wordBreak: 'break-all',
          marginBottom: 20,
          fontFamily: 'monospace',
        }}>
          {portalUrl}
        </div>

        {/* Description */}
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Klient skanuje kod QR i trafia bezpośrednio do portalu projektu.<br />
          Wydrukuj i umieść na budowie lub wyślij klientowi.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handlePrint}>
            <Printer size={14} style={{ marginRight: 4 }} />
            Drukuj kartę
          </Button>
          <Button variant="secondary" onClick={handleDownload} disabled={downloading}>
            <Download size={14} style={{ marginRight: 4 }} />
            {downloading ? 'Pobieranie…' : 'Pobierz PNG'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            <X size={14} style={{ marginRight: 4 }} />
            Zamknij
          </Button>
        </div>
      </div>
    </Modal>
  )
}
