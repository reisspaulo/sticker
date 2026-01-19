# Sprint 18: Módulo de Campanhas no Admin Panel

## PRD - Product Requirements Document

**Data:** 2026-01-15
**Status:** Planejamento
**Prioridade:** Alta

---

## 1. Visão Geral

### 1.1 Contexto Atual

O sistema de campanhas já está **funcionando no backend** com:
- 4 campanhas configuradas (3 ativas, 1 draft)
- 403 usuários inscritos em campanhas
- Worker processando mensagens a cada 60 segundos
- RPCs para enrollment, analytics, cancelamento

**Campanhas Existentes:**
| Campanha | Tipo | Status | Usuários | Steps |
|----------|------|--------|----------|-------|
| twitter_discovery_v2 | hybrid | ✅ active | 182 | 4 (D0, D7, D15, D30) |
| payment_intent_reminder_v2 | event | ✅ active | 14 | 3 (30min, 6h, 48h) |
| limit_reached_v2 | instant | ✅ active | 207 | 1 |
| cleanup_feature_v2 | hybrid | ⚪ draft | 0 | 2 |

### 1.2 Problema

Não há interface visual para:
- Ver campanhas ativas/inativas e suas métricas
- Criar novas campanhas sem escrever SQL/código
- Gerenciar audiência com filtros visuais (estilo HubSpot/Salesforce)
- Adicionar figurinhas às mensagens de campanha
- Pausar/ativar campanhas rapidamente

**Consequências:**
- Criar campanha exige migration SQL manual
- Não há visibilidade de performance em tempo real
- Não dá pra fazer testes rápidos de novas campanhas
- Figurinhas (core do produto) não são usadas nas campanhas

### 1.3 Solução Proposta

Criar módulo completo de campanhas no admin panel com:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPRINT 18 - ENTREGAS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FASE 1: Visualização (Read-Only)                                          │
│  ├── Lista de campanhas com métricas                                       │
│  ├── Página de detalhes com analytics                                      │
│  ├── Funil de conversão por step                                           │
│  └── Timeline de eventos                                                   │
│                                                                             │
│  FASE 2: Gerenciamento Básico                                              │
│  ├── Ativar/Pausar/Encerrar campanha                                       │
│  ├── Editar configurações (rate limit, janela envio)                       │
│  └── Ver/filtrar usuários na campanha                                      │
│                                                                             │
│  FASE 3: Biblioteca de Stickers do Bot                                     │
│  ├── Nova tabela: bot_stickers                                             │
│  ├── Upload de figurinhas para campanhas                                   │
│  ├── Organização por tags/categorias                                       │
│  └── Vincular stickers às campanhas                                        │
│                                                                             │
│  FASE 4: Criação de Campanhas (Wizard)                                     │
│  ├── Step 1: Info básica (nome, tipo)                                      │
│  ├── Step 2: Trigger (evento que dispara)                                  │
│  ├── Step 3: Filtros de audiência (visual builder)                         │
│  ├── Step 4: Condição de cancelamento                                      │
│  ├── Step 5: Steps/Waves com mensagens                                     │
│  ├── Step 6: Vincular stickers                                             │
│  └── Step 7: Revisão e ativação                                            │
│                                                                             │
│  FASE 5: Testes A/B Visual                                                 │
│  ├── Criar variantes de mensagem                                           │
│  ├── Definir pesos (50/50, 25/25/25/25)                                    │
│  └── Dashboard de comparação                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Análise 360 - Estado Atual

### 2.1 Schema do Banco (Campanhas)

```sql
-- TABELAS EXISTENTES

campaigns
├── id (UUID)
├── name (VARCHAR) UNIQUE
├── description (TEXT)
├── campaign_type (VARCHAR) -- 'drip', 'event', 'hybrid', 'instant'
├── trigger_config (JSONB) -- {"event_name": "limit_hit", "initial_delay_hours": 4}
├── target_filter (JSONB) -- {"subscription_plan": "free"}
├── cancel_condition (TEXT) -- SQL: "twitter_feature_used = true"
├── status (VARCHAR) -- 'draft', 'active', 'paused', 'ended'
├── priority (INTEGER)
├── max_users (INTEGER)
├── settings (JSONB) -- batch_size, rate_limit_ms, send_window
└── timestamps

campaign_steps
├── id (UUID)
├── campaign_id (UUID) FK
├── step_order (INTEGER) -- 0, 1, 2, 3
├── step_key (VARCHAR) -- 'day_0', 'day_7', 'wave_1'
├── delay_hours (INTEGER) -- horas após step anterior
├── send_window (JSONB)
├── variants (JSONB) -- ['control', 'benefit', 'urgency']
└── variant_weights (JSONB) -- {"control": 33, "benefit": 33, "urgency": 34}

campaign_messages
├── id (UUID)
├── step_id (UUID) FK
├── variant (VARCHAR) -- 'default' ou nome da variante
├── content_type (VARCHAR) -- 'text', 'buttons', 'sticker', 'image'
├── title (TEXT)
├── body (TEXT)
├── footer (TEXT)
├── buttons (JSONB) -- [{"id": "btn_x", "text": "Clique"}]
├── media (JSONB) -- {sticker_url, sticker_id} ← EXISTENTE MAS NÃO USADO
└── timestamps

user_campaigns
├── id (UUID)
├── user_id (UUID) FK
├── campaign_id (UUID) FK
├── current_step (INTEGER)
├── variant (VARCHAR)
├── next_scheduled_at (TIMESTAMPTZ)
├── status (VARCHAR) -- 'pending', 'active', 'processing', 'completed', 'cancelled'
├── cancel_reason (VARCHAR)
├── metadata (JSONB)
└── timestamps (enrolled_at, started_at, completed_at)

campaign_events
├── id (UUID)
├── user_campaign_id (UUID)
├── user_id (UUID)
├── campaign_id (UUID)
├── event_type (VARCHAR) -- 'enrolled', 'step_sent', 'button_clicked', 'cancelled', 'completed'
├── step_key (VARCHAR)
├── variant (VARCHAR)
├── metadata (JSONB) -- pode guardar sticker_id enviado
└── created_at
```

### 2.2 RPCs Existentes

| RPC | Função | Usada por |
|-----|--------|-----------|
| `enroll_user_in_campaign()` | Inscrever usuário | campaignService.ts |
| `advance_campaign_step()` | Avançar para próximo step | campaignService.ts |
| `handle_campaign_button_click()` | Processar clique de botão | webhook.ts |
| `get_pending_campaign_messages()` | Buscar mensagens para enviar | worker.ts |
| `check_campaign_cancel_conditions()` | Verificar cancelamentos | worker.ts |
| `revert_stuck_campaign_processing()` | Recovery de jobs travados | worker.ts |
| `get_campaign_analytics()` | Analytics detalhadas | campaignService.ts |
| `get_instant_campaign_message()` | Mensagem instant com variante | campaignService.ts |
| `log_campaign_instant_event()` | Log de eventos instant | campaignService.ts |
| `campaign_select_variant()` | Sortear variante A/B | RPCs internas |

### 2.3 Serviços Backend

```typescript
// src/services/campaignService.ts (870+ linhas)

// Enrollment
enrollUserInCampaign(userId, campaignName, metadata?)
enrollInTwitterDiscoveryV2(userId)
enrollInPaymentIntentReminderV2(userId, planName)
enrollInCleanupFeatureV2(userId)

// Processamento
sendCampaignMessage(userId, campaign, step, message, variant?)
processPendingCampaignMessages(batchSize, delayMs)
checkCancelConditions()
revertStuckProcessing(timeoutMinutes)

// Analytics
getCampaignAnalytics(campaignName, startDate?, endDate?)

// Instant campaigns
getInstantCampaignMessage(campaignName, userId)
getLimitReachedMessage(userId, count, limit)
logCampaignInstantEvent(campaignName, userId, eventType, metadata?)

// Button handling
handleCampaignButtonClick(userId, campaignName, buttonId, metadata?)
handleCampaignButton(buttonId, userNumber, userId)
```

### 2.4 Campos Filtráveis (users)

Para o builder de audiência, campos disponíveis:

| Campo | Tipo | Operadores |
|-------|------|------------|
| `subscription_plan` | text | =, != (free, premium, ultra) |
| `subscription_status` | text | =, !=, IS NULL |
| `created_at` | timestamp | >, <, BETWEEN |
| `first_sticker_at` | timestamp | >, <, IS NULL |
| `last_interaction` | timestamp | >, < |
| `daily_count` | integer | =, >, <, >= |
| `twitter_feature_used` | boolean | =, != |
| `cleanup_feature_used` | boolean | =, != |
| `ab_test_group` | text | =, != |
| `onboarding_step` | integer | =, >, < |
| `whatsapp_number` | text | LIKE (país: '55%') |

