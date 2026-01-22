import { test, expect } from '@playwright/test';

test('check dashboard errors', async ({ page }) => {
  const logs: string[] = [];
  const errors: string[] = [];

  // Capturar logs e erros do console
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);

    // Detectar erros específicos
    if (text.includes('Multiple GoTrueClient')) {
      errors.push('ERRO: ' + text);
    }
    if (text.includes('AbortError')) {
      errors.push('ERRO: ' + text);
    }
  });

  // Fazer login
  await page.goto('https://admin-your-domain.com/login');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'TEST_PASSWORD');
  await page.click('button[type="submit"]');

  // Esperar carregar o dashboard
  await page.waitForURL('https://admin-your-domain.com/', { timeout: 10000 });
  console.log('✅ Redirecionou para dashboard');

  // Esperar a página carregar completamente
  await page.waitForTimeout(3000);

  // Verificar se há erros
  console.log('\n=== ANÁLISE DE ERROS ===');

  const multipleInstancesErrors = errors.filter(e => e.includes('Multiple GoTrueClient'));
  const abortErrors = errors.filter(e => e.includes('AbortError'));

  console.log(`\nErros de múltiplas instâncias: ${multipleInstancesErrors.length}`);
  multipleInstancesErrors.forEach(e => console.log('  -', e));

  console.log(`\nErros de AbortError: ${abortErrors.length}`);
  abortErrors.forEach(e => console.log('  -', e));

  // Verificar se a página está funcional
  const hasContent = await page.locator('text=/usuários|stickers/i').count() > 0;
  console.log(`\nConteúdo do dashboard carregado: ${hasContent ? 'SIM' : 'NÃO'}`);

  // Falhar se houver erros críticos
  if (multipleInstancesErrors.length > 0) {
    throw new Error(`Encontrados ${multipleInstancesErrors.length} erros de múltiplas instâncias`);
  }
});
