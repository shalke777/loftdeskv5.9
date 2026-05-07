# 12 — Update regulaminu — wersja mobilna (DRAFT)

**Cel:** uzupełnienie regulaminu (`docs/legal/01-regulamin.md`) o postanowienia specyficzne dla aplikacji mobilnej (iOS/Android), wymagane przez App Store i Google Play.

---

## NOWY § 23 — APLIKACJA MOBILNA

### 23.1. Dostępność
1. LoftDesk jest dostępny w wersji aplikacji mobilnej dla systemów iOS (App Store, bundle ID `pl.loftdesk.app`) i Android (Google Play, applicationId `pl.loftdesk.app`).
2. Korzystanie z aplikacji mobilnej wymaga akceptacji niniejszego Regulaminu, Polityki prywatności oraz DPA — analogicznie jak w wersji webowej.
3. Aplikacja mobilna stanowi alternatywny kanał dostępu do tej samej Usługi (te same dane, te same Plany, ten sam workspace).

### 23.2. Wymagania techniczne
- iOS: minimum iOS 14.0
- Android: minimum API 23 (Android 6.0 Marshmallow)
- Aktywne połączenie internetowe (do większości funkcji)
- Konto w LoftDesk

### 23.3. Płatności i subskrypcje (krytyczne — App Store)
1. **LoftDesk jest usługą B2B przeznaczoną wyłącznie dla przedsiębiorców** (§ 2 Regulaminu).
2. Wszelkie płatności za płatne Plany są realizowane wyłącznie poprzez **Stripe** — zewnętrznego operatora płatności (§ 11 Regulaminu).
3. **W aplikacji mobilnej nie są stosowane płatności In-App Purchase (IAP)** Apple / Google Play. Zgodnie z polityką App Store (Guideline 3.1.3 — Reader Apps / Business Apps) oraz Google Play Payments Policy:
   - aplikacja udostępnia treści i funkcjonalności przedsiębiorcom (B2B);
   - Użytkownik dokonuje rejestracji z NIP-em jako podmiot prowadzący działalność gospodarczą;
   - opłata jest opłatą za usługę SaaS dla firmy (nie za cyfrowe dobro konsumenckie).
4. Subskrypcje, faktury, anulacje są zarządzane wyłącznie przez Stripe Customer Portal (`stripe-portal.ts`).
5. Apple/Google nie są stroną Umowy ani odbiorcą Opłat — żadne roszczenia płatnicze nie mogą być kierowane do nich.