### 2.5 Storage Buckets

| Bucket | Público | Uso |
|--------|---------|-----|
| `stickers-estaticos` | ✅ | Figurinhas WebP dos usuários |
| `stickers-animados` | ✅ | Figurinhas animadas WebP |
| `twitter-videos` | ✅ | Vídeos baixados do Twitter |
| `celebrity-training` | ❌ | Fotos para treinamento |

**Novo bucket necessário:** `bot-stickers` (público) para figurinhas das campanhas.

### 2.6 Admin Panel - Páginas Existentes

```
/                           → Dashboard
/users                      → Lista de usuários
/users/[id]                 → Detalhes do usuário (+ edição)
/users/ranking              → Ranking de usuários
/users/flow                 → Funil de usuários
/stickers                   → Stickers recentes
/stickers/celebrities       → Gerenciar celebridades
/stickers/emotions          → Emoções classificadas
/analytics                  → Analytics geral
/analytics/funnel           → Funil de conversão
/analytics/experiments      → Experimentos A/B
/analytics/buttons          → Cliques em botões
/analytics/classification   → Top emoções/celebridades
/bot/messages               → Catálogo de mensagens
/bot/buttons                → Botões do bot
/bot/flows                  → Fluxos do bot
/monitoring/connections     → Status WhatsApp
/logs                       → Logs gerais
/settings                   → Configurações

// NOVO - FASE 1+
/campaigns                  → Lista de campanhas
/campaigns/[id]             → Detalhes + analytics
/campaigns/new              → Wizard de criação
/campaigns/[id]/edit        → Editar campanha
/campaigns/stickers         → Biblioteca de stickers do bot
/campaigns/optouts          → Lista de opt-outs
/campaigns/suppression      → Lista de supressão
```

---

## 3. Novas Tabelas (Banco de Dados)

### 3.1 campaign_optouts - Opt-out de Campanhas

```sql
-- Usuários que pediram para não receber campanhas
CREATE TABLE campaign_optouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  whatsapp_number TEXT NOT NULL,           -- backup se user for deletado
  reason TEXT,                              -- 'user_requested', 'complaint', 'admin', 'bounce'
  source TEXT,                              -- 'bot_message', 'admin_panel', 'system'
  opted_out_at TIMESTAMPTZ DEFAULT now(),
  opted_out_by TEXT,                        -- 'user', 'admin:paulo@email.com', 'system'
  notes TEXT,                               -- observações do admin

  UNIQUE(whatsapp_number)
);

CREATE INDEX idx_campaign_optouts_user ON campaign_optouts(user_id);
CREATE INDEX idx_campaign_optouts_number ON campaign_optouts(whatsapp_number);
```

### 3.2 campaign_suppression_list - Lista de Supressão

```sql
-- Números que NUNCA devem receber campanhas (legal, complaints, VIPs)
CREATE TABLE campaign_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,                     -- 'legal', 'complaint', 'vip', 'test', 'partner'
  description TEXT,                         -- detalhes do motivo
  added_by TEXT NOT NULL,                   -- email do admin
  added_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,                   -- NULL = permanente

  CONSTRAINT valid_reason CHECK (reason IN ('legal', 'complaint', 'vip', 'test', 'partner', 'other'))
);

CREATE INDEX idx_suppression_number ON campaign_suppression_list(whatsapp_number);
CREATE INDEX idx_suppression_expires ON campaign_suppression_list(expires_at) WHERE expires_at IS NOT NULL;
```

### 3.3 Alterações em Tabelas Existentes

```sql
-- Campos novos em campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS
  scheduled_start_at TIMESTAMPTZ,           -- quando começar automaticamente
  scheduled_end_at TIMESTAMPTZ,             -- quando terminar automaticamente
  cloned_from UUID REFERENCES campaigns(id),
  created_by TEXT,                          -- email do admin que criou
  updated_by TEXT,                          -- email do último que editou
  updated_at TIMESTAMPTZ DEFAULT now();

-- Tracking de conversão em campaign_events (não temos acesso a delivery/read do WhatsApp)
-- Conversão = usuário fez a ação desejada (clicou botão, usou feature, pagou, etc)
ALTER TABLE campaign_events ADD COLUMN IF NOT EXISTS
  conversion_type TEXT,                     -- 'button_click', 'feature_used', 'payment', 'upgrade'
  conversion_value NUMERIC,                 -- valor monetário se aplicável
  attributed_revenue NUMERIC DEFAULT 0;     -- receita atribuída à campanha

-- Índice para analytics de conversão
CREATE INDEX idx_campaign_events_conversion
ON campaign_events(campaign_id, conversion_type, created_at)
WHERE conversion_type IS NOT NULL;

-- Campo para tracking de última mensagem (anti-bombardeio)
ALTER TABLE user_campaigns ADD COLUMN IF NOT EXISTS
  last_message_at TIMESTAMPTZ;
```

### 3.4 bot_stickers - Biblioteca Central

```sql
-- Figurinhas do bot para usar em campanhas
CREATE TABLE bot_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "twitter_animado", "celebrando"
  description TEXT,                      -- "Figurinha de boas vindas"
  storage_path TEXT NOT NULL,            -- "bot-stickers/twitter_animado.webp"
  sticker_url TEXT NOT NULL,             -- URL pública
  tags TEXT[] DEFAULT '{}',              -- ['twitter', 'feature', 'promo']
  category TEXT DEFAULT 'geral',         -- 'feature', 'emotion', 'promo', 'geral'
  is_animated BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,         -- quantas vezes foi enviado
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_bot_stickers_category ON bot_stickers(category);
CREATE INDEX idx_bot_stickers_tags ON bot_stickers USING GIN(tags);
CREATE INDEX idx_bot_stickers_active ON bot_stickers(is_active) WHERE is_active = true;
```

### 3.5 campaign_sticker_pool - Vínculo Campanha ↔ Stickers

```sql
-- Quais stickers cada campanha pode usar
CREATE TABLE campaign_sticker_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES bot_stickers(id) ON DELETE CASCADE,
  step_key TEXT,                         -- NULL = qualquer step, ou 'day_0', 'day_7'
  priority INTEGER DEFAULT 0,            -- ordem de preferência
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(campaign_id, sticker_id, step_key)
);

CREATE INDEX idx_campaign_sticker_pool_campaign ON campaign_sticker_pool(campaign_id);
```

### 3.6 user_campaign_stickers - Tracking de Envio

```sql
-- Quais stickers já foram enviados para cada usuário em cada campanha
-- Evita repetição
CREATE TABLE user_campaign_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sticker_id UUID NOT NULL REFERENCES bot_stickers(id) ON DELETE CASCADE,
  step_key TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, campaign_id, sticker_id)
);

CREATE INDEX idx_user_campaign_stickers_user ON user_campaign_stickers(user_id, campaign_id);
```

### 3.7 campaign_workflow_nodes - Nós do Fluxo Visual

```sql
-- Nós do workflow visual (estilo Miro/Figma)
CREATE TABLE campaign_workflow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,                  -- 'trigger', 'delay', 'message', 'condition', 'action', 'end'
  node_key TEXT NOT NULL,                   -- identificador único no fluxo
  label TEXT,                               -- nome visual do nó
  position_x INTEGER DEFAULT 0,             -- posição X no canvas
  position_y INTEGER DEFAULT 0,             -- posição Y no canvas
  config JSONB DEFAULT '{}',                -- configuração específica do tipo
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(campaign_id, node_key)
);

-- Tipos de nó:
-- trigger: {"event": "limit_hit", "delay_hours": 4}
-- delay: {"hours": 24, "minutes": 0}
-- message: {"step_id": "uuid", "content_type": "buttons"}
-- condition: {"field": "subscription_plan", "operator": "=", "value": "free"}
-- action: {"type": "tag_user", "tag": "engaged"}
-- end: {"reason": "completed"}

CREATE INDEX idx_workflow_nodes_campaign ON campaign_workflow_nodes(campaign_id);
```

### 3.8 campaign_workflow_edges - Conexões entre Nós

```sql
-- Conexões entre nós (arestas do grafo)
CREATE TABLE campaign_workflow_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  source_node_key TEXT NOT NULL,            -- nó de origem
  target_node_key TEXT NOT NULL,            -- nó de destino
  edge_type TEXT DEFAULT 'default',         -- 'default', 'yes', 'no', 'timeout'
  label TEXT,                               -- texto na aresta (ex: "Sim", "Não")
  condition JSONB,                          -- condição para seguir esta aresta
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(campaign_id, source_node_key, target_node_key, edge_type)
);

-- Exemplo de branching:
-- source: "condition_plan_check", target: "message_premium_offer", edge_type: "no"
-- source: "condition_plan_check", target: "message_free_tip", edge_type: "yes"

CREATE INDEX idx_workflow_edges_campaign ON campaign_workflow_edges(campaign_id);
CREATE INDEX idx_workflow_edges_source ON campaign_workflow_edges(source_node_key);
```

