import { sendText } from './evolutionApi';
import logger from '../config/logger';

/**
 * Send welcome message to new user
 * @param userNumber WhatsApp number
 * @param userName User's name
 */
export async function sendWelcomeMessage(userNumber: string, userName: string): Promise<void> {
  try {
    // Import menu functions dynamically to avoid circular dependencies
    const { getWelcomeMenu } = await import('./menuService');

    // Send welcome menu with plan options
    const message = getWelcomeMenu(userName);
    await sendText(userNumber, message);

    logger.info({
      msg: 'Welcome message sent with plan options',
      userNumber,
      userName,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending welcome message',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      userName,
    });
    throw error;
  }
}

/**
 * Send message when user reaches daily limit (with A/B test buttons)
 * @param userNumber WhatsApp number
 * @param userName User's name
 * @param pendingCount Number of pending stickers
 */
export async function sendLimitReachedMessage(
  userNumber: string,
  userName: string,
  pendingCount: number
): Promise<void> {
  try {
    // Import menu functions dynamically to avoid circular dependencies
    const { sendLimitReachedMenu } = await import('./menuService');
    const { getUserLimits } = await import('./subscriptionService');
    const { getUserByNumber } = await import('./userService');

    // Get user and their limits
    const user = await getUserByNumber(userNumber);
    if (!user) {
      logger.error({ msg: 'User not found for limit message', userNumber });
      return;
    }

    const userLimits = await getUserLimits(user.id);

    // Get user's actual plan
    const { getUserPlan } = await import('./subscriptionService');
    const userPlan = await getUserPlan(user.id);

    // Only send pending sticker confirmation if there are actually pending stickers
    // Control group users have pendingCount=0 and should NOT receive this message
    if (pendingCount > 0) {
      await sendText(
        userNumber,
        `📦 *Seu sticker foi salvo!*\n\nEle será enviado amanhã às 8h da manhã junto com ${pendingCount > 1 ? `os outros ${pendingCount - 1} stickers pendentes` : 'os outros stickers pendentes'}.`
      );
    }

    // Then send the limit reached menu with interactive buttons (A/B test)
    await sendLimitReachedMenu(userNumber, {
      userId: user.id,
      userName,
      currentPlan: userPlan,
      dailyCount: user.daily_count,
      dailyLimit: userLimits.daily_sticker_limit,
      isTwitter: false,
      abTestGroup: user.ab_test_group || 'control',
      bonusCreditsUsed: user.bonus_credits_today || 0,
    });

    logger.info({
      msg: 'Limit reached message sent with A/B test menu',
      userNumber,
      userName,
      pendingCount,
      abTestGroup: user.ab_test_group,
      bonusCreditsUsed: user.bonus_credits_today,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending limit reached message',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      userName,
    });
    throw error;
  }
}

/**
 * Send good morning message with pending stickers
 * @param userNumber WhatsApp number
 * @param userName User's name
 * @param stickerCount Number of stickers being sent
 */
export async function sendPendingStickersMessage(
  userNumber: string,
  userName: string,
  stickerCount: number
): Promise<void> {
  try {
    // Get user and their limits
    const { getUserByNumber } = await import('./userService');
    const { getUserLimits } = await import('./subscriptionService');

    const user = await getUserByNumber(userNumber);
    if (!user) {
      logger.error({ msg: 'User not found for pending stickers message', userNumber });
      return;
    }

    const userLimits = await getUserLimits(user.id);
    const dailyLimit = userLimits.daily_sticker_limit;

    let limitMessage = '';
    if (dailyLimit >= 999999) {
      limitMessage = 'Seu limite diário foi renovado. Você tem stickers *ILIMITADOS*!';
    } else {
      limitMessage = `Seu limite diário foi renovado. Você pode enviar mais ${dailyLimit} stickers hoje!`;
    }

    const message = `Bom dia, ${userName}!

Aqui estão os ${stickerCount} sticker${stickerCount > 1 ? 's' : ''} que você enviou ontem.

${limitMessage}`;

    await sendText(userNumber, message);

    logger.info({
      msg: 'Pending stickers message sent',
      userNumber,
      userName,
      stickerCount,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending pending stickers message',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      userName,
    });
    throw error;
  }
}

/**
 * Send error message to user
 * @param userNumber WhatsApp number
 * @param errorType Type of error
 */
