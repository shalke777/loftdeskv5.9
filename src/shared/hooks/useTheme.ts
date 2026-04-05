import { useCallback, useEffect, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'loftdesk-theme'

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function resolveTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.classList.toggle('dark', theme === 'dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#131610' : '#F5F0E8')
  }
}

// Shared state so all consumers stay in sync
let currentTheme: Theme = typeof window !== 'undefined' ? resolveTheme() : 'light'
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
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
  listeners.forEach(cb => cb())
}

// Apply on load
if (typeof window !== 'undefined') {
  applyTheme(currentTheme)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (!getStoredTheme()) {
        setThemeGlobal(mq.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeGlobal(theme === 'light' ? 'dark' : 'light')
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeGlobal(t)
  }, [])

  return { theme, toggleTheme, setTheme } as const
}
