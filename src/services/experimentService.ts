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

    const { data, error } = await supabase.rpc('assign_experiment_variant', {
      p_user_id: userId,
      p_experiment_name: 'upgrade_message_v1',
      p_is_brazilian: isBrazilian,
    });

    if (error) {
      logger.error({
        msg: '[EXPERIMENT] RPC error',
        error: error.message,
        userId,
      });
      return null;
    }

    if (!data || data.length === 0) {
      logger.warn({
        msg: '[EXPERIMENT] No active experiment found',
        userId,
      });
      return null;
    }

    const result = data[0] as ExperimentVariantResult;

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
    const { error } = await supabase.rpc('log_experiment_event', {
      p_user_id: userId,
      p_experiment_id: experimentId,
      p_variant: variant,
      p_event_type: eventType,
      p_metadata: metadata,
    });

    if (error) {
      logger.error({
        msg: '[EXPERIMENT] Error logging event',
        error: error.message,
        userId,
        eventType,
      });
      return;
    }

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
    const { data, error } = await supabase.rpc('schedule_reminder', {
      p_user_id: userId,
      p_user_number: userNumber,
      p_delay_hours: delayHours,
      p_experiment_id: experimentId,
      p_variant: variant,
    });

    if (error) {
      logger.error({
        msg: '[EXPERIMENT] Error scheduling reminder',
        error: error.message,
        userId,
        delayHours,
      });
      return null;
    }

    logger.info({
      msg: '[EXPERIMENT] Reminder scheduled',
      userId,
      delayHours,
      reminderId: data,
    });

    return data as string;
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
    const { data, error } = await supabase.rpc('get_pending_reminder', {
      p_user_id: userId,
    });

    if (error) {
      logger.error({
        msg: '[EXPERIMENT] Error getting pending reminder',
        error: error.message,
        userId,
      });
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as PendingReminder;
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
    const { data, error } = await supabase.rpc('get_experiment_metrics', {
      p_experiment_id: experimentId,
    });

    if (error) {
      logger.error({
        msg: '[EXPERIMENT] Error getting metrics',
        error: error.message,
        experimentId,
      });
      return [];
    }

    return (data || []) as ExperimentMetrics[];
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
