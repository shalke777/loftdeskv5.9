# 10 — Addendum mobilny do polityki prywatności (iOS / Android)

**Wersja:** [WERSJA] | **Data:** [DATA WDROŻENIA] | **Status:** DRAFT.

Niniejszy addendum stanowi uzupełnienie głównej Polityki prywatności (`docs/legal/02-polityka-prywatnosci.md`) i ma zastosowanie wyłącznie do aplikacji mobilnych LoftDesk:
- **iOS:** App Store, bundle ID `pl.loftdesk.app`
- **Android:** Google Play, applicationId `pl.loftdesk.app`

---

## 1. Identyfikatory urządzenia

LoftDesk **nie korzysta** z:
- IDFA (Apple Advertising Identifier)
- AAID / `advertising_id` (Google Advertising ID)
- IDFV (Apple Identifier for Vendor) — nie jest aktywnie zbierany
- Fingerprintingu urządzenia

LoftDesk **wykorzystuje**:
- **Push token (FCM token na Android, APNs token na iOS)** — losowy ciąg generowany przez system operacyjny, służy wyłącznie wysyłce powiadomień push przez serwer LoftDesk. Token jest przechowywany w tabeli `device_tokens` (`supabase/migrations/166_device_tokens.sql`), powiązany z `user_id`. Podstawa: art. 6 ust. 1 lit. f RODO + zgoda systemowa (consent prompt OS).
- **Capacitor Preferences (sesja auth)** — token JWT Supabase przechowywany w iOS Keychain / Android SharedPreferences (`src/shared/lib/nativeAuthStorage.ts`). Podstawa: art. 6 ust. 1 lit. b RODO.

## 2. App Tracking Transparency (iOS)

LoftDesk **nie wymaga** ATT prompt (`AppTrackingTransparency`) — aplikacja nie korzysta z trackingu reklamowego ani SDK reklamowych. W odpowiedzi na App Store App Privacy questionnaire wskazujemy „Used for Tracking: NO".

## 3. Permissions (uprawnienia systemowe)

### iOS (`ios/App/App/Info.plist`)
| Klucz | Cel |
|---|---|
| `NSCameraUsageDescription` | Fotografowanie faktur i paragonów (moduł Koszty) — `parse-invoice` flow |
| `NSPhotoLibraryUsageDescription` | Wybór istniejących zdjęć faktur i dokumentów |
| `ITSAppUsesNonExemptEncryption=false` | Tylko standardowe HTTPS (wyjęte spod regulacji eksportowych USA) |

LoftDesk **nie wymaga**: lokalizacji (GPS), kontaktów, kalendarza, mikrofonu — w wersji v5.9 (uwaga: voice notes używają mikrofonu via WebRTC `getUserMedia` — wymaga `NSMicrophoneUsageDescription` przy aktywacji feature; do uzupełnienia w `Info.plist` przed publikacją).

### Android (`android/app/src/main/AndroidManifest.xml`)
| Permission | Cel |
|---|---|
| `INTERNET` | Komunikacja z backendem |
| `CAMERA` | Fotografowanie faktur (moduł Koszty) |
| `READ_EXTERNAL_STORAGE` | Wczytanie istniejących plików (Android < 13) |
| `WRITE_EXTERNAL_STORAGE` | Zapis pobranych plików (Android < 11; po Q irrelevant) |

LoftDesk **nie wymaga**: `ACCESS_FINE_LOCATION`, `READ_CONTACTS`, `RECORD_AUDIO` (do uzupełnienia jeśli aktywujemy voice notes na Android), `BLUETOOTH`, `READ_PHONE_STATE`.

> ⚠️ Voice notes feature wymaga **`RECORD_AUDIO`** (Android) i **`NSMicrophoneUsageDescription`** (iOS) — przed wdrożeniem na produkcję dodać manifesty.

## 4. Push notifications

### 4.1. Cel
Powiadomienia o:
- nowych wiadomościach od klientów w portalu
- akceptacjach/odrzuceniach dokumentów
- przypomnieniach o przeterminowanych fakturach

