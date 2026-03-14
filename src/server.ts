import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import logger from './config/logger';
import webhookRoutes from './routes/webhook';
import webhookZapiRoutes from './routes/webhookZapi';
import webhookMetaRoutes from './routes/webhookMeta';
import healthRoutes from './routes/health';
import statsRoutes from './routes/stats';
import stripeWebhookRoutes from './routes/stripeWebhook';
import linksRoutes from './routes/links';
import redirectRoutes from './routes/redirect';
import legalRoutes from './routes/legal';
import { initializeScheduledJobs, checkPendingStickersRecovery } from './jobs';
import { initGeoService } from './services/geoService';
import { featureFlags, logFeatureFlags } from './config/features';

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

const LANDING_PAGE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StickerBot - Figurinhas para WhatsApp</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; background: #fafafa; }
    .hero { background: linear-gradient(135deg, #075E54 0%, #128C7E 50%, #25D366 100%); color: white; padding: 80px 20px; text-align: center; }
    .hero h1 { font-size: 2.8rem; margin-bottom: 12px; font-weight: 700; }
    .hero p { font-size: 1.2rem; opacity: 0.9; max-width: 600px; margin: 0 auto; }
    .container { max-width: 900px; margin: 0 auto; padding: 0 20px; }
    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; padding: 60px 20px; max-width: 900px; margin: 0 auto; }
    .feature { background: white; border-radius: 12px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .feature .icon { font-size: 2rem; margin-bottom: 12px; }
    .feature h3 { font-size: 1.1rem; margin-bottom: 8px; }
    .feature p { font-size: 0.9rem; color: #555; line-height: 1.5; }
    .how-it-works { background: white; padding: 60px 20px; text-align: center; }
    .how-it-works h2 { font-size: 1.8rem; margin-bottom: 40px; }
    .steps { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; max-width: 800px; margin: 0 auto; }
    .step { flex: 1; min-width: 180px; max-width: 220px; }
    .step .number { width: 48px; height: 48px; border-radius: 50%; background: #25D366; color: white; font-size: 1.3rem; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
    .step h4 { margin-bottom: 6px; }
    .step p { font-size: 0.85rem; color: #666; }
    .plans { padding: 60px 20px; text-align: center; max-width: 900px; margin: 0 auto; }
    .plans h2 { font-size: 1.8rem; margin-bottom: 40px; }
    .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
    .plan { background: white; border-radius: 12px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .plan h3 { font-size: 1.2rem; margin-bottom: 4px; }
    .plan .price { font-size: 1.6rem; font-weight: 700; color: #128C7E; margin: 8px 0 16px; }
    .plan ul { list-style: none; text-align: left; }
    .plan ul li { padding: 6px 0; font-size: 0.9rem; color: #444; }
    .plan ul li::before { content: "\\2713"; color: #25D366; font-weight: 700; margin-right: 8px; }
    .cta { background: #075E54; color: white; padding: 60px 20px; text-align: center; }
    .cta h2 { font-size: 1.8rem; margin-bottom: 12px; }
    .cta p { opacity: 0.85; margin-bottom: 24px; font-size: 1.05rem; }
    .cta a { display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 14px 36px; border-radius: 30px; font-size: 1.1rem; font-weight: 600; transition: background 0.2s; }
    .cta a:hover { background: #20bd5a; }
    footer { padding: 30px 20px; text-align: center; font-size: 0.8rem; color: #888; }
    footer a { color: #128C7E; text-decoration: none; }
    footer a:hover { text-decoration: underline; }
    .badge { display: inline-block; background: rgba(255,255,255,0.15); padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="hero">
    <div class="badge">WhatsApp Business Platform</div>
    <h1>StickerBot</h1>
    <p>Transforme suas imagens e videos em figurinhas para WhatsApp em segundos. Envie uma foto e receba o sticker pronto.</p>
  </div>

  <div class="features">
    <div class="feature">
      <div class="icon">🎨</div>
      <h3>Stickers Instantaneos</h3>
      <p>Envie uma imagem, GIF ou video e receba sua figurinha pronta automaticamente. Sem apps extras.</p>
    </div>
    <div class="feature">
      <div class="icon">🐦</div>
      <h3>Videos do Twitter/X</h3>
      <p>Envie um link de tweet e baixe o video direto no WhatsApp. Converta em figurinha animada se quiser.</p>
    </div>
    <div class="feature">
      <div class="icon">✨</div>
      <h3>Edicao com IA</h3>
      <p>Remova fundos e bordas das suas figurinhas usando inteligencia artificial. Stickers profissionais.</p>
    </div>
  </div>

  <div class="how-it-works">
    <h2>Como Funciona</h2>
    <div class="steps">
      <div class="step">
        <div class="number">1</div>
        <h4>Envie uma imagem</h4>
        <p>Mande qualquer foto, GIF ou video pelo WhatsApp</p>
      </div>
      <div class="step">
        <div class="number">2</div>
        <h4>Processamos</h4>
        <p>O bot converte automaticamente em figurinha otimizada</p>
      </div>
      <div class="step">
        <div class="number">3</div>
        <h4>Receba o sticker</h4>
        <p>A figurinha volta pronta para usar nos seus grupos</p>
      </div>
    </div>
  </div>

  <div class="plans">
    <h2>Planos</h2>
    <div class="plans-grid">
      <div class="plan">
        <h3>Gratuito</h3>
        <div class="price">R$ 0</div>
        <ul>
          <li>4 figurinhas por dia</li>
          <li>4 videos Twitter por dia</li>
          <li>Stickers estaticos e animados</li>
        </ul>
      </div>
      <div class="plan">
        <h3>Premium</h3>
        <div class="price">R$ 5/mes</div>
        <ul>
          <li>20 figurinhas por dia</li>
          <li>15 videos Twitter por dia</li>
          <li>Suporte prioritario</li>
        </ul>
      </div>
      <div class="plan">
        <h3>Ultra</h3>
        <div class="price">R$ 9,90/mes</div>
        <ul>
          <li>Figurinhas ilimitadas</li>
          <li>Videos ilimitados</li>
          <li>Processamento prioritario</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="cta">
    <h2>Comece Agora</h2>
    <p>Envie uma mensagem para nosso WhatsApp e crie sua primeira figurinha gratis.</p>
    <a href="https://wa.me/5511988709202">Abrir no WhatsApp</a>
  </div>

  <footer>
    <p>65.508.556 PAULO HENRIQUE REIS ALVES | CNPJ 65.508.556/0001-39</p>
    <p style="margin-top: 8px;">
      <a href="/privacy">Politica de Privacidade</a> &middot;
      <a href="/terms">Termos de Servico</a>
    </p>
  </footer>
</body>
</html>`;

// Root route - Landing page
fastify.get('/', async (_request, reply) => {
  return reply
    .status(200)
    .header('Content-Type', 'text/html; charset=utf-8')
    .send(LANDING_PAGE_HTML);
});

// Register routes
fastify.register(webhookRoutes, { prefix: '/webhook' });

// Register Z-API webhook if enabled
if (featureFlags.ZAPI_WEBHOOK_ENABLED) {
  fastify.register(webhookZapiRoutes, { prefix: '/webhook' });
  logger.info('✅ Z-API webhook endpoint registered at /webhook/zapi');
}

// Register Meta Cloud API webhook if enabled
if (featureFlags.META_WEBHOOK_ENABLED) {
  fastify.register(webhookMetaRoutes, { prefix: '/webhook' });
  logger.info('✅ Meta Cloud API webhook endpoint registered at /webhook/meta');
}

fastify.register(healthRoutes);
fastify.register(statsRoutes, { prefix: '/stats' });
fastify.register(stripeWebhookRoutes, { prefix: '/stripe' });
fastify.register(linksRoutes, { prefix: '/links' });
fastify.register(redirectRoutes, { prefix: '/l' });
fastify.register(legalRoutes);

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    // Initialize geo service for URL tracking
    await initGeoService();
    logger.info('🌍 Geo service initialized');

    await fastify.listen({ port, host });

    logger.info(`🚀 Server listening on http://${host}:${port}`);
    logger.info(`📝 Webhook endpoint: http://${host}:${port}/webhook`);

    if (featureFlags.ZAPI_WEBHOOK_ENABLED) {
      logger.info(`📝 Z-API Webhook endpoint: http://${host}:${port}/webhook/zapi`);
    }

    if (featureFlags.META_WEBHOOK_ENABLED) {
      logger.info(`📝 Meta Cloud API Webhook: http://${host}:${port}/webhook/meta`);
    }

    logger.info(`💚 Health check: http://${host}:${port}/health`);
    logger.info(`📊 Stats endpoint: http://${host}:${port}/stats`);
    logger.info(`🔗 Links API: http://${host}:${port}/links`);
    logger.info(`↗️  Redirect endpoint: http://${host}:${port}/l/:code`);

    // Log feature flags
    logFeatureFlags();

    // Initialize scheduled jobs
    initializeScheduledJobs();
    logger.info('⏰ Scheduled jobs initialized');

    // Run recovery check for pending stickers (in case 8:00 AM job was missed)
    checkPendingStickersRecovery();
    logger.info('🔄 Pending stickers recovery check initiated');
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
