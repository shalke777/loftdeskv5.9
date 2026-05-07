# LoftDesk Mobile Release Guide

End-to-end guide for publishing the LoftDesk Capacitor shell to **Apple App Store** and **Google Play**.

> Stack already in repo: Capacitor 8 · Vite · React 18 · Supabase · vite-plugin-pwa.
> See also: `capacitor.config.ts`, `android/keystore.properties.example`, `public/.well-known/`.

---

## 1. Build pipeline

```bash
# Web/PWA build (also used as the Capacitor webDir source)
npm run build

# Sync into native projects
npm run cap:sync

# One-shot (build → sync → open)
npm run mobile:android
npm run mobile:ios   # macOS + Xcode required
```

`.env.production` (gitignored) **must** contain:
```
VITE_APP_URL=https://loftdesk.pl
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon>
VITE_SENTRY_DSN=<optional>
```

---

## 2. File structure (mobile-relevant)

```
.
├── capacitor.config.ts                 # Capacitor app config (appId, plugins)
├── vite.config.ts                      # PWA manifest + injectManifest SW
├── public/
│   ├── icons/                          # PWA + Apple touch icons
│   ├── sw.js                           # Custom Service Worker
│   └── .well-known/
│       ├── apple-app-site-association  # iOS Universal Links (REPLACE TEAMID)
│       └── assetlinks.json             # Android App Links (REPLACE SHA256)
├── android/
│   ├── app/
│   │   ├── build.gradle                # Signing config (reads keystore.properties)
│   │   └── src/main/
│   │       ├── AndroidManifest.xml     # Intent filters: https + loftdesk://
│   │       └── res/                    # icons, splash, strings
│   ├── google-services.json            # FCM (gitignored, place manually)
│   ├── keystore.properties             # Signing secrets (gitignored)
│   └── keystore.properties.example     # Template
├── ios/App/
│   ├── App.xcodeproj/                  # Xcode project
│   └── App/Info.plist                  # Bundle, capabilities
└── src/shared/lib/
    ├── nativeAuthStorage.ts            # Supabase storage adapter (Preferences/localStorage)
    ├── nativeShell.ts                  # Splash hide, status bar, push init
    └── supabase.ts                     # Wires nativeAuthStorage into createClient
```

---

## 3. Android — release signing

### 3.1. Generate keystore (once)

```bash
keytool -genkey -v -keystore ~/.android-keystores/loftdesk-release.keystore \
  -alias loftdesk -keyalg RSA -keysize 2048 -validity 10000
```

Back up the keystore to **two separate locations**. Losing it = losing the ability to update the app on Play Store.

### 3.2. Configure local secrets

```bash
cp android/keystore.properties.example android/keystore.properties
# Edit absolute path, passwords, alias
```

### 3.3. Get SHA256 fingerprint (for App Links)

```bash
keytool -list -v -keystore ~/.android-keystores/loftdesk-release.keystore -alias loftdesk
```

Copy the **SHA256** line and paste it into `public/.well-known/assetlinks.json` (replace `REPLACE_WITH_RELEASE_KEYSTORE_SHA256_FINGERPRINT`). Redeploy `loftdesk.pl` so Google can verify it.

> **Play App Signing**: when you upload your first AAB, Google will re-sign with their own key. Use Play Console → *Setup → App Integrity* to read the **App signing key SHA256** and add it as a SECOND fingerprint in `assetlinks.json`. Without this, App Links will not auto-verify in production.

### 3.4. Build release AAB

