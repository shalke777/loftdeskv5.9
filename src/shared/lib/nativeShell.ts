// =============================================================================
// Native shell bootstrap — runs once at app start when on Capacitor (iOS/Android).
// =============================================================================
// Responsibilities:
//   1. Hide the splash screen after React mounts (prevents flash-of-white).
//   2. Configure the status bar (overlay + theme color).
//   3. Register push notification handlers and persist device token in Supabase.
//
// All operations are no-ops on web. Failures are logged but never throw.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
  }
}

const isNative = (): boolean => {
  try { return Boolean(window?.Capacitor?.isNativePlatform?.()) } catch { return false }
}

export async function initNativeShell(supabase: SupabaseClient | null): Promise<void> {
  if (!isNative()) return

  // 1. Splash screen — hide after first paint.
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    // Small delay so the WebView has time to render first paint behind the splash.
    setTimeout(() => { void SplashScreen.hide({ fadeOutDuration: 200 }) }, 250)
  } catch (e) {
    console.warn('[native-shell] splash hide failed', e)
  }

  // 2. Status bar — match app theme.
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
    if (window.Capacitor?.getPlatform?.() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#202125' })
    }
  } catch (e) {
    console.warn('[native-shell] statusbar config failed', e)
  }

  // 3. Push notifications — register and persist token.
  if (supabase) {
    void initPushNotifications(supabase)
  }
}

async function initPushNotifications(supabase: SupabaseClient): Promise<void> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permStatus = await PushNotifications.checkPermissions()
    let receive = permStatus.receive
    if (receive === 'prompt') {
      const req = await PushNotifications.requestPermissions()
      receive = req.receive
    }
    if (receive !== 'granted') return

    await PushNotifications.register()

    PushNotifications.addListener('registration', async (token) => {
      try {
        const { data } = await supabase.auth.getUser()
        const userId = data.user?.id
        if (!userId) return
        const platform = window.Capacitor?.getPlatform?.() ?? 'unknown'
        await supabase.from('device_tokens').upsert(
          { user_id: userId, token: token.value, platform, updated_at: new Date().toISOString() },
          { onConflict: 'token' },
        )
      } catch (e) {
        console.warn('[push] persist token failed', e)
      }
    })

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('[push] registration error', err)
    })

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Foreground notification — could surface as in-app toast.
      console.info('[push] foreground notification', notification)
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      // User tapped notification. Use payload.url for deep navigation.
      const url = (action.notification.data as { url?: string } | undefined)?.url
      if (url) window.location.assign(url)
    })
  } catch (e) {
    console.warn('[push] init failed', e)
  }
}
