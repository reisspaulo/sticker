import { test } from '@playwright/test';

test('check for functional errors only (ignore warnings)', async ({ page }) => {
  const abortErrors: string[] = [];
  const fetchErrors: string[] = [];
  const otherErrors: string[] = [];

  // Set viewport para mostrar sidebar
  await page.setViewportSize({ width: 1920, height: 1080 });

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();

    // Capturar AbortErrors
    if (text.includes('AbortError')) {
      abortErrors.push(text);
      console.log(`❌ ABORT ERROR: ${text.substring(0, 100)}`);
    }

    // Capturar erros de fetch
    if (text.includes('Error fetching') || text.includes('error') && type === 'error') {
      // Ignorar o warning de múltiplas instâncias (não é um erro funcional)
      if (!text.includes('Multiple GoTrueClient')) {
        fetchErrors.push(text);
        console.log(`🔴 FETCH/ERROR: ${text.substring(0, 100)}`);
      }
    }
  });

  page.on('pageerror', error => {
    otherErrors.push(error.message);
    console.log(`💥 PAGE ERROR: ${error.message.substring(0, 100)}`);
  });

  console.log('\n=== TESTE DE ERROS FUNCIONAIS (ignorando warnings) ===\n');

  // Login
  console.log('1. Fazendo login...');
  await page.goto('https://admin-your-domain.com/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'TEST_PASSWORD');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-your-domain.com/', { timeout: 10000 });

  console.log('\n2. Aguardando dashboard carregar...');
  await page.waitForTimeout(3000);

  console.log('\n3. Expandindo menu Stickers...');
  await page.click('button:has-text("Stickers")');
  await page.waitForTimeout(500);

  console.log('\n4. Navegando para Emocoes...');
  await page.click('a[href="/stickers/emotions"]');
  await page.waitForTimeout(3000);

  console.log('\n5. Navegando para Celebridades...');
  await page.click('a[href="/stickers/celebrities"]');
  await page.waitForTimeout(3000);

  console.log('\n6. Expandindo menu Usuarios...');
  await page.click('button:has-text("Usuarios")');
  await page.waitForTimeout(500);

  console.log('\n7. Navegando para Lista de usuarios...');
  await page.click('text=/Lista/i');
  await page.waitForTimeout(3000);

  console.log('\n=== RESULTADO (apenas erros funcionais) ===\n');
  console.log(`Total de AbortErrors: ${abortErrors.length}`);
  console.log(`Total de erros de fetch: ${fetchErrors.length}`);
  console.log(`Total de outros erros de página: ${otherErrors.length}`);

  if (abortErrors.length > 0) {
    console.log('\n❌ ABORT ERRORS:');
    abortErrors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.substring(0, 150)}`);
    });
  }

  if (fetchErrors.length > 0) {
    console.log('\n🔴 FETCH ERRORS:');
    fetchErrors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.substring(0, 150)}`);
    });
  }

  if (otherErrors.length > 0) {
    console.log('\n💥 PAGE ERRORS:');
    otherErrors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.substring(0, 150)}`);
    });
  }

  const totalFunctionalErrors = abortErrors.length + fetchErrors.length + otherErrors.length;

  if (totalFunctionalErrors === 0) {
    console.log('\n✅ NENHUM ERRO FUNCIONAL DETECTADO!');
    console.log('   (Os warnings de "Multiple GoTrueClient" podem ser ignorados)');
  } else {
    throw new Error(`Encontrados ${totalFunctionalErrors} erros funcionais`);
  }
});
