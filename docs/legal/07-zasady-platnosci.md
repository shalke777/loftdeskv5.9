# ZASADY PŁATNOŚCI, SUBSKRYPCJI, AUTO-ODNOWIEŃ, ZMIAN PLANU I ZMIAN CEN

**Wersja:** [WERSJA]  
**Data wejścia w życie:** [DATA WDROŻENIA]  
**Dostawca:** loftbau, Piotr Szalecki | NIP: 8732958793 | szalecki.p@gmail.com  

*Dokument stanowi uszczegółowienie postanowień §§ 4–9 Regulaminu świadczenia usług LoftDesk.*

---

## 1. PLANY I OPŁATY

### 1.1. Dostępne plany

| Plan | Opłata | Tryb |
|------|--------|------|
| **Free** | 0 zł | Bezpłatny, limitowany |
| **Business** | **119 zł brutto / miesiąc** | Subskrypcja miesięczna, auto-odnawiana |

### 1.2. Limity planu Free

- Maksymalnie **3 dokumenty miesięcznie** łącznie (faktury + wyceny + umowy).
- Brak dostępu do płatnych modułów premium.
- Brak gwarancji SLA.

### 1.3. Plan Business

- Pełny dostęp do wszystkich modułów Aplikacji dostępnych na dzień aktywacji subskrypcji.
- Zakres może się zmieniać zgodnie z § 4 ust. 5 Regulaminu.

---

## 2. SUBSKRYPCJA I AUTO-ODNOWIENIE

### 2.1. Cykl rozliczeniowy

- Subskrypcja rozliczona jest **miesięcznie z góry**.
- Opłata pobierana jest przez Stripe w dniu aktywacji płatnego planu lub, przy odnowieniu, w dniu odpowiadającym tej dacie w każdym kolejnym miesiącu.

### 2.2. Automatyczne odnowienie

- Subskrypcja odnawia się **automatycznie** na kolejny miesiąc, jeżeli nie zostanie wypowiedziana zgodnie z § 2.3.
- Użytkownik wyraża zgodę na cykliczne obciążanie wskazanej metody płatności przez czas trwania aktywnej subskrypcji.
- Stosowne powiadomienie e-mail może być przesyłane przed pobraniem Opłaty (jako dobra praktyka, lecz nie jako warunek skuteczności pobrania).

### 2.3. Rezygnacja / wypowiedzenie subskrypcji

- Rezygnację składa się poprzez interfejs Aplikacji (panel subskrypcji) lub e-mailem na szalecki.p@gmail.com.
- Rezygnacja jest skuteczna **na koniec bieżącego Okresu Rozliczeniowego**, w którym ją złożono.
- Po zakończeniu opłaconego okresu Konto zostaje automatycznie przeniesione na plan Free.
- Rezygnacja złożona w dzień pobrania Opłaty: opłata za bieżący miesiąc **nie jest zwracana** — dostęp do Business trwa do końca opłaconego okresu.

---

## 3. PŁATNOŚCI — OPERATOR I METODY

### 3.1. Operator płatności

Wszystkie transakcje są obsługiwane przez **Stripe** (Stripe, Inc. / Stripe Payments Europe, Ltd.). Użytkownik akceptuje warunki usług Stripe w zakresie przetwarzania płatności.

### 3.2. Dostępne metody płatności

Metody płatności są zależne od konfiguracji Stripe i mogą obejmować karty płatnicze (Visa, Mastercard) oraz inne metody dostępne w danym regionie. Aktualna lista dostępna jest w procesie checkout.

### 3.3. Waluty

Opłaty są pobierane w **złotych polskich (PLN)**. W przypadku użycia metody płatności w innej walucie wszelkie koszty przewalutowania ponosi Użytkownik.

### 3.4. Bezpieczeństwo płatności

Dane kart płatniczych są przechowywane i przetwarzane wyłącznie przez Stripe. Dostawca nie przechowuje i nie ma dostępu do danych kart płatniczych Użytkownika.

---

## 4. NIEUDANA PŁATNOŚĆ I DOWNGRADE

### 4.1. Sekwencja przy nieudanej płatności

1. **Nieudana próba pobrania płatności:** Stripe może automatycznie ponowić próbę pobrania Opłaty zgodnie z własną konfiguracją (zazwyczaj do 3 prób w ciągu kilku dni).
2. **Po wyczerpaniu prób:** Konto zostaje automatycznie zdegradowane do planu Free.
3. **Downgrade:** natychmiastowe ograniczenie dostępu do funkcjonalności planu Business.
4. Dostawca nie jest zobowiązany do wcześniejszego powiadamiania o zbliżającym się pobraniu ani o nieudanej próbie, choć może to robić jako dobrą praktykę.

### 4.2. Konsekwencje downgrade

- Użytkownik **zachowuje dostęp do Konta** i danych w zakresie planu Free.
- Dokumenty przekraczające limity planu Free mogą stać się niedostępne do edycji (access read-only lub brak dostępu do historii powyżej limitu — zależnie od aktualnej implementacji).
- Dostawca **nie odpowiada** za skutki automatycznego downgrade'u w zakresie ciągłości pracy Użytkownika.

