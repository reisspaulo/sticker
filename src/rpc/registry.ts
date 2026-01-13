/**
 * 🗂️ RPC REGISTRY
 *
 * Single Source of Truth para TODAS as funcoes RPC do Supabase.
 *
 * COMO ADICIONAR NOVA FUNCAO:
 * 1. Adicione o type da resposta em types.ts
 * 2. Adicione a funcao aqui no registry
 * 3. Use rpc('nome_da_funcao', params) no codigo
 *
 * O TypeScript vai inferir automaticamente:
 * - Parametros obrigatorios
 * - Tipo de retorno
 * - Se eh scalar, table ou void
 */

import type {
  AtomicLimitCheckResult,
  ExperimentVariantResult,
  PendingReminderResult,
  ExperimentMetricsResult,
  TwitterDownloadForCleanup,
  SequenceStepPending,
  AdvanceStepResult,
  SequenceAnalytics,
  CampaignPendingMessage,
  CampaignAnalytics,
} from './types.js';

// ============================================
// REGISTRY DEFINITION
// ============================================

/**
 * Registry de todas as funcoes RPC.
 *
 * Formato:
 * - type: 'scalar' | 'table' | 'void'
 * - params: tipo dos parametros (usar {} as Type para inferencia)
 * - returns: tipo do retorno (usar {} as Type para inferencia)
 */
