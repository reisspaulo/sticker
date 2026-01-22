import { test, expect } from '@playwright/test'

// Test credentials - set via environment or use defaults for manual testing
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''

// Helper function for login
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')

  if (TEST_PASSWORD) {
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for redirect - the page shows "Login realizado" then redirects
    // Use a longer timeout and wait for URL to change
    await page.waitForFunction(
      () => !window.location.pathname.includes('/login'),
      { timeout: 20000 }
    )

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle')
  } else {
    console.log('No password provided. Please login manually...')
    await page.waitForURL('/', { timeout: 60000 })
  }
}

test.describe('Audience Builder', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should display audience builder on new campaign page', async ({ page }) => {
    // Navigate to new campaign wizard
    await page.goto('/campaigns/new')

    // Wait for page to load
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Nova Campanha')).toBeVisible({ timeout: 10000 })

    // Step 1: Fill basic info - wait for input to be ready
    await page.waitForSelector('input#name', { state: 'visible' })
    await page.fill('input#name', 'test_campaign_playwright')

    // Wait for button to be enabled and click
    await page.waitForSelector('button:has-text("Próximo"):not([disabled])', { timeout: 5000 })
    await page.click('button:has-text("Próximo")')

    // Step 2: Skip trigger config - wait a moment for page to update
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test-results/step2-debug.png' })
    const nextBtn = page.locator('button:has-text("Próximo")')
    await expect(nextBtn).toBeEnabled({ timeout: 5000 })
    await nextBtn.click()

    // Step 3: Should see the audience builder
    await expect(page.locator('h2:has-text("Segmentação")')).toBeVisible({ timeout: 10000 })
  })

  test('should add filter condition and see preview', async ({ page }) => {
    // Navigate to new campaign wizard
    await page.goto('/campaigns/new')

    // Fill step 1
    await page.fill('input#name', 'test_audience_builder')

    // Go to step 3 (Audiência)
    await page.click('button:has-text("Próximo")')
    await page.click('button:has-text("Próximo")')

    // Click "Adicionar Condição"
    await page.click('button:has-text("Adicionar Condição")')

    // Select field "Plano"
    await page.click('[data-testid="field-selector"]').catch(() => {
      // Fallback: click the first select that has "Campo..." placeholder
      return page.locator('button:has-text("Campo...")').first().click()
    })
    await page.click('text=Plano')

    // Select operator "é igual a"
    await page.click('button:has-text("é igual a")')

    // Select value "Free"
    await page.locator('button:has-text("Selecione...")').click()
    await page.click('text=Free')

    // Should see user count update
    await expect(page.locator('text=/\\d+ de \\d+ usuários/')).toBeVisible({ timeout: 10000 })
  })

  test('should show sample users in preview', async ({ page }) => {
    // Navigate to new campaign wizard
    await page.goto('/campaigns/new')

    // Fill step 1
    await page.fill('input#name', 'test_sample_users')

    // Go to step 3 (Audiência)
    await page.click('button:has-text("Próximo")')
    await page.click('button:has-text("Próximo")')

    // Add a condition
    await page.click('button:has-text("Adicionar Condição")')

    // Select field
    const fieldSelect = page.locator('button:has-text("Campo...")').first()
    await fieldSelect.click()
    await page.click('text=Plano')

    // Wait for the operator select to appear and click
    await page.waitForTimeout(500)

    // Select value
    const valueSelect = page.locator('button:has-text("Selecione...")').first()
    if (await valueSelect.isVisible()) {
      await valueSelect.click()
      await page.click('[role="option"]:has-text("Free")')
    }

    // Should see sample users table
    await expect(page.locator('text=Amostra de usuários')).toBeVisible({ timeout: 15000 })

    // Should show user data in table
    await expect(page.locator('table')).toBeVisible()
  })

  test('should show progress bar with percentage', async ({ page }) => {
    // Navigate to new campaign wizard
    await page.goto('/campaigns/new')

    // Fill step 1
    await page.fill('input#name', 'test_progress_bar')

    // Go to step 3 (Audiência)
    await page.click('button:has-text("Próximo")')
    await page.click('button:has-text("Próximo")')

    // The preview should show even without filters (all users)
    // Wait for the preview to load
    await page.waitForTimeout(2000)

    // Should see percentage indicator
    await expect(page.locator('text=/%/')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Workflow Condition Node', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should show friendly condition editor in workflow', async ({ page }) => {
    // Navigate to campaigns list
    await page.goto('/campaigns')

    // Wait for campaigns to load
    await page.waitForSelector('table', { timeout: 10000 })

    // Click on first campaign
    const firstCampaignLink = page.locator('table tbody tr a').first()
    if (await firstCampaignLink.isVisible()) {
      await firstCampaignLink.click()

      // Wait for campaign detail page
      await page.waitForSelector('text=Editor Visual', { timeout: 10000 })

      // Click Editor Visual button
      await page.click('button:has-text("Editor Visual")')

      // Should see workflow editor
      await expect(page.locator('h1')).toContainText('Editor de Workflow')

      // Add a condition node
      await page.click('button:has-text("Condição")')

      // Double-click the condition node to edit
      // Find the condition node (purple colored)
      const conditionNode = page.locator('.bg-purple-500').first()
      if (await conditionNode.isVisible()) {
        await conditionNode.dblclick()

        // Should see friendly condition editor
        await expect(page.locator('text=Se o usuário...')).toBeVisible()
        await expect(page.locator('text=Tem plano igual a')).toBeVisible()
      }
    }
  })
})
