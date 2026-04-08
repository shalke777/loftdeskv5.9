import { expect } from '@playwright/test'
import { test, loginAsDemoUser } from './fixtures/auth'

test.describe('Projects page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page)
    await page.goto('/projects')
  })

  test('projects page loads', async ({ page }) => {
    await expect(page).toHaveURL(/projects/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  test('project list or empty state visible', async ({ page }) => {
    const hasContent = await page
      .locator('[class*="card"], [class*="row"], [class*="empty"]')
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test('new project button visible', async ({ page }) => {
    const btn = page.getByRole('button', { name: /nowy projekt|dodaj projekt/i })
    await expect(btn).toBeVisible()
  })

  test('project detail opens', async ({ page }) => {
    // Click first project if exists
    const projectCard = page.locator('[class*="proj-row"], [class*="project-card"]').first()
    const visible = await projectCard.isVisible().catch(() => false)
    if (visible) {
      await projectCard.click()
      // Should navigate to project detail or show detail inline
      await expect(page.locator('text=/Budżet|Koszty|Timeline|Wycen/i').first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('budget tab shows budget comparison', async ({ page }) => {
    // Navigate to first project if it exists
    const projectCard = page.locator('[class*="proj-row"], [class*="project-card"]').first()
    const visible = await projectCard.isVisible().catch(() => false)
    if (!visible) return

    await projectCard.click()
    // Click budget tab
    const budgetTab = page.getByRole('button', { name: /budżet/i })
    const tabVisible = await budgetTab.isVisible({ timeout: 3_000 }).catch(() => false)
    if (tabVisible) {
      await budgetTab.click()
      // PDF export button should exist when there's data
      await expect(page.locator('text=/Pobierz PDF|Brak danych budżetowych/i').first()).toBeVisible({ timeout: 5_000 })
    }
  })
})
