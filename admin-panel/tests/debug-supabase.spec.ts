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
  await page.goto('https://admin-stickers.ytem.com.br/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'paulo.reis@ytem.com.br');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-stickers.ytem.com.br/', { timeout: 10000 });

  console.log('\n2. Dashboard carregado, esperando...');
  await page.waitForTimeout(3000);

  console.log('\n3. Navegando para Emotions...');
  await page.goto('https://admin-stickers.ytem.com.br/stickers/emotions', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('\n4. Navegando para Celebrities...');
  await page.goto('https://admin-stickers.ytem.com.br/stickers/celebrities', { waitUntil: 'networkidle' });
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
