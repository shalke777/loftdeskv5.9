# CHECKBOXY, OŚWIADCZENIA I KOMUNIKATY DO CHECKOUT / REJESTRACJI

**Wersja:** [WERSJA]  
**Data wejścia w życie:** [DATA WDROŻENIA]  
**Dostawca:** loftbau, Piotr Szalecki | NIP: 8732958793 | szalecki.p@gmail.com  

*Dokument zawiera gotowe treści checkboxów, etykiet i komunikatów do wdrożenia na ekranie rejestracji konta oraz w procesie checkout (aktywacja płatnego planu).*

---

## 1. EKRAN REJESTRACJI KONTA

### 1.1. Wymagany checkbox — akceptacja regulaminu (OBOWIĄZKOWY, brak zaznaczenia = blokada rejestracji)

```
☐ Zapoznałem/am się z Regulaminem świadczenia usług LoftDesk [link] i akceptuję jego postanowienia.
```

### 1.2. Wymagany checkbox — zapoznanie z polityką prywatności (OBOWIĄZKOWY, brak zaznaczenia = blokada rejestracji)

```
☐ Zapoznałem/am się z Polityką prywatności LoftDesk [link], w tym z zasadami przetwarzania moich danych osobowych przez loftbau jako administratora danych.
```

### 1.3. Wymagany checkbox — oświadczenie B2B (OBOWIĄZKOWY, brak zaznaczenia = blokada rejestracji)

```
☐ Oświadczam, że rejestruję się jako przedsiębiorca w rozumieniu art. 43¹ Kodeksu cywilnego, 
  a korzystanie z LoftDesk jest bezpośrednio związane z moją działalnością zawodową lub 
  gospodarczą i ma dla mnie charakter zawodowy. Potwierdzam, że nie jestem konsumentem 
  w rozumieniu art. 22¹ Kodeksu cywilnego.
```

### 1.4. Wymagany checkbox — DPA / umowa powierzenia (OBOWIĄZKOWY gdy użytkownik będzie wprowadzał dane klientów, brak zaznaczenia = blokada rejestracji)

```
☐ Zapoznałem/am się z Umową powierzenia przetwarzania danych osobowych (DPA) [link] 
  i akceptuję jej postanowienia. Rozumiem, że pełnię rolę administratora danych osobowych 
  swoich klientów i kontrahentów wprowadzanych do Aplikacji.
```

### 1.5. Opcjonalny checkbox — komunikacja techniczna (OPCJONALNY — rekomendowany jako domyślnie zaznaczony, z możliwością odznaczenia)

```
☑ Zgadzam się na otrzymywanie na podany adres e-mail informacji o istotnych zmianach w Usłudze, 
  aktualizacjach regulaminu i komunikatów technicznych dotyczących Konta. 
  Komunikaty te są niezbędne do realizacji umowy i mogą być wysyłane nawet bez tej zgody.
```
*(Uwaga technicwo-prawna: komunikacja niezbędna do wykonania umowy — np. informacje o zmianach regulaminu, przerwach technicznych, nieudanych płatnościach — nie wymaga zgody marketingowej i może być wysyłana na podstawie art. 6 ust. 1 lit. b RODO. Ten checkbox ma charakter informacyjny / preferencyjny. Rekomendujemy nie blokować rejestracji przy braku jego zaznaczenia.)*

---

## 2. CHECKOUT — AKTYWACJA PLANU BUSINESS

### 2.1. Wymagany checkbox — auto-odnowienie i warunki płatności (OBOWIĄZKOWY, brak zaznaczenia = blokada zakupu)

```
☐ Rozumiem i akceptuję, że subskrypcja planu Business wynosi 119 zł brutto / miesiąc 
  i odnawia się automatycznie. Jestem uprawniony/a do rezygnacji w dowolnym momencie 
  ze skutkiem na koniec bieżącego okresu rozliczeniowego. Opłata za aktywny miesiąc 
  nie podlega zwrotowi.
```

### 2.2. Wymagany checkbox — zapoznanie z zasadami płatności i zwrotów (OBOWIĄZKOWY, brak zaznaczenia = blokada zakupu)

```
☐ Zapoznałem/am się z Zasadami płatności i subskrypcji [link], w tym z polityką 
  braku zwrotów za aktywny okres rozliczeniowy.
```

