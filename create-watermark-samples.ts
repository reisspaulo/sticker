import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

async function createWatermarkSticker(
  opacity: number,
  label: string,
  outputPath: string
): Promise<void> {
  // Criar uma imagem de teste 512x512 com um gradiente bonito
  const baseImage = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 100, g: 150, b: 255, alpha: 1 }
    }
  })
  .composite([
    // Adicionar um círculo decorativo
    {
      input: Buffer.from(
        `<svg width="512" height="512">
          <circle cx="256" cy="256" r="180" fill="#fff" opacity="0.3"/>
          <text x="256" y="280" font-size="120" text-anchor="middle" fill="#fff">😎</text>
        </svg>`
      ),
      gravity: 'center'
    }
  ])
  .png()
  .toBuffer();

  // Criar SVG de marca d'água
  const watermarkSvg = Buffer.from(
    `<svg width="512" height="512">
      <text
        x="485"
        y="500"
        font-size="18"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-weight="600"
        fill="rgba(255, 255, 255, ${opacity})"
      >StickerBot</text>
    </svg>`
  );

  // Aplicar marca d'água
  const stickerWithWatermark = await sharp(baseImage)
    .composite([
      {
        input: watermarkSvg,
        gravity: 'southeast'
      }
    ])
    .webp({ quality: 95 })
    .toFile(outputPath);

  console.log(`✅ Created: ${outputPath} (${opacity * 100}% opacity)`);
}

async function main() {
  console.log('🎨 Creating watermark test stickers...\n');

  const outputDir = path.join(__dirname, 'watermark-samples');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Versão 1: Muito sutil (15%)
  await createWatermarkSticker(
    0.15,
    'v1-15',
    path.join(outputDir, 'sticker-watermark-15.webp')
  );

  // Versão 2: Sutil (25%)
  await createWatermarkSticker(
    0.25,
    'v2-25',
    path.join(outputDir, 'sticker-watermark-25.webp')
  );

  // Versão 3: Discreta (40%)
  await createWatermarkSticker(
    0.40,
    'v3-40',
    path.join(outputDir, 'sticker-watermark-40.webp')
  );

  // Versão 4: Visível (60%)
  await createWatermarkSticker(
    0.60,
    'v4-60',
    path.join(outputDir, 'sticker-watermark-60.webp')
  );

  // Versão 5: Sem marca d'água (para comparação)
  const noWatermark = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 100, g: 150, b: 255, alpha: 1 }
    }
  })
  .composite([
    {
      input: Buffer.from(
        `<svg width="512" height="512">
          <circle cx="256" cy="256" r="180" fill="#fff" opacity="0.3"/>
          <text x="256" y="280" font-size="120" text-anchor="middle" fill="#fff">😎</text>
        </svg>`
      ),
      gravity: 'center'
    }
  ])
  .webp({ quality: 95 })
  .toFile(path.join(outputDir, 'sticker-no-watermark.webp'));

  console.log(`✅ Created: ${path.join(outputDir, 'sticker-no-watermark.webp')} (sem marca d'água)\n`);

  console.log('\n✨ Samples created successfully!');
  console.log(`📁 Location: ${outputDir}\n`);
  console.log('📊 Comparison:');
  console.log('  • sticker-no-watermark.webp  - SEM marca d\'água (planos premium/ultra)');
  console.log('  • sticker-watermark-15.webp  - 15% opacidade (MUITO sutil)');
  console.log('  • sticker-watermark-25.webp  - 25% opacidade (Sutil)');
  console.log('  • sticker-watermark-40.webp  - 40% opacidade (Discreta)');
  console.log('  • sticker-watermark-60.webp  - 60% opacidade (Bem visível)\n');
}

main().catch(console.error);
