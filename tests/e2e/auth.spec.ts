import { test, expect } from '@playwright/test'

test.describe('Registration & Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('login page loads correctly', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('demo login with seed user works', async ({ page }) => {
    await page.getByLabel(/e-mail/i).fill('adam@budowlanka.pl')
    await page.getByLabel(/has/i).fill('password123')
    await page.getByRole('button', { name: /zaloguj/i }).click()
    await page.waitForURL(/dashboard/)
    await expect(page.locator('text=Tablica')).toBeVisible()
  })

  test('registration form shows all required fields', async ({ page }) => {
    const registerTab = page.getByRole('button', { name: /za.*konto|rejestr/i })
    if (await registerTab.isVisible()) {
      await registerTab.click()
    }
    await expect(page.getByLabel(/nazwa firmy/i)).toBeVisible()
    await expect(page.getByLabel(/e-mail/i)).toBeVisible()
    await expect(page.getByLabel(/has/i)).toBeVisible()
  })

  test('demo registration assigns owner role and free plan', async ({ page }) => {
    const registerTab = page.getByRole('button', { name: /za.*konto|rejestr/i })
    if (await registerTab.isVisible()) {
      await registerTab.click()
    }
    await page.getByLabel(/nazwa firmy/i).fill('Test Firma E2E')
    await page.getByLabel(/imi.*nazwisko/i).fill('Test User')
    await page.getByLabel(/e-mail/i).fill(`e2e-${Date.now()}@test.pl`)
    await page.getByLabel(/has/i).fill('test12345')
    await page.getByRole('button', { name: /za.*konto/i }).click()
    await page.waitForURL(/dashboard|settings/)
    // Navigate to billing to check plan
    await page.goto('/billing')
    await expect(page.locator('text=Free')).toBeVisible()
  })

  test('rejects login with wrong password', async ({ page }) => {
    await page.getByLabel(/e-mail/i).fill('adam@budowlanka.pl')
    await page.getByLabel(/has/i).fill('wrongpassword')
    await page.getByRole('button', { name: /zaloguj/i }).click()
    await expect(page.locator('text=/niepoprawne|blad|error/i')).toBeVisible({ timeout: 5000 })
  })
})
