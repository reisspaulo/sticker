/**
 * Sequence Service
 * Gerencia inscrição de usuários em sequências de comunicação
 */

import { rpc } from '../rpc';
import logger from '../config/logger';
import { sendText } from './evolutionApi';
import { supabase } from '../config/supabase';

/**
 * Tipos de sequências disponíveis
 * NOTA: cleanup_feature foi migrado para campaigns (cleanup_feature_v2)
 * twitter_discovery mantido apenas para suporte aos 348 usuários antigos
 */
export type SequenceName = 'twitter_discovery';

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

// REMOVIDO: enrollInTwitterDiscovery - substituído por enrollInTwitterDiscoveryV2 em campaignService.ts
// REMOVIDO: enrollInCleanupFeature - substituído por enrollInCleanupFeatureV2 em campaignService.ts
// As sequences foram migradas para o sistema unificado de campaigns

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

/**
 * Cancela sequência ativa de um usuário pelo número do WhatsApp
 *
 * @param userNumber - Número do WhatsApp
 * @param sequenceName - Nome da sequência
 * @param reason - Motivo do cancelamento
 */
export async function cancelSequenceByUserNumber(
  userNumber: string,
  sequenceName: SequenceName,
  reason: string = 'user_dismissed'
): Promise<boolean> {
  try {
    // Buscar user_sequence_id ativo do usuário
    const { data, error } = await supabase
      .from('user_sequences')
      .select(`
        id,
        users!inner(whatsapp_number),
        sequences!inner(name)
      `)
      .eq('users.whatsapp_number', userNumber)
      .eq('sequences.name', sequenceName)
      .in('status', ['pending', 'active'])
      .single();

    if (error || !data) {
      logger.debug({
        msg: '[SEQUENCE] No active sequence found for user',
        userNumber,
        sequenceName,
      });
      return false;
    }

    // Cancelar a sequência
    return await cancelSequence(data.id, reason);
  } catch (error) {
    logger.error({
      msg: '[SEQUENCE] Error cancelling sequence by user number',
      userNumber,
      sequenceName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Processa clique de botão em sequência de forma atômica
 * - Evita duplicação com FOR UPDATE SKIP LOCKED
 * - Registra evento button_clicked
 * - Cancela a sequência
 *
 * @returns TRUE se foi o primeiro clique, FALSE se já processado
 */
async function handleSequenceButtonClick(
  userNumber: string,
  sequenceName: SequenceName,
  buttonId: string,
  cancelReason: string
): Promise<boolean> {
  try {
    const shouldProcess = await rpc('handle_sequence_button_click', {
      p_user_number: userNumber,
      p_sequence_name: sequenceName,
      p_button_id: buttonId,
      p_cancel_reason: cancelReason,
    });

    return shouldProcess === true;
  } catch (error) {
    logger.error({
      msg: '[SEQUENCE] Error handling button click atomically',
      userNumber,
      sequenceName,
      buttonId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Handler para quando usuário clica em "Quero ver!" na sequência Twitter Discovery
 * Contexto: Usuário recebeu mensagem dias depois de bater o limite
 *
 * IMPORTANTE: Usa RPC atômico para evitar mensagem duplicada em cliques rápidos
 *
 * @param userNumber - WhatsApp number
 * @param userName - User's name
 */
export async function handleSeqTwitterLearnMore(
  userNumber: string,
  userName: string
): Promise<void> {
  try {
    // Processa clique atomicamente - retorna FALSE se já foi processado
    const shouldSend = await handleSequenceButtonClick(
      userNumber,
      'twitter_discovery',
      'btn_seq_twitter_learn',
      'user_engaged'
    );

    if (!shouldSend) {
      logger.debug({
        msg: '[SEQUENCE] Button click already processed, skipping',
        userNumber,
        buttonId: 'btn_seq_twitter_learn',
      });
      return;
    }

    const message = `📱 *Opa ${userName}, vamos lá!*

Para baixar vídeos do Twitter/X é super simples:

1️⃣ Copie o link do tweet com vídeo
2️⃣ Cole aqui no chat
3️⃣ Eu baixo o vídeo e pergunto se quer transformar em figurinha!

📋 *Exemplo de link:*
https://x.com/usuario/status/123456789

Manda um link pra testar! 🚀`;

    await sendText(userNumber, message);

    logger.info({
      msg: '[SEQUENCE] Twitter learn more handler - sequence message sent',
      userNumber,
      userName,
    });
  } catch (error) {
    logger.error({
      msg: '[SEQUENCE] Error handling seq Twitter learn more',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handler para quando usuário clica em "Não quero" na sequência Twitter Discovery
 * Contexto: Usuário recebeu mensagem dias depois de bater o limite
 *
 * IMPORTANTE: Usa RPC atômico para evitar mensagem duplicada em cliques rápidos
 *
 * @param userNumber - WhatsApp number
 * @param userName - User's name
 */
export async function handleSeqTwitterDismiss(
  userNumber: string,
  userName: string
): Promise<void> {
  try {
    // Processa clique atomicamente - retorna FALSE se já foi processado
    const shouldSend = await handleSequenceButtonClick(
      userNumber,
      'twitter_discovery',
      'btn_seq_twitter_dismiss',
      'user_dismissed'
    );

    if (!shouldSend) {
      logger.debug({
        msg: '[SEQUENCE] Button click already processed, skipping',
        userNumber,
        buttonId: 'btn_seq_twitter_dismiss',
      });
      return;
    }

    const message = `Beleza, ${userName}! Não vou mais enviar dicas sobre isso 😊

Se mudar de ideia, é só digitar *twitter* que eu explico como funciona!`;

    await sendText(userNumber, message);

    logger.info({
      msg: '[SEQUENCE] Twitter dismiss handler - sequence cancelled',
      userNumber,
      userName,
    });
  } catch (error) {
    logger.error({
      msg: '[SEQUENCE] Error handling seq Twitter dismiss',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
