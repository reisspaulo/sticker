# Sprint 13 - Sistema de Experimentos A/B

**Status:** PLANEJAMENTO
**Data Inicio:** 09/01/2026
**Ultima Atualizacao:** 09/01/2026

---

## Resumo Executivo

### O Que E?

Sistema robusto de experimentos A/B para testar diferentes estrategias de conversao no bot de stickers. O primeiro experimento sera testar variantes do botao "Agora Nao" no menu de upgrade.

### Por Que?

- Botao "Agora Nao" tem **17 cliques** vs apenas **5 cliques** em upgrade
- Usuarios usam o dismiss como "saida facil" sem considerar upgrade
- Precisamos de dados para decidir a melhor estrategia
- Sistema atual de A/B (`ab_test_group`) e limitado (apenas 2 grupos fixos)

### Objetivo

Criar infraestrutura de experimentos que permita:
- Multiplos testes simultaneos
- Variantes configuraveis (texto, comportamento, visibilidade)
- Metricas separadas por experimento
- Rollout gradual e seguro

---

## Contexto e Dados

### Metricas Atuais

| Metrica | Valor |
|---------|-------|
| Total usuarios | 276 |
| Brasileiros (+55) | 269 (95.73%) |
| Internacionais | 12 (4.27%) |
| Atingiram limite | 11 |
| Clicaram "Agora Nao" | 14 |
| Clicaram upgrade | 5 |
| Conversao paga | 4 usuarios (1.45%) |

### A/B Test Atual (Bonus vs Control)

| Grupo | Usuarios | Pagantes | Conversao |
|-------|----------|----------|-----------|
| Bonus | 135 | 2 | 1.48% |
| Control | 141 | 2 | 1.42% |

**Conclusao:** Diferenca estatisticamente insignificante. O teste de bonus nao esta convertendo melhor.

### Comportamento nos Botoes

| Botao | Cliques | Depois fez upgrade |
|-------|---------|-------------------|
| "Agora Nao" | 14 | 1 (7%) |
| "Usar Bonus" | 19 | 1 (5%) |
| "Premium" | 4 | - |
| "Ultra" | 1 | - |

---

## Arquitetura do Sistema

### Visao Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE EXPERIMENTOS A/B                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐        │
│  │ experiments │───▶│user_experiments│───▶│experiment_events│       │
│  │ (config)    │    │ (atribuicao) │    │ (metricas)      │        │
│  └─────────────┘    └──────────────┘    └─────────────────┘        │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────┐                                               │
│  │scheduled_reminders│  (para variante "Me lembre depois")         │
│  └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Atribuicao

```
Usuario atinge limite
       ↓
Experimento ativo?
       ↓ Sim
Usuario ja tem variante?
       ↓ Nao
E brasileiro? (internacionais ficam em control)
       ↓ Sim
Sorteia variante baseado nos weights
       ↓
Salva em user_experiments
       ↓
Retorna config da variante
       ↓
Renderiza botoes conforme config
```

### Fluxo de Lembrete

```
Usuario clica "Me lembre em 2h"
       ↓
Cria scheduled_reminder (scheduled_for = NOW() + 2h)
       ↓
Responde: "Combinado! Te aviso em 2 horas"
       ↓
Loga evento: 'remind_scheduled'
       ↓
[Job CRON a cada 5min]
       ↓
Busca reminders pendentes
       ↓
Verifica se limite ainda atingido
       ↓ Sim: "Lembra do upgrade?"
       ↓ Nao: "Seu limite voltou! Mas se quiser ilimitado..."
       ↓
Atualiza: status = 'sent'
```

---

## Modelo de Dados

### Tabela: experiments

```sql
CREATE TABLE experiments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,
  description     TEXT,

  -- Configuracao das variantes (JSONB)
  variants        JSONB NOT NULL,

  -- Controle
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  traffic_percent INT DEFAULT 100 CHECK (traffic_percent BETWEEN 0 AND 100),

  -- Segmentacao
  include_international BOOLEAN DEFAULT false,

  -- Datas
  created_at      TIMESTAMPTZ DEFAULT now(),
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,

  -- Metadata
  created_by      TEXT,
  notes           TEXT
);

-- Indice para buscar experimentos ativos
CREATE INDEX idx_experiments_status ON experiments(status) WHERE status = 'active';
```

