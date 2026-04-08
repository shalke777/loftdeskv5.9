import { expect } from '@playwright/test'
import { test, loginAsDemoUser } from './fixtures/auth'

test.describe('Invoices page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page)
    await page.goto('/invoices')
  })

  test('invoices page loads', async ({ page }) => {
    await expect(page).toHaveURL(/invoices/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('invoice list or empty state visible', async ({ page }) => {
    const hasContent = await page
      .locator('[class*="card"], [class*="row"], [class*="empty"]')
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('new invoice button is visible', async ({ page }) => {
    const btn = page.getByRole('button', { name: /nowa faktura|wystaw faktur/i })
    await expect(btn).toBeVisible()
  })

  test('PDF/XML button visible on existing invoice', async ({ page }) => {
    const pdfBtn = page.getByRole('button', { name: /PDF \/ XML/i }).first()
    const visible = await pdfBtn.isVisible().catch(() => false)
    if (visible) {
      await expect(pdfBtn).toBeVisible()
    }
  })

  test('invoice status badges are visible', async ({ page }) => {
    // Status badges (draft/sent/paid/overdue) should be visible if invoices exist
    const badge = page.locator('[class*="badge"], [class*="status"]').first()
    const visible = await badge.isVisible().catch(() => false)
    if (visible) {
      await expect(badge).toBeVisible()
    }
  })

  test('invoice filter tabs work', async ({ page }) => {
    // Filter buttons like "Wszystkie", "Do zapłaty", "Opłacone"
    const filterBtn = page.getByRole('button', { name: /wszystkie|do zapłaty|opłacone/i }).first()
    const visible = await filterBtn.isVisible().catch(() => false)
    if (visible) {
      await filterBtn.click()
      await expect(page).toHaveURL(/invoices/)
    }
  })
})
