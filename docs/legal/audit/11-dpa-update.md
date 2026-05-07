# 11 — Zmiany do DPA (DRAFT update)

**Cel:** uzupełnienie aktualnego DPA (`docs/legal/04-dpa-umowa-powierzenia.md`) o subprocesory i kategorie danych ujawnione przez audyt kodu.

**Forma wdrożenia:** dodać poniższe paragrafy / aneks do istniejącego DPA, zachowując numerację i § 1–10. Wymaga ponownego potwierdzenia przez Administratorów (Użytkowników) za pomocą `legal_acceptances` z nowym `version`.

---

## ZMIANA 1 — Aktualizacja § 2.2 (rodzaje danych osobowych)

Po dotychczasowej liście dodać:

> Zakres danych osobowych może obejmować dodatkowo:
> - **PESEL** klienta — jeżeli Administrator wprowadzi go w ramach modułu klientów (`clients.pesel` — mig. 125);
> - **dane biometryczne / podpis odręczny graficzny** — w przypadku korzystania z modułu akceptacji dokumentów (signature_pad), w postaci graficznego śladu podpisu zapisywanego w `signature_artifacts`;
> - **nagrania głosowe** — w przypadku korzystania z modułu notatek głosowych (voice notes), zawierające głos osoby nagrywającej i potencjalnie głosy osób trzecich (klientów Użytkownika, pracowników);
> - **zdjęcia z budów** — fotografie pomieszczeń i prac wykończeniowych, mogące zawierać wizerunki osób fizycznych;
> - **dane finansowe i podatkowe kontrahentów** — kwoty, NIP, numery faktur — przekazywane do Krajowego Systemu e-Faktur (KSeF) jako odrębnego administratora.

## ZMIANA 2 — Nowy § 2.4 (przetwarzanie z użyciem AI / OpenAI)

> 2.4. Administrator przyjmuje do wiadomości i akceptuje, że na jego polecenie (poprzez korzystanie z funkcji „Skanuj fakturę AI", „Analizuj zdjęcie pomieszczenia", „Notatka głosowa", „Asystent AI projektu") Podmiot przetwarzający przekazuje określone Dane Klientów do dostawcy usług AI:
> - **OpenAI, L.L.C.** (USA), 3180 18th Street, San Francisco, CA 94110
>
> Zakres przekazywanych danych obejmuje treść dokumentu (faktury, zdjęcia, transkrypcję nagrania) i może zawierać dane osobowe kontrahentów Administratora.
>
> Mechanizm transferu: Standardowe Klauzule Umowne (SCC) Komisji UE 2021/914 + EU-US Data Privacy Framework (Adequacy Decision Komisji UE z 10.07.2023). OpenAI L.L.C. zarejestrowana w DPF Self-Certification.
>
> Podmiot przetwarzający stosuje konfigurację OpenAI z **wyłączonym wykorzystywaniem danych do trenowania modeli** (zero data retention dla zatwierdzonych klientów Enterprise / domyślne ustawienie API od marca 2023).
>
> Pełna umowa DPA z OpenAI dostępna pod adresem: https://openai.com/policies/data-processing-addendum

## ZMIANA 3 — Nowy § 2.5 (telemetria błędów)

> 2.5. Podmiot przetwarzający stosuje narzędzie telemetrii błędów (Sentry — Functional Software, Inc.) w celu diagnozowania i naprawy usterek Aplikacji. Do Sentry przekazywane są:
> - identyfikator użytkownika (UUID),
> - identyfikator firmy (`company_id`),
> - rola, plan,
> - aktualna ścieżka aplikacji,
> - treść komunikatu błędu i stack trace.
>
> Treść formularzy, plików, faktur ani Danych Klientów nie jest przekazywana (`beforeSend` scrubber). Sentry działa w regionie UE (`*.ingest.de.sentry.io`).
>
> Podstawa: art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes — bezpieczeństwo i jakość usługi).

## ZMIANA 4 — Nowy § 2.6 (powiadomienia push)

> 2.6. Aplikacja mobilna LoftDesk korzysta z usług push notification firm trzecich:
> - **Apple Push Notification service (APNs)** — Apple Inc., USA — dla iOS;
> - **Firebase Cloud Messaging (FCM)** — Google LLC, USA — dla Android i web push.
>
> Do FCM/APNs przekazywany jest token urządzenia (random ID generowany przez OS) oraz tytuł powiadomienia. **Treść powiadomień nie zawiera Danych Klientów**.

