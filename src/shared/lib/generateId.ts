/**
 * Cross-browser UUID v4 generator.
 * Falls back to manual generation on iOS Safari < 15.4 and any env
 * where crypto.randomUUID is unavailable.
 */
export function generateId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof (crypto as Crypto).randomUUID === 'function'
  ) {
    return (crypto as Crypto).randomUUID()
  }
  // RFC4122 v4 fallback — works on all browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r =
      typeof crypto !== 'undefined' && crypto.getRandomValues
        ? (crypto.getRandomValues(new Uint8Array(1))[0] & (c === 'x' ? 15 : 3)) |
          (c === 'y' ? 8 : 0)
        : (Math.random() * 16) | 0
    return r.toString(16)
  })
}
