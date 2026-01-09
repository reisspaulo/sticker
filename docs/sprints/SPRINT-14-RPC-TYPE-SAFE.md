# Sprint 14 - Arquitetura RPC Type-Safe

**Status:** EM ANDAMENTO
**Data Inicio:** 09/01/2026
**Ultima Atualizacao:** 09/01/2026

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

### Fase 2: Migrar Services (EM ANDAMENTO)

| Service | Chamadas Diretas | Wrapper Antigo | Status |
|---------|-----------------|----------------|--------|
| `onboardingService.ts` | 0 | 0 | **MIGRADO** |
| `userService.ts` | 4 | 0 | PENDENTE |
| `experimentService.ts` | 5 | 0 | PENDENTE |
| `twitterLimits.ts` | 1 | 0 | PENDENTE |
| `atomicLimitService.ts` | 0 | 2 | PENDENTE |

**Funcoes a migrar:**

```
onboardingService.ts: (MIGRADO)
└── set_twitter_feature_shown_atomic (L149) ✅

userService.ts:
├── increment_daily_count (L269)
├── reset_all_daily_counters (L305)
├── increment_bonus_credit (L439)
└── increment_twitter_download_count (L507)

experimentService.ts:
├── assign_experiment_variant (L88)
├── log_experiment_event (L161)
├── schedule_reminder (L212)
├── get_pending_reminder (L256)
└── get_experiment_metrics (L304)

twitterLimits.ts:
└── increment_twitter_download_count (L97)

atomicLimitService.ts:
├── checkAndIncrementLimitAtomic (wrapper antigo)
└── setLimitNotifiedAtomic (wrapper antigo)
```

### Fase 3: Protecoes no CI (PENDENTE)

| Item | Status |
|------|--------|
| ESLint rule: proibir `supabase.rpc()` direto | PENDENTE |
| Pre-commit hook para validar | PENDENTE |
| Teste: registry sincronizado com banco | PENDENTE |

### Fase 4: Cleanup (PENDENTE)

| Item | Status |
|------|--------|
| Remover `src/utils/supabaseRpc.ts` antigo | PENDENTE |
| Atualizar ADR-005 | PENDENTE |
| Atualizar testes antigos | PENDENTE |

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

## Proximos Passos

1. **Migrar `userService.ts`** - 4 funcoes, mais usado
2. **Migrar `experimentService.ts`** - 5 funcoes
3. **Migrar `twitterLimits.ts`** - 1 funcao
4. **Migrar `atomicLimitService.ts`** - Trocar wrapper antigo pelo novo
5. **Adicionar ESLint rule** - Proibir `supabase.rpc()` direto
6. **Remover codigo antigo** - `src/utils/supabaseRpc.ts`
7. **Atualizar ADR-005** - Corrigir documentacao

---

## Referencias

- ADR-005: Safe RPC Wrapper (`docs/decisions/005-safe-rpc-wrapper.md`)
- Bug original: Commit `a555a3f` (hotfix)
- Nova arquitetura: Commit `[pending]`
- Testes: `tests/rpc/rpc.test.ts`

---

## Historico

| Data | Mudanca | Autor |
|------|---------|-------|
| 09/01/2026 | Criacao do documento | Claude Opus 4.5 |
| 09/01/2026 | Fase 1 concluida | Claude Opus 4.5 |
| 09/01/2026 | `onboardingService.ts` migrado - primeiro uso em producao! | Claude Opus 4.5 |
| 09/01/2026 | Bug de menu duplicado corrigido via `set_twitter_feature_shown_atomic` | Claude Opus 4.5 |
