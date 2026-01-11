/**
 * 🛡️ SAFE RPC WRAPPER
 *
 * Este módulo previne bugs de acesso a arrays em chamadas RPC do Supabase.
 *
 * PROBLEMA:
 * - Funções que retornam TABLE → data é array: data[0]
 * - Funções que retornam SCALAR → data é valor direto
 * - Código confunde os dois → undefined/crashes
 *
 * SOLUÇÃO:
 * - Wrapper que detecta automaticamente o tipo
 * - TypeScript types para garantir uso correto
 * - Validação em runtime
 */

import { supabase } from '../config/supabase.js';
import { logger } from '../config/logger.js';

// ============================================
// TYPES
// ============================================

/**
 * Resultado de RPC que retorna TABLE/SETOF (array)
 */
export interface RpcTableResult<T> {
  data: T[];
  error: any;
}

/**
 * Resultado de RPC que retorna SCALAR (valor único)
 */
export interface RpcScalarResult<T> {
  data: T;
  error: any;
}

/**
 * Opções para chamada RPC
 */
export interface RpcOptions {
  /** Nome da função para logs */
  functionName: string;
  /** Se true, loga parâmetros (use false para dados sensíveis) */
  logParams?: boolean;
  /** Se true, permite retorno vazio sem erro */
  allowEmpty?: boolean;
}

// ============================================
// SCALAR RPC CALLS
// ============================================

/**
 * Chama RPC que retorna um VALOR ÚNICO (integer, boolean, text, etc.)
 *
 * Exemplos:
 * - increment_daily_count → retorna integer
 * - reset_all_daily_counters → retorna integer
 * - increment_bonus_credit → retorna integer
 *
 * @example
 * const newCount = await callScalarRpc<number>('increment_daily_count', {
 *   p_user_id: userId
 * }, { functionName: 'incrementDailyCount' });
 */
