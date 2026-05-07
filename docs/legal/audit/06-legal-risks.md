# 06 — Ryzyka prawne (Legal Risk Register)

| ID | Ryzyko | Podstawa prawna | Prawdopodobieństwo | Skutek | Mitigacja |
|---|---|---|---|---|---|
| R-01 | Brak DPIA dla AI parsing faktur i analizy zdjęć | Art. 35 RODO + EROD WP 248 | WYSOKIE | Kara PUODO do 4% obrotu | DPIA przed publikacją (P1-001) |
| R-02 | Transfer faktur klientów do OpenAI USA bez podstawy | Art. 44–49 RODO | WYSOKIE | Kara + roszczenia kontrahentów | Podpisać DPA z OpenAI + DPF + zaktualizować dokumenty (P0-001) |
| R-03 | Brak in-app deletion → odrzucenie z App Store | Apple Guideline 5.1.1(v) | PEWNE bez fix | Apka nie zostanie zatwierdzona | P0-003 |
| R-04 | KSeF token w localStorage → XSS | Ustawa o VAT, ustawa o KSeF | ŚREDNIE | Nieautoryzowane wystawienie/odbiór faktur | P1-003 |
| R-05 | Brak rejestru naruszeń (art. 33 RODO) | Art. 33 ust. 5 RODO | ŚREDNIE | Kara PUODO przy kontroli | P1-006 |
| R-06 | Push notifications bez consent | ePrivacy art. 5(3) + RODO 6.1.a | ŚREDNIE | Skarga + grzywna ePrivacy | Zgoda przy pierwszym requeście tokena |
| R-07 | Retencja vs prawo podatkowe (5+1 lat) | Ord. podatkowa, ust. o rachunkowości | NISKIE (prawne) / WYSOKIE (technical debt) | Brak możliwości obrony przy kontroli US | Cron retencji + wyjątki dla faktur (P1-002) |
| R-08 | Sentry breadcrumbs zawierają URL z querystring (np. tokeny) | Art. 32 RODO | ŚREDNIE | Wyciek tokenu/PII do Sentry | `beforeBreadcrumb` scrubber + `denyUrls` (P0-002) |
| R-09 | Voice notes mogą zawierać dane osób trzecich bez ich wiedzy | Art. 6 RODO + art. 13 (info dla podmiotu danych) | WYSOKIE | Brak podstawy → roszczenia | UI: „upewnij się, że nagrywani wiedzą"; klauzula info; opt-out (P1-007) |
| R-10 | Voice notes mogą rejestrować dane art. 9 (zdrowie pracowników na budowie) | Art. 9 RODO | NISKIE-ŚREDNIE | Kategoria szczególna bez podstawy | Zakaz w DPA + UI warning |
| R-11 | Brak MFA dla operatorów | Art. 32 RODO (środki adekwatne) | ŚREDNIE | Naruszenie przez phishing | TOTP z Supabase Auth (P1-008) |
| R-12 | IP logging deklarowany, brak transparentnej retencji | Art. 5.1.e | NISKIE | Argumentacja przy kontroli | Anonimizacja (last octet) + cron 12 mies. |
| R-13 | Copyright dokumentów generowanych (PDFy: regulamin, polityka) | Ustawa o pr. autorskim | NISKIE | Naruszenie wzorów obcych | Treści autorskie loftbau lub licencjonowane |
| R-14 | Brak procedury notyfikacji 72h (art. 33) | Art. 33 RODO | ŚREDNIE | Kara PUODO | Procedura w `08-security-policy.md` |
| R-15 | Brak weryfikacji wieku (B2B, ale brak gate) | Art. 8 RODO + KC dot. zdolności | NISKIE | Spór z konsumentem | Checkbox „działalność gospodarcza" już istnieje (mig. 031) |

---

## DPIA — wymagane przypadki

> Zgodnie z art. 35 RODO + Decyzja PUODO ws. listy operacji wymagających DPIA (Dz. Urz. UODO 2018):

