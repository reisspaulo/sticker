import { PlanType, PLAN_LIMITS } from '../types/subscription';
import logger from '../config/logger';
import { sendList, sendButtons } from './avisaApi';

// Payment links from Stripe
const PAYMENT_LINKS = {
  premium: process.env.STRIPE_PREMIUM_PAYMENT_LINK || 'https://buy.stripe.com/test_14k8zh1iE2gN2oEfYY',
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
 * Send limit reached menu with interactive buttons (A/B Test implementation)
 * - Control Group: Direct upsell buttons based on current plan
 * - Bonus Group: Bonus credits option + upsell buttons
 */
export async function sendLimitReachedMenu(
  userNumber: string,
  options: {
    userName: string;
    currentPlan: PlanType;
    dailyCount: number;
    dailyLimit: number;
    isTwitter?: boolean;
    abTestGroup: 'control' | 'bonus';
    bonusCreditsUsed?: number;
  }
): Promise<void> {
  const { currentPlan, dailyCount, dailyLimit, isTwitter = false, abTestGroup, bonusCreditsUsed = 0 } = options;

  const feature = isTwitter ? 'vídeos do Twitter' : 'figurinhas';
  const emoji = isTwitter ? '🐦' : '🎨';

  // Smart upsell: only show plans higher than current
  const availableUpgrades: Array<{ id: string; text: string }> = [];

  if (currentPlan === 'free') {
    availableUpgrades.push(
      { id: 'button_upgrade_premium', text: '💰 Premium - R$ 5/mês' },
      { id: 'button_upgrade_ultra', text: '🚀 Ultra - R$ 9,90/mês' }
    );
  } else if (currentPlan === 'premium') {
    availableUpgrades.push(
      { id: 'button_upgrade_ultra', text: '🚀 Upgrade para Ultra' }
    );
  }
  // If ultra plan, no upgrades available (shouldn't hit limits)

  // Build buttons based on A/B group
  const buttons: Array<{ id: string; text: string }> = [];

  if (abTestGroup === 'bonus' && bonusCreditsUsed < 2) {
    // Bonus group: show "Use bonus" button first
    const bonusRemaining = 2 - bonusCreditsUsed;
    buttons.push({
      id: 'button_use_bonus',
      text: `🎁 Usar Bônus (+${bonusRemaining})`,
    });
  }

  // Add upgrade buttons
  buttons.push(...availableUpgrades);

  // Add dismiss button
  buttons.push({
    id: 'button_dismiss_upgrade',
    text: '❌ Agora Não',
  });

  // Build message text based on A/B group
  let messageDesc = '';

  if (abTestGroup === 'control') {
    // Control group: Direct upsell message
    messageDesc = `Você já usou *${dailyCount}/${dailyLimit} ${feature}* hoje.\n\n`;
    messageDesc += `Seu limite será renovado às *00:00* (horário de Brasília).\n\n`;
    messageDesc += `💎 *FAÇA UPGRADE E TENHA MAIS!*\n\n`;

    if (currentPlan === 'free') {
      messageDesc += `💰 *Premium (R$ 5/mês)*\n`;
      messageDesc += `• ${PLAN_LIMITS.premium.daily_sticker_limit} figurinhas/dia\n`;
      messageDesc += `• ${PLAN_LIMITS.premium.daily_twitter_limit} vídeos Twitter/dia\n\n`;
      messageDesc += `🚀 *Ultra (R$ 9,90/mês)*\n`;
      messageDesc += `• Figurinhas *ILIMITADAS*\n`;
      messageDesc += `• Vídeos Twitter *ILIMITADOS*\n`;
      messageDesc += `• Processamento prioritário`;
    } else if (currentPlan === 'premium') {
      messageDesc += `🚀 *Ultra (R$ 9,90/mês)*\n`;
      messageDesc += `• Figurinhas *ILIMITADAS*\n`;
      messageDesc += `• Vídeos Twitter *ILIMITADOS*\n`;
      messageDesc += `• Processamento prioritário\n`;
      messageDesc += `• Nunca mais espere! 🔥`;
    }
  } else {
    // Bonus group: Bonus offer + upsell
    messageDesc = `Você já usou *${dailyCount}/${dailyLimit} ${feature}* hoje.\n\n`;

    if (bonusCreditsUsed < 2) {
      const bonusRemaining = 2 - bonusCreditsUsed;
      messageDesc += `🎁 *PRESENTE ESPECIAL!*\n`;
      messageDesc += `Ganhe *+${bonusRemaining} ${feature}* extras hoje!\n\n`;
      messageDesc += `Seu limite será renovado às *00:00*.\n\n`;
    } else {
      messageDesc += `Você já usou seus bônus extras hoje.\n`;
      messageDesc += `Seu limite será renovado às *00:00*.\n\n`;
    }

    messageDesc += `💎 *OU FAÇA UPGRADE:*\n\n`;

    if (currentPlan === 'free') {
      messageDesc += `💰 *Premium (R$ 5/mês)*\n`;
      messageDesc += `• ${PLAN_LIMITS.premium.daily_sticker_limit} figurinhas/dia\n`;
      messageDesc += `• ${PLAN_LIMITS.premium.daily_twitter_limit} vídeos Twitter/dia\n\n`;
      messageDesc += `🚀 *Ultra (R$ 9,90/mês)*\n`;
      messageDesc += `• *ILIMITADO* 🔥`;
    } else if (currentPlan === 'premium') {
      messageDesc += `🚀 *Ultra (R$ 9,90/mês)*\n`;
      messageDesc += `• *ILIMITADO* 🔥`;
    }
  }

  try {
    await sendButtons({
      number: userNumber,
      title: `⚠️ *Limite Atingido!* ${emoji}`,
      desc: messageDesc,
      footer: 'StickerBot',
      buttons,
    });

    logger.info({
      msg: 'Limit reached menu sent with A/B test',
      userNumber,
      currentPlan,
      abTestGroup,
      bonusCreditsUsed,
      isTwitter,
      buttonsShown: buttons.length,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending limit reached menu',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Plan details menu
 */
export function getPlanDetailsMenu(plan: 'premium' | 'ultra'): string {
  if (plan === 'premium') {
    return `💰 *PLANO PREMIUM*
R$ 5,00/mês - Cancele quando quiser

✨ *BENEFÍCIOS:*
✅ 20 figurinhas por dia
✅ 15 vídeos do Twitter por dia
✅ Suporte prioritário
✅ 5x mais que o plano gratuito!

📊 *COMPARAÇÃO:*
Plano Gratuito: 4 figurinhas/dia
Plano Premium: 20 figurinhas/dia (+400%!)

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
Plano Gratuito: 4 figurinhas/dia
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
export function getPlansOverviewMenu(): string {
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
    • 4 figurinhas/dia
    • 4 vídeos Twitter/dia

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
 */
export async function sendPlansListMenu(userNumber: string): Promise<void> {
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
          desc: '4 figurinhas/dia • 4 vídeos Twitter/dia',
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
 */
export async function sendPixPaymentWithButton(
  userNumber: string,
  pixKey: string,
  plan: 'premium' | 'ultra'
): Promise<void> {
  const planName = plan === 'premium' ? 'Premium' : 'Ultra';
  const price = plan === 'premium' ? 'R$ 5,00' : 'R$ 9,90';

  try {
    // First send the PIX payment message with instructions
    await sendButtons({
      number: userNumber,
      title: '💰 *Pagamento via PIX*',
      desc: `📋 *Plano:* ${planName}\n💵 *Valor:* ${price}\n\n🔑 *Chave PIX (Aleatória):*\n\`\`\`${pixKey}\`\`\`\n\n📝 *Instruções:*\n1. Copie a chave PIX acima\n2. Abra seu app de pagamento\n3. Faça o PIX no valor exato\n4. Após pagar, clique em "Já Paguei"\n\n⏱️ Seu plano será ativado em até 5 minutos após a confirmação.\n\n⚠️ *Importante:* Você tem 30 minutos para concluir o pagamento.`,
      footer: 'Pagamento seguro',
      buttons: [
        {
          id: 'button_confirm_pix',
          text: '✅ Já Paguei',
        },
      ],
    });

    logger.info({
      msg: 'PIX payment button sent via Avisa API',
      userNumber,
      plan,
    });
  } catch (error) {
    logger.error({
      msg: 'Error sending PIX payment button',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