### 23.4. Powiadomienia push
1. Aplikacja mobilna może wysyłać powiadomienia push (informacje o wiadomościach, akceptacjach, fakturach przeterminowanych).
2. Wymagana zgoda systemowa OS — Użytkownik może w każdym momencie wycofać zgodę przez ustawienia urządzenia lub w ustawieniach aplikacji.
3. Subprocesorzy push: Apple APNs, Google FCM (patrz Polityka subprocesorów).
4. Treść powiadomień nie zawiera danych klientów Użytkownika (tylko meta — np. „Nowa wiadomość od klienta").

### 23.5. Permissions
Lista uprawnień systemowych — patrz `docs/legal/audit/10-privacy-policy-mobile-addendum.md` § 3.

Użytkownik może w każdej chwili odebrać uprawnienia poprzez ustawienia OS. Niektóre funkcjonalności (skanowanie faktur, voice notes) mogą wówczas być niedostępne.

### 23.6. Wersjonowanie i aktualizacje (force update)
1. Dostawca ma prawo wymagać aktualizacji aplikacji mobilnej do najnowszej wersji jako warunku dalszego korzystania, w szczególności gdy:
   - poprzednia wersja zawiera krytyczne luki bezpieczeństwa;
   - następuje zmiana protokołów backendu niezgodna wstecz;
   - zmiana regulacyjna (np. KSeF) wymusza aktualizację.
2. Komunikat o wymaganej aktualizacji jest wyświetlany w aplikacji z linkiem do App Store / Google Play.
3. Nieaktualizacja powoduje brak dostępu do funkcjonalności do czasu aktualizacji.

### 23.7. Tryb offline
1. Aplikacja mobilna wspiera **ograniczony tryb offline** dla wybranych modułów (przeglądanie cache'owanych projektów, formularze do zsynchronizowania).
2. Dane wprowadzone offline są synchronizowane po przywróceniu połączenia.
3. Dostawca nie gwarantuje retencji danych offline w razie odinstalowania aplikacji bez wcześniejszej synchronizacji.

### 23.8. Odpowiedzialność App Store / Google Play
1. App Store i Google Play są wyłącznie kanałami dystrybucji aplikacji.
2. Apple Inc. / Google LLC nie ponoszą odpowiedzialności za działanie LoftDesk, treść danych ani relację umowną z Użytkownikiem.
3. Apple jest **third party beneficiary** Regulaminu (zgodnie z Apple App Store Licensed Application End User License Agreement) — Apple może egzekwować postanowienia Regulaminu wobec Użytkownika.

### 23.9. Apple App Store EULA
1. Korzystając z aplikacji LoftDesk pobranej z App Store Użytkownik akceptuje także standardową umowę EULA Apple (Licensed Application End User License Agreement) dostępną pod adresem: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
2. W razie sprzeczności postanowień Regulaminu LoftDesk z EULA Apple — pierwszeństwo mają postanowienia LoftDesk Regulaminu w zakresie B2B, z wyjątkiem postanowień regulujących technicznie korzystanie z urządzenia Apple.

### 23.10. Usunięcie konta z poziomu aplikacji
1. Zgodnie z wymogami App Store (Guideline 5.1.1(v)) i Google Play (Account Deletion Requirement) aplikacja mobilna udostępnia funkcję usunięcia konta z poziomu aplikacji.
2. Procedura: Ustawienia → Konto → Usuń konto → potwierdzenie.
3. Usunięcie jest nieodwracalne (zgodnie z `09-polityka-retencji.md` § 5).

### 23.11. Reklamacje
Reklamacje dotyczące aplikacji mobilnej kierowane do Dostawcy zgodnie z § 16 Regulaminu (procedura reklamacyjna). Reklamacje techniczne dotyczące samej dystrybucji w App Store / Google Play należy kierować odpowiednio do Apple / Google.

### 23.12. Beta-testing (TestFlight / internal testing)
1. Wersje testowe aplikacji mogą być udostępnione przed publikacją produkcyjną przez TestFlight (iOS) lub Internal Testing (Google Play).
2. Wersje testowe mogą być niestabilne; Dostawca nie odpowiada za utratę danych w wersjach beta.
3. Dostęp do wersji beta nie zwalnia z wymogu B2B.

---

## ZMIANA W § 11 — PŁATNOŚCI

Dodać ust. 11.X:

> 11.X. **Płatności w aplikacji mobilnej.** W aplikacji mobilnej iOS i Android płatności są realizowane wyłącznie przez Stripe Checkout — nie przez Apple In-App Purchase ani Google Play Billing. Jest to dopuszczone przez Apple App Store Review Guideline 3.1.3 (Reader Apps / Enterprise Apps) i Google Play Payments Policy z uwagi na charakter B2B Usługi (§ 2 Regulaminu). Operator App Store / Google Play nie jest stroną transakcji.

## ZMIANA W § 5 — KONTO I REJESTRACJA

Dodać ust. 5.X:

> 5.X. **Usunięcie konta.** Użytkownik może usunąć konto w dowolnym momencie:
> a) z poziomu aplikacji mobilnej (Ustawienia → Konto → Usuń konto);
> b) z poziomu aplikacji webowej (Ustawienia → Strefa krytyczna → Usuń konto);
> c) poprzez wniosek e-mail na adres `szalecki.p@gmail.com` z tytułem „USUNIĘCIE KONTA".
>
> Skutki usunięcia opisuje Polityka retencji (`09-polityka-retencji.md`).

---

## Procedura wdrożenia

1. Dodać § 23 do `docs/legal/01-regulamin.md`.
2. Bump wersji regulaminu do `2.0-mobile`.
3. Wymusić ponowną akceptację przez `LegalAcceptanceGate` przy pierwszym logowaniu po wdrożeniu (`legal_acceptances` rev).
4. W App Store Connect / Google Play Console wskazać nowy URL regulaminu (`https://loftdesk.pl/legal/regulamin`).