### 3.9 campaign_attributions - Attribution Tracking

```sql
-- Atribuição de conversões/pagamentos a campanhas
CREATE TABLE campaign_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  attribution_type TEXT NOT NULL,           -- 'payment', 'upgrade', 'feature_adoption'
  attribution_model TEXT DEFAULT 'last_touch', -- 'last_touch', 'first_touch', 'linear'
  revenue NUMERIC DEFAULT 0,                -- valor em reais
  currency TEXT DEFAULT 'BRL',
  metadata JSONB DEFAULT '{}',              -- {plan: 'premium', payment_id: 'xxx'}
  attributed_at TIMESTAMPTZ DEFAULT now(),

  -- Dados do momento da atribuição
  days_since_enrollment INTEGER,            -- dias desde inscrição na campanha
  steps_completed INTEGER,                  -- quantos steps completou
  last_step_key TEXT                        -- último step recebido
);

CREATE INDEX idx_attributions_campaign ON campaign_attributions(campaign_id, attributed_at);
CREATE INDEX idx_attributions_user ON campaign_attributions(user_id);
CREATE INDEX idx_attributions_type ON campaign_attributions(attribution_type);
```

### 3.10 campaign_ab_results - Resultados de Testes A/B

```sql
-- Resultados agregados de testes A/B para auto-winner
CREATE TABLE campaign_ab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  variant TEXT NOT NULL,

  -- Métricas
  sample_size INTEGER DEFAULT 0,            -- número de usuários
  conversions INTEGER DEFAULT 0,            -- número de conversões
  conversion_rate NUMERIC DEFAULT 0,        -- taxa de conversão
  revenue NUMERIC DEFAULT 0,                -- receita total
  avg_revenue_per_user NUMERIC DEFAULT 0,   -- receita média

  -- Significância estatística
  is_control BOOLEAN DEFAULT false,         -- é o grupo controle?
  confidence_level NUMERIC,                 -- nível de confiança (0-100)
  p_value NUMERIC,                          -- p-value do teste
  is_winner BOOLEAN DEFAULT false,          -- foi declarado vencedor?
  winner_declared_at TIMESTAMPTZ,           -- quando foi declarado

  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(campaign_id, step_key, variant)
);

CREATE INDEX idx_ab_results_campaign ON campaign_ab_results(campaign_id, step_key);
```

### 3.11 Bucket de Storage

```sql
-- Criar bucket para stickers do bot
INSERT INTO storage.buckets (id, name, public)
VALUES ('bot-stickers', 'bot-stickers', true);

-- Policy de leitura pública
CREATE POLICY "Bot stickers são públicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'bot-stickers');

-- Policy de upload (apenas service role)
CREATE POLICY "Upload via service role"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bot-stickers');
```

---

## 4. API Routes (Admin Panel)

### 4.1 Campanhas

```typescript
// GET /api/campaigns
// Lista todas as campanhas com métricas resumidas
Response: {
  campaigns: [{
    id, name, description, campaign_type, status, priority,
    total_enrolled, total_active, total_completed, total_cancelled,
    conversion_rate, created_at
  }]
}

// GET /api/campaigns/[id]
// Detalhes completos + analytics
Response: {
  campaign: { ...full_data },
  steps: [{ step_key, delay_hours, messages: [...] }],
  analytics: { totals, by_step, by_variant, funnel }
}

// PATCH /api/campaigns/[id]
// Atualizar campanha
Body: { status?, description?, settings?, priority? }

// POST /api/campaigns
// Criar nova campanha (wizard)
Body: { name, campaign_type, trigger_config, target_filter, cancel_condition, steps, settings }

// DELETE /api/campaigns/[id]
// Deletar (apenas draft)

// GET /api/campaigns/[id]/users
// Usuários na campanha com filtros
Query: ?status=active&page=1&limit=20

// GET /api/campaigns/[id]/events
// Timeline de eventos
Query: ?limit=50&offset=0

// POST /api/campaigns/preview-audience
// Preview de filtros (quantos usuários)
Body: { target_filter: {...} }
Response: { count: 2340 }
```

### 4.2 Bot Stickers

```typescript
// GET /api/bot-stickers
// Lista stickers do bot
Query: ?category=feature&tags=twitter&active=true

// POST /api/bot-stickers
// Upload de novo sticker
Body: FormData { file, name, description, tags, category }

// PATCH /api/bot-stickers/[id]
// Atualizar sticker
Body: { name?, description?, tags?, category?, is_active? }

// DELETE /api/bot-stickers/[id]
// Remover sticker

// POST /api/campaigns/[id]/stickers
// Vincular stickers à campanha
Body: { sticker_ids: [...], step_key? }

// DELETE /api/campaigns/[id]/stickers/[stickerId]
// Desvincular sticker
```

### 4.3 Opt-out e Suppression

```typescript
// GET /api/campaigns/optouts
// Lista usuários que fizeram opt-out
Query: ?page=1&limit=20&search=5511...
Response: {
  optouts: [{ id, user_id, whatsapp_number, reason, opted_out_at, opted_out_by }],
  total: 23
}

// POST /api/campaigns/optouts
// Adicionar opt-out manualmente (admin)
Body: { whatsapp_number, reason, notes }

// DELETE /api/campaigns/optouts/[id]
// Remover opt-out (usuário quer voltar a receber)

// GET /api/campaigns/suppression
// Lista de supressão
Query: ?reason=legal

// POST /api/campaigns/suppression
// Adicionar à lista de supressão
Body: { whatsapp_number, reason, description, expires_at? }

// DELETE /api/campaigns/suppression/[id]
// Remover da lista de supressão

// POST /api/campaigns/[id]/test
// Enviar mensagem de teste para admin
Body: { test_number: "5511999999999", step_key?: "day_0" }
Response: { success: true, message_id: "..." }

// POST /api/campaigns/[id]/clone
// Clonar campanha existente
Body: { new_name: "twitter_discovery_v3" }
Response: { campaign: { id, name, ... } }
```

---

## 5. Componentes UI

