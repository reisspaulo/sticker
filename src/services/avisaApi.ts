import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';
import { logMenuSent, logPixButtonSent } from './usageLogs';
import { sendText } from './evolutionApi';

// ============================================
// INTERNATIONAL NUMBER DETECTION
// ============================================

/**
 * Check if a phone number is Brazilian (starts with 55)
 * @param phoneNumber - Phone number (with or without formatting)
 * @returns true if Brazilian number
 */
export function isBrazilianNumber(phoneNumber: string): boolean {
  const sanitized = phoneNumber.replace(/\D/g, '');
  return sanitized.startsWith('55');
}

// Avisa API configuration
const avisaApiUrl = process.env.AVISA_API_URL || 'https://www.avisaapi.com.br/api';
const avisaApiToken = process.env.AVISA_API_TOKEN;

if (!avisaApiToken) {
  throw new Error('AVISA_API_TOKEN must be defined');
}

// Create axios instance with default configuration
const api: AxiosInstance = axios.create({
  baseURL: avisaApiUrl,
  timeout: 30000, // 30 seconds
  headers: {
    'Authorization': `Bearer ${avisaApiToken}`,
    'Content-Type': 'application/json',
  },
});

// ============================================
// INTERFACES
// ============================================

export interface ButtonData {
  id: string;
  text: string;
}

export interface SendButtonsRequest {
  number: string;
  title: string;
  desc?: string;
  footer?: string;
  buttons: ButtonData[];
}

export interface SendPixButtonRequest {
  number: string;
  pix: string;
}

export interface ListItem {
  title: string;
  desc?: string;
  RowId: string;
}

export interface SendListRequest {
  number: string;
  buttontext: string;
  desc?: string;
  toptext?: string;
  list: ListItem[];
}

export interface AvisaApiResponse {
  status?: string;
  message?: string;
  [key: string]: any;
}

export interface SetWebhookRequest {
  webhook: string;
}

export interface ShowWebhookResponse {
  status: boolean;
  webhook?: string;
}

// ============================================
// SEND BUTTONS (Botões Interativos)
// ============================================

/**
 * Send an interactive message with buttons via Avisa API
 * Falls back to plain text for international (non-Brazilian) numbers
 * @param request - Button message data
 */
