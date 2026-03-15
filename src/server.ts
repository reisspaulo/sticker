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
  <title>StickerBot — Figurinhas para WhatsApp</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230a0a0a'/%3E%3Ctext x='16' y='22' font-family='serif' font-size='20' font-weight='bold' fill='%23f0c040' text-anchor='middle'%3ES%3C/text%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #0a0a0a; --surface: #141414; --border: #2a2a2a; --text: #e8e8e8; --text-muted: #888; --accent: #f0c040; --green: #25D366; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }

    /* Nav */
    nav { padding: 20px 40px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: rgba(10,10,10,0.92); backdrop-filter: blur(12px); z-index: 100; }
    nav .logo { font-family: 'Instrument Serif', serif; font-size: 1.4rem; letter-spacing: -0.02em; text-decoration: none; color: var(--text); }
    nav .logo span { color: var(--accent); }
    nav .nav-cta { color: var(--bg); background: var(--accent); text-decoration: none; font-size: 0.82rem; font-weight: 500; padding: 8px 20px; border-radius: 6px; transition: opacity 0.2s; }
    nav .nav-cta:hover { opacity: 0.85; }

    /* Hero */
    .hero { padding: 100px 24px 80px; text-align: center; position: relative; overflow: hidden; }
    .hero::before { content: ''; position: absolute; top: -40%; left: 50%; transform: translateX(-50%); width: 600px; height: 600px; background: radial-gradient(circle, rgba(240,192,64,0.06) 0%, transparent 70%); pointer-events: none; }
    .hero .badge { display: inline-block; border: 1px solid var(--border); color: var(--text-muted); padding: 6px 16px; border-radius: 20px; font-size: 0.78rem; margin-bottom: 28px; letter-spacing: 0.03em; }
    .hero h1 { font-family: 'Instrument Serif', serif; font-size: 3.6rem; font-weight: 400; letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 20px; max-width: 700px; margin-left: auto; margin-right: auto; }
    .hero h1 em { font-style: italic; color: var(--accent); }
    .hero p { color: var(--text-muted); font-size: 1.05rem; line-height: 1.7; max-width: 520px; margin: 0 auto 36px; }
    .hero .cta-btn { display: inline-flex; align-items: center; gap: 10px; background: var(--green); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 0.95rem; font-weight: 500; transition: transform 0.2s, box-shadow 0.2s; }
    .hero .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,211,102,0.2); }
    .hero .cta-btn svg { width: 20px; height: 20px; fill: currentColor; }

    /* Section titles */
    .section-label { text-align: center; color: var(--accent); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px; }
    .section-title { text-align: center; font-family: 'Instrument Serif', serif; font-size: 2.2rem; font-weight: 400; letter-spacing: -0.02em; margin-bottom: 48px; }

    /* How it works */
    .how { padding: 80px 24px; border-top: 1px solid var(--border); }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; max-width: 840px; margin: 0 auto; background: var(--border); border-radius: 12px; overflow: hidden; }
    .step { background: var(--surface); padding: 36px 28px; }
    .step-num { font-family: 'Instrument Serif', serif; font-size: 2.4rem; color: var(--accent); opacity: 0.4; margin-bottom: 16px; }
    .step h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 10px; }
    .step p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; }

    /* Features */
    .features { padding: 80px 24px; border-top: 1px solid var(--border); }
    .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 900px; margin: 0 auto; }
    .feat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px 24px; transition: border-color 0.3s; }
    .feat:hover { border-color: #3a3a3a; }
    .feat-icon { width: 44px; height: 44px; border-radius: 10px; background: rgba(240,192,64,0.08); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 20px; }
    .feat h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 10px; }
    .feat p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; }

    /* Plans */
    .plans { padding: 80px 24px; border-top: 1px solid var(--border); }
    .plans-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 900px; margin: 0 auto; }
    .plan { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 32px 24px; display: flex; flex-direction: column; }
    .plan.featured { border-color: var(--accent); position: relative; }
    .plan.featured::after { content: 'Popular'; position: absolute; top: -10px; right: 20px; background: var(--accent); color: var(--bg); font-size: 0.68rem; font-weight: 700; padding: 3px 10px; border-radius: 4px; letter-spacing: 0.05em; text-transform: uppercase; }
    .plan-name { font-size: 0.82rem; color: var(--text-muted); font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 8px; }
    .plan-price { font-family: 'Instrument Serif', serif; font-size: 2.4rem; letter-spacing: -0.02em; margin-bottom: 4px; }
    .plan-price .period { font-family: 'DM Sans', sans-serif; font-size: 0.82rem; color: var(--text-muted); font-weight: 400; }
    .plan-desc { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
    .plan ul { list-style: none; flex: 1; }
    .plan li { font-size: 0.85rem; color: var(--text-muted); padding: 6px 0; padding-left: 20px; position: relative; }
    .plan li::before { content: ''; position: absolute; left: 0; top: 50%; width: 6px; height: 6px; border-radius: 50%; background: var(--green); transform: translateY(-50%); }
    .plan .plan-cta { display: block; text-align: center; margin-top: 24px; padding: 12px; border-radius: 8px; text-decoration: none; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; }
    .plan .plan-cta.primary { background: var(--accent); color: var(--bg); }
    .plan .plan-cta.primary:hover { opacity: 0.85; }
    .plan .plan-cta.secondary { border: 1px solid var(--border); color: var(--text); }
    .plan .plan-cta.secondary:hover { border-color: var(--text-muted); }

    /* CTA */
    .bottom-cta { padding: 80px 24px; border-top: 1px solid var(--border); text-align: center; position: relative; overflow: hidden; }
    .bottom-cta::before { content: ''; position: absolute; bottom: -30%; left: 50%; transform: translateX(-50%); width: 500px; height: 500px; background: radial-gradient(circle, rgba(37,211,102,0.05) 0%, transparent 70%); pointer-events: none; }
    .bottom-cta h2 { font-family: 'Instrument Serif', serif; font-size: 2.4rem; font-weight: 400; letter-spacing: -0.02em; margin-bottom: 16px; }
    .bottom-cta p { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 32px; max-width: 440px; margin-left: auto; margin-right: auto; line-height: 1.7; }
    .bottom-cta .cta-btn { display: inline-flex; align-items: center; gap: 10px; background: var(--green); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 0.95rem; font-weight: 500; transition: transform 0.2s, box-shadow 0.2s; }
    .bottom-cta .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(37,211,102,0.2); }
    .bottom-cta .cta-btn svg { width: 20px; height: 20px; fill: currentColor; }

    /* Footer */
    footer { border-top: 1px solid var(--border); padding: 32px 40px; text-align: center; font-size: 0.72rem; color: #555; }
    footer a { color: var(--text-muted); text-decoration: none; }
    footer a:hover { color: var(--text); }
    footer .footer-links { margin-top: 10px; }

    /* Responsive */
    @media (max-width: 768px) {
      nav { padding: 16px 20px; }
      .hero { padding: 60px 20px 50px; }
      .hero h1 { font-size: 2.4rem; }
      .steps { grid-template-columns: 1fr; }
      .features-grid { grid-template-columns: 1fr; }
      .plans-grid { grid-template-columns: 1fr; }
      .section-title { font-size: 1.8rem; }
      .bottom-cta h2 { font-size: 1.8rem; }
    }

    /* Animations */
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .hero .badge { animation: fadeUp 0.6s ease both; }
    .hero h1 { animation: fadeUp 0.6s ease 0.1s both; }
    .hero p { animation: fadeUp 0.6s ease 0.2s both; }
    .hero .cta-btn { animation: fadeUp 0.6s ease 0.3s both; }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="logo">Sticker<span>Bot</span></a>
    <a href="https://wa.me/5511988709202" class="nav-cta">Comecar gratis</a>
  </nav>

  <section class="hero">
    <div class="badge">WhatsApp Business Platform</div>
    <h1>Suas fotos viram <em>figurinhas</em> em segundos</h1>
    <p>Envie uma imagem, GIF ou video pelo WhatsApp e receba o sticker pronto. Sem instalar nada.</p>
    <a href="https://wa.me/5511988709202" class="cta-btn">
      <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Abrir no WhatsApp
    </a>
  </section>

  <section class="how">
    <div class="section-label">Como funciona</div>
    <h2 class="section-title">Tres passos. Zero complicacao.</h2>
    <div class="steps">
      <div class="step">
        <div class="step-num">01</div>
        <h3>Envie a midia</h3>
        <p>Mande qualquer foto, GIF ou video na conversa do WhatsApp com o bot.</p>
      </div>
      <div class="step">
        <div class="step-num">02</div>
        <h3>Processamento automatico</h3>
        <p>O bot converte, redimensiona e otimiza a midia para o formato de figurinha.</p>
      </div>
      <div class="step">
        <div class="step-num">03</div>
        <h3>Receba o sticker</h3>
        <p>A figurinha volta pronta em segundos, direto no chat. Use nos seus grupos.</p>
      </div>
    </div>
  </section>

  <section class="features">
    <div class="section-label">Recursos</div>
    <h2 class="section-title">Muito alem de figurinhas</h2>
    <div class="features-grid">
      <div class="feat">
        <div class="feat-icon">&#9889;</div>
        <h3>Stickers instantaneos</h3>
        <p>Envie imagem, GIF ou video e receba a figurinha automaticamente. Estaticos e animados. Sem app extra.</p>
      </div>
      <div class="feat">
        <div class="feat-icon">&#127909;</div>
        <h3>Download de videos do Twitter/X</h3>
        <p>Cole um link de tweet e baixe o video direto no WhatsApp. Converta em figurinha animada se quiser.</p>
      </div>
      <div class="feat">
        <div class="feat-icon">&#10024;</div>
        <h3>Edicao com inteligencia artificial</h3>
        <p>Remova fundos e bordas automaticamente usando IA. Stickers com acabamento profissional.</p>
      </div>
    </div>
  </section>

  <section class="plans">
    <div class="section-label">Planos</div>
    <h2 class="section-title">Escolha o seu ritmo</h2>
    <div class="plans-grid">
      <div class="plan">
        <div class="plan-name">Gratuito</div>
        <div class="plan-price">R$ 0</div>
        <div class="plan-desc">Para experimentar sem compromisso</div>
        <ul>
          <li>4 figurinhas por dia</li>
          <li>4 videos Twitter por dia</li>
          <li>Stickers estaticos e animados</li>
        </ul>
        <a href="https://wa.me/5511988709202" class="plan-cta secondary">Comecar gratis</a>
      </div>
      <div class="plan featured">
        <div class="plan-name">Premium</div>
        <div class="plan-price">R$ 5 <span class="period">/ mes</span></div>
        <div class="plan-desc">Para quem usa todo dia</div>
        <ul>
          <li>20 figurinhas por dia</li>
          <li>15 videos Twitter por dia</li>
          <li>Suporte prioritario</li>
        </ul>
        <a href="https://wa.me/5511988709202?text=Quero%20o%20plano%20Premium" class="plan-cta primary">Assinar Premium</a>
      </div>
      <div class="plan">
        <div class="plan-name">Ultra</div>
        <div class="plan-price">R$ 9,90 <span class="period">/ mes</span></div>
        <div class="plan-desc">Sem limites. Sem espera.</div>
        <ul>
          <li>Figurinhas ilimitadas</li>
          <li>Downloads ilimitados</li>
          <li>Processamento prioritario</li>
          <li>Suporte VIP</li>
        </ul>
        <a href="https://wa.me/5511988709202?text=Quero%20o%20plano%20Ultra" class="plan-cta secondary">Assinar Ultra</a>
      </div>
    </div>
  </section>

  <section class="bottom-cta">
    <h2>Pronto para criar?</h2>
    <p>Envie uma mensagem e crie sua primeira figurinha agora mesmo. E gratis.</p>
    <a href="https://wa.me/5511988709202" class="cta-btn">
      <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Abrir no WhatsApp
    </a>
  </section>

  <footer>
    <div>65.508.556 PAULO HENRIQUE REIS ALVES &middot; CNPJ 65.508.556/0001-39</div>
    <div class="footer-links">
      <a href="/privacy">Privacidade</a> &middot; <a href="/terms">Termos de uso</a>
    </div>
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
