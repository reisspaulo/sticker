import { test } from '@playwright/test';

test('test client-side navigation (clicking links)', async ({ page }) => {
  const multipleInstances: string[] = [];
  const supabaseLogs: string[] = [];

  // Set viewport para mostrar sidebar
  await page.setViewportSize({ width: 1920, height: 1080 });

  page.on('console', msg => {
    const text = msg.text();

    if (text.includes('[Supabase]')) {
      supabaseLogs.push(text);
      console.log(`📝 ${text}`);
    }

    if (text.includes('Multiple GoTrueClient')) {
      multipleInstances.push(text);
      console.log(`⚠️  MULTIPLE INSTANCE: ${text}`);
    }
  });

  console.log('\n=== TESTE DE NAVEGAÇÃO CLIENT-SIDE (clicando em links) ===\n');

  // Login (hard reload esperado aqui)
  console.log('1. Fazendo login...');
  await page.goto('https://admin-stickers.ytem.com.br/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'paulo.reis@ytem.com.br');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-stickers.ytem.com.br/', { timeout: 10000 });

  // Limpar logs de antes (login tem hard reload esperado)
  console.log('\n✅ Login completo. Limpando logs anteriores...');
  multipleInstances.length = 0;
  supabaseLogs.length = 0;

  await page.waitForTimeout(2000);

  // Agora testar navegação client-side
  console.log('\n2. Expandindo menu Stickers...');
  await page.click('button:has-text("Stickers")');
  await page.waitForTimeout(500);

  console.log('\n3. Clicando em "Emocoes" (navegação client-side)...');
  await page.click('a[href="/stickers/emotions"]');
  await page.waitForTimeout(3000);

  console.log('\n4. Clicando em "Celebridades" (navegação client-side)...');
  await page.click('a[href="/stickers/celebrities"]');
  await page.waitForTimeout(3000);

  console.log('\n5. Voltando ao Dashboard (navegação client-side)...');
  await page.click('a[href="/"]');
  await page.waitForTimeout(3000);

  console.log('\n6. Expandindo menu Usuarios...');
  await page.click('button:has-text("Usuarios")');
  await page.waitForTimeout(500);

  console.log('\n7. Clicando em "Lista" de usuarios (navegação client-side)...');
  await page.click('text=/Lista/i');
  await page.waitForTimeout(3000);

  console.log('\n=== RESULTADO (apenas navegação client-side) ===\n');
  console.log(`Total de logs Supabase: ${supabaseLogs.length}`);
  console.log(`Total de erros "Multiple Instances": ${multipleInstances.length}`);

  if (supabaseLogs.length > 0) {
    console.log('\n📝 LOGS SUPABASE:');
    supabaseLogs.forEach((log, i) => {
      console.log(`  ${i + 1}. ${log}`);
    });
  }

  if (multipleInstances.length > 0) {
    console.log('\n⚠️  INSTÂNCIAS DETECTADAS:');
    multipleInstances.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.substring(0, 150)}`);
    });
  }

  if (multipleInstances.length > 0) {
    throw new Error(`Encontrados ${multipleInstances.length} erros de múltiplas instâncias durante navegação client-side`);
  }

  console.log('\n✅ Nenhum erro de múltiplas instâncias durante navegação client-side!');
});