export const RPC_REGISTRY = {
  // ═══════════════════════════════════════════════════════════════
  // SCALAR FUNCTIONS (retornam valor unico: number, boolean, string)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Incrementa contador diario do usuario
   * @returns novo valor do contador
   */
  increment_daily_count: {
    type: 'scalar' as const,
    params: {} as { p_user_id: string },
    returns: {} as number,
  },

  /**
   * Reseta contadores diarios de TODOS os usuarios
   * @returns quantidade de usuarios resetados
   */
  reset_all_daily_counters: {
    type: 'scalar' as const,
    params: {} as Record<string, never>,
    returns: {} as number,
  },

  /**
   * Incrementa credito bonus do usuario
   * @returns novo valor do bonus
   */
  increment_bonus_credit: {
    type: 'scalar' as const,
    params: {} as { p_user_id: string },
    returns: {} as number,
  },

  /**
   * Incrementa contador de downloads Twitter do usuario
   * @returns novo valor do contador
   */
  increment_twitter_download_count: {
    type: 'scalar' as const,
    params: {} as { p_user_id: string },
    returns: {} as number,
  },

  /**
   * Marca usuario como notificado sobre limite (atomico)
   * @returns true se ja foi notificado hoje, false se eh primeira notificacao
   */
  set_limit_notified_atomic: {
    type: 'scalar' as const,
    params: {} as { p_user_id: string },
    returns: {} as boolean,
  },

  /**
   * Agenda lembrete para usuario
   * @returns ID do lembrete criado
   */
  schedule_reminder: {
    type: 'scalar' as const,
    params: {} as {
      p_user_id: string;
      p_user_number: string;
      p_delay_hours: number;
      p_experiment_id: string | null;
      p_variant: string | null;
    },
    returns: {} as string,
  },

  /**
   * Marca twitter_feature_shown atomicamente (previne race condition)
   * @returns true se foi o primeiro a marcar (DEVE enviar msg), false se ja estava marcado (NAO enviar)
   */
  set_twitter_feature_shown_atomic: {
    type: 'scalar' as const,
    params: {} as { p_user_number: string },
    returns: {} as boolean,
  },

  // ═══════════════════════════════════════════════════════════════
  // TABLE FUNCTIONS (retornam array de rows)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Verifica e incrementa limite diario atomicamente
   * @returns status do limite (allowed, daily_count, effective_limit, etc)
   */
  check_and_increment_daily_limit_atomic: {
    type: 'table' as const,
    params: {} as { p_user_id: string; p_max_onboarding?: number },
    returns: {} as AtomicLimitCheckResult,
  },

  /**
   * Atribui variante de experimento ao usuario
   * @returns variante atribuida com config
   */
  assign_experiment_variant: {
    type: 'table' as const,
    params: {} as {
      p_user_id: string;
      p_experiment_name: string;
      p_is_brazilian?: boolean;
    },
    returns: {} as ExperimentVariantResult,
  },

  /**
   * Busca lembrete pendente do usuario
   * @returns lembrete pendente ou null
   */
  get_pending_reminder: {
    type: 'table' as const,
    params: {} as { p_user_id: string },
    returns: {} as PendingReminderResult,
  },

  /**
   * Busca metricas de experimento por variante
   * @returns array de metricas por variante
   */
  get_experiment_metrics: {
    type: 'table' as const,
    params: {} as { p_experiment_id: string },
    returns: {} as ExperimentMetricsResult,
  },

  /**
   * Busca downloads antigos do Twitter para cleanup
   * @returns array de downloads para deletar
   */
  get_old_twitter_downloads_for_cleanup: {
    type: 'table' as const,
    params: {} as { p_hours_old?: number },
    returns: {} as TwitterDownloadForCleanup,
  },

  // ═══════════════════════════════════════════════════════════════
  // VOID FUNCTIONS (nao retornam valor, apenas executam)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Loga evento de experimento para metricas
   */
  log_experiment_event: {
    type: 'void' as const,
    params: {} as {
      p_user_id: string;
      p_experiment_id: string;
      p_variant: string;
      p_event_type: string;
      p_metadata?: Record<string, unknown>;
    },
    returns: undefined as unknown as void,
  },

  /**
   * Limpa contextos de conversa expirados
   */
  cleanup_expired_conversation_contexts: {
    type: 'void' as const,
    params: {} as Record<string, never>,
    returns: undefined as unknown as void,
  },

  // ═══════════════════════════════════════════════════════════════
  // SEQUENCE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Inscreve usuario em uma sequencia de comunicacao
   * @returns UUID do user_sequence criado, ou NULL se nao inscreveu
   */
  enroll_user_in_sequence: {
    type: 'scalar' as const,
    params: {} as {
      p_user_id: string;
      p_sequence_name: string;
      p_metadata?: Record<string, unknown>;
    },
    returns: {} as string | null,
  },

  /**
   * Busca steps de sequencia prontos para envio
   * @returns Array de steps pendentes com dados do usuario e mensagem
   */
  get_pending_sequence_steps: {
    type: 'table' as const,
    params: {} as { p_limit?: number },
    returns: {} as SequenceStepPending,
  },

  /**
   * Avanca sequencia para proximo step apos envio
   * @returns Status da operacao (advanced, completed, ou step_failed)
   */
  advance_sequence_step: {
    type: 'scalar' as const,
    params: {} as {
      p_user_sequence_id: string;
      p_success?: boolean;
      p_metadata?: Record<string, unknown>;
    },
    returns: {} as AdvanceStepResult,
  },

  /**
   * Cancela sequencia de um usuario
   * @returns TRUE se cancelou, FALSE se nao encontrou
   */
  cancel_user_sequence: {
    type: 'scalar' as const,
    params: {} as {
      p_user_sequence_id: string;
      p_reason?: string;
      p_metadata?: Record<string, unknown>;
    },
    returns: {} as boolean,
  },

  /**
   * Verifica e cancela sequencias que atingiram cancel_condition
   * @returns Numero de sequencias canceladas
   */
  check_sequence_cancel_conditions: {
    type: 'scalar' as const,
    params: {} as Record<string, never>,
    returns: {} as number,
  },

  /**
   * Busca analytics de uma sequencia
   * @returns Metricas agregadas (totals, conversion_rate, step_completion)
   */
  get_sequence_analytics: {
    type: 'scalar' as const,
    params: {} as {
      p_sequence_id: string;
      p_start_date?: string;
      p_end_date?: string;
    },
    returns: {} as SequenceAnalytics,
  },

  /**
   * Processa clique de botao em sequencia de forma atomica
   * - Registra evento button_clicked
   * - Cancela a sequencia
   * - Usa FOR UPDATE SKIP LOCKED para evitar duplicacao
   * @returns TRUE se foi o primeiro clique (deve processar), FALSE se ja processado
   */
  handle_sequence_button_click: {
    type: 'scalar' as const,
    params: {} as {
      p_user_number: string;
      p_sequence_name: string;
      p_button_id: string;
      p_cancel_reason?: string;
    },
    returns: {} as boolean,
  },

  // ═══════════════════════════════════════════════════════════════
  // CAMPAIGN FUNCTIONS (Unified Campaigns System)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Inscreve usuario em uma campanha
   * @returns UUID do user_campaign criado, ou NULL se nao inscreveu
   */
  enroll_user_in_campaign: {
    type: 'scalar' as const,
    params: {} as {
      p_user_id: string;
      p_campaign_name: string;
      p_metadata?: Record<string, unknown>;
    },
    returns: {} as string | null,
  },

  /**
   * Busca mensagens de campanha prontas para envio
   * @returns Array de mensagens pendentes com dados do usuario e conteudo
   */
  get_pending_campaign_messages: {
    type: 'table' as const,
    params: {} as { p_limit?: number },
    returns: {} as CampaignPendingMessage,
  },

  /**
   * Avanca campanha para proximo step apos envio
   * @returns Status da operacao: 'advanced', 'completed', 'failed', 'not_found'
   */
  advance_campaign_step: {
    type: 'scalar' as const,
    params: {} as {
      p_user_campaign_id: string;
      p_success?: boolean;
      p_metadata?: Record<string, unknown>;
    },
    returns: {} as string,
  },

  /**
   * Processa clique de botao em campanha de forma atomica
   * - Registra evento button_clicked
   * - Cancela a campanha se p_should_cancel = true
   * - Usa FOR UPDATE SKIP LOCKED para evitar duplicacao
   * @returns TRUE se foi o primeiro clique (deve processar), FALSE se ja processado
   */
  handle_campaign_button_click: {
    type: 'scalar' as const,
    params: {} as {
      p_user_number: string;
      p_campaign_name: string;
      p_button_id: string;
      p_should_cancel?: boolean;
    },
    returns: {} as boolean,
  },

  /**
   * Verifica e cancela campanhas que atingiram cancel_condition
   * @returns Numero de campanhas canceladas
   */
  check_campaign_cancel_conditions: {
    type: 'scalar' as const,
    params: {} as Record<string, never>,
    returns: {} as number,
  },

  /**
   * Busca analytics completos de uma campanha
   * @returns JSONB com totais, por variante, por step e funil
   */
  get_campaign_analytics: {
    type: 'scalar' as const,
    params: {} as {
      p_campaign_name: string;
      p_start_date?: string;
      p_end_date?: string;
    },
    returns: {} as CampaignAnalytics,
  },

  /**
   * Reverte user_campaigns travados em 'processing'
   * Usado para recovery de workers que crasharam
   * @returns Numero de campanhas revertidas
   */
  revert_stuck_campaign_processing: {
    type: 'scalar' as const,
    params: {} as { p_older_than_minutes?: number },
    returns: {} as number,
  },
} as const;

