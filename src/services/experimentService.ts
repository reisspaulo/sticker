/**
 * 🧪 EXPERIMENT SERVICE
 *
 * Servico para gerenciar experimentos A/B.
 * Usa RPCs do Supabase para atribuicao atomica de variantes.
 *
 * Experimento atual: upgrade_message_v1
 * - Testa diferentes mensagens e tons no menu de limite atingido
 * - Variantes: control, social_proof, benefit, hybrid
 */

import { supabase } from '../config/supabase';
import logger from '../config/logger';
import { isBrazilianNumber } from './avisaApi';
import { rpc, rpcOptional, rpcAll } from '../rpc';

// ============================================
// TYPES
// ============================================

export interface ExperimentVariantConfig {
  // Legacy button config (for backwards compatibility)
  button_text?: string;
  button_id?: string;
  action?: 'dismiss' | 'schedule_reminder';
  delay_hours?: number;
  show_button?: boolean;

  // Message config (new)
  message_title?: string;
  message_body?: string;

  // Button customization (new)
  button_dismiss_text?: string;
  button_dismiss_id?: string;
  button_premium_text?: string;
  button_ultra_text?: string;
  show_dismiss_button?: boolean;
}

export interface ExperimentVariantResult {
  experiment_id: string;
  variant: string;
  config: ExperimentVariantConfig;
  is_new_assignment: boolean;
}

export interface PendingReminder {
  id: string;
  scheduled_for: string;
  minutes_remaining: number;
}

export interface ExperimentMetrics {
  variant: string;
  total_users: number;
  menu_shown: number;
  dismiss_clicked: number;
  remind_scheduled: number;
  remind_sent: number;
  upgrade_clicked: number;
  converted: number;
  conversion_rate: number;
}

// ============================================
// EXPERIMENT VARIANT ASSIGNMENT
// ============================================

/**
 * Obtem a variante do experimento para o usuario.
 * Se usuario nao tem variante, sorteia uma nova.
 * Usuarios internacionais sempre recebem 'control'.
 */
