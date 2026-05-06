/**
 * Re-export from the canonical useTheme hook.
 * Standalone utilities (initTheme, setTheme, getTheme) are included for
 * use outside of React (e.g., main.tsx, test scripts).
 * The module-level applyTheme call in useTheme.ts handles FOUC prevention.
 */

export type { Theme as ThemeName } from '@/shared/hooks/useTheme'
export { useTheme, ALL_THEMES } from '@/shared/hooks/useTheme'

/** No-op: theme is applied at module load in useTheme.ts (FOUC prevention built in). */
export function initTheme(): void {
  // Theme is resolved and applied synchronously when useTheme.ts is imported.
  // This function exists only to satisfy integration call sites (main.tsx).
}

