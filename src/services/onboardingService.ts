import { supabase } from '../config/supabase';
import { sendText } from './evolutionApi';
import { sendButtons } from './avisaApi';
import logger from '../config/logger';

/**
 * Onboarding Service
 * Gerencia o fluxo progressivo de onboarding do usuário
 */

export interface OnboardingStatus {
  step: number;
  firstStickerAt: string | null;
  twitterFeatureShown: boolean;
  twitterFeatureUsed: boolean;
}

/**
 * Atualiza o step de onboarding do usuário
 */
export async function updateOnboardingStep(
  userNumber: string,
  newStep: number
): Promise<void> {
  try {
    const updates: Record<string, any> = {
      onboarding_step: newStep,
      updated_at: new Date().toISOString(),
    };

    // Se é a primeira figurinha, captura o timestamp
    if (newStep === 1) {
      updates.first_sticker_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('whatsapp_number', userNumber);

    if (error) {
      logger.error({ error, userNumber, newStep }, 'Failed to update onboarding step');
      throw error;
    }

    logger.info({ userNumber, newStep }, 'Onboarding step updated');
  } catch (error) {
    logger.error({ error, userNumber, newStep }, 'Error updating onboarding step');
    throw error;
  }
}

/**
 * Obtém o status de onboarding do usuário
 */
export async function getOnboardingStatus(userNumber: string): Promise<OnboardingStatus | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('onboarding_step, first_sticker_at, twitter_feature_shown, twitter_feature_used')
      .eq('whatsapp_number', userNumber)
      .single();

    if (error || !data) {
      logger.error({ error, userNumber }, 'Failed to get onboarding status');
      return null;
    }

    return {
      step: data.onboarding_step || 0,
      firstStickerAt: data.first_sticker_at,
      twitterFeatureShown: data.twitter_feature_shown || false,
      twitterFeatureUsed: data.twitter_feature_used || false,
    };
  } catch (error) {
    logger.error({ error, userNumber }, 'Error getting onboarding status');
    return null;
  }
}

/**
 * Envia mensagem de confirmação após criação de figurinha
 * Inclui contador de figurinhas restantes e progressão do onboarding
 */
export async function sendStickerConfirmation(
  userNumber: string,
  userName: string,
  remainingToday: number,
  currentStep: number
): Promise<void> {
  try {
    let message = '';

    if (currentStep === 1) {
      // Primeira figurinha - Aha! Moment
      message = `✅ *${userName}, sua primeira figurinha está pronta!*

🎁 Você tem *${remainingToday} figurinhas restantes* hoje.

Continue enviando suas mídias! 🚀`;
    } else if (currentStep === 2) {
      // Segunda figurinha - Reforço
      message = `✅ *Mais uma pronta!*

🔥 Você está arrasando, ${userName}!

🎁 *${remainingToday} restantes* hoje.`;
    } else {
      // 3ª figurinha em diante - Mensagem simples
      message = `✅ Figurinha enviada!

🎁 *${remainingToday} restantes* hoje.`;
    }

    await sendText(userNumber, message);

    logger.info(
      { userNumber, userName, currentStep, remainingToday },
      'Sticker confirmation sent'
    );
  } catch (error) {
    logger.error({ error, userNumber }, 'Error sending sticker confirmation');
  }
}

/**
 * Verifica se deve apresentar a funcionalidade Twitter
 * Trigger: após 3ª figurinha
 */
export async function checkTwitterFeaturePresentation(
  userNumber: string,
  userName: string,
  currentStep: number
): Promise<void> {
  try {
    // Só apresenta após a 3ª figurinha (step 3)
    if (currentStep !== 3) {
      return;
    }

    // Verifica se já foi apresentado
    const status = await getOnboardingStatus(userNumber);
    if (!status || status.twitterFeatureShown) {
      return;
    }

    // Apresenta a funcionalidade Twitter com botões interativos
    await sendTwitterFeaturePresentation(userNumber, userName);

    // Marca como apresentado
    await markTwitterFeatureAsShown(userNumber);
  } catch (error) {
    logger.error({ error, userNumber }, 'Error checking Twitter feature presentation');
  }
}

