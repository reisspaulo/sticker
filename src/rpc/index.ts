/**
 * 🎯 RPC MODULE
 *
 * Modulo centralizado e type-safe para chamadas RPC do Supabase.
 *
 * USO BASICO:
 * ```typescript
 * import { rpc } from '../rpc';
 *
 * // TypeScript infere todos os tipos automaticamente!
 * const count = await rpc('increment_daily_count', { p_user_id: userId });
 * ```
 *
 * BENEFICIOS:
 * - Type safety em compile time (parametros e retorno)
 * - Validacao em runtime (array vs object)
 * - Logging automatico
 * - Tratamento de erros padronizado
 *
 * IMPORTANTE:
 * - NUNCA use supabase.rpc() diretamente
 * - SEMPRE use este modulo para chamadas RPC
 */

// ============================================
// MAIN EXPORTS
// ============================================

// Funcao principal
export { rpc, rpcOptional, rpcAll } from './client.js';

// ============================================
// TYPE EXPORTS
// ============================================

// Tipos de retorno das RPCs
export type {
  AtomicLimitCheckResult,
  ExperimentVariantResult,
  ExperimentVariantConfig,
  PendingReminderResult,
  ExperimentMetricsResult,
  TwitterDownloadForCleanup,
  CampaignHealthResult,
  RpcCallOptions,
} from './types.js';

// Tipos do registry (para uso avancado)
export type {
  RpcName,
  RpcParams,
  RpcReturn,
  RpcType,
  ScalarRpcName,
  TableRpcName,
  VoidRpcName,
} from './registry.js';

// Registry (para introspeccao)
export { RPC_REGISTRY } from './registry.js';

// ============================================
// ERROR EXPORTS
// ============================================

export {
  RpcError,
  RpcTypeError,
  RpcEmptyError,
  RpcEmptyArrayError,
  RpcSupabaseError,
  RpcNotFoundError,
} from './errors.js';
