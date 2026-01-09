# 🔴 Guia de Arquivos Críticos - Proteção de Documentação

Este documento lista **todos os arquivos críticos** que, quando alterados, **DEVEM** ter a documentação atualizada.

---

## 🛡️ Proteções Automáticas Ativas

### ✅ Já Protegidos (Pre-commit Hook + CI)

| Arquivo | Documentação que deve ser atualizada | Proteção |
|---------|--------------------------------------|----------|
| `src/routes/webhook.ts` | `docs/architecture/FLOWCHARTS.md` | ✅ Pre-commit hook + CI validation |
| `src/services/menuService.ts` | `docs/architecture/FLOWCHARTS.md` | ✅ Pre-commit hook |
| `src/worker.ts` | `docs/architecture/FLOWCHARTS.md` | ✅ Pre-commit hook |
| `src/config/queue.ts` | `docs/architecture/FLOWCHARTS.md` | ✅ CI validation |
| `src/types/subscription.ts` (PLAN_LIMITS) | `docs/business/BUSINESS_RULES.md` | ✅ CI validation |
| **Chamadas RPC do Supabase** | `src/utils/supabaseRpc.ts` (wrapper type-safe) | ✅ Type safety + Runtime validation |

**Como funciona:**
1. **Pre-commit hook** te avisa se você mudou esses arquivos
2. **CI validation** quebra o build se docs estiverem desatualizados
3. **RPC Wrapper** previne bugs de acesso a arrays (NOVO em 09/01/2026)

---

## 🛡️ NOVO: Proteção Contra Bugs de RPC (09/01/2026)

### O que foi implementado

**Problema resolvido**: Bug crítico de produção onde funções RPC que retornam `TABLE` (arrays) eram acessadas como objetos, resultando em `undefined`.

**Solução**: Wrapper type-safe em `src/utils/supabaseRpc.ts` que:
- ✅ Detecta automaticamente SCALAR vs TABLE
- ✅ Valida tipo de retorno em runtime
- ✅ TypeScript types previnem erros em compile time
- ✅ Logs detalhados para debugging

**Documentação**: Ver [ADR 005: Safe RPC Wrapper](./decisions/005-safe-rpc-wrapper.md)

### Como usar

**❌ NUNCA faça isso** (propenso a bugs):
```typescript
const { data, error } = await supabase.rpc('my_function', { params });
const result = data.field; // ❌ Pode ser undefined!
```

**✅ SEMPRE use o wrapper**:
```typescript
import { callTableRpc, callScalarRpc } from '../utils/supabaseRpc';

// Para funções que retornam TABLE
const result = await callTableRpc<MyType>('my_function', { params }, {
  functionName: 'myFunction',
  returnFirst: true
});

// Para funções que retornam SCALAR
const count = await callScalarRpc<number>('increment_count', { params }, {
  functionName: 'incrementCount'
});
```

**Status**: ✅ Implementado e em produção desde 09/01/2026

---

## 🔴 CRÍTICO: Arquivos Sem Proteção Automática

### 1️⃣ Database Migrations (RISCO ALTO 🔴)

**Arquivos**: `supabase/migrations/*.sql`

**O que fazer quando mudar**:
- [ ] Atualizar `docs/business/BUSINESS_RULES.md` (regras afetadas)
- [ ] Atualizar `src/types/*.ts` (tipos TypeScript devem bater com DB)
- [ ] Adicionar comentário na migration explicando a mudança

**Exemplo**:
```sql
-- supabase/migrations/20260108_add_enterprise_plan.sql
-- BUSINESS RULE: BR-103 (adicionar na BUSINESS_RULES.md)
ALTER TYPE plan_type ADD VALUE 'enterprise';
ALTER TABLE subscriptions ADD COLUMN enterprise_features JSONB;
```

**Recomendação**: Criar template de migration com checklist:
```sql
-- ✅ CHECKLIST:
-- [ ] Atualizei BUSINESS_RULES.md
-- [ ] Atualizei src/types/subscription.ts
-- [ ] Adicionei testes
```

---

### 2️⃣ Environment Variables (RISCO ALTO 🔴)

**Arquivo**: `.env.example`

**Problema encontrado**: `.env.example` está **INCOMPLETO** ❌

**Variáveis faltantes**:
```bash
# Avisa API (usado em src/services/avisaApi.ts)
AVISA_API_URL=https://api.avisa.app
AVISA_API_TOKEN=seu_token_aqui

# Twitter/X API (usado em src/services/twitterService.ts)
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_BEARER_TOKEN=

# Admin Panel (usado em admin-panel/.env)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# OpenAI (usado em docker-compose.yml)
OPENAI_API_KEY=
```

**O que fazer**:
1. Adicionar essas variáveis ao `.env.example` AGORA
2. Quando adicionar nova variável ao código → adicionar ao `.env.example` no mesmo commit

**Recomendação futura**: Script que valida `.env.example` vs `docker-compose.yml`

---

### 3️⃣ Subscription Limits (RISCO ALTO 🔴)

**Arquivo**: `src/types/subscription.ts`

```typescript
export const PLAN_LIMITS = {
  free: 4,      // ← SE MUDAR ISSO...
  premium: 20,
  ultra: 999999
};
```

**Documentação que DEVE ser atualizada**:
- `docs/business/BUSINESS_RULES.md` (BR-100, BR-101, BR-102)
- `docs/architecture/FLOWCHARTS.md` (mensagens de limite)
- `tests/flows/upgrade-flow.test.ts` (testes)

**Proteção**: ✅ Validação automática adicionada ao CI (valida PLAN_LIMITS vs BR-100/101/102)

---

