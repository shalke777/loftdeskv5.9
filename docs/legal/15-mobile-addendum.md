# ANEKS MOBILNY — APLIKACJA LOFTDESK NA iOS / ANDROID

**Wersja:** 1.0
**Data wejścia w życie:** [DATA WDROŻENIA]
**Dotyczy:** Aplikacji mobilnej LoftDesk dystrybuowanej przez App Store (Apple) i Google Play (Google), zbudowanej na bazie aplikacji web w technologii Capacitor.

---

## 1. ZAKRES

Niniejszy Aneks uzupełnia [Polityka prywatności](./02-polityka-prywatnosci.md) i [Regulamin](./01-regulamin.md) o regulacje specyficzne dla wersji mobilnej Aplikacji oraz o wymogi sklepów aplikacji:

- **Apple App Store Review Guidelines** — w szczególności pkt 5.1.1 (Data Collection and Storage), 5.1.1(v) (Account Sign-In/Account Deletion);
- **Google Play Developer Program Policies** — User Data Policy, Account Deletion Requirement (od kwietnia 2024).

---

## 2. UPRAWNIENIA SYSTEMOWE

Aplikacja prosi o następujące uprawnienia:

| Uprawnienie | Cel | Obowiązkowe |
|---|---|---|
| Powiadomienia push (APNs/FCM) | Powiadomienia operacyjne (komentarze klienta, statusy faktur) | Nie |
| Aparat | Skanowanie faktur (OCR) i robienie zdjęć dokumentacji projektowej | Nie |
| Mikrofon | Notatki głosowe i asystent AI | Nie |
| Galeria / Pliki | Załączanie dokumentów do projektów | Nie |
| Lokalizacja | **Nie używamy** | — |
| Kontakty | **Nie używamy** | — |

Wszystkie uprawnienia są opcjonalne i mogą być cofnięte w ustawieniach systemowych urządzenia.

---

## 3. PRZECHOWYWANIE DANYCH NA URZĄDZENIU

### 3.1. Tokeny uwierzytelniające

| Element | iOS | Android |
|---|---|---|
| Token sesji Supabase (JWT) | **Keychain** (zaszyfrowany sprzętowo, klasa `kSecAttrAccessibleAfterFirstUnlock`) | **EncryptedSharedPreferences** (Keystore-backed) przez Capacitor Preferences |
| Token KSeF (refresh + access) | Keychain | EncryptedSharedPreferences |
| Tokeny push (FCM/APNs) | Keychain | EncryptedSharedPreferences |
| Cache aplikacji (UI state, offline queue) | App Sandbox (chroniony przez iOS Data Protection) | App Sandbox |

**Uzasadnienie:** Tokeny **nie są** przechowywane w `localStorage` ani `sessionStorage` WebView, ponieważ pamięć WebView może być eksportowana w przypadku jailbreaku/roota. Przejście na Keychain/Keystore jest zgodne z OWASP MASVS-STORAGE-1.

### 3.2. Migracja z poprzednich wersji

Wersje 5.8 i wcześniejsze przechowywały tokeny w `localStorage`. Po aktualizacji do wersji 5.9 aplikacja **automatycznie i jednorazowo** migruje tokeny do bezpiecznej pamięci, po czym usuwa je z `localStorage`. Migracja jest transparentna dla Użytkownika i nie wymaga ponownego logowania.

---

## 4. POWIADOMIENIA PUSH

4.1. Aplikacja używa **Firebase Cloud Messaging (FCM)** dla Android i **Apple Push Notification service (APNs)** dla iOS.

4.2. Tokeny urządzeń są przechowywane w bazie Supabase w tabeli `device_tokens` (z RLS izolującym je per-user).

4.3. Treść powiadomień **nie zawiera** danych wrażliwych (kwoty faktur, NIP, treść wiadomości). Powiadomienia mają charakter sygnalizacyjny: "Masz nową wiadomość w projekcie X".

