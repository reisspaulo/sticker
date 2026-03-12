import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebhookPayload } from '../types/evolution';
import logger from '../config/logger';

/**
 * Meta Cloud API Webhook Handler
 *
 * Receives webhooks from Meta Cloud API and transforms them to the internal
 * Evolution API format expected by our existing webhook handler logic.
 *
 * Meta webhook structure:
 *   entry[0].changes[0].value.messages[0]
 *
 * Webhook verification: Meta sends GET with hub.challenge to verify endpoint.
 */

// ============================================
// META WEBHOOK TYPES
// ============================================

interface MetaWebhookMessage {
  from: string; // Phone number (e.g., "5511999999999")
  id: string; // Message ID (wamid.xxx)
  timestamp: string; // Unix timestamp
  type: 'text' | 'image' | 'video' | 'sticker' | 'audio' | 'document' | 'interactive' | 'button' | 'reaction';

  text?: {
    body: string;
  };

  image?: {
    id: string; // Media ID - requires 2-step download
    mime_type: string;
    sha256: string;
    caption?: string;
  };

  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };

  sticker?: {
    id: string;
    mime_type: string;
    sha256: string;
    animated?: boolean;
  };

  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
    voice?: boolean;
  };

  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename?: string;
    caption?: string;
  };

  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };

  button?: {
    payload: string;
    text: string;
  };

  context?: {
    from: string;
    id: string; // ID of the message being replied to
  };
}

interface MetaWebhookContact {
  wa_id: string;
  profile: {
    name: string;
  };
}

interface MetaWebhookValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookMessage[];
  statuses?: Array<{
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
    errors?: Array<{ code: number; title: string }>;
  }>;
}

interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: MetaWebhookValue;
      field: 'messages';
    }>;
  }>;
}

// ============================================
// PAYLOAD TRANSFORMATION
// ============================================

/**
 * Transform Meta Cloud API webhook payload to Evolution API format
 *
 * This allows us to reuse all existing business logic without changes.
 * Key difference: Meta sends media IDs, not URLs. The downloadMedia
 * function in metaCloudApi.ts handles the 2-step download.
 */
function transformMetaPayload(
  message: MetaWebhookMessage,
  contactName: string
): WebhookPayload {
  const { from, id, timestamp } = message;

  const evolutionPayload: WebhookPayload = {
    instance: process.env.WHATSAPP_PHONE_NUMBER_ID || 'meta-cloud',
    event: 'messages.upsert',
    data: {
      key: {
        remoteJid: `${from}@s.whatsapp.net`,
        fromMe: false,
        id,
      },
      pushName: contactName,
      messageTimestamp: parseInt(timestamp, 10),
      message: {},
      messageType: 'conversation',
    },
  };

  if (!evolutionPayload.data.message) {
    evolutionPayload.data.message = {};
  }

  // Transform based on message type
  switch (message.type) {
    case 'text':
      evolutionPayload.data.message.conversation = message.text?.body || '';
      evolutionPayload.data.messageType = 'conversation';
      break;

    case 'image':
      if (message.image) {
        evolutionPayload.data.message.imageMessage = {
          // Meta sends media ID, not URL. We store the ID in url field.
          // The worker/downloadMedia will detect 'meta:' prefix and use metaCloudApi.downloadMedia
          url: `meta:${message.image.id}`,
          mimetype: message.image.mime_type,
          caption: message.image.caption,
        };
        evolutionPayload.data.messageType = 'imageMessage';
      }
      break;

    case 'video':
      if (message.video) {
        evolutionPayload.data.message.videoMessage = {
          url: `meta:${message.video.id}`,
          mimetype: message.video.mime_type,
          caption: message.video.caption,
        };
        evolutionPayload.data.messageType = 'videoMessage';
      }
      break;

    case 'sticker':
      if (message.sticker) {
        (evolutionPayload.data.message as any).stickerMessage = {
          url: `meta:${message.sticker.id}`,
          mimetype: message.sticker.mime_type,
          isAnimated: message.sticker.animated || false,
        };
        evolutionPayload.data.messageType = 'stickerMessage';
      }
      break;

    case 'audio':
      if (message.audio) {
        (evolutionPayload.data.message as any).audioMessage = {
          url: `meta:${message.audio.id}`,
          mimetype: message.audio.mime_type,
        };
        evolutionPayload.data.messageType = 'audioMessage';
      }
      break;

    case 'document':
      if (message.document) {
        (evolutionPayload.data.message as any).documentMessage = {
          url: `meta:${message.document.id}`,
          mimetype: message.document.mime_type,
          fileName: message.document.filename,
        };
        evolutionPayload.data.messageType = 'documentMessage';
      }
      break;

    case 'interactive':
      if (message.interactive?.type === 'button_reply' && message.interactive.button_reply) {
        (evolutionPayload.data.message as any).buttonsResponseMessage = {
          selectedButtonId: message.interactive.button_reply.id,
        };
        evolutionPayload.data.messageType = 'buttonsResponseMessage';
      }
      if (message.interactive?.type === 'list_reply' && message.interactive.list_reply) {
        (evolutionPayload.data.message as any).listResponseMessage = {
          singleSelectReply: {
            selectedRowId: message.interactive.list_reply.id,
          },
          title: message.interactive.list_reply.title,
        };
        evolutionPayload.data.messageType = 'listResponseMessage';
      }
      break;

    case 'button':
      if (message.button) {
        (evolutionPayload.data.message as any).buttonsResponseMessage = {
          selectedButtonId: message.button.payload,
        };
        evolutionPayload.data.messageType = 'buttonsResponseMessage';
      }
      break;

    default:
      logger.warn({
        msg: '[Meta] Unknown message type',
        type: message.type,
        messageId: id,
      });
      break;
  }

  return evolutionPayload;
}

