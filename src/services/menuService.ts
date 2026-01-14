import { PlanType, PLAN_LIMITS } from '../types/subscription';
import logger from '../config/logger';
import { sendList, sendButtons } from './avisaApi';
import { getLimitReachedMessage, logCampaignInstantEvent } from './campaignService';
import { logLimitMenuSent } from './usageLogs';

// Payment links from Stripe
const PAYMENT_LINKS = {
  premium:
    process.env.STRIPE_PREMIUM_PAYMENT_LINK || 'https://buy.stripe.com/test_14k8zh1iE2gN2oEfYY',
  ultra: process.env.STRIPE_ULTRA_PAYMENT_LINK || 'https://buy.stripe.com/test_bIY3dlgdoc1t1kA7st',
};

export interface MenuOptions {
  userName?: string;
  currentPlan?: PlanType;
  dailyCount?: number;
  dailyLimit?: number;
  isTwitter?: boolean;
}

/**
 * Welcome message for new users
 * Versão curta focada em ação imediata (Time to Value)
 */
export function getWelcomeMenu(userName: string): string {
  return `🎉 Olá ${userName}, bem-vindo ao *StickerBot*!

Envie uma imagem, vídeo ou GIF agora mesmo que eu transformo em figurinha! 🎨`;
}

/**
 * Limit reached message with upgrade options (DEPRECATED - use sendLimitReachedMenu)
 * @deprecated Use sendLimitReachedMenu() with interactive buttons instead
 */
export function getLimitReachedMenu(options: MenuOptions): string {
  const { dailyCount = 0, dailyLimit = 4, isTwitter = false } = options;

  const feature = isTwitter ? 'vídeos do Twitter' : 'figurinhas';
  const emoji = isTwitter ? '🐦' : '🎨';

  return `⚠️ *Limite Atingido!* ${emoji}

Você já usou *${dailyCount}/${dailyLimit} ${feature}* hoje.

Seu limite será renovado às *00:00* (horário de Brasília).

💎 *UPGRADE E TENHA MAIS!*

[1] 💰 *Premium* - R$ 5,00/mês
    • ${PLAN_LIMITS.premium.daily_sticker_limit} figurinhas/dia
    • ${PLAN_LIMITS.premium.daily_twitter_limit} vídeos Twitter/dia
    • ${isTwitter ? '3x mais vídeos!' : '5x mais figurinhas!'}

[2] 🚀 *Ultra* - R$ 9,90/mês
    • Figurinhas *ILIMITADAS*
    • Vídeos Twitter *ILIMITADOS*
    • Processamento prioritário
    • 🔥 *Nunca mais espere!*

Digite *1* ou *2* para fazer upgrade agora!`;
}

/**
 * Send limit reached menu with interactive buttons
 * Usa o sistema de campanhas para mensagem padronizada
 *
 * Campanhas:
 * - limit_reached_v2 (instant) - variante única: control
 *
 * Fluxo:
 * 1. Busca mensagem da campanha limit_reached_v2
 * 2. Se campanha não ativa, usa fallback hardcoded (idêntico ao control)
 * 3. Envia botões de upgrade
 * 4. Loga evento menu_shown para analytics
 */
