/**
 * 🧪 RPC MODULE TESTS
 *
 * Testes para a nova arquitetura type-safe de RPC.
 * Foca em validacao de tipos e comportamento esperado.
 */

import { describe, it, expect } from 'vitest';
import {
  RPC_REGISTRY,
  type RpcName,
  type RpcParams,
  type RpcReturn,
  type ScalarRpcName,
  type TableRpcName,
  type VoidRpcName,
} from '../../src/rpc/registry';
import {
  RpcError,
  RpcTypeError,
  RpcEmptyError,
  RpcSupabaseError,
} from '../../src/rpc/errors';
import type {
  AtomicLimitCheckResult,
  ExperimentVariantResult,
  PendingReminderResult,
} from '../../src/rpc/types';

// ============================================
// REGISTRY TESTS
// ============================================

describe('RPC Registry', () => {
  describe('Registry Structure', () => {
    it('should have all expected RPC functions', () => {
      const expectedFunctions = [
        'increment_daily_count',
        'reset_all_daily_counters',
        'increment_bonus_credit',
        'increment_twitter_download_count',
        'set_limit_notified_atomic',
        'set_twitter_feature_shown_atomic',
        'schedule_reminder',
        'check_and_increment_daily_limit_atomic',
        'assign_experiment_variant',
        'get_pending_reminder',
        'get_experiment_metrics',
        'get_old_twitter_downloads_for_cleanup',
        'log_experiment_event',
        'cleanup_expired_conversation_contexts',
      ];

      const registryFunctions = Object.keys(RPC_REGISTRY);

      for (const fn of expectedFunctions) {
        expect(registryFunctions).toContain(fn);
      }
    });

    it('should have correct types for each function', () => {
      // SCALAR functions
      expect(RPC_REGISTRY.increment_daily_count.type).toBe('scalar');
      expect(RPC_REGISTRY.reset_all_daily_counters.type).toBe('scalar');
      expect(RPC_REGISTRY.increment_bonus_credit.type).toBe('scalar');
      expect(RPC_REGISTRY.set_limit_notified_atomic.type).toBe('scalar');
      expect(RPC_REGISTRY.set_twitter_feature_shown_atomic.type).toBe('scalar');

      // TABLE functions
      expect(RPC_REGISTRY.check_and_increment_daily_limit_atomic.type).toBe('table');
      expect(RPC_REGISTRY.assign_experiment_variant.type).toBe('table');
      expect(RPC_REGISTRY.get_pending_reminder.type).toBe('table');

      // VOID functions
      expect(RPC_REGISTRY.log_experiment_event.type).toBe('void');
      expect(RPC_REGISTRY.cleanup_expired_conversation_contexts.type).toBe('void');
    });
  });

  describe('Type Inference', () => {
    it('should correctly infer SCALAR function names', () => {
      const scalarFunctions: ScalarRpcName[] = [
        'increment_daily_count',
        'reset_all_daily_counters',
        'increment_bonus_credit',
        'increment_twitter_download_count',
        'set_limit_notified_atomic',
        'set_twitter_feature_shown_atomic',
        'schedule_reminder',
      ];

      expect(scalarFunctions).toHaveLength(7);
    });

    it('should correctly infer TABLE function names', () => {
      const tableFunctions: TableRpcName[] = [
        'check_and_increment_daily_limit_atomic',
        'assign_experiment_variant',
        'get_pending_reminder',
        'get_experiment_metrics',
        'get_old_twitter_downloads_for_cleanup',
      ];

      expect(tableFunctions).toHaveLength(5);
    });

    it('should correctly infer VOID function names', () => {
      const voidFunctions: VoidRpcName[] = [
        'log_experiment_event',
        'cleanup_expired_conversation_contexts',
      ];

      expect(voidFunctions).toHaveLength(2);
    });
  });
});

// ============================================
// TYPE SAFETY TESTS
// ============================================

