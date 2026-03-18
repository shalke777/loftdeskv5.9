// PortalNamePrompt — collected client name for legacy estimate portal.
// Not currently rendered in PortalPage.tsx — kept to satisfy the import.

interface Props {
  onSave?: (name: string) => void
}

/** @deprecated Not rendered. Import kept for backward compatibility. */
export function PortalNamePrompt({ onSave: _onSave }: Props) {
  return null
}