export async function sendButtons(request: SendButtonsRequest): Promise<AvisaApiResponse> {
  // Ensure number is in correct format (only digits with DDI)
  const sanitizedNumber = request.number.replace(/\D/g, '');

  // Validate buttons
  if (!request.buttons || request.buttons.length === 0) {
    throw new Error('At least one button is required');
  }

  if (request.buttons.length > 3) {
    throw new Error('Maximum 3 buttons allowed');
  }

  // Check if international number - use text fallback
  if (!isBrazilianNumber(sanitizedNumber)) {
    logger.info({
      msg: 'International number detected - using text fallback instead of Avisa buttons',
      number: sanitizedNumber,
      title: request.title,
    });

    // Map button IDs to universal commands
    const buttonIdToCommand: Record<string, string> = {
      'button_upgrade_premium': 'premium',
      'button_upgrade_ultra': 'ultra',
      'button_use_bonus': 'bonus',
      'button_dismiss_upgrade': 'agora não',
    };

    // Build text message from button data
    let textMessage = '';
    if (request.title) textMessage += `${request.title}\n\n`;
    if (request.desc) textMessage += `${request.desc}\n\n`;

    // Add button options as commands (not numbers)
    textMessage += `📋 *Opções (digite o comando):*\n`;
    request.buttons.forEach((btn) => {
      const command = buttonIdToCommand[btn.id];
      if (command) {
        textMessage += `• Digite *${command}* → ${btn.text}\n`;
      } else {
        // For unknown buttons, just show the text
        textMessage += `• ${btn.text}\n`;
      }
    });

    if (request.footer) textMessage += `\n_${request.footer}_`;

    await sendText(sanitizedNumber, textMessage);

    // Log as successful (text fallback)
    let menuType: 'upgrade' | 'plans' | 'welcome' | 'limit_reached' | 'pix_options' | 'other' = 'other';
    if (request.title.includes('Limite')) menuType = 'limit_reached';
    else if (request.title.includes('Upgrade') || request.title.includes('upgrade')) menuType = 'upgrade';
    else if (request.title.includes('Plano') || request.title.includes('plano')) menuType = 'plans';

    await logMenuSent({
      userNumber: sanitizedNumber,
      menuType,
      buttonCount: request.buttons.length,
      title: request.title + ' (text fallback)',
      success: true,
    }).catch(() => {});

    return { status: 'sent_as_text', message: 'International number - sent as plain text' };
  }

  // Brazilian number - use Avisa API with interactive buttons
  try {
    logger.info({
      msg: 'Sending interactive buttons via Avisa API',
      number: sanitizedNumber,
      title: request.title,
      buttonCount: request.buttons.length,
    });

    const response = await api.post<AvisaApiResponse>('/actions/buttons', {
      number: sanitizedNumber,
      title: request.title,
      desc: request.desc,
      footer: request.footer,
      buttons: request.buttons,
    });

    logger.info({
      msg: 'Interactive buttons sent successfully',
      number: sanitizedNumber,
      response: response.data,
    });

    // Log menu sent to database
    let menuType: 'upgrade' | 'plans' | 'welcome' | 'limit_reached' | 'pix_options' | 'other' = 'other';
    if (request.title.includes('Limite')) menuType = 'limit_reached';
    else if (request.title.includes('Upgrade') || request.title.includes('upgrade')) menuType = 'upgrade';
    else if (request.title.includes('Plano') || request.title.includes('plano')) menuType = 'plans';
    else if (request.title.includes('Bem-vindo') || request.title.includes('bem-vindo')) menuType = 'welcome';
    else if (request.title.includes('PIX') || request.title.includes('pix')) menuType = 'pix_options';

    await logMenuSent({
      userNumber: sanitizedNumber,
      menuType,
      buttonCount: request.buttons.length,
      title: request.title,
      success: true,
    });

    return response.data;
  } catch (error) {
    // Log failed menu send to database
    await logMenuSent({
      userNumber: sanitizedNumber,
      menuType: 'other',
      buttonCount: request.buttons?.length || 0,
      title: request.title,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }).catch(() => {}); // Don't fail if logging fails

    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Avisa API error (sendButtons)',
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        number: request.number,
      });
      throw new Error(
        `Avisa API failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }

    logger.error({
      msg: 'Error sending buttons',
      error: error instanceof Error ? error.message : 'Unknown error',
      number: request.number,
    });
    throw error;
  }
}

// ============================================
// SEND PIX BUTTON (Botão de Pagamento PIX)
// ============================================

/**
 * Send a PIX payment button via Avisa API
 * @param request - PIX button data
 */
export async function sendPixButton(request: SendPixButtonRequest): Promise<AvisaApiResponse> {
  // Ensure number is in correct format (only digits with DDI)
  const sanitizedNumber = request.number.replace(/\D/g, '');

  if (!request.pix || request.pix.trim().length === 0) {
    throw new Error('PIX code is required');
  }

  // Check if international number - send PIX code as text
  if (!isBrazilianNumber(sanitizedNumber)) {
    logger.info({
      msg: 'International number detected - sending PIX code as text instead of button',
      number: sanitizedNumber,
      pixLength: request.pix.length,
    });

    // Build text message with PIX code
    const textMessage = `💰 *Código PIX para pagamento:*\n\n` +
      `Copie o código abaixo e cole no seu app de banco:\n\n` +
      `\`\`\`\n${request.pix}\n\`\`\`\n\n` +
      `_O código expira em 30 minutos_`;

    await sendText(sanitizedNumber, textMessage);

    // Log as successful (text fallback)
    await logPixButtonSent({
      userNumber: sanitizedNumber,
      plan: 'premium',
      amount: 0,
      pixCode: request.pix,
      success: true,
    }).catch(() => {});

    return { status: 'sent_as_text', message: 'International number - PIX code sent as plain text' };
  }

  // Brazilian number - use Avisa API with PIX button
  try {
    logger.info({
      msg: 'Sending PIX button via Avisa API',
      number: sanitizedNumber,
      pixLength: request.pix.length,
    });

    const response = await api.post<AvisaApiResponse>('/buttons/pix', {
      number: sanitizedNumber,
      pix: request.pix,
    });

    logger.info({
      msg: 'PIX button sent successfully',
      number: sanitizedNumber,
      response: response.data,
    });

    // Log PIX button sent to database
    // Note: We don't have plan/amount info here, so we use defaults
    await logPixButtonSent({
      userNumber: sanitizedNumber,
      plan: 'premium', // Default, actual plan determined by context
      amount: 0, // Amount not available at this level
      pixCode: request.pix,
      success: true,
    });

    return response.data;
  } catch (error) {
    // Log failed PIX button send to database
    const sanitizedNumber = request.number.replace(/\D/g, '');
    await logPixButtonSent({
      userNumber: sanitizedNumber,
      plan: 'premium',
      amount: 0,
      pixCode: request.pix,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }).catch(() => {}); // Don't fail if logging fails

    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Avisa API error (sendPixButton)',
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        number: request.number,
      });
      throw new Error(
        `Avisa API failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }

    logger.error({
      msg: 'Error sending PIX button',
      error: error instanceof Error ? error.message : 'Unknown error',
      number: request.number,
    });
    throw error;
  }
}

// ============================================
// SEND LIST (Lista Interativa)
// ============================================

/**
 * Send an interactive list message via Avisa API
 * @param request - List message data
 */
export async function sendList(request: SendListRequest): Promise<AvisaApiResponse> {
  // Ensure number is in correct format (only digits with DDI)
  const sanitizedNumber = request.number.replace(/\D/g, '');

  // Validate list
  if (!request.list || request.list.length === 0) {
    throw new Error('At least one list item is required');
  }

  if (request.list.length > 10) {
    throw new Error('Maximum 10 list items allowed');
  }

  // Validate buttontext
  if (!request.buttontext || request.buttontext.trim().length === 0) {
    throw new Error('Button text is required');
  }

  // Check if international number - use text fallback
  if (!isBrazilianNumber(sanitizedNumber)) {
    logger.info({
      msg: 'International number detected - using text fallback instead of Avisa list',
      number: sanitizedNumber,
      buttontext: request.buttontext,
    });

    // Map list RowIds to universal commands
    const rowIdToCommand: Record<string, string> = {
      'plan_premium': 'premium',
      'plan_ultra': 'ultra',
      'plan_free': 'planos',
      'payment_card': 'cartao',
      'payment_boleto': 'boleto',
      'payment_pix': 'pix',
    };

    // Build text message from list data
    let textMessage = '';
    if (request.toptext) textMessage += `${request.toptext}\n\n`;
    if (request.desc) textMessage += `${request.desc}\n\n`;

    // Add list items as commands (not numbers)
    textMessage += `📋 *${request.buttontext} (digite o comando):*\n`;
    request.list.forEach((item) => {
      const command = rowIdToCommand[item.RowId];
      if (command) {
        textMessage += `• Digite *${command}* → ${item.title}`;
      } else {
        // For unknown items, just show the title
        textMessage += `• ${item.title}`;
      }
      if (item.desc) textMessage += ` - ${item.desc}`;
      textMessage += `\n`;
    });

    await sendText(sanitizedNumber, textMessage);

    // Log as successful (text fallback)
    let menuType: 'upgrade' | 'plans' | 'welcome' | 'limit_reached' | 'pix_options' | 'other' = 'other';
    const buttonTextLower = request.buttontext.toLowerCase();
    const descLower = (request.desc || '').toLowerCase();
    if (buttonTextLower.includes('plano') || descLower.includes('plano')) menuType = 'plans';
    else if (buttonTextLower.includes('pagamento') || descLower.includes('pagamento')) menuType = 'pix_options';

    await logMenuSent({
      userNumber: sanitizedNumber,
      menuType,
      buttonCount: request.list.length,
      title: request.buttontext + ' (text fallback)',
      success: true,
    }).catch(() => {});

    return { status: 'sent_as_text', message: 'International number - sent as plain text' };
  }

  // Brazilian number - use Avisa API with interactive list
  try {
    logger.info({
      msg: 'Sending interactive list via Avisa API',
      number: sanitizedNumber,
      buttontext: request.buttontext,
      itemCount: request.list.length,
    });

    const response = await api.post<AvisaApiResponse>('/actions/sendList', {
      number: sanitizedNumber,
      buttontext: request.buttontext,
      desc: request.desc,
      toptext: request.toptext,
      list: request.list,
    });

    logger.info({
      msg: 'Interactive list sent successfully',
      number: sanitizedNumber,
      response: response.data,
    });

    // Log menu sent to database (lists are also menus)
    let menuType: 'upgrade' | 'plans' | 'welcome' | 'limit_reached' | 'pix_options' | 'other' = 'other';
    const buttonTextLower = request.buttontext.toLowerCase();
    const descLower = (request.desc || '').toLowerCase();
    if (buttonTextLower.includes('plano') || descLower.includes('plano')) menuType = 'plans';
    else if (buttonTextLower.includes('pagamento') || descLower.includes('pagamento')) menuType = 'pix_options';

    await logMenuSent({
      userNumber: sanitizedNumber,
      menuType,
      buttonCount: request.list.length,
      title: request.buttontext,
      success: true,
    });

    return response.data;
  } catch (error) {
    // Log failed list send to database
    const sanitizedNumber = request.number.replace(/\D/g, '');
    await logMenuSent({
      userNumber: sanitizedNumber,
      menuType: 'other',
      buttonCount: request.list?.length || 0,
      title: request.buttontext,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    }).catch(() => {}); // Don't fail if logging fails

    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Avisa API error (sendList)',
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        number: request.number,
      });
      throw new Error(
        `Avisa API failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }

    logger.error({
      msg: 'Error sending list',
      error: error instanceof Error ? error.message : 'Unknown error',
      number: request.number,
    });
    throw error;
  }
}