// ============================================
// TYPE INFERENCE HELPERS
// ============================================

/**
 * Nomes de todas as funcoes RPC disponiveis
 * @example 'increment_daily_count' | 'check_and_increment_daily_limit_atomic' | ...
 */
export type RpcName = keyof typeof RPC_REGISTRY;

/**
 * Tipo dos parametros de uma funcao RPC
 * @example RpcParams<'increment_daily_count'> = { p_user_id: string }
 */
export type RpcParams<T extends RpcName> = (typeof RPC_REGISTRY)[T]['params'];

/**
 * Tipo do retorno de uma funcao RPC
 * @example RpcReturn<'increment_daily_count'> = number
 */
export type RpcReturn<T extends RpcName> = (typeof RPC_REGISTRY)[T]['returns'];

/**
 * Tipo de retorno (scalar, table, void)
 */
export type RpcType<T extends RpcName> = (typeof RPC_REGISTRY)[T]['type'];

/**
 * Funcoes que retornam SCALAR
 */
export type ScalarRpcName = {
  [K in RpcName]: (typeof RPC_REGISTRY)[K]['type'] extends 'scalar' ? K : never;
}[RpcName];

/**
 * Funcoes que retornam TABLE
 */
export type TableRpcName = {
  [K in RpcName]: (typeof RPC_REGISTRY)[K]['type'] extends 'table' ? K : never;
}[RpcName];

/**
 * Funcoes que retornam VOID
 */
export type VoidRpcName = {
  [K in RpcName]: (typeof RPC_REGISTRY)[K]['type'] extends 'void' ? K : never;
}[RpcName];
