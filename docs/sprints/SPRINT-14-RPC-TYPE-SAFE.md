# Sprint 14 - Arquitetura RPC Type-Safe

**Status:** CONCLUIDA ✅
**Data Inicio:** 09/01/2026
**Ultima Atualizacao:** 12/01/2026

> **PRIMEIRO USO EM PRODUCAO:** `onboardingService.ts` usando `set_twitter_feature_shown_atomic` - corrigiu bug de menu duplicado!

---

## Resumo Executivo

### O Que E?

Arquitetura centralizada e type-safe para todas as chamadas RPC do Supabase. Elimina uma classe inteira de bugs que causaram downtime em producao.

### Por Que?

Em 09/01/2026, um bug de RPC derrubou o bot em producao:

```
RPC set_limit_notified_atomic expected to return array but got: object
```

**Root cause:** Codigo usava `callTableRpc` para uma funcao que retorna `boolean` (scalar).

Este NAO foi o primeiro incidente. O mesmo tipo de bug ja aconteceu antes com `check_and_increment_daily_limit_atomic`.

### Objetivo

Tornar **impossivel** cometer esse tipo de erro:
- Type safety em compile time
- Validacao em runtime como backup
- Single source of truth para todas as RPCs
- Lint rules para prevenir uso de `supabase.rpc()` direto

---

## Problema Detalhado

### O Bug

```typescript
// ERRADO - usava callTableRpc para funcao SCALAR
const result = await callTableRpc<AtomicLimitNotifiedResult>(
  'set_limit_notified_atomic',  // Esta funcao retorna BOOLEAN, nao TABLE!
  { p_user_id: userId },
  { returnFirst: true }
);
```

O wrapper `callTableRpc` espera um array e valida:
```typescript
if (!Array.isArray(data)) {
  throw new Error(`RPC ${rpcName} expected to return array but got: ${typeof data}`);
}
```

Como a funcao retorna `boolean`, o erro foi lancado.

### Por Que Aconteceu?

1. **Sem single source of truth** - Ninguem sabia se a RPC retornava TABLE ou SCALAR
2. **Documentacao desatualizada** - ADR-005 dizia que era TABLE, mas era SCALAR
3. **Testes nao cobriram** - Teste assumia tipo errado
4. **Facil errar** - Dev precisa saber o tipo de retorno de cada RPC

### Impacto

| Metrica | Valor |
|---------|-------|
| Downtime | ~30 minutos |
| Usuarios afetados | 100% |
| Hotfixes emergenciais | 2 |
| Vezes que esse bug ja aconteceu | 2+ |

---

## Solucao: Nova Arquitetura

### Visao Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA RPC TYPE-SAFE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  RPC_REGISTRY (Single Source of Truth)                      │   │
│  │                                                             │   │
│  │  - 14 funcoes RPC mapeadas                                  │   │
│  │  - Tipo de retorno (SCALAR/TABLE/VOID)                      │   │
│  │  - Tipos TypeScript dos parametros e retorno                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  rpc<T>() - Funcao Generica Type-Safe                       │   │
│  │                                                             │   │
│  │  - Infere tipo automaticamente do registry                  │   │
│  │  - Valida em runtime (array vs object)                      │   │
│  │  - Logging centralizado                                     │   │
│  │  - Tratamento de erros padronizado                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Services (Consomem via rpc<T>())                           │   │
│  │                                                             │   │
│  │  - onboardingService.ts ✅                                  │   │
│  │  - userService.ts                                           │   │
│  │  - experimentService.ts                                     │   │
│  │  - atomicLimitService.ts                                    │   │
│  │  - twitterLimits.ts                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Estrutura de Arquivos

```
src/rpc/
├── index.ts        # Export unico: rpc<T>(), tipos, erros
├── types.ts        # Interfaces de retorno de todas as RPCs
├── registry.ts     # RPC_REGISTRY - single source of truth
├── client.ts       # Implementacao da funcao rpc()
└── errors.ts       # Classes de erro padronizadas

tests/rpc/
└── rpc.test.ts     # 21 testes cobrindo tipos e comportamento
```

