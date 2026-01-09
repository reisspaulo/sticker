import { test, expect } from '@playwright/test';

test('check dashboard data loading', async ({ page }) => {
  const networkRequests: { url: string; status: number; data?: string }[] = [];
  const allErrors: string[] = [];

  // Capturar TODAS as requisições (não só respostas)
  page.on('request', request => {
    const url = request.url();
    if (url.includes('supabase.co') && url.includes('rest')) {
      console.log(`[REQUEST] ${request.method()} ${url.substring(0, 120)}`);
    }
  });

  // Capturar todas as respostas de rede do Supabase
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('supabase.co')) {
      const status = response.status();
      let data = '';
      try {
        data = await response.text();
      } catch (e) {
        data = 'FAILED TO READ BODY: ' + String(e);
      }
      networkRequests.push({ url, status, data: data.substring(0, 500) });
      console.log(`[RESPONSE] ${status} ${url.substring(0, 120)}`);
      if (status >= 400 || data.includes('error')) {
        console.log(`[ERROR DATA] ${data.substring(0, 300)}`);
      }
    }
  });

  // Capturar request failures
  page.on('requestfailed', request => {
    const url = request.url();
    if (url.includes('supabase.co')) {
      const failure = request.failure();
      console.log(`[REQUEST FAILED] ${url.substring(0, 100)} - ${failure?.errorText}`);
      allErrors.push(`${url} - ${failure?.errorText}`);
    }
  });

  // Capturar erros
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
    allErrors.push(err.message);
  });

  // Capturar TODOS os console logs
  page.on('console', msg => {
    const text = msg.text();
    console.log(`[CONSOLE ${msg.type()}] ${text}`);
    if (msg.type() === 'error' || text.includes('Abort') || text.includes('error')) {
      allErrors.push(text);
    }
  });

  console.log('\n=== LOGIN ===\n');
  await page.goto('https://admin-stickers.ytem.com.br/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'paulo.reis@ytem.com.br');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin-stickers.ytem.com.br/', { timeout: 15000 });

  console.log('\n=== DASHBOARD CARREGADO - ESPERANDO 10s ===\n');

  // Esperar os dados carregarem - MAIS TEMPO
  await page.waitForTimeout(10000);

  // Verificar os valores nos cards
  const usersCard = await page.locator('text=Usuarios Hoje').locator('..').locator('..').textContent();
  const stickersCard = await page.locator('text=Stickers Hoje').locator('..').locator('..').textContent();
  const pendingCard = await page.locator('text=Pendente Classificacao').locator('..').locator('..').textContent();
  const errorsCard = await page.locator('text=Erros Hoje').locator('..').locator('..').textContent();

  console.log('\n=== VALORES NOS CARDS ===');
  console.log('Usuarios Hoje:', usersCard);
  console.log('Stickers Hoje:', stickersCard);
  console.log('Pendente Classificacao:', pendingCard);
  console.log('Erros Hoje:', errorsCard);

  console.log('\n=== REQUESTS SUPABASE ===');
  networkRequests.forEach((req, i) => {
    console.log(`${i + 1}. [${req.status}] ${req.url.substring(0, 80)}`);
    if (req.data && req.status === 200) {
      console.log(`   Data: ${req.data.substring(0, 100)}...`);
    }
  });

  // Verificar se os valores não são zero (tem dados no banco)
  const usersMatch = usersCard?.match(/\d+/);
  const stickersMatch = stickersCard?.match(/\d+/);

  console.log('\n=== RESULTADO ===');
  console.log('Users today value:', usersMatch ? usersMatch[0] : 'NOT FOUND');
  console.log('Stickers today value:', stickersMatch ? stickersMatch[0] : 'NOT FOUND');
});
