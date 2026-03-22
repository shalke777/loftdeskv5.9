// =============================================================================
// functions.ts — Netlify function URL resolver
// =============================================================================
// In web context (deployed on Netlify), relative paths /.netlify/functions/*
// resolve correctly because the app and functions share the same origin.
//
// In Capacitor native, the WebView serves the app from an internal local server
// (https://localhost on Android, capacitor://localhost on iOS), so relative paths
// would try to reach localhost instead of the Netlify production server.
//
// Solution: prefix with VITE_APP_URL when set (should always be set for native).
// In web builds without VITE_APP_URL, base = '' → relative paths work as before.
// =============================================================================

const _base = (import.meta.env.VITE_APP_URL as string | undefined ?? '').replace(/\/$/, '')

/**
 * Returns the full URL for a Netlify function.
 *
 * Examples:
 *   netlifyFn('parse-invoice')    → '/.netlify/functions/parse-invoice'       (web, no VITE_APP_URL)
 *   netlifyFn('parse-invoice')    → 'https://loftdesk.pl/.netlify/functions/parse-invoice'  (native)
 */
export const netlifyFn = (path: string): string => `${_base}/.netlify/functions/${path}`