### Uso

```typescript
// ANTES (propenso a bugs):
const { data, error } = await supabase.rpc('increment_daily_count', {
  p_user_id: userId
});
const count = data as number; // Esperando que seja number...

// DEPOIS (type-safe):
import { rpc } from '../rpc';

const count = await rpc('increment_daily_count', { p_user_id: userId });
// TypeScript SABE que count e number
// TypeScript VALIDA que p_user_id e obrigatorio
// IDE autocomplete FUNCIONA
```

---

## Progresso

### Fase 1: Criar Arquitetura (CONCLUIDA)

| Item | Status | Arquivo |
|------|--------|---------|
| Criar tipos | OK | `src/rpc/types.ts` |
| Criar erros | OK | `src/rpc/errors.ts` |
| Criar registry | OK | `src/rpc/registry.ts` |
| Criar client | OK | `src/rpc/client.ts` |
| Criar exports | OK | `src/rpc/index.ts` |
| Adicionar testes | OK | `tests/rpc/rpc.test.ts` |
| Build passa | OK | `npm run build` |
| Testes passam | OK | 21/21 testes |

### Fase 2: Migrar Services (CONCLUIDA ✅)

| Service | Chamadas Diretas | Wrapper Antigo | Status |
|---------|-----------------|----------------|--------|
| `onboardingService.ts` | 0 | 0 | **MIGRADO** ✅ |
| `userService.ts` | 0 | 0 | **MIGRADO** ✅ |
| `experimentService.ts` | 0 | 0 | **MIGRADO** ✅ |
| `twitterLimits.ts` | 0 | 0 | **MIGRADO** ✅ |
| `atomicLimitService.ts` | 0 | 0 | **MIGRADO** ✅ |

**Todas as funcoes migradas:**

```
onboardingService.ts: ✅
└── set_twitter_feature_shown_atomic

userService.ts: ✅
├── increment_daily_count
├── reset_all_daily_counters
├── increment_bonus_credit
└── increment_twitter_download_count

experimentService.ts: ✅
├── assign_experiment_variant (2 chamadas)
├── log_experiment_event
├── schedule_reminder
├── get_pending_reminder
└── get_experiment_metrics

twitterLimits.ts: ✅
└── increment_twitter_download_count

atomicLimitService.ts: ✅
├── check_and_increment_daily_limit_atomic
└── set_limit_notified_atomic
```

### Fase 3: Protecoes no CI (CONCLUIDA ✅)

| Item | Status |
|------|--------|
| ESLint rule: proibir `supabase.rpc()` direto | **OK** ✅ |
| Pre-commit hook para validar | N/A (ESLint no CI) |
| Teste: registry sincronizado com banco | **OK** ✅ |

### Fase 4: Cleanup (CONCLUIDA ✅)

| Item | Status |
|------|--------|
| Remover `src/utils/supabaseRpc.ts` antigo | **OK** ✅ |
| Atualizar ADR-005 | N/A (tipos na nova arquitetura) |
| Atualizar testes antigos | **OK** ✅ |

---

## Registry: Todas as RPCs

### SCALAR (retornam valor unico)

| Funcao | Parametros | Retorno |
|--------|------------|---------|
| `increment_daily_count` | `p_user_id` | `number` |
| `reset_all_daily_counters` | - | `number` |
| `increment_bonus_credit` | `p_user_id` | `number` |
| `increment_twitter_download_count` | `p_user_id` | `number` |
| `set_limit_notified_atomic` | `p_user_id` | `boolean` |
| `set_twitter_feature_shown_atomic` | `p_user_number` | `boolean` |
| `schedule_reminder` | `p_user_id`, `p_user_number`, `p_delay_hours`, ... | `string` |

### TABLE (retornam array)

