/**
 * Template Service
 *
 * Manages Meta Cloud API template messages for communication outside
 * the 24-hour conversation window.
 *
 * IMPORTANT: All templates must be pre-approved in Meta Business Manager
 * before they can be used. See docs/META-TEMPLATES.md for setup instructions.
 *
 * Flow:
 * 1. Check if conversation window is open (24h)
 * 2. If open → send normal message (free)
 * 3. If closed → send template message (paid)
 */

import { featureFlags } from '../config/features';
import { isConversationWindowOpen } from './conversationWindow';
import { sendText, sendButtons, SendButtonsRequest } from './whatsappApi';
import logger from '../config/logger';

// ============================================
// TEMPLATE DEFINITIONS
// ============================================

/**
 * Template names registered in Meta Business Manager.
 * These must match exactly what was approved.
 */
export const TEMPLATES = {
  // Stickers that were queued overnight are ready
  STICKER_READY: 'sticker_pronto',

  // Daily limit was reached, upgrade prompt
  LIMIT_REACHED: 'limite_atingido',

  // Payment/subscription confirmed
  PAYMENT_CONFIRMED: 'pagamento_confirmado',

  // User hasn't interacted in 30+ days
  REENGAGEMENT: 'reengajamento',

  // PIX payment is pending/expired
  PIX_REMINDER: 'pix_pendente',

  // Generic campaign message
  CAMPAIGN_MESSAGE: 'mensagem_campanha',

  // Welcome back / sticker delivery
  STICKER_DELIVERY: 'entrega_figurinha',
} as const;

export type TemplateName = (typeof TEMPLATES)[keyof typeof TEMPLATES];

// ============================================
// SMART SEND FUNCTIONS
// ============================================

/**
 * Send a text message, using template if outside 24h window.
 *
 * @param userNumber - WhatsApp number
 * @param text - Message text (used within 24h window)
 * @param templateName - Template to use if outside window
 * @param templateParams - Parameters for the template body
 */
export async function sendTextOrTemplate(
  userNumber: string,
  text: string,
  templateName: TemplateName,
  templateParams?: string[]
): Promise<void> {
  // If not using Meta, just send text (legacy providers don't have window restriction)
  if (!featureFlags.USE_META) {
    return sendText(userNumber, text);
  }

  const windowOpen = await isConversationWindowOpen(userNumber);

  if (windowOpen) {
    logger.debug({
      msg: '[TEMPLATE] Within 24h window, sending normal text',
      userNumber,
    });
    return sendText(userNumber, text);
  }

  logger.info({
    msg: '[TEMPLATE] Outside 24h window, sending template',
    userNumber,
    templateName,
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const metaApi = require('./metaCloudApi');
  const components = templateParams
    ? [
        {
          type: 'body' as const,
          parameters: templateParams.map((p) => ({ type: 'text' as const, text: p })),
        },
      ]
    : undefined;

  return metaApi.sendTemplate(userNumber, templateName, 'pt_BR', components);
}

/**
 * Send buttons, falling back to template if outside 24h window.
 *
 * Templates don't support interactive buttons the same way,
 * so we send a template with a call-to-action instead.
 */
export async function sendButtonsOrTemplate(
  request: SendButtonsRequest,
  templateName: TemplateName,
  templateParams?: string[]
): Promise<void> {
  if (!featureFlags.USE_META) {
    return sendButtons(request);
  }

  const windowOpen = await isConversationWindowOpen(request.number);

  if (windowOpen) {
    return sendButtons(request);
  }

  logger.info({
    msg: '[TEMPLATE] Outside 24h window, sending template instead of buttons',
    userNumber: request.number,
    templateName,
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const metaApi = require('./metaCloudApi');
  const components = templateParams
    ? [
        {
          type: 'body' as const,
          parameters: templateParams.map((p) => ({ type: 'text' as const, text: p })),
        },
      ]
    : undefined;

  return metaApi.sendTemplate(request.number, templateName, 'pt_BR', components);
}

// ============================================
// TEMPLATE CATALOG (for Meta Business Manager)
// ============================================

/**
 * Returns the template definitions that need to be created in Meta Business Manager.
 * Use this as reference when setting up templates in the portal.
 *
 * Call via: GET /stats/templates (or use in admin panel)
 */
export function getTemplateCatalog() {
  return [
    {
      name: TEMPLATES.STICKER_READY,
      category: 'UTILITY',
      language: 'pt_BR',
      header: null,
      body: 'Suas figurinhas estão prontas! 🎉 Você tem {{1}} figurinha(s) pendente(s). Toque no botão abaixo para recebê-las!',
      footer: 'StickerBot',
      buttons: [{ type: 'quick_reply', text: 'Receber figurinhas' }],
      params: ['{{1}} = número de figurinhas'],
    },
    {
      name: TEMPLATES.LIMIT_REACHED,
      category: 'MARKETING',
      language: 'pt_BR',
      header: null,
      body: 'Você atingiu o limite diário de figurinhas gratuitas. 😊 Conheça nossos planos a partir de R$ 5/mês e crie até 20 figurinhas por dia! Responda "planos" para saber mais.',
      footer: 'StickerBot',
      buttons: null,
      params: [],
    },
    {
      name: TEMPLATES.PAYMENT_CONFIRMED,
      category: 'UTILITY',
      language: 'pt_BR',
      header: null,
      body: 'Pagamento confirmado! ✅ Seu plano {{1}} está ativo. Agora você pode criar até {{2}} figurinhas por dia. Mande uma imagem para começar!',
      footer: 'StickerBot',
      buttons: null,
      params: ['{{1}} = nome do plano', '{{2}} = limite diário'],
    },
    {
      name: TEMPLATES.REENGAGEMENT,
      category: 'MARKETING',
      language: 'pt_BR',
      header: null,
      body: 'Sentimos sua falta! 👋 Faz tempo que você não cria figurinhas. Mande uma imagem e transforme em sticker em segundos!',
      footer: 'StickerBot',
      buttons: null,
      params: [],
    },
    {
      name: TEMPLATES.PIX_REMINDER,
      category: 'UTILITY',
      language: 'pt_BR',
      header: null,
      body: 'Seu pagamento via PIX ainda está pendente. O código expira em breve! Responda "pix" para gerar um novo código ou "planos" para ver outras opções.',
      footer: 'StickerBot',
      buttons: null,
      params: [],
    },
    {
      name: TEMPLATES.CAMPAIGN_MESSAGE,
      category: 'MARKETING',
      language: 'pt_BR',
      header: null,
      body: '{{1}}',
      footer: 'StickerBot',
      buttons: null,
      params: ['{{1}} = corpo da mensagem da campanha'],
    },
    {
      name: TEMPLATES.STICKER_DELIVERY,
      category: 'UTILITY',
      language: 'pt_BR',
      header: null,
      body: 'Sua figurinha está pronta! 🎨 Toque no botão abaixo para recebê-la.',
      footer: 'StickerBot',
      buttons: [{ type: 'quick_reply', text: 'Receber figurinha' }],
      params: [],
    },
  ];
}
