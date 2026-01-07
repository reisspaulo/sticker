import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simplified script - Opens browser and waits for manual navigation
 * User can login and navigate to the collection, then script extracts data
 */

async function collectAvisaApiSimple() {
  console.log('🚀 Script simplificado para coletar Avisa API\n');
  console.log('📋 INSTRUÇÕES:');
  console.log('   1. O navegador vai abrir');
  console.log('   2. Navegue até: https://www.postman.com/mw10/avisa-api/collection/fjeb27a/avisa-api');
  console.log('   3. Faça login se necessário');
  console.log('   4. Aguarde a coleção carregar completamente');
  console.log('   5. O script vai extrair os dados automaticamente após 60 segundos\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    // Just open a blank page first
    await page.goto('about:blank');

    console.log('✅ Navegador aberto!');
    console.log('\n👉 Navegue manualmente para a collection da Avisa API');
    console.log('👉 Você tem 60 segundos...\n');

    // Wait 60 seconds for user to navigate and login
    await page.waitForTimeout(60000);

    console.log('🔍 Extraindo dados da página atual...\n');

    const currentUrl = page.url();
    console.log(`📍 URL atual: ${currentUrl}`);

    // Extract all visible text
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        bodyText: document.body.innerText,
        html: document.body.innerHTML.substring(0, 10000),
      };
    });

    // Look for API endpoints in the text
    const endpoints: any[] = [];
    const lines = pageContent.bodyText.split('\n');

    lines.forEach((line, index) => {
      // Look for HTTP methods
      if (line.match(/\b(GET|POST|PUT|DELETE|PATCH)\b/i)) {
        endpoints.push({
          lineNumber: index,
          content: line.trim(),
        });
      }

      // Look for /api/ paths
      if (line.includes('/api/') || line.includes('sendMessage') || line.includes('sendButton')) {
        endpoints.push({
          lineNumber: index,
          content: line.trim(),
          type: 'path',
        });
      }
    });

    console.log(`\n📊 Endpoints encontrados: ${endpoints.length}`);

    // Try to find request details
    const requestDetails = await page.evaluate(() => {
      const details: any[] = [];

      // Look for code blocks, pre tags, or JSON
      document.querySelectorAll('pre, code, [class*="json"], [class*="code"]').forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length > 10 && text.length < 5000) {
          details.push({
            tag: el.tagName,
            className: el.className,
            content: text,
          });
        }
      });

      return details;
    });

    console.log(`📄 Blocos de código encontrados: ${requestDetails.length}`);

    // Take screenshot
    const screenshotPath = path.join(process.cwd(), 'avisa-api-collected.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot: ${screenshotPath}`);

    // Save everything
    const outputPath = path.join(process.cwd(), 'avisa-api-collected.json');
    const output = {
      collectedAt: new Date().toISOString(),
      url: currentUrl,
      title: pageContent.title,
      endpoints,
      requestDetails,
      fullText: pageContent.bodyText,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`💾 Dados salvos: ${outputPath}\n`);

    // Also save raw text for easier reading
    const textPath = path.join(process.cwd(), 'avisa-api-collected.txt');
    fs.writeFileSync(textPath, pageContent.bodyText, 'utf-8');
    console.log(`📝 Texto salvo: ${textPath}\n`);

    console.log('✅ Coleta concluída!');
    console.log('\n📂 Arquivos gerados:');
    console.log(`   - ${outputPath}`);
    console.log(`   - ${textPath}`);
    console.log(`   - ${screenshotPath}`);

    console.log('\n⏸️  Fechando em 10 segundos...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ Erro:', error);
    const errorPath = path.join(process.cwd(), 'avisa-api-error.png');
    await page.screenshot({ path: errorPath });
    console.log(`📸 Screenshot do erro: ${errorPath}`);
    throw error;
  } finally {
    await browser.close();
  }
}

collectAvisaApiSimple()
  .then(() => {
    console.log('\n✨ Concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro:', error.message);
    process.exit(1);
  });
