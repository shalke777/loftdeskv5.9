# POLITYKA PRYWATNOŚCI LOFTDESK

**Wersja:** [WERSJA]  
**Data wejścia w życie:** [DATA WDROŻENIA]  
**Administrator:** loftbau, Piotr Szalecki, ul. Słoneczna 2, Brzózówka, 33-140 Lisia Góra, NIP: 8732958793  
**Kontakt w sprawach ochrony danych:** szalecki.p@gmail.com  

---

## 1. WPROWADZENIE I ZAKRES STOSOWANIA

Niniejsza Polityka prywatności określa zasady przetwarzania danych osobowych przez loftbau (dalej: **Dostawca**) w związku ze świadczeniem usługi SaaS **LoftDesk** dostępnej pod adresem [DOMENA].

Polityka dotyczy wyłącznie danych osobowych przetwarzanych przez Dostawcę jako **administratora**, tj. danych Użytkowników konta, osób kontaktowych, osób kierujących zapytaniami i osób korzystających z serwisu.

**Dane Klientów Użytkownika** (dane kontrahentów i klientów Użytkownika wprowadzone do Aplikacji) przetwarzane są przez Dostawcę jako **podmiot przetwarzający** na zlecenie Użytkownika. W tym zakresie zastosowanie ma Umowa powierzenia przetwarzania danych (DPA) — odrębny dokument.

---

## 2. ADMINISTRATOR DANYCH OSOBOWYCH

Administratorem danych osobowych Użytkowników jest:

**Piotr Szalecki prowadzący działalność gospodarczą pod firmą loftbau**  
ul. Słoneczna 2, Brzózówka, 33-140 Lisia Góra  
NIP: 8732958793  
E-mail: szalecki.p@gmail.com  

---

## 3. DANE PRZETWARZANE JAKO ADMINISTRATOR

### 3.1. Dane konta i rejestracji

| Kategoria danych | Cel | Podstawa prawna | Okres retencji |
|-----------------|-----|-----------------|----------------|
| Adres e-mail użytkownika | Rejestracja konta, uwierzytelnianie, komunikacja, bezpieczeństwo | Art. 6 ust. 1 lit. b RODO (wykonanie umowy) | Do usunięcia konta + 30 dni backup |
| Nazwa firmy / workspace | Identyfikacja konta, świadczenie usługi | Art. 6 ust. 1 lit. b RODO | j.w. |
| NIP | Weryfikacja statusu przedsiębiorcy, fakturowanie | Art. 6 ust. 1 lit. b i c RODO | 5 lat od końca roku podatkowego (obowiązek archiwizacji) |
| Dane rozliczeniowe (przez Stripe) | Obsługa płatności, fakturowanie | Art. 6 ust. 1 lit. b RODO | Zgodnie z polityką Stripe + wymogi podatkowe |
| Adres IP, dane logowania, dane sesji | Bezpieczeństwo, zapobieganie nadużyciom, diagnoza | Art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes) | Do 12 miesięcy |
| Historia abonamentów i płatności | Obsługa umowy, rozliczenia, dokumentacja | Art. 6 ust. 1 lit. b i c RODO | 5 lat od końca roku podatkowego |

### 3.2. Dane kontaktowe (support, reklamacje)

| Kategoria danych | Cel | Podstawa prawna | Okres retencji |
|-----------------|-----|-----------------|----------------|
| Adres e-mail nadawcy | Obsługa korespondencji, wsparcie techniczne | Art. 6 ust. 1 lit. b lub f RODO | 3 lata od zamknięcia sprawy |
| Treść zgłoszenia | Diagnoza błędu, odpowiedź na reklamację | Art. 6 ust. 1 lit. b lub f RODO | 3 lata od zamknięcia sprawy |

### 3.3. Cele analityczne, monitoring błędów i bezpieczeństwo

Aplikacja korzysta z następujących narzędzi monitoringu i bezpieczeństwa, w których przetwarzane mogą być dane techniczne:

| Narzędzie | Cel | Przetwarzane dane | Podstawa prawna |
|---|---|---|---|
| **Sentry** (sentry.io) | Diagnostyka błędów aplikacji web i mobilnej, alerty produkcyjne | ID użytkownika (UUID), adres URL ścieżki (z usuniętymi parametrami wrażliwymi), stack trace, breadcrumbs zdarzeń UI — **bez** treści e-maili, NIP, PESEL, JWT, treści dokumentów (skrubowane przed wysyłką, patrz §9) | Art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes — bezpieczeństwo i niezawodność) |
| **Netlify Functions logs** | Logi techniczne backendu (kody błędów, czas odpowiedzi) | IP, ścieżka żądania, kod statusu, identyfikatory zdarzeń | Art. 6 ust. 1 lit. f RODO |
| **Audit log (audit_events)** | Wewnętrzny rejestr zdarzeń bezpieczeństwa (logowania, eksporty, usunięcia konta, zmiany roli) | user_id, company_id, typ zdarzenia, IP, user-agent, timestamp | Art. 6 ust. 1 lit. c i f RODO |

