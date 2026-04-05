export const APP_NAME = 'LoftDesk'
export const APP_TAGLINE = 'Kosztorysy, umowy, faktury, KSeF i realizacja — w jednym systemie dla firm budowlanych i wykończeniowych.'
export const DEFAULT_CURRENCY = 'PLN'

export const PLAN_DEFS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    color: 'var(--color-text-muted)',
    features: ['5 faktur miesięcznie', '3 umowy miesięcznie', '10 klientów', '3 projekty', '5 kosztorysów'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 49,
    color: 'var(--color-error)',
    features: ['Nielimitowane dokumenty', 'KSeF ready', 'Portal klienta', 'Kontrola marży'],
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 119,
    color: 'var(--color-accent)',
    features: ['Wszystko z Pro', 'Zespół i role', 'API / integracje', 'Własne logo na dokumentach', 'Priorytetowe wsparcie'],
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    price: 0,
    color: 'var(--color-text-primary)',
    features: ['Pełny dostęp serwisowy'],
  },
} as const

export const STATUS_META = {
  draft: { label: 'Szkic', tone: 'default' },
  sent: { label: 'Wysłany', tone: 'warning' },
  accepted: { label: 'Zaakceptowany', tone: 'success' },
  rejected: { label: 'Odrzucony', tone: 'danger' },
  offer: { label: 'Oferta', tone: 'warning' },
  active: { label: 'W toku', tone: 'success' },
  done: { label: 'Zakończony', tone: 'default' },
  cancelled: { label: 'Anulowany', tone: 'danger' },
  unpaid: { label: 'Niezapłacona', tone: 'warning' },
  paid: { label: 'Zapłacona', tone: 'success' },
  overdue: { label: 'Przeterminowana', tone: 'danger' },
  unsigned: { label: 'Oczekuje', tone: 'warning' },
  signed: { label: 'Podpisana', tone: 'success' },
  ksef_pending: { label: 'KSeF oczekuje', tone: 'warning' },
  ksef_sent: { label: 'KSeF wysłana', tone: 'success' },
  ksef_error: { label: 'KSeF błąd', tone: 'danger' },
} as const
