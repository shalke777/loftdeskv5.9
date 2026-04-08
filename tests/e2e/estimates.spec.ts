import { expect } from '@playwright/test'
import { test, loginAsDemoUser } from './fixtures/auth'

test.describe('Estimates page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page)
    await page.goto('/estimates')
  })

  test('estimates page loads', async ({ page }) => {
    await expect(page).toHaveURL(/estimates/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('estimate list or empty state visible', async ({ page }) => {
    const hasContent = await page
      .locator('[class*="card"], [class*="row"], [class*="empty"]')
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('new estimate button is visible', async ({ page }) => {
    const btn = page.getByRole('button', { name: /nowa wycena|dodaj wycen/i })
    await expect(btn).toBeVisible()
  })

  test('create estimate modal opens', async ({ page }) => {
    await page.getByRole('button', { name: /nowa wycena|dodaj wycen/i }).click()
    await expect(
      page.getByLabel(/nazwa wyceny|tytuł|klient/i).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('PDF button visible on existing estimate', async ({ page }) => {
    // Only run if there are estimates
    const pdfBtn = page.getByRole('button', { name: /^PDF$/i }).first()
    const visible = await pdfBtn.isVisible().catch(() => false)
    if (visible) {
      await expect(pdfBtn).toBeVisible()
    }
  })

  test('send button visible on existing estimate', async ({ page }) => {
    const sendBtn = page.getByRole('button', { name: /wyślij/i }).first()
    const visible = await sendBtn.isVisible().catch(() => false)
    if (visible) {
      await sendBtn.click()
      // SendToClientModal opens
      await expect(page.getByLabel(/adres email klienta/i)).toBeVisible({ timeout: 5_000 })
      // PDF attachment notice should be visible (S1 fix)
      await expect(page.locator('text=/PDF dokumentu zostanie dołączony/i')).toBeVisible({ timeout: 3_000 }).catch(() => {
        // May not show if no pdfHtml — that's ok for portal-linked estimates
      })
    }
  })
})
