/**
 * Campaign Service
 * Gerencia campanhas unificadas (substitui experiments e sequences)
 *
 * Features:
 * - Drip campaigns (mensagens baseadas em tempo)
 * - Event campaigns (gatilhos por evento)
 * - Hybrid campaigns (evento + follow-ups)
 * - A/B testing por step
 * - Proteção contra race conditions
 */

import { rpc, rpcAll } from '../rpc';
import logger from '../config/logger';
import { sendText } from './evolutionApi';
import { sendButtons, type ButtonData } from './avisaApi';
import type { CampaignPendingMessage, CampaignAnalytics, CampaignHealthResult } from '../rpc/types';

// ============================================
// TYPES
// ============================================

/**
 * Nomes de campanhas disponíveis
 * Adicione novas campanhas aqui conforme forem criadas no banco
 */
export type CampaignName =
  | 'twitter_discovery_v2'
  | 'cleanup_feature_v2'
  | 'limit_upsell'
  | 'limit_reached_v2' // Instant campaign for limit reached
  | 'welcome_drip'
  | 'reengagement_30d'
  | 'payment_intent_reminder_v2';

/**
 * Triggers possíveis para enrollment
 */
export type CampaignTrigger =
  | 'limit_hit' // Usuário bateu limite diário
  | 'first_sticker' // Primeira figurinha criada
  | 'nth_sticker' // N-ésima figurinha
  | 'feature_used' // Usou feature específica
  | 'inactivity' // Inatividade por X dias
  | 'manual' // Inscrição manual
  | 'scheduled' // Job agendado
  | 'webhook' // Webhook externo
  | 'payment_intent'; // Usuário selecionou plano mas não pagou

interface EnrollmentOptions {
  trigger: CampaignTrigger;
  metadata?: Record<string, unknown>;
}

// ============================================
// ENROLLMENT FUNCTIONS
// ============================================

/**
 * Inscreve usuário em uma campanha
 *
 * @param userId - UUID do usuário
 * @param campaignName - Nome da campanha
 * @param options - Opções de enrollment (trigger, metadata)
 * @returns UUID do user_campaign criado ou null se não inscreveu
 *
 * @example
 * await enrollUserInCampaign(userId, 'twitter_discovery_v2', {
 *   trigger: 'limit_hit',
 *   metadata: { daily_count: 4, daily_limit: 4 }
 * });
 */