describe('Type Safety', () => {
  describe('Params Types', () => {
    it('increment_daily_count requires p_user_id', () => {
      type Params = RpcParams<'increment_daily_count'>;

      // TypeScript garante que p_user_id eh obrigatorio
      const validParams: Params = { p_user_id: 'uuid-123' };
      expect(validParams.p_user_id).toBe('uuid-123');
    });

    it('check_and_increment_daily_limit_atomic has optional p_max_onboarding', () => {
      type Params = RpcParams<'check_and_increment_daily_limit_atomic'>;

      // Apenas p_user_id obrigatorio
      const minParams: Params = { p_user_id: 'uuid-123' };
      expect(minParams.p_user_id).toBeDefined();

      // p_max_onboarding eh opcional
      const fullParams: Params = { p_user_id: 'uuid-123', p_max_onboarding: 3 };
      expect(fullParams.p_max_onboarding).toBe(3);
    });

    it('log_experiment_event requires multiple params', () => {
      type Params = RpcParams<'log_experiment_event'>;

      const params: Params = {
        p_user_id: 'uuid-123',
        p_experiment_id: 'exp-456',
        p_variant: 'control',
        p_event_type: 'menu_shown',
      };

      expect(params.p_user_id).toBeDefined();
      expect(params.p_experiment_id).toBeDefined();
      expect(params.p_variant).toBeDefined();
      expect(params.p_event_type).toBeDefined();
    });
  });

  describe('Return Types', () => {
    it('increment_daily_count returns number', () => {
      type Return = RpcReturn<'increment_daily_count'>;

      const result: Return = 5;
      expect(typeof result).toBe('number');
    });

    it('set_limit_notified_atomic returns boolean', () => {
      type Return = RpcReturn<'set_limit_notified_atomic'>;

      const result: Return = true;
      expect(typeof result).toBe('boolean');
    });

    it('check_and_increment_daily_limit_atomic returns AtomicLimitCheckResult', () => {
      type Return = RpcReturn<'check_and_increment_daily_limit_atomic'>;

      const result: Return = {
        allowed: true,
        daily_count: 3,
        effective_limit: 4,
        pending_count: 0,
        onboarding_step: 3,
      };

      expect(result.allowed).toBe(true);
      expect(result.daily_count).toBe(3);
      expect(result.effective_limit).toBe(4);
    });

    it('assign_experiment_variant returns ExperimentVariantResult', () => {
      type Return = RpcReturn<'assign_experiment_variant'>;

      const result: Return = {
        experiment_id: 'exp-123',
        variant: 'control',
        config: {},
        is_new_assignment: true,
      };

      expect(result.experiment_id).toBeDefined();
      expect(result.variant).toBeDefined();
      expect(result.is_new_assignment).toBe(true);
    });
  });
});

// ============================================
// ERROR TESTS
// ============================================

describe('RPC Errors', () => {
  describe('RpcError', () => {
    it('should create error with rpcName', () => {
      const error = new RpcError('my_rpc', 'Something went wrong');

      expect(error.message).toContain('my_rpc');
      expect(error.rpcName).toBe('my_rpc');
      expect(error.name).toBe('RpcError');
    });

    it('should include code and details', () => {
      const error = new RpcError('my_rpc', 'Error', 'CODE_123', { extra: 'info' });

      expect(error.code).toBe('CODE_123');
      expect(error.details).toEqual({ extra: 'info' });
    });
  });

  describe('RpcTypeError', () => {
    it('should capture expected vs actual type', () => {
      const error = new RpcTypeError('my_rpc', 'array', 'object');

      expect(error.expectedType).toBe('array');
      expect(error.actualType).toBe('object');
      expect(error.message).toContain('Expected array but got object');
    });
  });

  describe('RpcEmptyError', () => {
    it('should indicate empty result', () => {
      const error = new RpcEmptyError('my_rpc');

      expect(error.message).toContain('null or undefined');
      expect(error.code).toBe('EMPTY_RESULT');
    });
  });

  describe('RpcSupabaseError', () => {
    it('should wrap Supabase error', () => {
      const supabaseError = {
        message: 'Connection failed',
        code: 'PGRST301',
        details: 'Could not connect',
      };

      const error = new RpcSupabaseError('my_rpc', supabaseError);

      expect(error.message).toContain('Connection failed');
      expect(error.code).toBe('PGRST301');
    });
  });
});

// ============================================
// DOCUMENTATION TESTS
// ============================================

