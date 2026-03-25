# LoftDesk — Observability & Hardening

## Zmienne środowiskowe

| Zmienna | Wymagana | Gdzie | Opis |
|---|---|---|---|
| `VITE_SENTRY_DSN` | Tak (prod) | Netlify env | DSN z projektu Sentry. Bez niej monitoring jest wyłączony (no-op). |
| `VITE_APP_VERSION` | Nie | Netlify env / CI | Wersja release (`loftdesk@X.Y.Z`). Widoczna w tagach Sentry. |

## Architektura monitoringu

```
Browser error
  → captureError(error, { area })
    → classifyError(error) → 'rls' | 'api' | 'auth' | 'ksef' | 'portal' | ...
    → Sentry.withScope → tag: loftdesk.area
    → console.error (zawsze, nawet bez DSN)

Query/Mutation error
  → QueryCache.onError / MutationCache.onError
    → captureError → Sentry (z queryKey/mutationKey)

Unhandled rejection
  → window.addEventListener('unhandledrejection')
    → captureError → Sentry

Component crash
  → AppErrorBoundary.componentDidCatch / RootErrorFallback
    → captureError → Sentry
```

## Klasyfikacja błędów (tagi `loftdesk.area`)

| Area | Wykrywane wzorce |
|---|---|
| `rls` | rls, policy, permission denied, 403 |
| `auth` | login, session, token, jwt |
| `ksef` | ksef, krajowy, faktur |
| `parsing` | ocr, extract, openai, ai |
| `portal` | portal, client_project |
| `billing` | stripe, payment, subscription |
| `api` | fetch, 500-504, supabase, timeout |
| `ui` | render, component, chunk load |
| `unknown` | (domyślnie) |

## Konteksty użytkownika

Sentry automatycznie otrzymuje:
- `user.id` — UUID użytkownika
- `loftdesk.company_id` — tenant
- `loftdesk.role` — rola (owner/admin/member/viewer)
- `loftdesk.plan` — plan (free/pro/business)
- `loftdesk.route` — aktualny route (jeśli ustawiony)

## Obsługa incydentów

1. **Sentry alert** → sprawdź tag `loftdesk.area` → ustal domenę
2. **RLS / auth** → czy RLS policy wymaga aktualizacji? Czy token wygasł?
3. **KSeF** → sprawdź status API MF, logi ksef-session.js, certyfikat
4. **API / 5xx** → sprawdź Supabase Dashboard → Functions → Logs
5. **UI / chunk load** → nowy deploy spowodował cache mismatch → SW powinien odświeżyć
6. **Parsing / OCR** → sprawdź format dokumentu, limity OpenAI

## Pliki zmienione

### Nowe
- `src/shared/lib/monitoring.ts` — moduł Sentry z klasyfikacją błędów
- `src/shared/ui/QueryError/QueryError.tsx` — komponent error state z retry
- `docs/observability-ops.md` — ten dokument

### Zmodyfikowane
- `src/main.tsx` — initMonitoring() + captureError na unhandledrejection
- `src/app/providers.tsx` — setMonitoringUser sync po auth state change
- `src/app/routes/__root.tsx` — captureError w RootErrorFallback
- `src/shared/ui/AppErrorBoundary/AppErrorBoundary.tsx` — captureError
- `src/shared/lib/queryClient.ts` — QueryCache/MutationCache.onError → captureError
- `src/features/dashboard/components/DashboardPage.tsx` — isError + QueryError
- `src/features/clients/components/ClientsPage.tsx` — isError + QueryError
- `src/features/estimates/components/EstimatesPage.tsx` — isError + QueryError
- `src/features/projects/components/ProjectsPage.tsx` — isError + QueryError

## Następne kroki (rekomendowane)

- [ ] Dodaj `VITE_SENTRY_DSN` w Netlify Dashboard → Environment Variables
- [ ] Dodaj `@sentry/node` do `netlify/functions/` dla server-side monitoring
- [ ] Skonfiguruj Sentry source map upload (vite plugin lub CI step)
- [ ] Skonfiguruj alerty w Sentry (by area tag, by volume)
- [ ] Dodaj Sentry Release integration z GitHub