export async function sendErrorMessage(
  userNumber: string,
  errorType: 'processing' | 'invalid_format' | 'file_too_large' | 'general'
): Promise<void> {
  try {
    let message = '';

    switch (errorType) {
      case 'processing':
        message = `Desculpe, ocorreu um erro ao processar seu sticker.

Por favor, tente novamente com outra imagem ou GIF.

Se o problema persistir, tente:
• Enviar uma imagem menor
• Usar um formato diferente (PNG, JPG, WebP)
• Aguardar alguns minutos`;
        break;

      case 'invalid_format':
        message = `Desculpe, esse formato não é suportado.

Por favor, envie:
• Imagens: PNG, JPG, JPEG, WebP
• GIFs animados

Formatos NÃO suportados:
• Vídeos
• Documentos
• Stickers (já são stickers!)`;
        break;

      case 'file_too_large':
        message = `Desculpe, esse arquivo é muito grande.

Tamanho máximo: 10MB

Por favor, envie uma imagem ou GIF menor.`;
        break;

      case 'general':
      default:
        message = `Desculpe, ocorreu um erro inesperado.

Por favor, tente novamente mais tarde.

Se o problema persistir, entre em contato com o suporte.`;
        break;
    }

    await sendText(userNumber, message);

    logger.info({
      msg: 'Error message sent',
      userNumber,
      errorType,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending error message',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      errorType,
    });
    // Don't throw - we don't want to fail the job if we can't send error message
  }
}

/**
 * Send processing confirmation message
 * @param userNumber WhatsApp number
 * @param userName User's name
 * @param remainingToday Number of stickers remaining today
 */
