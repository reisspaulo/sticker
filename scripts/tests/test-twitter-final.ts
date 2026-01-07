import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Download de vídeos do Twitter usando VxTwitter API
 * API Gratuita, sem autenticação, 100% funcional em 2025!
 *
 * Uso: npx tsx scripts/test-twitter-final.ts <url-do-tweet>
 */

interface VxTwitterResponse {
  tweetID: string;
  user_name: string;
  user_screen_name: string;
  text: string;
  date: string;
  hasMedia: boolean;
  mediaURLs: string[];
  media_extended: Array<{
    type: 'video' | 'photo' | 'gif';
    url: string;
    thumbnail_url?: string;
    duration_millis?: number;
    size: {
      width: number;
      height: number;
    };
  }>;
  likes: number;
  retweets: number;
}

async function downloadTwitterVideo(tweetUrl: string) {
  console.log('🐦 Download de Vídeo do Twitter via VxTwitter API\n');
  console.log(`URL: ${tweetUrl}\n`);

  try {
    // Extrair username e tweet ID da URL
    const match = tweetUrl.match(/(?:twitter|x)\.com\/([^/]+)\/status\/(\d+)/);
    if (!match) {
      throw new Error('URL inválida. Formato esperado: https://x.com/username/status/1234567890');
    }

    const [, username, tweetId] = match;
    console.log(`👤 Usuário: @${username}`);
    console.log(`🆔 Tweet ID: ${tweetId}\n`);

    // Buscar informações do tweet via API
    console.log('📥 Buscando informações via VxTwitter API...');
    const apiUrl = `https://api.vxtwitter.com/${username}/status/${tweetId}`;
    const response = await axios.get<VxTwitterResponse>(apiUrl);
    const data = response.data;

    console.log('✅ Dados recebidos:\n');
    console.log(`   Autor: ${data.user_name} (@${data.user_screen_name})`);
    console.log(`   Texto: "${data.text}"`);
    console.log(`   Data: ${data.date}`);
    console.log(`   Curtidas: ${data.likes} | Retweets: ${data.retweets}`);
    console.log(`   Tem mídia: ${data.hasMedia ? 'Sim' : 'Não'}\n`);

    // Verificar se tem vídeo
    if (!data.hasMedia || !data.media_extended || data.media_extended.length === 0) {
      console.log('❌ Este tweet não contém mídia');
      return { success: false, error: 'No media found' };
    }

    // Procurar vídeo
    const videoMedia = data.media_extended.find(
      (m) => m.type === 'video' || m.type === 'gif'
    );

    if (!videoMedia) {
      console.log('❌ Este tweet não contém vídeos');
      console.log(`   Tipos de mídia encontrados: ${data.media_extended.map(m => m.type).join(', ')}`);
      return { success: false, error: 'No video found' };
    }

    // Informações do vídeo
    const durationSec = videoMedia.duration_millis
      ? (videoMedia.duration_millis / 1000).toFixed(1)
      : 'N/A';

    console.log('📹 Vídeo encontrado!');
    console.log(`   Tipo: ${videoMedia.type}`);
    console.log(`   Duração: ${durationSec}s`);
    console.log(`   Resolução: ${videoMedia.size.width}x${videoMedia.size.height}`);
    console.log(`   URL: ${videoMedia.url}\n`);

    // Download do vídeo
    console.log('⬇️  Baixando vídeo...');
    const videoResponse = await axios.get(videoMedia.url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = ((progressEvent.loaded / progressEvent.total) * 100).toFixed(1);
          process.stdout.write(`\r   Progresso: ${percent}%`);
        }
      },
    });

    console.log('\n');

    // Salvar arquivo
    const outputDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const extension = videoMedia.type === 'gif' ? 'mp4' : 'mp4'; // GIFs também vêm como MP4
    const filename = `twitter-${data.user_screen_name}-${tweetId}-${timestamp}.${extension}`;
    const outputPath = path.join(outputDir, filename);

    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));

    // Estatísticas do arquivo
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    const fileSizeKB = (stats.size / 1024).toFixed(2);

    console.log('✅ Download concluído!\n');
    console.log('📁 Informações do arquivo:');
    console.log(`   Caminho: ${outputPath}`);
    console.log(`   Nome: ${filename}`);
    console.log(`   Tamanho: ${fileSizeMB} MB (${fileSizeKB} KB)`);
    console.log(`   Bytes: ${stats.size.toLocaleString()}\n`);

    // Validações para WhatsApp
    console.log('🔍 Validações para WhatsApp:');
    const maxSizeMB = 16;
    const maxDurationSec = 90;

    if (stats.size > maxSizeMB * 1024 * 1024) {
      console.log(`   ⚠️  AVISO: Arquivo muito grande (>${maxSizeMB}MB) para WhatsApp`);
      console.log(`   💡 Sugestão: Comprimir ou converter para GIF`);
    } else {
      console.log(`   ✅ Tamanho OK para WhatsApp (<${maxSizeMB}MB)`);
    }

    if (videoMedia.duration_millis && videoMedia.duration_millis / 1000 > maxDurationSec) {
      console.log(`   ⚠️  AVISO: Vídeo muito longo (>${maxDurationSec}s) para WhatsApp`);
      console.log(`   💡 Sugestão: Cortar vídeo ou converter para GIF curto`);
    } else if (videoMedia.duration_millis) {
      console.log(`   ✅ Duração OK para WhatsApp (<${maxDurationSec}s)`);
    }

    return {
      success: true,
      filePath: outputPath,
      fileName: filename,
      fileSize: stats.size,
      fileSizeMB: parseFloat(fileSizeMB),
      videoUrl: videoMedia.url,
      thumbnailUrl: videoMedia.thumbnail_url,
      duration: videoMedia.duration_millis,
      durationSec: videoMedia.duration_millis ? videoMedia.duration_millis / 1000 : undefined,
      resolution: `${videoMedia.size.width}x${videoMedia.size.height}`,
      type: videoMedia.type,
      tweetData: {
        id: data.tweetID,
        author: data.user_name,
        username: data.user_screen_name,
        text: data.text,
        date: data.date,
        likes: data.likes,
        retweets: data.retweets,
      },
    };
  } catch (error: any) {
    console.error('\n❌ Erro ao baixar vídeo:');
    console.error(`   ${error.message}`);

    if (error.response) {
      console.error(`   Status HTTP: ${error.response.status}`);
      if (error.response.status === 404) {
        console.error('   💡 Tweet não encontrado ou foi deletado');
      } else if (error.response.status === 429) {
        console.error('   💡 Rate limit atingido. Tente novamente em alguns segundos');
      }
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
  console.log('❌ Uso: npx tsx scripts/test-twitter-final.ts <url-do-tweet>\n');
  console.log('Exemplos:');
  console.log('  npx tsx scripts/test-twitter-final.ts https://x.com/user/status/123456789');
  console.log('  npx tsx scripts/test-twitter-final.ts https://twitter.com/user/status/123456789\n');
  process.exit(1);
}

downloadTwitterVideo(tweetUrl)
  .then((result) => {
    if (result && result.success) {
      console.log('\n🎉 Teste concluído com sucesso!\n');
      console.log('📊 Resumo:');
      console.log(`   Arquivo: ${result.fileName}`);
      console.log(`   Tamanho: ${result.fileSizeMB} MB`);
      console.log(`   Duração: ${result.durationSec}s`);
      console.log(`   Resolução: ${result.resolution}`);
      console.log(`   Autor: @${result.tweetData.username}`);
      process.exit(0);
    } else {
      console.log('\n😞 Teste falhou\n');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error.message);
    process.exit(1);
  });