Dane wrażliwe (treść faktur, danych kontrahentów, hasła, tokeny) **nigdy nie są wysyłane do Sentry** — backend i frontend stosują automatyczny pre-filtr (PII scrubber) usuwający e-maile, NIP, PESEL, numery telefonów, JWT i parametry zapytań przed transmisją zdarzenia.

**Brak narzędzi marketingowych i reklamowych.** Aplikacja nie używa Google Analytics, Meta Pixel, ani podobnych. W przypadku ich wprowadzenia Polityka zostanie zaktualizowana, a wymagane zgody — pozyskane.

### 3.4. Push notifications i tokeny urządzeń (mobile)

W przypadku korzystania z aplikacji mobilnej (iOS/Android) Aplikacja przetwarza:

| Dane | Cel | Podstawa prawna | Okres |
|---|---|---|---|
| Token push (FCM/APNs) | Wysyłka powiadomień operacyjnych (np. nowy komentarz klienta) | Art. 6 ust. 1 lit. b RODO (wykonanie umowy) lub zgoda systemowa OS | Do wycofania zgody w ustawieniach urządzenia lub usunięcia konta |
| Identyfikator urządzenia (per-token) | Powiązanie tokena z kontem użytkownika | Art. 6 ust. 1 lit. b RODO | j.w. |

Tokeny przechowywane są w tabeli `device_tokens` z RLS izolującym je per-user. Tokeny push są usuwane natychmiast w momencie usunięcia konta.

### 3.5. Mobilna pamięć poświadczeń

Na urządzeniach mobilnych token sesji Supabase oraz tokeny KSeF przechowywane są w **iOS Keychain** (zaszyfrowanym sprzętowo) lub **Android Keystore-backed SharedPreferences** poprzez Capacitor Preferences, **nie** w `localStorage`. Zapewnia to ochronę przed ekstrakcją danych z urządzenia po jego utracie i zgodność z wymogami sklepów aplikacji (App Store Guideline 5.1.1, Google Play Data Safety).

---

## 4. DANE PRZETWARZANE JAKO PODMIOT PRZETWARZAJĄCY

W zakresie przetwarzania **Danych Klientów** (tj. danych kontrahentów, klientów i innych osób, których dane Użytkownik wprowadza do Aplikacji w ramach modułów projektów, faktur, wycen, umów, portalu klienta) Dostawca działa wyłącznie jako **podmiot przetwarzający** i przetwarza te dane wyłącznie zgodnie z udokumentowanymi poleceniami Użytkownika, na podstawie zawartej między stronami Umowy powierzenia przetwarzania danych (DPA).

Administratorem Danych Klientów i podmiotem odpowiedzialnym za ich prawidłowe przetwarzanie jest **Użytkownik**. Wszelkie prawa osób, których Dane Klientów dotyczą (dostęp, sprostowanie, usunięcie, sprzeciw itp.) należy kierować bezpośrednio do Użytkownika jako administratora.

---

## 5. ODBIORCY DANYCH

Dane osobowe przetwarzane przez Dostawcę jako administratora mogą być przekazywane następującym kategoriom odbiorców:

| Kategoria odbiorcy | Przykłady | Cel przekazania |
|-------------------|-----------|-----------------|
| Operator płatności | Stripe, Inc. / Stripe Payments Europe, Ltd. | Obsługa płatności i subskrypcji |
| Dostawca infrastruktury chmurowej | Supabase Inc. (serwery baz danych i uwierzytelniania) | Przechowywanie i przetwarzanie danych aplikacji |
| Dostawca hostingu | Netlify, Inc. | Hosting frontendu i funkcji serwerowych |
| Dostawca repozytorium kodu | GitHub Inc. | Zarządzanie kodem źródłowym |
| Dostawca usług e-mail / workspace | Google LLC / Google Workspace | Korespondencja mailowa (support) |
| Organy publiczne | ZUS, US, sądy, Policja | Na podstawie obowiązujących przepisów prawa |

Pełna lista kategorii subprocesorów wraz z mechanizmami transferowymi jest dostępna w dokumencie **Polityka subprocesorów** pod adresem [LISTA SUBPROCESORÓW — URL].

---

## 6. TRANSFERY DANYCH POZA EOG