export async function callScalarRpc<T = any>(
  rpcName: string,
  params: Record<string, any>,
  options: RpcOptions
): Promise<T> {
  const { functionName, logParams = true, allowEmpty = false } = options;

  try {
    logger.debug({
      msg: `[RPC:SCALAR] Calling ${rpcName}`,
      function: functionName,
      ...(logParams && { params }),
    });

    const { data, error } = await supabase.rpc(rpcName, params);

    if (error) {
      logger.error({
        msg: `[RPC:SCALAR] Error calling ${rpcName}`,
        function: functionName,
        error: error.message,
        code: error.code,
      });
      throw error;
    }

    if (data === null || data === undefined) {
      if (!allowEmpty) {
        const msg = `RPC ${rpcName} returned null/undefined`;
        logger.error({
          msg: `[RPC:SCALAR] ${msg}`,
          function: functionName,
        });
        throw new Error(msg);
      }
    }

    logger.debug({
      msg: `[RPC:SCALAR] Success calling ${rpcName}`,
      function: functionName,
      result: data,
    });

    return data as T;
  } catch (error) {
    logger.error({
      msg: `[RPC:SCALAR] Exception calling ${rpcName}`,
      function: functionName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================
// TABLE RPC CALLS
// ============================================

/**
 * Chama RPC que retorna TABLE/SETOF (array de rows)
 *
 * Exemplos:
 * - check_and_increment_daily_limit_atomic → retorna TABLE
 * - get_old_twitter_downloads_for_cleanup → retorna TABLE
 *
 * @example
 * // Retorna PRIMEIRA ROW (caso comum):
 * const result = await callTableRpc<LimitCheckResult>(
 *   'check_and_increment_daily_limit_atomic',
 *   { p_user_id: userId },
 *   { functionName: 'checkLimit', returnFirst: true }
 * );
 *
 * @example
 * // Retorna TODAS as ROWS:
 * const results = await callTableRpc<TwitterDownload>(
 *   'get_old_twitter_downloads_for_cleanup',
 *   {},
 *   { functionName: 'getOldDownloads', returnFirst: false }
 * );
 */
// Overloads for proper type inference
export async function callTableRpc<T = any>(
  rpcName: string,
  params: Record<string, any>,
  options: RpcOptions & { returnFirst: true }
): Promise<T>;
export async function callTableRpc<T = any>(
  rpcName: string,
  params: Record<string, any>,
  options: RpcOptions & { returnFirst: false }
): Promise<T[]>;
export async function callTableRpc<T = any>(
  rpcName: string,
  params: Record<string, any>,
  options: RpcOptions & { returnFirst?: boolean }
): Promise<T | T[]>;
export async function callTableRpc<T = any>(
  rpcName: string,
  params: Record<string, any>,
  options: RpcOptions & { returnFirst?: boolean }
): Promise<T | T[]> {
  const { functionName, logParams = true, allowEmpty = false, returnFirst = true } = options;

  try {
    logger.debug({
      msg: `[RPC:TABLE] Calling ${rpcName}`,
      function: functionName,
      returnFirst,
      ...(logParams && { params }),
    });

    const { data, error } = await supabase.rpc(rpcName, params);

    if (error) {
      logger.error({
        msg: `[RPC:TABLE] Error calling ${rpcName}`,
        function: functionName,
        error: error.message,
        code: error.code,
      });
      throw error;
    }

    // Valida que é array
    if (!Array.isArray(data)) {
      const msg = `RPC ${rpcName} expected to return array but got: ${typeof data}`;
      logger.error({
        msg: `[RPC:TABLE] ${msg}`,
        function: functionName,
        dataType: typeof data,
      });
      throw new Error(msg);
    }

    // Valida se tem dados
    if (data.length === 0) {
      if (!allowEmpty) {
        const msg = `RPC ${rpcName} returned empty array`;
        logger.warn({
          msg: `[RPC:TABLE] ${msg}`,
          function: functionName,
        });
      }
      return returnFirst ? (null as any) : [];
    }

    logger.debug({
      msg: `[RPC:TABLE] Success calling ${rpcName}`,
      function: functionName,
      rowCount: data.length,
      returnFirst,
    });

    // Retorna primeira row ou array completo
    return returnFirst ? data[0] : data;
  } catch (error) {
    logger.error({
      msg: `[RPC:TABLE] Exception calling ${rpcName}`,
      function: functionName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================
// VOID RPC CALLS
// ============================================

/**
 * Chama RPC que NÃO RETORNA VALOR (void)
 *
 * Exemplos:
 * - cleanup_expired_conversation_contexts → retorna void
 *
 * @example
 * await callVoidRpc('cleanup_expired_conversation_contexts', {}, {
 *   functionName: 'cleanupContexts'
 * });
 */
export async function callVoidRpc(
  rpcName: string,
  params: Record<string, any>,
  options: RpcOptions
): Promise<void> {
  const { functionName, logParams = true } = options;

  try {
    logger.debug({
      msg: `[RPC:VOID] Calling ${rpcName}`,
      function: functionName,
      ...(logParams && { params }),
    });

    const { error } = await supabase.rpc(rpcName, params);

    if (error) {
      logger.error({
        msg: `[RPC:VOID] Error calling ${rpcName}`,
        function: functionName,
        error: error.message,
        code: error.code,
      });
      throw error;
    }

    logger.debug({
      msg: `[RPC:VOID] Success calling ${rpcName}`,
      function: functionName,
    });
  } catch (error) {
    logger.error({
      msg: `[RPC:VOID] Exception calling ${rpcName}`,
      function: functionName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================
// TYPE-SAFE HELPERS (SPECIFIC FUNCTIONS)
// ============================================

/**
 * Resultado da função check_and_increment_daily_limit_atomic
 */
export interface AtomicLimitCheckResult {
  allowed: boolean;
  daily_count: number;
  effective_limit: number;
  pending_count: number;
  onboarding_step: number;
}

/**
 * Resultado da função set_limit_notified_atomic
 */
export interface AtomicLimitNotifiedResult {
  was_already_notified: boolean;
}

/**
 * ✅ Type-safe call para check_and_increment_daily_limit_atomic
 */
export async function checkAndIncrementLimitAtomic(
  userId: string,
  maxOnboarding: number = 3
): Promise<AtomicLimitCheckResult> {
  return await callTableRpc<AtomicLimitCheckResult>(
    'check_and_increment_daily_limit_atomic',
    {
      p_user_id: userId,
      p_max_onboarding: maxOnboarding,
    },
    {
      functionName: 'checkAndIncrementLimitAtomic',
      returnFirst: true,
      logParams: false, // userId é sensível
    }
  );
}

/**
 * ✅ Type-safe call para set_limit_notified_atomic
 * Retorna boolean indicando se já foi notificado hoje
 */
export async function setLimitNotifiedAtomic(userId: string): Promise<boolean> {
  // RPC returns object with OUT parameter: { was_already_notified: boolean }
  // NOT a direct boolean, despite RETURNS boolean in SQL
  const result = await callScalarRpc<{ was_already_notified: boolean }>(
    'set_limit_notified_atomic',
    {
      p_user_id: userId,
    },
    {
      functionName: 'setLimitNotifiedAtomic',
      logParams: false,
    }
  );

  // Extract the boolean from the OUT parameter object
  return result.was_already_notified;
}

/**
 * ✅ Type-safe call para increment_daily_count
 */
export async function incrementDailyCountRpc(userId: string): Promise<number> {
  return await callScalarRpc<number>(
    'increment_daily_count',
    {
      p_user_id: userId,
    },
    {
      functionName: 'incrementDailyCount',
      logParams: false,
    }
  );
}

/**
 * ✅ Type-safe call para increment_bonus_credit
 */
export async function incrementBonusCreditRpc(userId: string): Promise<number> {
  return await callScalarRpc<number>(
    'increment_bonus_credit',
    {
      p_user_id: userId,
    },
    {
      functionName: 'incrementBonusCredit',
      logParams: false,
    }
  );
}

/**
 * ✅ Type-safe call para increment_twitter_download_count
 */
export async function incrementTwitterDownloadCountRpc(userId: string): Promise<number> {
  return await callScalarRpc<number>(
    'increment_twitter_download_count',
    {
      p_user_id: userId,
    },
    {
      functionName: 'incrementTwitterDownloadCount',
      logParams: false,
    }
  );
}

/**
 * ✅ Type-safe call para reset_all_daily_counters
 */
export async function resetAllDailyCountersRpc(): Promise<number> {
  return await callScalarRpc<number>(
    'reset_all_daily_counters',
    {},
    {
      functionName: 'resetAllDailyCounters',
    }
  );
}
