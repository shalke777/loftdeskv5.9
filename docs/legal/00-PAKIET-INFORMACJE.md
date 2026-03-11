# Pakiet dokumentów prawnych — LoftDesk SaaS

**Draft przygotowany:** 2026-03-11  
**Przeznaczenie:** produkcja po weryfikacji przez prawnika  
**Prawo właściwe:** polskie  
**Model:** wyłącznie B2B  

---

## Lista dokumentów w pakiecie

| Nr | Plik | Dokument |
|----|------|----------|
| 01 | `01-regulamin.md` | Regulamin świadczenia usług SaaS LoftDesk |
| 02 | `02-polityka-prywatnosci.md` | Polityka prywatności (RODO) |
| 03 | `03-polityka-cookies.md` | Polityka cookies |
| 04 | `04-dpa-umowa-powierzenia.md` | Umowa powierzenia przetwarzania danych osobowych (DPA) |
| 05 | `05-klauzule-informacyjne-rodo.md` | Klauzule informacyjne RODO |
| 06 | `06-polityka-subprocesorow.md` | Polityka subprocesorów / lista kategorii |
| 07 | `07-zasady-platnosci.md` | Zasady płatności, subskrypcji i auto-odnowień |
| 08 | `08-procedura-reklamacyjna.md` | Procedura reklamacyjna |
| 09 | `09-polityka-retencji.md` | Polityka retencji i usuwania danych |
| 10 | `10-zasady-bezpieczenstwa-aup.md` | Zasady bezpieczeństwa i dopuszczalnego użycia (AUP) |
| 11 | `11-force-majeure.md` | Klauzula siły wyższej |
| 12 | `12-umowa-ramowa-b2b.md` | Wzór umowy ramowej B2B / enterprise |
| 13 | `13-nda.md` | Umowa o zachowaniu poufności (NDA) |
| 14 | `14-checkboxy-checkout.md` | Checkboxy, oświadczenia i komunikaty do checkout/rejestracji |

---

## Kluczowe założenia prawne i biznesowe przyjęte do draftu

### Model biznesowy
- Usługi świadczone **wyłącznie na rzecz przedsiębiorców** (art. 431 KC) — umyślnie wyłączono konsumentów i przedsiębiorców na prawach konsumenta (art. 385(5) KC).
- Obowiązkowe oświadczenie kupującego w checkout potwierdzające prowadzenie działalności i brak statusu konsumenta — zmniejsza ryzyko skutecznego powołania się na ochronę konsumencką.
- Sąd właściwy: Sąd właściwy dla siedziby loftbau (Tarnów) — w B2B klauzula prorogacyjna jest skuteczna.

### Odpowiedzialność
- Ograniczenie odpowiedzialności do **opłat zapłaconych przez klienta za ostatnie 3 miesiące** — wybrany wariant bardziej ochronny (krótszy okres).
- Wyłączenie odpowiedzialności za szkody pośrednie, utracone korzyści, utratę danych — dopuszczalne w B2B (art. 473 § 2 KC nie obejmuje winy umyślnej, klauzule wyłączone dla rażącego niedbalstwa/winy umyślnej dla bezpieczeństwa redakcyjnego).
- Wyłączenie gwarancji dostępności bez twardego SLA.

### RODO — model mieszany
- **Administrator** danych: loftbau — w zakresie danych konta, rozliczeń, bezpieczeństwa, kontaktu.
- **Podmiot przetwarzający** (procesor): loftbau — w zakresie danych wprowadzanych przez użytkownika do aplikacji o jego klientach i kontrahentach.
- DPA zawarte w warunkach usługi (inkorporowane przez akceptację regulaminu) — dopuszczalne wg art. 28 RODO.

### Płatności
- Operator: Stripe — loftbau nie jest dostawcą płatności, tylko pośrednikiem w inicjowaniu subskrypcji.
- Brak zwrotów za okres, w którym usługa była dostępna (prawo do rezygnacji nie = prawo do refundacji w B2B).
- Downgrade do Free po nieudanej płatności — bez zawieszania całości konta od razu.

### KSeF
- Dostawca: narzędzie techniczne, nie usługa compliance ani pełnomocnik podatkowy.
- Odpowiedzialność za poprawność danych i tokenów: wyłącznie użytkownik.

