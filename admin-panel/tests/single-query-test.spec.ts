import { test, expect } from '@playwright/test';

test('test single query after page load', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });

  page.on('request', request => {
    if (request.url().includes('supabase.co/rest')) {
      console.log(`[REQ] ${request.method()} ${request.url().substring(0, 80)}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('supabase.co/rest')) {
      console.log(`[RES ${response.status()}] ${response.url().substring(0, 80)}`);
    }
  });

  page.on('requestfailed', request => {
    if (request.url().includes('supabase.co')) {
      console.log(`[FAIL] ${request.url().substring(0, 80)} - ${request.failure()?.errorText}`);
    }
  });

  console.log('\n=== LOGIN ===\n');
  await page.goto('https://admin-stickers.ytem.com.br/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'paulo.reis@ytem.com.br');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-stickers.ytem.com.br/', { timeout: 15000 });

  console.log('\n=== AGUARDANDO PÁGINA ESTABILIZAR (15s) ===\n');
  await page.waitForTimeout(15000);

  console.log('\n=== VERIFICANDO VALORES ATUAIS DOS CARDS ===\n');

  const cardValues = await page.evaluate(() => {
    const getText = (selector: string) => {
      const el = document.querySelector(selector);
      return el ? el.textContent : null;
    };

    // Pegar os valores dos cards
    const cards = document.querySelectorAll('[class*="card"]');
    const values: string[] = [];
    cards.forEach((card, i) => {
      const text = card.textContent?.trim() || '';
      if (text.includes('Usuarios') || text.includes('Stickers') || text.includes('Pendente') || text.includes('Erros')) {
        values.push(text.replace(/\s+/g, ' ').substring(0, 100));
      }
    });
    return values;
  });

  console.log('Card values:');
  cardValues.forEach(v => console.log('  -', v));

  console.log('\n=== EXECUTANDO QUERY ÚNICA ===\n');

  // Fazer uma query única e simples
  const queryResult = await Promise.race([
    page.evaluate(async () => {
      const client = (window as any).__supabaseClient;
      if (!client) return { error: 'no client' };

      console.log('Starting single query...');
      const startTime = Date.now();

      try {
        const { count, error } = await client
          .from('users')
          .select('*', { count: 'exact', head: true });

        const duration = Date.now() - startTime;
        console.log('Query completed in', duration, 'ms');

        return { count, error: error?.message, duration };
      } catch (e) {
        return { error: String(e), duration: Date.now() - startTime };
      }
    }),
    new Promise(resolve => setTimeout(() => resolve({ error: 'TIMEOUT 30s' }), 30000))
  ]);

  console.log('Single query result:', JSON.stringify(queryResult, null, 2));

  // Tirar screenshot
  await page.screenshot({ path: '/tmp/dashboard-state.png', fullPage: true });
  console.log('\nScreenshot salvo em /tmp/dashboard-state.png');
});
