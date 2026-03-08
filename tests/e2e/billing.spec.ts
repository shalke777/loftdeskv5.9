import { test, expect } from '@playwright/test'

test.describe('Billing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as seed owner
    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill('adam@budowlanka.pl')
    await page.getByLabel(/has/i).fill('password123')
    await page.getByRole('button', { name: /zaloguj/i }).click()
    await page.waitForURL(/dashboard/)
    await page.goto('/billing')
  })

  test('billing page loads for owner', async ({ page }) => {
    await expect(page.locator('text=Plan i limity')).toBeVisible()
    await expect(page.locator('text=Firma')).toBeVisible()
  })

  test('shows usage limits', async ({ page }) => {
    await expect(page.locator('text=Klienci')).toBeVisible()
    await expect(page.locator('text=Projekty')).toBeVisible()
    await expect(page.locator('text=Faktury')).toBeVisible()
  })

  test('displays Free and Business plans only', async ({ page }) => {
    await expect(page.locator('text=Free')).toBeVisible()
    await expect(page.locator('text=Business')).toBeVisible()
    // Pro should NOT be visible as a plan card
    const proCard = page.locator('.actions-row >> text=Pro')
    await expect(proCard).not.toBeVisible()
  })

  test('demo mode shows demo banner', async ({ page }) => {
    await expect(page.locator('text=Tryb demo')).toBeVisible()
  })

  test('plan switch in demo mode works', async ({ page }) => {
    const businessBtn = page.getByRole('button', { name: /aktywuj business|kup business|przejdz na business/i })
    if (await businessBtn.isVisible()) {
      await businessBtn.click()
      await expect(page.locator('text=/plan zapisany|business/i')).toBeVisible({ timeout: 5000 })
    }
  })

  test('no plan change without owner role', async ({ page }) => {
    // Login as worker
    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill('koordynator@budowlanka.pl')
    await page.getByLabel(/has/i).fill('password123')
    await page.getByRole('button', { name: /zaloguj/i }).click()
    await page.waitForURL(/dashboard/)
    await page.goto('/billing')
    const upgradeBtn = page.getByRole('button', { name: /aktywuj|kup|przejdz na/i })
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click()
      await expect(page.locator('text=/brak uprawnien/i')).toBeVisible({ timeout: 5000 })
    }
  })
})