### Transfery poza EOG
- Odwołanie do standardowych klauzul umownych (SCC) i mechanizmów transferowych dostawców infrastruktury (Stripe, Supabase, Google, Netlify, GitHub) — bez enumeracji konkretnych krajów, bo lista jest zmienna.

---

## Miejsca oznaczone jako [DO UZUPEŁNIENIA]

| Oznaczenie | Lokalizacja | Opis |
|------------|-------------|------|
| `[DATA WDROŻENIA]` | wszystkie dokumenty | Data publikacji / wejścia w życie |
| `[LINK DO REGULAMINU]` | Polityka prywatności, DPA, cookies | Pełny URL wdrożony na domenę |
| `[LINK DO POLITYKI]` | Regulamin | URL polityki prywatności na domenę |
| `[LINK DO DPA]` | Regulamin | URL DPA na domenę |
| `[LINK DO COOKIES]` | Regulamin | URL polityki cookies |
| `[DOMENA]` | wszystkie | np. app.loftdesk.pl lub loftdesk.pl |
| `[WERSJA]` | Regulamin | numer wersji dokumentu |
| `[LISTA SUBPROCESORÓW — URL]` | Polityka subprocesorów | Publiczny adres listy |

---

## Ryzyki niemożliwe do pełnego wyłączenia nawet w B2B

1. **Odpowiedzialność za winę umyślną i rażące niedbalstwo** (art. 473 § 2 KC) — żadna klauzula jej nie wyłączy skutecznie.
2. **Naruszenie danych osobowych (RODO)** — art. 82 RODO: odpowiedzialność za naruszenie bezpieczeństwa danych powierzonych jest trudna do pełnego wyłączenia, choć można ją ograniczyć poprzez właściwe środki techniczne i organizacyjne.
3. **Zakaz stosowania klauzul abuzywnych w stosunkach B2B** — art. 385(1) KC nie stosuje się formalnie do B2B, ale klauzule rażąco naruszające równowagę kontraktową mogą być kwestionowane na podstawie art. 3531 KC (zasada swobody umów) i zasad współżycia społecznego.
4. **Dyrektywa NIS2 / cybersecurity** — w miarę wdrożenia do polskiego prawa może nakładać obowiązki incydentalne niezależnie od klauzul umownych.
5. **Przepisy o KSeF** — obowiązek wystawiania e-faktur jest ustawowy; klauzule umowne nie wpływają na obowiązki podatkowe użytkownika.
6. **Jurysdykcja wobec podmiotów zagranicznych** — klauzula prorogacyjna dla Tarnowa działa w Polsce; wobec zagranicznego klienta może wymagać osobnej analizy prawa prywatnego międzynarodowego.

---

## Rzeczy do potwierdzenia z prawnikiem wdrożeniowo

1. Czy oświadczenie B2B-only w checkout jest wystarczające wobec micro-przedsiębiorców na prawach konsumenta w kontekście art. 385(5) KC — prawnik może rekomendować dodatkową warstwę weryfikacji.
2. Czy inkorporacja DPA przez akceptację regulaminu jest wystarczająca dla audytorów RODO klientów korporacyjnych — część z nich będzie wymagać odrębnego podpisanego DPA.
3. Zakres retencji danych po usunięciu konta — 30 dni to opt-in, warto potwierdzić czy jest zgodne z polityką backupową Supabase i czy nie koliduje ze zobowiązaniami podatkowymi.
4. Dokumentacja Stripe jako podprocesora — warto uzyskać i zachować świadectwa zgodności Stripe (PCI DSS, SOC 2).
5. Czy dla planu Free wymagana jest umowa o świadczenie usług drogą elektroniczną (UŚE) — tak, USDE stosuje się niezależnie od modelu płatności.
6. Rejestr czynności przetwarzania (art. 30 RODO) — przed wdrożeniem RODO należy go uzupełnić i utrzymywać.
7. Weryfikacja, czy integracja z KSeF wymaga osobnego pełnomocnictwa/tokenu i czy regulamin poprawnie rozkłada odpowiedzialność za token KSeF.
8. Polityka backupów — przed publikacją SLA warto określić faktyczne parametry backupu Supabase i unikać zobowiązań przekraczających możliwości techniczne.

---