**Exemplo de variants JSONB (upgrade_message_v1):**

```json
{
  "control": {
    "weight": 25,
    "config": {
      "message_title": "⚠️ *Limite Atingido!* {emoji}",
      "message_body": "Voce ja usou *{count}/{limit} {feature}* hoje.\n\nSeu limite sera renovado as *00:00* (horario de Brasilia).\n\n💎 *FACA UPGRADE E TENHA MAIS!*\n\n💰 *Premium (R$ 5/mes)*\n• 20 figurinhas/dia\n\n🚀 *Ultra (R$ 9,90/mes)*\n• Figurinhas *ILIMITADAS*",
      "button_dismiss_text": "❌ Agora Nao",
      "button_dismiss_id": "button_dismiss_upgrade",
      "button_premium_text": "💰 Premium - R$ 5/mes",
      "button_ultra_text": "🚀 Ultra - R$ 9,90/mes",
      "show_dismiss_button": true
    }
  },
  "social_proof": {
    "weight": 25,
    "config": {
      "message_title": "*Suas figurinhas de hoje acabaram* 😊",
      "message_body": "Voce usou {count}/{limit}.\n\nMais de 150 pessoas fizeram upgrade este mes para criar sem esperar.\n\nPremium: 20/dia por R$ 5\nUltra: Sem limite por R$ 9,90",
      "button_dismiss_text": "Depois",
      "button_dismiss_id": "button_dismiss_upgrade",
      "button_premium_text": "Quero Premium",
      "button_ultra_text": "Quero Ultra",
      "show_dismiss_button": true
    }
  },
  "benefit": {
    "weight": 25,
    "config": {
      "message_title": "*{count}/{limit} figurinhas usadas* ✨",
      "message_body": "Com Premium voce teria +16 hoje.\nCom Ultra, sem limite nenhum.\n\nPremium: R$ 5/mes\nUltra: R$ 9,90/mes",
      "button_dismiss_text": "Esperar",
      "button_dismiss_id": "button_dismiss_upgrade",
      "button_premium_text": "Premium +16/dia",
      "button_ultra_text": "Ultra Ilimitado",
      "show_dismiss_button": true
    }
  },
  "hybrid": {
    "weight": 25,
    "config": {
      "message_title": "*Fim das figurinhas de hoje* 🎨",
      "message_body": "Usuarios Premium criam em media 12 figurinhas por dia.\nUsuarios Ultra criam sem limite.\n\nQual combina mais com voce?",
      "button_dismiss_text": "Nenhum",
      "button_dismiss_id": "button_dismiss_upgrade",
      "button_premium_text": "Premium R$5",
      "button_ultra_text": "Ultra R$9,90",
      "show_dismiss_button": true
    }
  }
}
```

**Placeholders disponiveis:**
| Placeholder | Descricao | Exemplo |
|-------------|-----------|---------|
| `{count}` | Figurinhas usadas hoje | 4 |
| `{limit}` | Limite diario | 4 |
| `{feature}` | Tipo de recurso | "figurinhas" ou "videos" |
| `{emoji}` | Emoji da feature | 🎨 ou 🐦 |
| `{userName}` | Nome do usuario | "Joao" |

### Tabela: user_experiments

```sql
CREATE TABLE user_experiments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  experiment_id   UUID NOT NULL REFERENCES experiments(id),
  variant         TEXT NOT NULL,

  assigned_at     TIMESTAMPTZ DEFAULT now(),

  -- Evita atribuicao duplicada
  UNIQUE(user_id, experiment_id)
);

-- Indices
CREATE INDEX idx_user_experiments_user ON user_experiments(user_id);
CREATE INDEX idx_user_experiments_experiment ON user_experiments(experiment_id);
```

