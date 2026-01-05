import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';

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
 * @param request - Button message data
 */
export async function sendButtons(request: SendButtonsRequest): Promise<AvisaApiResponse> {
  try {
    // Ensure number is in correct format (only digits with DDI)
    const sanitizedNumber = request.number.replace(/\D/g, '');

    // Validate buttons
    if (!request.buttons || request.buttons.length === 0) {
      throw new Error('At least one button is required');
    }

    if (request.buttons.length > 3) {
      throw new Error('Maximum 3 buttons allowed');
    }

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

    return response.data;
  } catch (error) {
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
  try {
    // Ensure number is in correct format (only digits with DDI)
    const sanitizedNumber = request.number.replace(/\D/g, '');

    if (!request.pix || request.pix.trim().length === 0) {
      throw new Error('PIX code is required');
    }

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

    return response.data;
  } catch (error) {
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
  try {
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

    return response.data;
  } catch (error) {
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