### 2.3. Powtórzenie oświadczenia B2B przy zakupie (OPCJONALNY — rekomendowany przy pierwszym zakupie; może być inkorporowany przez checkbox 1.3 z rejestracji)

```
☐ Potwierdzam, że zakup planu Business LoftDesk dokonywany jest w związku z moją 
  działalnością zawodową lub gospodarczą i ma dla mnie charakter zawodowy. 
  Nie działam jako konsument ani jako przedsiębiorca korzystający z ochrony 
  konsumenckiej (art. 385⁵ KC).
```

---

## 3. KOMUNIKATY / BLOKUJĄCE INFORMACJE (inline, wyświetlane na stronie)

### 3.1. Komunikat nad formularzem rejestracji (baner / nagłówek sekcji)

```
LoftDesk jest aplikacją przeznaczoną wyłącznie dla przedsiębiorców. 
Rejestrując konto, potwierdzasz, że działasz jako firma, nie jako osoba prywatna.
```

### 3.2. Komunikat w podsumowaniu koszyka / przed płatnością

```
Subskrypcja planu Business: 119 zł brutto / miesiąc

• Automatyczne odnowienie co miesiąc
• Rezygnacja skuteczna na koniec bieżącego okresu
• Brak zwrotu za aktywny okres po rezygnacji
• Operator płatności: Stripe

Płatność przetwarzana przez Stripe. LoftDesk nie przechowuje danych karty.
```

### 3.3. E-mail potwierdzający rejestrację (fragment treści)

```
Dziękujemy za rejestrację w LoftDesk.

Twoje konto zostało założone jako konto przedsiębiorcy. 
Regulamin, Polityka prywatności i DPA dostępne są pod adresem [DOMENA]/legal.

Jeśli masz pytania, skontaktuj się z nami: szalecki.p@gmail.com
```

### 3.4. E-mail potwierdzający aktywację planu Business (fragment)

```
Subskrypcja planu Business LoftDesk została aktywowana.

Plan: Business
Opłata: 119 zł brutto / miesiąc
Następne odnowienie: [DATA]
Operator płatności: Stripe

Aby zarządzać subskrypcją lub zrezygnować, przejdź do: [LINK DO PANELU]

Przypominamy: opłata za aktywny okres rozliczeniowy nie podlega zwrotowi.
```

---

## 4. WSKAZÓWKI IMPLEMENTACYJNE

### 4.1. Kolejność checkboxów

Rekomendowana kolejność na formularzu rejestracji:
1. Oświadczenie B2B (§ 1.3)
2. Regulamin (§ 1.1)
3. Polityka prywatności / klauzula RODO (§ 1.2)
4. DPA (§ 1.4)
5. Komunikacja e-mail (§ 1.5) — opcjonalny, ostatni

### 4.2. Logowanie zgód

System powinien rejestrować i przechowywać:
- datę i godzinę zaznaczenia każdego obowiązkowego checkboxa;
- wersję dokumentów, które Użytkownik zaakceptował (Regulamin, PP, DPA);
- adres IP i User-Agent w momencie rejestracji;
- adres e-mail powiązany z Kontem.

Dane te służą jako dowód zawarcia Umowy i złożenia oświadczenia B2B.

### 4.3. Linki w checkboxach

Wszystkie linki w checkboxach powinny otwierać się w nowej karcie (`target="_blank"`) i prowadzić do aktualnej, opublikowanej wersji dokumentów. Linki do wersji archiwalnych dokumentów są przechowywane dla celów dowodowych.

### 4.4. Aktualizacja checkboxów przy zmianie regulaminu

Przy kolejnym logowaniu po wejściu w życie zmienionego Regulaminu systempowinien wyświetlić Użytkownikowi ponowny komunikat z informacją o zmianie i wymaganą ponowną akceptacją (re-consent flow). Brak akceptacji może skutkować ograniczeniem dostępu do Konta do czasu akceptacji.

---

## 5. KLAUZULA INFORMACYJNA SKRÓCONA (do wyświetlenia obok formularza)

```
Administratorem Twoich danych osobowych jest Piotr Szalecki / loftbau, 
NIP: 8732958793, szalecki.p@gmail.com. 
Przetwarzamy dane w celu świadczenia usługi LoftDesk, obsługi konta i płatności. 
Pełna informacja RODO: [link do Polityki prywatności].
```

---

*Dostawca: loftbau, Piotr Szalecki | NIP: 8732958793 | szalecki.p@gmail.com*