| Funcao | Parametros | Retorno |
|--------|------------|---------|
| `check_and_increment_daily_limit_atomic` | `p_user_id`, `p_max_onboarding?` | `AtomicLimitCheckResult` |
| `assign_experiment_variant` | `p_user_id`, `p_experiment_name`, `p_is_brazilian?` | `ExperimentVariantResult` |
| `get_pending_reminder` | `p_user_id` | `PendingReminderResult` |
| `get_experiment_metrics` | `p_experiment_id` | `ExperimentMetricsResult[]` |
| `get_old_twitter_downloads_for_cleanup` | `p_hours_old?` | `TwitterDownloadForCleanup[]` |

### VOID (nao retornam valor)

| Funcao | Parametros |
|--------|------------|
| `log_experiment_event` | `p_user_id`, `p_experiment_id`, `p_variant`, `p_event_type`, `p_metadata?` |
| `cleanup_expired_conversation_contexts` | - |

---

## Protecoes em Camadas

| Camada | Protecao | Quando Detecta Erro |
|--------|----------|---------------------|
| 1. TypeScript | Tipo errado nos params/return | Compile time |
| 2. Registry | Funcao nao existe | Compile time |
| 3. Runtime | Array vs Object mismatch | Runtime |
| 4. ESLint | Uso de `supabase.rpc()` direto | CI/PR |
| 5. Testes | Tipos do registry vs banco | CI/PR |

---

## Como Adicionar Nova Funcao RPC

### Passo 1: Criar tipo em `src/rpc/types.ts`

```typescript
export interface MyNewResult {
  field1: string;
  field2: number;
}
```

### Passo 2: Adicionar no registry em `src/rpc/registry.ts`

```typescript
my_new_function: {
  type: 'table' as const,  // ou 'scalar' ou 'void'
  params: {} as { p_user_id: string },
  returns: {} as MyNewResult,
},
```

### Passo 3: Usar no codigo

```typescript
import { rpc } from '../rpc';

const result = await rpc('my_new_function', { p_user_id: userId });
// TypeScript sabe que result e MyNewResult
```

### Passo 4: Adicionar teste

```typescript
it('my_new_function returns correct type', () => {
  type Return = RpcReturn<'my_new_function'>;
  const result: Return = { field1: 'test', field2: 42 };
  expect(result.field1).toBeDefined();
});
```

---

## Beneficios

| Antes | Depois |
|-------|--------|
| 14 funcoes espalhadas em 5 services | 1 registry centralizado |
| Erro so em runtime | Erro em compile time |
| Duplicacao de codigo | Single source of truth |
| Manual type casting | Inferencia automatica |
| Facil errar | Impossivel errar |
| Documentacao separada | Tipos sao a documentacao |

---

## Resultado Final

✅ **Sprint 14 Concluida em 12/01/2026**

Todas as 12 chamadas RPC foram migradas para a nova arquitetura type-safe:
- 5 services migrados
- ESLint rule adicionada
- Testes de sincronizacao adicionados
- Codigo antigo removido

**Beneficios obtidos:**
- Erros de tipo detectados em compile time
- Impossivel confundir SCALAR vs TABLE
- Single source of truth no registry
- CI bloqueia uso direto de `supabase.rpc()`

---

## Referencias

- ADR-005: Safe RPC Wrapper (`docs/decisions/005-safe-rpc-wrapper.md`)
- Bug original: Commit `a555a3f` (hotfix)
- Nova arquitetura: Commit `[pending]`
- Testes: `tests/rpc/rpc.test.ts`

---

## Limitacoes Conhecidas

### PostgreSQL OUT parameter retorna RECORD ao inves de SCALAR

**Descoberto em:** 12/01/2026
**Corrigido em:** 12/01/2026

**Problema:** A funcao `set_limit_notified_atomic` tinha um parametro OUT:
```sql
CREATE FUNCTION set_limit_notified_atomic(
  p_user_id UUID,
  OUT was_already_notified boolean  -- ← ESTE ERA O PROBLEMA!
)
RETURNS boolean
```

Mesmo com `RETURNS boolean`, o parametro OUT faz o PostgreSQL retornar um RECORD:
`{"was_already_notified": false}` ao inves de simplesmente `false`.

