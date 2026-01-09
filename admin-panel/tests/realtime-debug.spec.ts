import { test, expect } from '@playwright/test';

test('realtime debug - watch dashboard loading', async ({ page }) => {
  // Capturar TUDO
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('supabase.co/rest')) {
      const status = response.status();
      console.log(`[${status}] ${url.substring(url.indexOf('/rest'), 80)}`);

      if (status >= 400) {
        try {
          const body = await response.text();
          console.log(`  ERROR: ${body.substring(0, 200)}`);
        } catch {}
      }
    }
  });

  console.log('=== ABRINDO LOGIN ===');
  await page.goto('https://admin-stickers.ytem.com.br/login', { waitUntil: 'networkidle' });

  console.log('=== FAZENDO LOGIN ===');
  await page.fill('input[type="email"]', 'paulo.reis@ytem.com.br');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL('**/admin-stickers.ytem.com.br/', { timeout: 15000 });
    console.log('=== DASHBOARD CARREGADO ===');
  } catch {
    console.log('=== TIMEOUT ESPERANDO DASHBOARD ===');
    await page.screenshot({ path: '/tmp/timeout-state.png' });
  }

  // Monitorar valores a cada 2 segundos
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);

    const values = await page.evaluate(() => {
      const getCardValue = (title: string) => {
        const cards = Array.from(document.querySelectorAll('div'));
        for (const card of cards) {
          if (card.textContent?.includes(title)) {
            const match = card.textContent.match(new RegExp(title + '\\s*(\\d+)'));
            if (match) return match[1];
          }
        }
        return '?';
      };

      return {
        usuarios: getCardValue('Usuarios Hoje'),
        stickers: getCardValue('Stickers Hoje'),
        pendente: getCardValue('Pendente'),
        erros: getCardValue('Erros Hoje'),
        skeletons: document.querySelectorAll('[class*="skeleton"]').length
      };
    });

    console.log(`[${(i+1)*2}s] Usuarios=${values.usuarios} Stickers=${values.stickers} Pendente=${values.pendente} Erros=${values.erros} Skeletons=${values.skeletons}`);
  }

  await page.screenshot({ path: '/tmp/final-state.png', fullPage: true });
  console.log('Screenshot salvo em /tmp/final-state.png');
});
