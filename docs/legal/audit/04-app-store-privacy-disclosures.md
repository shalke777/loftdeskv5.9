# 04 — Disclosures dla Apple App Store + Google Play

> Gotowe odpowiedzi do wklejenia w **App Store Connect → App Privacy** oraz **Google Play Console → Data safety**. Format dosłownie zgodny z formularzami platform.

---

## A. APPLE APP STORE — App Privacy questionnaire

> Pytanie startowe: *„Does this app collect any data?"* — **YES**.

### A.1. Data Types collected

Dla każdego typu zaznacz: **collected**, **linked to user**, **used for tracking**.

| Data Type | Collected | Linked to User | Used for Tracking | Purposes |
|---|---|---|---|---|
| **Contact Info → Email Address** | YES | YES | NO | App Functionality, Account Management |
| **Contact Info → Phone Number** *(jeśli klient wprowadza)* | YES | YES | NO | App Functionality |
| **Contact Info → Physical Address** *(adresy klientów wprowadzane przez Użytkownika)* | YES | YES | NO | App Functionality |
| **Contact Info → Name** | YES | YES | NO | App Functionality |
| **Contact Info → Other User Contact Info** *(NIP/REGON kontrahentów)* | YES | YES | NO | App Functionality |
| **Identifiers → User ID** *(Supabase user UUID, company_id)* | YES | YES | NO | App Functionality, Analytics (Sentry) |
| **Identifiers → Device ID** *(push token APNs)* | YES | YES | NO | App Functionality (notifications) |
| **Financial Info → Payment Info** *(via Stripe — tylko token, karta nie dotyka serwerów LoftDesk)* | YES | YES | NO | App Functionality, Purchases |
| **Financial Info → Other Financial Info** *(kwoty faktur, należności)* | YES | YES | NO | App Functionality |
| **User Content → Photos or Videos** *(zdjęcia faktur, pomieszczeń)* | YES | YES | NO | App Functionality |
| **User Content → Audio Data** *(notatki głosowe → Whisper)* | YES | YES | NO | App Functionality |
| **User Content → Customer Support** *(reklamacje, support)* | YES | YES | NO | App Functionality |
| **User Content → Other User Content** *(notatki, treści projektów, dokumenty)* | YES | YES | NO | App Functionality |
| **Diagnostics → Crash Data** *(Sentry)* | YES | YES *(user_id tag)* | NO | Analytics, App Functionality |
| **Diagnostics → Performance Data** *(Sentry tracesSampleRate 0.2)* | YES | YES | NO | Analytics |
| **Usage Data → Product Interaction** *(Sentry breadcrumbs — clicks, route changes)* | YES | YES | NO | Analytics |

### A.2. NIE zbieramy

| Data Type | Status |
|---|---|
| Health & Fitness | NOT COLLECTED |
| Location (Precise/Coarse) | NOT COLLECTED — `Permissions-Policy: geolocation=()` |
| Sensitive Info (race, religion, sexual orientation, political opinion, biometric ID, health) | NOT COLLECTED — DPA § 2.3 zakaz |
| Browsing History | NOT COLLECTED |
| Search History | NOT COLLECTED |
| Advertising Data | NOT COLLECTED |
| Contacts (książka adresowa) | NOT COLLECTED |
| Other Diagnostic Data | NOT COLLECTED |

### A.3. Tracking

> *„Do you or your third-party partners use data from this app to track users?"* — **NO**.

LoftDesk nie zbiera identyfikatora reklamowego (`advertising_id`, IDFA), nie integruje SDK marketingowych, nie linkuje danych z aplikacji z danymi z innych firm/aplikacji w celach reklamowych.

### A.4. Privacy Policy URL

`https://loftdesk.pl/legal/polityka-prywatnosci`

---

## B. GOOGLE PLAY — Data Safety form

### B.1. Data collected

| Category | Data type | Collected | Shared | Optional | Why? |
|---|---|---|---|---|---|
| Personal info | Name | YES | YES (Supabase, OpenAI) | NO | App functionality |
| Personal info | Email address | YES | YES (Supabase, Resend, Stripe) | NO | Account management, App functionality |
| Personal info | User ID | YES | YES (Supabase, Sentry) | NO | App functionality, Analytics |
| Personal info | Address | YES | YES (Supabase, OpenAI) | YES | App functionality |
| Personal info | Phone number | YES | YES (Supabase) | YES | App functionality |
| Personal info | Other info (NIP, REGON, dane firmy) | YES | YES (Supabase, KSeF, OpenAI) | NO | App functionality |
| Financial info | User payment info | YES | YES (Stripe) | NO | Purchases |
| Financial info | Purchase history | YES | YES (Stripe) | NO | Purchases |
| Financial info | Other financial info (faktury, koszty) | YES | YES (Supabase, OpenAI, KSeF) | NO | App functionality |
| Photos and videos | Photos | YES | YES (Supabase, OpenAI) | NO | App functionality |
| Audio | Voice or sound recordings | YES | YES (Supabase, OpenAI Whisper) | YES | App functionality |
| Files and docs | Files and docs | YES | YES (Supabase) | NO | App functionality |
| Messages | Other in-app messages (portal klienta) | YES | YES (Supabase) | NO | App functionality |
| App activity | App interactions | YES | YES (Sentry) | NO | Analytics |
| App activity | Other user-generated content | YES | YES (Supabase) | NO | App functionality |
| App info & performance | Crash logs | YES | YES (Sentry) | NO | Analytics |
| App info & performance | Diagnostics | YES | YES (Sentry) | NO | Analytics |
| Device or other IDs | Device or other IDs (FCM push token) | YES | YES (Google FCM) | NO | App functionality (notifications) |

### B.2. Security practices

- ✅ **Data is encrypted in transit** — TLS 1.2+ wymuszony (CSP `connect-src https://*`).
- ✅ **You can request that data be deleted** — *po wdrożeniu P0-003* (`delete-account` endpoint). Obecnie: tryb manualny przez e-mail (zgodnie z `09-polityka-retencji.md` § 5).
- ✅ **Independent security review** — N/A (do wdrożenia jako P2).
- ✅ **Committed to Play Families Policy** — N/A (B2B, nie dla dzieci).

### B.3. Privacy Policy URL

`https://loftdesk.pl/legal/polityka-prywatnosci`

### B.4. Data deletion URL

`https://loftdesk.pl/legal/usuniecie-konta` *(do utworzenia jako landing z opisem procedury + link do `mailto:szalecki.p@gmail.com?subject=USUNIĘCIE+KONTA`)*

---

## C. KRYTYCZNE UWAGI

1. **Bez wdrożenia in-app `delete-account` aplikacja zostanie odrzucona przez Apple** (Guideline 5.1.1(v) od czerwca 2022).
2. **Google Play wymaga URL-a do data deletion** — od grudnia 2023 obowiązkowy.
3. **Każda aktualizacja AI/Analytics SDK wymaga ponownego wypełnienia formularza** w obu sklepach.
4. Dane dzieci (Children's data): aplikacja jest **B2B (przedsiębiorcy)** — Apple Family / Google Families nie dotyczy. Mimo to opis w sklepie powinien wskazywać minimum 18+.
5. **„Optional vs required"** — w formularzu Google Play oznaczyć jako *optional* tylko te pola, których użytkownik faktycznie nie musi wprowadzać (telefon, adres, voice notes).
