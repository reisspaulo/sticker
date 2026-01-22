import { test } from '@playwright/test';

test('debug supabase client creation', async ({ page }) => {
  const allLogs: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    allLogs.push(text);

    // Log tudo que contém "Supabase" ou "Multiple"
    if (text.includes('[Supabase]') || text.includes('Multiple GoTrueClient')) {
      console.log(`📝 ${text}`);
    }
  });

  console.log('\n=== TESTE DE DEBUG DO SUPABASE ===\n');

  // Login
  console.log('1. Fazendo login...');
  await page.goto('https://admin-your-domain.com/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'TEST_PASSWORD');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-your-domain.com/', { timeout: 10000 });

  console.log('\n2. Dashboard carregado, esperando...');
  await page.waitForTimeout(3000);

  console.log('\n3. Navegando para Emotions...');
  await page.goto('https://admin-your-domain.com/stickers/emotions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('\n4. Navegando para Celebrities...');
  await page.goto('https://admin-your-domain.com/stickers/celebrities', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('\n=== TODOS OS LOGS SUPABASE ===\n');
  const supabaseLogs = allLogs.filter(log => log.includes('[Supabase]'));
  supabaseLogs.forEach((log, i) => {
    console.log(`${i + 1}. ${log}`);
  });

  console.log('\n=== ERROS DE MÚLTIPLAS INSTÂNCIAS ===\n');
  const multipleInstanceLogs = allLogs.filter(log => log.includes('Multiple GoTrueClient'));
  multipleInstanceLogs.forEach((log, i) => {
    console.log(`${i + 1}. ${log}`);
  });
});
