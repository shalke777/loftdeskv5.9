
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
const recommended = ['VITE_DATA_MODE', 'VITE_PUBLIC_BASE_URL']
const backend = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const stripe = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'VITE_STRIPE_PUBLISHABLE_KEY', 'VITE_STRIPE_BUSINESS_PRICE_ID']

const missingRequired = required.filter((key) => !process.env[key])
const missingRecommended = recommended.filter((key) => !process.env[key])

console.log('LoftDesk v5.9 env validation')
console.log('required:', required.join(', '))
console.log('recommended:', recommended.join(', '))

if (missingRequired.length) {
  console.error('Missing required env:', missingRequired.join(', '))
  process.exitCode = 1
} else {
  console.log('Required env OK')
}

if (missingRecommended.length) {
  console.warn('Missing recommended env:', missingRecommended.join(', '))
} else {
  console.log('Recommended env OK')
}

const missingBackend = backend.filter((key) => !process.env[key])
if (missingBackend.length) {
  console.warn('Missing backend env (Netlify functions disabled):', missingBackend.join(', '))
} else {
  console.log('Backend env OK')
}

const missingStripe = stripe.filter((key) => !process.env[key])
if (missingStripe.length) {
  console.warn('Missing Stripe env (payments disabled):', missingStripe.join(', '))
} else {
  console.log('Stripe env OK')
}