/**
 * Envia apresentação da funcionalidade Twitter com botões
 */
async function sendTwitterFeaturePresentation(
  userNumber: string,
  userName: string
): Promise<void> {
  try {
    await sendButtons({
      number: userNumber,
      title: '🎉 *Você já criou 3 figurinhas!*',
      desc: `Parabéns, ${userName}! 👏

💡 Sabia que também posso *baixar vídeos do X (Twitter)*?

Escolha o que você quer fazer:`,
      footer: 'Experimente agora!',
      buttons: [
        {
          id: 'button_twitter_learn',
          text: '🎬 Quero conhecer!',
        },
        {
          id: 'button_twitter_dismiss',
          text: '⏭️ Agora não',
        },
      ],
    });

    logger.info({ userNumber, userName }, 'Twitter feature presentation sent');
  } catch (error) {
    logger.error({ error, userNumber }, 'Error sending Twitter feature presentation');
    throw error;
  }
}

/**
 * Marca a funcionalidade Twitter como apresentada
 */
async function markTwitterFeatureAsShown(userNumber: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        twitter_feature_shown: true,
        updated_at: new Date().toISOString(),
      })
      .eq('whatsapp_number', userNumber);

    if (error) {
      logger.error({ error, userNumber }, 'Failed to mark Twitter feature as shown');
      throw error;
    }

    logger.info({ userNumber }, 'Twitter feature marked as shown');
  } catch (error) {
    logger.error({ error, userNumber }, 'Error marking Twitter feature as shown');
  }
}

/**
 * Marca a funcionalidade Twitter como usada (primeira vez)
 */
export async function markTwitterFeatureAsUsed(userNumber: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        twitter_feature_used: true,
        updated_at: new Date().toISOString(),
      })
      .eq('whatsapp_number', userNumber);

    if (error) {
      logger.error({ error, userNumber }, 'Failed to mark Twitter feature as used');
      throw error;
    }

    logger.info({ userNumber }, 'Twitter feature marked as used');
  } catch (error) {
    logger.error({ error, userNumber }, 'Error marking Twitter feature as used');
  }
}

/**
 * Handler para quando usuário clica em "Quero conhecer!" na apresentação do Twitter
 */
export async function handleTwitterLearnMore(
  userNumber: string,
  userName: string
): Promise<void> {
  try {
    const message = `📱 *Perfeito, ${userName}!*

Agora você pode me enviar links do X (Twitter) de 2 formas:

🎬 *Para BAIXAR o vídeo:*
Envie o link normalmente e eu baixo para você!

🎨 *Para fazer FIGURINHA do vídeo:*
Depois que eu baixar, você escolhe se quer converter para figurinha animada.

📋 *Exemplo de link:*
https://x.com/usuario/status/123456789

✨ *Seu plano gratuito:* 4 vídeos/dia

Experimente agora! 🚀`;

    await sendText(userNumber, message);

    logger.info({ userNumber, userName }, 'Twitter learn more message sent');
  } catch (error) {
    logger.error({ error, userNumber }, 'Error handling Twitter learn more');
  }
}

/**
 * Handler para quando usuário clica em "Agora não" na apresentação do Twitter
 */
export async function handleTwitterDismiss(
  userNumber: string,
  userName: string
): Promise<void> {
  try {
    const message = `Tudo bem, ${userName}! 😊

Você pode conhecer essa funcionalidade quando quiser digitando *twitter* ou *ajuda*.

Continue enviando suas mídias! 🎨`;

    await sendText(userNumber, message);

    logger.info({ userNumber, userName }, 'Twitter dismiss message sent');
  } catch (error) {
    logger.error({ error, userNumber }, 'Error handling Twitter dismiss');
  }
}
