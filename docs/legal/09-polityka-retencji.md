# POLITYKA RETENCJI I USUWANIA DANYCH — LOFTDESK

**Wersja:** [WERSJA]  
**Data wejścia w życie:** [DATA WDROŻENIA]  
**Dostawca / Administrator:** loftbau, Piotr Szalecki | NIP: 8732958793 | szalecki.p@gmail.com  

---

## 1. CEL I ZAKRES

Niniejsza Polityka określa zasady retencji (przechowywania) i usuwania danych przetwarzanych w ramach Usługi LoftDesk, obejmując:
- Dane Użytkownika (konta, rozliczeniowe, logów, komunikacji) — przetwarzane przez Dostawcę jako administrator;
- Dane Klientów (dane kontrahentów i klientów Użytkownika) — przetwarzane przez Dostawcę jako podmiot przetwarzający.

---

## 2. RETENCJA DANYCH UŻYTKOWNIKA (ADMINISTRATOR)

| Kategoria danych | Podstawa | Okres retencji |
|-----------------|----------|----------------|
| Dane konta: e-mail, nazwa workspace | Wykonanie umowy | Do usunięcia konta, następnie do 30 dni w kopiach technicznych |
| Dane identyfikacyjne firmy (NIP, nazwa) | Obowiązek prawny (archiwizacja) | 5 lat od końca roku podatkowego, w którym zakończyła się współpraca |
| Historia płatności i faktury | Obowiązek prawny (rachunkowość, podatki) | 5 lat od końca roku podatkowego |
| Logi techniczne / bezpieczeństwa (IP, logowania, sesje) | Uzasadniony interes (bezpieczeństwo, dochodzenie roszczeń) | Maksymalnie 12 miesięcy od zdarzenia |
| Korespondencja reklamacyjna / support | Uzasadniony interes (obrona roszczeń) | 3 lata od zamknięcia sprawy |
| Dane do dochodzenia roszczeń | Uzasadniony interes | Do przedawnienia roszczenia (max 3 lata od dnia wymagalności) |

---

## 3. RETENCJA DANYCH KLIENTÓW (PODMIOT PRZETWARZAJĄCY)

| Sytuacja | Działanie |
|----------|-----------|
| Aktywna subskrypcja (Free lub Business) | Dane przechowywane w Aplikacji zgodnie z poleceniami Użytkownika |
| Downgrade do planu Free | Dane zachowane; dostęp do części funkcjonalności może być ograniczony |
| Rezygnacja z subskrypcji / zakończenie umowy | Dane dostępne przez resztę opłaconego okresu + max 30 dni po zakończeniu umowy |
| Usunięcie konta przez Użytkownika | Dane usuwane lub anonimizowane niezwłocznie, następnie usunięcie z kopii zapasowych w ciągu kolejnych 30 dni |
| Brak aktywności konta przez 24 miesiące na planie Free | Dostawca zastrzega prawo do usunięcia nieaktywnego konta po uprzednim powiadomieniu z 30-dniowym wyprzedzeniem |

---

## 4. EKSPORT DANYCH

4.1. Użytkownik może w dowolnym momencie wykonać eksport swoich danych (RODO art. 20) **samodzielnie** w aplikacji: **Ustawienia → Strefa zagrożenia → "Eksportuj moje dane"**.

4.2. System generuje paczkę ZIP zawierającą pliki JSON:
- `profile.json`, `company_members.json`
- `projects.json`, `estimates.json`, `estimate_items.json`
- `invoices.json`, `invoice_items.json`, `contracts.json`, `expenses.json`
- `threads.json`, `messages.json`
- `audit_events.json`, `device_tokens.json`
- `manifest.json` (wersja schematu, data, podstawa prawna art. 20 RODO)

4.3. Generacja jest asynchroniczna (background function, budżet do 15 minut). Po zakończeniu Użytkownik otrzymuje powiadomienie i może pobrać plik ze Storage (signed URL). Plik jest dostępny przez **7 dni**, następnie usuwany przez `cron-export-cleanup`.

4.4. Limit: **3 eksporty na 24 godziny** per Użytkownik (rate-limit zapobiega nadużyciom Storage).

4.5. Po zakończeniu Umowy lub usunięciu Konta eksport nie jest gwarantowany — Użytkownik powinien wykonać eksport **przed** złożeniem wniosku o usunięcie konta.

---

## 5. USUWANIE KONTA

5.1. Użytkownik może usunąć Konto **samodzielnie** w aplikacji: **Ustawienia → Strefa zagrożenia → "Usuń moje konto"**. Alternatywnie wniosek można przesłać na adres: szalecki.p@gmail.com z tytułem „USUNIĘCIE KONTA".

