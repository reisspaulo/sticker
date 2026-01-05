import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

// Usar a Evolution API diretamente no Porto Digital (endereço público se existir)
// Ou vamos usar a Avisa API que sabemos que funciona
const AVISA_API_URL = 'https://www.avisaapi.com.br/api';
const AVISA_TOKEN = process.env.AVISA_API_TOKEN || 'ROm8VZyoVYWTBmJjHfANrV3Ls3vF5SwLuzonI7U68K6l40SfKUIOJkybF6iq';
const PHONE = '5511946304133';

async function sendText(text: string) {
  try {
    const response = await axios.post(
      `${AVISA_API_URL}/send-message`,
      {
        number: PHONE,
        type: 'text',
        message: text
      },
      {
        headers: {
          'Authorization': `Bearer ${AVISA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Text sent`);
    return response.data;
  } catch (error: any) {
    console.error(`❌ Error sending text:`, error.response?.data || error.message);
  }
}

async function sendImage(imagePath: string, caption: string) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await axios.post(
      `${AVISA_API_URL}/send-message`,
      {
        number: PHONE,
        type: 'image',
        message: caption,
        image: base64Image,
        fileName: path.basename(imagePath)
      },
      {
        headers: {
          'Authorization': `Bearer ${AVISA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Image sent: ${caption}`);
    return response.data;
  } catch (error: any) {
    console.error(`❌ Error sending image:`, error.response?.data || error.message);
  }
}

async function main() {
  console.log('🎨 Enviando amostras de marca d\'água via Avisa API...\n');

  const samplesDir = path.join(__dirname, 'watermark-samples');

  // Mensagem inicial
  await sendText(
    `🧪 *TESTE DE MARCA D'ÁGUA*

Vou enviar 5 figurinhas para você comparar:

0️⃣ SEM marca d'água (planos pagos)
1️⃣ 15% opacidade (MUITO sutil)
2️⃣ 25% opacidade (Sutil)
3️⃣ 40% opacidade (Discreta)
4️⃣ 60% opacidade (Bem visível)

Aguarde...`
  );

  await new Promise(resolve => setTimeout(resolve, 3000));

  const samples = [
    { file: 'sticker-no-watermark.webp', caption: '0️⃣ *SEM Marca d\'água*\nComo ficaria para usuários Premium/Ultra' },
    { file: 'sticker-watermark-15.webp', caption: '1️⃣ *15% Opacidade*\nMUITO sutil - quase invisível' },
    { file: 'sticker-watermark-25.webp', caption: '2️⃣ *25% Opacidade*\nSutil - perceptível mas não invasiva' },
    { file: 'sticker-watermark-40.webp', caption: '3️⃣ *40% Opacidade*\nDiscreta - visível mas não incomoda' },
    { file: 'sticker-watermark-60.webp', caption: '4️⃣ *60% Opacidade*\nBem visível - mais destacada' }
  ];

  for (const sample of samples) {
    const filePath = path.join(samplesDir, sample.file);
    console.log(`Enviando: ${sample.file}...`);
    await sendImage(filePath, sample.caption);
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  // Mensagem final
  await new Promise(resolve => setTimeout(resolve, 2000));
  await sendText(
    `✅ *Teste concluído!*

Qual versão você achou ideal?

💭 *Reflexões:*
• 15-25% = Quase invisível, pouco incentivo para upgrade
• 40% = Equilíbrio entre visível e discreta
• 60% = Muito visível, pode frustrar usuários free

🤔 Lembre-se: marca d'água muito invasiva pode fazer usuários desistirem do bot completamente.

O que você acha?`
  );

  console.log('\n✅ Todas as amostras foram enviadas!');
}

main().catch(console.error);
