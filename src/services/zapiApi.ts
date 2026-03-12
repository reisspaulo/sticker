import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';
import { logStickerSent, logMessageSent, logMenuSent, logPixButtonSent } from './usageLogs';
import { messageRateLimiter, MessagePriority } from '../utils/messageRateLimiter';

/**
 * Z-API WhatsApp Integration
 *
 * Replaces both Evolution API and Avisa API with a single provider.
 *
 * Documentation: https://developer.z-api.io/
 * Base URL: https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/
 */

// Z-API configuration
const zapiInstance = process.env.Z_API_INSTANCE;
const zapiToken = process.env.Z_API_TOKEN;
const zapiClientToken = process.env.Z_API_CLIENT_TOKEN;
const zapiBaseUrl = process.env.Z_API_BASE_URL || 'https://api.z-api.io';

if (process.env.USE_ZAPI === 'true' && (!zapiInstance || !zapiToken || !zapiClientToken)) {
  throw new Error(
    'Z_API_INSTANCE, Z_API_TOKEN, and Z_API_CLIENT_TOKEN must be defined when USE_ZAPI=true'
  );
}

// Build base URL for this instance (only if Z-API vars are present)
const instanceBaseUrl =
  zapiInstance && zapiToken ? `${zapiBaseUrl}/instances/${zapiInstance}/token/${zapiToken}` : '';

// Create axios instance with default configuration
const api: AxiosInstance = axios.create({
  baseURL: instanceBaseUrl,
  timeout: 30000, // 30 seconds
  headers: {
    'Client-Token': zapiClientToken || '',
    'Content-Type': 'application/json',
  },
});

// ============================================
// RESPONSE TYPES
// ============================================

interface ZAPIResponse {
  zaapId: string;
  messageId: string;
  id: string;
}

