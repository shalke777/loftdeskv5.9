/**
 * SignaturePadModal — touch/mouse canvas signature for on-device signing (D3)
 *
 * Uses signature_pad library. Mobile-first: works with finger on smartphone.
 * Returns dataURL PNG on save.
 */

import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { X, RotateCcw, Check } from 'lucide-react'
import { Modal } from '@/shared/ui/Modal/Modal'
import { Button } from '@/shared/ui/Button/Button'

interface Props {
  open: boolean
  title?: string
  label?: string          // e.g. "Podpis klienta"
  onSave: (dataUrl: string) => void
  onClose: () => void
}

export function SignaturePadModal({ open, title = 'Podpis', label, onSave, onClose }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const padRef      = useRef<SignaturePad | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  // Init signature_pad when modal opens
  useEffect(() => {
    if (!open) return
    // Small delay to ensure DOM is painted
    const tid = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      // Resize canvas to physical pixels for crisp rendering on HiDPI/Retina
      resizeCanvas(canvas)
      padRef.current = new SignaturePad(canvas, {
        penColor:        'var(--color-text, #111)',
        backgroundColor: 'rgba(0,0,0,0)',
        minWidth: 1.5,
        maxWidth: 3,
      })
      padRef.current.addEventListener('afterUpdateStroke', () => {
        setIsEmpty(padRef.current?.isEmpty() ?? true)
      })
      setIsEmpty(true)
    }, 80)

    return () => {
      clearTimeout(tid)
      padRef.current?.off()
      padRef.current = null
    }
  }, [open])

  // Also resize on window resize (orientation change on mobile)
  useEffect(() => {
    if (!open) return
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas || !padRef.current) return
      const data = padRef.current.toData()
      resizeCanvas(canvas)
      padRef.current.fromData(data)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [open])

  function handleClear() {
    padRef.current?.clear()
    setIsEmpty(true)
  }

  function handleSave() {
    if (!padRef.current || padRef.current.isEmpty()) return
    const dataUrl = padRef.current.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {label && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>{label}</p>
        )}

        {/* Canvas area */}
        <div style={{
          position: 'relative',
          border: '2px dashed var(--color-border)',
          borderRadius: 'var(--radius-md, 8px)',
          background: 'var(--color-surface)',
          overflow: 'hidden',
          cursor: 'crosshair',
          touchAction: 'none', // prevent page scroll while drawing
        }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: 180 }}
          />
          {isEmpty && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
              color: 'var(--color-text-muted)',
              fontSize: 13,
            }}>
              Narysuj podpis palcem lub myszą
            </div>
          )}
          {/* Signature line hint */}
          <div style={{
            position: 'absolute', bottom: 24, left: 24, right: 24,
            height: 1, background: 'var(--color-border)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={handleClear} disabled={isEmpty}>
            <RotateCcw size={14} style={{ marginRight: 4 }} />
            Wyczyść
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isEmpty}>
            <Check size={14} style={{ marginRight: 4 }} />
            Zatwierdź podpis
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function resizeCanvas(canvas: HTMLCanvasElement) {
  const ratio  = Math.max(window.devicePixelRatio || 1, 1)
  const rect   = canvas.getBoundingClientRect()
  canvas.width  = rect.width  * ratio
  canvas.height = rect.height * ratio
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.scale(ratio, ratio)
}