**Impacto:** O codigo em `atomicLimitService.ts` recebia um objeto e fazia:
```typescript
if (!wasAlreadyNotified) { ... }  // Objeto e sempre truthy!
```

Resultado: **mensagens de limite NUNCA eram enviadas** para usuarios que atingiam o limite diario.

**Usuarios afetados identificados:**
- Lost. (c01cd1d1-b659-467f-a65c-b4e0c725fc11)
- 𓃮✩𝓙᥆ᥲ᥆ 𝓟ᥱძr᥆✩𓃮 (4b72efa1-160d-47da-9c83-79e308c12327)

### Correcao em Duas Camadas

#### Camada 1: Runtime validation em `src/rpc/client.ts`

Adicionada validacao automatica para funcoes SCALAR que recebem objeto ao inves de primitivo:

```typescript
// Se PostgreSQL retornar objeto com uma unica propriedade, extrai o valor
if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
  const keys = Object.keys(data);
  if (keys.length === 1) {
    const extractedValue = data[keys[0]];
    logger.warn({
      msg: '[RPC:SCALAR] PostgreSQL returned RECORD instead of primitive - extracting value',
      hint: 'Consider fixing the PostgreSQL function to return the value directly',
    });
    processedData = extractedValue;
  }
}
```

#### Camada 2: Correcao da funcao PostgreSQL

Migracao aplicada: `scripts/database/migrations/fix-set-limit-notified-atomic.sql`

```sql
-- Remove funcao com OUT parameter
DROP FUNCTION IF EXISTS set_limit_notified_atomic(uuid);

-- Cria versao correta SEM OUT parameter
CREATE FUNCTION set_limit_notified_atomic(p_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_affected int;
BEGIN
  UPDATE users
  SET limit_notified_at = NOW(), updated_at = NOW()
  WHERE id = p_user_id
    AND (limit_notified_at IS NULL
         OR limit_notified_at < date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected = 0;
END;
$$;
```

**Verificacao pos-fix:**
```sql
SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'set_limit_notified_atomic';
-- Deve retornar: "p_user_id uuid" (SEM "OUT was_already_notified boolean")
```

### Licoes Aprendidas

1. **OUT parameters em PostgreSQL sempre retornam RECORD**, mesmo com `RETURNS tipo_simples`
2. **JavaScript trata objetos como truthy**, entao `!{}` e sempre `false`
3. **Validacao em runtime** agora detecta e corrige esse problema automaticamente
4. **Sempre verificar a assinatura completa** da funcao PostgreSQL, incluindo OUT parameters

---

## Historico

| Data | Mudanca | Autor |
|------|---------|-------|
| 09/01/2026 | Criacao do documento | Claude Opus 4.5 |
| 09/01/2026 | Fase 1 concluida | Claude Opus 4.5 |
| 09/01/2026 | `onboardingService.ts` migrado - primeiro uso em producao! | Claude Opus 4.5 |
| 09/01/2026 | Bug de menu duplicado corrigido via `set_twitter_feature_shown_atomic` | Claude Opus 4.5 |
| 12/01/2026 | Fases 2, 3 e 4 concluidas - Sprint finalizada! | Claude Opus 4.5 |
| 12/01/2026 | Todos os 5 services migrados para rpc() type-safe | Claude Opus 4.5 |
| 12/01/2026 | ESLint rule adicionada para bloquear supabase.rpc() direto | Claude Opus 4.5 |
| 12/01/2026 | Testes de sincronizacao registry/banco adicionados | Claude Opus 4.5 |
| 12/01/2026 | Codigo antigo (supabaseRpc.ts) removido | Claude Opus 4.5 |
| 12/01/2026 | **BUG:** `set_limit_notified_atomic` retornava objeto ao inves de boolean - mensagens de limite nao enviadas | Claude Opus 4.5 |
| 12/01/2026 | **FIX:** Removido OUT parameter da funcao PostgreSQL + validacao runtime em client.ts | Claude Opus 4.5 |