### 5.1 Página Lista de Campanhas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📢 Campanhas                                              [+ Nova Campanha] │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filtros: [Todas ▼] [Tipo ▼]                              🔄 Atualizar      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🟢 twitter_discovery_v2                              hybrid │ active │   │
│  │ Descoberta de feature Twitter/X para usuários free                   │   │
│  │ ───────────────────────────────────────────────────────────────────│   │
│  │ 182 inscritos │ 146 ativos │ 3.8% conversão │ 4 steps               │   │
│  │                                                    [Ver] [Pausar]    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🟢 payment_intent_reminder_v2                        event │ active │   │
│  │ Lembrete para quem selecionou plano mas não pagou                    │   │
│  │ ───────────────────────────────────────────────────────────────────│   │
│  │ 14 inscritos │ 10 ativos │ 21.4% conversão │ 3 steps                │   │
│  │                                                    [Ver] [Pausar]    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ⚪ cleanup_feature_v2                               hybrid │ draft  │   │
│  │ Apresentar feature de limpeza de figurinhas                          │   │
│  │ ───────────────────────────────────────────────────────────────────│   │
│  │ 0 inscritos │ 0 ativos │ - │ 2 steps                                │   │
│  │                                                   [Ver] [Ativar]     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Página de Detalhes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Campanhas    twitter_discovery_v2                    [Editar] [Pausar]   │
│                 hybrid │ 🟢 active                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ 182          │ │ 146          │ │ 7            │ │ 3.8%         │       │
│  │ Inscritos    │ │ Ativos       │ │ Cancelados   │ │ Conversão    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  📊 Funil de Conversão                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ day_0 (4h)   ████████████████████████████████████████  153 (100%)   │   │
│  │ day_7        ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    0 (0%)    │   │
│  │ day_15       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    0 (0%)    │   │
│  │ day_30       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    0 (0%)    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  ⚙️ Configuração                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Trigger:     limit_hit (4 horas após)                               │   │
│  │ Audiência:   subscription_plan = 'free'                             │   │
│  │ Cancelar:    twitter_feature_used = true                            │   │
│  │ Rate limit:  200ms │ Batch: 50 │ Janela: 08:00-22:00               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  📝 Steps (4)                                           [+ Adicionar Step]  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Step 0: day_0 (4 horas)                                             │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ 🎬 Dica: Vídeos do Twitter                                      │ │   │
│  │ │ Sabia que você pode baixar vídeos do Twitter/X...               │ │   │
│  │ │ [🎬 Quero ver!] [❌ Não quero]                                  │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │ 🖼️ Stickers: Nenhum vinculado                    [Vincular Sticker] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Wizard de Criação (Step 3 - Filtros)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Nova Campanha                                     Step 3 de 7: Audiência   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Usuários que entram nesta campanha:                                        │
│                                                                             │
│  ┌─ TODOS os critérios devem ser verdadeiros ───────────────────────────┐  │
│  │                                                                       │  │
│  │  [subscription_plan ▼] [é igual a    ▼] [free     ▼]          [✕]   │  │
│  │                                                                       │  │
│  │  [created_at         ▼] [é depois de ▼] [📅 01/01/2026]       [✕]   │  │
│  │                                                                       │  │
│  │  [+ Adicionar filtro]                                                 │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Preview: ~2.340 usuários elegíveis                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Campos disponíveis:                                                        │
│  • subscription_plan (free, premium, ultra)                                │
│  • subscription_status (active, cancelled, expired)                        │
│  • created_at (data de cadastro)                                           │
│  • first_sticker_at (primeira figurinha)                                   │
│  • last_interaction (última interação)                                     │
│  • twitter_feature_used (usou Twitter)                                     │
│  • cleanup_feature_used (usou Cleanup)                                     │
│  • whatsapp_number (começa com - país)                                     │
│                                                                             │
│                                                [← Voltar]    [Próximo →]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Biblioteca de Stickers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🖼️ Stickers do Bot                                        [+ Upload]       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Filtros: [Todas categorias ▼] [Tags: ______]                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │   [IMG]    │ │   [IMG]    │ │   [IMG]    │ │   [IMG]    │               │
│  │ twitter_1  │ │ celebrando │ │ dica_magic │ │ lembrete   │               │
│  │ #feature   │ │ #emotion   │ │ #feature   │ │ #reminder  │               │
│  │ 45 envios  │ │ 120 envios │ │ 0 envios   │ │ 30 envios  │               │
│  │ [Editar]   │ │ [Editar]   │ │ [Editar]   │ │ [Editar]   │               │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘               │
│                                                                             │
│  ┌────────────┐ ┌────────────┐                                              │
│  │   [IMG]    │ │   [IMG]    │                                              │
│  │ promo_pix  │ │ urgente    │                                              │
│  │ #promo     │ │ #reminder  │                                              │
│  │ 80 envios  │ │ 15 envios  │                                              │
│  │ [Editar]   │ │ [Editar]   │                                              │
│  └────────────┘ └────────────┘                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Página de Opt-outs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🚫 Opt-outs de Campanhas                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Usuários que pediram para não receber mensagens de campanhas.              │
│  Total: 23 opt-outs                                                         │
│                                                                             │
│  Buscar: [________________] 🔍                      [+ Adicionar Opt-out]   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Número         │ Motivo          │ Data       │ Por      │ Ações     │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ 5511999999999  │ user_requested  │ 10/01/2026 │ user     │ [Remover] │  │
│  │ 5521888888888  │ complaint       │ 08/01/2026 │ admin    │ [Remover] │  │
│  │ 5531777777777  │ user_requested  │ 05/01/2026 │ user     │ [Remover] │  │
│  │ 5541666666666  │ bounce          │ 03/01/2026 │ system   │ [Remover] │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ℹ️ Usuários com opt-out não serão inscritos em novas campanhas e terão     │
│     campanhas ativas canceladas automaticamente.                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.6 Página de Lista de Supressão

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⛔ Lista de Supressão                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⚠️ Números nesta lista NUNCA receberão campanhas, independente de opt-out.  │
│  Use para casos legais, reclamações graves, parceiros e testes.             │
│                                                                             │
│  Filtrar: [Todos os motivos ▼]                      [+ Adicionar Número]    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Número         │ Motivo    │ Descrição              │ Expira  │ Ações │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ 5511999999999  │ 🔴 legal  │ Processo judicial #123 │ -       │ [✕]   │  │
│  │ 5521888888888  │ 🟠 compl. │ Reclamou no RA         │ -       │ [✕]   │  │
│  │ 5531777777777  │ 🟣 vip    │ CEO da empresa X       │ -       │ [✕]   │  │
│  │ 5541666666666  │ 🔵 test   │ Número de teste QA     │ -       │ [✕]   │  │
│  │ 5551555555555  │ 🟢 partner│ Parceiro Evolution API │ 30/06   │ [✕]   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Legenda: 🔴 Legal  🟠 Complaint  🟣 VIP  🔵 Test  🟢 Partner               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.7 Modal de Teste de Campanha

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📤 Enviar Mensagem de Teste                                         [✕]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Campanha: twitter_discovery_v2                                             │
│                                                                             │
│  Step a testar:                                                             │
│  [day_0 - Dica de vídeos Twitter ▼]                                        │
│                                                                             │
│  Variante:                                                                  │
│  [● default  ○ benefit  ○ urgency]                                         │
│                                                                             │
│  Número para teste:                                                         │
│  [5511999999999_____________]                                               │
│                                                                             │
│  ⚠️ A mensagem será enviada imediatamente para o número informado.          │
│     Use seu próprio número para testar.                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Preview:                                                           │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │ 🎬 Dica: Vídeos do Twitter                                    │ │   │
│  │  │                                                                │ │   │
│  │  │ Sabia que você pode baixar vídeos do Twitter/X e              │ │   │
│  │  │ transformar em figurinhas?                                     │ │   │
│  │  │                                                                │ │   │
│  │  │ É só me enviar o link do tweet! 🔗                            │ │   │
│  │  │                                                                │ │   │
│  │  │ [🎬 Quero ver!] [❌ Não quero]                                │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                        [Cancelar]  [📤 Enviar Teste]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.8 Modal de Clonar Campanha

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📋 Clonar Campanha                                                  [✕]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Campanha original: twitter_discovery_v2                                    │
│                                                                             │
│  Nome da nova campanha:                                                     │
│  [twitter_discovery_v3_______]                                              │
│                                                                             │
│  O que será copiado:                                                        │
│  ✅ Configurações (trigger, filtros, cancel condition)                      │
│  ✅ Steps e delays                                                          │
│  ✅ Mensagens e variantes                                                   │
│  ✅ Stickers vinculados                                                     │
│                                                                             │
│  O que NÃO será copiado:                                                    │
│  ❌ Usuários inscritos                                                      │
│  ❌ Eventos e métricas                                                      │
│  ❌ Status (nova será draft)                                                │
│                                                                             │
│                                         [Cancelar]  [📋 Criar Clone]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.9 Visual Workflow Builder

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔀 Editor de Fluxo: twitter_discovery_v3                    [Salvar] [✕]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Toolbox:                    Canvas:                                        │
│  ┌─────────┐                                                                │
│  │ ⚡Trigger│     ┌──────────────┐                                          │
│  │ ⏱️ Delay │     │  ⚡ Trigger   │                                          │
│  │ 💬Message│     │  limit_hit   │                                          │
│  │ ❓Condição│    │  delay: 4h   │                                          │
│  │ 🎯 Ação  │     └──────┬───────┘                                          │
│  │ 🏁 Fim   │            │                                                  │
│  └─────────┘            ▼                                                  │
│                  ┌──────────────┐                                           │
│                  │  ⏱️ Delay    │                                           │
│                  │   4 horas    │                                           │
│                  └──────┬───────┘                                           │
│                         │                                                   │
│                         ▼                                                   │
│                  ┌──────────────┐                                           │
│                  │ 💬 Message   │                                           │
│                  │  day_0       │                                           │
│                  │ "Dica Twitter"                                           │
│                  └──────┬───────┘                                           │
│                         │                                                   │
│                         ▼                                                   │
│                  ┌──────────────┐                                           │
│                  │ ❓ Condição  │                                           │
│                  │ clicou_btn?  │                                           │
│                  └───┬─────┬───┘                                            │
│                 Sim  │     │  Não                                           │
│                      ▼     ▼                                                │
│               ┌────────┐ ┌────────┐                                         │
│               │🏁 Fim  │ │⏱️Delay │                                         │
│               │converted│ │ 7 dias │                                        │
│               └────────┘ └───┬────┘                                         │
│                              │                                              │
│                              ▼                                              │
│                       ┌──────────────┐                                      │
│                       │ 💬 Message   │                                      │
│                       │  day_7       │                                      │
│                       │ "Lembrete"   │                                      │
│                       └──────────────┘                                      │
│                                                                             │
│  Zoom: [−] [100%] [+]              [Validar Fluxo] [Preview] [Exportar]    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.10 Dashboard de Attribution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  💰 Attribution & ROI                                    [Período: 30d ▼]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌──────────────┐ │
│  │ R$ 2.340       │ │ R$ 450         │ │ 520%           │ │ 47           │ │
│  │ Receita Total  │ │ Custo (est.)   │ │ ROI            │ │ Conversões   │ │
│  └────────────────┘ └────────────────┘ └────────────────┘ └──────────────┘ │
│                                                                             │
│  Receita por Campanha:                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Campanha                    │ Inscritos │ Conversões │ Receita │ ROI │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ payment_intent_reminder_v2  │    14     │     3      │ R$ 897  │ 890%│   │
│  │ twitter_discovery_v2        │   182     │    12      │ R$ 1.188│ 420%│   │
│  │ limit_reached_v2            │   207     │    32      │ R$ 255  │ 180%│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Modelo de Atribuição: [Last Touch ▼]                                       │
│                                                                             │
│  Timeline de Conversões:                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │     ▂▂▃▃▄▅▆▆▇█████▇▆▆▅▄▃▃▂▂                                        │   │
│  │  Jan 1                                                    Jan 15    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.11 Cohort Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Cohort Analysis                                [Campanha: Todas ▼]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Retention por Semana de Inscrição:                                         │
│                                                                             │
│  Cohort      │ Sem 0  │ Sem 1  │ Sem 2  │ Sem 3  │ Sem 4  │                │
│  ────────────┼────────┼────────┼────────┼────────┼────────┤                │
│  01-07 Jan   │ 100%   │  45%   │  32%   │  28%   │  25%   │ █████░░░░░    │
│  08-14 Jan   │ 100%   │  52%   │  38%   │  35%   │   -    │ ██████░░░░    │
│  15-21 Jan   │ 100%   │  48%   │  40%   │   -    │   -    │ █████░░░░░    │
│  22-28 Jan   │ 100%   │  55%   │   -    │   -    │   -    │ ██████░░░░    │
│  29-04 Fev   │ 100%   │   -    │   -    │   -    │   -    │ ██████████    │
│                                                                             │
│  📈 Tendência: Cohorts recentes têm +15% melhor retenção                    │
│                                                                             │
│  Métricas por Cohort:                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Cohort 01-07 Jan: 120 users, 15 conversões (12.5%), R$ 450       │   │
│  │ • Cohort 08-14 Jan: 98 users, 14 conversões (14.3%), R$ 520        │   │
│  │ • Cohort 15-21 Jan: 145 users, 25 conversões (17.2%), R$ 780       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                          [Export CSV] [Export PDF]          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.12 Auto-Winner A/B Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏆 A/B Test: twitter_discovery_v2 → day_0                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Status: 🟡 Em andamento (67% do sample size mínimo)                        │
│  Confiança requerida: 95% │ Sample mínimo: 100 por variante                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Variante     │ Sample │ Conversões │ Taxa    │ vs Control │ Status │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ 🔵 control   │   67   │     5      │  7.5%   │    -       │ base   │   │
│  │ 🟢 benefit   │   65   │     8      │ 12.3%   │  +64%      │ 🔼 líder│   │
│  │ 🟠 urgency   │   68   │     6      │  8.8%   │  +17%      │ -      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Evolução da Confiança:                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ benefit vs control:  ████████████████░░░░░░░░░  78% (precisa 95%)  │   │
│  │ urgency vs control:  ██████░░░░░░░░░░░░░░░░░░░  42%                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  📊 Projeção: Com ritmo atual, winner em ~5 dias                            │
│                                                                             │
│  Configurações:                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [✓] Auto-declarar winner quando atingir 95% confiança               │   │
│  │ [✓] Pausar variantes perdedoras automaticamente                     │   │
│  │ [✓] Notificar admin por WhatsApp quando winner declarado            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                           [Pausar Teste] [Declarar Winner Manual]           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Fluxo de Opt-out no Bot