Niektórzy dostawcy zewnętrzni, z usług których korzysta Dostawca, mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym. Podstawę prawną transferu stanowią w szczególności:

- Standardowe Klauzule Umowne (SCC) przyjęte przez Komisję Europejską (decyzja 2021/914);
- Decyzje o adekwatności Komisji Europejskiej tam, gdzie mają zastosowanie;
- Mechanizmy transferowe stosowane przez poszczególnych dostawców infrastruktury, opisane w ich dokumentacjach prawnych.

Dostawca stosuje i utrzymuje umowy z subprocesorami zawierające wymagane klauzule transferowe.

---

## 7. PRAWA OSÓB, KTÓRYCH DANE DOTYCZĄ

Osobom, których dane osobowe przetwarza Dostawca jako administrator, przysługują następujące prawa:

| Prawo | Podstawa | Uwagi |
|-------|----------|-------|
| Dostęp do danych (art. 15 RODO) | Art. 15 RODO | Dostawca udziela odpowiedzi w terminie do 30 dni |
| Sprostowanie danych (art. 16 RODO) | Art. 16 RODO | |
| Usunięcie danych (art. 17 RODO) | Art. 17 RODO | Self-service: Ustawienia → Strefa zagrożenia → "Usuń moje konto". Konto wchodzi w **30-dniowy okres ochronny** (możliwość anulowania), po którym dane operacyjne są usuwane, a dane podlegające archiwizacji (faktury, umowy, KSeF — art. 74 ustawy o rachunkowości) — anonimizowane i zachowane przez 5+1 lat. |
| Ograniczenie przetwarzania (art. 18 RODO) | Art. 18 RODO | |
| Przeniesienie danych (art. 20 RODO) | Art. 20 RODO | Self-service: Ustawienia → Strefa zagrożenia → "Eksportuj moje dane". Generowany jest plik ZIP (JSON) zawierający profil, projekty, wyceny, faktury, umowy, koszty, wątki portalu klienta, audit log. Link ważny 7 dni. |
| Sprzeciw (art. 21 RODO) | Art. 21 RODO | Wobec przetwarzania na podstawie prawnie uzasadnionego interesu |
| Cofnięcie zgody | Art. 7 ust. 3 RODO | Bez wpływu na zgodność przetwarzania przed cofnięciem |

Wnioski w zakresie praw należy kierować na adres: **szalecki.p@gmail.com**. Dostawca udziela odpowiedzi w terminie do 30 dni od dnia otrzymania wniosku, z możliwością przedłużenia do 90 dni przy skomplikowanych wnioskach (po uprzednim poinformowaniu wnioskodawcy).

---

## 8. PRAWO SKARGI DO ORGANU NADZORCZEGO

Osobie, której dane dotyczą, przysługuje prawo wniesienia skargi do organu nadzorczego właściwego dla jej miejsca zamieszkania lub miejsca naruszenia. W Polsce organem nadzorczym jest:

**Prezes Urzędu Ochrony Danych Osobowych (PUODO)**  
ul. Stawki 2, 00-193 Warszawa  
https://uodo.gov.pl

---

## 9. BEZPIECZEŃSTWO DANYCH

Dostawca stosuje techniczne i organizacyjne środki bezpieczeństwa odpowiednie do ryzyka przetwarzania, w tym w szczególności:

- Szyfrowanie danych w transmisji (TLS/HTTPS);
- Kontrola dostępu do danych na podstawie zasady minimalnych uprawnień;
- Monitorowanie bezpieczeństwa infrastruktury;
- Procedury tworzenia kopii zapasowych przez dostawcę infrastruktury (Supabase);
- Zarządzanie subprocesorami wymagające od nich odpowiednich środków bezpieczeństwa.

Dostawca nie może zagwarantować całkowitej odporności na ataki cybernetyczne ani na incydenty bezpieczeństwa leżące po stronie zewnętrznych dostawców infrastruktury.

---

## 10. COOKIES

Zasady stosowania plików cookies opisuje odrębna **Polityka cookies**, dostępna pod adresem [LINK DO COOKIES].

---

## 11. ZMIANY POLITYKI PRYWATNOŚCI

Dostawca zastrzega prawo do zmiany niniejszej Polityki. O istotnych zmianach dotyczących danych przetwarzanych jako administrator Dostawca poinformuje Użytkowników na adres e-mail powiązany z Kontem. Aktualna wersja Polityki jest zawsze dostępna pod adresem [LINK DO POLITYKI].

---

*Dostawca: loftbau, Piotr Szalecki | NIP: 8732958793 | szalecki.p@gmail.com*
