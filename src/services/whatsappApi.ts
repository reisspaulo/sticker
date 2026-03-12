/**
 * WhatsApp API Adapter
 *
 * Provides a unified interface for WhatsApp operations that works with
 * Evolution API + Avisa API, Z-API, or Meta Cloud API based on feature flags.
 *
 * This adapter pattern allows seamless switching between providers without
 * changing code in 17+ files that use WhatsApp APIs.
 *
 * Provider priority: USE_META > USE_ZAPI > Evolution API (default)
 *
 * Usage:
 *   import { sendSticker, sendText, sendButtons } from './services/whatsappApi';
 */

import { featureFlags } from '../config/features';
import logger from '../config/logger';

// Import Evolution + Avisa APIs
import * as evolutionApi from './evolutionApi';
import * as avisaApi from './avisaApi';

// Import Z-API
import * as zapiApi from './zapiApi';

// Import Meta Cloud API (lazy - only loaded when USE_META is true)
const metaApi = featureFlags.USE_META ? require('./metaCloudApi') : null;

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ButtonData {
  id: string;
  text: string;
}

export interface SendButtonsRequest {
  number: string;
  message?: string;
  title?: string;
  desc?: string; // Alias for message for compatibility
  footer?: string;
  buttons: ButtonData[];
}

export interface SendListRequest {
  number: string;
  message?: string;
  title?: string;
  buttonLabel?: string;
  // Avisa API compatible properties
  buttontext?: string;
  desc?: string;
  toptext?: string;
  list?: Array<{
    RowId: string;
    title: string;
    desc?: string;
  }>;
  // Z-API compatible properties
  options?: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export interface SendPixButtonRequest {
  number: string;
  pixKey: string;
  type: 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'EVP';
  merchantName?: string;
}

// ============================================
// BASIC MESSAGING
// ============================================

/**
 * Send a sticker to a WhatsApp user
 */
export async function sendSticker(userNumber: string, stickerUrl: string): Promise<void> {
  if (featureFlags.USE_META) {
    logger.debug('[WhatsApp Adapter] Using Meta Cloud API for sendSticker');
    return metaApi.sendSticker(userNumber, stickerUrl);
  } else if (featureFlags.USE_ZAPI) {
    logger.debug('[WhatsApp Adapter] Using Z-API for sendSticker');
    return zapiApi.sendSticker(userNumber, stickerUrl);
  } else {
    logger.debug('[WhatsApp Adapter] Using Evolution API for sendSticker');
    return evolutionApi.sendSticker(userNumber, stickerUrl);
  }
}

/**
 * Send a text message to a WhatsApp user
 */
export async function sendText(
  userNumber: string,
  text: string,
  options?: {
    delayMessage?: number;
    delayTyping?: number;
  }
): Promise<void> {
  if (featureFlags.USE_META) {
    logger.debug('[WhatsApp Adapter] Using Meta Cloud API for sendText');
    return metaApi.sendText(userNumber, text, options);
  } else if (featureFlags.USE_ZAPI) {
    logger.debug('[WhatsApp Adapter] Using Z-API for sendText');
    return zapiApi.sendText(userNumber, text, options);
  } else {
    logger.debug('[WhatsApp Adapter] Using Evolution API for sendText');
    return evolutionApi.sendText(userNumber, text);
  }
}

/**
 * Send a video to a WhatsApp user
 */
export async function sendVideo(
  userNumber: string,
  videoUrl: string,
  caption?: string,
  options?: {
    viewOnce?: boolean;
    async?: boolean;
  }
): Promise<void> {
  if (featureFlags.USE_META) {
    logger.debug('[WhatsApp Adapter] Using Meta Cloud API for sendVideo');
    return metaApi.sendVideo(userNumber, videoUrl, caption, options);
  } else if (featureFlags.USE_ZAPI) {
    logger.debug('[WhatsApp Adapter] Using Z-API for sendVideo');
    return zapiApi.sendVideo(userNumber, videoUrl, caption, options);
  } else {
    logger.debug('[WhatsApp Adapter] Using Evolution API for sendVideo');
    return evolutionApi.sendVideo(userNumber, videoUrl, caption);
  }
}

// ============================================
// INTERACTIVE MESSAGES
// ============================================

/**
 * Check if a phone number is Brazilian
 * (Used to determine if interactive features should be sent)
 */
export function isBrazilianNumber(phoneNumber: string): boolean {
  if (featureFlags.USE_META) {
    return metaApi.isBrazilianNumber(phoneNumber);
  } else if (featureFlags.USE_ZAPI) {
    return zapiApi.isBrazilianNumber(phoneNumber);
  } else {
    return avisaApi.isBrazilianNumber(phoneNumber);
  }
}

/**
 * Send interactive buttons to a WhatsApp user
 */
export async function sendButtons(request: SendButtonsRequest): Promise<void> {
  if (featureFlags.USE_META) {
    logger.debug('[WhatsApp Adapter] Using Meta Cloud API for sendButtons');

    const metaRequest = {
      number: request.number,
      message: request.desc || request.message || '',
      title: request.title,
      footer: request.footer,
      buttons: request.buttons.map((btn) => ({
        type: 'REPLY' as const,
        label: btn.text,
        id: btn.id,
      })),
    };

    return metaApi.sendButtons(metaRequest);
  } else if (featureFlags.USE_ZAPI) {
    logger.debug('[WhatsApp Adapter] Using Z-API for sendButtons');

    // Transform to Z-API format
    const zapiRequest: zapiApi.SendButtonsRequest = {
      number: request.number,
      message: request.desc || request.message || '',
      title: request.title,
      footer: request.footer,
      buttons: request.buttons.map((btn) => ({
        type: 'REPLY',
        label: btn.text,
        id: btn.id,
      })),
    };

    return zapiApi.sendButtons(zapiRequest);
  } else {
    logger.debug('[WhatsApp Adapter] Using Avisa API for sendButtons');

    // Transform to Avisa API format
    const avisaRequest: avisaApi.SendButtonsRequest = {
      number: request.number,
      title: request.title || '',
      desc: request.desc || request.message || '',
      footer: request.footer,
      buttons: request.buttons.map((btn) => ({
        id: btn.id,
        text: btn.text,
      })),
    };

    await avisaApi.sendButtons(avisaRequest);
    return;
  }
}

/**
 * Send interactive list to a WhatsApp user
 */
export async function sendList(request: SendListRequest): Promise<void> {
  if (featureFlags.USE_META) {
    logger.debug('[WhatsApp Adapter] Using Meta Cloud API for sendList');

    const metaRequest = {
      number: request.number,
      message: request.desc || request.message || '',
      title: request.toptext || request.title || '',
      buttonLabel: request.buttontext || request.buttonLabel || '',
      options:
        request.list?.map((item) => ({
          id: item.RowId,
          title: item.title,
          description: item.desc,
        })) ||
        request.options ||
        [],
    };

    return metaApi.sendList(metaRequest);
  } else if (featureFlags.USE_ZAPI) {
    logger.debug('[WhatsApp Adapter] Using Z-API for sendList');

    // Transform to Z-API format
    const zapiRequest: zapiApi.SendListRequest = {
      number: request.number,
      message: request.desc || request.message || '',
      title: request.toptext || request.title || '',
      buttonLabel: request.buttontext || request.buttonLabel || '',
      options:
        request.list?.map((item) => ({
          id: item.RowId,
          title: item.title,
          description: item.desc,
        })) ||
        request.options ||
        [],
    };

    return zapiApi.sendList(zapiRequest);
  } else {
    logger.debug('[WhatsApp Adapter] Using Avisa API for sendList');

    // Transform to Avisa API format
    // Support both old property names and new ones
    const avisaRequest: avisaApi.SendListRequest = {
      number: request.number,
      buttontext: request.buttontext || request.buttonLabel || '',
      desc: request.desc || request.message || '',
      toptext: request.toptext || request.title || '',
      list:
        request.list ||
        request.options?.map((opt) => ({
          RowId: opt.id,
          title: opt.title,
          desc: opt.description || '',
        })) ||
        [],
    };

    await avisaApi.sendList(avisaRequest);
    return;
  }
}

/**
 * Send PIX payment button to a WhatsApp user
 */
export async function sendPixButton(request: SendPixButtonRequest): Promise<void> {
  if (featureFlags.USE_META) {
    logger.debug('[WhatsApp Adapter] Using Meta Cloud API for sendPixButton');
    return metaApi.sendPixButton(request);
  } else if (featureFlags.USE_ZAPI) {
    logger.debug('[WhatsApp Adapter] Using Z-API for sendPixButton');
    return zapiApi.sendPixButton(request);
  } else {
    logger.debug('[WhatsApp Adapter] Using Avisa API for sendPixButton');

    // Transform to Avisa API format
    const avisaRequest: avisaApi.SendPixButtonRequest = {
      number: request.number,
      pix: request.pixKey,
    };

    await avisaApi.sendPixButton(avisaRequest);
    return;
  }
}

// ============================================
// CONNECTION & STATUS
// ============================================

/**
 * Check WhatsApp connection status
 */
export async function checkConnection(): Promise<boolean> {
  if (featureFlags.USE_META) {
    logger.debug('[WhatsApp Adapter] Using Meta Cloud API for checkConnection');
    return metaApi.checkConnection();
  } else if (featureFlags.USE_ZAPI) {
    logger.debug('[WhatsApp Adapter] Using Z-API for checkConnection');
    return zapiApi.checkConnection();
  } else {
    logger.debug('[WhatsApp Adapter] Using Evolution API for checkConnection');
    return evolutionApi.checkConnection();
  }
}

// ============================================
// MEDIA DOWNLOAD (Evolution API only)
// ============================================

/**
 * Download media from WhatsApp message
 *
 * Supports both Evolution API (messageKey) and Z-API (direct URL).
 *
 * @param messageKeyOrUrl - Either MessageKey (Evolution) or direct URL (Z-API)
 */
export async function downloadMedia(messageKeyOrUrl: any): Promise<Buffer> {
  // Check if it's a Meta media ID (string starting with 'meta:')
  if (typeof messageKeyOrUrl === 'string' && messageKeyOrUrl.startsWith('meta:')) {
    logger.debug('[WhatsApp Adapter] Downloading media via Meta Cloud API (2-step)');
    const mediaId = messageKeyOrUrl.replace('meta:', '');
    return metaApi.downloadMedia(mediaId);
  }

  // Check if it's a direct URL (string) - Z-API mode
  if (typeof messageKeyOrUrl === 'string' && messageKeyOrUrl.startsWith('http')) {
    logger.debug('[WhatsApp Adapter] Downloading media from direct URL (Z-API mode)');

    try {
      const response = await fetch(messageKeyOrUrl, {
        headers: {
          'User-Agent': 'StickerZap/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error({
        msg: '[WhatsApp Adapter] Failed to download media from URL',
        url: messageKeyOrUrl.substring(0, 100),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Otherwise, use Evolution API downloadMedia
  if (featureFlags.USE_ZAPI) {
    logger.error('[WhatsApp Adapter] Expected URL but got messageKey in Z-API mode');
    throw new Error(
      'downloadMedia in Z-API mode requires a direct URL string, not a messageKey object'
    );
  }

  logger.debug('[WhatsApp Adapter] Using Evolution API for downloadMedia');
  return evolutionApi.downloadMedia(messageKeyOrUrl);
}

// ============================================
// WEBHOOK CONFIGURATION
// ============================================

/**
 * Set webhook URL
 */
export async function setWebhook(webhookUrl: string): Promise<void> {
  if (featureFlags.USE_META) {
    logger.debug('[WhatsApp Adapter] Meta Cloud API webhooks are configured in Developer Portal');
    return;
  } else if (featureFlags.USE_ZAPI) {
    logger.debug('[WhatsApp Adapter] Using Z-API for setWebhook');
    await zapiApi.setWebhook(webhookUrl);
    return;
  } else {
    logger.debug('[WhatsApp Adapter] Using Avisa API for setWebhook');
    await avisaApi.setWebhook(webhookUrl);
    return;
  }
}

/**
 * Get current webhook URL
 */
export async function getWebhook(): Promise<string | null> {
  if (featureFlags.USE_META) {
    logger.debug('[WhatsApp Adapter] Meta Cloud API webhooks are configured in Developer Portal');
    return null;
  } else if (featureFlags.USE_ZAPI) {
    logger.debug('[WhatsApp Adapter] Using Z-API for getWebhook');
    return zapiApi.getWebhook();
  } else {
    logger.debug('[WhatsApp Adapter] Using Avisa API for getWebhook');
    const response = await avisaApi.getWebhook();
    return response.webhook || null;
  }
}
