# POLITYKA SUBPROCESORÓW / LISTA KATEGORII PODMIOTÓW PRZETWARZAJĄCYCH

**Wersja:** [WERSJA]  
**Data ostatniej aktualizacji:** [DATA WDROŻENIA]  
**Administrator / Podmiot przetwarzający:** loftbau, Piotr Szalecki | szalecki.p@gmail.com  

---

## 1. WPROWADZENIE

Zgodnie z art. 28 ust. 2 RODO oraz postanowieniami Umowy powierzenia przetwarzania danych (DPA) loftbau (Podmiot przetwarzający) korzysta z usług niżej wskazanych kategorii subprocesorów. Subprocesorzy przetwarzają dane wyłącznie w zakresie niezbędnym do świadczenia Usługi LoftDesk.

Aktualna lista subprocesorów jest dostępna publicznie pod adresem: **[LISTA SUBPROCESORÓW — URL]** i jest aktualizowana przed każdą istotną zmianą.

---

## 2. AKTUALNA LISTA SUBPROCESORÓW

| # | Podmiot | Siedziba | Kategoria usług | Lokalizacja przetwarzania | Mechanizm transferu poza EOG |
|---|---------|----------|-----------------|--------------------------|------------------------------|
| 1 | **Stripe, Inc.** / **Stripe Payments Europe, Ltd.** | USA / Irlandia | Obsługa płatności, fakturowanie subskrypcji | EOG (Irlandia) + USA | SCC + DPF |
| 2 | **Supabase, Inc.** | USA | Baza danych PostgreSQL, uwierzytelnianie, Storage (eksporty, załączniki, voice notes) | EOG (region Frankfurt) | SCC |
| 3 | **Netlify, Inc.** | USA | Hosting frontendu, Netlify Functions (edge runtime), CDN | USA / globalny CDN | SCC + DPF |
| 4 | **Sentry (Functional Software, Inc.)** | USA | Monitoring błędów aplikacji web i mobilnej, alerty produkcyjne | USA / EU region | SCC + DPF |
| 5 | **OpenAI, L.L.C.** | USA | Modele AI używane do analizy dokumentów (parser faktur OCR, asystent głosowy, ekstraktor danych projektowych); dane wejściowe **nie są używane do trenowania modeli** zgodnie z Enterprise Privacy Commitments OpenAI | USA | SCC |
| 6 | **GitHub, Inc.** (Microsoft) | USA | Repozytorium kodu źródłowego, CI/CD; **nie zawiera danych produkcyjnych** | USA | SCC + DPF |
| 7 | **Google LLC** / **Firebase Cloud Messaging (FCM)** | USA | Powiadomienia push na Android | USA | SCC + DPF |
| 8 | **Apple Inc.** / **APNs** | USA | Powiadomienia push na iOS | USA | SCC |
| 9 | **Google Workspace (Gmail)** | USA | Korespondencja support@/szalecki.p@gmail.com | USA / EOG | SCC + DPF |
| 10 | **Resend** (resend.com) | USA | Transakcyjne wiadomości e-mail (potwierdzenia, eksporty, alerty) | USA | SCC |

---

## 3. ZAKRES DANYCH PRZETWARZANYCH PRZEZ SUBPROCESORÓW

| Subprocesor | Dane administratora przetwarzane jako administrator | Dane klientów użytkownika przetwarzane jako procesor |
|-------------|--------------------------------------------------|------------------------------------------------------|
| Stripe | Adres e-mail konta, dane rozliczeniowe, historia płatności | Nie |
| Supabase | Dane konta, metadane aplikacji | Tak — Dane Klientów wprowadzone do Aplikacji (przechowywane w bazie danych) |
| Netlify | Logi dostępu (IP, User-Agent) | Pośrednio — dane przesyłane przez frontend |
| GitHub | Metadane kodu | Nie (repozytorium kodu nie zawiera danych produkcyjnych) |
| Google (Gmail) | Treść korespondencji e-mail (support) | Pośrednio — jeżeli treść korespondencji zawiera dane Klientów |

---

## 4. ŚRODKI OCHRONY I ZABEZPIECZEŃ STOSOWANE PRZEZ SUBPROCESORÓW

Każdy subprocesor objęty jest umowami zawierającymi klauzule dotyczące ochrony danych zgodne z art. 28 RODO. Dokumentacja compliance subprocesorów dostępna jest na ich stronach internetowych:

- Stripe: https://stripe.com/en-pl/legal/privacy-center
- Supabase: https://supabase.com/privacy
- Netlify: https://www.netlify.com/gdpr-ccpa
- GitHub: https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement
- Google: https://policies.google.com/privacy

---

## 5. MECHANIZM AKTUALIZACJI LISTY SUBPROCESORÓW

1. loftbau zobowiązuje się do aktualizacji niniejszej listy przed każdą planowaną zmianą dotyczącą subprocesorów, w szczególności przed:
   - dodaniem nowego subprocesora;
   - zastąpieniem istniejącego subprocesora innym;
   - istotną zmianą zakresu przetwarzania przez istniejącego subprocesora.

2. O planowanej zmianie loftbau powiadamia Administratorów (Użytkowników) drogą e-mail na adresy powiązane z kontami **co najmniej 30 dni** przed wejściem zmiany w życie.

3. Administrator, który zgłasza sprzeciw wobec nowego lub zmienionego subprocesora, powinien przesłać uzasadnione zastrzeżenie w terminie 14 dni od powiadomienia na adres: szalecki.p@gmail.com.

4. W przypadku nieuwzględnienia sprzeciwu przez loftbau Administrator ma prawo rozwiązać Umowę o świadczenie usług (i Umowę powierzenia) z zachowaniem 30-dniowego okresu wypowiedzenia.

5. Zmiany wymuszone przez sytuacje awaryjne (np. nagłe zaprzestanie działalności przez subprocesora, incydent bezpieczeństwa) mogą wymagać natychmiastowej zmiany subprocesora. W takim przypadku loftbau powiadomi Administratorów niezwłocznie, nie przekraczając 7 dni od dokonania zmiany, i zaproponuje możliwość rozwiązania Umowy jeśli zmiana jest dla Administratora nieakceptowalna.

---

## 6. TRANSFERY POZA EOG — SZCZEGÓŁY

Transfery danych osobowych poza Europejski Obszar Gospodarczy odbywają się wyłącznie na podstawie:

a) **Standardowych klauzul umownych (SCC)** przyjętych decyzją Komisji Europejskiej 2021/914 z dnia 4 czerwca 2021 r.;

b) **Decyzji o adekwatności** Komisji Europejskiej (tam gdzie ma zastosowanie, np. w odniesieniu do krajów uznanych za zapewniające odpowiedni poziom ochrony);

c) **Data Privacy Framework (DPF)** — dla podmiotów zarejestrowanych w programie UE-USA Data Privacy Framework.

loftbau dąży do minimalizowania transferów poza EOG i preferuje konfiguracje subprocesorów przetwarzających dane w granicach EOG, tam gdzie jest to technicznie i organizacyjnie możliwe.

---

*Dostawca: loftbau, PAWEŁ SZALECKI | NIP: 8732958793 | szalecki.p@gmail.com*
