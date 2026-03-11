# ZASADY BEZPIECZEŃSTWA I DOPUSZCZALNEGO UŻYCIA (AUP — ACCEPTABLE USE POLICY)

**Wersja:** [WERSJA]  
**Data wejścia w życie:** [DATA WDROŻENIA]  
**Dostawca:** loftbau, Piotr Szalecki | NIP: 8732958793 | szalecki.p@gmail.com  

---

## 1. CEL I ZAKRES

Niniejszy dokument określa zasady bezpiecznego i dopuszczalnego użycia Aplikacji LoftDesk przez Użytkowników (przedsiębiorców).

Zasady wskazane w niniejszym dokumencie są integralną częścią Regulaminu świadczenia usług LoftDesk i uszczegółowiają § 11 (Zakazane treści i niedopuszczalne użycie) oraz § 5 (Bezpieczeństwo konta) tego Regulaminu.

---

## 2. OBOWIĄZKI UŻYTKOWNIKA W ZAKRESIE BEZPIECZEŃSTWA

### 2.1. Dane dostępowe

a) Użytkownik jest zobowiązany do stosowania silnych, unikalnych haseł i aktualizowania ich w przypadku podejrzenia kompromitacji.

b) Dostawca rekomenduje włączenie mechanizmów dodatkowego uwierzytelniania (MFA/2FA), jeżeli są dostępne w Aplikacji.

c) Użytkownik nie może udostępniać danych logowania osobom trzecim, które nie są uprawnionymi użytkownikami Workspaceu.

d) Użytkownik odpowiada za wszelkie działania podjęte z poziomu jego Konta, niezależnie od tego, kto faktycznie je wykonał.

### 2.2. Urządzenia i środowisko

a) Użytkownik jest odpowiedzialny za bezpieczeństwo urządzeń, z których korzysta z Aplikacji, w tym za stosowanie aktualnego oprogramowania, oprogramowania antywirusowego i zapory sieciowej.

b) Dostawca nie odpowiada za szkody wynikające z korzystania z Aplikacji na urządzeniach niebezpiecznych, zainfekowanych lub niezabezpieczonych.

---

## 3. BEZWZGLĘDNIE ZAKAZANE DZIAŁANIA

Użytkownikowi zabrania się:

### 3.1. Ataki i naruszenia systemów

- Podejmowania prób nieuprawnionego dostępu do infrastruktury Dostawcy, systemów Supabase, Netlify, Stripe lub innych powiązanych systemów;
- Prób penetracji, skanowania podatności ani testów obciążeniowych Aplikacji bez pisemnej zgody Dostawcy;
- Ataków DoS/DDoS na infrastrukturę Aplikacji;
- Próby przechwycenia sesji innych użytkowników lub modyfikacji danych innych Workspaceów;
- Wykonywania reverse engineering, dekompilacji lub deasemblacji Aplikacji.

### 3.2. Niebezpieczne treści i dane

- Przesyłania, przechowywania lub przetwarzania złośliwego oprogramowania (wirusów, trojanów, ransomware, spyware, malware i podobnych);
- Wprowadzania danych mogących stanowić zagrożenie dla integralności infrastruktury (np. payloady SQL injection, XSS);
- Przechowywania danych szczególnych kategorii (art. 9 RODO) bez wyraźnego zakazu wskazanego w DPA;
- Udostępniania za pośrednictwem portalu klienta treści naruszających dobre imię osób trzecich, zabronionych przez prawo lub objętych tajemnicą.

### 3.3. Nadużycia infrastruktury

- Obchodzenia lub prób obejścia limitów technicznych narzuconych przez Plan (limit 3 dokumentów w planie Free);
- Tworzenia nadmiernej liczby kont w celu omijania limitów planu Free;
- Automatyzowania nadmiernych żądań do API Aplikacji w sposób istotnie obciążający infrastrukturę;
- Używania Aplikacji jako infrastruktury do rozsyłania spamu lub masowej komunikacji nieakceptowanej przez prawo;
- Odsprzedaży lub sublicencjonowania dostępu do Aplikacji.

### 3.4. Działania bezprawne

