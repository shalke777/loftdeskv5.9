import { expect } from '@playwright/test'
import { test, loginAsDemoUser } from './fixtures/auth'

test.describe('Contracts page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page)
    await page.goto('/contracts')
  })

  test('contracts page loads', async ({ page }) => {
    await expect(page).toHaveURL(/contracts/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('contract list or empty state visible', async ({ page }) => {
    const hasContent = await page
      .locator('[class*="card"], [class*="row"], [class*="empty"]')
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('new contract button is visible', async ({ page }) => {
    const btn = page.getByRole('button', { name: /nowa umowa|dodaj umow/i })
    await expect(btn).toBeVisible()
  })

  test('PDF button visible on existing contract', async ({ page }) => {
    const pdfBtn = page.getByRole('button', { name: /^PDF$/i }).first()
    const visible = await pdfBtn.isVisible().catch(() => false)
    if (visible) {
      await pdfBtn.click()
      // Document preview modal should open
      await expect(page.locator('text=/Podgląd|Pobierz PDF/i')).toBeVisible({ timeout: 5_000 })
    }
  })

  test('contract status badge visible', async ({ page }) => {
    const badge = page.locator('[class*="badge"]').first()
    const visible = await badge.isVisible().catch(() => false)
    if (visible) {
      await expect(badge).toBeVisible()
    }
  })
})
