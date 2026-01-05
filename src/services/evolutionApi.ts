import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';

// Evolution API configuration
const evolutionApiUrl = process.env.EVOLUTION_API_URL;
const evolutionApiKey = process.env.EVOLUTION_API_KEY;
const evolutionInstance = process.env.EVOLUTION_INSTANCE;

if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
  throw new Error('EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE must be defined');
}

// Create axios instance with default configuration
const api: AxiosInstance = axios.create({
  baseURL: evolutionApiUrl,
  timeout: 30000, // 30 seconds
  headers: {
    apikey: evolutionApiKey,
    'Content-Type': 'application/json',
  },
});

interface SendMediaResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, unknown>;
  messageTimestamp: number;
  status: string;
}

/**
 * Send a sticker to a WhatsApp user via Evolution API
 * @param userNumber - User's WhatsApp number (e.g., "5511999999999")
 * @param stickerUrl - Public URL of the sticker file
 */
export async function sendSticker(userNumber: string, stickerUrl: string): Promise<void> {
  try {
    // Ensure number is in correct format (without @s.whatsapp.net)
    const sanitizedNumber = userNumber.replace('@s.whatsapp.net', '');
    const remoteJid = `${sanitizedNumber}@s.whatsapp.net`;

    logger.info({
      msg: 'Sending sticker via Evolution API',
      instance: evolutionInstance,
      remoteJid,
      stickerUrl,
    });

    // Send sticker using Evolution API's dedicated sticker endpoint
    const response = await api.post<SendMediaResponse>(`/message/sendSticker/${evolutionInstance}`, {
      number: sanitizedNumber,
      sticker: stickerUrl,
    });

    logger.info({
      msg: 'Sticker sent successfully',
      remoteJid,
      messageId: response.data.key?.id,
      status: response.data.status,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Evolution API error',
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        userNumber,
      });
      throw new Error(
        `Evolution API failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }

    logger.error({
      msg: 'Error sending sticker',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    throw error;
  }
}

/**
 * Send a text message to a WhatsApp user via Evolution API
 * @param userNumber - User's WhatsApp number
 * @param text - Message text
 */
export async function sendText(userNumber: string, text: string): Promise<void> {
  try {
    const sanitizedNumber = userNumber.replace('@s.whatsapp.net', '');
    const remoteJid = `${sanitizedNumber}@s.whatsapp.net`;

    logger.info({
      msg: 'Sending text message via Evolution API',
      instance: evolutionInstance,
      remoteJid,
    });

    const response = await api.post(`/message/sendText/${evolutionInstance}`, {
      number: sanitizedNumber,
      text,
    });

    logger.info({
      msg: 'Text message sent successfully',
      remoteJid,
      messageId: response.data.key?.id,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Evolution API error',
        status: error.response?.status,
        data: error.response?.data,
        userNumber,
      });
      throw new Error(
        `Evolution API failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }

    logger.error({
      msg: 'Error sending text',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    throw error;
  }
}

/**
 * Download media from WhatsApp using Evolution API
 * This properly decrypts WhatsApp media that can't be downloaded directly
 * @param messageId - The message ID containing the media
 * @param instanceName - Instance name (defaults to env variable)
 */
export async function downloadMedia(messageKey: { remoteJid: string; fromMe: boolean; id: string }): Promise<Buffer> {
  try {
    logger.info({
      msg: 'Downloading media via Evolution API',
      messageId: messageKey.id,
    });

    const response = await api.post(`/chat/getBase64FromMediaMessage/${evolutionInstance}`, {
      message: {
        key: messageKey,
      },
      convertToMp4: false,
    });

    if (!response.data || !response.data.base64) {
      throw new Error('No base64 data returned from Evolution API');
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(response.data.base64, 'base64');

    logger.info({
      msg: 'Media downloaded successfully',
      messageId: messageKey.id,
      size: buffer.length,
    });

    return buffer;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Evolution API media download error',
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error({
        msg: 'Error downloading media',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    throw error;
  }
}

/**
 * Send a video to a WhatsApp user via Evolution API
 * @param userNumber - User's WhatsApp number (e.g., "5511999999999")
 * @param videoUrl - Public URL of the video file
 * @param caption - Optional caption text
 */
export async function sendVideo(
  userNumber: string,
  videoUrl: string,
  caption?: string
): Promise<void> {
  try {
    // Ensure number is in correct format (without @s.whatsapp.net)
    const sanitizedNumber = userNumber.replace('@s.whatsapp.net', '');
    const remoteJid = `${sanitizedNumber}@s.whatsapp.net`;

    logger.info({
      msg: 'Sending video via Evolution API',
      instance: evolutionInstance,
      remoteJid,
      videoUrl,
      hasCaption: !!caption,
    });

    // Send video using Evolution API's sendMedia endpoint
    const response = await api.post<SendMediaResponse>(`/message/sendMedia/${evolutionInstance}`, {
      number: sanitizedNumber,
      mediatype: 'video',
      media: videoUrl,
      ...(caption && { caption }),
    });

    logger.info({
      msg: 'Video sent successfully',
      remoteJid,
      messageId: response.data.key?.id,
      status: response.data.status,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Evolution API error sending video',
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        userNumber,
        videoUrl,
      });
      throw new Error(
        `Evolution API failed: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }

    logger.error({
      msg: 'Error sending video',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      videoUrl,
    });
    throw error;
  }
}

/**
 * Check if Evolution API instance is connected
 */
export async function checkConnection(): Promise<boolean> {
  try {
    logger.info({
      msg: 'Checking Evolution API connection',
      instance: evolutionInstance,
    });

    const response = await api.get(`/instance/connectionState/${evolutionInstance}`);

    const isConnected = response.data?.state === 'open';

    logger.info({
      msg: 'Evolution API connection status',
      instance: evolutionInstance,
      state: response.data?.state,
      isConnected,
    });

    return isConnected;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error({
        msg: 'Evolution API connection check failed',
        status: error.response?.status,
        data: error.response?.data,
      });
    } else {
      logger.error({
        msg: 'Error checking connection',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return false;
  }
}