export async function enrollUserInCampaign(
  userId: string,
  campaignName: CampaignName,
  options: EnrollmentOptions
): Promise<string | null> {
  try {
    const metadata = {
      trigger: options.trigger,
      enrolled_at: new Date().toISOString(),
      ...options.metadata,
    };

    logger.info({
      msg: '[CAMPAIGN] Attempting to enroll user',
      userId,
      campaignName,
      trigger: options.trigger,
    });

    const userCampaignId = await rpc('enroll_user_in_campaign', {
      p_user_id: userId,
      p_campaign_name: campaignName,
      p_metadata: metadata,
    });

    if (userCampaignId) {
      logger.info({
        msg: '[CAMPAIGN] User enrolled successfully',
        userId,
        campaignName,
        userCampaignId,
        trigger: options.trigger,
      });
    } else {
      logger.debug({
        msg: '[CAMPAIGN] User not enrolled (already in campaign, not active, or filtered out)',
        userId,
        campaignName,
      });
    }

    return userCampaignId;
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error enrolling user',
      userId,
      campaignName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// ============================================
// BUTTON CLICK HANDLERS
// ============================================

/**
 * Processa clique de botão em campanha de forma atômica
 * - Evita duplicação com FOR UPDATE SKIP LOCKED
 * - Registra evento button_clicked
 * - Opcionalmente cancela a campanha
 *
 * @param userNumber - Número do WhatsApp
 * @param campaignName - Nome da campanha
 * @param buttonId - ID do botão clicado
 * @param shouldCancel - Se deve cancelar a campanha (default: true)
 * @returns TRUE se foi o primeiro clique, FALSE se já processado
 */
export async function handleCampaignButtonClick(
  userNumber: string,
  campaignName: CampaignName,
  buttonId: string,
  shouldCancel: boolean = true
): Promise<boolean> {
  try {
    const shouldProcess = await rpc('handle_campaign_button_click', {
      p_user_number: userNumber,
      p_campaign_name: campaignName,
      p_button_id: buttonId,
      p_should_cancel: shouldCancel,
    });

    logger.info({
      msg: '[CAMPAIGN] Button click processed',
      userNumber,
      campaignName,
      buttonId,
      shouldProcess,
      cancelled: shouldCancel && shouldProcess,
    });

    return shouldProcess === true;
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error handling button click',
      userNumber,
      campaignName,
      buttonId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// ============================================
// MESSAGE SENDING
// ============================================

/**
 * Envia mensagem de campanha baseado no content_type
 *
 * @param message - Mensagem pendente da campanha
 * @returns true se enviou com sucesso
 */
export async function sendCampaignMessage(message: CampaignPendingMessage): Promise<boolean> {
  try {
    const { user_number, user_name, content_type, title, body, footer, buttons, metadata } =
      message;

    // Validar que body existe (pode ser NULL se mensagem não foi configurada)
    if (!body) {
      logger.error({
        msg: '[CAMPAIGN] Message body is NULL - step has no message configured',
        userCampaignId: message.user_campaign_id,
        campaignName: message.campaign_name,
        stepKey: message.step_key,
        variant: message.variant,
      });
      return false;
    }

    // Função para substituir placeholders
    const replacePlaceholders = (text: string): string => {
      let result = text
        .replace(/{name}/g, user_name || 'amigo')
        .replace(/{user_name}/g, user_name || 'amigo');

      // Substituir placeholders do metadata (ex: {plan_name}, {benefit_today})
      if (metadata) {
        const planName = metadata.plan_name || metadata.plan || 'Premium';
        const planBenefit = metadata.plan_benefit || '+16 figurinhas extras hoje';
        const benefitToday = metadata.benefit_today || '+16 figurinhas extras hoje';
        const benefitWeek = metadata.benefit_week || '84 figurinhas';
        const totalWeek = metadata.total_week || '1.247';

        result = result
          .replace(/{plan_name}/g, String(planName))
          .replace(/{plan_benefit}/g, String(planBenefit))
          .replace(/{benefit_today}/g, String(benefitToday))
          .replace(/{benefit_week}/g, String(benefitWeek))
          .replace(/{total_week}/g, String(totalWeek));
      }

      return result;
    };

    // Processar body e title
    const processedBody = replacePlaceholders(body);
    const processedTitle = title ? replacePlaceholders(title) : '';

    switch (content_type) {
      case 'text':
        await sendText(user_number, processedBody);
        break;

      case 'buttons':
        if (!buttons || buttons.length === 0) {
          logger.warn({
            msg: '[CAMPAIGN] Buttons content_type but no buttons defined, sending as text',
            userCampaignId: message.user_campaign_id,
          });
          await sendText(user_number, processedBody);
        } else {
          const buttonData: ButtonData[] = buttons.map((btn) => ({
            id: btn.id,
            text: btn.text,
          }));

          await sendButtons({
            number: user_number,
            title: processedTitle,
            desc: processedBody,
            footer: footer || undefined,
            buttons: buttonData,
          });
        }
        break;

      case 'sticker':
      case 'image':
      case 'video':
        // TODO: Implementar envio de mídia quando necessário
        logger.warn({
          msg: '[CAMPAIGN] Media content_type not yet implemented, sending body as text',
          contentType: content_type,
          userCampaignId: message.user_campaign_id,
        });
        await sendText(user_number, processedBody);
        break;

      default:
        logger.error({
          msg: '[CAMPAIGN] Unknown content_type',
          contentType: content_type,
          userCampaignId: message.user_campaign_id,
        });
        return false;
    }

    logger.info({
      msg: '[CAMPAIGN] Message sent successfully',
      userCampaignId: message.user_campaign_id,
      campaignName: message.campaign_name,
      stepKey: message.step_key,
      variant: message.variant,
      contentType: content_type,
    });

    return true;
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error sending message',
      userCampaignId: message.user_campaign_id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// ============================================
// WORKER PROCESSING
// ============================================

/**
 * Busca e processa mensagens pendentes de campanha
 * Usado pelo worker para processar campanhas agendadas
 *
 * ANTI-SPAM PROTECTION (16/01/2026):
 * - Rate limit aumentado para 3s entre mensagens
 * - Batch size reduzido para 15
 * - Backoff exponencial implementado no banco (5min, 15min, 1h, 4h)
 * - Limite de 5 retentativas antes de marcar como failed_permanent
 * - Cooling-off de 24h para usuários novos
 *
 * @param limit - Número máximo de mensagens a processar (default: 15)
 * @param rateLimitMs - Delay entre envios em ms (default: 3000)
 * @returns Estatísticas do processamento
 */
export async function processPendingCampaignMessages(
  limit: number = 15,
  rateLimitMs: number = 3000
): Promise<{ sent: number; failed: number; total: number }> {
  const stats = { sent: 0, failed: 0, total: 0 };

  try {
    // Buscar mensagens pendentes (já trava com FOR UPDATE SKIP LOCKED)
    // Usar rpcAll para obter array completo ao invés de primeira row
    const messages = await rpcAll('get_pending_campaign_messages', {
      p_limit: limit,
    });

    if (!messages || messages.length === 0) {
      logger.debug({
        msg: '[CAMPAIGN] No pending messages to process',
      });
      return stats;
    }

    stats.total = messages.length;

    logger.info({
      msg: '[CAMPAIGN] Processing pending messages',
      count: messages.length,
    });

    for (const message of messages) {
      try {
        // Enviar mensagem
        const success = await sendCampaignMessage(message);

        // Avançar step
        const result = await rpc('advance_campaign_step', {
          p_user_campaign_id: message.user_campaign_id,
          p_success: success,
          p_metadata: {
            sent_at: new Date().toISOString(),
            content_type: message.content_type,
          },
        });

        if (success) {
          stats.sent++;
          logger.info({
            msg: '[CAMPAIGN] Step advanced',
            userCampaignId: message.user_campaign_id,
            result,
          });
        } else {
          stats.failed++;
        }

        // Rate limiting
        if (rateLimitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitMs));
        }
      } catch (error) {
        stats.failed++;
        logger.error({
          msg: '[CAMPAIGN] Error processing message',
          userCampaignId: message.user_campaign_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Marcar como falha para retry
        await rpc('advance_campaign_step', {
          p_user_campaign_id: message.user_campaign_id,
          p_success: false,
          p_metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            failed_at: new Date().toISOString(),
          },
        }).catch(() => {}); // Não falhar se o update falhar
      }
    }

    logger.info({
      msg: '[CAMPAIGN] Finished processing messages',
      ...stats,
    });

    return stats;
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error in processPendingCampaignMessages',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return stats;
  }
}

/**
 * Verifica e cancela campanhas que atingiram cancel_condition
 * Deve ser chamado periodicamente pelo worker
 *
 * @returns Número de campanhas canceladas
 */
export async function checkCancelConditions(): Promise<number> {
  try {
    const cancelled = await rpc('check_campaign_cancel_conditions', {});

    if (cancelled > 0) {
      logger.info({
        msg: '[CAMPAIGN] Cancelled campaigns by condition',
        count: cancelled,
      });
    }

    return cancelled;
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error checking cancel conditions',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

/**
 * Reverte campanhas travadas em 'processing'
 * Usado para recovery de workers que crasharam
 *
 * @param olderThanMinutes - Considerar travado após X minutos (default: 10)
 * @returns Número de campanhas revertidas
 */
export async function revertStuckProcessing(olderThanMinutes: number = 10): Promise<number> {
  try {
    const reverted = await rpc('revert_stuck_campaign_processing', {
      p_older_than_minutes: olderThanMinutes,
    });

    if (reverted > 0) {
      logger.warn({
        msg: '[CAMPAIGN] Reverted stuck campaigns',
        count: reverted,
        olderThanMinutes,
      });
    }

    return reverted;
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error reverting stuck processing',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

/**
 * Verifica saúde das campanhas e pausa automaticamente as com >50% de falha
 * ANTI-SPAM: Implementado em 16/01/2026 após ban do WhatsApp
 *
 * @returns Array de campanhas que foram pausadas
 */
export async function checkCampaignHealthAndAutoPause(): Promise<CampaignHealthResult[]> {
  try {
    const results = await rpcAll('check_campaign_health_and_auto_pause', {});

    if (results && results.length > 0) {
      for (const result of results) {
        logger.warn({
          msg: '[CAMPAIGN] Campaign auto-paused due to high failure rate',
          campaignName: result.campaign_name,
          failureRate: result.failure_rate,
          reason: result.reason,
        });
      }
    }

    return results || [];
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error checking campaign health',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Busca analytics de uma campanha
 *
 * @param campaignName - Nome da campanha
 * @param startDate - Data início (opcional, default: 30 dias atrás)
 * @param endDate - Data fim (opcional, default: agora)
 */
export async function getCampaignAnalytics(
  campaignName: CampaignName,
  startDate?: string,
  endDate?: string
): Promise<CampaignAnalytics | null> {
  try {
    const analytics = await rpc('get_campaign_analytics', {
      p_campaign_name: campaignName,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    return analytics;
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error getting analytics',
      campaignName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// ============================================
// CONVENIENCE ENROLLMENT FUNCTIONS
// ============================================

/**
 * Inscreve usuário na campanha de Twitter Discovery V2
 * Chamado quando usuário bate o limite diário
 */
export async function enrollInTwitterDiscoveryV2(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return enrollUserInCampaign(userId, 'twitter_discovery_v2', {
    trigger: 'limit_hit',
    metadata,
  });
}

/**
 * Inscreve usuário na campanha de Cleanup Feature V2
 * Chamado após usuário criar N figurinhas
 */
export async function enrollInCleanupFeatureV2(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return enrollUserInCampaign(userId, 'cleanup_feature_v2', {
    trigger: 'nth_sticker',
    metadata,
  });
}

/**
 * Inscreve usuário na campanha de Limit Upsell
 * Chamado quando usuário bate o limite diário
 */
export async function enrollInLimitUpsell(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return enrollUserInCampaign(userId, 'limit_upsell', {
    trigger: 'limit_hit',
    metadata,
  });
}

/**
 * Inscreve usuário na campanha Welcome Drip
 * Chamado na primeira interação do usuário
 */
export async function enrollInWelcomeDrip(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return enrollUserInCampaign(userId, 'welcome_drip', {
    trigger: 'first_sticker',
    metadata,
  });
}

/**
 * Inscreve usuário na campanha Payment Intent Reminder V2
 * Chamado quando usuário seleciona plano mas não completa pagamento
 *
 * @param userId - UUID do usuário
 * @param metadata - Dados adicionais (plan_name, plan_benefit, etc)
 */
export async function enrollInPaymentIntentReminderV2(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return enrollUserInCampaign(userId, 'payment_intent_reminder_v2', {
    trigger: 'payment_intent',
    metadata,
  });
}

// ============================================
// BUTTON HANDLERS (para webhook.ts)
// ============================================

/**
 * Handler genérico para botões de campanha
 * Use para botões com prefixo btn_campaign_
 *
 * @param userNumber - Número do WhatsApp
 * @param userName - Nome do usuário
 * @param buttonId - ID do botão (ex: btn_campaign_twitter_learn)
 * @param campaignName - Nome da campanha
 * @param responseMessage - Mensagem a enviar após processar
 * @param shouldCancel - Se deve cancelar a campanha (default: true)
 */
export async function handleCampaignButton(
  userNumber: string,
  userName: string,
  buttonId: string,
  campaignName: CampaignName,
  responseMessage: string,
  shouldCancel: boolean = true
): Promise<void> {
  try {
    // Processa clique atomicamente - retorna FALSE se já foi processado
    const shouldSend = await handleCampaignButtonClick(
      userNumber,
      campaignName,
      buttonId,
      shouldCancel
    );

    if (!shouldSend) {
      logger.debug({
        msg: '[CAMPAIGN] Button click already processed, skipping',
        userNumber,
        buttonId,
        campaignName,
      });
      return;
    }

    // Substituir placeholders na mensagem
    const message = responseMessage
      .replace(/{name}/g, userName || 'amigo')
      .replace(/{user_name}/g, userName || 'amigo');

    await sendText(userNumber, message);

    logger.info({
      msg: '[CAMPAIGN] Button handler completed',
      userNumber,
      buttonId,
      campaignName,
      cancelled: shouldCancel,
    });
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error in button handler',
      userNumber,
      buttonId,
      campaignName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// INSTANT CAMPAIGN FUNCTIONS
// ============================================

/**
 * Resultado de get_instant_campaign_message
 */
export interface InstantCampaignMessage {
  campaign_id: string;
  variant: string;
  title: string;
  body: string;
  buttons: Array<{ id: string; text: string }> | null;
  content_type: string;
  is_new_assignment: boolean;
}

/**
 * Busca mensagem de campanha instant com variante sorteada
 * Usado para limit_reached_v2 e futuras campanhas instant
 *
 * @param userId - UUID do usuário
 * @param campaignName - Nome da campanha instant
 * @param metadata - Dados extras para analytics
 * @returns Mensagem com variante, ou null se campanha não ativa
 */
export async function getInstantCampaignMessage(
  userId: string,
  campaignName: string,
  metadata?: Record<string, unknown>
): Promise<InstantCampaignMessage | null> {
  try {
    logger.info({
      msg: '[CAMPAIGN-INSTANT] Getting message',
      userId,
      campaignName,
    });

    const result = await rpc('get_instant_campaign_message', {
      p_user_id: userId,
      p_campaign_name: campaignName,
      p_metadata: metadata || {},
    });

    if (!result) {
      logger.warn({
        msg: '[CAMPAIGN-INSTANT] No message returned - campaign not active?',
        userId,
        campaignName,
      });
      return null;
    }

    logger.info({
      msg: '[CAMPAIGN-INSTANT] Message retrieved',
      userId,
      campaignName,
      variant: result.variant,
      isNewAssignment: result.is_new_assignment,
    });

    return {
      campaign_id: result.campaign_id,
      variant: result.variant,
      title: result.title,
      body: result.body,
      buttons: result.buttons,
      content_type: result.content_type,
      is_new_assignment: result.is_new_assignment,
    };
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN-INSTANT] Error getting message',
      userId,
      campaignName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Loga evento de campanha instant para analytics
 * Eventos: menu_shown, button_clicked, dismiss_clicked, upgrade_clicked, converted
 *
 * @param userId - UUID do usuário
 * @param campaignName - Nome da campanha instant
 * @param eventType - Tipo do evento
 * @param metadata - Dados extras
 * @returns UUID do evento ou null se falhou
 */
export async function logCampaignInstantEvent(
  userId: string,
  campaignName: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  try {
    logger.debug({
      msg: '[CAMPAIGN-EVENT] Logging event',
      userId,
      campaignName,
      eventType,
    });

    const eventId = await rpc('log_campaign_instant_event', {
      p_user_id: userId,
      p_campaign_name: campaignName,
      p_event_type: eventType,
      p_metadata: metadata || {},
    });

    if (eventId) {
      logger.info({
        msg: '[CAMPAIGN-EVENT] Event logged',
        userId,
        campaignName,
        eventType,
        eventId,
      });
    }

    return eventId;
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN-EVENT] Error logging event',
      userId,
      campaignName,
      eventType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Busca mensagem de limite atingido da campanha limit_reached_v2
 * Substitui a função getUpgradeDismissVariant do experimentService
 *
 * @param userId - UUID do usuário
 * @param count - Quantidade de figurinhas usadas
 * @param limit - Limite diário do usuário
 * @returns Mensagem formatada com placeholders substituídos
 */
export async function getLimitReachedMessage(
  userId: string,
  count: number,
  limit: number
): Promise<InstantCampaignMessage | null> {
  try {
    logger.info({
      msg: '[LIMIT-REACHED] Getting message',
      userId,
      count,
      limit,
    });

    const message = await getInstantCampaignMessage(userId, 'limit_reached_v2', {
      count,
      limit,
      triggered_at: new Date().toISOString(),
    });

    if (!message) {
      logger.warn({
        msg: '[LIMIT-REACHED] No message - falling back to default',
        userId,
      });
      return null;
    }

    // Substituir placeholders
    message.title = message.title
      .replace(/{count}/g, String(count))
      .replace(/{limit}/g, String(limit));

    message.body = message.body
      .replace(/{count}/g, String(count))
      .replace(/{limit}/g, String(limit));

    logger.info({
      msg: '[LIMIT-REACHED] Message ready',
      userId,
      variant: message.variant,
      isNewAssignment: message.is_new_assignment,
    });

    return message;
  } catch (error) {
    logger.error({
      msg: '[LIMIT-REACHED] Error getting message',
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