### Tabela: experiment_events

```sql
CREATE TABLE experiment_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  experiment_id   UUID NOT NULL REFERENCES experiments(id),
  variant         TEXT NOT NULL,

  event_type      TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',

  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indice para queries de metricas
CREATE INDEX idx_experiment_events_experiment ON experiment_events(experiment_id, event_type);
CREATE INDEX idx_experiment_events_created ON experiment_events(created_at);
```

**Event types:**

| event_type | Descricao |
|------------|-----------|
| `menu_shown` | Usuario viu menu de upgrade |
| `dismiss_clicked` | Clicou no botao dismiss/remind |
| `remind_scheduled` | Agendou lembrete |
| `remind_sent` | Lembrete foi enviado |
| `remind_converted` | Converteu apos lembrete |
| `upgrade_clicked` | Clicou em Premium/Ultra |
| `payment_started` | Iniciou fluxo de pagamento |
| `converted` | Pagou e ativou plano |

### Tabela: scheduled_reminders

```sql
CREATE TABLE scheduled_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  user_number     TEXT NOT NULL,

  reminder_type   TEXT NOT NULL DEFAULT 'upgrade_reminder',
  message_template TEXT,

  scheduled_for   TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,

  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'canceled', 'failed')),

  -- Rastreabilidade
  experiment_id   UUID REFERENCES experiments(id),
  variant         TEXT,

  -- Controle
  error_message   TEXT,
  retry_count     INT DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indice para job de envio
CREATE INDEX idx_scheduled_reminders_pending
ON scheduled_reminders(scheduled_for)
WHERE status = 'pending';

-- Indice para verificar lembretes existentes
CREATE INDEX idx_scheduled_reminders_user_pending
ON scheduled_reminders(user_id, status)
WHERE status = 'pending';
```

---

## RPCs (Funcoes Postgres)

### 1. assign_experiment_variant

```sql
CREATE OR REPLACE FUNCTION assign_experiment_variant(
  p_user_id UUID,
  p_experiment_name TEXT,
  p_is_brazilian BOOLEAN DEFAULT true
)
RETURNS TABLE(
  experiment_id UUID,
  variant TEXT,
  config JSONB,
  is_new_assignment BOOLEAN
) AS $$
DECLARE
  v_experiment RECORD;
  v_existing RECORD;
  v_variant TEXT;
  v_random FLOAT;
  v_cumulative FLOAT;
  v_variant_key TEXT;
  v_variant_data JSONB;
BEGIN
  -- Busca experimento ativo
  SELECT * INTO v_experiment
  FROM experiments e
  WHERE e.name = p_experiment_name
    AND e.status = 'active';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Verifica se internacional e experimento nao inclui
  IF NOT p_is_brazilian AND NOT v_experiment.include_international THEN
    -- Retorna control para internacionais
    RETURN QUERY
    SELECT
      v_experiment.id,
      'control'::TEXT,
      (v_experiment.variants->'control'->'config')::JSONB,
      false;
    RETURN;
  END IF;

  -- Verifica atribuicao existente
  SELECT * INTO v_existing
  FROM user_experiments ue
  WHERE ue.user_id = p_user_id
    AND ue.experiment_id = v_experiment.id;

  IF FOUND THEN
    -- Retorna variante existente
    RETURN QUERY
    SELECT
      v_experiment.id,
      v_existing.variant,
      (v_experiment.variants->v_existing.variant->'config')::JSONB,
      false;
    RETURN;
  END IF;

  -- Sorteia nova variante baseado nos weights
  v_random := random() * 100;
  v_cumulative := 0;

  FOR v_variant_key, v_variant_data IN
    SELECT * FROM jsonb_each(v_experiment.variants)
  LOOP
    v_cumulative := v_cumulative + (v_variant_data->>'weight')::FLOAT;
    IF v_random <= v_cumulative THEN
      v_variant := v_variant_key;
      EXIT;
    END IF;
  END LOOP;

  -- Fallback para control se algo der errado
  IF v_variant IS NULL THEN
    v_variant := 'control';
  END IF;

  -- Insere atribuicao
  INSERT INTO user_experiments (user_id, experiment_id, variant)
  VALUES (p_user_id, v_experiment.id, v_variant);

  -- Retorna nova atribuicao
  RETURN QUERY
  SELECT
    v_experiment.id,
    v_variant,
    (v_experiment.variants->v_variant->'config')::JSONB,
    true;
END;
$$ LANGUAGE plpgsql;
```