### 6.1 Detecção de Intenção

```typescript
// Palavras-chave que indicam opt-out
const optoutKeywords = [
  'parar', 'sair', 'cancelar', 'não quero', 'unsubscribe',
  'stop', 'remover', 'desinscrever', 'chega', 'para'
];

// Detectar se mensagem é pedido de opt-out
function isOptoutRequest(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return optoutKeywords.some(kw => lower.includes(kw)) &&
         (lower.includes('campanha') || lower.includes('mensagem') ||
          lower.includes('promo') || lower.length < 30);
}
```

### 6.2 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE OPT-OUT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Usuário envia:                                                             │
│  "parar" / "não quero mais mensagens" / "cancelar campanhas"               │
│                        ↓                                                    │
│  Bot detecta intenção de opt-out                                           │
│                        ↓                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ "Você quer parar de receber mensagens promocionais? 📭"             │   │
│  │                                                                      │   │
│  │ Você continuará podendo usar o bot normalmente para criar           │   │
│  │ figurinhas. Só não receberá mais dicas e novidades.                 │   │
│  │                                                                      │   │
│  │  [✅ Sim, parar]    [❌ Não, continuar recebendo]                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                        ↓                                                    │
│  Se "Sim, parar":                                                          │
│  1. Inserir em campaign_optouts                                            │
│  2. Cancelar todas user_campaigns ativas (reason: 'user_optout')          │
│  3. Enviar confirmação                                                     │
│                        ↓                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ "Pronto! ✅                                                         │   │
│  │                                                                      │   │
│  │ Você não receberá mais mensagens promocionais.                      │   │
│  │                                                                      │   │
│  │ Pode continuar usando o bot normalmente para criar suas             │   │
│  │ figurinhas! 🎨                                                      │   │
│  │                                                                      │   │
│  │ Se mudar de ideia, é só me enviar: 'quero receber novidades'"       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Se "Não, continuar recebendo":                                            │
│  → "Beleza! Você continuará recebendo nossas dicas e novidades. 📬"        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Re-opt-in (Voltar a Receber)

```
Usuário: "quero receber novidades"
                  ↓
Bot verifica se tem opt-out
                  ↓
Se tiver:
┌─────────────────────────────────────────────────────────────────────────────┐
│ "Que bom que quer voltar! 🎉                                                │
│                                                                             │
│ Vou reativar suas notificações de novidades e dicas.                       │
│                                                                             │
│ [✅ Reativar]    [❌ Cancelar]"                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                  ↓
Se confirmar: DELETE from campaign_optouts WHERE user_id = ...
```

---

## 7. Fluxo: Envio de Sticker na Campanha

### 7.1 Lógica de Seleção

```typescript
// Quando enviar mensagem de campanha:
async function sendCampaignMessageWithSticker(userId, campaign, step, message) {
  // 1. Enviar mensagem principal
  await sendCampaignMessage(userId, campaign, step, message);

  // 2. Buscar stickers disponíveis para este step
  const availableStickers = await getAvailableStickersForStep(
    campaign.id,
    step.step_key
  );

  if (availableStickers.length === 0) return;

  // 3. Filtrar stickers já enviados para este usuário nesta campanha
  const sentStickers = await getSentStickersForUser(userId, campaign.id);
  const unsentStickers = availableStickers.filter(
    s => !sentStickers.includes(s.id)
  );

  if (unsentStickers.length === 0) {
    // Já enviou todos, pode repetir ou não enviar
    return;
  }

  // 4. Selecionar sticker (por prioridade ou random)
  const sticker = selectSticker(unsentStickers);

  // 5. Enviar sticker
  await sendSticker(userId, sticker.sticker_url);

  // 6. Registrar envio
  await logStickerSent(userId, campaign.id, sticker.id, step.step_key);

  // 7. Incrementar contador de uso
  await incrementStickerUsage(sticker.id);
}
```

### 7.2 Ordem de Envio

```
Mensagem de texto/botões
        ↓
   (aguarda 1-2s)
        ↓
Figurinha relacionada
```

**Importante:** A figurinha vai DEPOIS da mensagem para:
- Não distrair do conteúdo principal
- Funcionar como "assinatura visual"
- Reforçar a marca (bot de figurinhas)

---

## 8. RPCs Novas

### 8.1 list_campaigns_with_stats

