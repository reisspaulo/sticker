import { TwitterDL } from 'twitter-downloader';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Script de teste para download de vídeos do Twitter
 * Uso: tsx scripts/test-twitter-download.ts <url-do-tweet>
 */

async function testTwitterDownload(tweetUrl: string) {
  console.log('🐦 Testando download de vídeo do Twitter...\n');
  console.log(`URL: ${tweetUrl}\n`);

  try {
    // 1. Obter informações do tweet
    console.log('📥 Buscando informações do tweet...');
    const result = await TwitterDL(tweetUrl);

    console.log('✅ Informações obtidas:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    // 2. Verificar se deu certo
    if (result.status !== 'success') {
      console.log(`❌ Erro: ${result.message}`);
      return { success: false, error: result.message };
    }

    // 3. Verificar se tem mídia
    if (!result.result?.media || result.result.media.length === 0) {
      console.log('❌ Este tweet não contém mídias');
      return { success: false, error: 'No media found' };
    }

    // 4. Procurar vídeos na mídia
    const videoMedia = result.result.media.find(
      (m: any) => m.type === 'video' || m.type === 'animated_gif'
    );

    if (!videoMedia || !videoMedia.videos) {
      console.log('❌ Este tweet não contém vídeos');
      return { success: false, error: 'No videos found' };
    }

    // 5. Pegar vídeo de melhor qualidade (maior bitrate)
    const videos = videoMedia.videos.sort((a: any, b: any) => b.bitrate - a.bitrate);
    const bestVideo = videos[0];

    console.log(`📹 Vídeo encontrado:`);
    console.log(`   Tipo: ${videoMedia.type}`);
    console.log(`   Duração: ${videoMedia.duration || 'N/A'}`);
    console.log(`   Qualidade: ${bestVideo.quality}`);
    console.log(`   Bitrate: ${bestVideo.bitrate}`);
    console.log(`   URL: ${bestVideo.url}\n`);

    // 6. Fazer download do vídeo
    console.log('⬇️  Baixando vídeo...');
    const response = await axios.get(bestVideo.url, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 segundos
    });

    // 5. Salvar arquivo localmente
    const outputDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `twitter-video-${timestamp}.mp4`);
    fs.writeFileSync(outputPath, Buffer.from(response.data));

    // 6. Informações do arquivo
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('✅ Download concluído!\n');
    console.log('📁 Informações do arquivo:');
    console.log(`   Caminho: ${outputPath}`);
    console.log(`   Tamanho: ${fileSizeMB} MB`);
    console.log(`   Tamanho em bytes: ${stats.size}`);
    console.log('');

    // 7. Validações para WhatsApp
    console.log('🔍 Validações para WhatsApp:');
    const maxSizeMB = 16; // WhatsApp limite
    if (stats.size > maxSizeMB * 1024 * 1024) {
      console.log(`   ⚠️  AVISO: Arquivo muito grande (>${maxSizeMB}MB) para WhatsApp`);
    } else {
      console.log(`   ✅ Tamanho OK para WhatsApp (<${maxSizeMB}MB)`);
    }

    return {
      success: true,
      filePath: outputPath,
      fileSize: stats.size,
      fileSizeMB,
      videoUrl: bestVideo.url,
      quality: bestVideo.quality,
      bitrate: bestVideo.bitrate,
      duration: videoMedia.duration,
      type: videoMedia.type,
    };
  } catch (error: any) {
    console.error('❌ Erro ao baixar vídeo do Twitter:');
    console.error(error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

// Executar script
const tweetUrl = process.argv[2];

if (!tweetUrl) {
  console.log('❌ Uso: tsx scripts/test-twitter-download.ts <url-do-tweet>');
  console.log('');
  console.log('Exemplo:');
  console.log('  tsx scripts/test-twitter-download.ts https://twitter.com/user/status/123456789');
  process.exit(1);
}

testTwitterDownload(tweetUrl)
  .then((result) => {
    if (result && result.success) {
      console.log('🎉 Teste concluído com sucesso!');
      process.exit(0);
    } else {
      console.log('😞 Teste falhou');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
