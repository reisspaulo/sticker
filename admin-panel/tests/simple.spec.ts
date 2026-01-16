import { test, expect } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'paulo.reis@ytem.com.br'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''

test('login and check audience builder', async ({ page }) => {
  // Login
  await page.goto('/login')
  console.log('At login page')

  if (TEST_PASSWORD) {
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    console.log('Submitted login form')

    // Wait for redirect
    await page.waitForFunction(
      () => !window.location.pathname.includes('/login'),
      { timeout: 20000 }
    )
    console.log('Login successful, redirected to:', page.url())
  }

  // Go to campaigns new page
  await page.goto('/campaigns/new')
  await page.waitForLoadState('networkidle')
  console.log('At campaigns/new page')

  // Fill name and navigate to step 3
  await page.fill('input#name', 'test_campaign')
  await page.click('button:has-text("Próximo")')
  await page.waitForTimeout(500)
  await page.click('button:has-text("Próximo")')
  await page.waitForTimeout(500)

  // Check for audience builder
  const header = page.locator('h2:has-text("Segmentação")')
  await expect(header).toBeVisible({ timeout: 10000 })
  console.log('Audience builder visible!')

  // Take screenshot
  await page.screenshot({ path: 'test-results/audience-builder.png' })
})