### 2. log_experiment_event

```sql
CREATE OR REPLACE FUNCTION log_experiment_event(
  p_user_id UUID,
  p_experiment_id UUID,
  p_variant TEXT,
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO experiment_events (user_id, experiment_id, variant, event_type, metadata)
  VALUES (p_user_id, p_experiment_id, p_variant, p_event_type, p_metadata)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;
```

### 3. get_pending_reminder

```sql
CREATE OR REPLACE FUNCTION get_pending_reminder(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  scheduled_for TIMESTAMPTZ,
  minutes_remaining INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id,
    sr.scheduled_for,
    EXTRACT(EPOCH FROM (sr.scheduled_for - now()))::INT / 60
  FROM scheduled_reminders sr
  WHERE sr.user_id = p_user_id
    AND sr.status = 'pending'
    AND sr.scheduled_for > now()
  ORDER BY sr.scheduled_for ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

### 4. get_experiment_metrics

```sql
CREATE OR REPLACE FUNCTION get_experiment_metrics(p_experiment_id UUID)
RETURNS TABLE(
  variant TEXT,
  total_users BIGINT,
  menu_shown BIGINT,
  dismiss_clicked BIGINT,
  remind_scheduled BIGINT,
  upgrade_clicked BIGINT,
  converted BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH user_variants AS (
    SELECT ue.variant, COUNT(DISTINCT ue.user_id) as total
    FROM user_experiments ue
    WHERE ue.experiment_id = p_experiment_id
    GROUP BY ue.variant
  ),
  events_by_variant AS (
    SELECT
      ee.variant,
      ee.event_type,
      COUNT(*) as cnt
    FROM experiment_events ee
    WHERE ee.experiment_id = p_experiment_id
    GROUP BY ee.variant, ee.event_type
  )
  SELECT
    uv.variant,
    uv.total as total_users,
    COALESCE(MAX(CASE WHEN eb.event_type = 'menu_shown' THEN eb.cnt END), 0) as menu_shown,
    COALESCE(MAX(CASE WHEN eb.event_type = 'dismiss_clicked' THEN eb.cnt END), 0) as dismiss_clicked,
    COALESCE(MAX(CASE WHEN eb.event_type = 'remind_scheduled' THEN eb.cnt END), 0) as remind_scheduled,
    COALESCE(MAX(CASE WHEN eb.event_type = 'upgrade_clicked' THEN eb.cnt END), 0) as upgrade_clicked,
    COALESCE(MAX(CASE WHEN eb.event_type = 'converted' THEN eb.cnt END), 0) as converted,
    ROUND(
      COALESCE(MAX(CASE WHEN eb.event_type = 'converted' THEN eb.cnt END), 0)::NUMERIC /
      NULLIF(uv.total, 0) * 100,
      2
    ) as conversion_rate
  FROM user_variants uv
  LEFT JOIN events_by_variant eb ON eb.variant = uv.variant
  GROUP BY uv.variant, uv.total
  ORDER BY uv.variant;
END;
$$ LANGUAGE plpgsql;
```

---

## Primeiro Experimento: upgrade_message_v1

### Objetivo

Testar diferentes **mensagens e tons** no menu de limite atingido para aumentar conversao.

### Variantes

| Variante | Estilo | Emojis | Tom |
|----------|--------|--------|-----|
| `control` | Promocional | 5 (⚠️🎨💎💰🚀) | Tradicional com features |
| `social_proof` | Social | 1 (😊) | "150 pessoas fizeram upgrade" |
| `benefit` | Direto | 1 (✨) | "Com Premium voce teria +16" |
| `hybrid` | Consultivo | 1 (🎨) | "Qual combina com voce?" |

### Mensagens por Variante

#### Variante 1: `control` (25%)
```
Titulo: ⚠️ *Limite Atingido!* 🎨

Corpo:
Voce ja usou *4/4 figurinhas* hoje.

Seu limite sera renovado as *00:00* (horario de Brasilia).

💎 *FACA UPGRADE E TENHA MAIS!*

💰 *Premium (R$ 5/mes)*
• 20 figurinhas/dia

🚀 *Ultra (R$ 9,90/mes)*
• Figurinhas *ILIMITADAS*

Botoes: [💰 Premium - R$ 5/mes] [🚀 Ultra - R$ 9,90/mes] [❌ Agora Nao]
```

#### Variante 2: `social_proof` (25%)
```
Titulo: *Suas figurinhas de hoje acabaram* 😊

Corpo:
Voce usou 4/4.

Mais de 150 pessoas fizeram upgrade este mes para criar sem esperar.

Premium: 20/dia por R$ 5
Ultra: Sem limite por R$ 9,90

Botoes: [Quero Premium] [Quero Ultra] [Depois]
```

#### Variante 3: `benefit` (25%)
```
Titulo: *4/4 figurinhas usadas* ✨

Corpo:
Com Premium voce teria +16 hoje.
Com Ultra, sem limite nenhum.

Premium: R$ 5/mes
Ultra: R$ 9,90/mes

Botoes: [Premium +16/dia] [Ultra Ilimitado] [Esperar]
```

#### Variante 4: `hybrid` (25%)
```
Titulo: *Fim das figurinhas de hoje* 🎨

Corpo:
Usuarios Premium criam em media 12 figurinhas por dia.
Usuarios Ultra criam sem limite.

Qual combina mais com voce?

Botoes: [Premium R$5] [Ultra R$9,90] [Nenhum]
```

### Metricas de Sucesso

| Metrica | Descricao | Meta |
|---------|-----------|------|
| Taxa de dismiss | % que clica no botao dismiss | Reduzir de 77% para <50% |
| Taxa de upgrade click | % que clica em Premium/Ultra | Aumentar de 23% para >35% |
| Taxa de conversao | % que efetiva pagamento | Aumentar de 1.45% para >3% |
| Engajamento | Tempo medio ate clicar | Baseline a definir |

### Segmentacao

- **Inclui:** Usuarios brasileiros (+55)
- **Exclui:** Usuarios internacionais (ficam em control)
- **Traffic:** 100% dos usuarios elegiveis

---

## Integracao com Codigo Existente

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `menuService.ts` | Ler variante do experimento antes de montar botoes |
| `webhook.ts` | Adicionar handlers para novos button IDs |
| `avisaApi.ts` | Adicionar mapeamento de novos botoes |
| `jobs/index.ts` | Adicionar job de envio de lembretes |

### Novos Arquivos

| Arquivo | Funcao |
|---------|--------|
| `services/experimentService.ts` | Logica de experimentos |
| `utils/experimentRpc.ts` | Wrappers type-safe para RPCs |
| `jobs/sendReminders.ts` | Job de envio de lembretes |

### Estrutura do experimentService.ts

```typescript
// services/experimentService.ts

import { supabase } from '../config/supabase';
import { isBrazilianNumber } from './avisaApi';
import logger from '../config/logger';

interface ExperimentVariant {
  experiment_id: string;
  variant: string;
  config: {
    button_text?: string;
    button_id?: string;
    action?: 'dismiss' | 'schedule_reminder';
    delay_hours?: number;
    show_button?: boolean;
  };
  is_new_assignment: boolean;
}

export async function getUpgradeDismissVariant(
  userId: string,
  userNumber: string
): Promise<ExperimentVariant | null> {
  try {
    const isBrazilian = isBrazilianNumber(userNumber);

    const { data, error } = await supabase.rpc('assign_experiment_variant', {
      p_user_id: userId,
      p_experiment_name: 'upgrade_dismiss_v1',
      p_is_brazilian: isBrazilian,
    });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const result = data[0];

    // Log atribuicao se for nova
    if (result.is_new_assignment) {
      logger.info({
        msg: 'New experiment variant assigned',
        userId,
        experiment: 'upgrade_dismiss_v1',
        variant: result.variant,
      });
    }

    return result;
  } catch (error) {
    logger.error({ error, userId }, 'Error getting experiment variant');
    return null;
  }
}

export async function logExperimentEvent(
  userId: string,
  experimentId: string,
  variant: string,
  eventType: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase.rpc('log_experiment_event', {
      p_user_id: userId,
      p_experiment_id: experimentId,
      p_variant: variant,
      p_event_type: eventType,
      p_metadata: metadata,
    });
  } catch (error) {
    logger.error({ error, userId, eventType }, 'Error logging experiment event');
  }
}

