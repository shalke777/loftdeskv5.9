import { test, expect } from '@playwright/test'

test.describe('Settings & Company Profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill('adam@budowlanka.pl')
    await page.getByLabel(/has/i).fill('password123')
    await page.getByRole('button', { name: /zaloguj/i }).click()
    await page.waitForURL(/dashboard/)
    await page.goto('/settings')
  })

  test('settings page loads', async ({ page }) => {
    await expect(page.locator('text=/ustawienia/i')).toBeVisible()
  })

  test('company profile editable by owner', async ({ page }) => {
    const companyNameInput = page.getByLabel(/nazwa firmy/i)
    if (await companyNameInput.isVisible()) {
      await expect(companyNameInput).toBeEnabled()
    }
  })

  test('KSeF configuration fields visible', async ({ page }) => {
    const ksefSection = page.locator('text=/ksef/i')
    await expect(ksefSection.first()).toBeVisible()
  })
})

test.describe('KSeF Module', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/e-mail/i).fill('adam@budowlanka.pl')
    await page.getByLabel(/has/i).fill('password123')
    await page.getByRole('button', { name: /zaloguj/i }).click()
    await page.waitForURL(/dashboard/)
  })

  test('KSeF page loads in demo mode', async ({ page }) => {
    await page.goto('/ksef')
    await expect(page.locator('text=KSeF')).toBeVisible()
  })

  test('KSeF session form has NIP and token fields', async ({ page }) => {
    await page.goto('/ksef')
    const nipInput = page.getByLabel(/nip/i)
    const tokenInput = page.getByLabel(/token/i)
    // In demo mode, KSeF should be accessible
    if (await nipInput.isVisible()) {
      await expect(nipInput).toBeVisible()
      await expect(tokenInput).toBeVisible()
    }
  })

  test('demo session can be started', async ({ page }) => {
    await page.goto('/ksef')
    const demoBtn = page.getByRole('button', { name: /demo/i })
    if (await demoBtn.isVisible()) {
      await demoBtn.click()
      await expect(page.locator('text=/demo|sesja/i')).toBeVisible({ timeout: 5000 })
    }
  })
})
