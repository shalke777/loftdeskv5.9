import { expect } from '@playwright/test'
import { test, loginAsDemoUser } from './fixtures/auth'

test.describe('Settings — Cennik usług (S2)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page)
    await page.goto('/settings')
  })

  test('settings page loads', async ({ page }) => {
    await expect(page).toHaveURL(/settings/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('Cennik usług card is visible', async ({ page }) => {
    await expect(page.locator('text=Cennik usług')).toBeVisible()
  })

  test('Cennik usług shows saved prices or empty state', async ({ page }) => {
    // Either shows price rows or the empty-state guidance text
    const content = page.locator('text=/pozycji|Brak zapisanych cen|Domyślne ceny/i').first()
    await expect(content).toBeVisible({ timeout: 5_000 })
  })

  test('Dodaj pozycję button visible in price list', async ({ page }) => {
    await expect(page.getByRole('button', { name: /dodaj pozycję/i })).toBeVisible()
  })

  test('Dodaj pozycję opens search input', async ({ page }) => {
    await page.getByRole('button', { name: /dodaj pozycję/i }).click()
    await expect(page.getByPlaceholder(/szukaj usługi z katalogu/i)).toBeVisible({ timeout: 3_000 })
  })

  test('price search finds catalog items', async ({ page }) => {
    await page.getByRole('button', { name: /dodaj pozycję/i }).click()
    const searchInput = page.getByPlaceholder(/szukaj usługi z katalogu/i)
    await searchInput.fill('malowanie')
    // Dropdown with suggestions should appear
    await expect(page.locator('[class*="suggestion"], .suggestion, text=/malowanie/i').first())
      .toBeVisible({ timeout: 3_000 })
  })

  test('existing price can be edited inline', async ({ page }) => {
    // Only if there are saved prices
    const editBtn = page.getByTitle('Edytuj cenę').first()
    const visible = await editBtn.isVisible().catch(() => false)
    if (!visible) return

    await editBtn.click()
    await expect(page.locator('input[type="number"]').first()).toBeVisible({ timeout: 2_000 })
  })
})
