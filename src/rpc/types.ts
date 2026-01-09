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
