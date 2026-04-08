import { expect } from '@playwright/test'
import { test, loginAsDemoUser } from './fixtures/auth'

test.describe('Clients page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page)
    await page.goto('/clients')
  })

  test('clients page loads', async ({ page }) => {
    await expect(page).toHaveURL(/clients/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('client list is visible', async ({ page }) => {
    // At least one client card or table row or empty state visible
    const hasContent = await page
      .locator('[class*="card"], [class*="row"], [class*="empty"]')
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('add client button is visible', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /dodaj klienta|nowy klient/i })
    await expect(addBtn).toBeVisible()
  })

  test('add client modal opens', async ({ page }) => {
    await page.getByRole('button', { name: /dodaj klienta|nowy klient/i }).click()
    // Modal with company name or NIP field
    await expect(
      page.getByLabel(/nazwa firmy|nazwa klienta|imię/i).first()
    ).toBeVisible({ timeout: 5_000 })
  })
})