### 4.2. Subprocesorzy push
- **Apple Push Notification service (APNs)** — Apple Inc., USA — DPF aktywny
- **Firebase Cloud Messaging (FCM)** — Google LLC, USA — DPF aktywny + SCC

Token push jest przekazywany do FCM/APNs jako adresat wiadomości. **Treść powiadomień NIE zawiera danych osobowych klientów Użytkownika** (np. „Nowa wiadomość od klienta" — bez imienia, bez treści). Pełna treść jest dostępna dopiero po zalogowaniu w aplikacji.

### 4.3. Zgoda
Pierwsze uruchomienie aplikacji wyświetla systemowy prompt „LoftDesk chce wysyłać powiadomienia". Brak zgody = brak rejestracji tokena. Użytkownik może w każdej chwili wycofać zgodę:
- iOS: Ustawienia → LoftDesk → Powiadomienia
- Android: Ustawienia → Aplikacje → LoftDesk → Powiadomienia
- W aplikacji: Ustawienia → Powiadomienia → toggle off (po wdrożeniu P0-005)

Wycofanie zgody → usunięcie tokena z `device_tokens` (DELETE z RLS — `mig. 166`).

## 5. Dane offline / cache

Aplikacja PWA / mobilna cache'uje:
- Statyczne assety (Service Worker — `vite-plugin-pwa`, `public/sw.js`)
- Lista projektów / klientów (TanStack React Query persist — `@tanstack/react-query-persist-client`)
- Dokumenty PDF wygenerowane lokalnie (jspdf, html2canvas)

Dane offline są **szyfrowane przez system operacyjny** (iOS/Android stosują pełne szyfrowanie pamięci urządzenia gdy włączony PIN/biometria). LoftDesk nie szyfruje dodatkowo na poziomie aplikacji.

## 6. Universal Links / App Links

Aplikacja przejmuje linki `https://loftdesk.pl/*` (np. magic link, deep link do dokumentu) — weryfikacja przez:
- iOS: `apple-app-site-association` (hosted at `loftdesk.pl/.well-known/apple-app-site-association`)
- Android: `assetlinks.json` (hosted at `loftdesk.pl/.well-known/assetlinks.json`) + `autoVerify="true"` (`AndroidManifest.xml:36`)

Schemat custom `loftdesk://app` używany jest dla App Shortcuts (iOS Quick Actions, Android Shortcuts).

## 7. In-app purchases (IAP) — NIE stosowane

LoftDesk wykorzystuje **Stripe Checkout** dla wszystkich subskrypcji.

> ⚠️ **Krytyczne dla App Store review:** Apple Guideline 3.1.1 wymaga IAP dla cyfrowych dóbr/subskrypcji konsumenckich. LoftDesk jest **B2B SaaS dla przedsiębiorców** (zgodnie z `01-regulamin.md` § 2 wyłącznie B2B) — w takim wypadku Apple **dopuszcza** zewnętrzne płatności (Reader Rule + Business Apps exemption). Pozycjonowanie aplikacji w App Store musi to wyraźnie komunikować (kategoria „Business", opis aplikacji wskazujący na rejestrację z NIP). Patrz `12-tos-mobile-update.md` § IAP.

## 8. Dane dzieci

Aplikacja jest **B2B**, wymaga rejestracji z NIP-em, nie kieruje treści do osób poniżej 18 lat. W App Store: kategoria 17+ lub Business; w Google Play: Target audience = adults only.

## 9. Aktualizacje aplikacji

Aktualizacje krytyczne mogą wymagać update'u przed dalszym korzystaniem (force update flow — patrz `12-tos-mobile-update.md` § Wersjonowanie).

## 10. Kontakt

Sprawy ochrony danych w aplikacji mobilnej: **szalecki.p@gmail.com** (do migracji na `privacy@loftdesk.pl` przed produkcją).

---

*loftbau, Piotr Szalecki | NIP 8732958793 | bundle: pl.loftdesk.app*
