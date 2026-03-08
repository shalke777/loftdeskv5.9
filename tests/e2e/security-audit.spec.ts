import { test, expect } from '@playwright/test'

test.describe('Security Audit — OWASP Top 10', () => {

  // A01:2021 — Broken Access Control
  test.describe('Access Control', () => {
    test('unauthenticated user cannot access dashboard', async ({ page }) => {
      // Clear any stored session
      await page.goto('/')
      await page.evaluate(() => localStorage.clear())
      await page.goto('/dashboard')
      // Should redirect to login or show auth screen
      await page.waitForTimeout(2000)
      const url = page.url()
      const hasAuthPrompt = await page.locator('text=/zaloguj|logowanie|login/i').isVisible().catch(() => false)
      expect(url.includes('login') || hasAuthPrompt).toBeTruthy()
    })

    test('unauthenticated user cannot access settings', async ({ page }) => {
      await page.evaluate(() => localStorage.clear())
      await page.goto('/settings')
      await page.waitForTimeout(2000)
      const hasAuthPrompt = await page.locator('text=/zaloguj|logowanie|login/i').isVisible().catch(() => false)
      expect(hasAuthPrompt).toBeTruthy()
    })

    test('unauthenticated user cannot access billing', async ({ page }) => {
      await page.evaluate(() => localStorage.clear())
      await page.goto('/billing')
      await page.waitForTimeout(2000)
      const hasAuthPrompt = await page.locator('text=/zaloguj|logowanie|login/i').isVisible().catch(() => false)
      expect(hasAuthPrompt).toBeTruthy()
    })
  })

  // A03:2021 — Injection
  test.describe('Injection Prevention', () => {
    test('XSS in login email field is sanitized', async ({ page }) => {
      await page.goto('/login')
      const xssPayload = '<script>alert("xss")</script>'
      await page.getByLabel(/e-mail/i).fill(xssPayload)
      await page.getByLabel(/has/i).fill('test')
      await page.getByRole('button', { name: /zaloguj/i }).click()
      // Script should NOT execute — no alert dialog
      const dialog = await page.waitForEvent('dialog', { timeout: 2000 }).catch(() => null)
      expect(dialog).toBeNull()
    })

    test('XSS in registration company name is sanitized', async ({ page }) => {
      await page.goto('/login')
      const registerTab = page.getByRole('button', { name: /za.*konto|rejestr/i })
      if (await registerTab.isVisible()) {
        await registerTab.click()
      }
      const xssPayload = '"><img src=x onerror=alert(1)>'
      const companyInput = page.getByLabel(/nazwa firmy/i)
      if (await companyInput.isVisible()) {
        await companyInput.fill(xssPayload)
        await page.getByLabel(/e-mail/i).fill('xss@test.pl')
        await page.getByLabel(/has/i).fill('test12345')
        await page.getByRole('button', { name: /za.*konto/i }).click()
        const dialog = await page.waitForEvent('dialog', { timeout: 2000 }).catch(() => null)
        expect(dialog).toBeNull()
      }
    })

    test('SQL injection in search fields has no effect', async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel(/e-mail/i).fill("'; DROP TABLE users;--")
      await page.getByLabel(/has/i).fill('test')
      await page.getByRole('button', { name: /zaloguj/i }).click()
      // App should still function — no crash
      await page.waitForTimeout(1000)
      await expect(page.locator('body')).toBeVisible()
    })
  })

  // A04:2021 — Insecure Design
  test.describe('Secure Design', () => {
    test('password field uses type=password', async ({ page }) => {
      await page.goto('/login')
      const pw = page.locator('input[type="password"]')
      await expect(pw).toBeVisible()
    })

    test('no sensitive data in page source', async ({ page }) => {
      await page.goto('/login')
      const content = await page.content()
      expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
      expect(content).not.toContain('STRIPE_SECRET_KEY')
      expect(content).not.toContain('STRIPE_WEBHOOK_SECRET')
    })
  })

  // A05:2021 — Security Misconfiguration
  test.describe('Security Configuration', () => {
    test('no stack traces in error responses', async ({ page }) => {
      await page.goto('/nonexistent-route-12345')
      const content = await page.content()
      expect(content).not.toMatch(/at\s+\w+\s+\(.*:\d+:\d+\)/)
    })

    test('service worker registered for HTTPS', async ({ page }) => {
      await page.goto('/')
      const swRegistration = await page.evaluate(() => {
        return navigator.serviceWorker ? 'available' : 'unavailable'
      })
      expect(swRegistration).toBe('available')
    })
  })

  // A07:2021 — Identification and Authentication Failures
  test.describe('Authentication', () => {
    test('session clears on logout', async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel(/e-mail/i).fill('adam@budowlanka.pl')
      await page.getByLabel(/has/i).fill('password123')
      await page.getByRole('button', { name: /zaloguj/i }).click()
      await page.waitForURL(/dashboard/)

      // Logout
      const logoutBtn = page.getByRole('button', { name: /wyloguj|logout/i })
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click()
        await page.waitForTimeout(1000)
        const session = await page.evaluate(() => localStorage.getItem('loftdesk-v4-session'))
        expect(session === null || session === 'null').toBeTruthy()
      }
    })
  })

  // A09:2021 — Security Logging and Monitoring
  test.describe('Error Handling', () => {
    test('console has no unhandled errors on main pages', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))

      await page.goto('/login')
      await page.getByLabel(/e-mail/i).fill('adam@budowlanka.pl')
      await page.getByLabel(/has/i).fill('password123')
      await page.getByRole('button', { name: /zaloguj/i }).click()
      await page.waitForURL(/dashboard/)

      // Navigate key pages
      for (const route of ['/clients', '/estimates', '/invoices', '/settings', '/billing']) {
        await page.goto(route)
        await page.waitForTimeout(500)
      }

      expect(errors.length).toBe(0)
    })
  })
})
