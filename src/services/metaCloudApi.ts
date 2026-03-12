import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';
import { logStickerSent, logMessageSent, logMenuSent, logPixButtonSent } from './usageLogs';
import { messageRateLimiter, MessagePriority } from '../utils/messageRateLimiter';

/**
 * Meta Cloud API WhatsApp Integration
 *
 * Official WhatsApp Business Platform API (replaces Z-API).
 *
 * Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/
 * Base URL: https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/
 */

// Meta Cloud API configuration
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const apiVersion = process.env.META_API_VERSION || 'v22.0';

// Only validate if USE_META is true (lazy - checked at import time by adapter)
if (process.env.USE_META === 'true') {
  if (!accessToken || !phoneNumberId) {
    throw new Error(
      'WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be defined when USE_META=true'
    );
  }
}

const baseUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}`;

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: baseUrl,
  timeout: 30000,
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});

// ============================================
// RESPONSE TYPES
// ============================================

interface MetaMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a phone number is Brazilian (country code 55)
 */
export function isBrazilianNumber(phoneNumber: string): boolean {
  const sanitized = phoneNumber.replace(/\D/g, '');
  return sanitized.startsWith('55');
}

/**
 * Sanitize phone number - Meta expects digits only with country code
 */
function sanitizePhoneNumber(number: string): string {
  return number.replace(/\D/g, '');
}

// ============================================
// BASIC MESSAGING
// ============================================

/**
 * Send a sticker to a WhatsApp user via Meta Cloud API
 *
 * Meta supports native sticker type (not image).
 * Sticker must be a .webp file, max 100KB (static) or 500KB (animated).
 */
export async function sendSticker(userNumber: string, stickerUrl: string): Promise<void> {
  const phone = sanitizePhoneNumber(userNumber);

  logger.info({
    msg: '[Meta] Sending sticker',
    phone,
    stickerUrl: stickerUrl.substring(0, 100),
  });

  await messageRateLimiter.send(async () => {
    try {
      const response = await api.post<MetaMessageResponse>('/messages', {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'sticker',
        sticker: {
          link: stickerUrl,
        },
      });

      const messageId = response.data.messages?.[0]?.id;

      logger.info({
        msg: '[Meta] Sticker sent successfully',
        phone,
        messageId,
      });

      await logStickerSent({
        userNumber,
        stickerPath: stickerUrl,
        tipo: stickerUrl.includes('animado') ? 'animado' : 'estatico',
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        msg: '[Meta] Failed to send sticker',
        phone,
        error: errorMessage,
        response: (error as any)?.response?.data,
      });

      await logStickerSent({
        userNumber,
        stickerPath: stickerUrl,
        tipo: stickerUrl.includes('animado') ? 'animado' : 'estatico',
        success: false,
        errorMessage,
      });

      throw error;
    }
  }, MessagePriority.HIGH);
}

/**
 * Send a text message via Meta Cloud API
 */
export async function sendText(
  userNumber: string,
  text: string,
  _options?: {
    delayMessage?: number;
    delayTyping?: number;
  }
): Promise<void> {
  const phone = sanitizePhoneNumber(userNumber);

  logger.info({
    msg: '[Meta] Sending text message',
    phone,
    messagePreview: text.substring(0, 50),
  });

  // Meta does not support delay/typing options - ignored
  await messageRateLimiter.send(async () => {
    try {
      const response = await api.post<MetaMessageResponse>('/messages', {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: {
          body: text,
        },
      });

      const messageId = response.data.messages?.[0]?.id;

      logger.info({
        msg: '[Meta] Text message sent successfully',
        phone,
        messageId,
      });

      await logMessageSent({
        userNumber,
        messageType: 'text',
        messagePreview: text,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        msg: '[Meta] Failed to send text message',
        phone,
        error: errorMessage,
        response: (error as any)?.response?.data,
      });

      await logMessageSent({
        userNumber,
        messageType: 'text',
        messagePreview: text,
        success: false,
        errorMessage,
      });

      throw error;
    }
  });
}

/**
 * Send a video via Meta Cloud API
 *
 * Meta does not support viewOnce for videos.
 */
export async function sendVideo(
  userNumber: string,
  videoUrl: string,
  caption?: string,
  _options?: {
    viewOnce?: boolean;
    async?: boolean;
  }
): Promise<void> {
  const phone = sanitizePhoneNumber(userNumber);

  logger.info({
    msg: '[Meta] Sending video',
    phone,
    videoUrl: videoUrl.substring(0, 100),
    caption,
  });

  await messageRateLimiter.send(async () => {
    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'video',
        video: {
          link: videoUrl,
        },
      };

      if (caption) {
        payload.video.caption = caption;
      }

      const response = await api.post<MetaMessageResponse>('/messages', payload);

      logger.info({
        msg: '[Meta] Video sent successfully',
        phone,
        messageId: response.data.messages?.[0]?.id,
      });
    } catch (error) {
      logger.error({
        msg: '[Meta] Failed to send video',
        phone,
        error: error instanceof Error ? error.message : 'Unknown error',
        response: (error as any)?.response?.data,
      });

      throw error;
    }
  });
}

// ============================================
// INTERACTIVE MESSAGES
// ============================================

export interface SendButtonsRequest {
  number: string;
  message: string;
  title?: string;
  footer?: string;
  buttons: Array<{
    type: 'REPLY' | 'URL' | 'CALL';
    label: string;
    id?: string;
    url?: string;
    phone?: string;
  }>;
}

/**
 * Send interactive buttons via Meta Cloud API
 *
 * Meta only supports Reply buttons (max 3), no URL or CALL buttons.
 * URL/CALL buttons are only available via templates.
 */
export async function sendButtons(request: SendButtonsRequest): Promise<void> {
  const phone = sanitizePhoneNumber(request.number);

  if (!isBrazilianNumber(phone)) {
    logger.warn({
      msg: '[Meta] Skipping interactive buttons for non-Brazilian number',
      phone,
    });
    const fallbackText = `${request.message}\n\n${request.buttons.map((b) => `• ${b.label}`).join('\n')}`;
    await sendText(phone, fallbackText);
    return;
  }

  logger.info({
    msg: '[Meta] Sending interactive buttons',
    phone,
    buttonCount: request.buttons.length,
  });

  await messageRateLimiter.send(async () => {
    try {
      // Meta only supports up to 3 reply buttons
      const replyButtons = request.buttons
        .filter((btn) => btn.type === 'REPLY' || btn.id)
        .slice(0, 3)
        .map((btn) => ({
          type: 'reply' as const,
          reply: {
            id: btn.id || btn.label.toLowerCase().replace(/\s+/g, '_'),
            title: btn.label.substring(0, 20), // Meta limit: 20 chars
          },
        }));

      if (replyButtons.length === 0) {
        // If no reply buttons, send as text with options listed
        const fallbackText = `${request.message}\n\n${request.buttons.map((b) => `• ${b.label}`).join('\n')}`;
        await sendText(phone, fallbackText);
        return;
      }

      const payload: any = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: request.message || '',
          },
          action: {
            buttons: replyButtons,
          },
        },
      };

      if (request.title) {
        payload.interactive.header = {
          type: 'text',
          text: request.title.substring(0, 60), // Meta limit
        };
      }

      if (request.footer) {
        payload.interactive.footer = {
          text: request.footer.substring(0, 60), // Meta limit
        };
      }

      const response = await api.post<MetaMessageResponse>('/messages', payload);

      logger.info({
        msg: '[Meta] Interactive buttons sent successfully',
        phone,
        messageId: response.data.messages?.[0]?.id,
      });

      await logMenuSent({
        userNumber: request.number,
        menuType: 'other',
        buttonCount: request.buttons.length,
        title: request.title,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        msg: '[Meta] Failed to send interactive buttons',
        phone,
        error: errorMessage,
        response: (error as any)?.response?.data,
      });

      await logMenuSent({
        userNumber: request.number,
        menuType: 'other',
        buttonCount: request.buttons.length,
        title: request.title,
        success: false,
        errorMessage,
      });

      throw error;
    }
  });
}

export interface SendListRequest {
  number: string;
  message: string;
  title: string;
  buttonLabel: string;
  options: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

/**
 * Send interactive list via Meta Cloud API
 *
 * Meta supports lists with sections. Max 10 items per section.
 */
export async function sendList(request: SendListRequest): Promise<void> {
  const phone = sanitizePhoneNumber(request.number);

  if (!isBrazilianNumber(phone)) {
    logger.warn({
      msg: '[Meta] Skipping interactive list for non-Brazilian number',
      phone,
    });
    const fallbackText = `${request.message}\n\n${request.options.map((o) => `• ${o.title}${o.description ? ': ' + o.description : ''}`).join('\n')}`;
    await sendText(phone, fallbackText);
    return;
  }

  logger.info({
    msg: '[Meta] Sending interactive list',
    phone,
    optionCount: request.options.length,
  });

  await messageRateLimiter.send(async () => {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: request.message || '',
          },
          action: {
            button: (request.buttonLabel || 'Ver opções').substring(0, 20),
            sections: [
              {
                title: (request.title || 'Opções').substring(0, 24),
                rows: request.options.slice(0, 10).map((opt) => ({
                  id: opt.id.substring(0, 200),
                  title: opt.title.substring(0, 24),
                  description: opt.description?.substring(0, 72),
                })),
              },
            ],
          },
        },
      };

      const response = await api.post<MetaMessageResponse>('/messages', payload);

      logger.info({
        msg: '[Meta] Interactive list sent successfully',
        phone,
        messageId: response.data.messages?.[0]?.id,
      });

      await logMenuSent({
        userNumber: request.number,
        menuType: 'other',
        buttonCount: request.options.length,
        title: request.title,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        msg: '[Meta] Failed to send interactive list',
        phone,
        error: errorMessage,
        response: (error as any)?.response?.data,
      });

      await logMenuSent({
        userNumber: request.number,
        menuType: 'other',
        buttonCount: request.options.length,
        title: request.title,
        success: false,
        errorMessage,
      });

      throw error;
    }
  });
}

export interface SendPixButtonRequest {
  number: string;
  pixKey: string;
  type: 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'EVP';
  merchantName?: string;
}

/**
 * Send PIX payment info via Meta Cloud API
 *
 * Meta does NOT support native PIX buttons.
 * Workaround: send formatted text with PIX code for copy/paste.
 */
export async function sendPixButton(request: SendPixButtonRequest): Promise<void> {
  const phone = sanitizePhoneNumber(request.number);

  logger.info({
    msg: '[Meta] Sending PIX workaround (formatted text)',
    phone,
    type: request.type,
  });

  // PIX workaround: send as formatted text
  const pixText = [
    '💳 *Pagamento via PIX*',
    '',
    '📋 Copie o código abaixo e cole no seu app de pagamento:',
    '',
    `\`\`\`${request.pixKey}\`\`\``,
    '',
    '✅ Após o pagamento, envie o comprovante aqui.',
  ].join('\n');

  await messageRateLimiter.send(async () => {
    try {
      await sendText(phone, pixText);

      await logPixButtonSent({
        userNumber: request.number,
        plan: 'premium',
        amount: 0,
        pixCode: request.pixKey,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await logPixButtonSent({
        userNumber: request.number,
        plan: 'premium',
        amount: 0,
        pixCode: request.pixKey,
        success: false,
        errorMessage,
      });

      throw error;
    }
  });
}

// ============================================
// CONNECTION & STATUS
// ============================================

/**
 * Check WhatsApp connection status via Meta Cloud API
 *
 * Meta Cloud API is always "connected" - it's server-to-server.
 * We verify by checking if the phone number ID is valid.
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const response = await axios.get(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { fields: 'verified_name,quality_rating' },
    });

    logger.info({
      msg: '[Meta] Connection status checked',
      connected: true,
      verifiedName: response.data.verified_name,
      qualityRating: response.data.quality_rating,
    });

    return true;
  } catch (error) {
    logger.error({
      msg: '[Meta] Connection check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return false;
  }
}

// ============================================
// MEDIA DOWNLOAD (2-step process)
// ============================================

/**
 * Download media from Meta Cloud API
 *
 * Meta requires 2 steps:
 * 1. GET media URL from media ID
 * 2. Download file from temporary URL (with Bearer token)
 *
 * @param mediaId - Media ID from webhook payload (e.g., image.id)
 * @returns Buffer with file contents
 */
export async function downloadMedia(mediaId: string): Promise<Buffer> {
  logger.info({
    msg: '[Meta] Downloading media (2-step)',
    mediaId,
  });

  try {
    // Step 1: Get temporary download URL
    const urlResponse = await axios.get(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const downloadUrl = urlResponse.data.url;

    if (!downloadUrl) {
      throw new Error(`No download URL returned for media ID: ${mediaId}`);
    }

    logger.debug({
      msg: '[Meta] Got media download URL',
      mediaId,
      mimeType: urlResponse.data.mime_type,
      fileSize: urlResponse.data.file_size,
    });

    // Step 2: Download the actual file (Bearer token required)
    const fileResponse = await axios.get(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(fileResponse.data);

    logger.info({
      msg: '[Meta] Media downloaded successfully',
      mediaId,
      size: buffer.length,
    });

    return buffer;
  } catch (error) {
    logger.error({
      msg: '[Meta] Failed to download media',
      mediaId,
      error: error instanceof Error ? error.message : 'Unknown error',
      response: (error as any)?.response?.data,
    });

    throw error;
  }
}

// ============================================
// WEBHOOK CONFIGURATION
// ============================================

/**
 * Set webhook URL - Not applicable for Meta Cloud API
 *
 * Meta webhooks are configured in the Meta Developer Portal, not via API.
 */
export async function setWebhook(_webhookUrl: string): Promise<void> {
  logger.info({
    msg: '[Meta] setWebhook called - Meta webhooks are configured in Developer Portal',
  });
}

/**
 * Get webhook URL - Not applicable for Meta Cloud API
 */
export async function getWebhook(): Promise<string | null> {
  logger.info({
    msg: '[Meta] getWebhook called - Meta webhooks are configured in Developer Portal',
  });
  return null;
}

// ============================================
// TEMPLATE MESSAGES (Meta-specific)
// ============================================

/**
 * Send a template message via Meta Cloud API
 *
 * Templates are required for messages sent outside the 24h conversation window.
 * Templates must be pre-approved in the Meta Business Manager.
 *
 * @param userNumber - User's WhatsApp number
 * @param templateName - Pre-approved template name
 * @param languageCode - Template language code (e.g., "pt_BR")
 * @param components - Optional template components (header, body params, etc.)
 */
export async function sendTemplate(
  userNumber: string,
  templateName: string,
  languageCode: string = 'pt_BR',
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters?: Array<{ type: 'text'; text: string }>;
    sub_type?: 'quick_reply';
    index?: number;
  }>
): Promise<void> {
  const phone = sanitizePhoneNumber(userNumber);

  logger.info({
    msg: '[Meta] Sending template message',
    phone,
    templateName,
    languageCode,
  });

  try {
    const payload: any = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
      },
    };

    if (components && components.length > 0) {
      payload.template.components = components;
    }

    const response = await api.post<MetaMessageResponse>('/messages', payload);

    logger.info({
      msg: '[Meta] Template message sent successfully',
      phone,
      templateName,
      messageId: response.data.messages?.[0]?.id,
    });
  } catch (error) {
    logger.error({
      msg: '[Meta] Failed to send template message',
      phone,
      templateName,
      error: error instanceof Error ? error.message : 'Unknown error',
      response: (error as any)?.response?.data,
    });

    throw error;
  }
}

// Export axios instance for testing
export const metaClient = api;
