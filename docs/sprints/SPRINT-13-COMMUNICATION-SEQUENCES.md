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

---

# PARTE 2: Sistema de Communication Sequences

**Status:** IMPLEMENTADO
**Data Implementacao:** 12-13/01/2026

---

## Resumo Executivo

### O Que E?

Sistema de sequencias de comunicacao programadas (drip campaigns) para engajar usuarios com features que ainda nao conhecem. Diferente de A/B tests pontuais, as sequences enviam mensagens ao longo do tempo (d+0, d+7, d+15, d+30).

### Por Que?

- Usuarios nao sabem que podem baixar videos do Twitter/X
- Trigger antigo (apos 3 figurinhas) era muito cedo e intrusivo
- Precisamos de comunicacao gradual e nao-invasiva
- Sistema flexivel para testar diferentes estrategias de descoberta

### Primeiro Caso: Twitter Discovery

Usuarios que batem o limite diario sao inscritos numa sequencia que apresenta a feature de download de videos do Twitter ao longo de 30 dias.

---

## Arquitetura do Sistema

### Visao Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                 SISTEMA DE COMMUNICATION SEQUENCES                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────┐    ┌──────────────┐    ┌─────────────────┐          │
│  │ sequences │───▶│user_sequences│───▶│ sequence_events │          │
│  │ (config)  │    │ (inscricao)  │    │ (tracking)      │          │
│  └───────────┘    └──────────────┘    └─────────────────┘          │
│        │                                                             │
│        ▼                                                             │
│  ┌─────────────────┐                                                │
│  │sequence_messages│  (conteudo das mensagens)                      │
│  └─────────────────┘                                                │
│                                                                      │
│  ┌─────────────────────────────────────────────────────┐            │
│  │              JOB: processSequenceSteps               │            │
│  │         (roda a cada 5 min, envia mensagens)         │            │
│  └─────────────────────────────────────────────────────┘            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Enrollment

```
Usuario bate limite diario
       ↓
webhook.ts detecta limite
       ↓
Chama enrollInTwitterDiscovery()
       ↓
RPC enroll_user_in_sequence
       ↓
Verifica: usuario criado >= 10/01/2026?
       ↓ Sim
Verifica: ja esta na sequencia?
       ↓ Nao
Verifica: ja usou feature? (cancel_condition)
       ↓ Nao
Cria user_sequence com next_scheduled_at = NOW() + 4h + random(0-30min)
       ↓
Usuario inscrito!
```

### Fluxo de Envio

```
[Job CRON a cada 5min]
       ↓
RPC get_pending_sequence_steps
       ↓
Busca user_sequences onde next_scheduled_at <= NOW()
       ↓
Para cada step:
  ├─ Verifica cancel_condition
  │     ↓ Se TRUE: cancela sequencia
  ├─ Busca mensagem em sequence_messages
  ├─ Envia via Avisa API
  ├─ Rate limit: 200ms entre mensagens
  └─ Avanca para proximo step (RPC advance_sequence_step)
       ↓
Proximo step agendado (d+7, d+15, d+30)
```

---

## Modelo de Dados

### Tabela: sequences

```sql
CREATE TABLE sequences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) UNIQUE NOT NULL,
  description      TEXT,
  type             VARCHAR(50) DEFAULT 'discovery',

  -- Configuracao dos steps (JSONB array)
  steps            JSONB NOT NULL,

  -- Condicao para cancelar (SQL dinamico)
  cancel_condition TEXT,

  -- Filtro de target (opcional)
  target_filter    JSONB,

  -- Controle
  status           VARCHAR(20) DEFAULT 'draft',
  priority         INT DEFAULT 0,
  max_users        INT,

  -- Settings
  settings         JSONB DEFAULT '{}',

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  activated_at     TIMESTAMPTZ
);
```

**Exemplo de steps JSONB:**

```json
[
  {"step": 0, "delay_hours": 4, "message_key": "twitter_d0"},
  {"step": 1, "delay_days": 7, "message_key": "twitter_d7"},
  {"step": 2, "delay_days": 15, "message_key": "twitter_d15"},
  {"step": 3, "delay_days": 30, "message_key": "twitter_d30"}
]
```

### Tabela: sequence_messages

```sql
CREATE TABLE sequence_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_key   VARCHAR(100) UNIQUE NOT NULL,
  sequence_id   UUID REFERENCES sequences(id),

  -- Conteudo
  title         TEXT NOT NULL,  -- OBRIGATORIO pela Avisa API!
  body          TEXT NOT NULL,
  footer        TEXT,

  -- Tipo e extras
  message_type  VARCHAR(50) DEFAULT 'text',
  buttons       JSONB,
  media         JSONB,

  -- Variantes para A/B
  variants      JSONB,

  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

**IMPORTANTE:** O campo `title` e OBRIGATORIO! A Avisa API retorna erro 422 se for NULL.

### Tabela: user_sequences

```sql
CREATE TABLE user_sequences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  sequence_id      UUID NOT NULL REFERENCES sequences(id),

  -- Progresso
  current_step     INT DEFAULT 0,
  next_scheduled_at TIMESTAMPTZ,

  -- Status
  status           VARCHAR(20) DEFAULT 'pending',
  cancel_reason    VARCHAR(100),

  -- A/B dentro da sequencia
  variant          VARCHAR(50),

  -- Metadata do enrollment
  metadata         JSONB DEFAULT '{}',

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  UNIQUE(user_id, sequence_id)
);
```

**Status possiveis:**
- `pending`: Aguardando primeiro envio
- `active`: Em andamento (apos primeiro envio)
- `completed`: Todos os steps enviados
- `cancelled`: Cancelado (usuario usou feature ou manual)

### Tabela: sequence_events

```sql
CREATE TABLE sequence_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_sequence_id UUID REFERENCES user_sequences(id),
  user_id         UUID REFERENCES users(id),

  event_type      VARCHAR(50) NOT NULL,
  step_number     INT,

  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

**Event types:**

| event_type | Descricao |
|------------|-----------|
| `enrolled` | Usuario inscrito na sequencia |
| `step_sent` | Mensagem enviada com sucesso |
| `step_failed` | Erro ao enviar mensagem |
| `cancelled` | Sequencia cancelada |
| `completed` | Sequencia finalizada |
| `feature_used` | Usuario usou a feature (conversao!) |

---

## RPCs Implementados

### 1. enroll_user_in_sequence

Inscreve usuario em uma sequencia.

```sql
CREATE OR REPLACE FUNCTION enroll_user_in_sequence(
  p_user_id UUID,
  p_sequence_name VARCHAR(100),
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID  -- Retorna user_sequence_id ou NULL
```

**Regras:**
- So inscreve se sequencia esta `active`
- So inscreve usuarios criados >= 10/01/2026
- Nao inscreve se ja esta na sequencia
- Verifica cancel_condition antes de inscrever
- Adiciona randomizacao de 0-30min no primeiro step

### 2. get_pending_sequence_steps

Busca steps prontos para envio.

```sql
CREATE OR REPLACE FUNCTION get_pending_sequence_steps(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    user_sequence_id UUID,
    user_id UUID,
    user_number TEXT,      -- IMPORTANTE: TEXT, nao VARCHAR!
    user_name TEXT,        -- IMPORTANTE: TEXT, nao VARCHAR!
    sequence_id UUID,
    sequence_name VARCHAR(100),
    sequence_type VARCHAR(50),
    current_step INTEGER,
    step_config JSONB,
    message_key VARCHAR(100),
    cancel_condition TEXT,
    metadata JSONB
)
```

