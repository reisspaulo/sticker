import { test, expect } from '@playwright/test';

test('test if busy wait is causing issues', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.text()}`);
  });

  console.log('\n=== LOGIN ===\n');
  await page.goto('https://admin-stickers.ytem.com.br/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'paulo.reis@ytem.com.br');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-stickers.ytem.com.br/', { timeout: 15000 });

  await page.waitForTimeout(2000);

  console.log('\n=== VERIFICANDO ESTADO DO CLIENTE ===\n');

  const state = await page.evaluate(() => {
    return {
      hasClient: !!(window as any).__supabaseClient,
      isCreating: !!(window as any).__supabaseClientCreating,
      clientKeys: (window as any).__supabaseClient ? Object.keys((window as any).__supabaseClient) : []
    };
  });

  console.log('Client state:', JSON.stringify(state, null, 2));

  console.log('\n=== SIMULANDO CRIAÇÃO CONCORRENTE ===\n');

  // Simular o que acontece quando múltiplos módulos chamam getSupabaseBrowserClient
  const concurrentResult = await page.evaluate(async () => {
    const logs: string[] = [];

    // Simular o comportamento do busy wait
    const testBusyWait = () => {
      const start = Date.now();
      let iterations = 0;

      // Se __supabaseClientCreating estiver true, isso vai travar
      if ((window as any).__supabaseClientCreating) {
        logs.push('WARNING: __supabaseClientCreating is true! Busy wait would block!');
        return { blocked: true, logs };
      }

      // Testar se o cliente responde
      const client = (window as any).__supabaseClient;
      if (client) {
        logs.push('Client exists and is accessible');

        // Tentar fazer uma operação simples
        const authPromise = client.auth.getUser();
        logs.push('auth.getUser() called');

        return { blocked: false, hasClient: true, logs };
      }

      return { blocked: false, hasClient: false, logs };
    };

    return testBusyWait();
  });

  console.log('Concurrent test:', JSON.stringify(concurrentResult, null, 2));

  console.log('\n=== TESTANDO SE O PROBLEMA É O ABORT SIGNAL ===\n');

  // Verificar se há AbortController internos
  const abortTest = await page.evaluate(() => {
    const client = (window as any).__supabaseClient;
    if (!client) return { error: 'no client' };

    // Verificar a estrutura interna do cliente
    const internalState = {
      hasRest: !!client.rest,
      hasAuth: !!client.auth,
      authKeys: client.auth ? Object.keys(client.auth) : [],
      // Verificar se há referência a abort
      clientString: String(client).substring(0, 100)
    };

    return internalState;
  });

  console.log('Abort test:', JSON.stringify(abortTest, null, 2));
});
