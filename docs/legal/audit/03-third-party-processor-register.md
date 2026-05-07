# 03 — Rejestr subprocesorów (art. 28, 30 RODO)

> **STATUS:** zaktualizowany rejestr — należy zastąpić listę w `docs/legal/06-polityka-subprocesorow.md`.

| # | Processor | Rola | Dane przekazywane | Region przetwarzania | DPA / link | Mechanizm transferu (poza EOG) | Data dodania |
|---|---|---|---|---|---|---|---|
| 1 | **Supabase, Inc.** | sub-processor (infrastruktura) | wszystkie dane aplikacji (PII, faktury, pliki, sesje) | EU (Frankfurt) lub US — zależne od regionu projektu | https://supabase.com/legal/dpa | SCC (jeśli US) | data uruchomienia |
| 2 | **Netlify, Inc.** | sub-processor (hosting + Functions BFF) | logi requestów, body funkcji, IP, JWT (przelot) | US + globalny CDN (Cloudflare/AWS) | https://www.netlify.com/dpa/ | SCC + DPF | data uruchomienia |
| 3 | **Stripe, Inc.** / Stripe Payments Europe Ltd. | sub-processor (płatności) | e-mail Administratora, dane karty (z PCI tokenization), customer_id, kwoty, faktury subskrypcji | IE (EU) + US | https://stripe.com/legal/dpa | SCC | data uruchomienia |
| 4 | **OpenAI, L.L.C.** ⚠️ NOWY | sub-processor (AI parsing + transkrypcja) | treść faktur (PDF/obraz), zdjęcia z budów, transkrypcje głosu, fragmenty projektów; może zawierać NIP, nazwy, adresy klientów | US (api.openai.com) | https://openai.com/policies/data-processing-addendum | SCC + DPF (od 2023); domyślnie **brak** trenowania modeli na danych z API (zero-day retention dla zatwierdzonych klientów) | **DO USTALENIA** |
| 5 | **Sentry (Functional Software, Inc.)** ⚠️ NOWY | sub-processor (telemetria błędów) | error message, stack trace, URL, user_id (UUID), company_id, role, plan, route, breadcrumbs (kliknięcia, fetch URLs) | US (`*.ingest.sentry.io`) lub UE (`*.ingest.de.sentry.io`) — **rekomendacja: UE** | https://sentry.io/legal/dpa/ | SCC + DPF | **DO USTALENIA** |
| 6 | **Resend, Inc.** ⚠️ NOWY | sub-processor (transactional email) | adresat, treść wiadomości (zaproszenia, powiadomienia faktur), nazwa nadawcy | US | https://resend.com/legal/dpa | SCC + DPF | **DO USTALENIA** |
| 7 | **Google LLC (Firebase Cloud Messaging)** ⚠️ NOWY | sub-processor (push Android + ewentualnie web push) | device token, treść notyfikacji, metadane | US | https://firebase.google.com/terms/data-processing-terms | SCC + DPF | **AKTYWUJE SIĘ przy wdrożeniu push** |
| 8 | **Apple Inc. (APNs)** ⚠️ NOWY | sub-processor (push iOS) | device token, treść notyfikacji | US | https://www.apple.com/legal/privacy/data/en/apple-developer-program/ | SCC | **AKTYWUJE SIĘ przy wdrożeniu push** |
| 9 | **Ministerstwo Finansów RP (KSeF)** | odrębny administrator (publiczny) | XML faktur sprzedaży | PL | brak DPA — relacja regulacyjna (ustawa o VAT, ustawa o KSeF) | n/d (PL) | data uruchomienia |
| 10 | **GitHub, Inc. (Microsoft)** | tylko jako repozytorium kodu | kod źródłowy (bez danych produkcyjnych) | US | https://docs.github.com/en/site-policy/privacy-policies/github-data-protection-agreement | SCC + DPF | data uruchomienia |
| 11 | **Google LLC (Workspace / Gmail)** | sub-processor (e-mail support) | korespondencja support, e-mail Administratora | US/EU | https://workspace.google.com/terms/dpa_terms.html | SCC + DPF | data uruchomienia |

---

## Lista TOM (Technical & Organizational Measures) — zgodnie z art. 32 RODO

> Pełna lista do umieszczenia w załączniku do DPA. Skrót:

1. **Szyfrowanie w tranzycie:** TLS 1.2+ wymuszony (Netlify, Supabase, OpenAI, Stripe, KSeF) — sprawdzone w CSP `connect-src https://*`.
2. **Szyfrowanie w spoczynku:** Supabase Postgres + Storage szyfrowane na poziomie infrastruktury (AES-256, AWS KMS).
3. **Kontrola dostępu:** RLS PostgreSQL na każdej tabeli per `company_id` (mig. 002, 007, 022, 042, 132–145), funkcje `SECURITY DEFINER` z `search_path` ograniczeniem (mig. 058, 059, 080, 140–141).
4. **Multi-tenancy:** izolacja `my_company_id()` (mig. 080), wymuszona przez RLS — nie do obejścia z poziomu klienta.
5. **JWT validation:** wszystkie funkcje Netlify weryfikują Authorization Bearer (np. `parse-invoice-ai.ts:60`, `stripe-checkout.ts:56`); funkcje crony weryfikują przez schedule (Netlify gwarantuje wewnętrzny call).
6. **Stripe webhook signature:** `stripe.webhooks.constructEvent` z `STRIPE_WEBHOOK_SECRET` (`stripe-webhook.ts:150`).
7. **Service-role key:** używany **tylko** w Netlify Functions, nigdy w kliencie; ENV per Netlify deploy.
8. **Audit logging:** `audit_logs` (mig. 003), `signature_events` (mig. 072), `ksef_events` (mig. 136), `invite_accept_events` (mig. 146).
9. **Backup:** Supabase managed backups (PITR, do 7 dni dla planu Pro).
10. **MFA:** **NOT IMPLEMENTED** dla użytkowników aplikacji (Supabase Auth obsługuje TOTP — wymaga włączenia + UI w Settings → P1).
11. **Rate limiting AI:** `ai_rate_limits_persistent` (mig. 099), governance (`ai_governance_*` mig. 106–108).
12. **CSP:** `netlify.toml:51` — `default-src 'self'`, restrykcyjne `connect-src` z whitelistą domen.
13. **HTTP security headers:** X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin (`netlify.toml:46–50`).
14. **Permissions-Policy:** `camera=(self), microphone=(self), geolocation=()` — geo wyłączone.

---

## Procedura zmiany subprocesora (zgodnie z DPA § 6)

1. Powiadomienie Administratorów (Użytkowników) e-mailem **30 dni** przed zmianą.
2. Aktualizacja `06-polityka-subprocesorow.md` w repozytorium + tag wersji.
3. 14 dni na sprzeciw Administratora.
4. W razie sprzeciwu nieuwzględnionego — prawo do rozwiązania umowy z 30-dniowym wypowiedzeniem.
5. Wyjątek: zmiany awaryjne (incydent bezpieczeństwa) — powiadomienie ≤ 7 dni po fakcie.