**ERRO ENCONTRADO:** Originalmente o RPC tinha `user_number VARCHAR` e `user_name VARCHAR`, mas a tabela `users` usa `TEXT`. Isso causava erro 400 na API.

### 3. advance_sequence_step

Avanca para proximo step apos envio.

```sql
CREATE OR REPLACE FUNCTION advance_sequence_step(
  p_user_sequence_id UUID,
  p_success BOOLEAN DEFAULT true,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VARCHAR(20)  -- 'advanced', 'completed', ou 'step_failed'
```

### 4. check_sequence_cancel_conditions

Verifica cancel_condition para todas as sequencias ativas.

```sql
CREATE OR REPLACE FUNCTION check_sequence_cancel_conditions()
RETURNS INT  -- Numero de sequencias canceladas
```

### 5. batch_enroll_twitter_discovery

Enrollment em lote para usuarios retroativos.

```sql
CREATE OR REPLACE FUNCTION batch_enroll_twitter_discovery(
  p_batch_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  enrolled_count INTEGER,
  skipped_count INTEGER,
  user_ids UUID[]
)
```

---

## Configuracao: Twitter Discovery

### Sequencia

| Campo | Valor |
|-------|-------|
| name | `twitter_discovery` |
| type | `discovery` |
| status | `active` |
| cancel_condition | `twitter_feature_used = true` |

### Steps

| Step | Delay | Message Key | Descricao |
|------|-------|-------------|-----------|
| 0 | 4 horas | twitter_d0 | Primeira apresentacao |
| 1 | 7 dias | twitter_d7 | Lembrete semanal |
| 2 | 15 dias | twitter_d15 | Segundo lembrete |
| 3 | 30 dias | twitter_d30 | Ultima tentativa |

### Mensagens

```
twitter_d0:
Titulo: "Dica do Sticker Bot"
Corpo: "Sabia que voce pode baixar videos do Twitter/X e transformar em figurinha? 🎬

E so mandar o link do tweet aqui que a gente baixa o video e transforma em sticker animado!

Quer testar? Manda um link de tweet com video 👇"
```

```
twitter_d7:
Titulo: "Lembrete"
Corpo: "Lembrete rapido: da pra baixar videos do Twitter/X e transformar em figurinha animada! 🎬

Manda o link de qualquer tweet com video e a gente faz a magica ✨"
```

```
twitter_d15:
Titulo: "Dica rapida"
Corpo: "Ja experimentou baixar videos do Twitter/X? 📱

Alem de baixar, a gente transforma o video em figurinha animada pra voce usar no WhatsApp!

So mandar o link do tweet aqui 👇"
```

```
twitter_d30:
Titulo: "Ultima dica"
Corpo: "Ultima dica: voce pode baixar videos do Twitter/X e transformar em figurinha animada! 🎥

Manda qualquer link de tweet com video e veja a magica acontecer ✨"
```

---

## Erros Encontrados e Solucoes

### Erro 1: Tipo VARCHAR vs TEXT

**Problema:** RPC `get_pending_sequence_steps` retornava erro 400.

**Causa:** O RPC foi definido com `user_number VARCHAR` e `user_name VARCHAR`, mas a tabela `users` tem esses campos como `TEXT`.

**Erro:**
```
structure of query does not match function result type
Returned type text does not match expected type character varying in column 3
```

**Solucao:** Alterar a definicao do RPC para usar `TEXT`:
```sql
user_number TEXT,  -- Era VARCHAR
user_name TEXT,    -- Era VARCHAR
```

### Erro 2: Campo title NULL

**Problema:** Todas as mensagens falhavam com erro 422.

**Causa:** A migration setou `title = NULL` nas mensagens, mas a Avisa API exige titulo.

**Erro:**
```json
{
  "status": false,
  "message": "Validation error",
  "errors": {"title": ["O campo titulo e obrigatorio."]}
}
```

**Solucao:** Adicionar titulos a todas as mensagens:
```sql
UPDATE sequence_messages SET title = 'Dica do Sticker Bot' WHERE message_key = 'twitter_d0';
UPDATE sequence_messages SET title = 'Lembrete' WHERE message_key = 'twitter_d7';
-- etc
```

### Erro 3: Job rodando mas nao enviando

**Problema:** Job completava mas `sent: 0, failed: 50`.

**Causa:** Combinacao dos erros 1 e 2 acima.

**Diagnostico:**
1. Verificar logs do job: `SELECT * FROM job_logs WHERE job_name LIKE '%sequence%'`
2. Verificar eventos de erro: `SELECT * FROM sequence_events WHERE event_type = 'step_failed'`

### Erro 4: Mensagens duplicadas (2 workers paralelos)

**Problema:** 100 usuarios receberam a mesma mensagem 2 vezes.

**Causa:** 2 workers (replicas do container) rodando o job ao mesmo tempo sem lock.

**Evidencia nos logs:**
```
worker_id: 80c8301b6b91 | 09:45:00.088
worker_id: 9bf8b7b981e7 | 09:45:00.104
```

**Consequencia:** Usuarios avancaram 2 steps de uma vez (step 0 → step 2), pulando o step 1.

**Solucao:** Adicionar `FOR UPDATE SKIP LOCKED` no RPC:
```sql
SELECT array_agg(us.id) INTO v_locked_ids
FROM user_sequences us
WHERE us.status IN ('pending', 'active')
  AND us.next_scheduled_at <= NOW()
ORDER BY us.next_scheduled_at ASC
LIMIT p_limit
FOR UPDATE SKIP LOCKED;  -- Cada worker pega registros diferentes
```

**Correcao dos dados:**
```sql
-- Voltar usuarios afetados para step 1
UPDATE user_sequences us
SET
  current_step = 1,
  next_scheduled_at = us.created_at + interval '7 days'
FROM sequences s
WHERE s.id = us.sequence_id
  AND s.name = 'twitter_discovery'
  AND us.current_step = 2;
```

**Licao aprendida:** SEMPRE usar locks quando multiplos workers podem processar os mesmos registros.

---

## Rate Limiting

Para evitar ban do WhatsApp, implementamos rate limiting em 3 niveis:

### 1. Enrollment (batch)

```sql
-- Randomizacao de 0-30 minutos no primeiro step
next_scheduled_at = NOW() + delay + (random() * 30 * interval '1 minute')
```

### 2. Job (processSequenceSteps)

```typescript
// Maximo 50 steps por execucao
const pendingSteps = await rpc('get_pending_sequence_steps', { p_limit: 50 });
```

### 3. Envio (entre mensagens)

```typescript
// 200ms entre cada mensagem
await new Promise(resolve => setTimeout(resolve, 200));
```

---

## Como Testar Novas Estrategias

### 1. Criar Nova Sequencia

```sql
INSERT INTO sequences (name, description, type, steps, cancel_condition, status)
VALUES (
  'nova_feature_discovery',
  'Apresenta nova feature X aos usuarios',
  'discovery',
  '[
    {"step": 0, "delay_hours": 2, "message_key": "feature_x_d0"},
    {"step": 1, "delay_days": 3, "message_key": "feature_x_d3"}
  ]'::jsonb,
  'feature_x_used = true',
  'draft'  -- Comeca em draft para testar
);
```

### 2. Criar Mensagens