```sql
CREATE OR REPLACE FUNCTION list_campaigns_with_stats()
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  description TEXT,
  campaign_type VARCHAR,
  status VARCHAR,
  priority INTEGER,
  created_at TIMESTAMPTZ,
  total_enrolled BIGINT,
  total_active BIGINT,
  total_completed BIGINT,
  total_cancelled BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.campaign_type,
    c.status,
    c.priority,
    c.created_at,
    COUNT(uc.id) as total_enrolled,
    COUNT(uc.id) FILTER (WHERE uc.status = 'active') as total_active,
    COUNT(uc.id) FILTER (WHERE uc.status = 'completed') as total_completed,
    COUNT(uc.id) FILTER (WHERE uc.status = 'cancelled') as total_cancelled,
    CASE
      WHEN COUNT(uc.id) > 0
      THEN ROUND(COUNT(uc.id) FILTER (WHERE uc.status = 'completed')::NUMERIC / COUNT(uc.id) * 100, 2)
      ELSE 0
    END as conversion_rate
  FROM campaigns c
  LEFT JOIN user_campaigns uc ON uc.campaign_id = c.id
  GROUP BY c.id
  ORDER BY
    CASE c.status
      WHEN 'active' THEN 1
      WHEN 'paused' THEN 2
      WHEN 'draft' THEN 3
      ELSE 4
    END,
    c.priority ASC;
END;
$$;
```

### 8.2 preview_campaign_audience

```sql
CREATE OR REPLACE FUNCTION preview_campaign_audience(
  p_target_filter JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_sql TEXT := 'SELECT COUNT(*) FROM users WHERE 1=1';
BEGIN
  -- subscription_plan
  IF p_target_filter ? 'subscription_plan' THEN
    v_sql := v_sql || format(' AND subscription_plan = %L',
      p_target_filter->>'subscription_plan');
  END IF;

  -- subscription_status
  IF p_target_filter ? 'subscription_status' THEN
    IF p_target_filter->>'subscription_status' = 'null' THEN
      v_sql := v_sql || ' AND subscription_status IS NULL';
    ELSE
      v_sql := v_sql || format(' AND subscription_status = %L',
        p_target_filter->>'subscription_status');
    END IF;
  END IF;

  -- created_after
  IF p_target_filter ? 'created_after' THEN
    v_sql := v_sql || format(' AND created_at >= %L',
      p_target_filter->>'created_after');
  END IF;

  -- created_before
  IF p_target_filter ? 'created_before' THEN
    v_sql := v_sql || format(' AND created_at <= %L',
      p_target_filter->>'created_before');
  END IF;

  -- twitter_feature_used
  IF p_target_filter ? 'twitter_feature_used' THEN
    v_sql := v_sql || format(' AND twitter_feature_used = %L',
      (p_target_filter->>'twitter_feature_used')::boolean);
  END IF;

  -- cleanup_feature_used
  IF p_target_filter ? 'cleanup_feature_used' THEN
    v_sql := v_sql || format(' AND cleanup_feature_used = %L',
      (p_target_filter->>'cleanup_feature_used')::boolean);
  END IF;

  -- whatsapp_country (prefixo)
  IF p_target_filter ? 'whatsapp_country' THEN
    v_sql := v_sql || format(' AND whatsapp_number LIKE %L',
      p_target_filter->>'whatsapp_country' || '%');
  END IF;

  EXECUTE v_sql INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;
```

### 8.3 get_next_campaign_sticker

```sql
CREATE OR REPLACE FUNCTION get_next_campaign_sticker(
  p_user_id UUID,
  p_campaign_id UUID,
  p_step_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  sticker_id UUID,
  sticker_url TEXT,
  sticker_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bs.id as sticker_id,
    bs.sticker_url,
    bs.name as sticker_name
  FROM campaign_sticker_pool csp
  JOIN bot_stickers bs ON bs.id = csp.sticker_id
  WHERE csp.campaign_id = p_campaign_id
    AND bs.is_active = true
    AND (csp.step_key IS NULL OR csp.step_key = p_step_key)
    AND bs.id NOT IN (
      SELECT ucs.sticker_id
      FROM user_campaign_stickers ucs
      WHERE ucs.user_id = p_user_id
        AND ucs.campaign_id = p_campaign_id
    )
  ORDER BY csp.priority ASC, RANDOM()
  LIMIT 1;
END;
$$;
```

### 8.4 handle_user_optout

```sql
-- Processar opt-out de usuário
CREATE OR REPLACE FUNCTION handle_user_optout(
  p_user_id UUID,
  p_whatsapp_number TEXT,
  p_reason TEXT DEFAULT 'user_requested',
  p_source TEXT DEFAULT 'bot_message'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cancelled_count INTEGER := 0;
BEGIN
  -- 1. Inserir opt-out (ou ignorar se já existe)
  INSERT INTO campaign_optouts (user_id, whatsapp_number, reason, source, opted_out_by)
  VALUES (p_user_id, p_whatsapp_number, p_reason, p_source, 'user')
  ON CONFLICT (whatsapp_number) DO NOTHING;

  -- 2. Cancelar todas as campanhas ativas do usuário
  UPDATE user_campaigns
  SET status = 'cancelled',
      cancel_reason = 'user_optout',
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND status IN ('active', 'pending');

  GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_campaigns', v_cancelled_count
  );
END;
$$;
```

### 8.5 is_user_eligible_for_campaign

```sql
-- Verificar se usuário pode receber campanhas
CREATE OR REPLACE FUNCTION is_user_eligible_for_campaign(
  p_user_id UUID,
  p_whatsapp_number TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar opt-out
  IF EXISTS (
    SELECT 1 FROM campaign_optouts
    WHERE user_id = p_user_id OR whatsapp_number = p_whatsapp_number
  ) THEN
    RETURN false;
  END IF;

  -- Verificar suppression list
  IF EXISTS (
    SELECT 1 FROM campaign_suppression_list
    WHERE whatsapp_number = p_whatsapp_number
      AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
```

---

## 9. Checklist de Implementação

### FASE 1: Visualização + Compliance (Read-Only)
- [ ] Criar tabela `campaign_optouts`
- [ ] Criar tabela `campaign_suppression_list`
- [ ] Criar página `/campaigns` com lista
- [ ] Criar página `/campaigns/[id]` com detalhes
- [ ] Criar página `/campaigns/optouts`
- [ ] Criar página `/campaigns/suppression`
- [ ] API route `GET /api/campaigns`
- [ ] API route `GET /api/campaigns/[id]`
- [ ] API route `GET /api/campaigns/optouts`
- [ ] API route `GET /api/campaigns/suppression`
- [ ] Componente de card de campanha
- [ ] Componente de funil de conversão
- [ ] Gráfico de analytics por step
- [ ] Timeline de eventos recentes

### FASE 2: Gerenciamento Básico
- [ ] API route `PATCH /api/campaigns/[id]`
- [ ] Toggle ativar/pausar campanha
- [ ] Editar settings (rate limit, janela)
- [ ] Lista de usuários na campanha
- [ ] Filtros de usuários (status)
- [ ] Adicionar campos `scheduled_start_at`, `scheduled_end_at` em campaigns
- [ ] Adicionar campos de conversion tracking em campaign_events
- [ ] API route `POST /api/campaigns/[id]/test` (enviar teste)
- [ ] Modal de enviar mensagem de teste
- [ ] API route `POST /api/campaigns/[id]/clone`
- [ ] Modal de clonar campanha
- [ ] CRUD de opt-outs (adicionar/remover)
- [ ] CRUD de suppression list (adicionar/remover)

### FASE 3: Biblioteca de Stickers
- [ ] Criar tabela `bot_stickers`
- [ ] Criar tabela `campaign_sticker_pool`
- [ ] Criar tabela `user_campaign_stickers`
- [ ] Criar bucket `bot-stickers`
- [ ] Página `/campaigns/stickers`
- [ ] API routes CRUD stickers
- [ ] Upload de stickers (drag & drop)
- [ ] Vincular stickers a campanhas
- [ ] Integrar envio no campaignService

### FASE 4: Criação de Campanhas
- [ ] Wizard multi-step
- [ ] Step 1: Info básica
- [ ] Step 2: Trigger config
- [ ] Step 3: Builder de filtros
- [ ] Step 4: Cancel condition
- [ ] Step 5: Steps/mensagens
- [ ] Step 6: Vincular stickers
- [ ] Step 7: Revisão
- [ ] API route `POST /api/campaigns`
- [ ] RPC `preview_campaign_audience`
- [ ] Preview de mensagem estilo WhatsApp
- [ ] Activity log (quem criou/editou)

### FASE 5: Opt-out no Bot + Testes A/B
- [ ] Implementar detecção de opt-out no bot
- [ ] Fluxo de confirmação de opt-out
- [ ] Fluxo de re-opt-in
- [ ] RPC `handle_user_optout`
- [ ] UI para criar variantes A/B
- [ ] Definir pesos de variantes
- [ ] Dashboard de comparação A/B
- [ ] Métricas por variante
- [ ] Export CSV/PDF de relatórios

