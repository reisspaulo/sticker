import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebhookPayload } from '../types/evolution';
import logger from '../config/logger';

/**
 * Z-API Webhook Handler
 *
 * Receives webhooks from Z-API and transforms them to the internal format
 * expected by our existing webhook handler logic.
 *
 * This adapter approach minimizes code changes - we transform Z-API payloads
 * to Evolution API format and reuse existing business logic.
 */

// ============================================
// Z-API WEBHOOK PAYLOAD TYPES
// ============================================

interface ZAPIWebhookPayload {
  messageId: string;
  phone: string; // E.g., "5511999999999" (no suffix)
  fromMe: boolean;
  status: 'RECEIVED' | 'SENT' | 'READ' | 'DELIVERED';
  momment: number; // Unix timestamp in milliseconds
  type: 'ReceivedCallback';

  // Text message
  text?: {
    message: string;
  };

  // Image message
  image?: {
    imageUrl: string; // Direct URL - no download needed!
    caption?: string;
    mimeType: string;
  };

  // Video message
  video?: {
    videoUrl: string;
    caption?: string;
    mimeType: string;
  };

  // Sticker message
  sticker?: {
    stickerUrl: string;
    mimeType: string;
  };

  // Button response
  buttonsResponseMessage?: {
    selectedButtonId: string;
  };

  // List response
  listResponseMessage?: {
    singleSelectReply: {
      selectedRowId: string;
    };
    title?: string;
  };

  // Document message
  document?: {
    documentUrl: string;
    mimeType: string;
    fileName?: string;
  };

  // Audio message
  audio?: {
    audioUrl: string;
    mimeType: string;
  };
}

// ============================================
// PAYLOAD TRANSFORMATION
// ============================================

/**
 * Transform Z-API webhook payload to Evolution API format
 *
 * This allows us to reuse all existing business logic without changes.
 */
function transformZAPIPayload(zapiPayload: ZAPIWebhookPayload): WebhookPayload {
  const { phone, messageId, fromMe, momment } = zapiPayload;

  // Build Evolution API compatible payload
  const evolutionPayload: WebhookPayload = {
    instance: process.env.Z_API_INSTANCE || 'zapi-instance',
    event: 'messages.upsert',
    data: {
      key: {
        remoteJid: `${phone}@s.whatsapp.net`, // Add Evolution suffix
        fromMe,
        id: messageId,
      },
      messageTimestamp: Math.floor(momment / 1000), // Z-API uses ms, Evolution uses seconds
      message: {},
      messageType: 'conversation', // Default, will be updated below
    },
  };

  // Ensure message object exists
  if (!evolutionPayload.data.message) {
    evolutionPayload.data.message = {};
  }

  // Transform message content based on Z-API payload type
  if (zapiPayload.text) {
    evolutionPayload.data.message.conversation = zapiPayload.text.message;
    evolutionPayload.data.messageType = 'conversation';
  }

  if (zapiPayload.image) {
    evolutionPayload.data.message.imageMessage = {
      url: zapiPayload.image.imageUrl, // Z-API provides direct URL!
      mimetype: zapiPayload.image.mimeType,
      caption: zapiPayload.image.caption,
    };
    evolutionPayload.data.messageType = 'imageMessage';
  }

  if (zapiPayload.video) {
    evolutionPayload.data.message.videoMessage = {
      url: zapiPayload.video.videoUrl,
      mimetype: zapiPayload.video.mimeType,
      caption: zapiPayload.video.caption,
    };
    evolutionPayload.data.messageType = 'videoMessage';
  }

  if (zapiPayload.sticker) {
    (evolutionPayload.data.message as any).stickerMessage = {
      url: zapiPayload.sticker.stickerUrl,
      mimetype: zapiPayload.sticker.mimeType,
    };
    evolutionPayload.data.messageType = 'stickerMessage';
  }

  if (zapiPayload.audio) {
    (evolutionPayload.data.message as any).audioMessage = {
      url: zapiPayload.audio.audioUrl,
      mimetype: zapiPayload.audio.mimeType,
    };
    evolutionPayload.data.messageType = 'audioMessage';
  }

  if (zapiPayload.document) {
    (evolutionPayload.data.message as any).documentMessage = {
      url: zapiPayload.document.documentUrl,
      mimetype: zapiPayload.document.mimeType,
      fileName: zapiPayload.document.fileName,
    };
    evolutionPayload.data.messageType = 'documentMessage';
  }

  // Interactive message responses
  if (zapiPayload.buttonsResponseMessage) {
    (evolutionPayload.data.message as any).buttonsResponseMessage = {
      selectedButtonId: zapiPayload.buttonsResponseMessage.selectedButtonId,
    };
    evolutionPayload.data.messageType = 'buttonsResponseMessage';
  }

  if (zapiPayload.listResponseMessage) {
    (evolutionPayload.data.message as any).listResponseMessage = {
      singleSelectReply: {
        selectedRowId: zapiPayload.listResponseMessage.singleSelectReply.selectedRowId,
      },
      title: zapiPayload.listResponseMessage.title,
    };
    evolutionPayload.data.messageType = 'listResponseMessage';
  }

  return evolutionPayload;
}