// ============================================
// WEBHOOK MANAGEMENT
// ============================================

/**
 * Set webhook URL for receiving Avisa API events
 * @param webhookUrl - Complete HTTPS URL for webhook
 */
export async function setWebhook(webhookUrl: string): Promise<AvisaApiResponse> {
  try {
    if (!webhookUrl || !webhookUrl.startsWith('https://')) {
      throw new Error('Webhook URL must be a valid HTTPS URL');
    }

    logger.info({
      msg: 'Setting Avisa API webhook',
      webhookUrl,
    });

    const response = await api.post<AvisaApiResponse>('/webhook', {
      webhook: webhookUrl,
    });

    logger.info({
      msg: 'Webhook configured successfully',
      webhookUrl,
      response: response.data,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Avisa API error (setWebhook)',
        status: error.response?.status,
        data: error.response?.data,
        webhookUrl,
      });
      throw new Error(
        `Avisa API failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }

    logger.error({
      msg: 'Error setting webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
      webhookUrl,
    });
    throw error;
  }
}

/**
 * Get currently configured webhook URL
 */
export async function getWebhook(): Promise<ShowWebhookResponse> {
  try {
    logger.info({
      msg: 'Getting Avisa API webhook configuration',
    });

    const response = await api.get<ShowWebhookResponse>('/webhook');

    logger.info({
      msg: 'Webhook configuration retrieved',
      webhook: response.data.webhook,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Avisa API error (getWebhook)',
        status: error.response?.status,
        data: error.response?.data,
      });
      throw new Error(
        `Avisa API failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }

    logger.error({
      msg: 'Error getting webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Sanitize phone number to include only digits with DDI
 * @param phoneNumber - Phone number in any format
 * @returns Sanitized phone number (e.g., "5511999999999")
 */
export function sanitizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  let sanitized = phoneNumber.replace(/\D/g, '');

  // Remove @s.whatsapp.net if present
  sanitized = sanitized.replace('@s.whatsapp.net', '');

  return sanitized;
}

/**
 * Validate button text length (WhatsApp limit: 20 characters)
 * @param text - Button text
 * @returns true if valid
 */
export function validateButtonText(text: string): boolean {
  return text.length > 0 && text.length <= 20;
}

/**
 * Create buttons from simple array of texts
 * @param buttonTexts - Array of button labels
 * @returns Array of ButtonData with auto-generated IDs
 */
export function createButtons(buttonTexts: string[]): ButtonData[] {
  return buttonTexts.map((text, index) => ({
    id: `btn_${index + 1}`,
    text: text.substring(0, 20), // Ensure max 20 chars
  }));
}
