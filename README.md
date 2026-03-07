# LoftDesk v5.1.7

Modularna przebudowa LoftDesk oparta o **React + TypeScript + Vite + TanStack Query + TanStack Router**.

## Co nowego w v4.7
- onboarding firmy pod trasą **`/onboarding`**
- register flow zbierający: firma + właściciel + NIP
- most v3 -> v4.7 dla `profiles`, `company_members`, `company_id`
- nowe migracje SQL pod bootstrap firmy, pełniejsze RLS i invitations
- `supabase/seed.sql` do lokalnego backfillu
- mocniejsza ścieżka do staged migration zamiast samego demo store

## Moduły
- Dashboard
- Klienci
- Kosztorysy
- Faktury
- Umowy
- Projekty
- Raporty
- KSeF
- Billing
- Ustawienia
- Admin
- Portal klienta
- Onboarding firmy

## Start
```bash
npm install
npm run dev
```

## Konta demo
- `adam@budowlanka.pl` / `demo123`
- `koordynator@budowlanka.pl` / `demo123`
- `marta@marex.pl` / `demo456`
- `biuro@loftdesk.pl` / `admin123`

## Najważniejsze pliki
- `src/app/router.tsx` — route tree
- `src/features/onboarding/components/OnboardingPage.tsx` — onboarding workspace'u
- `src/shared/lib/demoDb.ts` — demo store + onboarding summary
- `src/shared/lib/dataScope.ts` — legacy `user_id` vs docelowy `company_id`
- `supabase/migrations/*` — plan migracji bazy
- `supabase/seed.sql` — lokalny backfill / seed company-first
- `docs/v4.7-test-matrix.md` — checklista stagingowa

## Uwaga
W tym środowisku nie mogłem uruchomić pełnego `npm install && npm run build`, bo kontener nie pobiera paczek z internetu. Projekt jest jednak przygotowany jako kompletne źródło do uruchomienia lokalnie, a składnia i lokalne importy zostały sprawdzone.


## v4.8
- Team and invitation flow
- Pending invite acceptance helpers
- Staging migration smoke scripts


## v5.0 additions

- Release Center under `/release`
- Invitation acceptance route under `/join/:token`
- Global App Error Boundary
- Release report script: `npm run release:report`


## v5.2 Final production package

Ta paczka domyka linię migracji do modularnego LoftDesk v5.2.
Najważniejsze entry points: `/release`, `/health`, `/go-live`, `/team`, `/billing`, `/settings`.
Uruchom kolejno: `npm run env:check`, `npm run deploy:ready`, `npm run go:live`, a następnie przejdź przez checklistę `tests/manual/v5.2-final-production-checklist.md`.
