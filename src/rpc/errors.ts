/**
 * 🚨 RPC ERRORS
 *
 * Classes de erro padronizadas para chamadas RPC.
 * Facilita debugging e tratamento de erros.
 */

/**
 * Erro base para chamadas RPC
 */
export class RpcError extends Error {
  public readonly rpcName: string;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(rpcName: string, message: string, code?: string, details?: unknown) {
    super(`[RPC:${rpcName}] ${message}`);
    this.name = 'RpcError';
    this.rpcName = rpcName;
    this.code = code;
    this.details = details;

    // Mantém stack trace correto
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RpcError);
    }
  }
}

/**
 * Erro quando o tipo de retorno não é o esperado
 * Ex: esperava array mas recebeu object
 */
export class RpcTypeError extends RpcError {
  public readonly expectedType: string;
  public readonly actualType: string;

  constructor(rpcName: string, expectedType: string, actualType: string) {
    super(rpcName, `Expected ${expectedType} but got ${actualType}`, 'TYPE_MISMATCH');
    this.name = 'RpcTypeError';
    this.expectedType = expectedType;
    this.actualType = actualType;
  }
}

/**
 * Erro quando RPC retorna null/undefined inesperadamente
 */
export class RpcEmptyError extends RpcError {
  constructor(rpcName: string) {
    super(rpcName, 'Returned null or undefined', 'EMPTY_RESULT');
    this.name = 'RpcEmptyError';
  }
}

/**
 * Erro quando RPC retorna array vazio
 */
export class RpcEmptyArrayError extends RpcError {
  constructor(rpcName: string) {
    super(rpcName, 'Returned empty array', 'EMPTY_ARRAY');
    this.name = 'RpcEmptyArrayError';
  }
}

/**
 * Erro do Supabase (wrapper sobre PostgrestError)
 */
export class RpcSupabaseError extends RpcError {
  public readonly httpStatus?: number;

  constructor(
    rpcName: string,
    supabaseError: { message: string; code?: string; details?: string }
  ) {
    super(rpcName, supabaseError.message, supabaseError.code, supabaseError.details);
    this.name = 'RpcSupabaseError';
  }
}

/**
 * Erro quando funcao RPC nao existe no registry
 */
export class RpcNotFoundError extends RpcError {
  constructor(rpcName: string) {
    super(
      rpcName,
      `Function not found in RPC_REGISTRY. Did you forget to add it?`,
      'NOT_IN_REGISTRY'
    );
    this.name = 'RpcNotFoundError';
  }
}
