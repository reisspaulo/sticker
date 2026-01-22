import { test, expect } from '@playwright/test';

test('debug login flow', async ({ page }) => {
  // Capturar logs do console
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log('BROWSER LOG:', text);
  });

  // Capturar erros de rede
  page.on('requestfailed', request => {
    console.log('❌ REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });

  // Ir para a página de login
  console.log('📍 Navegando para /login...');
  await page.goto('https://admin-your-domain.com/login');

  // Esperar a página carregar
  await page.waitForLoadState('networkidle');
  console.log('✅ Página carregada');

  // Verificar se Supabase foi configurado
  await page.waitForTimeout(1000);
  const supabaseLog = logs.find(log => log.includes('Supabase configured'));
  console.log('🔍 Supabase config log:', supabaseLog);

  // Preencher o formulário
  console.log('📝 Preenchendo formulário...');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'TEST_PASSWORD');

  console.log('🖱️ Clicando em Entrar...');

  // Interceptar requisições para Supabase
  const requestPromises: Promise<any>[] = [];
  page.on('request', request => {
    if (request.url().includes('supabase')) {
      console.log('🌐 REQUEST:', request.method(), request.url());
      requestPromises.push(
        request.response().then(response => {
          console.log('📥 RESPONSE:', response?.status(), request.url());
        }).catch(() => {})
      );
    }
  });

  await page.click('button[type="submit"]');

  // Esperar um pouco para logs aparecerem
  await page.waitForTimeout(5000);

  console.log('\n📋 TODOS OS LOGS:');
  logs.forEach(log => console.log('  -', log));

  // Verificar se ainda está na página de login
  const currentUrl = page.url();
  console.log('\n📍 URL atual:', currentUrl);

  // Verificar se há mensagem de erro visível
  const errorMessage = await page.locator('text=/erro|error/i').textContent().catch(() => null);
  if (errorMessage) {
    console.log('❌ Mensagem de erro:', errorMessage);
  }

  // Verificar estado do botão
  const buttonText = await page.locator('button[type="submit"]').textContent();
  console.log('🔘 Texto do botão:', buttonText);

  // Esperar todas as requisições
  await Promise.all(requestPromises);
});