### 4.3. Przywrócenie dostępu

- Użytkownik może przywrócić dostęp do planu Business przez podanie lub aktualizację aktywnej metody płatności w panelu konta.
- Przywrócenie następuje od nowego Okresu Rozliczeniowego. Dostawca nie jest zobowiązany do proporcjonalnego naliczenia za okres, w którym dostęp był ograniczony wskutek nieudanej płatności.

---

## 5. ZMIANY PLANU

### 5.1. Upgrade (Free → Business)

- Użytkownik może w każdej chwili aktywować plan Business.
- Opłata za pierwszy pełny miesiąc jest pobierana natychmiast.
- Dostęp do funkcjonalności Business jest aktywowany niezwłocznie po potwierdzeniu płatności.

### 5.2. Downgrade (Business → Free)

- Użytkownik może samodzielnie zdegradować plan do Free (odpowiednik rezygnacji z subskrypcji, § 2.3).
- Downgrade jest skuteczny na koniec bieżącego Okresu Rozliczeniowego.
- Brak proporcjonalnego zwrotu za niewykorzystaną część miesiąca.

---

## 6. ZMIANY CEN

### 6.1. Procedura zmiany ceny

- Dostawca może zmienić cenę planu Business.
- Użytkownik jest powiadamiany o zmianie ceny na adres e-mail powiązany z Kontem **co najmniej 30 dni** przed wejściem nowej ceny w życie.
- Nowa cena obowiązuje od pierwszego Okresu Rozliczeniowego po dacie wejścia zmiany w życie.

### 6.2. Prawo do rezygnacji

- Jeżeli Użytkownik nie akceptuje nowej ceny, może wypowiedzieć Umowę przed datą wejścia zmiany w życie.
- Brak wypowiedzenia w tym terminie jest równoznaczny z akceptacją nowej ceny.

### 6.3. Promocje

- Dostawca może stosować ceny promocyjne, kody rabatowe i akcje czasowe.
- Promocje są stosowane do ceny normalnej według warunków konkretnej promocji.
- Zakończenie promocji nie jest zmianą ceny w rozumieniu § 6.1 i nie wymaga 30-dniowego powiadomienia.

---

## 7. ZWROTY — ZASADY SZCZEGÓŁOWE

### 7.1. Zasada ogólna: brak zwrotów

Opłaty wniesione za Plan Business nie podlegają zwrotowi, w szczególności:

- **Brak zwrotu za nieukończony Okres Rozliczeniowy** — rezygnacja w trakcie miesiąca nie generuje proporcjonalnego zwrotu.
- **Brak zwrotu za niewykorzystanie** — nieużywanie Aplikacji w danym miesiącu nie uprawnia do refundacji.
- **Brak zwrotu po downgrade** — zmiana na plan niższy w trakcie Okresu Rozliczeniowego nie generuje refundacji.

### 7.2. Wyjątki — przypadki rozpatrywanego zwrotu

Zwrot może być rozpatrzony wyłącznie w przypadku:

a) **Podwójnego pobrania** — tej samej kwoty za ten sam Okres Rozliczeniowy z tej samej metody płatności;

b) **Oczywistego błędu technicznego** po stronie Operatora lub Dostawcy skutkującego pobraniem kwoty innej niż wynikająca z aktualnego cennika (np. pobranie 1190 zł zamiast 119 zł);

c) **Pozytywnego rozpatrzenia reklamacji** — wyłącznie według uznania Dostawcy i w zakresie przez niego wskazanym.

### 7.3. Brak odpowiedzialności za koszty zewnętrzne

Dostawca nie ponosi odpowiedzialności za:
- opłaty bankowe i prowizje transakcyjne naliczone przez bank lub operatora karty;
- koszty przewalutowania;
- opóźnienia w zwrocie wynikające z czasu rozliczeń Stripe lub banku Użytkownika (standardowo 5–10 dni roboczych);
- koszty i opłaty wynikające z inicjowania nieuzasadnionego chargeback.

---

## 8. FAKTURY I DOKUMENTY ROZLICZENIOWE

- Dokumenty rozliczeniowe są generowane i dostarczane przez Stripe lub Dostawcę za pośrednictwem panelu Stripe.
- Użytkownik powinien podać poprawne dane firmy (NIP, adres) w trakcie rejestracji lub w ustawieniach konta, aby dokumenty rozliczeniowe były prawidłowe.
- Reklamacje dotyczące błędów na dokumentach rozliczeniowych należy zgłaszać w terminie **30 dni** od dnia wystawienia dokumentu.
- Dostawca nie jest zobowiązany do wystawiania korekt dokumentów za okresy przekraczające rok podatkowy lub gdy błędne dane zostały podane przez Użytkownika.

---

*Dostawca: loftbau, Piotr Szalecki | NIP: 8732958793 | szalecki.p@gmail.com*