export async function sendLimitReachedMenu(
  userNumber: string,
  options: {
    userId: string;
    userName: string;
    currentPlan: PlanType;
    dailyCount: number;
    dailyLimit: number;
    isTwitter?: boolean;
    // Legacy params - mantidos para compatibilidade mas não mais usados
    abTestGroup?: 'control' | 'bonus';
    bonusCreditsUsed?: number;
  }
): Promise<void> {
  const {
    userId,
    currentPlan,
    dailyCount,
    dailyLimit,
    isTwitter = false,
  } = options;

  const feature = isTwitter ? 'vídeos do Twitter' : 'figurinhas';

  logger.info({
    msg: '[LIMIT-MENU] Getting campaign message',
    userId,
    userNumber,
    dailyCount,
    dailyLimit,
  });

  // === CAMPAIGN: Buscar mensagem da campanha limit_reached_v2 ===
  const campaignMessage = await getLimitReachedMessage(userId, dailyCount, dailyLimit);

  let messageTitle: string;
  let messageDesc: string;
  let buttons: Array<{ id: string; text: string }>;
  let variant: string = 'fallback';
  let campaignId: string | null = null;

  if (campaignMessage) {
    // Usar mensagem da campanha
    messageTitle = campaignMessage.title;
    messageDesc = campaignMessage.body;
    buttons = campaignMessage.buttons || [];
    variant = campaignMessage.variant;
    campaignId = campaignMessage.campaign_id;

    logger.info({
      msg: '[LIMIT-MENU] Using campaign message',
      userId,
      variant,
      isNewAssignment: campaignMessage.is_new_assignment,
    });
  } else {
    // Fallback: campanha não ativa ou erro (idêntico ao control do banco)
    logger.warn({
      msg: '[LIMIT-MENU] Campaign not active, using fallback',
      userId,
    });

    // Mensagem idêntica ao control do banco
    messageTitle = `⚠️ *Limite Atingido!* 😊`;
    messageDesc = `Você já usou *${dailyCount}/${dailyLimit} ${feature}* hoje.\n\n`;
    messageDesc += `Seu limite será renovado às *00:00* (horário de Brasília).\n\n`;
    messageDesc += `💎 *FAÇA UPGRADE E TENHA MAIS!*\n\n`;
    messageDesc += `💰 *Premium (R$ 5/mês)*\n`;
    messageDesc += `• 20 figurinhas/dia\n\n`;
    messageDesc += `🚀 *Ultra (R$ 9,90/mês)*\n`;
    messageDesc += `• Figurinhas *ILIMITADAS*`;

    buttons = [
      { id: 'button_premium_plan', text: '💰 Premium - R$ 5/mês' },
      { id: 'button_ultra_plan', text: '🚀 Ultra - R$ 9,90/mês' },
    ];
  }

  try {
    await sendButtons({
      number: userNumber,
      title: messageTitle,
      desc: messageDesc,
      footer: 'StickerBot',
      buttons,
    });

    logger.info({
      msg: '[LIMIT-MENU] Menu sent successfully',
      userNumber,
      currentPlan,
      variant,
      buttonsShown: buttons.map((b) => b.id),
    });

    // Log to database for debugging (legacy - mantido para compatibilidade)
    await logLimitMenuSent({
      userNumber,
      userName: options.userName,
      currentPlan,
      abTestGroup: 'control', // Legacy field
      bonusCreditsUsed: 0,
      buttonsShown: buttons.map((b) => b.id),
      success: true,
    });

    // Log campaign event: menu_shown
    if (campaignId) {
      await logCampaignInstantEvent(userId, 'limit_reached_v2', 'menu_shown', {
        buttons_shown: buttons.map((b) => b.id),
        current_plan: currentPlan,
        daily_count: dailyCount,
        daily_limit: dailyLimit,
        is_twitter: isTwitter,
        variant,
      });
    }
  } catch (error) {
    // Log failure to database
    await logLimitMenuSent({
      userNumber,
      userName: options.userName,
      currentPlan,
      abTestGroup: 'control',
      bonusCreditsUsed: 0,
      buttonsShown: buttons.map((b) => b.id),
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    logger.error({
      msg: '[LIMIT-MENU] Error sending menu',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Plan details menu
 * @param plan - premium or ultra
 * @param userDailyLimit - User's current daily limit (from experiment)
 */
export function getPlanDetailsMenu(plan: 'premium' | 'ultra', userDailyLimit: number = 4): string {
  const premiumMultiplier = Math.round(20 / userDailyLimit);

  if (plan === 'premium') {
    return `💰 *PLANO PREMIUM*
R$ 5,00/mês - Cancele quando quiser

✨ *BENEFÍCIOS:*
✅ 20 figurinhas por dia
✅ 15 vídeos do Twitter por dia
✅ Suporte prioritário
✅ ${premiumMultiplier}x mais que o plano gratuito!

📊 *COMPARAÇÃO:*
Plano Gratuito: ${userDailyLimit} figurinhas/dia
Plano Premium: 20 figurinhas/dia (+${Math.round((20 / userDailyLimit - 1) * 100)}%!)

🎯 *PERFEITO PARA:*
• Quem usa figurinhas regularmente
• Grupos de amigos
• Criadores de conteúdo

Digite *CONFIRMAR* para assinar agora!
Digite *VOLTAR* para ver outros planos.`;
  }

  return `🚀 *PLANO ULTRA*
R$ 9,90/mês - Cancele quando quiser

🔥 *BENEFÍCIOS:*
✅ Figurinhas *ILIMITADAS*
✅ Vídeos Twitter *ILIMITADOS*
✅ Processamento prioritário
✅ Suporte VIP
✅ Nunca mais espere!

📊 *COMPARAÇÃO:*
Plano Gratuito: ${userDailyLimit} figurinhas/dia
Plano Premium: 20 figurinhas/dia
Plano Ultra: *ILIMITADO* 🔥

🎯 *PERFEITO PARA:*
• Uso intensivo
• Negócios e marketing
• Administradores de grupos
• Criadores profissionais

Digite *CONFIRMAR* para assinar agora!
Digite *VOLTAR* para ver outros planos.`;
}

/**
 * Plans overview menu
 */
export function getPlansOverviewMenu(userDailyLimit: number = 4): string {
  return `💎 *PLANOS DISPONÍVEIS*

[1] 💰 *Premium* - R$ 5,00/mês
    • 20 figurinhas/dia
    • 15 vídeos Twitter/dia
    • Ótimo custo-benefício!

[2] 🚀 *Ultra* - R$ 9,90/mês
    • Figurinhas ILIMITADAS
    • Vídeos Twitter ILIMITADOS
    • Processamento prioritário
    • *Mais popular!* 🔥

🆓 *Plano Gratuito* (atual)
    • ${userDailyLimit} figurinhas/dia
    • ${userDailyLimit} vídeos Twitter/dia

Digite *1* ou *2* para ver detalhes e assinar!`;
}

/**
 * Payment link delivery message
 */
export function getPaymentLinkMessage(plan: 'premium' | 'ultra', phoneNumber: string): string {
  const paymentLink = PAYMENT_LINKS[plan];
  const planName = plan === 'premium' ? 'Premium' : 'Ultra';
  const price = plan === 'premium' ? 'R$ 5,00' : 'R$ 9,90';

  // Add phone number to payment link metadata
  const linkWithMetadata = `${paymentLink}?client_reference_id=${phoneNumber}`;

  return `🎉 *Ótima escolha!*

Você selecionou o plano *${planName}* por ${price}/mês.

🔗 *Clique no link abaixo para pagar:*

${linkWithMetadata}

✅ *Pagamento 100% seguro* via Stripe
💳 Cartão, Pix ou boleto
🔄 Cancele quando quiser

⚡ *Ativação instantânea:*
Assim que o pagamento for confirmado, seu plano será ativado automaticamente!

Tem dúvidas? Digite *ajuda*.`;
}

/**
 * Subscription activated confirmation message
 */
export function getSubscriptionActivatedMessage(plan: PlanType): string {
  const planName = plan === 'premium' ? 'Premium 💰' : 'Ultra 🚀';
  const limits = PLAN_LIMITS[plan];

  return `🎉 *PAGAMENTO CONFIRMADO!*

Seu plano *${planName}* foi ativado com sucesso!

✅ *Benefícios liberados:*
• Figurinhas: ${limits.daily_sticker_limit === 999999 ? '*ILIMITADAS*' : `${limits.daily_sticker_limit}/dia`}
• Vídeos Twitter: ${limits.daily_twitter_limit === 999999 ? '*ILIMITADOS*' : `${limits.daily_twitter_limit}/dia`}
${limits.priority_processing ? '• Processamento prioritário ⚡' : ''}

🚀 *Já pode usar agora mesmo!*
Envie suas imagens e GIFs para criar figurinhas incríveis!

Dúvidas? Digite *ajuda*`;
}

/**
 * Subscription active message
 */
export function getSubscriptionActiveMessage(plan: PlanType, endsAt: Date): string {
  const planName = plan === 'premium' ? 'Premium 💰' : 'Ultra 🚀';
  const limits = PLAN_LIMITS[plan];

  const daysLeft = Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return `✨ *Sua Assinatura*

📋 Plano: *${planName}*
📅 Renova em: ${daysLeft} dias
🔄 Status: Ativo

🎯 *Seus Limites:*
• Figurinhas: ${limits.daily_sticker_limit === 999999 ? '*ILIMITADAS*' : `${limits.daily_sticker_limit}/dia`}
• Vídeos Twitter: ${limits.daily_twitter_limit === 999999 ? '*ILIMITADOS*' : `${limits.daily_twitter_limit}/dia`}
${limits.priority_processing ? '• Processamento prioritário ⚡' : ''}

Continue enviando suas imagens e GIFs! 🎨`;
}

/**
 * Cancellation confirmation message
 */
export function getCancellationMessage(): string {
  return `✅ *Operação cancelada*

Você pode voltar a usar o bot normalmente.

Para ver os planos disponíveis, digite *planos*.`;
}

/**
 * Help message
 */
export function getHelpMessage(): string {
  return `❓ *AJUDA - StickerBot*

🎨 *COMO USAR:*
1. Envie uma imagem ou GIF
2. Receba sua figurinha pronta!
3. Para vídeos do Twitter, envie o link

💎 *COMANDOS:*
• *planos* - Ver planos disponíveis
• *status* - Ver sua assinatura
• *ajuda* - Ver esta mensagem

💳 *PAGAMENTO:*
• Aceitamos cartão, Pix e boleto
• Processamento via Stripe (seguro)
• Cobrança mensal automática
• Cancele quando quiser, sem multa

🔒 *SEGURANÇA:*
Seus dados estão protegidos. Não armazenamos informações de cartão.

Mais dúvidas? Envie sua pergunta que respondo!`;
}

/**
 * Invalid response message
 */
export function getInvalidResponseMessage(validOptions: string[]): string {
  const optionsText = validOptions.join(' ou ');

  return `❌ Resposta inválida.

Por favor, responda com: ${optionsText}`;
}

/**
 * Error message
 */
export function getErrorMessage(): string {
  return `😔 Ops! Algo deu errado.

Por favor, tente novamente em alguns instantes.

Se o problema persistir, digite *ajuda*.`;
}

/**
 * Log menu interaction
 */
export function logMenuInteraction(
  userNumber: string,
  menuType: string,
  userResponse?: string
): void {
  logger.info({
    msg: 'Menu interaction',
    userNumber,
    menuType,
    userResponse,
  });
}

// ============================================
// INTERACTIVE MENUS (Avisa API)
// ============================================

/**
 * Send plan selection list via Avisa API
 * @param userNumber - WhatsApp number
 * @param userDailyLimit - User's current daily limit (from experiment)
 */
export async function sendPlansListMenu(
  userNumber: string,
  userDailyLimit: number = 4
): Promise<void> {
  try {
    await sendList({
      number: userNumber,
      buttontext: '📋 Ver Planos',
      toptext: '💎 *ESCOLHA SEU PLANO*',
      desc: 'Selecione o plano ideal para você:',
      list: [
        {
          RowId: 'plan_free',
          title: '🆓 Gratuito',
          desc: `${userDailyLimit} figurinhas/dia • ${userDailyLimit} vídeos Twitter/dia`,
        },
        {
          RowId: 'plan_premium',
          title: '💰 Premium - R$ 5,00/mês',
          desc: '20 figurinhas/dia • 15 vídeos Twitter/dia',
        },
        {
          RowId: 'plan_ultra',
          title: '🚀 Ultra - R$ 9,90/mês',
          desc: 'ILIMITADO • Processamento prioritário',
        },
      ],
    });

    logger.info({
      msg: 'Plans list menu sent via Avisa API',
      userNumber,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending plans list menu',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Send payment method selection list via Avisa API
 */
export async function sendPaymentMethodList(
  userNumber: string,
  selectedPlan: 'premium' | 'ultra'
): Promise<void> {
  const planName = selectedPlan === 'premium' ? 'Premium' : 'Ultra';
  const price = selectedPlan === 'premium' ? 'R$ 5,00' : 'R$ 9,90';

  try {
    await sendList({
      number: userNumber,
      buttontext: '💳 Escolher Pagamento',
      toptext: `💰 *PAGAMENTO - PLANO ${planName.toUpperCase()}*`,
      desc: `Valor: ${price}/mês\n\nEscolha sua forma de pagamento:`,
      list: [
        {
          RowId: 'payment_card',
          title: '💳 Cartão de Crédito',
          desc: 'Pagamento instantâneo via Stripe',
        },
        {
          RowId: 'payment_boleto',
          title: '🧾 Boleto Bancário',
          desc: 'Confirmação em até 3 dias úteis',
        },
        {
          RowId: 'payment_pix',
          title: '🔑 PIX',
          desc: 'Pagamento instantâneo • Ativação em 5 minutos',
        },
      ],
    });

    logger.info({
      msg: 'Payment method list sent via Avisa API',
      userNumber,
      plan: selectedPlan,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending payment method list',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Send PIX payment instructions with confirmation button via Avisa API
 *
 * Flow:
 * 1. Send instructions message (text)
 * 2. Send PIX key via Avisa API /buttons/pix (easy copy)
 * 3. Send confirmation button
 */
export async function sendPixPaymentWithButton(
  userNumber: string,
  pixKey: string,
  plan: 'premium' | 'ultra'
): Promise<void> {
  const planName = plan === 'premium' ? 'Premium' : 'Ultra';
  const price = plan === 'premium' ? 'R$ 5,00' : 'R$ 9,90';

  try {
    // Import sendText from evolutionApi
    const { sendText } = await import('./evolutionApi');
    const { sendPixButton } = await import('./avisaApi');

    // Message 1: Instructions
    await sendText(
      userNumber,
      `💰 *Pagamento via PIX*\n\n📋 *Plano:* ${planName}\n💵 *Valor:* ${price}\n\n📝 *COMO PAGAR:*\n\n1️⃣ Copie a chave PIX que vou enviar agora\n2️⃣ Abra seu app de pagamento\n3️⃣ Cole a chave e pague *${price}*\n4️⃣ Após pagar, clique em "✅ Já Paguei"\n\n⏱️ *Importante:*\n• Você tem 30 minutos para pagar\n• Ativação em até 5 minutos após confirmação\n\nEnviando chave PIX... ⬇️`
    );

    // Small delay to ensure messages arrive in order
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Message 2: PIX key via Avisa API (easy to copy)
    await sendPixButton({
      number: userNumber,
      pix: pixKey,
    });

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Message 3: Confirmation button
    await sendButtons({
      number: userNumber,
      title: '✅ *Pagou?*',
      desc: 'Clique no botão abaixo após fazer o PIX:',
      footer: 'Pagamento seguro',
      buttons: [
        {
          id: 'button_confirm_pix',
          text: '✅ Já Paguei',
        },
      ],
    });

    logger.info({
      msg: 'PIX payment flow sent (3 messages: instructions + PIX key + button)',
      userNumber,
      plan,
      pixKey,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending PIX payment flow',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Send sticker edit buttons (Remove Borders, Remove Background, Perfect)
 */
export async function sendStickerEditButtons(userNumber: string): Promise<void> {
  try {
    await sendButtons({
      number: userNumber,
      title: '🎨 *Gostou da figurinha?*',
      desc: `Quer fazer alguma edição?`,
      footer: 'Edições não contam no limite',
      buttons: [
        {
          id: 'button_remove_borders',
          text: '🧹 Remover Bordas',
        },
        {
          id: 'button_remove_background',
          text: '✨ Remover Fundo',
        },
        {
          id: 'button_sticker_perfect',
          text: '✅ Está perfeita!',
        },
      ],
    });

    logger.info({
      msg: 'Sticker edit buttons sent via Avisa API',
      userNumber,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending sticker edit buttons',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get welcome message for NEW users (never created a sticker)
 * @param userName - User's name
 * @param userDailyLimit - User's daily limit (from experiment)
 */
export function getWelcomeMessageForNewUser(userName: string, userDailyLimit: number = 4): string {
  const firstName = userName.split(' ')[0];
  return `👋 Olá, ${firstName}! Eu sou o *StickerBot*!

📸 Me envie uma *imagem* ou *GIF* e eu transformo em figurinha instantaneamente!

🐦 Também baixo vídeos do *Twitter/X* - é só enviar o link!

🆓 Você tem *${userDailyLimit} figurinhas grátis* por dia.

💡 Comandos: *planos* | *status* | *ajuda*`;
}

/**
 * Get reminder message for EXISTING users (already created stickers before)
 * @deprecated Replaced by strategic flow in webhook.ts (2026-01-08)
 * - User with quota available → Silent ignore (no spam)
 * - User who hit limit → Upgrade menu (conversion opportunity)
 * Keeping for backwards compatibility but should not be used.
 */
export function getReminderMessage(): string {
  return `📸 Envie uma *imagem* ou *GIF* para criar figurinha!

💡 Comandos: *planos* | *status* | *ajuda*`;
}
