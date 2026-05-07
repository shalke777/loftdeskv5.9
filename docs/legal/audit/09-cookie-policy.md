# 09 — Polityka cookies i lokalnego storage (DRAFT zaktualizowany)

**Wersja:** [WERSJA]  
**Data wejścia w życie:** [DATA WDROŻENIA]  
**Podmiot odpowiedzialny:** loftbau, Piotr Szalecki, NIP 8732958793 | szalecki.p@gmail.com  
**Status:** DRAFT zastępujący `docs/legal/03-polityka-cookies.md` po przeglądzie kodu.

> Niniejsza wersja odzwierciedla **rzeczywisty** stan wykorzystania localStorage / sessionStorage / Capacitor Preferences w aplikacji (skan kodu listopad 2025).

---

## 1. Czym są pliki cookies i lokalne magazyny

LoftDesk korzysta z trzech kategorii lokalnego przechowywania danych:
- **HTTP cookies** — pliki ustawiane przez przeglądarkę
- **localStorage / sessionStorage** — magazyn API Web Storage przeglądarki
- **Capacitor Preferences** — natywny magazyn klucz-wartość na urządzeniu mobilnym (iOS Keychain / Android SharedPreferences) — stosowany **tylko w aplikacji mobilnej**

## 2. Zakres stosowania

Domena `loftdesk.pl` (i subdomeny), aplikacja PWA oraz aplikacje natywne LoftDesk (iOS, Android). Aplikacja **nie korzysta z plików cookies śledzących, analitycznych ani marketingowych**.

## 3. Kategorie stosowanych mechanizmów

### 3.1. Niezbędne — zawsze aktywne
Podstawa prawna: art. 6 ust. 1 lit. b RODO (wykonanie umowy) lub lit. f RODO (prawnie uzasadniony interes — bezpieczeństwo).

| Klucz / cookie | Mechanizm | Cel | Czas | Źródło w kodzie |
|---|---|---|---|---|
| `sb-<project>-auth-token` | localStorage (web) / Preferences (native) | Sesja Supabase Auth (JWT + refresh token) | Do wylogowania (rolling refresh) | `src/shared/lib/supabase.ts:13–22`, `src/shared/lib/nativeAuthStorage.ts` |
| `loftdesk.ksef.session.v2` | localStorage | Sesja KSeF (token Ministerstwa Finansów) | ≤ 2h (max session KSeF) | `src/features/ksef/hooks/useKsefSession.ts:58,103` ⚠️ planowana migracja P1-003 |
| `loftdesk.ksef.history` | localStorage | Historia wysyłek KSeF (do 300 rekordów) | Do wyczyszczenia ręcznie | `src/services/ksef/ksef.service.ts:406` |
| `loftdesk.ksef.received.v1` | localStorage | Faktury otrzymane KSeF (do 500) | Do wyczyszczenia ręcznie | `src/services/ksef/ksef.service.ts:380` |
| `loftdesk-cookie-notice-dismissed` | localStorage | Zapamiętanie zamknięcia banera | Trwale | `src/features/legal/components/CookieBanner.tsx:4` |
| `loftdesk.theme` | localStorage | Wybrany motyw (light/dark/system) | Trwale | `src/shared/hooks/useTheme.ts:58` |
| `loftdesk-invite-records` | localStorage | Pamięć intencji zaproszenia | 30 dni | `src/shared/lib/inviteIntent.ts:40` |
| `loftdesk-client-install-banner-dismissed` | localStorage | Zamknięcie bannera PWA install | Trwale | `src/features/client-portal/components/ClientInstallBanner.tsx:43` |
| `loftdesk-analysis-persisted` | localStorage | Cache wyniku analizy projektu (offline) | Do nadpisania | `src/features/expenses/components/ProjectAnalysisPage.tsx:88` |
| Stripe Checkout cookies | HTTP-only cookies (domena `js.stripe.com`) | Bezpieczeństwo formularza karty | Sesja płatności | Stripe — domena zewnętrzna |