### 4️⃣ CI/CD Workflows (RISCO MÉDIO 🟡)

**Arquivos**: `.github/workflows/*.yml`

**O que fazer quando mudar**:
- [ ] Atualizar `docs/setup/CI-CD-WORKFLOW.md`
- [ ] Atualizar `docs/setup/GITHUB-ACTIONS-SETUP.md`
- [ ] Se mudar secrets → atualizar README de setup

**Novidade**: ✅ Adicionada validação de docs no deploy (quebra se docs desatualizadas)

---

### 5️⃣ Docker & Infraestrutura (RISCO MÉDIO 🟡)

**Arquivos**: `Dockerfile`, `docker-compose.yml`

**O que fazer quando mudar**:
- [ ] Atualizar `docs/setup/PRODUCTION-SETUP.md`
- [ ] Se mudar portas → atualizar diagramas de arquitetura
- [ ] Se adicionar dependência (FFmpeg, Python libs) → documentar

**Exemplo**: Se adicionar novo serviço ao `docker-compose.yml`:
```yaml
services:
  redis-cache:  # ← NOVO!
    image: redis:7-alpine
```
→ Atualizar `PRODUCTION-SETUP.md` com o novo serviço

---

### 6️⃣ Business Rules (RISCO MÉDIO 🟡)

**Arquivo**: `docs/business/BUSINESS_RULES.md`

**Conexões críticas**:
- BR-100 a BR-102 (limites) → `src/types/subscription.ts` (PLAN_LIMITS)
- BR-200 a BR-203 (A/B test) → `src/services/userService.ts`
- BR-300 a BR-301 (bonus) → `src/routes/webhook.ts`

**Proteção**: ✅ CI valida se PLAN_LIMITS bate com BR-100/101/102

**Recomendação**: Adicionar link nos arquivos:
```typescript
// src/types/subscription.ts
// 📋 BUSINESS RULES: BR-100, BR-101, BR-102
export const PLAN_LIMITS = {
  free: 4,
  premium: 20,
  ultra: 999999
};
```

---

## 📊 Matriz de Risco

| Arquivo/Área | Frequência de Mudança | Risco de Dessincronia | Proteção Atual | Ação Necessária |
|--------------|----------------------|----------------------|----------------|-----------------|
| **webhook.ts** | Alta | 🔴 Alta | ✅ Hook + CI | Mantém |
| **Database migrations** | Média | 🔴 Alta | ❌ Nenhuma | 🚨 Adicionar template |
| **Environment variables** | Baixa | 🔴 Alta | ❌ Nenhuma | 🚨 Completar .env.example |
| **PLAN_LIMITS** | Baixa | 🔴 Alta | ✅ CI validation | Mantém |
| **Services** | Alta | 🟡 Média | Parcial | Revisar periodicamente |
| **CI/CD workflows** | Baixa | 🟡 Média | ❌ Manual | Documentar mudanças |
| **Docker** | Baixa | 🟡 Média | ❌ Manual | Documentar mudanças |

---

## 🎯 Checklist: Mudei Código, E Agora?

### Toda vez que você fizer commit, pergunte-se:

#### 1. Mudei um botão? (`button_*`, `plan_*`, `payment_*`)
- [ ] Atualizei `FLOWCHARTS.md`?
- [ ] Pre-commit hook vai te avisar!

#### 2. Mudei limites de planos?
```typescript
// ANTES
free: 4

// DEPOIS
free: 5  // ← MUDANÇA!
```
- [ ] Atualizei `BUSINESS_RULES.md` (BR-100)?
- [ ] Atualizei `FLOWCHARTS.md` (mensagens)?
- [ ] CI vai quebrar se esquecer!

#### 3. Criei/mudei migration?
- [ ] Adicionei comentário explicando mudança?
- [ ] Atualizei `BUSINESS_RULES.md`?
- [ ] Atualizei tipos TypeScript?

#### 4. Adicionei variável de ambiente?
- [ ] Adicionei ao `.env.example`?
- [ ] Documentei no `PRODUCTION-SETUP.md`?

#### 5. Mudei CI/CD workflow?
- [ ] Atualizei `CI-CD-WORKFLOW.md`?

#### 6. Mudei serviço Docker?
- [ ] Atualizei `PRODUCTION-SETUP.md`?
- [ ] Documentei portas/dependências?

---

## 🚀 Próximas Melhorias

### Curto Prazo (1-2 semanas)
1. ✅ **DONE**: Adicionar validação no CI
2. ✅ **DONE**: Validar PLAN_LIMITS vs BUSINESS_RULES.md
3. 🔲 **TODO**: Completar `.env.example` com variáveis faltantes
4. 🔲 **TODO**: Criar template de migration com checklist

### Médio Prazo (1 mês)
1. Script para validar `.env.example` vs `docker-compose.yml`
2. Adicionar validação de migrations (detectar mudanças em schema)
3. Auto-gerar changelog quando PLAN_LIMITS mudar

### Longo Prazo (3+ meses)
1. Dashboard de cobertura de docs
2. Bot no PR comentando "Você mudou X, lembre de atualizar Y"
3. Auto-gerar documentação de API a partir de tipos TypeScript

---

## 📚 Referências

- [DOCUMENTATION_GUIDE.md](./DOCUMENTATION_GUIDE.md) - Filosofia de documentação viva
- [FASE_1_IMPLEMENTADA.md](../FASE_1_IMPLEMENTADA.md) - Sistema de proteção atual
- [ADR 004](./decisions/004-silent-stickers-strategy.md) - Exemplo de como documentar decisões

---

**Última atualização**: 2026-01-09
**Versão**: 1.0
**Responsável**: Sistema de Documentação Viva
