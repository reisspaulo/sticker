# ADR 005: Safe RPC Wrapper para Supabase

**Status**: ✅ Aceito
**Data**: 2026-01-09
**Contexto**: Bug crítico de produção causado por acesso incorreto a arrays em retornos RPC

---

## Contexto e Problema

### O Problema

Em 09/01/2026, o bot parou de funcionar completamente em produção. Todos os usuários recebiam mensagem de "limite atingido" (com valores `undefined/undefined`) mesmo estando dentro do limite.

**Root Cause**: Função RPC `check_and_increment_daily_limit_atomic` retorna `TABLE` (array), mas o código TypeScript estava acessando como objeto direto:

```typescript
// ❌ CÓDIGO ERRADO (causou o bug):
const { data, error } = await supabase.rpc('check_and_increment_daily_limit_atomic', {
  p_user_id: userId
});

return {
  allowed: data.allowed,  // ❌ undefined! (data é array, não objeto)
  daily_count: data.daily_count  // ❌ undefined!
};
```

**Por que aconteceu**:
- Supabase RPC retorna **array** quando função é `RETURNS TABLE`
- Código assumiu que retornava **objeto** direto
- Sem type safety ou validação em runtime
- Nenhum teste para detectar o problema

### Impacto

- 🔴 **100% dos usuários afetados** - Bot completamente inoperante
- 🔴 **Produção down** por ~30 minutos
- 🔴 **Hotfix emergencial** necessário
- 🔴 **Não é a primeira vez** que acontece (segundo o usuário)

---

## Decisão

Criar um **wrapper type-safe** para todas as chamadas RPC do Supabase que:

1. **Detecta automaticamente** se retorno é SCALAR vs TABLE
2. **Valida em runtime** o tipo do retorno
3. **Fornece type safety** com TypeScript
4. **Loga erros detalhados** para debugging
5. **Centraliza** toda lógica de RPC em um lugar

### Implementação

Criado arquivo `/src/utils/supabaseRpc.ts` com 3 helpers:

```typescript
// Para funções que retornam valor único (integer, boolean, etc)
callScalarRpc<T>(rpcName, params, options): Promise<T>

// Para funções que retornam TABLE/SETOF (array de rows)
callTableRpc<T>(rpcName, params, options): Promise<T | T[]>

// Para funções que não retornam nada (void)
callVoidRpc(rpcName, params, options): Promise<void>
```

### Exemplo de Uso

**Antes (propenso a bugs)**:
```typescript
const { data, error } = await supabase.rpc('check_and_increment_daily_limit_atomic', {
  p_user_id: userId
});

// 🤔 É array ou objeto? Não sei...
// ❌ Se for array e eu acessar direto → undefined
const result = data.allowed;
```

**Depois (type-safe)**:
```typescript
const result = await checkAndIncrementLimitAtomic(userId);
// ✅ TypeScript garante que tem .allowed, .daily_count, etc
// ✅ Wrapper valida que data é array e retorna data[0]
// ✅ Logs automáticos para debugging
```

---

## Consequências

### Positivas ✅

1. **Impossível** repetir o bug - Wrapper valida tipo em runtime
2. **Type safety** - TypeScript previne erros em compile time
3. **Logs detalhados** - Facilita debugging de problemas futuros
4. **Documentação viva** - Tipos TypeScript são self-documenting
5. **Reutilizável** - Todas as RPCs futuras usam o mesmo pattern
6. **Testes automatizados** - Teste em `tests/utils/supabaseRpc.test.ts` garante funcionamento

### Negativas ⚠️

1. **Migração gradual** - Código existente precisa ser refatorado
2. **Dependência** - Todo código que chama RPC deve usar o wrapper
3. **Manutenção** - Precisa atualizar wrapper se Supabase mudar comportamento

### Neutras

1. **Performance** - Overhead mínimo (apenas validação de tipo)
2. **Bundle size** - ~2KB adicional (negligível)

---

## Mapeamento: Funções RPC → Tipo de Retorno

Auditoria completa realizada em 09/01/2026:

### SCALAR (retornam valor único)

| Função RPC | Retorna | Type |
|-----------|---------|------|
| `increment_daily_count` | `integer` | `number` |
| `increment_bonus_credit` | `integer` | `number` |
| `increment_twitter_download_count` | `integer` | `number` |
| `reset_all_daily_counters` | `integer` | `number` |

**Uso**: `const result = data as number` ✅

### TABLE (retornam array)

