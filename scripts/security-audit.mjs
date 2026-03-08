/**
 * LoftDesk v5.9 — Pre-Payment Security Audit
 * Run: node scripts/security-audit.mjs
 *
 * Checks OWASP Top 10 risks in source code:
 * A01 Broken Access Control
 * A02 Cryptographic Failures
 * A03 Injection
 * A05 Security Misconfiguration
 * A07 Authentication Failures
 * A08 Software Integrity Failures
 * A10 SSRF
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

const ROOT = resolve('.')
const SRC = join(ROOT, 'src')
const NETLIFY_FN = join(ROOT, 'netlify', 'functions')

const issues = []
let filesScanned = 0

function walk(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const results = []
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      try {
        const stat = statSync(full)
        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          results.push(...walk(full, extensions))
        } else if (extensions.includes(extname(entry))) {
          results.push(full)
        }
      } catch { /* skip inaccessible */ }
    }
  } catch { /* skip inaccessible */ }
  return results
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const relPath = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '')
  const lines = content.split('\n')
  filesScanned++

  lines.forEach((line, i) => {
    const lineNum = i + 1

    // A03: Injection — innerHTML / dangerouslySetInnerHTML without sanitization
    if (/dangerouslySetInnerHTML/i.test(line)) {
      issues.push({ severity: 'HIGH', category: 'A03-Injection', file: relPath, line: lineNum, detail: 'dangerouslySetInnerHTML — ensure content is sanitized' })
    }
    if (/\.innerHTML\s*=/.test(line)) {
      issues.push({ severity: 'HIGH', category: 'A03-Injection', file: relPath, line: lineNum, detail: 'Direct innerHTML assignment — risk of XSS' })
    }

    // A03: eval / Function constructor
    if (/\beval\s*\(/.test(line) && !/eslint/.test(line)) {
      issues.push({ severity: 'CRITICAL', category: 'A03-Injection', file: relPath, line: lineNum, detail: 'eval() usage — code injection risk' })
    }
    if (/new\s+Function\s*\(/.test(line)) {
      issues.push({ severity: 'HIGH', category: 'A03-Injection', file: relPath, line: lineNum, detail: 'new Function() usage — code injection risk' })
    }

    // A02: Hardcoded secrets
    if (/(?:api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i.test(line) && !/placeholder|example|test|demo|import\.meta/i.test(line)) {
      issues.push({ severity: 'CRITICAL', category: 'A02-Crypto', file: relPath, line: lineNum, detail: 'Possible hardcoded secret/key' })
    }

    // A05: Console.log with sensitive data markers
    if (/console\.(log|info|debug)\(.*(?:token|password|secret|key)/i.test(line) && !/eslint|import\.meta/.test(line)) {
      issues.push({ severity: 'MEDIUM', category: 'A05-Misconfig', file: relPath, line: lineNum, detail: 'console.log may leak sensitive data' })
    }

    // A05: HTTP instead of HTTPS (excluding localhost)
    if (/['"]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(line)) {
      issues.push({ severity: 'MEDIUM', category: 'A05-Misconfig', file: relPath, line: lineNum, detail: 'HTTP URL found — use HTTPS' })
    }

    // A10: SSRF — user-controlled URLs in fetch/axios
    if (/fetch\s*\(\s*(?:\$|`|[a-z_]+\s*\+)/i.test(line)) {
      issues.push({ severity: 'MEDIUM', category: 'A10-SSRF', file: relPath, line: lineNum, detail: 'Dynamic URL in fetch — verify no user-controlled SSRF vector' })
    }

    // A08: Integrity — JSON.parse without try/catch (in non-test files)
    if (/JSON\.parse\(/.test(line) && !/try\s*\{/.test(lines.slice(Math.max(0, i - 3), i).join('\n'))) {
      // Only flag in server-side code
      if (relPath.includes('netlify/functions')) {
        issues.push({ severity: 'LOW', category: 'A08-Integrity', file: relPath, line: lineNum, detail: 'JSON.parse without surrounding try/catch — may crash on malformed input' })
      }
    }

    // A01: Missing auth check in Netlify functions (check for Authorization header handling)
    if (relPath.includes('netlify/functions') && /exports\.handler/.test(line)) {
      if (!content.includes('Authorization') && !content.includes('stripe-signature') && !relPath.includes('portal-get') && !relPath.includes('portal-message')) {
        issues.push({ severity: 'MEDIUM', category: 'A01-Access', file: relPath, line: lineNum, detail: 'Netlify function without auth header check — consider adding auth' })
      }
    }
  })
}

// Scan source
console.log('LoftDesk v5.9 — Security Audit')
console.log('================================\n')

const allFiles = [...walk(SRC), ...walk(NETLIFY_FN)]
allFiles.forEach(checkFile)

// Check for missing security headers
const netlifyToml = readFileSync(join(ROOT, 'netlify.toml'), 'utf-8')
if (!netlifyToml.includes('X-Frame-Options')) {
  issues.push({ severity: 'MEDIUM', category: 'A05-Misconfig', file: 'netlify.toml', line: 0, detail: 'Missing X-Frame-Options header — clickjacking risk' })
}
if (!netlifyToml.includes('Content-Security-Policy')) {
  issues.push({ severity: 'MEDIUM', category: 'A05-Misconfig', file: 'netlify.toml', line: 0, detail: 'Missing Content-Security-Policy header' })
}
if (!netlifyToml.includes('X-Content-Type-Options')) {
  issues.push({ severity: 'LOW', category: 'A05-Misconfig', file: 'netlify.toml', line: 0, detail: 'Missing X-Content-Type-Options header' })
}

// Check package.json for known vulnerable patterns
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
if (allDeps['express'] && !allDeps['helmet']) {
  issues.push({ severity: 'MEDIUM', category: 'A05-Misconfig', file: 'package.json', line: 0, detail: 'Express without helmet — missing security headers' })
}

// Report
const critical = issues.filter(i => i.severity === 'CRITICAL')
const high = issues.filter(i => i.severity === 'HIGH')
const medium = issues.filter(i => i.severity === 'MEDIUM')
const low = issues.filter(i => i.severity === 'LOW')

console.log(`Files scanned: ${filesScanned}`)
console.log(`Issues found: ${issues.length}`)
console.log(`  CRITICAL: ${critical.length}`)
console.log(`  HIGH: ${high.length}`)
console.log(`  MEDIUM: ${medium.length}`)
console.log(`  LOW: ${low.length}`)
console.log('')

for (const issue of [...critical, ...high, ...medium, ...low]) {
  const loc = issue.line > 0 ? `:${issue.line}` : ''
  console.log(`[${issue.severity}] ${issue.category} — ${issue.file}${loc}`)
  console.log(`  ${issue.detail}\n`)
}

if (critical.length > 0) {
  console.log('\n*** CRITICAL issues must be resolved before enabling payments ***')
  process.exitCode = 1
} else if (high.length > 0) {
  console.log('\n*** HIGH severity issues should be reviewed ***')
} else {
  console.log('\n✓ No critical or high-severity issues found. Safe to proceed.')
}