export async function scheduleReminder(
  userId: string,
  userNumber: string,
  delayHours: number,
  experimentId: string,
  variant: string
): Promise<boolean> {
  try {
    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + delayHours);

    const { error } = await supabase.from('scheduled_reminders').insert({
      user_id: userId,
      user_number: userNumber,
      scheduled_for: scheduledFor.toISOString(),
      experiment_id: experimentId,
      variant,
    });

    if (error) throw error;

    logger.info({
      msg: 'Reminder scheduled',
      userId,
      scheduledFor,
      delayHours,
    });

    return true;
  } catch (error) {
    logger.error({ error, userId }, 'Error scheduling reminder');
    return false;
  }
}

export async function hasPendingReminder(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase.rpc('get_pending_reminder', {
      p_user_id: userId,
    });

    return data && data.length > 0;
  } catch (error) {
    return false;
  }
}
```

---

## Jobs

### Job: sendScheduledReminders

```typescript
// jobs/sendReminders.ts

import { supabase } from '../config/supabase';
import { sendText } from '../services/evolutionApi';
import logger from '../config/logger';

export async function sendScheduledRemindersJob(): Promise<void> {
  const startTime = Date.now();

  try {
    // Busca lembretes pendentes que ja passaram da hora
    const { data: reminders, error } = await supabase
      .from('scheduled_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!reminders || reminders.length === 0) {
      logger.debug('No pending reminders to send');
      return;
    }

    logger.info({ count: reminders.length }, 'Processing scheduled reminders');

    let sent = 0;
    let failed = 0;

    for (const reminder of reminders) {
      try {
        // Verifica se usuario ainda esta no limite
        const { data: user } = await supabase
          .from('users')
          .select('daily_count, subscription_plan')
          .eq('id', reminder.user_id)
          .single();

        // Monta mensagem apropriada
        let message: string;
        const dailyLimit = user?.subscription_plan === 'free' ? 4 :
                          user?.subscription_plan === 'premium' ? 20 : 999;

        if (user && user.daily_count >= dailyLimit) {
          // Ainda no limite
          message = `⏰ *Lembrete!*\n\nVoce pediu pra te lembrar do upgrade.\n\n💎 Com o *Premium* voce tem 20 figurinhas por dia!\n\nDigite *planos* para ver as opcoes.`;
        } else {
          // Limite resetou
          message = `⏰ *Seu limite voltou!*\n\nVoce ja pode criar mais figurinhas hoje! 🎨\n\n💡 Dica: Com o *Premium* voce nunca mais fica sem.\n\nDigite *planos* para saber mais.`;
        }

        await sendText(reminder.user_number, message);

        // Atualiza status
        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        // Loga evento
        if (reminder.experiment_id) {
          await supabase.rpc('log_experiment_event', {
            p_user_id: reminder.user_id,
            p_experiment_id: reminder.experiment_id,
            p_variant: reminder.variant,
            p_event_type: 'remind_sent',
            p_metadata: { daily_count: user?.daily_count },
          });
        }

        sent++;

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        logger.error({ error: err, reminderId: reminder.id }, 'Error sending reminder');

        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
            retry_count: reminder.retry_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        failed++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info({ sent, failed, duration }, 'Scheduled reminders job completed');

  } catch (error) {
    logger.error({ error }, 'Error in sendScheduledRemindersJob');
    throw error;
  }
}
```

### Configuracao do Cron

```typescript
// jobs/index.ts (adicionar)

import { sendScheduledRemindersJob } from './sendReminders';

// A cada 5 minutos
cron.schedule('*/5 * * * *', sendScheduledRemindersJob, {
  timezone: 'America/Sao_Paulo'
});
```

---

## Decisoes Tecnicas

### D1: Internacionais

**Decisao:** Usuarios internacionais ficam sempre em `control`.

**Justificativa:**
- Apenas 4.27% dos usuarios (12 pessoas)
- Avisa API so funciona para BR
- Fallback de texto complica tracking
- Amostra muito pequena para significancia estatistica

### D2: Migracao do teste atual

**Decisao:** Manter `ab_test_group` separado, nao migrar.

**Justificativa:**
- Evita risco de quebrar fluxo de bonus que funciona
- Preserva dados historicos
- Menos codigo para mudar de uma vez
- Migra depois que sistema novo estiver validado

### D3: Usuario que ja clicou "Agora Nao"

**Decisao:** Entra no teste normalmente na proxima vez.

**Justificativa:**
- Contexto muda (outro dia, outro momento)
- Pode ser sorteado para variante diferente
- Maximiza dados do experimento

### D4: Lembrete pendente + novo limite

**Decisao:** Mostra menu sem botao de lembrete se ja tem pendente.

**Justificativa:**
- Evita spam de lembretes
- Usuario sabe que ja agendou
- Ainda pode clicar em upgrade

### D5: Lembrete apos reset

**Decisao:** Adapta mensagem em vez de cancelar.

**Justificativa:**
- Nao perde oportunidade de upsell
- Mensagem contextualizada nao e spam
- Pode converter mesmo com limite disponivel

---

## Sprints de Implementacao

### Sprint 13.1 - Infraestrutura (3-4 dias)

**Objetivo:** Criar tabelas, RPCs e servicos base.

**Tarefas:**

- [ ] Criar migration com tabelas `experiments`, `user_experiments`, `experiment_events`, `scheduled_reminders`
- [ ] Criar RPCs: `assign_experiment_variant`, `log_experiment_event`, `get_pending_reminder`, `get_experiment_metrics`
- [ ] Criar `experimentService.ts` com funcoes de atribuicao e logging
- [ ] Criar `experimentRpc.ts` com wrappers type-safe
- [ ] Criar dados iniciais do experimento `upgrade_dismiss_v1`
- [ ] Testar RPCs via Supabase dashboard

**Entregaveis:**
- Schema de banco criado
- RPCs funcionando
- Service layer pronto

---

### Sprint 13.2 - Integracao no Fluxo (2-3 dias)

**Objetivo:** Integrar experimento no menu de upgrade.

**Tarefas:**

- [ ] Modificar `menuService.ts` para ler variante antes de montar botoes
- [ ] Adicionar novos button IDs no `avisaApi.ts` (mapeamento fallback)
- [ ] Adicionar handlers no `webhook.ts` para `button_remind_2h`, `button_remind_tomorrow`
- [ ] Implementar logica de verificar lembrete pendente
- [ ] Logar eventos `menu_shown`, `dismiss_clicked`, `upgrade_clicked`
- [ ] Testar fluxo completo com variantes

**Entregaveis:**
- Menu de upgrade lendo variante do experimento
- Novos botoes funcionando
- Eventos sendo logados

---

### Sprint 13.3 - Job de Lembretes (1-2 dias)

**Objetivo:** Implementar envio automatico de lembretes.

**Tarefas:**

- [ ] Criar `jobs/sendReminders.ts`
- [ ] Adicionar cron job (a cada 5 min)
- [ ] Implementar logica de mensagem adaptada (limite vs reset)
- [ ] Logar eventos `remind_sent`
- [ ] Testar job manualmente
- [ ] Deploy e monitorar em producao

**Entregaveis:**
- Job rodando em producao
- Lembretes sendo enviados
- Logs e metricas funcionando

---

### Sprint 13.4 - Dashboard de Metricas (2-3 dias)

**Objetivo:** Visualizar resultados do experimento no admin panel.

**Tarefas:**

- [ ] Criar pagina `/admin-panel/experiments`
- [ ] Implementar cards de metricas por variante
- [ ] Implementar grafico de conversao
- [ ] Implementar tabela de eventos recentes
- [ ] Adicionar filtros de periodo
- [ ] Botoes para pausar/retomar experimento

**Entregaveis:**
- Dashboard de experimentos no admin
- Metricas em tempo real
- Controle de status do experimento

---

### Sprint 13.5 - Monitoramento e Ajustes (ongoing)

**Objetivo:** Monitorar resultados e ajustar.

**Tarefas:**

- [ ] Monitorar metricas diariamente
- [ ] Verificar significancia estatistica
- [ ] Ajustar weights se necessario
- [ ] Documentar insights
- [ ] Decidir variante vencedora
- [ ] Implementar variante vencedora como padrao

**Entregaveis:**
- Relatorio de resultados
- Decisao final
- Rollout da variante vencedora

---

## Checklist de Implementacao

### Banco de Dados
- [ ] Tabela `experiments`
- [ ] Tabela `user_experiments`
- [ ] Tabela `experiment_events`
- [ ] Tabela `scheduled_reminders`
- [ ] RPC `assign_experiment_variant`
- [ ] RPC `log_experiment_event`
- [ ] RPC `get_pending_reminder`
- [ ] RPC `get_experiment_metrics`
- [ ] Dados iniciais do experimento `upgrade_dismiss_v1`

### Backend
- [ ] `services/experimentService.ts`
- [ ] `utils/experimentRpc.ts`
- [ ] `jobs/sendReminders.ts`
- [ ] Modificar `menuService.ts`
- [ ] Modificar `webhook.ts`
- [ ] Modificar `avisaApi.ts`
- [ ] Adicionar cron job

### Admin Panel
- [ ] Pagina `/experiments`
- [ ] Metricas por variante
- [ ] Grafico de conversao
- [ ] Controle de status

### Testes
- [ ] Testar atribuicao de variante
- [ ] Testar cada variante no fluxo
- [ ] Testar job de lembretes
- [ ] Testar fallback internacional
- [ ] Testar metricas no dashboard

---

## Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Bug no sorteio de variante | Media | Alto | RPC atomico, testes, fallback para control |
| Job de lembrete falha | Baixa | Medio | Retry, logs, alertas |
| Spam de lembretes | Media | Alto | Verificar pendente antes de agendar |
| Metricas inconsistentes | Baixa | Medio | Eventos atomicos, validacao |
| Experimento nao conclusivo | Media | Baixo | Rodar por tempo suficiente (2-4 semanas) |

---

## Referencias

- [A/B Testing Guide](https://www.optimizely.com/optimization-glossary/ab-testing/)
- [Statistical Significance Calculator](https://www.evanmiller.org/ab-testing/sample-size.html)
- ADR 003: A/B Test Bonus Credits (`docs/decisions/003-ab-test-bonus-credits.md`)
- Flowcharts (`docs/architecture/FLOWCHARTS.md`)

---

## Glossario

| Termo | Definicao |
|-------|-----------|
| Variante | Uma versao do experimento (ex: control, remind_2h) |
| Weight | Peso percentual de cada variante no sorteio |
| Atribuicao | Momento em que usuario e sorteado para uma variante |
| Evento | Acao trackada do usuario (ex: menu_shown, converted) |
| Conversao | Usuario que efetivou pagamento |

---

**Ultima atualizacao:** 09/01/2026