interface ZAPIStatusResponse {
  connected: boolean;
  error: string | null;
  smartphoneConnected: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a phone number is Brazilian (country code 55)
 * Used to determine if user should receive interactive features
 */
export function isBrazilianNumber(phoneNumber: string): boolean {
  const sanitized = phoneNumber.replace(/\D/g, '');
  return sanitized.startsWith('55');
}

/**
 * Sanitize phone number to Z-API format (only digits with country code)
 * @param number - Phone number in any format
 * @returns Phone number with only digits (e.g., "5511999999999")
 */
function sanitizePhoneNumber(number: string): string {
  return number.replace(/\D/g, '');
}

// ============================================
// BASIC MESSAGING (replaces Evolution API)
// ============================================

/**
 * Send a sticker to a WhatsApp user via Z-API
 *
 * Replaces: evolutionApi.sendSticker()
 *
 * @param userNumber - User's WhatsApp number (e.g., "5511999999999")
 * @param stickerUrl - Public URL of the sticker file (.webp)
 */
export async function sendSticker(userNumber: string, stickerUrl: string): Promise<void> {
  const phone = sanitizePhoneNumber(userNumber);

  logger.info({
    msg: '[Z-API] Sending sticker',
    phone,
    stickerUrl: stickerUrl.substring(0, 100),
  });

  // Use rate limiter with HIGH priority (user is actively waiting for sticker)
  await messageRateLimiter.send(async () => {
    try {
      const response = await api.post<ZAPIResponse>('/send-sticker', {
        phone,
        sticker: stickerUrl,
      });

      logger.info({
        msg: '[Z-API] Sticker sent successfully',
        phone,
        messageId: response.data.messageId,
      });

      // Log success to database
      await logStickerSent({
        userNumber,
        stickerPath: stickerUrl,
        tipo: stickerUrl.includes('animado') ? 'animado' : 'estatico',
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        msg: '[Z-API] Failed to send sticker',
        phone,
        error: errorMessage,
      });

      // Log failure to database
      await logStickerSent({
        userNumber,
        stickerPath: stickerUrl,
        tipo: stickerUrl.includes('animado') ? 'animado' : 'estatico',
        success: false,
        errorMessage,
      });

      throw error;
    }
  }, MessagePriority.HIGH); // HIGH priority: user is actively waiting for sticker
}

/**
 * Send a text message to a WhatsApp user via Z-API
 *
 * Replaces: evolutionApi.sendText()
 *
 * @param userNumber - User's WhatsApp number
 * @param text - Message text
 * @param options - Optional parameters (delay, typing indicator)
 */
export async function sendText(
  userNumber: string,
  text: string,
  options?: {
    delayMessage?: number; // 1-15 seconds
    delayTyping?: number; // 1-15 seconds
  }
): Promise<void> {
  const phone = sanitizePhoneNumber(userNumber);

  logger.info({
    msg: '[Z-API] Sending text message',
    phone,
    messagePreview: text.substring(0, 50),
    options,
  });

  // Use rate limiter to prevent WhatsApp bans
  await messageRateLimiter.send(async () => {
    try {
      const payload: any = {
        phone,
        message: text, // Z-API uses 'message' instead of 'text'
      };

      // Add optional parameters if provided
      if (options?.delayMessage) {
        payload.delayMessage = Math.min(Math.max(options.delayMessage, 1), 15);
      }
      if (options?.delayTyping) {
        payload.delayTyping = Math.min(Math.max(options.delayTyping, 1), 15);
      }

      const response = await api.post<ZAPIResponse>('/send-text', payload);

      logger.info({
        msg: '[Z-API] Text message sent successfully',
        phone,
        messageId: response.data.messageId,
      });

      // Log success to database
      await logMessageSent({
        userNumber,
        messageType: 'text',
        messagePreview: text,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        msg: '[Z-API] Failed to send text message',
        phone,
        error: errorMessage,
      });

      // Log failure to database
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
 * Send a video to a WhatsApp user via Z-API
 *
 * Replaces: evolutionApi.sendVideo()
 *
 * @param userNumber - User's WhatsApp number
 * @param videoUrl - Public URL of the video file
 * @param caption - Optional caption
 * @param options - Optional parameters (viewOnce, async processing)
 */
export async function sendVideo(
  userNumber: string,
  videoUrl: string,
  caption?: string,
  options?: {
    viewOnce?: boolean; // View once message
    async?: boolean; // Background processing
  }
): Promise<void> {
  const phone = sanitizePhoneNumber(userNumber);

  logger.info({
    msg: '[Z-API] Sending video',
    phone,
    videoUrl: videoUrl.substring(0, 100),
    caption,
  });

  // Use rate limiter to prevent WhatsApp bans
  await messageRateLimiter.send(async () => {
    try {
      const payload: any = {
        phone,
        video: videoUrl, // Z-API uses 'video' instead of 'videoUrl'
      };

      if (caption) {
        payload.caption = caption;
      }

      if (options?.viewOnce) {
        payload.viewOnce = true;
      }

      if (options?.async) {
        payload.async = true;
      }

      const response = await api.post<ZAPIResponse>('/send-video', payload);

      logger.info({
        msg: '[Z-API] Video sent successfully',
        phone,
        messageId: response.data.messageId,
      });
    } catch (error) {
      logger.error({
        msg: '[Z-API] Failed to send video',
        phone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  });
}

// ============================================
// INTERACTIVE MESSAGES (replaces Avisa API)
// ============================================

export interface SendButtonsRequest {
  number: string;
  message: string;
  title?: string;
  footer?: string;
  buttons: Array<{
    type: 'REPLY' | 'URL' | 'CALL';
    label: string;
    id?: string; // Required for REPLY
    url?: string; // Required for URL
    phone?: string; // Required for CALL
  }>;
}

/**
 * Send interactive buttons to a WhatsApp user via Z-API
 *
 * Replaces: avisaApi.sendButtons()
 *
 * IMPORTANT: Do NOT mix button types (REPLY, URL, CALL) - causes WhatsApp Web errors
 * Safe combinations:
 * - REPLY only (up to 3 buttons)
 * - URL + CALL together (up to 2 buttons)
 *
 * @param request - Button configuration
 */
export async function sendButtons(request: SendButtonsRequest): Promise<void> {
  const phone = sanitizePhoneNumber(request.number);

  // Only send interactive buttons to Brazilian numbers
  if (!isBrazilianNumber(phone)) {
    logger.warn({
      msg: '[Z-API] Skipping interactive buttons for non-Brazilian number',
      phone,
    });

    // Send plain text fallback
    const fallbackText = `${request.message}\n\n${request.buttons.map((b) => `• ${b.label}`).join('\n')}`;
    await sendText(phone, fallbackText);
    return;
  }

  logger.info({
    msg: '[Z-API] Sending interactive buttons',
    phone,
    buttonCount: request.buttons.length,
  });

  // Use rate limiter to prevent WhatsApp bans
  await messageRateLimiter.send(async () => {
    try {
      const payload = {
        phone,
        message: request.message,
        title: request.title,
        footer: request.footer,
        buttonActions: request.buttons.map((btn) => ({
          type: btn.type,
          label: btn.label,
          id: btn.id,
          url: btn.url,
          phone: btn.phone,
        })),
      };

      const response = await api.post<ZAPIResponse>('/send-button-actions', payload);

      logger.info({
        msg: '[Z-API] Interactive buttons sent successfully',
        phone,
        messageId: response.data.messageId,
      });

      // Log success to database
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
        msg: '[Z-API] Failed to send interactive buttons',
        phone,
        error: errorMessage,
      });

      // Log failure to database
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
 * Send interactive list to a WhatsApp user via Z-API
 *
 * Replaces: avisaApi.sendList()
 *
 * @param request - List configuration
 */
export async function sendList(request: SendListRequest): Promise<void> {
  const phone = sanitizePhoneNumber(request.number);

  // Only send interactive lists to Brazilian numbers
  if (!isBrazilianNumber(phone)) {
    logger.warn({
      msg: '[Z-API] Skipping interactive list for non-Brazilian number',
      phone,
    });

    // Send plain text fallback
    const fallbackText = `${request.message}\n\n${request.options.map((o) => `• ${o.title}${o.description ? ': ' + o.description : ''}`).join('\n')}`;
    await sendText(phone, fallbackText);
    return;
  }

  logger.info({
    msg: '[Z-API] Sending interactive list',
    phone,
    optionCount: request.options.length,
  });

  // Use rate limiter to prevent WhatsApp bans
  await messageRateLimiter.send(async () => {
    try {
      const payload = {
        phone,
        message: request.message,
        optionList: {
          title: request.title,
          buttonLabel: request.buttonLabel,
          options: request.options.map((opt) => ({
            id: opt.id,
            title: opt.title,
            description: opt.description,
          })),
        },
      };

      const response = await api.post<ZAPIResponse>('/send-option-list', payload);

      logger.info({
        msg: '[Z-API] Interactive list sent successfully',
        phone,
        messageId: response.data.messageId,
      });

      // Log success to database
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
        msg: '[Z-API] Failed to send interactive list',
        phone,
        error: errorMessage,
      });

      // Log failure to database
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
  pixKey: string; // PIX Copia e Cola code
  type: 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'EVP';
  merchantName?: string; // Button label (default: "Pix")
}

/**
 * Send PIX payment button to a WhatsApp user via Z-API
 *
 * Replaces: avisaApi.sendPixButton()
 *
 * IMPORTANT: PIX button only works with valid PIX codes.
 * Success depends on WhatsApp-specific factors.
 *
 * @param request - PIX button configuration
 */
export async function sendPixButton(request: SendPixButtonRequest): Promise<void> {
  const phone = sanitizePhoneNumber(request.number);

  // Only send PIX buttons to Brazilian numbers
  if (!isBrazilianNumber(phone)) {
    logger.warn({
      msg: '[Z-API] Skipping PIX button for non-Brazilian number',
      phone,
    });

    // Send plain text fallback with PIX code
    const fallbackText = `💳 Pague via PIX:\n\n\`\`\`${request.pixKey}\`\`\`\n\nCopie o código acima e cole no seu app de pagamento.`;
    await sendText(phone, fallbackText);
    return;
  }

  logger.info({
    msg: '[Z-API] Sending PIX payment button',
    phone,
    type: request.type,
    merchantName: request.merchantName,
  });

  // Use rate limiter to prevent WhatsApp bans
  await messageRateLimiter.send(async () => {
    try {
      const payload = {
        phone,
        pixKey: request.pixKey,
        type: request.type,
        merchantName: request.merchantName || 'Pix',
      };

      const response = await api.post<ZAPIResponse>('/send-button-pix', payload);

      logger.info({
        msg: '[Z-API] PIX payment button sent successfully',
        phone,
        messageId: response.data.messageId,
      });

      // Log success to database
      await logPixButtonSent({
        userNumber: request.number,
        plan: 'premium', // Default - will be overridden by caller if needed
        amount: 0, // Not available in Z-API response
        pixCode: request.pixKey,
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({
        msg: '[Z-API] Failed to send PIX payment button',
        phone,
        error: errorMessage,
      });

      // Log failure to database
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
 * Check WhatsApp connection status via Z-API
 *
 * Replaces: evolutionApi.checkConnection()
 *
 * @returns True if connected, false otherwise
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const response = await api.get<ZAPIStatusResponse>('/status');

    const isConnected = response.data.connected && response.data.smartphoneConnected;

    logger.info({
      msg: '[Z-API] Connection status checked',
      connected: isConnected,
      error: response.data.error,
    });

    return isConnected;
  } catch (error) {
    logger.error({
      msg: '[Z-API] Failed to check connection status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return false;
  }
}

// ============================================
// WEBHOOK CONFIGURATION
// ============================================

/**
 * Configure webhook URL for receiving messages
 *
 * @param webhookUrl - HTTPS URL to receive webhooks (HTTP not supported)
 */
export async function setWebhook(webhookUrl: string): Promise<void> {
  try {
    logger.info({
      msg: '[Z-API] Setting webhook URL',
      webhookUrl,
    });

    // Z-API requires HTTPS
    if (!webhookUrl.startsWith('https://')) {
      throw new Error('Z-API only accepts HTTPS webhook URLs');
    }

    await api.put('/update-every-webhooks', {
      value: webhookUrl,
    });

    logger.info({
      msg: '[Z-API] Webhook URL configured successfully',
      webhookUrl,
    });
  } catch (error) {
    logger.error({
      msg: '[Z-API] Failed to configure webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

/**
 * Get current webhook configuration
 *
 * @returns Current webhook URL
 */
export async function getWebhook(): Promise<string | null> {
  try {
    const response = await api.get<{ value: string }>('/webhook');

    logger.info({
      msg: '[Z-API] Retrieved webhook configuration',
      webhookUrl: response.data.value,
    });

    return response.data.value;
  } catch (error) {
    logger.error({
      msg: '[Z-API] Failed to get webhook configuration',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return null;
  }
}

// Export singleton instance for testing/mocking
export const zapiClient = api;
