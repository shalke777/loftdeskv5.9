import { useState } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : initialValue
  })

  const setValuePersisted = (next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
      // Write synchronously so that window.location.assign() after this call
      // does not race against a useEffect flush.
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(resolved))
      }
      return resolved
    })
  }

  return [value, setValuePersisted] as const
}