```sql
INSERT INTO sequence_messages (message_key, sequence_id, title, body)
VALUES
  ('feature_x_d0', '<sequence_id>', 'Nova Feature!', 'Corpo da mensagem...'),
  ('feature_x_d3', '<sequence_id>', 'Lembrete', 'Corpo do lembrete...');
```

### 3. Ativar Sequencia

```sql
UPDATE sequences SET status = 'active', activated_at = NOW()
WHERE name = 'nova_feature_discovery';
```

### 4. Testar Enrollment Manual

```sql
SELECT enroll_user_in_sequence(
  '<user_id>',
  'nova_feature_discovery',
  '{"trigger": "manual", "reason": "teste"}'::jsonb
);
```

### 5. Monitorar

```sql
-- Ver inscritos
SELECT * FROM user_sequences us
JOIN sequences s ON s.id = us.sequence_id
WHERE s.name = 'nova_feature_discovery';

-- Ver eventos
SELECT * FROM sequence_events
WHERE user_sequence_id IN (
  SELECT id FROM user_sequences WHERE sequence_id = '<sequence_id>'
);
```

### 6. A/B Testing dentro da Sequencia

Use o campo `variants` em `sequence_messages`:

```sql
UPDATE sequence_messages SET variants = '{
  "A": {"body": "Mensagem versao A..."},
  "B": {"body": "Mensagem versao B..."}
}'::jsonb
WHERE message_key = 'feature_x_d0';
```

O campo `variant` em `user_sequences` define qual variante o usuario recebe.

---

## Metricas e Analytics

### RPC: get_sequence_analytics

```sql
SELECT * FROM get_sequence_analytics(
  '<sequence_id>',
  '2026-01-10',  -- start_date
  '2026-01-20'   -- end_date
);
```

Retorna:
- Total inscritos
- Enviados por step
- Taxa de conclusao
- Taxa de cancelamento
- Conversoes (feature_used)

### Queries Uteis

```sql
-- Resumo por status
SELECT status, COUNT(*) FROM user_sequences
WHERE sequence_id = '<id>'
GROUP BY status;

-- Funil por step
SELECT current_step, COUNT(*) FROM user_sequences
WHERE sequence_id = '<id>' AND status != 'cancelled'
GROUP BY current_step;

-- Taxa de conversao
SELECT
  COUNT(*) FILTER (WHERE se.event_type = 'feature_used') as conversoes,
  COUNT(DISTINCT us.id) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE se.event_type = 'feature_used') / COUNT(DISTINCT us.id), 2) as taxa
FROM user_sequences us
LEFT JOIN sequence_events se ON se.user_sequence_id = us.id
WHERE us.sequence_id = '<id>';
```

---

## Arquivos de Codigo

### Backend

| Arquivo | Funcao |
|---------|--------|
| `src/services/sequenceService.ts` | Funcoes de enrollment |
| `src/jobs/processSequenceSteps.ts` | Job de envio |
| `src/routes/webhook.ts` | Triggers de enrollment (linhas 487-501, 1910-1925) |
| `src/worker.ts` | Registro do job |
| `src/rpc/registry.ts` | Definicao type-safe dos RPCs |

### Banco de Dados

| Arquivo | Descricao |
|---------|-----------|
| `supabase/migrations/*_create_sequences.sql` | Criacao das tabelas |
| `supabase/migrations/*_sequence_rpcs.sql` | RPCs |
| `supabase/migrations/*_update_twitter_discovery_messages.sql` | Mensagens |

---

## Checklist Completo: Lancamento de Nova Sequencia

> **IMPORTANTE:** Este checklist foi criado baseado nos erros reais encontrados durante a implementacao do Twitter Discovery. Seguir TODOS os itens antes de ativar uma sequencia.

### 1. BANCO DE DADOS / RPCs

- [ ] RPC usa `TEXT` nao `VARCHAR` para campos da tabela `users` (name, whatsapp_number)
- [ ] RPC tem `FOR UPDATE SKIP LOCKED` se multiplos workers podem processar
- [ ] RPC esta no registry (`src/rpc/registry.ts`) com tipos corretos
- [ ] Tipos de retorno definidos em `src/rpc/types.ts`
- [ ] Cancel condition testada - rodar SQL manual antes para validar
- [ ] Filtro de elegibilidade definido (ex: `created_at >= '2026-01-10'`)

### 2. MENSAGENS (sequence_messages)

- [ ] Campo `title` preenchido (**NUNCA NULL** - Avisa API exige!)
- [ ] Campo `body` sem erros de encoding (usar `E'...'` para escape)
- [ ] `message_type` correto (`text` ou `buttons`)
- [ ] Se tem botoes: IDs unicos e descritivos (ex: `btn_twitter_learn`)
- [ ] Se tem botoes: **Handlers existem no `webhook.ts`**
- [ ] Se tem botoes: Mapeamento no `avisaApi.ts` (se necessario)
- [ ] Placeholders validados (`{name}`, `{user_name}` funcionam)

### 3. HANDLERS DE BOTOES

- [ ] Handler existe para cada button ID no `webhook.ts`
- [ ] **CONTEXTO**: Resposta faz sentido para sequencia (usuario recebe dias depois, nao durante uso ativo!)
- [ ] **NAMING**: Usar prefixo `btn_seq_` para diferenciar de botoes de onboarding (`button_`)
- [ ] **RPC ATOMICA**: Criar RPC com `FOR UPDATE SKIP LOCKED` para evitar duplicacao em cliques rapidos
- [ ] Tracking de eventos - registrar `button_clicked` em `sequence_events` com `button_id` e `step`
- [ ] Handler deve cancelar a sequencia (evita mensagens futuras se usuario ja interagiu)

### 4. JOB DE ENVIO (processSequenceSteps)

- [ ] Rate limiting: 200ms entre mensagens
- [ ] Batch size limitado: max 50 por execucao
- [ ] Lock no RPC para evitar duplicacao
- [ ] Logs adequados para debug

### 5. ENROLLMENT

- [ ] Trigger definido - onde no codigo chama `enrollUserInSequence()`
- [ ] Condicoes de enrollment claras (quem entra, quem nao entra)
- [ ] Randomizacao de horario (0-30min) para evitar ban WhatsApp
- [ ] Nao inscreve se ja esta na sequencia (RPC valida)
- [ ] Nao inscreve se cancel_condition ja e true (RPC valida)

### 6. BATCH ENROLLMENT (retroativos)

- [ ] Testar com 1 usuario primeiro (enrollment manual)
- [ ] Batch size pequeno (50 por vez)
- [ ] Verificar elegiveis antes - query de contagem
- [ ] Monitorar primeiro batch antes de continuar

### 7. TESTES PRE-DEPLOY

- [ ] Testar enrollment manual via SQL
- [ ] Testar envio de mensagem - verificar se chega no WhatsApp
- [ ] Testar clique em botoes - verificar se handler responde
- [ ] Testar cancel condition - verificar se cancela quando deve
- [ ] Verificar logs do job: `SELECT * FROM job_logs WHERE job_name = 'process-sequence-steps'`

### 8. MONITORAMENTO POS-DEPLOY

- [ ] Verificar eventos de erro:
  ```sql
  SELECT * FROM sequence_events WHERE event_type = 'step_failed' ORDER BY created_at DESC LIMIT 20;
  ```

- [ ] Verificar duplicacoes:
  ```sql
  SELECT user_id, COUNT(*) as vezes
  FROM sequence_events
  WHERE event_type = 'step_sent'
  GROUP BY user_id
  HAVING COUNT(*) > 1;
  ```

