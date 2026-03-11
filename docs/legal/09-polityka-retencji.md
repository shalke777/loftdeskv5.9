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

4.1. Użytkownik jest uprawniony do eksportu Danych Klientów wyłącznie **podczas obowiązywania Umowy** (w ramach planu Free lub Business z dostępem do funkcji eksportu) za pośrednictwem interfejsu Aplikacji.

4.2. Po zakończeniu Umowy lub usunięciu Konta eksport danych **nie jest gwarantowany**. Dostawca nie jest zobowiązany do udostępniania danych po rozwiązaniu Umowy.

4.3. Użytkownik jest odpowiedzialny za bieżący eksport i archiwizację danych zgodnie z własnymi wymogami prawnymi, podatkowymi i operacyjnymi.

---

## 5. USUWANIE KONTA

5.1. Użytkownik może zażądać usunięcia Konta w dowolnym momencie, przesyłając wniosek na adres: szalecki.p@gmail.com z tytułem „USUNIĘCIE KONTA".

5.2. Usunięcie Konta **nie następuje automatycznie** wraz z rezygnacją z płatnej subskrypcji. Rezygnacja z subskrypcji skutkuje przeniesieniem na plan Free, a nie usunięciem Konta.

5.3. Dostawca przystępuje do usunięcia Konta i powiązanych Danych Klientów niezwłocznie po otrzymaniu wniosku, nie później niż w ciągu 30 dni.

5.4. Usunięcie Konta jest **nieodwracalne**. Dostawca nie jest zobowiązany do przywrócenia usuniętego Konta ani danych po upływie okresu retencji backupów techniczna (do 30 dni).

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
