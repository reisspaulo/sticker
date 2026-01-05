import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import logger from './config/logger';
import webhookRoutes from './routes/webhook';
import healthRoutes from './routes/health';
import statsRoutes from './routes/stats';
import stripeWebhookRoutes from './routes/stripeWebhook';
import { initializeScheduledJobs } from './jobs';

// Load environment variables
config();

const fastify = Fastify({
  logger: logger as any,
  // Enable raw body for Stripe webhook
  bodyLimit: 1048576, // 1MB
});

// Register CORS
fastify.register(cors, {
  origin: true,
});

// Add raw body parser for Stripe webhook
fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  // Save raw body for Stripe signature verification
  (req as any).rawBody = body;

  // Parse JSON for normal use
  try {
    const parsed = JSON.parse(body.toString());
    done(null, parsed);
  } catch (err: any) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// Register routes
fastify.register(webhookRoutes, { prefix: '/webhook' });
fastify.register(healthRoutes);
fastify.register(statsRoutes, { prefix: '/stats' });
fastify.register(stripeWebhookRoutes, { prefix: '/stripe' });

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    logger.info(`🚀 Server listening on http://${host}:${port}`);
    logger.info(`📝 Webhook endpoint: http://${host}:${port}/webhook`);
    logger.info(`💚 Health check: http://${host}:${port}/health`);
    logger.info(`📊 Stats endpoint: http://${host}:${port}/stats`);

    // Initialize scheduled jobs
    initializeScheduledJobs();
    logger.info('⏰ Scheduled jobs initialized');
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

start();