- [ ] Verificar status das sequencias:
  ```sql
  SELECT status, current_step, COUNT(*)
  FROM user_sequences us
  JOIN sequences s ON s.id = us.sequence_id
  WHERE s.name = 'NOME_DA_SEQUENCIA'
  GROUP BY status, current_step;
  ```

### 9. DOCUMENTACAO

- [ ] Atualizar `FLOWCHARTS.md` com novo fluxo
- [ ] Atualizar este documento com configuracao da sequencia
- [ ] Documentar erros encontrados e solucoes

---

## Erros Conhecidos (Nao Repetir!)

| Erro | Causa | Solucao |
|------|-------|---------|
| RPC retorna 400 | `VARCHAR` vs `TEXT` no retorno | Usar `TEXT` nos tipos de retorno do RPC |
| Mensagens duplicadas | Sem lock no RPC | Adicionar `FOR UPDATE SKIP LOCKED` |
| Erro 422 Avisa API | `title = NULL` | **SEMPRE** preencher titulo |
| Botao nao faz nada | Sem handler no webhook | Adicionar `case` no webhook.ts |
| Steps pulados | Duplicacao avancou 2x | Lock + corrigir current_step manual |
| Ban WhatsApp | Muitas msgs de uma vez | Randomizar horarios + rate limit 200ms |
| RPC nao encontrado | Nao esta no registry | Adicionar em `src/rpc/registry.ts` |
| Resposta sem contexto | Reusar handler de onboarding | Criar handlers especificos com prefixo `btn_seq_` |
| Clique duplo duplica msg | Handler sem lock atomico | Criar RPC atomica para processar clique |

---

## Glossario Adicional

| Termo | Definicao |
|-------|-----------|
| Sequence | Conjunto de mensagens enviadas ao longo do tempo |
| Step | Uma etapa da sequencia (uma mensagem) |
| Enrollment | Inscricao do usuario na sequencia |
| Cancel Condition | Condicao SQL que cancela a sequencia |
| Drip Campaign | Marketing de gotejamento (mensagens espaçadas) |

---

## Experimentos vs Sequencias: Quando Usar Cada Um?

### Experimentos (A/B Testing)

**Objetivo:** Testar variacoes para medir qual performa melhor

**Estrutura de tabelas:**
```
experiments → experiment_variants → user_experiments → experiment_events
```

**Caracteristicas:**
- Foco em **comparacao estatistica** entre grupos
- Usuario fica em UMA variante (A ou B ou C)
- Tempo: **curto prazo** - ate ter significancia estatistica
- Mede: conversao, retencao, engajamento entre grupos
- Exemplo: "Qual limite diario converte mais? 4 ou 6 figurinhas?"

**Quando usar:**
- Testar hipoteses ("sera que X e melhor que Y?")
- Decisoes de produto baseadas em dados
- Comparar diferentes abordagens

---

### Sequencias (Communication Sequences / Drip Campaigns)

**Objetivo:** Engajar usuarios ao longo do tempo com mensagens programadas

**Estrutura de tabelas:**
```
sequences → sequence_steps → sequence_messages → user_sequences → sequence_events
```

**Caracteristicas:**
- Foco em **comunicacao temporal** (d+0, d+7, d+15, d+30)
- Usuario recebe mensagens em intervalos definidos
- Tempo: **longo prazo** - ciclo de vida do usuario
- Mede: taxa de abertura, cliques, conversao da sequencia
- Exemplo: "Lembrar usuario sobre feature Twitter em d+7, d+15, d+30"

**Quando usar:**
- Onboarding progressivo
- Reengajamento de usuarios inativos
- Educacao sobre features
- Nurturing para upgrade

---

### Resumo Comparativo

| Aspecto | Experimentos | Sequencias |
|---------|--------------|------------|
| **Objetivo** | Testar hipoteses | Engajar ao longo do tempo |
| **Duracao** | Curto prazo | Longo prazo |
| **Usuario** | Fica em 1 variante | Recebe multiplas mensagens |
| **Foco** | Comparacao A vs B | Jornada do usuario |
| **Trigger** | Evento unico | Tempo (d+0, d+7...) |
| **Saida** | Dados para decisao | Conversao/engajamento |

### Podem ser combinados!

Use experimentos DENTRO de sequencias:
- Testar qual mensagem da sequencia converte mais
- Campo `variants` em `sequence_messages` permite A/B por step

```sql
-- Exemplo: Testar duas versoes da mensagem d+7
UPDATE sequence_messages SET variants = '{
  "A": {"body": "Versao curta..."},
  "B": {"body": "Versao longa com mais detalhes..."}
}' WHERE message_key = 'twitter_d7';
```

---

**Ultima atualizacao:** 13/01/2026

---

---

# PARTE 3: Sistema Unificado de Campanhas (Campaigns)

**Status:** IMPLEMENTADO
**Data Implementacao:** 13/01/2026

---

## Resumo Executivo

### O Que E?

Sistema unificado que combina Experimentos A/B e Sequencias de Comunicacao em uma unica estrutura chamada **Campaigns**. Resolve a fragmentacao entre os dois sistemas anteriores e incorpora TODOS os aprendizados/bugs encontrados durante o desenvolvimento.

### Por Que Unificar?

1. **Duplicacao de codigo**: Experiments e Sequences tinham logicas muito similares
2. **Bugs repetidos**: Os mesmos erros (race conditions, tipos VARCHAR vs TEXT) apareciam nos dois sistemas
3. **Flexibilidade**: Novo sistema permite:
   - A/B testing POR STEP da campanha
   - Drip campaigns com variacoes
   - Event-based triggers + follow-ups temporais
4. **Manutencao**: Um unico sistema para manter ao inves de dois

### Tipos de Campanhas Suportados

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| `drip` | Baseado em tempo (d+0, d+7, d+15, d+30) | Welcome sequence |
| `event` | Dispara em evento especifico | Limite atingido → upsell |
| `hybrid` | Evento inicial + follow-ups por tempo | Limite → upsell + lembretes d+3, d+7 |

---

## Arquitetura do Sistema

### Visao Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      UNIFIED CAMPAIGNS SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────┐    ┌──────────────┐    ┌──────────────────┐                 │
│  │ campaigns │───▶│campaign_steps│───▶│campaign_messages │                 │
│  │ (config)  │    │ (A/B/step)   │    │ (conteudo)       │                 │
│  └───────────┘    └──────────────┘    └──────────────────┘                 │
│        │                                                                     │
│        ▼                                                                     │
│  ┌──────────────┐    ┌──────────────────┐                                   │
│  │user_campaigns│───▶│ campaign_events  │                                   │
│  │ (inscricao)  │    │ (tracking)       │                                   │
│  └──────────────┘    └──────────────────┘                                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                JOB: processPendingCampaignMessages               │        │
│  │         (roda periodicamente, envia mensagens agendadas)         │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Enrollment

```
Evento acontece (ex: limite_hit)
       ↓
Codigo chama enrollUserInCampaign()
       ↓
RPC enroll_user_in_campaign
       ↓
Verifica: campanha esta 'active'?
       ↓ Sim
Verifica: usuario ja esta inscrito?
       ↓ Nao
Verifica: target_filter (created_after, subscription_plan, etc)
       ↓ Passou
Verifica: cancel_condition ja e true?
       ↓ Nao
Verifica: max_users atingido?
       ↓ Nao
Sorteia variante (se step tem A/B)
       ↓
Cria user_campaign com next_scheduled_at = NOW() + delay + random(0-30min)
       ↓
Registra evento 'enrolled'
       ↓
Retorna user_campaign_id
```

