/**
 * 🔌 RPC CLIENT
 *
 * Cliente type-safe para chamadas RPC do Supabase.
 * Usa o RPC_REGISTRY para inferencia automatica de tipos.
 *
 * @example
 * // TypeScript infere automaticamente os tipos!
 * const count = await rpc('increment_daily_count', { p_user_id: userId });
 * // count: number
 *
 * const result = await rpc('check_and_increment_daily_limit_atomic', {
 *   p_user_id: userId
 * });
 * // result: AtomicLimitCheckResult
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import {
  RPC_REGISTRY,
  type RpcName,
  type RpcParams,
  type RpcReturn,
  type ScalarRpcName,
  type TableRpcName,
  type VoidRpcName,
} from './registry.js';
import { RpcError, RpcTypeError, RpcEmptyError, RpcSupabaseError } from './errors.js';
import type { RpcCallOptions } from './types.js';

// ============================================
// MAIN RPC FUNCTION
// ============================================

/**
 * Chama funcao RPC com type safety completo.
 *
 * O tipo de retorno eh inferido automaticamente do RPC_REGISTRY:
 * - SCALAR: retorna valor direto (number, boolean, string)
 * - TABLE: retorna primeira row por padrao, ou array com returnFirst: false
 * - VOID: retorna void
 *
 * @example
 * // Scalar - retorna number
 * const count = await rpc('increment_daily_count', { p_user_id: userId });
 *
 * @example
 * // Table - retorna primeira row
 * const result = await rpc('check_and_increment_daily_limit_atomic', {
 *   p_user_id: userId
 * });
 *
 * @example
 * // Table - retorna array completo
 * const metrics = await rpc('get_experiment_metrics', {
 *   p_experiment_id: expId
 * }, { returnFirst: false });
 *
 * @example
 * // Void - sem retorno
 * await rpc('log_experiment_event', {
 *   p_user_id: userId,
 *   p_experiment_id: expId,
 *   p_variant: 'control',
 *   p_event_type: 'menu_shown'
 * });
 */

// Overload para SCALAR
export async function rpc<T extends ScalarRpcName>(
  name: T,
  params: RpcParams<T>,
  options?: RpcCallOptions
): Promise<RpcReturn<T>>;

// Overload para TABLE com returnFirst: true (default)
export async function rpc<T extends TableRpcName>(
  name: T,
  params: RpcParams<T>,
  options?: RpcCallOptions & { returnFirst?: true }
): Promise<RpcReturn<T>>;

// Overload para TABLE com returnFirst: false
export async function rpc<T extends TableRpcName>(
  name: T,
  params: RpcParams<T>,
  options: RpcCallOptions & { returnFirst: false }
): Promise<RpcReturn<T>[]>;

// Overload para VOID
export async function rpc<T extends VoidRpcName>(
  name: T,
  params: RpcParams<T>,
  options?: RpcCallOptions
): Promise<void>;

// Implementacao
export async function rpc<T extends RpcName>(
  name: T,
  params: RpcParams<T>,
  options: RpcCallOptions = {}
): Promise<RpcReturn<T> | RpcReturn<T>[] | void> {
  const config = RPC_REGISTRY[name];
  const { returnFirst = true, logParams = true, allowEmpty = false } = options;
  const rpcType = config.type;

  try {
    // Log da chamada
    logger.debug({
      msg: `[RPC:${rpcType.toUpperCase()}] Calling ${name}`,
      rpcName: name,
      rpcType,
      ...(logParams && { params }),
    });

    // Chama Supabase
    const { data, error } = await supabase.rpc(name, params as Record<string, unknown>);

    // Trata erro do Supabase
    if (error) {
      logger.error({
        msg: `[RPC:${rpcType.toUpperCase()}] Supabase error`,
        rpcName: name,
        error: error.message,
        code: error.code,
      });
      throw new RpcSupabaseError(name, error);
    }

    // ─────────────────────────────────────────────────────────────
    // SCALAR: retorna valor direto
    // ─────────────────────────────────────────────────────────────
    if (rpcType === 'scalar') {
      if (data === null || data === undefined) {
        if (!allowEmpty) {
          logger.error({
            msg: `[RPC:SCALAR] Unexpected null/undefined`,
            rpcName: name,
          });
          throw new RpcEmptyError(name);
        }
      }

      logger.debug({
        msg: `[RPC:SCALAR] Success`,
        rpcName: name,
        result: data,
      });

      return data as RpcReturn<T>;
    }

    // ─────────────────────────────────────────────────────────────
    // TABLE: retorna array (ou primeira row)
    // ─────────────────────────────────────────────────────────────
    if (rpcType === 'table') {
      // Valida que eh array
      if (!Array.isArray(data)) {
        logger.error({
          msg: `[RPC:TABLE] Expected array but got ${typeof data}`,
          rpcName: name,
          actualType: typeof data,
        });
        throw new RpcTypeError(name, 'array', typeof data);
      }

      // Trata array vazio
      if (data.length === 0) {
        if (!allowEmpty) {
          logger.warn({
            msg: `[RPC:TABLE] Empty array returned`,
            rpcName: name,
          });
        }
        return returnFirst ? (null as unknown as RpcReturn<T>) : ([] as RpcReturn<T>[]);
      }

      logger.debug({
        msg: `[RPC:TABLE] Success`,
        rpcName: name,
        rowCount: data.length,
        returnFirst,
      });

      return returnFirst ? (data[0] as RpcReturn<T>) : (data as RpcReturn<T>[]);
    }

    // ─────────────────────────────────────────────────────────────
    // VOID: sem retorno
    // ─────────────────────────────────────────────────────────────
    if (rpcType === 'void') {
      logger.debug({
        msg: `[RPC:VOID] Success`,
        rpcName: name,
      });
      return;
    }

    // Nunca deve chegar aqui
    throw new RpcError(name, `Unknown RPC type: ${rpcType}`, 'UNKNOWN_TYPE');
  } catch (error) {
    // Re-throw RPC errors
    if (error instanceof RpcError) {
      throw error;
    }

    // Wrap outros erros
    logger.error({
      msg: `[RPC:${rpcType.toUpperCase()}] Unexpected error`,
      rpcName: name,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new RpcError(
      name,
      error instanceof Error ? error.message : 'Unknown error',
      'UNEXPECTED'
    );
  }
}

// ============================================
// CONVENIENCE WRAPPERS (optional, for common operations)
// ============================================

/**
 * Wrapper para funcoes que podem retornar null sem erro
 * Util para buscas opcionais
 */
export async function rpcOptional<T extends TableRpcName>(
  name: T,
  params: RpcParams<T>
): Promise<RpcReturn<T> | null> {
  return rpc(name, params, { allowEmpty: true, returnFirst: true });
}

/**
 * Wrapper para funcoes que retornam array completo
 * Util para listagens
 */
export async function rpcAll<T extends TableRpcName>(
  name: T,
  params: RpcParams<T>
): Promise<RpcReturn<T>[]> {
  return rpc(name, params, { returnFirst: false, allowEmpty: true });
}