### FASE 6: Visual Workflow Builder + Analytics Avançado
**6.1 Visual Workflow Builder (estilo Miro/Figma)**
- [ ] Criar tabela `campaign_workflow_nodes`
- [ ] Criar tabela `campaign_workflow_edges`
- [ ] Canvas drag-and-drop com React Flow ou similar
- [ ] Tipos de nó: trigger, delay, message, condition, action, end
- [ ] Conexões entre nós com labels
- [ ] Validação de fluxo (sem nós órfãos, sem loops infinitos)
- [ ] Converter workflow visual → campaign_steps
- [ ] Preview do fluxo em modo leitura

**6.2 Branching Logic**
- [ ] Nó de condição com operadores (=, !=, >, <, contains)
- [ ] Campos condicionais: subscription_plan, feature_used, button_clicked, days_since
- [ ] Múltiplas saídas por nó (yes/no, A/B/C)
- [ ] Timeout branches (se não responder em X horas)
- [ ] Engine de execução de fluxo com branching
- [ ] Visualização de path do usuário no fluxo

**6.3 Attribution Tracking**
- [ ] Criar tabela `campaign_attributions`
- [ ] Hook em pagamentos para atribuir a campanhas
- [ ] Modelos: last_touch, first_touch, linear
- [ ] Dashboard de receita por campanha
- [ ] ROI calculator (custo vs receita)
- [ ] Relatório de atribuição por período

**6.4 Cohort Analysis**
- [ ] Definir cohorts por período de inscrição
- [ ] Comparar métricas entre cohorts
- [ ] Retention curve por cohort
- [ ] Heatmap de engajamento
- [ ] Export de cohort data

**6.5 Auto-winner A/B**
- [ ] Criar tabela `campaign_ab_results`
- [ ] Cálculo de significância estatística (z-test)
- [ ] Configurar threshold de confiança (95%, 99%)
- [ ] Configurar sample size mínimo
- [ ] Auto-pausar variantes perdedoras
- [ ] Notificação quando winner é declarado
- [ ] Dashboard de evolução do teste

#### ✅ STATUS DA IMPLEMENTAÇÃO - FASE 6 (Atualizado 2026-01-16)

**6.1 Visual Workflow Builder - ✅ CONCLUÍDO**
- ✅ Canvas drag-and-drop com React Flow implementado
- ✅ Tipos de nó: trigger, delay, message, condition, action, end
- ✅ Preview do fluxo em modo leitura
- ✅ ConditionNode melhorado com editor amigável
- ⚪ Tabelas workflow_nodes/edges (pendente - em planejamento)
- ⚪ Conversão completa workflow → campaign_steps (pendente)

**6.2 Audience Builder com Segmentação Visual - ✅ CONCLUÍDO**
- ✅ Builder visual de filtros estilo HubSpot/Mailchimp
- ✅ 9 campos de segmentação disponíveis:
  - Plano (Free/Basic/Premium/Ultra)
  - Status da Assinatura (Ativa/Cancelada/Atrasada)
  - Figurinhas Criadas (número)
  - Dias Desde Cadastro (número)
  - Dias Inativo (número)
  - Usou Twitter (Sim/Não)
  - Usou Cleanup (Sim/Não)
  - País (Brasil/EUA/Portugal/Espanha)
  - Grupo A/B (Controle/Bonus)
- ✅ Operadores em português ("é igual a", "maior que", etc.)
- ✅ Preview em tempo real com debounce (500ms):
  - Contagem total de usuários
  - Percentual da base
  - Barra de progresso visual
  - Breakdown por plano
  - Tabela com amostra de 5 usuários
- ✅ Múltiplas condições com lógica AND
- ✅ Integração no wizard de criação (Step 3)
- ✅ Integração no editor visual de workflow (ConditionNode)
- ✅ API de preview performática (`/api/campaigns/preview-audience`)
- ✅ Conversão automática para `target_filter`

**Arquivos Criados/Modificados:**
```
✅ /src/components/campaigns/audience-builder.tsx (NOVO - 330 linhas)
   - Component principal do builder visual
   - 9 campos de filtro com operadores
   - Preview em tempo real
   - Helper: conditionsToTargetFilter()

✅ /src/app/api/campaigns/preview-audience/route.ts (ATUALIZADO)
   - Suporte para FilterCondition[] format
   - Operadores: eq, neq, gt, gte, lt, lte
   - Retorna: total, totalBase, byPlan, sampleUsers
   - Fallback quando RPC não existe

✅ /src/app/(dashboard)/campaigns/new/page.tsx (ATUALIZADO)
   - Step 3: integração do AudienceBuilder
   - Fix: SelectItem empty values (_none placeholder)
   - Conversão para target_filter ao salvar

✅ /src/app/(dashboard)/campaigns/[id]/workflow/page.tsx (ATUALIZADO)
   - ConditionNode com editor amigável
   - Interface "Se o usuário..."
   - Preview visual da condição configurada
   - Inputs condicionais por tipo de campo

✅ /tests/audience-builder.spec.ts (NOVO - Playwright E2E)
   - Testes de fluxo completo
   - Login helper com proper waits
   - Verificação de preview em tempo real

✅ playwright.config.ts (NOVO)
   - Configuração de testes E2E
   - Workers sequenciais para evitar conflitos

✅ AUDIENCE-BUILDER-DEMO.md (NOVO)
   - Documentação técnica completa
   - Exemplos de uso
   - Guia de teste

✅ DEMONSTRACAO-VISUAL.md (NOVO)
   - Demonstração visual com ASCII art
   - Walkthrough passo a passo
   - Cenários de uso reais
```

**Bugs Corrigidos:**
- ✅ Erro de SelectItem com value vazio (usando placeholder `_none`)
- ✅ Timing issues no login do Playwright (waitForFunction)
- ✅ Preview não atualizando (debounce implementado)

**Próximos Passos (Fase 6 Pendente):**
- ⚪ 6.3 Attribution Tracking (receita por campanha)
- ⚪ 6.4 Cohort Analysis (retention curves)
- ⚪ 6.5 Auto-winner A/B (significância estatística)

---

## 10. Regras de Segurança e Boas Práticas

### 10.1 Anti-Bombardeio de Usuários

**Situação Atual:**
- 7 usuários já estão em 2 campanhas simultaneamente
- Não há limite de campanhas por usuário
- Não há intervalo mínimo entre mensagens de campanhas diferentes

**Regras Propostas:**

| Regra | Valor | Descrição |
|-------|-------|-----------|
| Max campanhas ativas por usuário | 3 | Evita sobrecarga |
| Intervalo mínimo entre campanhas | 4 horas | Não enviar 2 campanhas no mesmo momento |
| Cooldown após conversão | 7 dias | Usuário que converteu fica em "paz" |
| Max mensagens/dia por usuário | 5 | Limite absoluto de mensagens de campanha |

**Alertas no Admin Panel:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ ALERTAS DE ATENÇÃO                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔴 7 usuários em 3+ campanhas simultâneas                                 │
│     Risco de spam. Considere pausar campanhas de menor prioridade.         │
│                                                        [Ver usuários]       │
│                                                                             │
│  🟡 twitter_discovery_v2 com 42.621 falhas de envio                        │
│     Taxa de falha alta. Verificar conexão WhatsApp.                         │
│                                                        [Ver detalhes]       │
│                                                                             │
│  🟢 Rate limit saudável: 20 msgs/min (máx recomendado: 30)                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Implementação:**

```sql
-- Nova coluna em user_campaigns
ALTER TABLE user_campaigns ADD COLUMN IF NOT EXISTS
  last_message_at TIMESTAMPTZ;

-- RPC para verificar se pode enviar
CREATE OR REPLACE FUNCTION can_send_campaign_message(
  p_user_id UUID,
  p_campaign_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_active_campaigns INTEGER;
  v_last_message TIMESTAMPTZ;
  v_messages_today INTEGER;
BEGIN
  -- Contar campanhas ativas
  SELECT COUNT(*) INTO v_active_campaigns
  FROM user_campaigns
  WHERE user_id = p_user_id
    AND status IN ('active', 'pending');

  IF v_active_campaigns > 3 THEN
    RETURN false; -- Muitas campanhas
  END IF;

  -- Verificar última mensagem (qualquer campanha)
  SELECT MAX(last_message_at) INTO v_last_message
  FROM user_campaigns
  WHERE user_id = p_user_id;

  IF v_last_message > NOW() - INTERVAL '4 hours' THEN
    RETURN false; -- Muito recente
  END IF;

  -- Contar mensagens hoje
  SELECT COUNT(*) INTO v_messages_today
  FROM campaign_events
  WHERE user_id = p_user_id
    AND event_type = 'step_sent'
    AND created_at > CURRENT_DATE;

  IF v_messages_today >= 5 THEN
    RETURN false; -- Limite diário
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

### 10.2 Canal de Saída (Evolution vs Avisa)

**Como funciona hoje:**

| Content Type | API Usada | Observação |
|--------------|-----------|------------|
| `text` | Evolution API | Texto simples |
| `buttons` | **Avisa API** | Botões interativos (só BR) |
| `sticker` | TODO | Não implementado |
| `image` | TODO | Não implementado |

**Código atual (campaignService.ts:240-260):**
```typescript
case 'buttons':
  if (buttons && buttons.length > 0) {
    await sendButtons({        // ← AVISA API
      number: user_number,
      title: processedTitle,
      desc: processedBody,
      footer: footer || undefined,
      buttons: buttonData,
    });
  } else {
    await sendText(user_number, processedBody);  // ← EVOLUTION API
  }
  break;