5.2. Po potwierdzeniu wniosku Konto wchodzi w **30-dniowy okres ochronny** (cooling-off). W tym okresie Użytkownik może anulować wniosek z poziomu aplikacji. Po upływie 30 dni codzienne zadanie cron (`cron-account-purge`, godz. 03:00 UTC) wykonuje fizyczne usunięcie:
- profil użytkownika — anonimizacja (e-mail, imię, nazwisko zastąpione placeholderami; user_id zachowane jako klucz obcy);
- powiązania z firmą (`company_members`) — soft-delete;
- dane efemeryczne (`device_tokens`, `notes`, `drafts`, `voice_*`, `ai_analysis_runs`, `rate_limits`) — hard-delete;
- pliki w Storage (avatary, voice notes) — usunięcie obiektów;
- sesje uwierzytelniania — globalne unieważnienie (`auth.signOut(scope=global)`);
- konto Supabase Auth — `auth.admin.deleteUser(soft=true)` z markerem `deleted_at`.

5.3. **Dane podlegające archiwizacji prawnej zostają zachowane** w trybie zanonimizowanym przez okres wymagany przepisami:
- Faktury, korekty, faktury KSeF: 5 lat od końca roku podatkowego (art. 86 § 1 Ordynacji podatkowej, art. 70 § 1 Ordynacji);
- Umowy, kontrakty: 5+1 lat (art. 74 ustawy o rachunkowości);
- Koszty (faktury zakupowe): 5 lat od końca roku podatkowego;
- Logi audytowe (`audit_events`): 12 miesięcy.

5.4. Usunięcie Konta jest **nieodwracalne** po upływie 30-dniowego okresu ochronnego. Dostawca nie odzyskuje Kont po wykonaniu cyklu purge.

5.5. **Edge case: jedyny właściciel firmy z innymi członkami.** Jeżeli Użytkownik jest jedynym właścicielem (`role='owner'`) firmy, w której są inni członkowie, system zwraca błąd 409 i wymaga przekazania własności (`/settings/team`) lub usunięcia firmy w pierwszej kolejności.

---

## 6. CYKLE I ZADANIA AUTOMATYCZNE (CRON)

| Zadanie | Harmonogram | Skutki |
|---|---|---|
| `cron-account-purge` | codziennie 03:00 UTC | Wykonuje purge dla wszystkich `account_deletion_requests` ze statusem `confirmed` i `scheduled_purge_at <= now()` |
| `cron-export-cleanup` | codziennie 04:00 UTC | Usuwa pliki ZIP eksportów starsze niż 7 dni; oznacza joby `queued`/`running` starsze niż 1 godz. jako `failed` |
| `check-overdue-invoices` | codziennie 08:30 UTC | Powiadomienia o przeterminowanych fakturach (powiązane z retencją powiadomień) |
| Sentry retention | konfigurowane po stronie Sentry | Zdarzenia błędów: 30 dni (free tier); breadcrumbs i performance: 24h |
| Netlify access logs | konfigurowane po stronie Netlify | Logi funkcji: 7 dni |

5.5. Usunięcie Konta na wniosek Użytkownika podczas obowiązywania opłaconej subskrypcji **nie uprawnia do zwrotu** proporcjonalnej Opłaty.

---

## 6. BACKUPY TECHNICZNE

6.1. Dostawca utrzymuje techniczne kopie zapasowe danych infrastruktury za pośrednictwem subprocesorów (Supabase). Backupy służą wyłącznie celom technicznym (disaster recovery) i stanowią wewnętrzne narzędzie infrastruktury.

6.2. Dostawca **nie gwarantuje** konkretnych parametrów punktu odtwarzania (RPO) ani czasu odtwarzania (RTO) na rzecz Użytkownika, o ile nie uzgodniono inaczej na piśmie.

6.3. Backupy techniczne nie są udostępniane Użytkownikom jako kanał dostępu do danych po rozwiązaniu Umowy lub po usunięciu Konta.

6.4. Dane Użytkownika i Dane Klientów są usuwane z kopii zapasowych automatycznie po upływie czasu retencji backupów (do 30 dni od usunięcia), o ile przepisy prawa nie wymagają dłuższego przechowywania.

---

## 7. DANE WYMAGANE PRZEZ PRAWO

7.1. Niezależnie od wniosków Użytkownika, Dostawca zachowuje dane w zakresie i przez czas wymagany przez obowiązujące przepisy prawa, w szczególności:
- Ustawę o rachunkowości (5 lat od końca roku obrotowego);
- Ordynację podatkową i przepisy o VAT (5 lat od końca roku podatkowego);
- Przepisy o KSeF (archiwizacja dokumentów zgodnie z wymogami podatkowymi).

7.2. Dane wymagane przez prawo są przechowywane przez Dostawcę wyłącznie jako administratora własnych danych rozliczeniowych (faktury, dane płatnicze). Obowiązek archiwizacji dokumentów generowanych przez Użytkownika w Aplikacji (faktur wystawionych przez Użytkownika, umów, wycen) spoczywa wyłącznie na Użytkowniku.

---

## 8. REJESTR CZYNNOŚCI PRZETWARZANIA

Dostawca prowadzi wewnętrzny rejestr czynności przetwarzania danych osobowych zgodnie z art. 30 RODO, obejmujący zarówno przetwarzanie jako administrator, jak i jako podmiot przetwarzający. Rejestr jest dostępny na żądanie organu nadzorczego.

---

*Dostawca: loftbau, Piotr Szalecki | NIP: 8732958793 | szalecki.p@gmail.com*
