import { test, expect } from '@playwright/test';

test('deep debug supabase', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });

  page.on('request', request => {
    const url = request.url();
    if (url.includes('supabase.co')) {
      console.log(`[REQUEST] ${request.method()} ${url}`);
    }
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('supabase.co')) {
      console.log(`[RESPONSE ${response.status()}] ${url}`);
    }
  });

  page.on('requestfailed', request => {
    console.log(`[FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });

  console.log('\n=== LOGIN ===\n');
  await page.goto('https://admin-your-domain.com/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'TEST_PASSWORD');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-your-domain.com/', { timeout: 15000 });

  await page.waitForTimeout(2000);

  console.log('\n=== VERIFICANDO AUTH STATE ===\n');

  const authState = await Promise.race([
    page.evaluate(async () => {
      const client = (window as any).__supabaseClient;
      if (!client) return { error: 'no client' };

      try {
        console.log('Calling getSession...');
        const result = await client.auth.getSession();
        console.log('getSession completed');
        const session = result?.data?.session;
        return {
          hasSession: !!session,
          accessToken: session?.access_token?.substring(0, 30) + '...',
          user: session?.user?.email,
        };
      } catch (e) {
        return { error: String(e) };
      }
    }),
    new Promise(resolve => setTimeout(() => resolve({ error: 'AUTH TIMEOUT 5s' }), 5000))
  ]);

  console.log('Auth state:', JSON.stringify(authState, null, 2));

  console.log('\n=== TESTANDO FETCH DIRETO COM ANON KEY ===\n');

  // Tentar fazer fetch direto SEM auth, só com anon key
  const fetchResult = await Promise.race([
    page.evaluate(async () => {
      try {
        const url = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co/rest/v1/users?select=id&limit=1';
        const response = await fetch(url, {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGx6dGpkdndzcndsemNvamUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNTI1NTU1MSwiZXhwIjoyMDUwODMxNTUxfQ.I8G92Dh9wvSqZBNiKxYLIkxImHLQTvUfXINZN9bMpIw',
            'Content-Type': 'application/json'
          }
        });

        const text = await response.text();
        return {
          status: response.status,
          body: text.substring(0, 200)
        };
      } catch (e) {
        return { error: String(e) };
      }
    }),
    new Promise(resolve => setTimeout(() => resolve({ error: 'FETCH TIMEOUT 5s' }), 5000))
  ]);

  console.log('Fetch result:', JSON.stringify(fetchResult, null, 2));

  console.log('\n=== FIM ===\n');
});
