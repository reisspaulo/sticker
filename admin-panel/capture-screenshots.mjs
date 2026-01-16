import { chromium } from '@playwright/test'

const EMAIL = 'paulo.reis@ytem.com.br'
const PASSWORD = 'aXGM7Y2ZPSUw5He'

async function main() {
  console.log('Starting browser...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Login
    console.log('1. Login...')
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 20000 })
    await page.waitForLoadState('networkidle')
    console.log('✓ Logged in')

    // Go to new campaign
    console.log('2. Navigate to new campaign...')
    await page.goto('http://localhost:3000/campaigns/new')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/1-step1-empty.png', fullPage: true })
    console.log('✓ Screenshot 1: Step 1 empty')

    // Fill step 1
    console.log('3. Fill Step 1...')
    await page.fill('input#name', 'Campanha Demo Audience Builder')
    await page.screenshot({ path: 'test-results/2-step1-filled.png', fullPage: true })
    console.log('✓ Screenshot 2: Step 1 filled')

    // Go to step 2
    console.log('4. Navigate to Step 2...')
    await page.click('button:has-text("Próximo")')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/3-step2.png', fullPage: true })
    console.log('✓ Screenshot 3: Step 2')

    // Go to step 3 (Audience)
    console.log('5. Navigate to Step 3 (Audience)...')
    await page.click('button:has-text("Próximo")')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/4-step3-empty.png', fullPage: true })
    console.log('✓ Screenshot 4: Step 3 empty (Audience Builder visible)')

    // Add first condition
    console.log('6. Add first condition (Plano = Free)...')
    await page.click('button:has-text("Adicionar Condição")')
    await page.waitForTimeout(500)

    // Click first combo box (field selector)
    const firstCombo = await page.locator('button[role="combobox"]').first()
    await firstCombo.click()
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("Plano")')
    await page.waitForTimeout(1000)

    // Select value (Free)
    const valueCombo = await page.locator('button[role="combobox"]').nth(2)
    await valueCombo.click()
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("Free")')
    await page.waitForTimeout(3000) // Wait for preview

    await page.screenshot({ path: 'test-results/5-condition1-plan-free.png', fullPage: true })
    console.log('✓ Screenshot 5: First condition added')

    // Scroll to see preview
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test-results/6-preview-with-condition1.png', fullPage: true })
    console.log('✓ Screenshot 6: Preview with 1 condition')

    // Add second condition
    console.log('7. Add second condition (Stickers > 5)...')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(500)
    await page.click('button:has-text("Adicionar Condição")')
    await page.waitForTimeout(500)

    // Select field (Figurinhas Criadas)
    const secondFieldCombo = await page.locator('button[role="combobox"]').nth(3)
    await secondFieldCombo.click()
    await page.waitForTimeout(300)
    await page.click('[role="option"]:has-text("Figurinhas Criadas")')
    await page.waitForTimeout(1000)

    // Fill number value
    const numberInput = await page.locator('input[type="number"]').last()
    await numberInput.fill('5')
    await page.waitForTimeout(3000) // Wait for preview

    await page.screenshot({ path: 'test-results/7-condition2-stickers.png', fullPage: true })
    console.log('✓ Screenshot 7: Second condition added')

    // Final full page screenshot
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/8-final-two-conditions.png', fullPage: true })
    console.log('✓ Screenshot 8: Final with two conditions')

    console.log('\n✅ All screenshots captured successfully!')
    console.log('Check test-results/ directory')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

main()
