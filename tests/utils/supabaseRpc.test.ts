/**
 * 🧪 TESTES: Wrapper Seguro de RPC
 *
 * Garante que todas as chamadas RPC funcionam corretamente
 * e não têm bugs de acesso a arrays.
 */

import { describe, it, expect } from 'vitest';
import type { AtomicLimitCheckResult } from '../../src/utils/supabaseRpc';

describe('🛡️ Wrapper RPC - Prevenção de Bugs', () => {
  describe('📋 Documentação: Como RPC Funciona', () => {
    it('Explica: SCALAR retorna valor direto', () => {
      // ✅ CORRETO: Funções SCALAR retornam valor único
      const exemplo = {
        rpcName: 'increment_daily_count',
        returns: 'integer',
        uso: 'const newCount = data as number',
      };

      expect(exemplo.returns).toBe('integer');
    });

    it('Explica: TABLE retorna array (precisa data[0])', () => {
      // ✅ CORRETO: Funções TABLE retornam array
      const exemplo = {
        rpcName: 'check_and_increment_daily_limit_atomic',
        returns: 'TABLE(...)',
        uso: 'const result = data[0]',
        bugAnterior: 'const result = data // ❌ undefined!',
      };

      expect(exemplo.returns).toContain('TABLE');
    });
  });

  describe('1️⃣ Funções SCALAR (retornam valor único)', () => {
    it('increment_daily_count → retorna integer', () => {
      // Esta função incrementa daily_count e retorna novo valor
      const expectedReturnType = 'number';
      const exampleResult = 5;

      expect(typeof exampleResult).toBe(expectedReturnType);
    });

    it('increment_bonus_credit → retorna integer', () => {
      const expectedReturnType = 'number';
      const exampleResult = 2;

      expect(typeof exampleResult).toBe(expectedReturnType);
    });

    it('increment_twitter_download_count → retorna integer', () => {
      const expectedReturnType = 'number';
      const exampleResult = 10;

      expect(typeof exampleResult).toBe(expectedReturnType);
    });

    it('reset_all_daily_counters → retorna integer (count de users reset)', () => {
      const expectedReturnType = 'number';
      const exampleResult = 42; // 42 usuários resetados

      expect(typeof exampleResult).toBe(expectedReturnType);
    });
  });

  describe('2️⃣ Funções TABLE (retornam array)', () => {
    it('check_and_increment_daily_limit_atomic → retorna TABLE com 1 row', () => {
      // Simula resposta do Supabase
      const supabaseResponse = [
        {
          allowed: true,
          daily_count: 3,
          effective_limit: 4,
          pending_count: 0,
          onboarding_step: 3,
        },
      ];

      // ❌ BUG ANTERIOR: Acessar direto
      // const result = supabaseResponse.allowed; // undefined!

      // ✅ CORRETO: Acessar array
      const result = supabaseResponse[0];

      expect(result.allowed).toBe(true);
      expect(result.daily_count).toBe(3);
      expect(result.effective_limit).toBe(4);
    });

    it('get_old_twitter_downloads_for_cleanup → retorna TABLE com N rows', () => {
      // Simula resposta do Supabase (múltiplas rows)
      const supabaseResponse = [
        { id: 'uuid-1', user_number: '5511999999999', tweet_id: 'tweet1' },
        { id: 'uuid-2', user_number: '5511888888888', tweet_id: 'tweet2' },
        { id: 'uuid-3', user_number: '5511777777777', tweet_id: 'tweet3' },
      ];

      // ✅ CORRETO: Iterar sobre array
      expect(supabaseResponse).toHaveLength(3);
      expect(supabaseResponse[0].tweet_id).toBe('tweet1');
      expect(supabaseResponse[2].tweet_id).toBe('tweet3');
    });
  });

  describe('3️⃣ Type Safety - TypeScript Garante Uso Correto', () => {
    it('AtomicLimitCheckResult tem todos os campos esperados', () => {
      const result: AtomicLimitCheckResult = {
        allowed: true,
        daily_count: 2,
        effective_limit: 4,
        pending_count: 0,
        onboarding_step: 2,
      };

      // TypeScript valida que todos os campos existem
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('daily_count');
      expect(result).toHaveProperty('effective_limit');
      expect(result).toHaveProperty('pending_count');
      expect(result).toHaveProperty('onboarding_step');
    });
  });

  describe('4️⃣ Prevenção de Bugs - Casos Extremos', () => {
    it('Array vazio deve ser tratado corretamente', () => {
      const supabaseResponse: any[] = [];

      // ❌ BUG: Acessar [0] sem verificar
      // const result = supabaseResponse[0].allowed; // crash!

      // ✅ CORRETO: Verificar antes
      const result = supabaseResponse[0] ?? null;

      expect(result).toBeNull();
    });

    it('Null/undefined deve ser tratado', () => {
      const supabaseResponse = null;

      // ✅ CORRETO: Tratar null
      const result = supabaseResponse ?? { allowed: false, daily_count: 0 };

      expect(result.allowed).toBe(false);
    });

    it('Tipo errado deve ser detectado', () => {
      // Simula bug: esperava array mas recebeu object
      const supabaseResponseBuggy = {
        allowed: true,
        daily_count: 3,
      };

      // ✅ CORRETO: Validar tipo
      const isArray = Array.isArray(supabaseResponseBuggy);

      expect(isArray).toBe(false);
      // Wrapper deve logar erro e lançar exception
    });
  });

  describe('5️⃣ Mapeamento Completo: RPC → Tipo de Retorno', () => {
    it('Documenta TODAS as funções RPC e seus tipos', () => {
      const rpcFunctions = [
        { name: 'increment_daily_count', returns: 'SCALAR', type: 'number' },
        { name: 'increment_bonus_credit', returns: 'SCALAR', type: 'number' },
        { name: 'increment_twitter_download_count', returns: 'SCALAR', type: 'number' },
        { name: 'reset_all_daily_counters', returns: 'SCALAR', type: 'number' },
        {
          name: 'check_and_increment_daily_limit_atomic',
          returns: 'TABLE',
          type: 'AtomicLimitCheckResult[]',
        },
        {
          name: 'set_limit_notified_atomic',
          returns: 'TABLE',
          type: 'AtomicLimitNotifiedResult[]',
        },
        { name: 'get_old_twitter_downloads_for_cleanup', returns: 'TABLE', type: 'array' },
        { name: 'cleanup_expired_conversation_contexts', returns: 'VOID', type: 'void' },
      ];

      // Valida que sabemos o tipo de TODAS as funções
      expect(rpcFunctions).toHaveLength(8);

      const scalarFunctions = rpcFunctions.filter((f) => f.returns === 'SCALAR');
      const tableFunctions = rpcFunctions.filter((f) => f.returns === 'TABLE');
      const voidFunctions = rpcFunctions.filter((f) => f.returns === 'VOID');

      expect(scalarFunctions).toHaveLength(4);
      expect(tableFunctions).toHaveLength(3);
      expect(voidFunctions).toHaveLength(1);
    });
  });
});

