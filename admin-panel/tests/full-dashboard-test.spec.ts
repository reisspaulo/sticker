import { test } from '@playwright/test';

test('full dashboard analysis with real credentials', async ({ page }) => {
  const allLogs: string[] = [];
  const multipleInstancesCount = new Map<number, string>();
  const abortErrors: string[] = [];
  const otherErrors: string[] = [];

  // Capturar TODOS os logs do console
  page.on('console', msg => {
    const text = msg.text();
    allLogs.push(text);

    // Detectar múltiplas instâncias com número
    const multipleMatch = text.match(/GoTrueClient@.*:(\d+).*Multiple GoTrueClient instances/);
    if (multipleMatch) {
      const instanceNum = parseInt(multipleMatch[1]);
      multipleInstancesCount.set(instanceNum, text);
      console.log(`⚠️  INSTÂNCIA #${instanceNum}: ${text.substring(0, 100)}...`);
    }

    // Detectar AbortError
    if (text.includes('AbortError')) {
      abortErrors.push(text);
      console.log(`❌ ABORT ERROR: ${text.substring(0, 100)}...`);
    }

    // Detectar outros erros
    if (text.includes('Error fetching') || text.includes('error') && !text.includes('AbortError')) {
      otherErrors.push(text);
      console.log(`🔴 ERROR: ${text.substring(0, 100)}...`);
    }
  });

  // Capturar erros de rede
  page.on('requestfailed', request => {
    const failure = request.failure();
    console.log(`🌐 REQUEST FAILED: ${request.url()} - ${failure?.errorText}`);
  });

  console.log('\n=== INICIANDO TESTE ===\n');

  // Ir para login
  console.log('1. Navegando para /login...');
  await page.goto('https://admin-stickers.ytem.com.br/login');
  await page.waitForLoadState('networkidle');

  // Fazer login
  console.log('2. Fazendo login...');
  await page.fill('input[type="email"]', 'paulo.reis@ytem.com.br');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');

  // Aguardar redirect
  console.log('3. Aguardando redirect...');
  await page.waitForURL('https://admin-stickers.ytem.com.br/', { timeout: 15000 });
  console.log('✅ Redirecionou para dashboard');

  // Esperar a página carregar COMPLETAMENTE
  console.log('4. Esperando dashboard carregar...');
  await page.waitForTimeout(5000);

  // Tentar interagir com elementos
  console.log('5. Verificando conteúdo...');
  const hasCards = await page.locator('.card, [class*="card"]').count();
  console.log(`   - Cards encontrados: ${hasCards}`);

  // ANÁLISE FINAL
  console.log('\n=== ANÁLISE FINAL ===\n');
  console.log(`Total de logs capturados: ${allLogs.length}`);
  console.log(`Instâncias do GoTrueClient detectadas: ${multipleInstancesCount.size}`);
  console.log(`AbortErrors: ${abortErrors.length}`);
  console.log(`Outros erros: ${otherErrors.length}`);

  if (multipleInstancesCount.size > 0) {
    console.log('\n📊 DETALHES DAS INSTÂNCIAS:');
    multipleInstancesCount.forEach((log, num) => {
      console.log(`  Instância #${num}`);
    });
  }

  if (abortErrors.length > 0) {
    console.log('\n💥 PRIMEIROS 3 ABORT ERRORS:');
    abortErrors.slice(0, 3).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.substring(0, 150)}...`);
    });
  }

  if (otherErrors.length > 0) {
    console.log('\n🔴 OUTROS ERROS:');
    otherErrors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  }

  // Fazer screenshot
  await page.screenshot({ path: 'test-results/dashboard-state.png', fullPage: true });
  console.log('\n📸 Screenshot salvo em: test-results/dashboard-state.png');
});