```bash
npm run mobile:build
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Upload the AAB to Play Console → *Production → Create new release*.

### 3.5. Push (FCM)

1. Firebase Console → Add Android app → package `pl.loftdesk.app` → download `google-services.json`.
2. Place it at `android/app/google-services.json` (gitignored).
3. Already wired conditionally in `android/app/build.gradle`.

---

## 4. iOS — release

### 4.1. Open project

```bash
npm run mobile:ios   # macOS + Xcode required
```

### 4.2. Signing & capabilities

In Xcode → *Signing & Capabilities*:

- **Team**: select your Apple Developer team. Note the **Team ID** (10-char prefix).
- **Bundle Identifier**: `pl.loftdesk.app` (matches `capacitor.config.ts`).
- **Capabilities** (+):
  - **Push Notifications** (auto-creates an APNs key requirement).
  - **Associated Domains** → add `applinks:loftdesk.pl` and `applinks:www.loftdesk.pl`.
  - **Background Modes** → enable *Remote notifications*.

### 4.3. Replace TEAMID in AASA

Edit `public/.well-known/apple-app-site-association`, replace `TEAMID` with your Apple Team ID (e.g. `ABCDE12345.pl.loftdesk.app`). Redeploy `loftdesk.pl`.

Verify after deploy:
```bash
curl -I https://loftdesk.pl/.well-known/apple-app-site-association
# → must return Content-Type: application/json (already configured in netlify.toml)
```

### 4.4. APNs auth key (push)

Apple Developer → *Keys → +* → enable **Apple Push Notifications service (APNs)**. Download `.p8` once and upload to **Firebase Console → Project Settings → Cloud Messaging → Apple app configuration** (we use FCM as the unified push backend).

### 4.5. Archive and upload

Xcode → *Product → Archive* → *Distribute App* → *App Store Connect → Upload*.

App Store Connect → *TestFlight* (internal testing) → *App Store* (review submission).

---

## 5. Deep linking — verify after deploy

### iOS Universal Links
```bash
xcrun simctl openurl booted https://loftdesk.pl/auth/callback?code=test
# Should open the LoftDesk app, not Safari
```

### Android App Links
```bash
adb shell pm verify-app-links --re-verify pl.loftdesk.app
adb shell pm get-app-links pl.loftdesk.app
# Look for: loftdesk.pl: verified
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://loftdesk.pl/auth/callback?code=test" pl.loftdesk.app
```

### Supabase URL Configuration
In Supabase Dashboard → *Authentication → URL Configuration*, add to **Redirect URLs**:
```
https://loftdesk.pl/auth/callback
loftdesk://app/auth/callback
```

---

## 6. App Store / Google Play compliance checklist

### Both stores
- [ ] Privacy Policy URL (publicly accessible, mentions Supabase, Sentry, Stripe).
- [ ] Terms of Service URL.
- [ ] Account deletion path within the app (Apple requirement since June 2022; Google since 2024).
- [ ] No placeholder strings ("Lorem ipsum", "TODO") in any user-facing surface.
- [ ] Crash-free on first launch with no network.
- [ ] No private API usage (Apple), no protected permissions without disclosure (Google).
- [ ] App icon: no transparency, all sizes generated (use `@capacitor/assets` or App Icon Generator).
- [ ] Splash screen renders without flash-of-white (handled by `nativeShell.ts`).

### Apple App Store
- [ ] **App Privacy** questionnaire filled in App Store Connect (data collected: email, push token, usage data via Sentry).
- [ ] **App Tracking Transparency** (ATT) — not required if you don't track across apps. We don't, so set "Does not track" in App Privacy.
- [ ] **Sign in with Apple** — required if you offer any third-party social sign-in (Google/Facebook). LoftDesk uses email + magic link only → not required.
- [ ] **Demo account** for review (`reviewer@loftdesk.pl` + password) — provide in App Review Information.
- [ ] **In-App Purchase** — if Stripe billing is exposed inside the app for digital subscriptions, Apple may require IAP. Workaround: keep `/billing` route inaccessible from the iOS shell (hide CTA when `Capacitor.getPlatform() === 'ios'`) and direct users to web.
- [ ] **Permissions usage strings** in `Info.plist`: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSMicrophoneUsageDescription` (voice-to-estimate).
- [ ] **Encryption export compliance**: if you only use HTTPS/standard crypto, set `ITSAppUsesNonExemptEncryption=false` in `Info.plist`.

### Google Play
- [ ] **Data safety** form filled — same disclosures as Apple App Privacy.
- [ ] **Target API level** ≥ 34 (Play requirement for new releases as of Aug 2024).
- [ ] **Content rating** questionnaire (IARC).
- [ ] **Closed testing** with ≥12 testers for ≥14 days BEFORE personal-account apps can publish to production (2024 policy). Skip if publishing under an organization account.
- [ ] **Permissions justification** for `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` — modern targets should use Scoped Storage; consider removing these from `AndroidManifest.xml` if unused.
- [ ] **Screenshots**: at least 2 phone, 1 tablet (7" + 10") if tablet support claimed.
- [ ] **Feature graphic**: 1024×500 PNG.

---

## 7. Post-release monitoring

- Sentry: already wired (`initMonitoring()` in `main.tsx`). Set `VITE_SENTRY_DSN` in mobile `.env.production`.
- Supabase auth logs: monitor for spikes in failed `signInWithOtp` (could indicate broken Universal Link).
- Crash-free sessions target: ≥ 99.5% before submitting an update.

---

## 8. Quick troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Magic link opens browser, not app | AASA / assetlinks not served as `application/json`, or wrong Team ID / SHA256 | Verify with `curl -I`; check Apple's *AASA Validator*; Google's [Statement List Generator](https://developers.google.com/digital-asset-links/tools/generator) |
| User logged out on every relaunch (iOS) | localStorage evicted by WKWebView | Already handled via `nativeAuthStorage.ts` (Preferences) |
| Splash never disappears | `launchAutoHide=false` and `SplashScreen.hide()` never called | `nativeShell.ts` calls hide 250ms after mount; check console for errors |
| Push token not stored | User not yet authenticated when token arrives | `nativeShell.ts` reads `auth.getUser()` on `registration` event; user must log in first |
| App Links don't auto-verify on Android | Missing **Play App Signing** SHA256 in `assetlinks.json` | Add the second fingerprint from Play Console → App Integrity |