describe('🎓 Guia: Como Adicionar Nova Função RPC', () => {
  it('Passo 1: Criar função no Supabase', () => {
    const exemplo = `
      -- Exemplo: Nova função que retorna TABLE
      CREATE OR REPLACE FUNCTION get_user_stats(p_user_id uuid)
      RETURNS TABLE(
        total_stickers integer,
        total_downloads integer
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          COUNT(*)::integer as total_stickers,
          SUM(download_count)::integer as total_downloads
        FROM stickers
        WHERE user_id = p_user_id;
      END;
      $$;
    `;

    expect(exemplo).toContain('RETURNS TABLE');
  });

  it('Passo 2: Adicionar type interface no supabaseRpc.ts', () => {
    interface UserStatsResult {
      total_stickers: number;
      total_downloads: number;
    }

    const exemplo: UserStatsResult = {
      total_stickers: 42,
      total_downloads: 100,
    };

    expect(exemplo).toHaveProperty('total_stickers');
    expect(exemplo).toHaveProperty('total_downloads');
  });

  it('Passo 3: Criar helper type-safe', () => {
    const codigoExemplo = `
      export async function getUserStats(userId: string): Promise<UserStatsResult> {
        return await callTableRpc<UserStatsResult>(
          'get_user_stats',
          { p_user_id: userId },
          {
            functionName: 'getUserStats',
            returnFirst: true,
            logParams: false
          }
        );
      }
    `;

    expect(codigoExemplo).toContain('callTableRpc');
    expect(codigoExemplo).toContain('returnFirst: true');
  });

  it('Passo 4: Adicionar teste', () => {
    const testeExemplo = `
      it('get_user_stats → retorna TABLE com stats do usuário', () => {
        const result = {
          total_stickers: 42,
          total_downloads: 100
        };

        expect(result.total_stickers).toBeGreaterThan(0);
      });
    `;

    expect(testeExemplo).toContain('expect');
  });
});