// ============================================
// WEBHOOK ROUTES
// ============================================

export default async function webhookMetaRoutes(fastify: FastifyInstance) {
  /**
   * GET /webhook/meta - Webhook verification (required by Meta)
   *
   * Meta sends a GET request with hub.mode, hub.challenge, hub.verify_token
   * to verify the webhook endpoint. We must respond with the challenge value.
   */
  fastify.get('/meta', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;

    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_WEBHOOK_TOKEN;

    logger.info({
      msg: '[Meta] Webhook verification request',
      mode,
      tokenMatch: token === verifyToken,
      hasChallenge: !!challenge,
    });

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('[Meta] ✅ Webhook verified successfully');
      return reply.status(200).send(challenge);
    }

    logger.warn('[Meta] ❌ Webhook verification failed');
    return reply.status(403).send({ error: 'Verification failed' });
  });

  /**
   * POST /webhook/meta - Receive messages from Meta Cloud API
   */
  fastify.post('/meta', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    try {
      const body = request.body as MetaWebhookPayload;

      // Validate it's a WhatsApp webhook
      if (body.object !== 'whatsapp_business_account') {
        logger.info({
          msg: '[Meta] Ignoring non-WhatsApp webhook',
          object: body.object,
        });
        return reply.status(200).send({ status: 'ignored' });
      }

      // Extract messages from the webhook payload
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) {
        logger.info('[Meta] No value in webhook payload');
        return reply.status(200).send({ status: 'ignored', reason: 'no value' });
      }

      // Handle status updates (sent, delivered, read, failed)
      if (value.statuses && value.statuses.length > 0) {
        for (const status of value.statuses) {
          logger.info({
            msg: '[Meta] Message status update',
            messageId: status.id,
            status: status.status,
            recipientId: status.recipient_id,
            errors: status.errors,
          });
        }
        return reply.status(200).send({ status: 'ok', type: 'status_update' });
      }

      // Process messages
      const messages = value.messages;
      const contacts = value.contacts;

      if (!messages || messages.length === 0) {
        logger.info('[Meta] No messages in webhook payload');
        return reply.status(200).send({ status: 'ignored', reason: 'no messages' });
      }

      // Process each message
      for (const message of messages) {
        const contactName =
          contacts?.find((c) => c.wa_id === message.from)?.profile?.name || 'Usuário';

        logger.info({
          msg: '[Meta] Webhook received',
          from: message.from,
          messageId: message.id,
          type: message.type,
          contactName,
        });

        // Ignore group messages (shouldn't happen with Cloud API, but safety check)
        if (message.from.includes('@g.us')) {
          logger.info({
            msg: '[Meta] ❌ Ignoring group message',
            from: message.from,
          });
          continue;
        }

        // Validate phone number format
        const phoneDigits = message.from.replace(/\D/g, '');
        const isValidNumber =
          phoneDigits.length >= 10 && phoneDigits.length <= 15 && /^\d+$/.test(phoneDigits);

        if (!isValidNumber) {
          logger.warn({
            msg: '[Meta] ❌ Invalid phone number format',
            from: message.from,
            messageId: message.id,
          });
          continue;
        }

        // Transform to Evolution API format
        const evolutionPayload = transformMetaPayload(message, contactName);

        logger.debug({
          msg: '[Meta] Payload transformed',
          originalType: message.type,
          transformedType: evolutionPayload.data.messageType,
          userNumber: message.from,
        });

        // Delegate to shared webhook handler
        const { processWebhookRequest } = await import('./webhook');

        const mockRequest = {
          ...request,
          body: evolutionPayload,
        } as FastifyRequest;

        logger.info({
          msg: '[Meta] Delegating to shared webhook handler',
          userNumber: message.from,
          messageType: evolutionPayload.data.messageType,
        });

        await processWebhookRequest(mockRequest, reply, fastify);
      }

      return reply.status(200).send({
        status: 'ok',
        messagesProcessed: messages.length,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      logger.error({
        msg: '[Meta] Webhook processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });

      // Meta requires 200 response even on errors (to avoid retries flooding)
      return reply.status(200).send({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
