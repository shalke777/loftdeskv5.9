# Legacy monolith map — App.jsx (v3) → LoftDesk v4.3

Stary monolit zawierał główne komponenty i sekcje:
- `DashboardPage`
- `ClientsPage`
- `CostEstimatesPage`
- `ProjectsPage`
- `InvoicesPage`
- `ContractsPage`
- `KsefPage`
- `ReportsPage`
- `SettingsPage`
- `ClientPortalView`
- `SharePortalModal`
- `PortalInboxModal`
- `CostEstimateModal`
- `ProjectModal`
- `ClientModal`
- `InvoiceModal`
- `ContractModal`
- `GenerateContractModal`
- `AttachCEModal`
- wspólne UI: `Badge`, `Modal`, `Toast`, `Confirm`, `PageHeader`, `Spinner`, `Empty`

## Mapowanie do v4.3

| v3 App.jsx | v4.3 target |
|---|---|
| `DashboardPage` | `src/features/dashboard/components/DashboardPage.tsx` |
| `ClientsPage` + `ClientModal` | `src/features/clients/components/*` |
| `CostEstimatesPage` + `CostEstimateModal` + `ItemsEditor` | `src/features/estimates/components/*` |
| `GenerateContractModal` | `src/workflows/estimate-to-contract/*` |
| `ProjectsPage` + `ProjectModal` | `src/features/projects/components/*` |
| `InvoicesPage` + `InvoiceModal` | `src/features/invoices/components/*` |
| `ContractsPage` + `ContractModal` | `src/features/contracts/components/*` |
| `KsefPage` | `src/features/ksef/components/KsefPage.tsx` |
| `ReportsPage` | `src/features/reports/components/ReportsPage.tsx` |
| `SettingsPage` | `src/features/settings/components/*` |
| `ClientPortalView` | `src/features/portal/components/PortalPage.tsx` |
| `SharePortalModal` / `PortalInboxModal` | `src/features/portal/*` + `netlify/functions/*` |
| `Badge`, `Modal`, `Toast`, `Confirm`, `PageHeader`, `Spinner`, `Empty` | `src/shared/ui/*` |

## Zasada migracji
1. Nie dopisujemy nic nowego do `legacy/v3/App.jsx`.
2. Wyciągamy logikę feature po feature.
3. Czyste funkcje trafiają do `lib/`.
4. Fetching / Supabase trafia do `api/` i `hooks/`.
5. JSX zostaje tylko w komponentach.