### Fluxo de Envio de Mensagens

```
[Job CRON periodico]
       ↓
RPC get_pending_campaign_messages (com FOR UPDATE SKIP LOCKED)
       ↓
Atualiza status para 'processing' (lock atomico)
       ↓
Para cada mensagem:
  ├─ sendCampaignMessage() baseado no content_type
  │     ├─ text: sendText()
  │     ├─ buttons: sendButtons() via Avisa API
  │     └─ sticker/image/video: TODO
  ├─ Rate limit: 200ms entre envios
  └─ RPC advance_campaign_step()
       ├─ success=true: avanca para proximo step ou completa
       └─ success=false: volta status para 'active' (retry)
       ↓
Proximo step agendado (ou campanha completada)
```

### Fluxo de Clique em Botao

```
Usuario clica botao (btn_campaign_*)
       ↓
webhook.ts identifica prefixo btn_campaign_
       ↓
handleCampaignButton() ou handler especifico
       ↓
RPC handle_campaign_button_click (com FOR UPDATE SKIP LOCKED)
       ↓
Ja processado por outro request?
       ↓ Nao (primeiro clique)
Registra evento 'button_clicked'
       ↓
Cancela campanha (se shouldCancel=true)
       ↓
Envia resposta ao usuario
```

---

## Modelo de Dados

### Tabela: campaigns

Definicao da campanha (equivale a experiments + sequences unificado).

```sql
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificacao
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,

    -- Tipo: 'drip', 'event', 'hybrid'
    campaign_type VARCHAR(50) NOT NULL,

    -- Configuracao do trigger
    -- drip: {"initial_delay_hours": 4}
    -- event: {"event_name": "limit_hit", "send_immediately": true}
    -- hybrid: {"event_name": "limit_hit", "initial_delay_hours": 4}
    trigger_config JSONB NOT NULL DEFAULT '{}',

    -- Filtro de elegibilidade
    -- Ex: {"min_stickers": 3, "subscription_plan": "free", "created_after": "2026-01-10"}
    target_filter JSONB,

    -- Condicao SQL para cancelamento automatico
    -- Ex: "twitter_feature_used = true"
    cancel_condition TEXT,

    -- Controle
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, active, paused, ended
    priority INT DEFAULT 0,
    max_users INT,  -- NULL = ilimitado

    -- Settings gerais
    settings JSONB DEFAULT '{
        "rate_limit_ms": 200,
        "batch_size": 50,
        "randomize_minutes": 30,
        "send_window_start": 8,
        "send_window_end": 22
    }',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);
```

### Tabela: campaign_steps

Steps da campanha com suporte a A/B testing POR STEP.

```sql
CREATE TABLE campaign_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Ordem e identificacao
    step_order INT NOT NULL,          -- 0, 1, 2, 3...
    step_key VARCHAR(50) NOT NULL,    -- 'day_0', 'wave_1', 'welcome'

    -- Timing
    delay_hours INT DEFAULT 0,        -- 0 = imediato, 168 = 7 dias
    send_window JSONB,                -- {"start_hour": 8, "end_hour": 22}

    -- A/B Testing neste step
    -- Ex: ["control", "benefit", "urgency", "social_proof"]
    variants JSONB,

    -- Pesos das variantes (NULL = distribuicao igual)
    -- Ex: {"control": 25, "benefit": 25, "urgency": 25, "social_proof": 25}
    variant_weights JSONB,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(campaign_id, step_order),
    UNIQUE(campaign_id, step_key)
);
```

### Tabela: campaign_messages

Conteudo das mensagens por variante.

```sql
CREATE TABLE campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id UUID NOT NULL REFERENCES campaign_steps(id) ON DELETE CASCADE,

    -- Variante ('default' se nao tem A/B)
    variant VARCHAR(50) DEFAULT 'default',

    -- Tipo: 'text', 'buttons', 'sticker', 'image', 'video'
    content_type VARCHAR(20) NOT NULL DEFAULT 'text',

    -- Conteudo
    title TEXT NOT NULL DEFAULT '',  -- OBRIGATORIO pela Avisa API!
    body TEXT NOT NULL,
    footer TEXT,

    -- Botoes (para content_type = 'buttons')
    -- Ex: [{"id": "btn_campaign_learn", "text": "Quero ver!"}]
    buttons JSONB,

    -- Midia (para sticker/image/video)
    media JSONB,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(step_id, variant)
);
```

**IMPORTANTE:** Campo `title` NUNCA pode ser NULL (Avisa API exige)!

### Tabela: user_campaigns

Inscricao de usuarios em campanhas.

```sql
CREATE TABLE user_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Progresso
    current_step INT DEFAULT 0,
    variant VARCHAR(50),
    next_scheduled_at TIMESTAMPTZ,

    -- Status com suporte a lock atomico
    -- IMPORTANTE: 'processing' permite lock sem constraint violation
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending, active, processing, completed, cancelled

    cancel_reason VARCHAR(100),
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, campaign_id)
);
```

**Status 'processing':** Permite que o job marque o registro como "em processamento" antes de enviar. Se outro worker tentar processar o mesmo registro, o `FOR UPDATE SKIP LOCKED` pula. Isso evita mensagens duplicadas.

### Tabela: campaign_events

Todos os eventos de todas as campanhas em um unico lugar.