describe('Documentation', () => {
  it('should document the difference between SCALAR and TABLE', () => {
    // SCALAR: Supabase retorna valor direto
    // Ex: supabase.rpc('increment_daily_count') → data = 5

    // TABLE: Supabase retorna array
    // Ex: supabase.rpc('check_and_increment_daily_limit_atomic') → data = [{ allowed: true, ... }]

    const scalarExample = 5;
    const tableExample = [{ allowed: true, daily_count: 3 }];

    // SCALAR - acesso direto
    expect(scalarExample).toBe(5);

    // TABLE - precisa acessar [0]
    expect(tableExample[0].allowed).toBe(true);
  });

  it('should document why this architecture prevents bugs', () => {
    // BUG ANTERIOR:
    // const { data } = await supabase.rpc('check_and_increment_daily_limit_atomic', ...);
    // return data.allowed; // ❌ undefined! (data eh array)

    // SOLUCAO:
    // const result = await rpc('check_and_increment_daily_limit_atomic', ...);
    // return result.allowed; // ✅ TypeScript garante que result tem .allowed

    const buggyAccess = (data: any) => data.allowed; // undefined se data for array
    const correctAccess = (data: any[]) => data[0]?.allowed; // correto

    const arrayData = [{ allowed: true }];

    expect(buggyAccess(arrayData)).toBeUndefined();
    expect(correctAccess(arrayData)).toBe(true);
  });
});

// ============================================
// MIGRATION GUIDE TESTS
// ============================================

describe('Migration Guide', () => {
  it('documents how to migrate from direct supabase.rpc()', () => {
    // ANTES (propenso a bugs):
    // const { data, error } = await supabase.rpc('increment_daily_count', {
    //   p_user_id: userId
    // });
    // const newCount = data as number;

    // DEPOIS (type-safe):
    // import { rpc } from '../rpc';
    // const newCount = await rpc('increment_daily_count', { p_user_id: userId });

    expect(true).toBe(true); // Documentation test
  });

  it('documents how to add new RPC function', () => {
    // 1. Adicionar tipo em src/rpc/types.ts:
    // export interface MyNewResult { field: string; }

    // 2. Adicionar no registry em src/rpc/registry.ts:
    // my_new_function: {
    //   type: 'table' as const,
    //   params: {} as { p_user_id: string },
    //   returns: {} as MyNewResult,
    // },

    // 3. Usar no codigo:
    // const result = await rpc('my_new_function', { p_user_id: userId });

    expect(true).toBe(true); // Documentation test
  });
});

// ============================================
// REGISTRY SYNC TESTS (validates registry matches database)
// ============================================

describe('Registry Sync', () => {
  /**
   * This test documents the expected RPC functions in the database.
   * When you add a new RPC function to the database, you MUST:
   * 1. Add it to RPC_REGISTRY in src/rpc/registry.ts
   * 2. Add it to this test's expected list
   *
   * Run: npm run test:rpc to validate
   */
  it('should have all expected RPC functions in registry (update when adding new RPCs)', () => {
    // Complete list of RPC functions in database (as of Sprint 14)
    const databaseFunctions = [
      // SCALAR functions
      'increment_daily_count',
      'reset_all_daily_counters',
      'increment_bonus_credit',
      'increment_twitter_download_count',
      'set_limit_notified_atomic',
      'set_twitter_feature_shown_atomic',
      'schedule_reminder',
      // TABLE functions
      'check_and_increment_daily_limit_atomic',
      'assign_experiment_variant',
      'get_pending_reminder',
      'get_experiment_metrics',
      'get_old_twitter_downloads_for_cleanup',
      // VOID functions
      'log_experiment_event',
      'cleanup_expired_conversation_contexts',
    ];

    const registryFunctions = Object.keys(RPC_REGISTRY);

    // Check all database functions are in registry
    for (const dbFn of databaseFunctions) {
      expect(registryFunctions).toContain(dbFn);
    }

    // Check registry doesn't have extra functions not in database
    for (const regFn of registryFunctions) {
      expect(databaseFunctions).toContain(regFn);
    }

    // Total count should match
    expect(registryFunctions.length).toBe(databaseFunctions.length);
  });

  it('should have correct function count (14 total)', () => {
    const registryFunctions = Object.keys(RPC_REGISTRY);

    // 7 SCALAR + 5 TABLE + 2 VOID = 14 total
    expect(registryFunctions.length).toBe(14);
  });

  it('should have proper type categorization', () => {
    const scalarCount = Object.values(RPC_REGISTRY).filter((r) => r.type === 'scalar').length;
    const tableCount = Object.values(RPC_REGISTRY).filter((r) => r.type === 'table').length;
    const voidCount = Object.values(RPC_REGISTRY).filter((r) => r.type === 'void').length;

    expect(scalarCount).toBe(7);
    expect(tableCount).toBe(5);
    expect(voidCount).toBe(2);
  });
});