- Korzystania z Aplikacji w celu popełnienia czynu zabronionego, w tym m.in.: wystawiania fałszywych dokumentów finansowych, fikcyjnych faktur, oszustw podatkowych, prania pieniędzy, finansowania działalności terrorystycznej;
- Przetwarzania danych osób fizycznych bez właściwej podstawy prawnej (np. danych skradzionych lub uzyskanych w sposób bezprawny);
- Podszywania się pod inne podmioty w generowanych dokumentach;
- Naruszania tajemnic prawnie chronionych (tajemnica przedsiębiorstwa, tajemnica lekarska, tajemnica zawodowa) w sposób niezgodny z przepisami prawa.

---

## 4. ŚRODKI TECHNICZNE STOSOWANE PRZEZ DOSTAWCĘ

Dostawca stosuje następujące środki bezpieczeństwa:

| Środek | Opis |
|--------|------|
| Szyfrowanie transmisji | Całość komunikacji między przeglądarką a Aplikacją szyfrowana za pomocą TLS (HTTPS) |
| Szyfrowanie danych w spoczynku | Dane przechowywane w infrastrukturze Supabase z szyfrowaniem na poziomie bazy danych i storage |
| Uwierzytelnianie | Obsługiwane przez Supabase Auth (JWT, zarządzanie sesjami, tokeny odświeżania) |
| Izolacja danych | Dane workspace izolowane na poziomie logiki aplikacji i polityk RLS (Row Level Security) Supabase |
| Kontrola dostępu | Zasada minimalnych uprawnień — każdy użytkownik ma dostęp tylko do własnego Workspaceu |
| Monitoring | Logi dostępu i aktywności w infrastrukturze Netlify i Supabase |
| Zarządzanie zależnościami | Regularne przeglądy i aktualizacje używanych bibliotek |

---

## 5. INCYDENTY BEZPIECZEŃSTWA — RAPORTOWANIE

5.1. W przypadku wykrycia lub podejrzenia incydentu bezpieczeństwa dotyczącego Konta lub danych Użytkownik zobowiązany jest niezwłocznie poinformować Dostawcę na adres: **szalecki.p@gmail.com** z tytułem „[INCYDENT BEZPIECZEŃSTWA]".

5.2. Dostawca zobowiązuje się do potwierdzenia przyjęcia zgłoszenia i poinformowania Użytkownika o podjętych działaniach.

5.3. Użytkownik nie może we własnym zakresie prowadzić prób "samodzielnej naprawy" naruszenia bezpieczeństwa Aplikacji ani infrastruktury — wszelkie działania naprawcze podejmuje wyłącznie Dostawca.

---

## 6. KONSEKWENCJE NARUSZENIA AUP

6.1. Naruszenie zasad określonych w niniejszej Polityce może skutkować:
- natychmiastowym zawieszeniem lub usunięciem Konta;
- brakiem zwrotu Opłaty za naruszony Okres Rozliczeniowy;
- dochodzeniem odszkodowania przez Dostawcę;
- zawiadomieniem organów ścigania w przypadku podejrzenia popełnienia czynu zabronionego.

6.2. Dostawca zastrzega prawo do zachowania i przekazania odpowiednim organom wszelkich logów i informacji technicznych dokumentujących naruszenie.

---

## 7. BRAK ODPOWIEDZIALNOŚCI DOSTAWCY ZA BEZPIECZEŃSTWO DANYCH UŻYTKOWNIKA

7.1. Dostawca stosuje opisane środki bezpieczeństwa, jednak **nie może gwarantować absolutnej odporności** infrastruktury na ataki cybernetyczne, błędy oprogramowania stron trzecich ani zdarzeń leżących poza jego kontrolą.

7.2. Dostawca nie ponosi odpowiedzialności za incydenty bezpieczeństwa wynikające z:
- działań lub zaniechań Użytkownika (ujawnienie hasła, korzystanie z niezabezpieczonego urządzenia);
- ataków na infrastrukturę zewnętrzną (Supabase, Netlify, Stripe, operatorzy sieciowi);
- luk zero-day w oprogramowaniu stron trzecich;
- incydentów powstałych po stronie subprocesorów poza kontrolą Dostawcy.

---

*Dostawca: loftbau, Piotr Szalecki | NIP: 8732958793 | szalecki.p@gmail.com*
