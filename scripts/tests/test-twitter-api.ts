import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Teste usando API pública de download de Twitter
 * Baseado nos serviços como ssstwitter.com, x2twitter.com
 */

async function testTwitterAPI(tweetUrl: string) {
  console.log('🐦 Testando download via API pública...\n');
  console.log(`URL: ${tweetUrl}\n`);

  try {
    // Extrair ID do tweet
    const tweetId = tweetUrl.match(/status\/(\d+)/)?.[1];
    if (!tweetId) {
      console.log('❌ URL inválida - não consegui extrair ID do tweet');
      return { success: false, error: 'Invalid URL' };
    }

    console.log(`📝 Tweet ID: ${tweetId}\n`);

    // Método 1: Tentar API não-oficial do Twitter
    console.log('📥 Método 1: Acessando API do Twitter...');

    const guestTokenResponse = await axios.post(
      'https://api.twitter.com/1.1/guest/activate.json',
      {},
      {
        headers: {
          'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        },
      }
    );

    const guestToken = guestTokenResponse.data.guest_token;
    console.log(`✅ Guest token obtido: ${guestToken.substring(0, 20)}...\n`);

    // Buscar detalhes do tweet
    console.log('📥 Buscando detalhes do tweet...');
    const tweetResponse = await axios.get(
      `https://twitter.com/i/api/graphql/VNhLyg6rsPkllE6O_BPuWA/TweetDetail`,
      {
        params: {
          variables: JSON.stringify({
            focalTweetId: tweetId,
            with_rux_injections: false,
            includePromotedContent: true,
            withCommunity: true,
            withQuickPromoteEligibilityTweetFields: true,
            withBirdwatchNotes: true,
            withVoice: true,
            withV2Timeline: true,
          }),
          features: JSON.stringify({
            rweb_lists_timeline_redesign_enabled: true,
            responsive_web_graphql_exclude_directive_enabled: true,
            verified_phone_label_enabled: false,
            creator_subscriptions_tweet_preview_api_enabled: true,
            responsive_web_graphql_timeline_navigation_enabled: true,
            responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
            tweetypie_unmention_optimization_enabled: true,
            responsive_web_edit_tweet_api_enabled: true,
            graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
            view_counts_everywhere_api_enabled: true,
            longform_notetweets_consumption_enabled: true,
            responsive_web_twitter_article_tweet_consumption_enabled: false,
            tweet_awards_web_tipping_enabled: false,
            freedom_of_speech_not_reach_fetch_enabled: true,
            standardized_nudges_misinfo: true,
            tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
            longform_notetweets_rich_text_read_enabled: true,
            longform_notetweets_inline_media_enabled: true,
            responsive_web_media_download_video_enabled: false,
            responsive_web_enhance_cards_enabled: false,
          }),
        },
        headers: {
          'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
          'x-guest-token': guestToken,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }
    );

    console.log('✅ Resposta recebida\n');

    // Procurar vídeo na resposta
    const entries = tweetResponse.data?.data?.threaded_conversation_with_injections_v2?.instructions?.[0]?.entries || [];

    let videoUrl: string | null = null;
    let videoInfo: any = null;

    for (const entry of entries) {
      const tweet = entry.content?.itemContent?.tweet_results?.result;
      if (tweet?.legacy?.id_str === tweetId) {
        const media = tweet.legacy?.extended_entities?.media;
        if (media && media.length > 0) {
          const videoMedia = media.find((m: any) => m.type === 'video' || m.type === 'animated_gif');
          if (videoMedia?.video_info?.variants) {
            // Pegar vídeo de melhor qualidade (maior bitrate)
            const variants = videoMedia.video_info.variants
              .filter((v: any) => v.content_type === 'video/mp4')
              .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

            if (variants.length > 0) {
              videoUrl = variants[0].url;
              videoInfo = {
                type: videoMedia.type,
                duration: videoMedia.video_info.duration_millis,
                quality: variants[0].bitrate,
                allQualities: variants.map((v: any) => ({
                  bitrate: v.bitrate,
                  url: v.url,
                })),
              };
            }
          }
        }
      }
    }

    if (!videoUrl) {
      console.log('❌ Não encontrei vídeo neste tweet');
      console.log('Resposta da API (primeiros 500 chars):');
      console.log(JSON.stringify(tweetResponse.data).substring(0, 500));
      return { success: false, error: 'No video found' };
    }

    console.log('📹 Vídeo encontrado!');
    console.log(`   Tipo: ${videoInfo.type}`);
    console.log(`   Duração: ${videoInfo.duration}ms`);
    console.log(`   Qualidade: ${videoInfo.quality} bitrate`);
    console.log(`   URL: ${videoUrl}\n`);

    // Download do vídeo
    console.log('⬇️  Baixando vídeo...');
    const videoResponse = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    // Salvar arquivo
    const outputDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `twitter-video-${timestamp}.mp4`);
    fs.writeFileSync(outputPath, Buffer.from(videoResponse.data));

    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('✅ Download concluído!\n');
    console.log('📁 Informações do arquivo:');
    console.log(`   Caminho: ${outputPath}`);
    console.log(`   Tamanho: ${fileSizeMB} MB\n`);

    // Validações
    console.log('🔍 Validações para WhatsApp:');
    const maxSizeMB = 16;
    if (stats.size > maxSizeMB * 1024 * 1024) {
      console.log(`   ⚠️  AVISO: Arquivo muito grande (>${maxSizeMB}MB)`);
    } else {
      console.log(`   ✅ Tamanho OK (<${maxSizeMB}MB)`);
    }

    return {
      success: true,
      filePath: outputPath,
      fileSize: stats.size,
      fileSizeMB,
      videoUrl,
      videoInfo,
    };

  } catch (error: any) {
    console.error('❌ Erro:');
    console.error(error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data).substring(0, 200));
    }
    return { success: false, error: error.message };
  }
}

// Executar
const tweetUrl = process.argv[2];
if (!tweetUrl) {
  console.log('❌ Uso: tsx scripts/test-twitter-api.ts <url-do-tweet>');
  process.exit(1);
}

testTwitterAPI(tweetUrl)
  .then((result) => {
    if (result?.success) {
      console.log('\n🎉 Teste concluído com sucesso!');
      process.exit(0);
    } else {
      console.log('\n😞 Teste falhou');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
