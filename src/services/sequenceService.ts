/**
 * Sequence Service
 * Gerencia inscrição de usuários em sequências de comunicação
 */

import { rpc } from '../rpc';
import logger from '../config/logger';

/**
 * Tipos de sequências disponíveis
 */
export type SequenceName = 'twitter_discovery' | 'cleanup_feature';

/**
 * Triggers possíveis para enrollment
 */
export type EnrollmentTrigger =
  | 'limit_hit' // Usuário bateu limite diário
  | 'first_sticker' // Primeira figurinha criada
  | 'nth_sticker' // N-ésima figurinha
  | 'manual' // Inscrição manual
  | 'scheduled'; // Job agendado

interface EnrollmentOptions {
  trigger: EnrollmentTrigger;
  metadata?: Record<string, unknown>;
}

/**
 * Inscreve usuário em uma sequência de comunicação
 *
 * @param userId - UUID do usuário
 * @param sequenceName - Nome da sequência
 * @param options - Opções de enrollment (trigger, metadata)
 * @returns UUID do user_sequence criado ou null se não inscreveu
 *
 * @example
 * // Quando usuário bate o limite diário
 * await enrollUserInSequence(userId, 'twitter_discovery', {
 *   trigger: 'limit_hit',
 *   metadata: { daily_count: 4, daily_limit: 4 }
 * });
 */
export async function enrollUserInSequence(
  userId: string,
  sequenceName: SequenceName,
  options: EnrollmentOptions
): Promise<string | null> {
  try {
    const metadata = {
      trigger: options.trigger,
      enrolled_at: new Date().toISOString(),
      ...options.metadata,
    };

    logger.info({
      msg: '[SEQUENCE] Attempting to enroll user in sequence',
      userId,
      sequenceName,
      trigger: options.trigger,
    });

    const userSequenceId = await rpc('enroll_user_in_sequence', {
      p_user_id: userId,
      p_sequence_name: sequenceName,
      p_metadata: metadata,
    });

    if (userSequenceId) {
      logger.info({
        msg: '[SEQUENCE] User enrolled successfully',
        userId,
        sequenceName,
        userSequenceId,
        trigger: options.trigger,
      });
    } else {
      logger.debug({
        msg: '[SEQUENCE] User not enrolled (already in sequence or sequence not active)',
        userId,
        sequenceName,
      });
    }

    return userSequenceId;
  } catch (error) {
    logger.error({
      msg: '[SEQUENCE] Error enrolling user in sequence',
      userId,
      sequenceName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Inscreve usuário na sequência de Twitter Discovery
 * Chamado quando usuário bate o limite diário de figurinhas
 *
 * @param userId - UUID do usuário
 * @param metadata - Dados extras (daily_count, daily_limit, etc.)
 */
export async function enrollInTwitterDiscovery(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return enrollUserInSequence(userId, 'twitter_discovery', {
    trigger: 'limit_hit',
    metadata,
  });
}

/**
 * Inscreve usuário na sequência de Cleanup Feature
 * Chamado após usuário criar N figurinhas
 *
 * @param userId - UUID do usuário
 * @param metadata - Dados extras
 */
export async function enrollInCleanupFeature(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return enrollUserInSequence(userId, 'cleanup_feature', {
    trigger: 'nth_sticker',
    metadata,
  });
}

/**
 * Cancela sequência ativa de um usuário
 *
 * @param userSequenceId - UUID do user_sequence
 * @param reason - Motivo do cancelamento
 */
export async function cancelSequence(
  userSequenceId: string,
  reason: string = 'manual'
): Promise<boolean> {
  try {
    const cancelled = await rpc('cancel_user_sequence', {
      p_user_sequence_id: userSequenceId,
      p_reason: reason,
    });

    if (cancelled) {
      logger.info({
        msg: '[SEQUENCE] Sequence cancelled',
        userSequenceId,
        reason,
      });
    }

    return cancelled;
  } catch (error) {
    logger.error({
      msg: '[SEQUENCE] Error cancelling sequence',
      userSequenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Busca analytics de uma sequência
 *
 * @param sequenceId - UUID da sequência
 * @param startDate - Data início (opcional, default: 30 dias atrás)
 * @param endDate - Data fim (opcional, default: agora)
 */
export async function getSequenceAnalytics(
  sequenceId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const analytics = await rpc('get_sequence_analytics', {
      p_sequence_id: sequenceId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    return analytics;
  } catch (error) {
    logger.error({
      msg: '[SEQUENCE] Error getting sequence analytics',
      sequenceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
