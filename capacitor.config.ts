import type { CapacitorConfig } from '@capacitor/cli'

// =============================================================================
// Capacitor configuration for LoftDesk iOS / Android native shell
// =============================================================================
// Build steps (after `npm run build`):
//   iOS:     npx cap add ios   → npx cap sync → npx cap open ios
//   Android: npx cap add android → npx cap sync → npx cap open android
//
// Auth deep links (magic link / OTP):
//   - For custom URL scheme interception set VITE_APP_URL=https://loftdesk.pl
//     and configure that URL in Supabase → Authentication → URL Configuration.
//   - For Universal Links (recommended production setup):
//     iOS:     add Associated Domains entitlement (applinks:loftdesk.pl)
//              and host /.well-known/apple-app-site-association on loftdesk.pl
//     Android: add Intent Filter + Digital Asset Links JSON on loftdesk.pl
//
// Server functions (Netlify):
//   Set VITE_APP_URL=https://loftdesk.pl in the native build env so that
//   all /.netlify/functions/* calls resolve to the production server.
// =============================================================================

const config: CapacitorConfig = {
  appId:   'pl.loftdesk.app',
  appName: 'LoftDesk',
  webDir:  'dist',

  server: {
    // Use https scheme on Android so cookies/localStorage behave like a real HTTPS origin
    androidScheme: 'https',
    // Allow WebView to make API calls to the production server
    allowNavigation: ['*.loftdesk.pl', '*.supabase.co'],
  },

  plugins: {
    // Future: push notifications, camera, etc. go here
  },
}

export default config