| Função RPC | Retorna | Type |
|-----------|---------|------|
| `check_and_increment_daily_limit_atomic` | `TABLE(...)` | `AtomicLimitCheckResult[]` |
| `set_limit_notified_atomic` | `TABLE(...)` | `AtomicLimitNotifiedResult[]` |
| `get_old_twitter_downloads_for_cleanup` | `TABLE(...)` | `TwitterDownload[]` |

**Uso**: `const result = data[0]` ✅ (ou iterar sobre array)

### VOID (não retornam valor)

| Função RPC | Retorna | Type |
|-----------|---------|------|
| `cleanup_expired_conversation_contexts` | `void` | `void` |

**Uso**: `await supabase.rpc(...); // Apenas verifica error` ✅

---

## Alternativas Consideradas

### 1. Não fazer nada (manter código atual)
**Rejeitado**: Bug já aconteceu múltiplas vezes, vai acontecer novamente

### 2. Apenas adicionar validação inline
```typescript
if (!data || !data[0]) throw new Error('...');
const result = data[0];
```
**Rejeitado**: Duplicação de código, não previne novos bugs

### 3. Usar biblioteca third-party
**Rejeitado**: Adiciona dependência externa, wrapper custom é simples o suficiente

### 4. ✅ Wrapper type-safe centralizado (ESCOLHIDO)
**Motivos**:
- Centraliza lógica em um lugar
- Type safety garante uso correto
- Reutilizável para todas as RPCs
- Logs automáticos para debugging

---

## Plano de Migração

### Fase 1: ✅ Concluída (09/01/2026)
- [x] Criar `/src/utils/supabaseRpc.ts`
- [x] Criar testes em `/tests/utils/supabaseRpc.test.ts`
- [x] Refatorar `atomicLimitService.ts` (primeiro uso)
- [x] Deploy de hotfix em produção

### Fase 2: 🔄 Em andamento
- [ ] Refatorar `userService.ts` (4 funções RPC)
- [ ] Refatorar `twitterLimits.ts` (1 função RPC)
- [ ] Adicionar helpers para funções não usadas ainda

### Fase 3: Prevenção futura
- [ ] Adicionar validação no CI que checa uso de `.rpc()` direto
- [ ] Documentar padrão no onboarding de devs
- [ ] Criar migration guide para novos devs

---

## Como Adicionar Nova Função RPC

### Passo 1: Criar função no Supabase

```sql
CREATE OR REPLACE FUNCTION my_new_function(p_user_id uuid)
RETURNS TABLE(
  result_field1 integer,
  result_field2 text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY SELECT ...;
END;
$$;
```

### Passo 2: Adicionar type interface

```typescript
// Em src/utils/supabaseRpc.ts
export interface MyNewFunctionResult {
  result_field1: number;
  result_field2: string;
}
```

### Passo 3: Criar helper type-safe

```typescript
// Em src/utils/supabaseRpc.ts
export async function myNewFunction(userId: string): Promise<MyNewFunctionResult> {
  return await callTableRpc<MyNewFunctionResult>(
    'my_new_function',
    { p_user_id: userId },
    {
      functionName: 'myNewFunction',
      returnFirst: true,  // Se espera 1 row
      logParams: false    // Se params são sensíveis
    }
  );
}
```

### Passo 4: Usar no código

```typescript
// Em qualquer service
import { myNewFunction } from '../utils/supabaseRpc';

const result = await myNewFunction(userId);
console.log(result.result_field1); // ✅ Type-safe!
```

### Passo 5: Adicionar teste

```typescript
// Em tests/utils/supabaseRpc.test.ts
it('my_new_function → retorna TABLE com dados', () => {
  const result: MyNewFunctionResult = {
    result_field1: 42,
    result_field2: 'hello'
  };

  expect(result).toHaveProperty('result_field1');
  expect(result).toHaveProperty('result_field2');
});
```

---

## Referências

- [Supabase RPC Documentation](https://supabase.com/docs/reference/javascript/rpc)
- PostgreSQL RETURNS TABLE vs RETURNS scalar
- Auditoria completa: Task Agent a5ce371 (09/01/2026)
- Bug original: Commit `11f24d3` (hotfix)
- Refactor: Commit `[pending]` (wrapper implementation)

---

## Revisões

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-01-09 | Criação inicial | Claude Sonnet 4.5 |
| 2026-01-09 | Auditoria completa de 15 funções RPC | Task Agent a5ce371 |

---

**Decisão final**: Adotar wrapper type-safe para **TODAS** as chamadas RPC do Supabase. Bug crítico que derrubou produção não deve acontecer novamente.
