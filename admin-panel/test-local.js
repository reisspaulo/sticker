const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capturar erros do console
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('❌ Console Error:', msg.text());
    }
  });

  // Capturar erros de página
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('💥 Page Error:', error.message);
  });

  try {
    console.log('🚀 Navegando para login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

    console.log('📝 Preenchendo credenciais...');
    await page.fill('input[type="email"]', 'paulo.reis@your-domain.com');
    await page.fill('input[type="password"]', 'Admin@2026');

    console.log('🔐 Fazendo login...');
    await page.click('button[type="submit"]');

    // Aguardar redirecionamento
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    console.log('✅ Login bem-sucedido!');

    // Aguardar carregamento da dashboard
    await page.waitForTimeout(2000);

    console.log('📊 Navegando para /stickers...');
    await page.goto('http://localhost:3000/stickers', { waitUntil: 'networkidle' });

    // Aguardar carregamento
    await page.waitForTimeout(3000);

    // Verificar se há erros de hydration
    const hasHydrationError = errors.some(err =>
      err.includes('Minified React error #185') ||
      err.includes('Hydration') ||
      err.includes('Maximum update depth')
    );

    const hasMultipleClientError = errors.some(err =>
      err.includes('Multiple GoTrueClient instances')
    );

    console.log('\n📋 RESULTADOS:');
    console.log('================');
    console.log('Erro de Hydration (#185):', hasHydrationError ? '❌ SIM' : '✅ NÃO');
    console.log('Múltiplos GoTrueClient:', hasMultipleClientError ? '❌ SIM' : '✅ NÃO');
    console.log('Total de erros capturados:', errors.length);

    if (errors.length > 0) {
      console.log('\n🔍 Erros encontrados:');
      errors.forEach((err, i) => console.log(`  ${i + 1}. ${err.substring(0, 150)}...`));
    }

    // Tirar screenshot
    await page.screenshot({ path: '/Users/paulohenrique/sticker/admin-panel/test-screenshot.png', fullPage: true });
    console.log('\n📸 Screenshot salvo em test-screenshot.png');

    // Manter navegador aberto por 5 segundos para inspeção
    console.log('\n⏳ Mantendo navegador aberto por 10 segundos para inspeção...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('💥 Erro durante o teste:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Teste concluído!');
  }
})();