export async function sendProcessingConfirmation(
  userNumber: string,
  userName: string,
  remainingToday: number
): Promise<void> {
  try {
    const message = `Processando seu sticker, ${userName}.

Aguarde alguns segundos...

Stickers restantes hoje: ${remainingToday}`;

    await sendText(userNumber, message);

    logger.info({
      msg: 'Processing confirmation sent',
      userNumber,
      userName,
      remainingToday,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending processing confirmation',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    // Don't throw - non-critical message
  }
}

/**
 * Send sticker sent confirmation
 * @param userNumber WhatsApp number
 * @param userName User's name
 * @param remainingToday Number of stickers remaining today
 */
export async function sendStickerSentConfirmation(
  userNumber: string,
  userName: string,
  remainingToday: number
): Promise<void> {
  try {
    let message = `Pronto, ${userName}!

Seu sticker foi criado e enviado.

`;

    if (remainingToday > 0 && remainingToday < 999999) {
      message += `Você ainda pode enviar ${remainingToday} sticker${remainingToday > 1 ? 's' : ''} hoje.`;
    } else if (remainingToday >= 999999) {
      message += `Você tem stickers *ILIMITADOS*! 🎉`;
    } else {
      message += `Você atingiu o limite diário.
Novos stickers serão salvos e enviados amanhã às 8h.`;
    }

    await sendText(userNumber, message);

    logger.info({
      msg: 'Sticker sent confirmation',
      userNumber,
      userName,
      remainingToday,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending sticker sent confirmation',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    // Don't throw - non-critical message
  }
}

// ========================================
// TWITTER-SPECIFIC MESSAGES
// ========================================

/**
 * Send message when user reaches Twitter daily download limit
 * @param userNumber WhatsApp number
 * @param userName User's name
 * @param twitterDownloadCount Current Twitter download count
 */
export async function sendTwitterLimitReachedMessage(
  userNumber: string,
  userName: string,
  twitterDownloadCount: number
): Promise<void> {
  try {
    // Get user and their limits
    const { getUserByNumber } = await import('./userService');
    const { getUserLimits } = await import('./subscriptionService');

    const user = await getUserByNumber(userNumber);
    if (!user) {
      logger.error({ msg: 'User not found for Twitter limit message', userNumber });
      return;
    }

    const userLimits = await getUserLimits(user.id);
    const twitterLimit = userLimits.daily_twitter_limit;

    const message = `Oi, ${userName}.

Você atingiu o limite de ${twitterLimit >= 999999 ? '*ILIMITADO*' : twitterLimit} downloads de vídeos do Twitter por dia.

• Downloads hoje: ${twitterDownloadCount}/${twitterLimit >= 999999 ? '∞' : twitterLimit}
• Limite renovado: Meia-noite
• Limite de stickers: Separado (você ainda pode criar stickers normais)

Observação: O limite de downloads do Twitter é independente do limite de criação de stickers.

Obrigado por usar o Sticker Bot!`;

    await sendText(userNumber, message);

    logger.info({
      msg: 'Twitter limit reached message sent',
      userNumber,
      userName,
      twitterDownloadCount,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending Twitter limit reached message',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      userName,
    });
    throw error;
  }
}

/**
 * Send message asking if user wants to convert Twitter video to sticker
 * @param userNumber WhatsApp number
 * @param userName User's name
 * @param tweetAuthor Twitter user who posted the video
 */
export async function sendTwitterConversionQuestion(
  userNumber: string,
  userName: string,
  tweetAuthor: string
): Promise<void> {
  try {
    const message = `Oi, ${userName}!

Detectei um vídeo do Twitter de @${tweetAuthor}.

Deseja converter o vídeo para sticker ou receber apenas o vídeo?

Responda:
• "sim" ou "converter" - para converter em sticker
• "não" ou "apenas vídeo" - para receber só o vídeo

⏱️ Aguardando sua resposta...`;

    await sendText(userNumber, message);

    logger.info({
      msg: 'Twitter conversion question sent',
      userNumber,
      userName,
      tweetAuthor,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending Twitter conversion question',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      userName,
    });
    throw error;
  }
}

/**
 * Send message when Twitter download starts
 * @param userNumber WhatsApp number
 * @param userName User's name
 * @param remainingDownloads Number of downloads remaining today
 * @param hasMultipleMedia Whether tweet has multiple media items
 * @param mediaCount Total media count
 */
export async function sendTwitterDownloadStartedMessage(
  userNumber: string,
  userName: string,
  remainingDownloads: number,
  hasMultipleMedia?: boolean,
  mediaCount?: number
): Promise<void> {
  try {
    let message = `Baixando vídeo do Twitter, ${userName}...

Aguarde alguns segundos.`;

    // Add info about multiple media
    if (hasMultipleMedia && mediaCount && mediaCount > 1) {
      message += `\n\nℹ️ Este tweet tem ${mediaCount} mídias. Baixando apenas o vídeo.`;
    }

    message += `\n\nDownloads restantes hoje: ${remainingDownloads}`;

    await sendText(userNumber, message);

    logger.info({
      msg: 'Twitter download started message sent',
      userNumber,
      userName,
      remainingDownloads,
      hasMultipleMedia,
      mediaCount,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending Twitter download started message',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    // Don't throw - non-critical message
  }
}

/**
 * Send video selection message when tweet has multiple videos
 * @param userNumber WhatsApp number
 * @param userName User's name
 * @param videos Array of available videos
 * @param remainingDownloads Number of downloads remaining today
 */
export async function sendVideoSelectionMessage(
  userNumber: string,
  userName: string,
  videos: Array<{
    url: string;
    duration?: number;
    durationSec?: number;
    resolution: string;
    type: 'video' | 'gif';
  }>,
  remainingDownloads: number
): Promise<void> {
  try {
    let message = `Oi, ${userName}!\n\nEste tweet tem ${videos.length} vídeos disponíveis.\n\nPor favor, escolha qual você quer baixar:\n\n`;

    // List all videos with details
    videos.forEach((video, index) => {
      const videoNum = index + 1;
      message += `${videoNum}. `;

      if (video.type === 'gif') {
        message += 'GIF';
      } else {
        message += 'Vídeo';
      }

      if (video.durationSec) {
        message += ` - ${video.durationSec.toFixed(1)}s`;
      }

      message += ` - ${video.resolution}\n`;
    });

    message += `\nResponda com o número do vídeo que deseja (1-${videos.length}) ou "cancelar" para desistir.\n\n⏱️ Aguardando sua resposta...`;

    await sendText(userNumber, message);

    logger.info({
      msg: 'Video selection message sent',
      userNumber,
      userName,
      videoCount: videos.length,
      remainingDownloads,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending video selection message',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    throw error;
  }
}

/**
 * Send error message for Twitter download failures
 * @param userNumber WhatsApp number
 * @param errorType Type of error
 */
export async function sendTwitterErrorMessage(
  userNumber: string,
  errorType: 'invalid_url' | 'no_video' | 'download_failed' | 'conversion_failed' | 'general'
): Promise<void> {
  try {
    let message = '';

    switch (errorType) {
      case 'invalid_url':
        message = `Desculpe, essa URL do Twitter não é válida.

Por favor, envie um link válido do Twitter/X:
• https://twitter.com/usuario/status/123456
• https://x.com/usuario/status/123456`;
        break;

      case 'no_video':
        message = `Desculpe, esse tweet não contém vídeo.

O download funciona apenas para tweets com vídeo.

Tipos suportados:
• Vídeos do Twitter
• GIFs do Twitter
• Vídeos compartilhados`;
        break;

      case 'download_failed':
        message = `Desculpe, ocorreu um erro ao baixar o vídeo do Twitter.

Possíveis causas:
• Tweet foi deletado
• Conta privada
• Vídeo não disponível
• Erro temporário do Twitter

Por favor, tente novamente ou use outro link.`;
        break;

      case 'conversion_failed':
        message = `Desculpe, ocorreu um erro ao converter o vídeo em sticker.

O vídeo foi baixado, mas a conversão falhou.

Por favor, tente:
• Baixar novamente e escolher "apenas vídeo"
• Usar um vídeo diferente`;
        break;

      case 'general':
      default:
        message = `Desculpe, ocorreu um erro inesperado ao processar o vídeo do Twitter.

Por favor, tente novamente mais tarde.

Se o problema persistir, entre em contato com o suporte.`;
        break;
    }

    await sendText(userNumber, message);

    logger.info({
      msg: 'Twitter error message sent',
      userNumber,
      errorType,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending Twitter error message',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      errorType,
    });
    // Don't throw - we don't want to fail if we can't send error message
  }
}
