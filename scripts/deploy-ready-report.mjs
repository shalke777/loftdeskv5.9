
const rows = [
  ['Release Center', 'route', '/release'],
  ['Health Center', 'route', '/health'],
  ['Join invitation', 'route', '/join/:token'],
  ['Portal', 'route', '/portal/:token'],
  ['Env validation', 'script', 'npm run env:check'],
  ['Route smoke', 'script', 'npm run smoke:routes'],
]

console.log('LoftDesk v5.1 deploy-ready report')
for (const row of rows) {
  console.log(`- ${row[0]} [${row[1]}] -> ${row[2]}`)
}