// ============================================
// WEBHOOK ROUTES
// ============================================

export default async function webhookZapiRoutes(fastify: FastifyInstance) {
  // GET route for testing (no auth required)
  fastify.get('/zapi', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'online',
      message: 'Z-API Webhook endpoint is active',
      timestamp: new Date().toISOString(),
      note: 'This endpoint accepts POST requests from Z-API',
    });
  });

  // NOTE: Z-API webhooks don't use API key authentication
  // Z-API validates via IP whitelist on their end
  // We trust requests coming to this endpoint since only Z-API knows the URL

  fastify.post('/zapi', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    try {
      const zapiBody = request.body as ZAPIWebhookPayload;

      logger.info({
        msg: '[Z-API] Webhook received',
        phone: zapiBody.phone,
        messageId: zapiBody.messageId,
        type: zapiBody.type,
        fromMe: zapiBody.fromMe,
      });

      // Ignore messages from ourselves
      if (zapiBody.fromMe) {
        logger.info('[Z-API] ❌ Ignoring message from self');
        return reply.status(200).send({
          status: 'ignored',
          reason: 'message from self',
        });
      }

      // ANTI-SPAM: Validate phone number to prevent processing invalid IDs
      const phone = zapiBody.phone;

      // Ignore group messages (contains @g.us or @lid)
      if (phone.includes('@g.us') || phone.includes('@lid')) {
        logger.info({
          msg: '[Z-API] ❌ Ignoring group or broadcast list message',
          phone,
          messageId: zapiBody.messageId,
        });
        return reply.status(200).send({
          status: 'ignored',
          reason: 'group or broadcast list not supported',
        });
      }

      // Validate Brazilian phone number format
      // Valid format: 5511999999999 (country code 55 + DDD + number)
      // Length: 12-13 digits (13 with 9th digit for mobile)
      const phoneDigits = phone.replace(/\D/g, ''); // Remove non-digits
      const isValidBrazilianNumber =
        phoneDigits.startsWith('55') &&
        phoneDigits.length >= 12 &&
        phoneDigits.length <= 13 &&
        /^\d+$/.test(phoneDigits); // Only digits

      if (!isValidBrazilianNumber) {
        logger.warn({
          msg: '[Z-API] ❌ Invalid phone number format',
          phone,
          phoneDigits,
          messageId: zapiBody.messageId,
        });
        return reply.status(200).send({
          status: 'ignored',
          reason: 'invalid phone number format',
        });
      }

      // Transform Z-API payload to Evolution API format
      const evolutionPayload = transformZAPIPayload(zapiBody);

      // Log transformation for debugging
      logger.debug({
        msg: '[Z-API] Payload transformed',
        originalType: zapiBody.type,
        transformedType: evolutionPayload.data.messageType,
        userNumber: zapiBody.phone,
      });

      // Delegate to shared webhook handler
      // Import the processing function from webhook.ts
      const { processWebhookRequest } = await import('./webhook');

      // Create a mock request with the transformed payload
      const mockRequest = {
        ...request,
        body: evolutionPayload,
      } as FastifyRequest;

      // Process using the SAME business logic as Evolution API webhook
      logger.info({
        msg: '[Z-API] Delegating to shared webhook handler (Evolution format)',
        userNumber: zapiBody.phone,
        messageType: evolutionPayload.data.messageType,
      });

      // Call the extracted handler function with the transformed payload
      return processWebhookRequest(mockRequest, reply, fastify);
    } catch (error) {
      logger.error({
        msg: '[Z-API] Webhook processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
