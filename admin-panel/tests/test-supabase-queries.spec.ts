import { test, expect } from '@playwright/test';

test('test supabase queries directly', async ({ page }) => {
  // Capturar TODOS os console logs
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
  });

  console.log('\n=== LOGIN ===\n');
  await page.goto('https://admin-stickers.ytem.com.br/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'paulo.reis@ytem.com.br');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-stickers.ytem.com.br/', { timeout: 15000 });

  await page.waitForTimeout(2000);

  console.log('\n=== EXECUTANDO QUERY DIRETA NO CONSOLE ===\n');

  // Verificar se o cliente existe primeiro
  const clientCheck = await page.evaluate(() => {
    const client = (window as any).__supabaseClient;
    return {
      hasClient: !!client,
      clientType: client ? typeof client : 'undefined',
      hasFrom: client ? typeof client.from : 'undefined'
    };
  });

  console.log('Client check:', JSON.stringify(clientCheck, null, 2));

  // Executar query diretamente no browser para testar (com timeout de 10s)
  const result = await Promise.race([
    page.evaluate(async () => {
      try {
        const client = (window as any).__supabaseClient;
        if (!client) {
          return { error: 'No supabase client found' };
        }

        console.log('Starting query...');
        const queryPromise = client
          .from('users')
          .select('*', { count: 'exact', head: true });

        console.log('Query promise created:', queryPromise);

        const { data, error, count } = await queryPromise;

        console.log('Query completed:', { count, error });

        return {
          hasClient: true,
          count,
          error: error ? error.message : null
        };
      } catch (e) {
        return { error: 'Exception: ' + String(e) };
      }
    }),
    new Promise(resolve => setTimeout(() => resolve({ error: 'TIMEOUT after 10s' }), 10000))
  ]);

  console.log('Query result:', JSON.stringify(result, null, 2));

  // Verificar o estado do loading
  const loadingState = await page.evaluate(() => {
    const skeletons = document.querySelectorAll('[class*="skeleton"]');
    const cards = document.querySelectorAll('[class*="card"]');
    return {
      skeletonsCount: skeletons.length,
      cardsCount: cards.length,
      bodyText: document.body.innerText.substring(0, 1000)
    };
  });

  console.log('\n=== ESTADO DA PÁGINA ===');
  console.log('Skeletons visíveis:', loadingState.skeletonsCount);
  console.log('Cards:', loadingState.cardsCount);
  console.log('Body text:', loadingState.bodyText);
});
