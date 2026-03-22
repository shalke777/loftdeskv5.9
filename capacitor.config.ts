import type { CapacitorConfig } from '@capacitor/cli'

// =============================================================================
// Capacitor configuration for LoftDesk iOS / Android native shell
// =============================================================================
// Build steps (requires macOS + Xcode for iOS):
//   1. npm run build             ← must have VITE_APP_URL=https://loftdesk.pl set
//   2. npx cap sync ios          ← copies dist/ into ios/App/App/public/
//   3. npx cap open ios          ← opens Xcode (macOS only)
//   4. In Xcode: select device → Run
//
// VITE_APP_URL — REQUIRED for native builds:
//   Create .env.production (gitignored) with:
//     VITE_APP_URL=https://loftdesk.pl
//   This ensures Netlify function URLs are absolute and Supabase auth redirects
//   point to the production server instead of capacitor://localhost.
//
// Auth deep links (magic link / OTP):
//   - For Universal Links (recommended production setup):
//     iOS: add Associated Domains entitlement (applinks:loftdesk.pl)
//          and host /.well-known/apple-app-site-association on loftdesk.pl
//   - Add https://loftdesk.pl/auth/callback in Supabase → Auth → URL Configuration
//
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
    // Keyboard: resize mode = "body" shifts the whole WebView when the soft keyboard
    // appears, which is the correct behavior for scroll-based forms on iPhone.
    // This prevents forms from being hidden under the keyboard.
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    // Future: SplashScreen, PushNotifications, Camera, etc.
  },
}

export default config
