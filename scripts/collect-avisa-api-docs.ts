import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to collect Avisa API documentation from Postman
 *
 * This script opens a browser window and navigates to the Postman collection.
 * If login is required, the user can do it manually in the browser window.
 */

async function collectAvisaApiDocs() {
  console.log('🚀 Iniciando coleta de documentação da Avisa API...\n');

  // Launch browser in headful mode (visible) so user can login if needed
  const browser = await chromium.launch({
    headless: false, // Visible browser for manual login
    slowMo: 100, // Slow down actions for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    console.log('📂 Abrindo Postman collection...');
    await page.goto('https://www.postman.com/mw10/avisa-api/collection/fjeb27a/avisa-api', {
      waitUntil: 'domcontentloaded', // More flexible than networkidle
      timeout: 90000,
    });

    console.log('⏳ Aguardando página carregar completamente...');
    await page.waitForTimeout(5000);

    console.log('✅ Página carregada!');
    console.log('\n⏸️  Se precisar fazer login, faça agora na janela do navegador.');
    console.log('⏸️  Quando terminar o login e a coleção estiver visível, aguarde 10 segundos...\n');

    // Wait 30 seconds for user to login if needed
    await page.waitForTimeout(30000);

    console.log('🔍 Coletando dados da API...\n');

    // Wait for collection to load
    await page.waitForSelector('[data-testid="collection-sidebar"]', { timeout: 30000 });

    // Extract all endpoints from the sidebar
    const endpoints = await page.evaluate(() => {
      const results: any[] = [];

      // Try to find all request items in the sidebar
      const requestItems = document.querySelectorAll('[data-testid*="request"], [class*="request-item"], [class*="sidebar-item"]');

      console.log('Found elements:', requestItems.length);

      requestItems.forEach((item, index) => {
        const text = item.textContent || '';
        results.push({
          index,
          text: text.trim(),
          html: item.innerHTML.substring(0, 200),
        });
      });

      return results;
    });

    console.log(`📊 Encontrados ${endpoints.length} elementos\n`);

    // Try to extract more detailed information
    const detailedInfo = await page.evaluate(() => {
      const data: any = {
        title: document.title,
        bodyText: document.body.innerText.substring(0, 5000),
        allLinks: [] as any[],
        apiEndpoints: [] as any[],
      };

      // Get all links
      document.querySelectorAll('a').forEach((link) => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim();
        if (text && (text.includes('send') || text.includes('Send') || text.includes('message') || text.includes('button'))) {
          data.allLinks.push({ text, href });
        }
      });

      // Look for API-related text
      const bodyText = document.body.innerText;
      const apiMatches = bodyText.matchAll(/(?:POST|GET|PUT|DELETE|PATCH)\s+([^\s]+)/g);
      for (const match of apiMatches) {
        data.apiEndpoints.push({
          method: match[0].split(' ')[0],
          path: match[1],
        });
      }

      return data;
    });

    console.log('📄 Informações coletadas:');
    console.log('Título:', detailedInfo.title);
    console.log('Links relevantes:', detailedInfo.allLinks.length);
    console.log('Endpoints encontrados:', detailedInfo.apiEndpoints.length);

    // Take a screenshot for reference
    const screenshotPath = path.join(process.cwd(), 'avisa-api-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Screenshot salvo em: ${screenshotPath}`);

    // Save collected data
    const outputPath = path.join(process.cwd(), 'avisa-api-docs.json');
    const output = {
      collectedAt: new Date().toISOString(),
      url: 'https://www.postman.com/mw10/avisa-api/collection/fjeb27a/avisa-api',
      endpoints,
      detailedInfo,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`💾 Dados salvos em: ${outputPath}\n`);

    // Wait a bit more to allow manual inspection
    console.log('⏸️  Aguardando 10 segundos para inspeção manual...');
    await page.waitForTimeout(10000);

    // Now try to access the HAR (HTTP Archive) data
    console.log('\n🌐 Capturando requisições de rede...');

    // Get all network requests that might contain API data
    const networkData = await page.evaluate(() => {
      const performanceEntries = performance.getEntriesByType('resource');
      return performanceEntries
        .filter((entry: any) => entry.name.includes('postman') || entry.name.includes('api'))
        .map((entry: any) => ({
          name: entry.name,
          type: entry.initiatorType,
          duration: entry.duration,
        }));
    });

    console.log(`📡 Requisições de rede: ${networkData.length}`);

    output.networkData = networkData;
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log('\n✅ Coleta concluída!');
    console.log('📂 Verifique os arquivos:');
    console.log(`   - ${outputPath}`);
    console.log(`   - ${screenshotPath}`);

  } catch (error) {
    console.error('❌ Erro durante a coleta:', error);

    // Save error screenshot
    const errorScreenshot = path.join(process.cwd(), 'avisa-api-error.png');
    await page.screenshot({ path: errorScreenshot, fullPage: true });
    console.log(`📸 Screenshot do erro salvo em: ${errorScreenshot}`);

    throw error;
  } finally {
    console.log('\n⏸️  Fechando navegador em 5 segundos...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

// Run the script
collectAvisaApiDocs()
  .then(() => {
    console.log('\n✨ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script falhou:', error.message);
    process.exit(1);
  });