4.4. Tokeny push są **natychmiast usuwane** przy:
- wylogowaniu Użytkownika;
- usunięciu konta (etap purge);
- ręcznym wycofaniu zgody w ustawieniach urządzenia.

---

## 5. USUWANIE KONTA W APLIKACJI MOBILNEJ (App Store / Google Play)

Zgodnie z wymogami:
- **Apple** — Guideline 5.1.1(v) (od czerwca 2022): aplikacje umożliwiające założenie konta muszą umożliwiać jego usunięcie z poziomu aplikacji;
- **Google Play** — Account Deletion Requirement (od kwietnia 2024): wymaga linku do usunięcia konta w Data Safety oraz mechanizmu in-app.

**Implementacja w LoftDesk:**

5.1. Z poziomu aplikacji: **Ustawienia → Strefa zagrożenia → "Usuń moje konto"** — pełny self-service (3 kroki: opis konsekwencji → potwierdzenie e-mail → re-autoryzacja hasłem).

5.2. Z poziomu strony WWW: **[DOMENA]/account-deletion** — alternatywny URL publikowany w Google Play Data Safety i App Store Privacy (wymóg Google).

5.3. Po potwierdzeniu konto wchodzi w **30-dniowy okres ochronny** (możliwość anulowania) — szczegóły w [Polityka retencji](./09-polityka-retencji.md) §5.

5.4. **Dane podlegające archiwizacji prawnej** (faktury, KSeF, umowy) zachowywane są w trybie zanonimizowanym przez 5+1 lat (art. 74 ustawy o rachunkowości). Lista archiwizowanych kategorii widoczna w UI przed potwierdzeniem usunięcia.

---

## 6. EKSPORT DANYCH (RODO art. 20)

W aplikacji mobilnej dostępny jest pełny eksport ZIP z poziomu **Ustawienia → Strefa zagrożenia → "Eksportuj moje dane"**. Plik jest pobierany w przeglądarce systemowej (signed URL ważny 7 dni).

---

## 7. DANE GROMADZONE PRZEZ SDK STRON TRZECICH

Aplikacja mobilna integruje:

| SDK | Dostawca | Cel | Dane |
|---|---|---|---|
| Capacitor Core | Ionic | Most JS↔native | Wewnętrzne, brak transmisji |
| Capacitor Preferences | Ionic | Bezpieczna pamięć (Keychain/Keystore) | Lokalna |
| Capacitor Push Notifications | Ionic | Most do FCM/APNs | Token urządzenia |
| Sentry React Native (planowane) | Sentry | Monitoring crashów | UUID, stack trace (z PII scrubbingiem) |
| Firebase Cloud Messaging | Google | Push Android | Token rejestracyjny |
| APNs | Apple | Push iOS | Token urządzenia |

**Brak SDK reklamowych/marketingowych:** Aplikacja nie zawiera AdMob, Facebook SDK, AppsFlyer, Adjust, Branch, ani podobnych.

---

## 8. POSTĘPOWANIE PRZY DEZINSTALACJI

Dezinstalacja aplikacji **nie usuwa konta** ani danych po stronie serwera. Aby trwale usunąć dane, Użytkownik musi:
1. Zalogować się ponownie do aplikacji (web lub mobilnej) i wykonać procedurę z §5; **lub**
2. Skorzystać z formularza pod adresem [DOMENA]/account-deletion; **lub**
3. Wysłać wniosek na szalecki.p@gmail.com.

Po dezinstalacji bez aktywnego usunięcia konta — token push w `device_tokens` przestaje być odbierany przez urządzenie i jest usuwany automatycznie przy najbliższym nieudanym dostarczeniu (FCM/APNs zwracają błąd "unregistered").

---

## 9. KONTAKT

Wszelkie sprawy dot. aplikacji mobilnej — w tym wnioski o usunięcie konta, eksport danych, korekty: **szalecki.p@gmail.com**.

---

**Niniejszy aneks stanowi integralną część Polityki prywatności LoftDesk i jest aktualizowany wraz z aktualizacjami aplikacji w sklepach App Store / Google Play.**
