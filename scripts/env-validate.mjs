
const required = ['VITE_PUBLIC_BASE_URL']
const recommended = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_DATA_MODE']

const missingRequired = required.filter((key) => !process.env[key])
const missingRecommended = recommended.filter((key) => !process.env[key])

console.log('LoftDesk v5.1 env validation')
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
