import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'ocean' | 'forest' | 'sunset'
export const ALL_THEMES: Theme[] = ['dark', 'ocean', 'forest', 'sunset']

/** Themes that require Tailwind's .dark class for dark: utilities */
const DARK_BASED: Theme[] = ['dark', 'ocean']

const STORAGE_KEY = 'loftdesk-theme'
const DEFAULT_THEME: Theme = 'dark'

function isValidTheme(v: string | null): v is Theme {
  return ALL_THEMES.includes(v as Theme)
}

function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    // Backward compat: old 'light' value maps to forest
    if (v === 'light') return 'forest'
    return isValidTheme(v) ? v : null
  } catch {
    return null
  }
}

function resolveTheme(): Theme {
  return getStoredTheme() ?? DEFAULT_THEME
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.setAttribute('data-theme', theme)
  html.classList.toggle('dark', DARK_BASED.includes(theme))
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const isDark = DARK_BASED.includes(theme)
    meta.setAttribute('content', isDark ? '#131610' : '#F5F0E8')
  }
}

// Shared state — all hook consumers stay in sync via useSyncExternalStore
let currentTheme: Theme = typeof window !== 'undefined' ? resolveTheme() : DEFAULT_THEME
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function getSnapshot(): Theme {
  return currentTheme
}

function setThemeGlobal(theme: Theme) {
  currentTheme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch { /* storage unavailable */ }
  applyTheme(theme)
  listeners.forEach(cb => cb())
}

// Apply on module load (before React renders) — prevents FOUC
if (typeof window !== 'undefined') {
  applyTheme(currentTheme)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (!getStoredTheme()) {
        setThemeGlobal(mq.matches ? 'dark' : 'forest')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    // Legacy toggle: dark ↔ forest
    setThemeGlobal(theme === 'dark' ? 'forest' : 'dark')
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeGlobal(t)
  }, [])

  return { theme, toggleTheme, setTheme } as const
}

