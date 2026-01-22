import sharp from 'sharp';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'YOUR_EVOLUTION_API_KEY';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'meu-zap';

async function createWatermarkSticker(opacity: number, label: string): Promise<Buffer> {
  // Criar uma imagem de teste 512x512 com um emoji/símbolo
  const baseImage = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 200, b: 100, alpha: 1 }
    }
  })
  .composite([
    {
      input: Buffer.from(
        `<svg width="512" height="512">
          <text x="256" y="256" font-size="200" text-anchor="middle" dominant-baseline="middle" fill="#333">🎨</text>
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
        x="470"
        y="490"
        font-size="20"
        text-anchor="end"
        font-family="Arial, sans-serif"
        font-weight="600"
        fill="rgba(0, 0, 0, ${opacity})"
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
    .webp({ quality: 90 })
    .toBuffer();

  return stickerWithWatermark;
}

async function sendSticker(buffer: Buffer, caption: string) {
  const form = new FormData();

  form.append('number', '5511946304133');
  form.append('mediaMessage', buffer, {
    filename: 'sticker.webp',
    contentType: 'image/webp'
  });
  form.append('options', JSON.stringify({
    delay: 1000,
    presence: 'composing'
  }));

  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'apikey': EVOLUTION_API_KEY
        }
      }
    );

    console.log(`✅ Sticker sent: ${caption}`, response.data);

    // Enviar caption explicativo
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        number: '5511946304133',
        text: caption,
        delay: 500
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error: any) {
    console.error(`❌ Error sending sticker:`, error.response?.data || error.message);
  }
}

async function main() {
  console.log('🎨 Creating watermark test stickers...\n');

  // Enviar mensagem inicial
  await axios.post(
    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    {
      number: '5511946304133',
      text: '🧪 *TESTE DE MARCA D\'ÁGUA*\n\nVou enviar 3 versões com diferentes níveis de opacidade:\n\n1️⃣ Muito sutil (20% opacidade)\n2️⃣ Discreta (40% opacidade)\n3️⃣ Visível (60% opacidade)\n\nAguarde...',
      delay: 1000
    },
    {
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Versão 1: Muito sutil (20%)
  console.log('Creating version 1: 20% opacity...');
  const sticker1 = await createWatermarkSticker(0.2, 'v1');
  await sendSticker(sticker1, '1️⃣ *Versão 1: Muito Sutil*\nOpacidade: 20%\n"StickerBot" no canto inferior direito');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Versão 2: Discreta (40%)
  console.log('Creating version 2: 40% opacity...');
  const sticker2 = await createWatermarkSticker(0.4, 'v2');
  await sendSticker(sticker2, '2️⃣ *Versão 2: Discreta*\nOpacidade: 40%\nMais visível que a primeira');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Versão 3: Visível (60%)
  console.log('Creating version 3: 60% opacity...');
  const sticker3 = await createWatermarkSticker(0.6, 'v3');
  await sendSticker(sticker3, '3️⃣ *Versão 3: Visível*\nOpacidade: 60%\nBem mais perceptível');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mensagem final
  await axios.post(
    `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
    {
      number: '5511946304133',
      text: '✅ *Teste concluído!*\n\nQual versão você achou melhor?\n\n🤔 Considera que:\n• Muito sutil = usuários mal percebem a diferença\n• Muito visível = pode frustrar usuários gratuitos\n\nQual seria o equilíbrio ideal?',
      delay: 1000
    },
    {
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('\n✅ All test stickers sent!');
}

main().catch(console.error);