### 3.2. Capacitor Preferences (natywne tylko)
Na iOS / Android sesja auth jest replikowana do natywnego magazynu (Keychain / SharedPreferences) z powodu agresywnej eviction localStorage przez WKWebView (`nativeAuthStorage.ts`). Mechanizm jest funkcjonalnym ekwiwalentem cookie auth — podstawa: art. 6 ust. 1 lit. b RODO.

### 3.3. Cookies analityczne — częściowo: Sentry
W produkcji aktywny jest **Sentry SDK** (`src/shared/lib/monitoring.ts:65`) — narzędzie do telemetrii błędów i wydajności. Sentry **nie ustawia cookies HTTP**, ale wysyła:
- error message + stack trace
- user_id (UUID Supabase)
- company_id, role, plan
- aktualną ścieżkę (route)
- breadcrumbs (kliknięcia, fetch URLs)

Próbkowanie wydajności: 20% transakcji w produkcji. Region: docelowo UE (`*.ingest.de.sentry.io`).

Podstawa prawna: art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes — diagnostyka i bezpieczeństwo aplikacji). Telemetria nie służy profilowaniu marketingowemu.

### 3.4. Cookies marketingowe / reklamowe — NIE stosowane
Aplikacja nie integruje Google Analytics, Meta Pixel, Hotjar, Mixpanel, ani innych narzędzi reklamowych/profilujących.

## 4. Podstawa prawna

| Kategoria | Podstawa |
|---|---|
| Niezbędne (sesja auth, KSeF token, preferencje UI) | art. 6 ust. 1 lit. b RODO |
| Bezpieczeństwo i diagnostyka (Sentry) | art. 6 ust. 1 lit. f RODO |
| Native storage (Capacitor Preferences) | art. 6 ust. 1 lit. b RODO + ePrivacy art. 5(3) wyjątek (niezbędne do świadczenia usługi żądanej przez użytkownika) |

## 5. Zarządzanie i wyłączenie

### 5.1. Web
Użytkownik może wyłączyć / wyczyścić localStorage przez ustawienia przeglądarki (DevTools → Application → Storage). Wyłączenie skutkuje koniecznością ponownego logowania i resetem preferencji.

### 5.2. Mobile
Czyszczenie magazynu natywnego: ustawienia systemowe → aplikacja LoftDesk → Wyczyść dane (Android) lub odinstaluj/zainstaluj (iOS — brak granularnej opcji).

### 5.3. Sentry opt-out
Brak per-user opt-out (telemetria niezbędna do diagnostyki). Po wdrożeniu P1: opcja w Settings → Prywatność → „Wyłącz telemetrię błędów" — wówczas `Sentry.close()`.

## 6. Brak banera „Akceptuj cookies"

Zgodnie z polskim wdrożeniem ePrivacy (Prawo Telekomunikacyjne art. 173) i wytycznymi PUODO:
- **Cookies niezbędne nie wymagają zgody** (zwolnienie).
- **Sentry jako narzędzie diagnostyczne** może być stosowany na podstawie art. 6 ust. 1 lit. f RODO bez zgody, pod warunkiem ujawnienia w polityce i braku wykorzystania do profilowania.
- Aplikacja wyświetla **baner informacyjny** (`CookieBanner.tsx`) — nie jest to baner zgody, lecz informacja zgodna z art. 13 RODO.

W razie wprowadzenia w przyszłości narzędzi analitycznych/marketingowych aktywujących cookies śledzące zostanie wdrożony **Consent Management Platform (CMP)** zgodny z TCF v2.2.

## 7. Kontakt

W sprawach plików cookies / lokalnego storage: **szalecki.p@gmail.com**.

---

*loftbau, Piotr Szalecki | NIP 8732958793 | szalecki.p@gmail.com*