### DPIA #1 — AI parsing faktur (HIGH RISK)
- **Operacja:** automatyczne przetwarzanie dokumentów księgowych (faktury) zawierających dane wielu kontrahentów Administratora przez podmiot zewnętrzny w państwie trzecim (OpenAI USA).
- **Kategorie ryzyka:** profilowanie/innowacyjne technologie, transgraniczność, dane finansowe, decyzje automatyczne (auto-extract = decyzja księgowa).
- **Wymagane elementy DPIA:**
  1. Opis operacji (`parse-invoice-ai.ts` flow + retencja w `ai_extraction_results`).
  2. Konieczność i proporcjonalność (alternatywa: ręczne wprowadzanie — uciążliwe).
  3. Ocena ryzyka (wyciek faktury, nieautoryzowany dostęp do treści, błędna ekstrakcja).
  4. Środki: SCC z OpenAI, opt-out trening modeli, szyfrowanie tranzytu, ograniczenie zakresu (tylko obraz/tekst, brak meta osobowych ponad to co na fakturze), audit log w `ai_governance_*`.
  5. Konsultacje z PUODO — nie wymagane, jeśli ryzyko residualne ≤ akceptowalne.

### DPIA #2 — OCR podpisów / signature graficzny (HIGH RISK)
- **Operacja:** zbieranie podpisów graficznych od klientów Użytkowników w celu akceptacji dokumentów. Pole gray-zone z art. 9 (biometria) — w doktrynie polskiej (URODO, GDD) podpis odręczny **nie jest** biometrią dopóki nie służy identyfikacji jednoznacznej, ale praktyka eIDAS/CJEU przemawia za ostrożnością.
- **Kategorie ryzyka:** dowodowy charakter, długa retencja (6 lat), dane osób trzecich (klientów Użytkownika), ryzyko fałszerstwa.
- **Wymagane elementy:**
  1. Klauzula info dla osoby podpisującej (art. 13).
  2. Hash dokumentu (`document_hash` SHA-256) + audit log (`signature_events`) — ✅ już zaimplementowane (mig. 072).
  3. Opcja podpisu kwalifikowanego (Autenti/mSzafir/Certum) — ✅ przewidziana w schemacie.

### DPIA #3 — voice notes z budów
- **Operacja:** nagrywanie głosu i transkrypcja przez Whisper (USA).
- **Ryzyko:** dane osób trzecich (rozmówca może nie wiedzieć), zawartość może obejmować art. 9 (zdrowie, opinie polityczne wypowiedziane przy okazji).
- **Mitigacja:** klauzula info w UI przed nagraniem, ograniczenie retencji.

---

## Transfery międzynarodowe — analiza per processor

| Processor | Region | Mechanizm | Status DPF (2023+) |
|---|---|---|---|
| Supabase | EU lub US | SCC | DPF aktywny (Supabase Inc. zarejestrowany) |
| Netlify | US | SCC | DPF aktywny |
| OpenAI | US | SCC + DPF | DPF aktywny od 2023 — **wymaga podpisanej DPA** |
| Stripe | IE primary, US fallback | SCC | DPF aktywny |
| Sentry | US lub UE (regional) | SCC | DPF aktywny — **rekomendacja: użyć regionu UE** |
| Resend | US | SCC | DPF — do weryfikacji |
| Google FCM | US | SCC | DPF aktywny |
| Apple APNs | US | SCC | DPF aktywny (Apple Inc. zarejestrowany) |

---

## Specyfika polska — KSeF

- **KSeF nie jest sub-processorem** w rozumieniu RODO — Ministerstwo Finansów RP jest niezależnym administratorem (art. 6 ust. 1 lit. c — obowiązek prawny).
- Faktury wysłane do KSeF są w jego retencji 10 lat (ustawa).
- Brak DPA wymaganego — relacja regulacyjna, nie umowna.
- Token KSeF (auth + session) ma cykl życia 1h (auth) / 2h (session) — **zaleca się przechowywanie wyłącznie w pamięci sesji, nie persistent localStorage** (R-04).

---

## Rejestr czynności przetwarzania (RoPA, art. 30) — **brak w repozytorium**

Wymagane (P1-006). Powinien zawierać:
- Nazwa i dane kontaktowe administratora/procesora
- Cele przetwarzania
- Kategorie osób i danych
- Kategorie odbiorców (incl. państwa trzecie)
- Terminy usunięcia
- Ogólny opis środków bezpieczeństwa (art. 32)

## Rejestr naruszeń (art. 33 ust. 5) — **brak**

Wymagane (P1-006). Forma: tabela Excel/Notion lub tabela `incident_log` w Supabase.
