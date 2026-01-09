import { test } from '@playwright/test';

test('extended navigation with error tracking', async ({ page }) => {
  const multipleInstances: string[] = [];
  const abortErrors: string[] = [];

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('Multiple GoTrueClient')) {
      multipleInstances.push(text);
      console.log(`⚠️  MULTIPLE INSTANCE: ${text}`);
    }

    if (text.includes('AbortError')) {
      abortErrors.push(text);
      console.log(`❌ ABORT ERROR: ${text}`);
    }

    if (text.includes('Error fetching')) {
      console.log(`🔴 FETCH ERROR: ${text}`);
    }
  });

  console.log('\n=== TESTE ESTENDIDO ===\n');

  // Login
  console.log('1. Login...');
  await page.goto('https://admin-stickers.ytem.com.br/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'paulo.reis@ytem.com.br');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-stickers.ytem.com.br/', { timeout: 10000 });

  console.log('2. Dashboard carregado, esperando 10s...');
  await page.waitForTimeout(10000);

  console.log('3. Navegando para Celebrities...');
  await page.click('text=/Celebridades/i').catch(() => {
    console.log('   Link não encontrado, tentando outro seletor...');
  });
  await page.waitForTimeout(5000);

  console.log('4. Navegando para Emotions...');
  await page.goto('https://admin-stickers.ytem.com.br/stickers/emotions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  console.log('5. Voltando para Dashboard...');
  await page.goto('https://admin-stickers.ytem.com.br/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  // Reload para forçar reinicialização
  console.log('6. Recarregando página...');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);

  console.log('\n=== RESULTADO FINAL ===\n');
  console.log(`Total de erros "Multiple Instances": ${multipleInstances.length}`);
  console.log(`Total de "AbortError": ${abortErrors.length}`);

  if (multipleInstances.length > 0) {
    console.log('\n⚠️  INSTÂNCIAS DETECTADAS:');
    multipleInstances.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.substring(0, 150)}`);
    });
  }

  if (abortErrors.length > 0) {
    console.log('\n❌ ABORT ERRORS DETECTADOS:');
    abortErrors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.substring(0, 150)}`);
    });
  }

  await page.screenshot({ path: 'test-results/final-state.png', fullPage: true });

  if (multipleInstances.length > 0 || abortErrors.length > 0) {
    throw new Error(`Encontrados ${multipleInstances.length} erros de instância e ${abortErrors.length} AbortErrors`);
  }
});