export async function getUpgradeDismissVariant(
  userId: string,
  userNumber: string
): Promise<ExperimentVariantResult | null> {
  try {
    const isBrazilian = isBrazilianNumber(userNumber);

    logger.debug({
      msg: '[EXPERIMENT] Getting variant for user',
      userId,
      userNumber: userNumber.slice(0, 6) + '...',
      isBrazilian,
    });

    // ✅ Type-safe RPC call - returns first row or null
    const result = await rpcOptional('assign_experiment_variant', {
      p_user_id: userId,
      p_experiment_name: 'upgrade_message_v1',
      p_is_brazilian: isBrazilian,
    });

    if (!result) {
      logger.warn({
        msg: '[EXPERIMENT] No active experiment found',
        userId,
      });
      return null;
    }

    if (result.is_new_assignment) {
      logger.info({
        msg: '[EXPERIMENT] New variant assigned',
        userId,
        variant: result.variant,
        experimentId: result.experiment_id,
      });
    } else {
      logger.debug({
        msg: '[EXPERIMENT] Existing variant returned',
        userId,
        variant: result.variant,
      });
    }

    return result;
  } catch (error) {
    logger.error({
      msg: '[EXPERIMENT] Error getting variant',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return null;
  }
}

// ============================================
// EVENT LOGGING
// ============================================

/**
 * Registra evento do experimento para metricas.
 * Event types:
 * - menu_shown: Usuario viu menu de upgrade
 * - dismiss_clicked: Clicou no botao dismiss/remind
 * - remind_scheduled: Agendou lembrete
 * - remind_sent: Lembrete foi enviado
 * - upgrade_clicked: Clicou em Premium/Ultra
 * - converted: Pagou e ativou plano
 */
export async function logExperimentEvent(
  userId: string,
  experimentId: string,
  variant: string,
  eventType: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    // ✅ Type-safe RPC call (void function)
    await rpc('log_experiment_event', {
      p_user_id: userId,
      p_experiment_id: experimentId,
      p_variant: variant,
      p_event_type: eventType,
      p_metadata: metadata,
    });

    logger.info({
      msg: '[EXPERIMENT] Event logged',
      userId,
      experimentId,
      variant,
      eventType,
    });
  } catch (error) {
    logger.error({
      msg: '[EXPERIMENT] Exception logging event',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      eventType,
    });
  }
}

// ============================================
// SCHEDULED REMINDERS
// ============================================

/**
 * Agenda um lembrete para o usuario.
 * Usado quando o usuario clica em "Me lembre em Xh".
 */
export async function scheduleReminder(
  userId: string,
  userNumber: string,
  delayHours: number,
  experimentId: string | null = null,
  variant: string | null = null
): Promise<string | null> {
  try {
    // ✅ Type-safe RPC call (scalar - returns string)
    const reminderId = await rpc('schedule_reminder', {
      p_user_id: userId,
      p_user_number: userNumber,
      p_delay_hours: delayHours,
      p_experiment_id: experimentId,
      p_variant: variant,
    });

    logger.info({
      msg: '[EXPERIMENT] Reminder scheduled',
      userId,
      delayHours,
      reminderId,
    });

    return reminderId;
  } catch (error) {
    logger.error({
      msg: '[EXPERIMENT] Exception scheduling reminder',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return null;
  }
}

/**
 * Verifica se usuario tem lembrete pendente.
 * Usado para decidir se mostra botao de lembrete no menu.
 */
export async function getPendingReminder(
  userId: string
): Promise<PendingReminder | null> {
  try {
    // ✅ Type-safe RPC call - returns first row or null
    const result = await rpcOptional('get_pending_reminder', {
      p_user_id: userId,
    });

    return result as PendingReminder | null;
  } catch (error) {
    logger.error({
      msg: '[EXPERIMENT] Exception getting pending reminder',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return null;
  }
}

/**
 * Verifica se usuario tem lembrete pendente (versao boolean simples).
 */
export async function hasPendingReminder(userId: string): Promise<boolean> {
  const reminder = await getPendingReminder(userId);
  return reminder !== null;
}

// ============================================
// METRICS
// ============================================

/**
 * Obtem metricas do experimento por variante.
 * Usado no admin panel para visualizacao.
 */
export async function getExperimentMetrics(
  experimentId: string
): Promise<ExperimentMetrics[]> {
  try {
    // ✅ Type-safe RPC call - returns array
    const metrics = await rpcAll('get_experiment_metrics', {
      p_experiment_id: experimentId,
    });

    return metrics as ExperimentMetrics[];
  } catch (error) {
    logger.error({
      msg: '[EXPERIMENT] Exception getting metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
      experimentId,
    });
    return [];
  }
}

/**
 * Lista experimentos ativos.
 */
export async function getActiveExperiments(): Promise<
  Array<{ id: string; name: string; description: string }>
> {
  try {
    const { data, error } = await supabase
      .from('experiments')
      .select('id, name, description')
      .eq('status', 'active');

    if (error) {
      logger.error({
        msg: '[EXPERIMENT] Error listing experiments',
        error: error.message,
      });
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error({
      msg: '[EXPERIMENT] Exception listing experiments',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

// ============================================
// PAYMENT INTENT REMINDERS
// ============================================

/**
 * Obtem variante do experimento payment_intent_reminder_v1.
 * Similar ao getUpgradeDismissVariant mas para reminder de pagamento.
 */
export async function getPaymentReminderVariant(
  userId: string,
  userNumber: string
): Promise<ExperimentVariantResult | null> {
  try {
    const isBrazilian = isBrazilianNumber(userNumber);

    logger.debug({
      msg: '[PAYMENT_REMINDER] Getting variant for user',
      userId,
      userNumber: userNumber.slice(0, 6) + '...',
      isBrazilian,
    });

    // ✅ Type-safe RPC call - returns first row or null
    const result = await rpcOptional('assign_experiment_variant', {
      p_user_id: userId,
      p_experiment_name: 'payment_intent_reminder_v1',
      p_is_brazilian: isBrazilian,
    });

    if (!result) {
      logger.warn({
        msg: '[PAYMENT_REMINDER] No active experiment found',
        userId,
      });
      return null;
    }

    if (result.is_new_assignment) {
      logger.info({
        msg: '[PAYMENT_REMINDER] New variant assigned',
        userId,
        variant: result.variant,
        experimentId: result.experiment_id,
      });
    }

    return result;
  } catch (error) {
    logger.error({
      msg: '[PAYMENT_REMINDER] Error getting variant',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return null;
  }
}

/**
 * Agenda os 3 lembretes de pagamento (T+30min, T+6h, T+48h).
 * Timeline suave para não spammar o usuário.
 */
export async function schedulePaymentReminders(
  userId: string,
  userNumber: string,
  selectedPlan: 'premium' | 'ultra',
  experimentId: string,
  variant: string
): Promise<boolean> {
  try {
    const now = new Date();

    // Wave 1: T+30min
    const wave1Time = new Date(now.getTime() + 30 * 60 * 1000);

    // Wave 2: T+6h
    const wave2Time = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    // Wave 3: T+48h
    const wave3Time = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const reminders = [
      {
        user_id: userId,
        user_number: userNumber,
        reminder_type: 'payment_reminder_wave1',
        scheduled_for: wave1Time.toISOString(),
        status: 'pending',
        experiment_id: experimentId,
        variant,
        message_template: JSON.stringify({ selected_plan: selectedPlan, wave: 1 }),
      },
      {
        user_id: userId,
        user_number: userNumber,
        reminder_type: 'payment_reminder_wave2',
        scheduled_for: wave2Time.toISOString(),
        status: 'pending',
        experiment_id: experimentId,
        variant,
        message_template: JSON.stringify({ selected_plan: selectedPlan, wave: 2 }),
      },
      {
        user_id: userId,
        user_number: userNumber,
        reminder_type: 'payment_reminder_wave3',
        scheduled_for: wave3Time.toISOString(),
        status: 'pending',
        experiment_id: experimentId,
        variant,
        message_template: JSON.stringify({ selected_plan: selectedPlan, wave: 3 }),
      },
    ];

    const { error } = await supabase.from('scheduled_reminders').insert(reminders);

    if (error) {
      logger.error({
        msg: '[PAYMENT_REMINDER] Error scheduling reminders',
        error: error.message,
        userId,
        selectedPlan,
      });
      return false;
    }

    logger.info({
      msg: '[PAYMENT_REMINDER] 3 reminders scheduled',
      userId,
      selectedPlan,
      wave1: wave1Time.toISOString(),
      wave2: wave2Time.toISOString(),
      wave3: wave3Time.toISOString(),
    });

    return true;
  } catch (error) {
    logger.error({
      msg: '[PAYMENT_REMINDER] Exception scheduling reminders',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return false;
  }
}

/**
 * Cancela lembretes pendentes quando usuário completa pagamento.
 * Atualiza status para 'canceled' para evitar envio.
 */
export async function cancelPaymentReminders(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('scheduled_reminders')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .in('reminder_type', [
        'payment_reminder_wave1',
        'payment_reminder_wave2',
        'payment_reminder_wave3',
      ]);

    if (error) {
      logger.error({
        msg: '[PAYMENT_REMINDER] Error canceling reminders',
        error: error.message,
        userId,
      });
      return false;
    }

    logger.info({
      msg: '[PAYMENT_REMINDER] Pending reminders canceled',
      userId,
    });

    return true;
  } catch (error) {
    logger.error({
      msg: '[PAYMENT_REMINDER] Exception canceling reminders',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return false;
  }
}
