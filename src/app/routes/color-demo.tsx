import { ColorPaletteDemo } from '@/features/settings/components/ColorPaletteDemo'
export function ColorDemoRoutePage() {
  if (import.meta.env.PROD) return <div style={{ padding: 32, color: '#888' }}>404 – Strona niedostępna</div>
  return <ColorPaletteDemo />
}
