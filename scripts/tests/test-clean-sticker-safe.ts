/**
 * SCRIPT DE TESTE SEGURO - Remover Fundo + Bordas Brancas
 *
 * Este script NÃO afeta o código de produção.
 * Apenas testa o fluxo completo:
 * 1. Processa imagem (rembg + crop)
 * 2. Upload para Supabase Storage
 * 3. Envia sticker via Evolution API
 *
 * USO:
 *   npx tsx test-clean-sticker-safe.ts <caminho-da-imagem> <numero-whatsapp>
 *
 * EXEMPLO:
 *   npx tsx test-clean-sticker-safe.ts /tmp/test-person.jpg 5511999999999
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';

const execAsync = promisify(exec);

// ============================================
// CONFIGURAÇÕES (do .env)
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'meu-zap';

// Validar configurações
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar no .env');
  process.exit(1);
}

if (!EVOLUTION_API_KEY) {
  console.error('❌ Erro: EVOLUTION_API_KEY deve estar no .env');
  process.exit(1);
}

// ============================================
// STEP 1: PROCESSAR IMAGEM (Python + rembg)
// ============================================

async function processImageWithRembg(inputPath: string, outputPath: string): Promise<void> {
  console.log('\n1️⃣ Processando imagem com rembg...');

  // Verificar se arquivo existe
  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  // Script Python inline
  const pythonScript = `
import time
from rembg import remove, new_session
from PIL import Image

print("   🔄 Carregando modelo u2net...")
session = new_session("u2net")

# Ler imagem
with open("${inputPath}", "rb") as f:
    input_data = f.read()

print(f"   📥 Input: {len(input_data)/1024:.1f}KB")

# Remover fundo
start = time.time()
output_data = remove(input_data, session=session)
elapsed1 = time.time() - start

# Salvar temporário
temp_path = "/tmp/temp-nobg.png"
with open(temp_path, "wb") as f:
    f.write(output_data)

print(f"   ✅ Fundo removido em {elapsed1:.2f}s")

# Remover bordas/crop
print("   ✂️  Removendo bordas vazias...")
start = time.time()

img = Image.open(temp_path).convert("RGBA")
pixels = img.load()
width, height = img.size

# Encontrar bounds
min_x, min_y = width, height
max_x, max_y = 0, 0

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if a > 10:
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

if min_x < max_x and min_y < max_y:
    # Crop
    cropped = img.crop((min_x, min_y, max_x + 1, max_y + 1))

    # Resize mantendo aspect ratio para caber em 512x512
    cropped.thumbnail((512, 512), Image.Resampling.LANCZOS)

    # Criar canvas 512x512 com transparência
    final = Image.new("RGBA", (512, 512), (0, 0, 0, 0))

    # Centralizar
    paste_x = (512 - cropped.width) // 2
    paste_y = (512 - cropped.height) // 2
    final.paste(cropped, (paste_x, paste_y))

    # Salvar como WebP
    final.save("${outputPath}", "WEBP", quality=90)

    elapsed2 = time.time() - start

    print(f"   ✅ Bordas removidas em {elapsed2:.2f}s")
    print(f"   📐 Original: {width}x{height}px")
    print(f"   📐 Cropped: {cropped.width}x{cropped.height}px")
    print(f"   📐 Final: 512x512px")
    print(f"   ⏱️  Tempo total: {elapsed1 + elapsed2:.2f}s")
else:
    print("   ⚠️  Sem conteúdo visível")
    img.save("${outputPath}", "WEBP", quality=90)
`.trim();

  try {
    // Executar Python
    const { stdout, stderr } = await execAsync(`python3 -c '${pythonScript.replace(/'/g, "'\"'\"'")}'`);

    if (stdout) console.log(stdout);
    if (stderr && stderr.includes('Error')) {
      throw new Error(stderr);
    }

    // Verificar se arquivo foi criado
    await fs.access(outputPath);
    const stats = await fs.stat(outputPath);
    console.log(`   💾 Arquivo criado: ${outputPath} (${(stats.size / 1024).toFixed(1)}KB)`);

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Erro ao processar imagem: ${error.message}`);
    }
    throw error;
  }
}

// ============================================
// STEP 2: UPLOAD PARA SUPABASE STORAGE
// ============================================

async function uploadToSupabase(filePath: string, userId: string): Promise<string> {
  console.log('\n2️⃣ Fazendo upload para Supabase Storage...');

  const fileName = `test_${Date.now()}.webp`;
  const storagePath = `test/${userId}/${fileName}`;

  try {
    // Ler arquivo
    const fileBuffer = await fs.readFile(filePath);

    console.log(`   📤 Uploading ${(fileBuffer.length / 1024).toFixed(1)}KB...`);

    // Upload via API REST do Supabase
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/stickers-estaticos/${storagePath}`;

    const response = await axios.post(uploadUrl, fileBuffer, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'image/webp',
        'apikey': SUPABASE_SERVICE_KEY,
      },
    });

    // URL pública
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/stickers-estaticos/${storagePath}`;

    console.log(`   ✅ Upload completo!`);
    console.log(`   🔗 URL: ${publicUrl}`);

    return publicUrl;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('   ❌ Erro Supabase:', error.response?.status, error.response?.data);
      throw new Error(`Supabase upload falhou: ${error.response?.statusText}`);
    }
    throw error;
  }
}

// ============================================
// STEP 3: ENVIAR VIA EVOLUTION API
// ============================================

async function sendStickerViaEvolution(phoneNumber: string, stickerUrl: string): Promise<void> {
  console.log('\n3️⃣ Enviando sticker via Evolution API...');

  // Sanitizar número
  const sanitizedNumber = phoneNumber.replace(/\D/g, '');

  console.log(`   📞 Destino: ${sanitizedNumber}`);
  console.log(`   🌐 API: ${EVOLUTION_API_URL}`);
  console.log(`   📡 Instância: ${EVOLUTION_INSTANCE}`);

  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/message/sendSticker/${EVOLUTION_INSTANCE}`,
      {
        number: sanitizedNumber,
        sticker: stickerUrl,
      },
      {
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log(`   ✅ Sticker enviado!`);

    if (response.data?.key?.id) {
      console.log(`   📨 Message ID: ${response.data.key.id}`);
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('   ❌ Erro Evolution API:', error.response?.status, error.response?.data);

      if (error.code === 'ECONNREFUSED') {
        console.error('\n   ⚠️  Evolution API não está acessível!');
        console.error('   💡 Verifique se está rodando na VPS ou localmente');
      }

      throw new Error(`Evolution API falhou: ${error.response?.statusText || error.message}`);
    }
    throw error;
  }
}

// ============================================
// MAIN - FLUXO COMPLETO
// ============================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          TESTE SEGURO - Remover Fundo + Bordas              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  // Parse argumentos
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('\n❌ Uso incorreto!');
    console.error('\nUSO:');
    console.error('  npx tsx test-clean-sticker-safe.ts <imagem> <numero>\n');
    console.error('EXEMPLO:');
    console.error('  npx tsx test-clean-sticker-safe.ts /tmp/test.jpg 5511999999999\n');
    process.exit(1);
  }

  const [inputImage, phoneNumber] = args;
  const outputImage = '/tmp/sticker-processed.webp';
  const testUserId = 'test_user';

  try {
    // Verificar se Python e rembg estão instalados
    console.log('\n🔍 Verificando dependências...');
    try {
      await execAsync('python3 -c "import rembg; print(\'rembg OK\')"');
      console.log('   ✅ Python + rembg instalados');
    } catch {
      console.error('   ❌ rembg não instalado!');
      console.error('   💡 Instale com: pip3 install rembg[cli]');
      process.exit(1);
    }

    // STEP 1: Processar imagem
    await processImageWithRembg(inputImage, outputImage);

    // STEP 2: Upload para Supabase
    const publicUrl = await uploadToSupabase(outputImage, testUserId);

    // STEP 3: Enviar via Evolution
    await sendStickerViaEvolution(phoneNumber, publicUrl);

    // Sucesso!
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ TESTE COMPLETO!                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('\n📊 Resumo:');
    console.log(`   • Imagem processada: ${outputImage}`);
    console.log(`   • URL no Supabase: ${publicUrl}`);
    console.log(`   • Enviado para: ${phoneNumber}`);
    console.log('\n💡 Verifique seu WhatsApp!\n');

  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════════════════════╗');
    console.error('║                    ❌ ERRO NO TESTE                           ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝\n');

    if (error instanceof Error) {
      console.error(`❌ ${error.message}\n`);
    } else {
      console.error('❌ Erro desconhecido\n');
    }

    process.exit(1);
  }
}

// Executar
main();
