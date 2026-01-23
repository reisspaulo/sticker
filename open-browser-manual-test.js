const { chromium } = require('playwright');

// Abre browser e deixa aberto para teste manual
(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 0
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Login primeiro
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'paulo.reis@your-domain.com');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');

  await page.waitForURL('http://localhost:3000/');
  console.log('✅ Login feito, redirecionado para dashboard');

  await page.waitForTimeout(2000);

  // Navegar para /stickers
  await page.goto('http://localhost:3000/stickers');
  console.log('✅ Navegado para /stickers');

  console.log('\n📋 Instrução:');
  console.log('   1. O browser está aberto em /stickers');
  console.log('   2. Abra o DevTools (F12)');
  console.log('   3. Vá na aba Console');
  console.log('   4. Procure pelos logs que começam com 🔍');
  console.log('   5. Veja até qual [número] o código chegou');
  console.log('   6. Pressione Ctrl+C aqui quando terminar\n');

  // Manter aberto indefinidamente
  await page.waitForTimeout(600000);
})();
