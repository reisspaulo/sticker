import { test, expect } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'aXGM7Y2ZPSUw5He'

test('Manual Demo - Audience Builder', async ({ page }) => {
  // 1. Login
  console.log('1. Fazendo login...')
  await page.goto('/login')
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'test-results/demo-1-dashboard.png', fullPage: true })
  console.log('✓ Login realizado')

  // 2. Ir para nova campanha
  console.log('2. Navegando para nova campanha...')
  await page.goto('/campaigns/new')
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: 'test-results/demo-2-step1.png', fullPage: true })
  console.log('✓ Step 1 carregado')

  // 3. Preencher Step 1
  console.log('3. Preenchendo informações básicas...')
  await page.fill('input#name', 'Campanha Teste Demo')
  await page.fill('textarea[placeholder*="Descrição"]', 'Esta é uma campanha de demonstração do Audience Builder')
  await page.screenshot({ path: 'test-results/demo-3-step1-filled.png', fullPage: true })
  console.log('✓ Step 1 preenchido')

  // 4. Avançar para Step 2
  console.log('4. Avançando para Step 2 (Trigger)...')
  await page.click('button:has-text("Próximo")')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/demo-4-step2.png', fullPage: true })
  console.log('✓ Step 2 carregado')

  // 5. Avançar para Step 3 (Audiência)
  console.log('5. Avançando para Step 3 (Audiência)...')
  await page.click('button:has-text("Próximo")')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/demo-5-step3-empty.png', fullPage: true })
  console.log('✓ Step 3 carregado - Audience Builder visível!')

  // 6. Adicionar primeira condição - Plano = Free
  console.log('6. Adicionando primeira condição: Plano = Free')
  await page.click('button:has-text("Adicionar Condição")')
  await page.waitForTimeout(500)

  // Selecionar campo
  const fieldSelects = page.locator('button[role="combobox"]')
  await fieldSelects.first().click()
  await page.waitForTimeout(300)
  await page.click('text=Plano')
  await page.waitForTimeout(500)

  // Selecionar valor
  await page.locator('button[role="combobox"]:has-text("Selecione")').first().click()
  await page.waitForTimeout(300)
  await page.click('[role="option"]:has-text("Free")')
  await page.waitForTimeout(3000) // Esperar preview carregar

  await page.screenshot({ path: 'test-results/demo-6-condition1.png', fullPage: true })
  console.log('✓ Primeira condição adicionada')

  // 7. Adicionar segunda condição - Figurinhas > 5
  console.log('7. Adicionando segunda condição: Figurinhas Criadas > 5')
  await page.click('button:has-text("Adicionar Condição")')
  await page.waitForTimeout(500)

  // Selecionar campo
  const fieldSelects2 = page.locator('button[role="combobox"]').nth(3)
  await fieldSelects2.click()
  await page.waitForTimeout(300)
  await page.click('text=Figurinhas Criadas')
  await page.waitForTimeout(500)

  // Selecionar operador
  const operatorSelect = page.locator('button[role="combobox"]:has-text("maior que")').first()
  await operatorSelect.click()
  await page.waitForTimeout(300)
  await page.click('[role="option"]:has-text("maior que")')
  await page.waitForTimeout(300)

  // Digitar valor
  const numberInput = page.locator('input[type="number"]').last()
  await numberInput.fill('5')
  await page.waitForTimeout(3000) // Esperar preview carregar

  await page.screenshot({ path: 'test-results/demo-7-condition2.png', fullPage: true })
  console.log('✓ Segunda condição adicionada')

  // 8. Scroll para ver o preview completo
  console.log('8. Capturando preview de audiência...')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/demo-8-preview-full.png', fullPage: true })
  console.log('✓ Preview capturado')

  // 9. Adicionar terceira condição - País Brasil
  console.log('9. Adicionando terceira condição: País = Brasil')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  await page.click('button:has-text("Adicionar Condição")')
  await page.waitForTimeout(500)

  // Selecionar campo
  const fieldSelects3 = page.locator('button[role="combobox"]').nth(6)
  await fieldSelects3.click()
  await page.waitForTimeout(300)
  await page.click('text=País')
  await page.waitForTimeout(500)

  // Selecionar valor
  await page.locator('button[role="combobox"]:has-text("Selecione")').last().click()
  await page.waitForTimeout(300)
  await page.click('[role="option"]:has-text("Brasil")')
  await page.waitForTimeout(3000) // Esperar preview carregar

  await page.screenshot({ path: 'test-results/demo-9-condition3.png', fullPage: true })
  console.log('✓ Terceira condição adicionada')

  // 10. Captura final com todas as condições
  console.log('10. Captura final...')
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/demo-10-final.png', fullPage: true })
  console.log('✓ Demo completo!')

  console.log('\n=== DEMO CONCLUÍDO ===')
  console.log('Screenshots salvos em test-results/')
})
