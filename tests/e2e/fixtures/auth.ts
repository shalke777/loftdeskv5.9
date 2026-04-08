import { test as base, expect, type Page } from '@playwright/test'

// Demo seed user — always available in LoftDesk demo mode
export const DEMO_USER = {
  email: 'adam@budowlanka.pl',
  password: 'password123',
}

/** Log in with the demo seed user and wait for dashboard */
export async function loginAsDemoUser(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(DEMO_USER.email)
  await page.getByLabel(/has/i).fill(DEMO_USER.password)
  await page.getByRole('button', { name: /zaloguj/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 15_000 })
}

/** Extended test fixture that pre-logs in before each test */
export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await loginAsDemoUser(page)
    await use(page)
  },
})

export { expect }
