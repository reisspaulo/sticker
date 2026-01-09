import logger from '../config/logger';
import axios from 'axios';

// Alert thresholds
const ALERT_THRESHOLDS = {
  RPC_ERRORS_PER_MINUTE: 5, // Alert if RPC fails 5+ times in 1 minute
  WORKER_ERRORS_PER_MINUTE: 10, // Alert if worker fails 10+ times in 1 minute
  API_ERRORS_PER_MINUTE: 20, // Alert if API fails 20+ times in 1 minute
  DEBOUNCE_MINUTES: 15, // Don't send same alert within 15 minutes
};

// Error counters
const errorCounters = new Map<string, { count: number; firstError: Date; lastAlert: Date | null }>();

interface AlertContext {
  service: string;
  errorType: string;
  errorMessage: string;
  errorCode?: string;
  userId?: string;
  additionalInfo?: Record<string, any>;
}

/**
 * Send critical alert to your personal WhatsApp
 * Uses Evolution API to send message to admin
 */
async function sendWhatsAppAlert(message: string): Promise<void> {
  try {
    const ADMIN_NUMBER = process.env.ADMIN_WHATSAPP || '5511946304133';
    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://evolution_api:8080';
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
    const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'meu-zap';

    if (!EVOLUTION_API_KEY) {
      logger.error({ msg: '[ALERT] Cannot send WhatsApp alert: EVOLUTION_API_KEY not set' });
      return;
    }

    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        number: ADMIN_NUMBER,
        text: message,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_API_KEY,
        },
        timeout: 5000,
      }
    );

    logger.info({
      msg: '[ALERT] WhatsApp alert sent successfully',
      adminNumber: ADMIN_NUMBER,
    });
  } catch (error) {
    logger.error({
      msg: '[ALERT] Failed to send WhatsApp alert',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Send alert to Discord webhook (if configured)
 */
async function sendDiscordAlert(message: string): Promise<void> {
  try {
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

    if (!DISCORD_WEBHOOK_URL) {
      logger.debug({ msg: '[ALERT] Discord webhook not configured, skipping' });
      return;
    }

    await axios.post(
      DISCORD_WEBHOOK_URL,
      {
        content: message,
        username: 'StickerBot Monitor',
        avatar_url: 'https://cdn-icons-png.flaticon.com/512/2111/2111320.png',
      },
      { timeout: 5000 }
    );

    logger.info({ msg: '[ALERT] Discord alert sent successfully' });
  } catch (error) {
    logger.error({
      msg: '[ALERT] Failed to send Discord alert',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Check if we should send an alert (debouncing logic)
 */
function shouldSendAlert(alertKey: string): boolean {
  const now = new Date();
  const counter = errorCounters.get(alertKey);

  if (!counter) {
    // First error of this type
    errorCounters.set(alertKey, {
      count: 1,
      firstError: now,
      lastAlert: null,
    });
    return false; // Don't alert on first error
  }

  // Increment counter
  counter.count++;

  // Check if we're within 1 minute of first error
  const minutesSinceFirst = (now.getTime() - counter.firstError.getTime()) / 1000 / 60;

  if (minutesSinceFirst > 1) {
    // Reset counter (new 1-minute window)
    errorCounters.set(alertKey, {
      count: 1,
      firstError: now,
      lastAlert: counter.lastAlert,
    });
    return false;
  }

  // Check if threshold exceeded
  const threshold = ALERT_THRESHOLDS.RPC_ERRORS_PER_MINUTE; // Default
  if (counter.count < threshold) {
    return false; // Not enough errors yet
  }

  // Check debounce (don't spam alerts)
  if (counter.lastAlert) {
    const minutesSinceLastAlert = (now.getTime() - counter.lastAlert.getTime()) / 1000 / 60;
    if (minutesSinceLastAlert < ALERT_THRESHOLDS.DEBOUNCE_MINUTES) {
      logger.debug({
        msg: '[ALERT] Alert debounced',
        alertKey,
        minutesSinceLastAlert,
      });
      return false; // Too soon
    }
  }

  // Update last alert time
  counter.lastAlert = now;
  return true;
}

/**
 * Send critical alert about RPC failure
 */
export async function alertRpcFailure(context: AlertContext): Promise<void> {
  const alertKey = `rpc_${context.errorType}`;

  if (!shouldSendAlert(alertKey)) {
    return; // Threshold not met or debounced
  }

  const counter = errorCounters.get(alertKey);
  const errorCount = counter?.count || 0;

  const message = `🚨 *ALERTA CRÍTICO - RPC FAILURE*

⚠️ *Serviço:* ${context.service}
🐛 *Erro:* ${context.errorType}
📝 *Mensagem:* ${context.errorMessage}
${context.errorCode ? `🔢 *Código:* ${context.errorCode}` : ''}
📊 *Ocorrências:* ${errorCount}x no último minuto

⏰ *Timestamp:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

🔥 *AÇÃO NECESSÁRIA:* Verificar logs e corrigir URGENTEMENTE!

${context.additionalInfo ? `\n📋 *Info adicional:*\n${JSON.stringify(context.additionalInfo, null, 2)}` : ''}`;

  logger.error({
    msg: '[ALERT] 🚨 Critical RPC failure alert triggered',
    service: context.service,
    errorType: context.errorType,
    errorCount,
    context,
  });

  // Send to all configured channels
  await Promise.allSettled([sendWhatsAppAlert(message), sendDiscordAlert(message)]);
}

/**
 * Send critical alert about worker failure
 */
export async function alertWorkerFailure(context: AlertContext): Promise<void> {
  const alertKey = `worker_${context.errorType}`;

  if (!shouldSendAlert(alertKey)) {
    return;
  }

  const counter = errorCounters.get(alertKey);
  const errorCount = counter?.count || 0;

  const message = `⚠️ *ALERTA - WORKER FAILURE*

🔧 *Serviço:* ${context.service}
🐛 *Erro:* ${context.errorType}
📝 *Mensagem:* ${context.errorMessage}
📊 *Ocorrências:* ${errorCount}x no último minuto

⏰ *Timestamp:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

${context.additionalInfo ? `\n📋 *Info adicional:*\n${JSON.stringify(context.additionalInfo, null, 2)}` : ''}`;

  logger.error({
    msg: '[ALERT] ⚠️ Worker failure alert triggered',
    service: context.service,
    errorType: context.errorType,
    errorCount,
    context,
  });

  await Promise.allSettled([sendWhatsAppAlert(message), sendDiscordAlert(message)]);
}

/**
 * Send critical alert about API failure
 */
export async function alertApiFailure(context: AlertContext): Promise<void> {
  const alertKey = `api_${context.errorType}`;

  if (!shouldSendAlert(alertKey)) {
    return;
  }

  const counter = errorCounters.get(alertKey);
  const errorCount = counter?.count || 0;

  const message = `🔴 *ALERTA - API FAILURE*

🌐 *Serviço:* ${context.service}
🐛 *Erro:* ${context.errorType}
📝 *Mensagem:* ${context.errorMessage}
📊 *Ocorrências:* ${errorCount}x no último minuto

⏰ *Timestamp:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

${context.additionalInfo ? `\n📋 *Info adicional:*\n${JSON.stringify(context.additionalInfo, null, 2)}` : ''}`;

  logger.error({
    msg: '[ALERT] 🔴 API failure alert triggered',
    service: context.service,
    errorType: context.errorType,
    errorCount,
    context,
  });

  await Promise.allSettled([sendWhatsAppAlert(message), sendDiscordAlert(message)]);
}

/**
 * Send system recovery notification
 */
export async function alertSystemRecovery(service: string, errorType: string): Promise<void> {
  const message = `✅ *SISTEMA RECUPERADO*

🔧 *Serviço:* ${service}
🐛 *Erro resolvido:* ${errorType}
⏰ *Timestamp:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

Sistema voltou ao normal! 🎉`;

  logger.info({
    msg: '[ALERT] ✅ System recovery notification sent',
    service,
    errorType,
  });

  await Promise.allSettled([sendWhatsAppAlert(message), sendDiscordAlert(message)]);
}

/**
 * Clear error counters for testing or manual reset
 */
export function clearErrorCounters(): void {
  errorCounters.clear();
  logger.info({ msg: '[ALERT] Error counters cleared' });
}

/**
 * Get current error statistics (for monitoring dashboard)
 */
export function getErrorStats(): Record<string, { count: number; firstError: string; lastAlert: string | null }> {
  const stats: Record<string, any> = {};

  errorCounters.forEach((value, key) => {
    stats[key] = {
      count: value.count,
      firstError: value.firstError.toISOString(),
      lastAlert: value.lastAlert?.toISOString() || null,
    };
  });

  return stats;
}

/**
 * Send critical alert about message send failure
 * This is critical because users may not receive important notifications
 */
export async function alertMessageSendFailure(context: {
  userNumber: string;
  userName: string;
  messageType: string;
  errorMessage: string;
  additionalInfo?: Record<string, any>;
}): Promise<void> {
  // For message send failures, we want immediate alert (no threshold)
  // because it's critical that users receive limit notifications
  const alertKey = `message_send_${context.messageType}`;

  // Check debounce only (no threshold for message failures)
  const now = new Date();
  const counter = errorCounters.get(alertKey);

  if (counter?.lastAlert) {
    const minutesSinceLastAlert = (now.getTime() - counter.lastAlert.getTime()) / 1000 / 60;
    if (minutesSinceLastAlert < 5) {
      // Only 5 min debounce for message failures (shorter than default)
      logger.debug({
        msg: '[ALERT] Message send failure alert debounced',
        alertKey,
        minutesSinceLastAlert,
      });
      return;
    }
  }

  // Update counter
  if (counter) {
    counter.count++;
    counter.lastAlert = now;
  } else {
    errorCounters.set(alertKey, {
      count: 1,
      firstError: now,
      lastAlert: now,
    });
  }

  const message = `🚨 *ALERTA CRÍTICO - FALHA NO ENVIO DE MENSAGEM*

📱 *Usuário:* ${context.userName}
📞 *Número:* ${context.userNumber}
📋 *Tipo de mensagem:* ${context.messageType}
🐛 *Erro:* ${context.errorMessage}

⏰ *Timestamp:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

⚠️ *IMPACTO:* Usuário NÃO recebeu notificação importante!
🔧 *AÇÃO:* Verificar Avisa API e tentar reenviar manualmente se necessário.

${context.additionalInfo ? `\n📋 *Info adicional:*\n${JSON.stringify(context.additionalInfo, null, 2)}` : ''}`;

  logger.error({
    msg: '[ALERT] 🚨 Critical message send failure alert triggered',
    userNumber: context.userNumber,
    messageType: context.messageType,
    errorMessage: context.errorMessage,
  });

  // Send to all configured channels
  await Promise.allSettled([sendWhatsAppAlert(message), sendDiscordAlert(message)]);
}
