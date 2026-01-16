import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import logger from '../config/logger';
import { verifyWebhookSignature, processWebhookEvent } from '../services/stripeWebhook';

export default async function stripeWebhookRoutes(fastify: FastifyInstance) {
  /**
   * Stripe webhook endpoint
   * POST /stripe/webhook
   */
  fastify.post(
    '/webhook',
    {
      config: {
        // Disable body parsing for raw body access
        rawBody: true,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const signature = request.headers['stripe-signature'] as string;

        if (!signature) {
          logger.error('Missing Stripe signature header');
          return reply.code(400).send({ error: 'Missing signature' });
        }

        // Get raw body
        const rawBody = request.rawBody;

        if (!rawBody) {
          logger.error('Missing raw body for Stripe webhook');
          return reply.code(400).send({ error: 'Missing body' });
        }

        // Verify webhook signature (rawBody is guaranteed to be Buffer here)
        const event = verifyWebhookSignature(rawBody, signature);

        logger.info({
          msg: 'Stripe webhook received',
          eventType: event.type,
          eventId: event.id,
        });

        // Process event asynchronously
        processWebhookEvent(event).catch((error) => {
          logger.error({
            msg: 'Error processing webhook event',
            error: error instanceof Error ? error.message : 'Unknown error',
            eventType: event.type,
            eventId: event.id,
          });
        });

        // Return 200 immediately to Stripe
        return reply.code(200).send({ received: true });
      } catch (error) {
        logger.error({
          msg: 'Webhook error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return reply.code(400).send({
          error: 'Webhook error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