```sql
CREATE TABLE campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Referencias
    user_campaign_id UUID REFERENCES user_campaigns(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Evento
    event_type VARCHAR(50) NOT NULL,
    -- enrolled, step_scheduled, step_sent, step_failed
    -- button_clicked, converted, cancelled, completed
    -- menu_shown, upgrade_clicked, payment_started, dismiss_clicked

    -- Contexto
    step_key VARCHAR(50),
    variant VARCHAR(50),

    -- Dados extras
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## RPCs Implementados

### 1. campaign_select_variant

Helper function para sortear variante baseado nos pesos.

```sql
CREATE OR REPLACE FUNCTION campaign_select_variant(
    p_variants JSONB,       -- ["control", "test_a", "test_b"]
    p_weights JSONB         -- {"control": 50, "test_a": 25, "test_b": 25} ou NULL
)
RETURNS TEXT  -- IMPORTANTE: TEXT nao VARCHAR!
```

**Retorna:** Nome da variante sorteada, ou 'default' se nao tem variantes.

### 2. enroll_user_in_campaign

Inscreve usuario em uma campanha com todas as validacoes.

```sql
CREATE OR REPLACE FUNCTION enroll_user_in_campaign(
    p_user_id UUID,
    p_campaign_name VARCHAR(100),
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID  -- IMPORTANTE: Retorna primitivo, nao RECORD!
```

**Validacoes:**
1. Campanha esta 'active'
2. Usuario nao esta inscrito ainda
3. Usuario passa no target_filter
4. cancel_condition nao e true
5. max_users nao atingido
6. Campanha tem pelo menos 1 step

**Retorna:** UUID do user_campaign criado, ou NULL se nao inscreveu.

### 3. get_pending_campaign_messages

Busca mensagens prontas para envio com lock atomico.

```sql
CREATE OR REPLACE FUNCTION get_pending_campaign_messages(
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    user_campaign_id UUID,
    user_id UUID,
    user_number TEXT,      -- IMPORTANTE: TEXT nao VARCHAR!
    user_name TEXT,        -- IMPORTANTE: TEXT nao VARCHAR!
    campaign_id UUID,
    campaign_name VARCHAR(100),
    campaign_type VARCHAR(50),
    step_order INT,
    step_key VARCHAR(50),
    variant VARCHAR(50),
    content_type VARCHAR(20),
    title TEXT,
    body TEXT,
    footer TEXT,
    buttons JSONB,
    media JSONB,
    cancel_condition TEXT,
    settings JSONB
)
```

**Comportamento:**
1. `FOR UPDATE SKIP LOCKED` - cada worker pega registros diferentes
2. Atualiza status para 'processing' antes de retornar
3. Retorna dados completos para envio (usuario + campanha + mensagem)

### 4. advance_campaign_step

Avanca para proximo step apos envio.

```sql
CREATE OR REPLACE FUNCTION advance_campaign_step(
    p_user_campaign_id UUID,
    p_success BOOLEAN DEFAULT true,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TEXT  -- IMPORTANTE: TEXT nao VARCHAR!
-- Retorna: 'advanced', 'completed', 'failed', 'not_found'
```

**Comportamento:**
- `success=true`: Avanca para proximo step ou marca como 'completed'
- `success=false`: Volta status para 'active' (permite retry)
- Registra eventos `step_sent` ou `step_failed`
- Calcula `next_scheduled_at` com randomizacao

### 5. handle_campaign_button_click

Processa clique de botao de forma atomica.

```sql
CREATE OR REPLACE FUNCTION handle_campaign_button_click(
    p_user_number TEXT,          -- IMPORTANTE: TEXT nao VARCHAR!
    p_campaign_name VARCHAR(100),
    p_button_id VARCHAR(100),
    p_should_cancel BOOLEAN DEFAULT true
)
RETURNS BOOLEAN  -- IMPORTANTE: Retorna primitivo!
-- TRUE = primeiro clique (deve processar), FALSE = ja processado
```

**Comportamento:**
1. `FOR UPDATE SKIP LOCKED` - evita duplicacao em cliques rapidos
2. Registra evento `button_clicked` com button_id
3. Cancela campanha se `p_should_cancel=true`
4. Retorna FALSE se registro ja estava travado (outro request processando)

### 6. check_campaign_cancel_conditions

Verifica e cancela campanhas que atingiram cancel_condition.

```sql
CREATE OR REPLACE FUNCTION check_campaign_cancel_conditions()
RETURNS INT  -- Numero de campanhas canceladas
```

**Uso:** Chamar periodicamente pelo worker para cancelar campanhas de usuarios que ja converteram.

### 7. get_campaign_analytics

Retorna analytics completos de uma campanha.

```sql
CREATE OR REPLACE FUNCTION get_campaign_analytics(
    p_campaign_name VARCHAR(100),
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
```

**Retorna:**
```json
{
  "campaign": "nome_campanha",
  "period": {"start": "...", "end": "..."},
  "totals": {
    "enrolled": 100,
    "completed": 45,
    "cancelled": 20,
    "button_clicks": 30,
    "messages_sent": 200,
    "messages_failed": 5
  },
  "by_variant": {
    "control": {"enrolled": 50, "button_clicks": 15, "click_rate": 30.0, ...},
    "test_a": {"enrolled": 50, "button_clicks": 15, "click_rate": 30.0, ...}
  },
  "by_step": {
    "day_0": {"sent": 100, "failed": 2, "clicks": 20},
    "day_7": {"sent": 78, "failed": 1, "clicks": 10}
  },
  "funnel": [
    {"step": 0, "step_key": "day_0", "users_reached": 100, "drop_off_rate": 0},
    {"step": 1, "step_key": "day_7", "users_reached": 78, "drop_off_rate": 22.0}
  ]
}
```

### 8. revert_stuck_campaign_processing

Recupera campanhas travadas em 'processing' (worker crash recovery).

```sql
CREATE OR REPLACE FUNCTION revert_stuck_campaign_processing(
    p_older_than_minutes INT DEFAULT 10
)
RETURNS INT  -- Numero de campanhas revertidas
```

**Uso:** Chamar no inicio do job para recuperar registros que ficaram travados por crash.

---

## Service Layer: campaignService.ts

### Funcoes de Enrollment

```typescript
// Enrollment generico
async function enrollUserInCampaign(
  userId: string,
  campaignName: CampaignName,
  options: EnrollmentOptions
): Promise<string | null>

// Convenience functions
async function enrollInTwitterDiscoveryV2(userId, metadata): Promise<string | null>
async function enrollInCleanupFeatureV2(userId, metadata): Promise<string | null>
async function enrollInLimitUpsell(userId, metadata): Promise<string | null>
async function enrollInWelcomeDrip(userId, metadata): Promise<string | null>
```

### Funcoes de Button Handling

```typescript
// Handler atomico de clique
async function handleCampaignButtonClick(
  userNumber: string,
  campaignName: CampaignName,
  buttonId: string,
  shouldCancel: boolean = true
): Promise<boolean>

// Handler completo (clique + resposta)
async function handleCampaignButton(
  userNumber: string,
  userName: string,
  buttonId: string,
  campaignName: CampaignName,
  responseMessage: string,
  shouldCancel: boolean = true
): Promise<void>
```

### Funcoes para Worker

```typescript
// Processa mensagens agendadas
async function processPendingCampaignMessages(
  limit: number = 50,
  rateLimitMs: number = 200
): Promise<{ sent: number; failed: number; total: number }>

// Verifica cancel_conditions
async function checkCancelConditions(): Promise<number>

// Recovery de locks travados
async function revertStuckProcessing(
  olderThanMinutes: number = 10
): Promise<number>
```

### Funcoes de Envio

```typescript
// Envia baseado no content_type
async function sendCampaignMessage(
  message: CampaignPendingMessage
): Promise<boolean>
```

**Suporta:**
- `text`: Envia via `sendText()`
- `buttons`: Envia via `sendButtons()` (Avisa API)
- `sticker/image/video`: TODO (fallback para text)

### Analytics

```typescript
async function getCampaignAnalytics(
  campaignName: CampaignName,
  startDate?: string,
  endDate?: string
): Promise<CampaignAnalytics | null>
```

---

## Tipos TypeScript

### types.ts

```typescript
// Mensagem pendente de campanha
interface CampaignPendingMessage {
  user_campaign_id: string;
  user_id: string;
  user_number: string;
  user_name: string;
  campaign_id: string;
  campaign_name: string;
  campaign_type: 'drip' | 'event' | 'hybrid';
  step_order: number;
  step_key: string;
  variant: string;
  content_type: 'text' | 'buttons' | 'sticker' | 'image' | 'video';
  title: string;
  body: string;
  footer: string | null;
  buttons: Array<{ id: string; text: string }> | null;
  media: { type: string; url: string; sticker_id?: string } | null;
  cancel_condition: string | null;
  settings: {
    rate_limit_ms?: number;
    batch_size?: number;
    randomize_minutes?: number;
    send_window_start?: number;
    send_window_end?: number;
  };
}

// Analytics de campanha
interface CampaignAnalytics {
  campaign: string;
  period: { start: string; end: string };
  totals: {
    enrolled: number;
    completed: number;
    cancelled: number;
    button_clicks: number;
    messages_sent: number;
    messages_failed: number;
  };
  by_variant: Record<string, { enrolled; button_clicks; completed; click_rate; completion_rate }>;
  by_step: Record<string, { sent; failed; clicks }>;
  funnel: Array<{ step; step_key; users_reached; drop_off_rate }>;
}
```

### campaignService.ts Types

```typescript
// Nomes de campanhas disponiveis
type CampaignName =
  | 'twitter_discovery_v2'
  | 'cleanup_feature_v2'
  | 'limit_upsell'
  | 'welcome_drip'
  | 'reengagement_30d';

// Triggers possiveis
type CampaignTrigger =
  | 'limit_hit'
  | 'first_sticker'
  | 'nth_sticker'
  | 'feature_used'
  | 'inactivity'
  | 'manual'
  | 'scheduled'
  | 'webhook';
```

---

## Protecoes contra Bugs (Baseado em Analise de Commits)

O sistema foi projetado incorporando TODOS os bugs encontrados durante o desenvolvimento de Experiments e Sequences.

### 1. Race Conditions (6 bugs encontrados)

**Protecao:** `FOR UPDATE SKIP LOCKED` em todas as RPCs que processam registros.

```sql
-- Exemplo em get_pending_campaign_messages
SELECT array_agg(uc.id) INTO v_locked_ids
FROM user_campaigns uc
WHERE uc.status IN ('pending', 'active')
  AND uc.next_scheduled_at <= NOW()
ORDER BY uc.next_scheduled_at ASC
LIMIT p_limit
FOR UPDATE SKIP LOCKED;
```

### 2. Tipos VARCHAR vs TEXT (3 bugs encontrados)

**Protecao:** Todas as RPCs usam `TEXT` para campos que sao `TEXT` na tabela.

```sql
-- CORRETO
user_number TEXT,
user_name TEXT,
RETURNS TEXT

-- ERRADO (causava erro 400)
user_number VARCHAR,
user_name VARCHAR,
RETURNS VARCHAR
```

### 3. Retorno RECORD vs Primitivo (2 bugs encontrados)

**Protecao:** RPCs retornam valores primitivos, nao objetos.

```sql
-- CORRETO: Retorna primitivo
RETURNS BOOLEAN
RETURNS UUID
RETURNS TEXT

-- ERRADO: JavaScript interpreta {} como truthy mesmo vazio
RETURNS TABLE(result BOOLEAN)
```

### 4. Status Intermediario 'processing' (2 bugs encontrados)

**Protecao:** Constraint permite status 'processing' para lock atomico.

```sql
status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'processing', 'completed', 'cancelled'))
```

### 5. Campo title NULL (1 bug encontrado)

**Protecao:** `title TEXT NOT NULL DEFAULT ''` - nunca sera NULL.

### 6. Falta de Tracking de Cliques (1 bug encontrado)

**Protecao:** `handle_campaign_button_click` registra evento com button_id e metadata.

### 7. JobId Colisao (1 bug encontrado)

**Protecao:** Usar `crypto.randomUUID()` ao inves de `Date.now()` para IDs.

---

## Migracao: Sequences → Campaigns

### Estrategia Recomendada

1. **Nao migrar dados existentes** - Deixar sequences funcionando para usuarios ja inscritos
2. **Novos enrollments usam campaigns** - Configurar mesma sequencia como campaign
3. **Gradual phase-out** - Quando todas as sequences ativas terminarem, desativar sistema antigo

### Como Recriar Sequencia como Campanha

```sql
-- Exemplo: Recriar twitter_discovery como campanha

-- 1. Criar campanha
INSERT INTO campaigns (name, description, campaign_type, trigger_config, cancel_condition, status)
VALUES (
  'twitter_discovery_v2',
  'Apresenta feature de download de videos do Twitter',
  'hybrid',
  '{"event_name": "limit_hit", "initial_delay_hours": 4}'::jsonb,
  'twitter_feature_used = true',
  'active'
);

-- 2. Criar steps
INSERT INTO campaign_steps (campaign_id, step_order, step_key, delay_hours, variants)
VALUES
  ((SELECT id FROM campaigns WHERE name = 'twitter_discovery_v2'), 0, 'day_0', 4, NULL),
  ((SELECT id FROM campaigns WHERE name = 'twitter_discovery_v2'), 1, 'day_7', 168, NULL),
  ((SELECT id FROM campaigns WHERE name = 'twitter_discovery_v2'), 2, 'day_15', 360, NULL),
  ((SELECT id FROM campaigns WHERE name = 'twitter_discovery_v2'), 3, 'day_30', 720, NULL);

-- 3. Criar mensagens
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
VALUES
  (
    (SELECT id FROM campaign_steps WHERE step_key = 'day_0'),
    'default',
    'buttons',
    'Dica do Sticker Bot',
    'Sabia que voce pode baixar videos do Twitter/X...',
    '[{"id": "btn_campaign_twitter_learn", "text": "Quero ver!"}, {"id": "btn_campaign_twitter_dismiss", "text": "Agora nao"}]'
  );
-- ... repetir para outros steps
```

---

## Arquivos Criados/Modificados

### Novos Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `supabase/migrations/20260113_create_unified_campaigns.sql` | Schema completo (987 linhas) |
| `src/services/campaignService.ts` | Service layer (450+ linhas) |
| `src/rpc/types.ts` | Adicionado `CampaignPendingMessage` e `CampaignAnalytics` |
| `src/rpc/registry.ts` | Adicionado 7 RPCs de campaign |

### Migration (20260113_create_unified_campaigns.sql)

**Conteudo:**
- 5 tabelas: campaigns, campaign_steps, campaign_messages, user_campaigns, campaign_events
- 8 RPCs com todas as protecoes
- Indices otimizados
- Grants para service_role
- Comentarios explicativos

---

## Checklist: Criacao de Nova Campanha

### 1. BANCO DE DADOS

- [ ] Criar registro em `campaigns` (status = 'draft')
- [ ] Criar steps em `campaign_steps` com delays corretos
- [ ] Criar mensagens em `campaign_messages` para cada step/variante
- [ ] Campo `title` preenchido em todas as mensagens
- [ ] Se tem botoes: IDs com prefixo `btn_campaign_`
- [ ] Cancel condition testada via SQL

### 2. CODIGO

- [ ] Adicionar nome da campanha em `CampaignName` type
- [ ] Criar convenience function de enrollment (opcional)
- [ ] Criar handlers de botoes no `webhook.ts`
- [ ] Usar `handleCampaignButton()` para handlers simples
- [ ] Para handlers complexos: usar `handleCampaignButtonClick()` + logica custom

### 3. WEBHOOK.TS

```typescript
// Exemplo de handler simples
if (interactive.id === 'btn_campaign_twitter_learn') {
  const { handleCampaignButton } = await import('../services/campaignService');
  await handleCampaignButton(
    userNumber,
    userName,
    'btn_campaign_twitter_learn',
    'twitter_discovery_v2',
    `Opa ${userName}! Para baixar videos do Twitter...`
  );
  return reply.status(200).send({ status: 'campaign_twitter_learn' });
}
```

### 4. WORKER

- [ ] Adicionar job `process-campaign-messages` se ainda nao existe
- [ ] Configurar frequencia (ex: a cada 5 minutos)
- [ ] Chamar `revertStuckProcessing()` no inicio
- [ ] Chamar `processPendingCampaignMessages()`
- [ ] Chamar `checkCancelConditions()` periodicamente

### 5. ATIVACAO

- [ ] Testar enrollment manual via SQL
- [ ] Testar envio de mensagem (verificar WhatsApp)
- [ ] Testar clique de botao
- [ ] Testar cancel_condition
- [ ] Atualizar status para 'active'

### 6. MONITORAMENTO

```sql
-- Ver status das inscricoes
SELECT status, current_step, COUNT(*)
FROM user_campaigns uc
JOIN campaigns c ON c.id = uc.campaign_id
WHERE c.name = 'NOME_CAMPANHA'
GROUP BY status, current_step;

-- Ver eventos de erro
SELECT * FROM campaign_events
WHERE event_type = 'step_failed'
  AND campaign_id = (SELECT id FROM campaigns WHERE name = 'NOME_CAMPANHA')
ORDER BY created_at DESC LIMIT 20;

-- Ver duplicacoes
SELECT user_id, COUNT(*)
FROM campaign_events
WHERE event_type = 'step_sent'
GROUP BY user_id
HAVING COUNT(*) > (SELECT COUNT(*) FROM campaign_steps WHERE campaign_id = 'ID');
```

---

## Proximos Passos

1. ~~**Criar job no worker.ts** para processar campanhas~~ ✅ FEITO
2. ~~**Migrar twitter_discovery para twitter_discovery_v2**~~ ✅ FEITO
3. **Criar campanha limit_upsell** (substituir sistema de experiments atual)
4. **Criar dashboard no admin-panel** para gerenciar campanhas
5. **Documentar API de campanhas** para criacao via admin

---

## Pente Fino - Analise de Schema e Correcoes

**Data:** 13/01/2026
**Status:** CONCLUIDO

### Problemas Encontrados e Corrigidos

#### 1. Falta de Triggers `updated_at`

**Problema:** As tabelas de campanhas nao tinham triggers para atualizar automaticamente o campo `updated_at` em UPDATEs.

**Solucao:** Migration `add_campaign_updated_at_triggers`
```sql
CREATE TRIGGER campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER campaign_steps_updated_at
    BEFORE UPDATE ON campaign_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER campaign_messages_updated_at
    BEFORE UPDATE ON campaign_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_campaigns_updated_at
    BEFORE UPDATE ON user_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2. RPC Nao Respeitava Janela de Envio

**Problema:** `get_pending_campaign_messages()` nao verificava `send_window_start/end`, permitindo envio de mensagens de madrugada.

**Solucao:** Migration `fix_campaign_send_window`
```sql
-- Adicionado na RPC:
v_current_hour := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo')::INT;

-- Filtro adicionado:
AND v_current_hour >= COALESCE((c.settings->>'send_window_start')::INT, 8)
AND v_current_hour < COALESCE((c.settings->>'send_window_end')::INT, 22)
```

#### 3. Crash se `body` for NULL

**Problema:** Se um step nao tiver mensagem configurada, `sendCampaignMessage()` crashava em `body.replace()`.

**Solucao:** Validacao em `campaignService.ts`:
```typescript
if (!body) {
  logger.error({
    msg: '[CAMPAIGN] Message body is NULL - step has no message configured',
    userCampaignId: message.user_campaign_id,
    campaignName: message.campaign_name,
    stepKey: message.step_key,
  });
  return false;
}
```

#### 4. Duplicacao com Sequence Antiga

**Problema:** 348 usuarios ativos na sequence `twitter_discovery` (sistema antigo) poderiam receber mensagens duplicadas da nova campanha.

**Solucao:** Executado via SQL:
```sql
-- Pausar sequence antiga
UPDATE sequences SET status = 'paused' WHERE name = 'twitter_discovery';

-- Cancelar user_sequences ativos
UPDATE user_sequences
SET status = 'cancelled', cancel_reason = 'migrated_to_campaign_v2'
WHERE sequence_id = (SELECT id FROM sequences WHERE name = 'twitter_discovery')
  AND status IN ('pending', 'active');
-- Resultado: 348 usuarios migrados
```

### Verificacoes Positivas (OK)

| Item | Status | Observacao |
|------|--------|------------|
| 5 tabelas criadas | ✅ | campaigns, campaign_steps, campaign_messages, user_campaigns, campaign_events |
| 8 RPCs funcionando | ✅ | Todos com tipos corretos (TEXT nao VARCHAR) |
| Indices para performance | ✅ | idx_user_campaigns_scheduled, idx_campaign_events_*, etc |
| Constraints (FK, CHECK, UNIQUE) | ✅ | Status check, content_type check, user_id+campaign_id unique |
| FOR UPDATE SKIP LOCKED | ✅ | Presente em get_pending_campaign_messages e handle_campaign_button_click |
| Status `processing` | ✅ | Permite atomic lock sem constraint violation |
| Logs no campaignService | ✅ | 25+ chamadas de logger (info, warn, error, debug) |
| `whatsapp_number` NOT NULL | ✅ | Constraint na tabela users |
| `twitter_feature_used` existe | ✅ | Coluna boolean com default false |
| Campanha twitter_discovery_v2 | ✅ | 1 campanha, 4 steps, 4 mensagens |

### Logs Disponiveis

Prefixos para busca:
- `[CAMPAIGN]` - Enrollment, envio, cliques, erros
- `[CAMPAIGN-JOB]` - Worker processing (reverted, cancelled, sent/failed)
- `[CAMPAIGN-SCHEDULER]` - Agendamento de jobs

### Migrations Aplicadas

1. `20260113_create_unified_campaigns` - Schema completo
2. `20260113_seed_twitter_discovery_v2` - Dados da campanha
3. `20260113_add_campaign_updated_at_triggers` - Triggers de updated_at
4. `20260113_fix_campaign_send_window` - Janela de envio 8h-22h

### Resultado Final

**Sistema de Campanhas Unificadas pronto para producao!**

- Worker rodando a cada 60 segundos
- Mensagens enviadas apenas entre 8h-22h (horario de Brasilia)
- Sequence antiga desativada, 348 usuarios migrados
- Todos os bugs conhecidos corrigidos preventivamente

---

## Historico de Alteracoes

| Data | Mudanca |
|------|---------|
| 12/01/2026 | Criacao do sistema de sequences |
| 13/01/2026 | Implementacao Twitter Discovery |
| 13/01/2026 | Fix: Tipo VARCHAR vs TEXT no RPC |
| 13/01/2026 | Fix: Campo title obrigatorio |
| 13/01/2026 | Fix: FOR UPDATE SKIP LOCKED (duplicacao) |
| 13/01/2026 | Adicionado checklist completo de lancamento |
| 13/01/2026 | **PARTE 3: Sistema Unificado de Campanhas** |
| 13/01/2026 | Criado schema unificado (5 tabelas, 8 RPCs) |
| 13/01/2026 | Criado campaignService.ts |
| 13/01/2026 | Adicionado types em registry.ts e types.ts |
| 13/01/2026 | Criado job process-campaigns no worker.ts (60s) |
| 13/01/2026 | Seed campanha twitter_discovery_v2 (4 steps) |
| 13/01/2026 | Handlers btn_campaign_* no webhook.ts |
| 13/01/2026 | Migrado enrollment para campaignService |
| 13/01/2026 | **PENTE FINO - 4 correcoes criticas** |
| 13/01/2026 | Fix: Triggers updated_at nas tabelas |
| 13/01/2026 | Fix: Janela de envio 8h-22h |
| 13/01/2026 | Fix: Validacao body NULL |
| 13/01/2026 | Migrado 348 usuarios da sequence antiga |