## ZMIANA 5 — Aktualizacja § 6 (subprocesorzy) — pełna lista

Zastąpić odniesienie „Polityka subprocesorów" tabelą zaktualizowaną w `docs/legal/audit/03-third-party-processor-register.md` lub bezpośrednio:

| # | Subprocesor | Region | Cel | Mechanizm transferu |
|---|---|---|---|---|
| 1 | Supabase, Inc. | EU/US | infrastruktura DB + auth + storage | SCC |
| 2 | Netlify, Inc. | US | hosting + Functions BFF | SCC + DPF |
| 3 | Stripe, Inc. / Stripe Payments Europe Ltd. | IE/US | płatności | SCC |
| 4 | OpenAI, L.L.C. | US | AI parsing, transkrypcja | SCC + DPF |
| 5 | Sentry (Functional Software, Inc.) | UE preferowany | telemetria błędów | SCC |
| 6 | Resend, Inc. | US | transactional email | SCC + DPF |
| 7 | Google LLC (FCM) | US | push Android | SCC + DPF |
| 8 | Apple Inc. (APNs) | US | push iOS | SCC |
| 9 | Google LLC (Workspace) | US/EU | korespondencja support | SCC + DPF |
| 10 | GitHub, Inc. | US | repozytorium kodu (bez danych prod.) | SCC + DPF |

## ZMIANA 6 — Załącznik A (TOM — środki techniczne i organizacyjne)

Dodać jako Załącznik A do DPA:

### A.1. Środki techniczne
1. Szyfrowanie w tranzycie: TLS 1.2+ wymuszony.
2. Szyfrowanie w spoczynku: AES-256 (Supabase managed, AWS KMS).
3. Hasła: bcrypt (Supabase Auth managed).
4. JWT auth: HS256, refresh token rotation.
5. RLS PostgreSQL na każdej tabeli per `company_id`.
6. CSP: `default-src 'self'`, restrykcyjny `connect-src` whitelist.
7. HTTP headers: X-Frame-Options DENY, nosniff, Referrer-Policy strict-origin.
8. Permissions-Policy: camera/microphone tylko w aplikacji, geolocation wyłączone.
9. Stripe webhook signature verification.
10. Audit logging: `audit_logs`, `signature_events`, `ksef_events`.

### A.2. Środki organizacyjne
1. Zobowiązanie pracowników/współpracowników do tajemnicy.
2. Procedura incydentu 72h (`08-security-policy.md` § 7).
3. Rejestr czynności przetwarzania (RoPA, art. 30 RODO).
4. Rejestr naruszeń (art. 33 ust. 5 RODO).
5. Przegląd polityki bezpieczeństwa co 12 miesięcy.
6. Backup DB (Supabase PITR do 7 dni).
7. Polityka retencji (`09-polityka-retencji.md`) + cron retencji (P1-002).
8. Kontrola dostępu service-role: tylko Netlify Functions, nigdy w bundle frontend.
9. MFA (TOTP) — roadmap P1-008.

### A.3. Środki przewidziane (roadmap)
1. Pen-test zewnętrzny (P2-004).
2. ISO 27001 / SOC 2 Type II.
3. Bug bounty program.

## ZMIANA 7 — Aktualizacja § 7.1.b (zakres notyfikacji naruszenia)

Bez zmian zakresu, ale dodać klauzulę o procedurze 72h zgodnej z `08-security-policy.md`.

## ZMIANA 8 — Aktualizacja preambuły DPA

Dodać:
> Niniejsze DPA w wersji [WERSJA] zastępuje wszystkie wcześniejsze wersje DPA. Wymaga ponownej akceptacji przez Administratora — odnotowanej w tabeli `legal_acceptances` z `document_key='dpa'`, `version='[WERSJA]'`.

---

**Procedura wdrożenia:**
1. Wdrożyć zmiany w `docs/legal/04-dpa-umowa-powierzenia.md` jako wersja `2.0`.
2. Wysłać e-mail do wszystkich Administratorów z 30-dniowym wyprzedzeniem (DPA § 6.4 + procedura subprocesora).
3. W aplikacji wyświetlić `LegalAcceptanceGate` z nową wersją DPA przed pierwszym logowaniem po wdrożeniu.
4. Odrzucenie nowej wersji = możliwość rozwiązania umowy z 30-dniowym wypowiedzeniem.
