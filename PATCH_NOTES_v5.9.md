# LoftDesk v5.9 — navigation + document templates polish

## Zrobione

- uproszczone główne menu do kolejności:
  - Tablica
  - Kontrahenci
  - Wycena
  - Umowa
  - Faktura
  - Portal
  - Projekty
  - KSeF
  - Ustawienia
- dodatki przeniesione do `Ustawienia`:
  - backup
  - raporty
  - dokumentacja i odbiory
  - billing
  - zespół
  - admin
- poprawione style:
  - bardziej elegancka kolorystyka
  - nowy wygląd sidebaru i przycisków
  - subtelniejsze hover/focus
  - poprawione scrollbary
- poprawione modale:
  - sticky header
  - lepszy scroll na mobile
  - mniej problemów z obcięciem akcji
- poprawione podglądy dokumentów:
  - wycena w stylu z dostarczonego PDF
  - faktura VAT z układem zbliżonym do dostarczonego PDF
  - umowa w układzie zbliżonym do dostarczonego PDF
  - protokół odbioru jako gotowy wzór PDF
- dodane szybkie wejścia do backupu i dokumentacji z ustawień
- uproszczona konfiguracja PWA (usunięty problematyczny custom `globPatterns`)

## Ważne

Podglądy dokumentów są generowane jako HTML do druku / pobrania i odwzorowują układ dostarczonych plików referencyjnych możliwie blisko w realiach tego startera.

## Następny test

1. odpal `npm install`
2. odpal `npm run dev`
3. sprawdź:
   - sidebar
   - settings backup import/export
   - PDF/XML na wycenach, umowach, fakturach
   - protokół odbioru w dokumentacji
   - portal demo