```

**Importante:**
- Avisa API só funciona para números **brasileiros** (55...)
- Para números internacionais, precisa fallback para Evolution
- Botões não funcionam em todos os casos (WhatsApp Web antigo, etc)

**Melhoria proposta:**
```typescript
// Verificar se é número BR antes de usar Avisa
const isBrazilian = user_number.startsWith('55');

if (content_type === 'buttons' && buttons?.length > 0) {
  if (isBrazilian) {
    await sendButtons({ ... });  // Avisa API
  } else {
    // Fallback: texto + emojis para botões
    const fallbackText = `${title}\n\n${body}\n\n` +
      buttons.map((b, i) => `${i+1}. ${b.text}`).join('\n');
    await sendText(user_number, fallbackText);  // Evolution API
  }
}
```

**Indicador no Admin Panel:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 Distribuição de Envios                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Evolution API (texto):     ████████████████░░░░  78% (1.230 msgs)        │
│  Avisa API (botões):        ████░░░░░░░░░░░░░░░░  22% (350 msgs)          │
│                                                                             │
│  Por país:                                                                  │
│  🇧🇷 Brasil:                ████████████████████  95% (1.500 msgs)        │
│  🌍 Outros:                 █░░░░░░░░░░░░░░░░░░░   5% (80 msgs)           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Velocidade de Disparo (Rate Limiting)

**Configuração Atual:**

| Parâmetro | Valor | Significado |
|-----------|-------|-------------|
| `rate_limit_ms` | 200ms | Delay entre cada mensagem |
| `batch_size` | 50 | Mensagens por execução do worker |
| `worker_interval` | 60s | Worker roda a cada 60 segundos |
| `send_window` | 08:00-22:00 | Horário permitido |
| `randomize_minutes` | 30 | Randomização no agendamento |

**Cálculo de Throughput:**
```
50 msgs × 200ms = 10 segundos por batch
Worker roda a cada 60s
= Máximo ~50 msgs/minuto (se tiver demanda)
= ~3.000 msgs/hora teórico
```

**Recomendações WhatsApp (não oficial):**
| Tipo de Conta | Limite Sugerido | Nossa Config |
|---------------|-----------------|--------------|
| Business API | ~80 msgs/min | 50 msgs/min ✅ |
| Normal | ~30 msgs/min | N/A |

**Alertas de Rate Limit no Admin:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚡ Rate Limit Monitor                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Última hora:                                                               │
│  ├── Enviadas: 120 mensagens                                               │
│  ├── Falhas: 3 (2.5%)                                                      │
│  └── Taxa: 2 msgs/min (saudável)                                           │
│                                                                             │
│  Status: 🟢 Normal                                                          │
│                                                                             │
│  ┌─ Configuração Global ─────────────────────────────────────────────────┐ │
│  │ Rate limit:    [200] ms        (150-500 recomendado)                  │ │
│  │ Batch size:    [50]            (20-100 recomendado)                   │ │
│  │ Janela envio:  [08:00] - [22:00]                                      │ │
│  │                                                   [Salvar Alterações] │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ⚠️ Se taxa de falha > 5%, considere aumentar rate_limit_ms                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Proteções Implementadas:**
1. ✅ `FOR UPDATE SKIP LOCKED` - Evita processar mesmo usuário 2x
2. ✅ `send_window` - Não envia de madrugada
3. ✅ `randomize_minutes` - Evita picos de envio no mesmo horário
4. ✅ Recovery automático - Jobs travados são revertidos após 10min

**Proteções a Adicionar:**
1. ⚪ Limite de mensagens/dia por usuário
2. ⚪ Cooldown após muitas falhas consecutivas
3. ⚪ Alerta automático se taxa de falha > 5%
4. ⚪ Pausar automaticamente se WhatsApp desconectar

### 10.4 Dashboard de Saúde de Campanhas

Novo card no dashboard principal:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📢 Saúde das Campanhas                                    [Ver detalhes]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ 3 ativas   │ │ 156 ativos │ │ 2.1%       │ │ 🟢 Normal  │               │
│  │ campanhas  │ │ na fila    │ │ falhas     │ │ rate limit │               │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘               │
│                                                                             │
│  Alertas:                                                                   │
│  • ⚠️ 7 usuários em múltiplas campanhas                                    │
│  • ✅ WhatsApp conectado (Evolution + Avisa)                               │
│  • ✅ Janela de envio ativa (08:00-22:00)                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Filtros complexos quebram | Média | Alto | Validação rigorosa, preview antes de salvar |
| Sticker duplicado para usuário | Baixa | Baixo | Tracking em user_campaign_stickers |
| Campanha criada errada | Média | Médio | Criar como draft, revisar antes de ativar |
| Rate limit WhatsApp | Baixa | Alto | Manter limites conservadores |
| Storage de stickers cheio | Baixa | Baixo | Monitorar uso, limpar não usados |
| Alta taxa de opt-out | Média | Médio | Monitorar taxa, ajustar frequência/conteúdo |
| Reclamação LGPD | Baixa | Alto | Opt-out funcional, suppression list, logs |
| Número na suppression recebe campanha | Muito Baixa | Alto | Verificar ANTES de enviar, testes |
| Usuário burla opt-out | Baixa | Baixo | Log de auditoria, re-opt-in com confirmação |

---

## 12. Dependências

### Já Existe ✅
- Schema de campanhas completo
- RPCs de enrollment, analytics, cancelamento
- campaignService.ts com toda lógica
- Worker processando a cada 60s
- Admin panel com autenticação

### Precisa Criar ⚪
- **Tabelas Compliance:** campaign_optouts, campaign_suppression_list
- **Tabelas Stickers:** bot_stickers, campaign_sticker_pool, user_campaign_stickers
- **Tabelas Workflow:** campaign_workflow_nodes, campaign_workflow_edges
- **Tabelas Analytics:** campaign_attributions, campaign_ab_results
- **Colunas novas:**
  - campaigns (scheduled_start/end, cloned_from, created_by, updated_by)
  - campaign_events (conversion_type, conversion_value, attributed_revenue)
  - user_campaigns (last_message_at)
- **Bucket:** bot-stickers
- **RPCs:** list_campaigns_with_stats, preview_campaign_audience, get_next_campaign_sticker, can_send_campaign_message, handle_user_optout, is_user_eligible_for_campaign
- **API routes** no admin panel
- **Páginas e componentes UI**
- **Fluxo de opt-out** no bot
- **Visual Workflow Builder** (React Flow ou similar)

---

## 13. Ordem de Execução Sugerida

```
1. FASE 1 (Visualização)
   └─ Sem alterações no banco
   └─ Apenas leitura
   └─ Valida se dados estão corretos

2. FASE 2 (Gerenciamento)
   └─ Sem alterações no banco
   └─ Apenas updates simples

3. FASE 3 (Stickers)
   └─ Criar tabelas e bucket
   └─ Upload e vínculo
   └─ Integrar no envio

4. FASE 4 (Criação)
   └─ Wizard completo
   └─ Builder de filtros
   └─ Maior complexidade

5. FASE 5 (A/B)
   └─ Opcional / futuro
   └─ Depende de volume
```

---

## 14. Métricas de Sucesso

| Métrica | Atual | Meta |
|---------|-------|------|
| Tempo para criar campanha | ~30min (SQL) | <5min (UI) |
| Visibilidade de performance | Nenhuma | Real-time |
| Campanhas com stickers | 0% | 100% |
| Taxa de engajamento | 3.8% | >10% (com stickers) |
| Taxa de opt-out | N/A | <2% |
| Taxa de conversão | 3.8% | >10% |
| Attribution tracking | ❌ | ✅ |
| Compliance (opt-out funcional) | ❌ | ✅ |
| Visual Workflow | ❌ | ✅ |

---

**Última atualização:** 2026-01-16 (Fase 6.1 e 6.2 concluídas - Audience Builder implementado)
**Autor:** Claude + Paulo
