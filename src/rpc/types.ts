/**
 * 🎯 RPC TYPES
 *
 * Tipos TypeScript para todas as funcoes RPC do Supabase.
 * Single source of truth - todas as interfaces ficam aqui.
 */

// ============================================
// LIMIT FUNCTIONS
// ============================================

/**
 * Resultado de check_and_increment_daily_limit_atomic
 * Retorna status do limite diario do usuario
 */
export interface AtomicLimitCheckResult {
  allowed: boolean;
  daily_count: number;
  effective_limit: number;
  pending_count: number;
  onboarding_step: number;
}

// ============================================
// EXPERIMENT FUNCTIONS
// ============================================

/**
 * Config da variante do experimento
 */
export interface ExperimentVariantConfig {
  // Legacy button config (for backwards compatibility)
  button_text?: string;
  button_id?: string;
  action?: 'dismiss' | 'schedule_reminder';
  delay_hours?: number;
  show_button?: boolean;

  // Message config
  message_title?: string;
  message_body?: string;

  // Button customization
  button_dismiss_text?: string;
  button_dismiss_id?: string;
  button_premium_text?: string;
  button_ultra_text?: string;
  show_dismiss_button?: boolean;
}

/**
 * Resultado de assign_experiment_variant
 */
export interface ExperimentVariantResult {
  experiment_id: string;
  variant: string;
  config: ExperimentVariantConfig;
  is_new_assignment: boolean;
}

/**
 * Resultado de get_pending_reminder
 */
export interface PendingReminderResult {
  id: string;
  scheduled_for: string;
  minutes_remaining: number;
}

/**
 * Resultado de get_experiment_metrics
 */
export interface ExperimentMetricsResult {
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
// TWITTER FUNCTIONS
// ============================================

/**
 * Resultado de get_old_twitter_downloads_for_cleanup
 */
export interface TwitterDownloadForCleanup {
  id: string;
  user_number: string;
  tweet_id: string;
  created_at: string;
}

// ============================================
// SEQUENCE FUNCTIONS
// ============================================

/**
 * Step pendente para processamento
 * Retornado por get_pending_sequence_steps (TABLE)
 */
export interface SequenceStepPending {
  user_sequence_id: string;
  user_id: string;
  user_number: string;
  user_name: string;
  sequence_id: string;
  sequence_name: string;
  sequence_type: string;
  current_step: number;
  step_config: Record<string, unknown>;
  message_key: string;
  cancel_condition: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Resultado de advance_sequence_step
 * Retorna JSONB com status da operação
 */
export interface AdvanceStepResult {
  success: boolean;
  action: 'advanced' | 'completed' | 'step_failed';
  next_step?: number;
  next_scheduled_at?: string;
  total_steps?: number;
  current_step?: number;
  error?: string;
}

/**
 * Analytics de uma sequência
 * Retornado por get_sequence_analytics (JSONB)
 */
export interface SequenceAnalytics {
  sequence_id: string;
  period: {
    start: string;
    end: string;
  };
  totals: {
    enrolled: number;
    active: number;
    completed: number;
    cancelled: number;
    converted: number;
  };
  conversion_rate: number | null;
  step_completion: Array<{
    step: number;
    sent: number;
    completion_rate: number | null;
  }> | null;
  events_by_type: Record<string, number> | null;
}

// ============================================
// CAMPAIGN FUNCTIONS (Unified Campaigns System)
// ============================================

/**
 * Mensagem pendente de campanha
 * Retornado por get_pending_campaign_messages (TABLE)
 */
export interface CampaignPendingMessage {
  user_campaign_id: string;
  user_id: string;
  user_number: string;
  user_name: string;
  campaign_id: string;
  campaign_name: string;
  campaign_type: 'drip' | 'event' | 'hybrid';
  step_order: number;
  step_key: string;
  variant: string;
  content_type: 'text' | 'buttons' | 'sticker' | 'image' | 'video';
  title: string;
  body: string;
  footer: string | null;
  buttons: Array<{ id: string; text: string }> | null;
  media: { type: string; url: string; sticker_id?: string } | null;
  cancel_condition: string | null;
  settings: {
    rate_limit_ms?: number;
    batch_size?: number;
    randomize_minutes?: number;
    send_window_start?: number;
    send_window_end?: number;
  };
  metadata: Record<string, unknown> | null;
}

/**
 * Analytics de uma campanha
 * Retornado por get_campaign_analytics (JSONB)
 */
export interface CampaignAnalytics {
  campaign: string;
  period: {
    start: string;
    end: string;
  };
  totals: {
    enrolled: number;
    completed: number;
    cancelled: number;
    button_clicks: number;
    messages_sent: number;
    messages_failed: number;
  };
  by_variant: Record<
    string,
    {
      enrolled: number;
      button_clicks: number;
      completed: number;
      click_rate: number;
      completion_rate: number;
    }
  >;
  by_step: Record<
    string,
    {
      sent: number;
      failed: number;
      clicks: number;
    }
  >;
  funnel: Array<{
    step: number;
    step_key: string;
    users_reached: number;
    drop_off_rate: number;
  }>;
}

// ============================================
// INSTANT CAMPAIGN FUNCTIONS
// ============================================

/**
 * Resultado de get_instant_campaign_message
 * Retorna mensagem de campanha instant com variante sorteada
 */
export interface InstantCampaignMessageResult {
  campaign_id: string;
  variant: string;
  title: string;
  body: string;
  buttons: Array<{ id: string; text: string }> | null;
  content_type: string;
  is_new_assignment: boolean;
}

// ============================================
// GENERIC TYPES
// ============================================

/**
 * Tipos de retorno RPC
 */
export type RpcReturnType = 'scalar' | 'table' | 'void';

/**
 * Opcoes para chamada RPC
 */
export interface RpcCallOptions {
  /** Se true, retorna primeira row de TABLE (default: true) */
  returnFirst?: boolean;
  /** Se true, loga parametros (default: true, use false para dados sensiveis) */
  logParams?: boolean;
  /** Se true, permite retorno vazio sem erro (default: false) */
  allowEmpty?: boolean;
}
