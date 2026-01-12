# Communication Sequences Schema

Sistema genérico para sequências de comunicação automatizadas.

## Visão Geral

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   sequences     │────▶│  user_sequences  │────▶│  sequence_events    │
│  (campanhas)    │     │ (usuários ativos)│     │    (tracking)       │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
        │
        ▼
┌─────────────────┐
│sequence_messages│
│  (templates)    │
└─────────────────┘
```

## Casos de Uso

| Tipo | Exemplo | Trigger | Cancel Condition |
|------|---------|---------|------------------|
| Feature Discovery | Twitter, Cleanup | Após N stickers | Feature usada |
| Funnel Recovery | Nunca criou sticker | 24h após cadastro | Criou sticker |
| Re-engagement | Usuário inativo | 7 dias sem uso | Voltou a usar |
| Upsell | Free → Premium | 30 dias de uso | Assinou |
| Educational | Dicas de uso | Após 5º sticker | - |
| Seasonal | Natal, Carnaval | Data específica | - |

---

## Schema SQL

### 1. Tabela `sequences` (Configuração das Campanhas)

```sql
-- Configuração das sequências/campanhas de comunicação
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação
    name VARCHAR(100) NOT NULL UNIQUE,  -- ex: 'twitter_discovery', 'funnel_recovery_no_sticker'
    description TEXT,

    -- Tipo da sequência
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'feature_discovery',  -- Apresentar features
        'funnel_recovery',    -- Recuperar usuários que pararam no funil
        're_engagement',      -- Reativar usuários inativos
        'upsell',             -- Converter free → premium
        'educational',        -- Dicas e tutoriais
        'seasonal',           -- Campanhas sazonais
        'onboarding'          -- Onboarding avançado
    )),

    -- Critérios de entrada (quem pode entrar na sequência)
    -- Avaliado como SQL WHERE clause
    target_filter JSONB NOT NULL DEFAULT '{}',
    -- Exemplos:
    -- { "first_sticker_at": null }  -- nunca criou sticker
    -- { "first_sticker_at": { "gte": "2025-01-10" } }  -- criou após data
    -- { "twitter_feature_used": false, "twitter_feature_shown": true }
    -- { "subscription_type": "free", "total_stickers": { "gte": 20 } }

    -- Condição de cancelamento automático (SQL boolean expression)
    -- Se true, cancela a sequência para o usuário
    cancel_condition TEXT,
    -- Exemplos:
    -- 'twitter_feature_used = true'
    -- 'first_sticker_at IS NOT NULL'
    -- 'subscription_type != ''free'''

    -- Configuração dos steps
    steps JSONB NOT NULL,
    -- Formato:
    -- [
    --   { "step": 0, "delay_hours": 4, "message_key": "twitter_d0" },
    --   { "step": 1, "delay_days": 7, "message_key": "twitter_d7" },
    --   { "step": 2, "delay_days": 15, "message_key": "twitter_d15" },
    --   { "step": 3, "delay_days": 30, "message_key": "twitter_d30" }
    -- ]

    -- Controle
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',     -- Em criação
        'active',    -- Ativa, aceitando novos usuários
        'paused',    -- Pausada, não aceita novos mas continua os existentes
        'archived'   -- Arquivada, não processa mais
    )),

    -- Prioridade (se usuário qualifica para múltiplas, qual entra?)
    priority INT NOT NULL DEFAULT 100,  -- menor = maior prioridade

    -- Limites
    max_users INT,  -- NULL = sem limite

    -- Configurações adicionais
    settings JSONB NOT NULL DEFAULT '{}',
    -- Exemplos:
    -- { "send_window_start": "09:00", "send_window_end": "21:00" }
    -- { "exclude_premium": true }
    -- { "require_opt_in": false }

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,  -- quando foi ativada pela primeira vez

    -- Índices compostos criados abaixo
    CONSTRAINT valid_steps CHECK (jsonb_array_length(steps) > 0)
);

-- Índices
CREATE INDEX idx_sequences_status ON sequences(status);
CREATE INDEX idx_sequences_type ON sequences(type);
CREATE INDEX idx_sequences_priority ON sequences(priority) WHERE status = 'active';

-- Trigger para updated_at
CREATE TRIGGER sequences_updated_at
    BEFORE UPDATE ON sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 2. Tabela `sequence_messages` (Templates de Mensagens)

```sql
-- Templates de mensagens para cada step das sequências
CREATE TABLE sequence_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação
    message_key VARCHAR(100) NOT NULL UNIQUE,  -- ex: 'twitter_d0', 'recovery_d3_sticker'
    sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,

    -- Conteúdo
    title TEXT,  -- Para mensagens com botões
    body TEXT NOT NULL,  -- Corpo da mensagem (suporta {name}, {sticker_count}, etc.)
    footer TEXT,  -- Para mensagens com botões

    -- Tipo de mensagem
    message_type VARCHAR(30) NOT NULL DEFAULT 'text' CHECK (message_type IN (
        'text',           -- Mensagem simples
        'buttons',        -- Mensagem com botões (até 3)
        'list',           -- Mensagem com lista
        'media',          -- Mídia (imagem/vídeo/sticker)
        'media_buttons'   -- Mídia + botões
    )),

    -- Botões (se aplicável)
    buttons JSONB,
    -- Formato:
    -- [
    --   { "id": "btn_twitter_learn", "text": "🎬 Quero conhecer!" },
    --   { "id": "btn_twitter_dismiss", "text": "⏭️ Agora não" }
    -- ]

    -- Mídia anexa (se aplicável)
    media JSONB,
    -- Formato:
    -- { "type": "sticker", "url": "https://...", "filename": "welcome.webp" }
    -- { "type": "image", "url": "https://...", "caption": "Olha que legal!" }

    -- Variantes para A/B test (opcional)
    variants JSONB,
    -- Formato:
    -- {
    --   "control": { "body": "Mensagem A..." },
    --   "variant_b": { "body": "Mensagem B..." }
    -- }

    -- Metadados
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sequence_messages_sequence ON sequence_messages(sequence_id);
CREATE INDEX idx_sequence_messages_key ON sequence_messages(message_key);

-- Trigger para updated_at
CREATE TRIGGER sequence_messages_updated_at
    BEFORE UPDATE ON sequence_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 3. Tabela `user_sequences` (Usuários em Sequências)

```sql
-- Rastreia usuários que estão/estiveram em sequências
CREATE TABLE user_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacionamentos
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,

    -- Progresso
    current_step INT NOT NULL DEFAULT 0,
    next_scheduled_at TIMESTAMPTZ,  -- Quando o próximo step deve ser enviado

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',     -- Aguardando primeiro envio
        'active',      -- Em andamento
        'completed',   -- Completou todos os steps
        'cancelled',   -- Cancelada (condição atingida ou manual)
        'failed'       -- Falhou após retries
    )),

    -- Razão do cancelamento (se aplicável)
    cancel_reason VARCHAR(100),
    -- Exemplos: 'condition_met', 'user_opted_out', 'manual', 'sequence_archived'

    -- Variante A/B (se a sequência tiver variantes)
    variant VARCHAR(50),

    -- Metadados
    metadata JSONB NOT NULL DEFAULT '{}',
    -- Pode guardar contexto como:
    -- { "trigger": "limit_hit", "sticker_count_at_start": 3 }

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,      -- Quando o primeiro step foi enviado
    completed_at TIMESTAMPTZ,    -- Quando completou ou cancelou

    -- Garantir unicidade: usuário só pode estar em uma instância de cada sequência
    CONSTRAINT unique_user_sequence UNIQUE (user_id, sequence_id)
);

-- Índices para queries frequentes
CREATE INDEX idx_user_sequences_user ON user_sequences(user_id);
CREATE INDEX idx_user_sequences_sequence ON user_sequences(sequence_id);
CREATE INDEX idx_user_sequences_status ON user_sequences(status);

-- Índice para o job que processa sequências pendentes
CREATE INDEX idx_user_sequences_next_scheduled
    ON user_sequences(next_scheduled_at)
    WHERE status IN ('pending', 'active') AND next_scheduled_at IS NOT NULL;

-- Índice para buscar sequências ativas de um usuário
CREATE INDEX idx_user_sequences_active
    ON user_sequences(user_id, status)
    WHERE status IN ('pending', 'active');

-- Trigger para updated_at
CREATE TRIGGER user_sequences_updated_at
    BEFORE UPDATE ON user_sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 4. Tabela `sequence_events` (Tracking/Analytics)

```sql
-- Eventos de tracking para análise de performance
CREATE TABLE sequence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacionamentos
    user_sequence_id UUID NOT NULL REFERENCES user_sequences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,

    -- Evento
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        -- Lifecycle events
        'enrolled',           -- Usuário entrou na sequência
        'step_scheduled',     -- Step agendado
        'step_sent',          -- Mensagem enviada
        'step_failed',        -- Falha no envio
        'completed',          -- Completou sequência
        'cancelled',          -- Sequência cancelada

        -- Engagement events
        'message_delivered',  -- Mensagem entregue (webhook)
        'message_read',       -- Mensagem lida (webhook)
        'button_clicked',     -- Botão clicado
        'link_clicked',       -- Link clicado
        'replied',            -- Usuário respondeu

        -- Conversion events
        'converted',          -- Atingiu objetivo (ex: usou feature)
        'opted_out'           -- Usuário pediu para sair
    )),

    -- Detalhes do evento
    step INT,  -- Qual step (para eventos de step)
    message_key VARCHAR(100),  -- Qual mensagem

    -- Dados adicionais
    metadata JSONB NOT NULL DEFAULT '{}',
    -- Exemplos:
    -- { "button_id": "btn_twitter_learn" }
    -- { "error": "timeout", "retry_count": 3 }
    -- { "delivery_status": "delivered" }

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sequence_events_user_sequence ON sequence_events(user_sequence_id);
CREATE INDEX idx_sequence_events_user ON sequence_events(user_id);
CREATE INDEX idx_sequence_events_sequence ON sequence_events(sequence_id);
CREATE INDEX idx_sequence_events_type ON sequence_events(event_type);
CREATE INDEX idx_sequence_events_created ON sequence_events(created_at);

-- Índice para análise de conversão
CREATE INDEX idx_sequence_events_conversion
    ON sequence_events(sequence_id, event_type)
    WHERE event_type IN ('enrolled', 'converted', 'completed', 'cancelled');
```

---

## RPCs (Funções do Banco)

### 1. `enroll_user_in_sequence` - Inscrever usuário em sequência

```sql
CREATE OR REPLACE FUNCTION enroll_user_in_sequence(
    p_user_id UUID,
    p_sequence_name VARCHAR(100),
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID  -- Retorna user_sequence_id ou NULL se não inscreveu
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sequence RECORD;
    v_user_sequence_id UUID;
    v_first_step JSONB;
    v_delay_hours INT;
    v_next_scheduled TIMESTAMPTZ;
BEGIN
    -- Buscar sequência ativa
    SELECT * INTO v_sequence
    FROM sequences
    WHERE name = p_sequence_name
      AND status = 'active';

    IF NOT FOUND THEN
        RAISE NOTICE 'Sequence % not found or not active', p_sequence_name;
        RETURN NULL;
    END IF;

    -- Verificar se usuário já está na sequência
    IF EXISTS (
        SELECT 1 FROM user_sequences
        WHERE user_id = p_user_id
          AND sequence_id = v_sequence.id
          AND status IN ('pending', 'active')
    ) THEN
        RAISE NOTICE 'User already in sequence %', p_sequence_name;
        RETURN NULL;
    END IF;

    -- Verificar limite de usuários
    IF v_sequence.max_users IS NOT NULL THEN
        IF (
            SELECT COUNT(*) FROM user_sequences
            WHERE sequence_id = v_sequence.id
        ) >= v_sequence.max_users THEN
            RAISE NOTICE 'Sequence % reached max users', p_sequence_name;
            RETURN NULL;
        END IF;
    END IF;

    -- Calcular próximo envio baseado no primeiro step
    v_first_step := v_sequence.steps->0;
    v_delay_hours := COALESCE(
        (v_first_step->>'delay_hours')::INT,
        (v_first_step->>'delay_days')::INT * 24,
        0
    );
    v_next_scheduled := NOW() + (v_delay_hours || ' hours')::INTERVAL;

    -- Inserir user_sequence
    INSERT INTO user_sequences (
        user_id,
        sequence_id,
        current_step,
        next_scheduled_at,
        status,
        metadata
    ) VALUES (
        p_user_id,
        v_sequence.id,
        0,
        v_next_scheduled,
        'pending',
        p_metadata
    )
    RETURNING id INTO v_user_sequence_id;

    -- Registrar evento de enrollment
    INSERT INTO sequence_events (
        user_sequence_id,
        user_id,
        sequence_id,
        event_type,
        step,
        metadata
    ) VALUES (
        v_user_sequence_id,
        p_user_id,
        v_sequence.id,
        'enrolled',
        0,
        p_metadata
    );

    RETURN v_user_sequence_id;
END;
$$;
```

### 2. `get_pending_sequence_steps` - Buscar steps para processar

```sql
CREATE OR REPLACE FUNCTION get_pending_sequence_steps(
    p_limit INT DEFAULT 100
)
RETURNS TABLE (
    user_sequence_id UUID,
    user_id UUID,
    user_number VARCHAR(20),
    user_name VARCHAR(255),
    sequence_id UUID,
    sequence_name VARCHAR(100),
    sequence_type VARCHAR(50),
    current_step INT,
    step_config JSONB,
    message_key VARCHAR(100),
    cancel_condition TEXT,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        us.id AS user_sequence_id,
        us.user_id,
        u.whatsapp_number AS user_number,
        u.name AS user_name,
        us.sequence_id,
        s.name AS sequence_name,
        s.type AS sequence_type,
        us.current_step,
        s.steps->us.current_step AS step_config,
        (s.steps->us.current_step->>'message_key')::VARCHAR(100) AS message_key,
        s.cancel_condition,
        us.metadata
    FROM user_sequences us
    JOIN sequences s ON s.id = us.sequence_id
    JOIN users u ON u.id = us.user_id
    WHERE us.status IN ('pending', 'active')
      AND us.next_scheduled_at <= NOW()
      AND s.status IN ('active', 'paused')  -- paused continua os existentes
    ORDER BY us.next_scheduled_at ASC
    LIMIT p_limit;
END;
$$;
```

### 3. `advance_sequence_step` - Avançar para próximo step

```sql
CREATE OR REPLACE FUNCTION advance_sequence_step(
    p_user_sequence_id UUID,
    p_success BOOLEAN DEFAULT TRUE,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB  -- Retorna status da operação
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_sequence RECORD;
    v_sequence RECORD;
    v_next_step INT;
    v_next_step_config JSONB;
    v_delay_hours INT;
    v_next_scheduled TIMESTAMPTZ;
    v_new_status VARCHAR(20);
    v_total_steps INT;
BEGIN
    -- Buscar user_sequence com lock
    SELECT * INTO v_user_sequence
    FROM user_sequences
    WHERE id = p_user_sequence_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'user_sequence not found');
    END IF;

    -- Buscar sequence
    SELECT * INTO v_sequence
    FROM sequences
    WHERE id = v_user_sequence.sequence_id;

    v_total_steps := jsonb_array_length(v_sequence.steps);
    v_next_step := v_user_sequence.current_step + 1;

    -- Registrar evento do step atual
    INSERT INTO sequence_events (
        user_sequence_id,
        user_id,
        sequence_id,
        event_type,
        step,
        message_key,
        metadata
    ) VALUES (
        p_user_sequence_id,
        v_user_sequence.user_id,
        v_user_sequence.sequence_id,
        CASE WHEN p_success THEN 'step_sent' ELSE 'step_failed' END,
        v_user_sequence.current_step,
        v_sequence.steps->v_user_sequence.current_step->>'message_key',
        p_metadata
    );

    -- Se falhou, não avança
    IF NOT p_success THEN
        RETURN jsonb_build_object(
            'success', true,
            'action', 'step_failed',
            'current_step', v_user_sequence.current_step
        );
    END IF;

    -- Verificar se completou
    IF v_next_step >= v_total_steps THEN
        UPDATE user_sequences
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_user_sequence_id;

        INSERT INTO sequence_events (
            user_sequence_id, user_id, sequence_id, event_type, metadata
        ) VALUES (
            p_user_sequence_id, v_user_sequence.user_id,
            v_user_sequence.sequence_id, 'completed', p_metadata
        );

        RETURN jsonb_build_object(
            'success', true,
            'action', 'completed',
            'total_steps', v_total_steps
        );
    END IF;

    -- Calcular próximo agendamento
    v_next_step_config := v_sequence.steps->v_next_step;
    v_delay_hours := COALESCE(
        (v_next_step_config->>'delay_hours')::INT,
        (v_next_step_config->>'delay_days')::INT * 24,
        24
    );
    v_next_scheduled := NOW() + (v_delay_hours || ' hours')::INTERVAL;

    -- Atualizar para próximo step
    UPDATE user_sequences
    SET current_step = v_next_step,
        next_scheduled_at = v_next_scheduled,
        status = 'active',
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW()
    WHERE id = p_user_sequence_id;

    -- Registrar agendamento
    INSERT INTO sequence_events (
        user_sequence_id, user_id, sequence_id, event_type, step, metadata
    ) VALUES (
        p_user_sequence_id, v_user_sequence.user_id,
        v_user_sequence.sequence_id, 'step_scheduled', v_next_step,
        jsonb_build_object('scheduled_for', v_next_scheduled)
    );

    RETURN jsonb_build_object(
        'success', true,
        'action', 'advanced',
        'next_step', v_next_step,
        'next_scheduled_at', v_next_scheduled
    );
END;
$$;
```

### 4. `cancel_user_sequence` - Cancelar sequência

```sql
CREATE OR REPLACE FUNCTION cancel_user_sequence(
    p_user_sequence_id UUID,
    p_reason VARCHAR(100) DEFAULT 'manual',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_sequence RECORD;
BEGIN
    SELECT * INTO v_user_sequence
    FROM user_sequences
    WHERE id = p_user_sequence_id
      AND status IN ('pending', 'active')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    UPDATE user_sequences
    SET status = 'cancelled',
        cancel_reason = p_reason,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_sequence_id;

    INSERT INTO sequence_events (
        user_sequence_id, user_id, sequence_id, event_type, metadata
    ) VALUES (
        p_user_sequence_id, v_user_sequence.user_id,
        v_user_sequence.sequence_id, 'cancelled',
        jsonb_build_object('reason', p_reason) || p_metadata
    );

    RETURN TRUE;
END;
$$;
```

### 5. `check_sequence_cancel_conditions` - Verificar condições de cancelamento

```sql
CREATE OR REPLACE FUNCTION check_sequence_cancel_conditions()
RETURNS INT  -- Número de sequências canceladas
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cancelled_count INT := 0;
    v_record RECORD;
    v_should_cancel BOOLEAN;
BEGIN
    -- Iterar sobre sequências ativas com cancel_condition
    FOR v_record IN
        SELECT
            us.id AS user_sequence_id,
            us.user_id,
            s.cancel_condition
        FROM user_sequences us
        JOIN sequences s ON s.id = us.sequence_id
        WHERE us.status IN ('pending', 'active')
          AND s.cancel_condition IS NOT NULL
    LOOP
        -- Avaliar condição dinamicamente
        EXECUTE format(
            'SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND (%s))',
            v_record.cancel_condition
        )
        INTO v_should_cancel
        USING v_record.user_id;

        IF v_should_cancel THEN
            PERFORM cancel_user_sequence(
                v_record.user_sequence_id,
                'condition_met'
            );
            v_cancelled_count := v_cancelled_count + 1;
        END IF;
    END LOOP;

    RETURN v_cancelled_count;
END;
$$;
```

### 6. `get_sequence_analytics` - Analytics de uma sequência

```sql
CREATE OR REPLACE FUNCTION get_sequence_analytics(
    p_sequence_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'sequence_id', p_sequence_id,
        'period', jsonb_build_object(
            'start', p_start_date,
            'end', p_end_date
        ),
        'totals', (
            SELECT jsonb_build_object(
                'enrolled', COUNT(*) FILTER (WHERE status IN ('pending', 'active', 'completed', 'cancelled')),
                'active', COUNT(*) FILTER (WHERE status IN ('pending', 'active')),
                'completed', COUNT(*) FILTER (WHERE status = 'completed'),
                'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
                'converted', COUNT(*) FILTER (WHERE cancel_reason = 'condition_met')
            )
            FROM user_sequences
            WHERE sequence_id = p_sequence_id
              AND created_at BETWEEN p_start_date AND p_end_date
        ),
        'conversion_rate', (
            SELECT ROUND(
                COUNT(*) FILTER (WHERE cancel_reason = 'condition_met')::NUMERIC /
                NULLIF(COUNT(*), 0) * 100, 2
            )
            FROM user_sequences
            WHERE sequence_id = p_sequence_id
              AND created_at BETWEEN p_start_date AND p_end_date
        ),
        'step_completion', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'step', step,
                    'sent', sent_count,
                    'completion_rate', ROUND(sent_count::NUMERIC / NULLIF(enrolled_count, 0) * 100, 2)
                )
                ORDER BY step
            )
            FROM (
                SELECT
                    se.step,
                    COUNT(*) FILTER (WHERE se.event_type = 'step_sent') AS sent_count,
                    (SELECT COUNT(*) FROM user_sequences WHERE sequence_id = p_sequence_id) AS enrolled_count
                FROM sequence_events se
                WHERE se.sequence_id = p_sequence_id
                  AND se.created_at BETWEEN p_start_date AND p_end_date
                  AND se.step IS NOT NULL
                GROUP BY se.step
            ) stats
        ),
        'events_by_type', (
            SELECT jsonb_object_agg(event_type, cnt)
            FROM (
                SELECT event_type, COUNT(*) AS cnt
                FROM sequence_events
                WHERE sequence_id = p_sequence_id
                  AND created_at BETWEEN p_start_date AND p_end_date
                GROUP BY event_type
            ) e
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;
```

---

## Views Úteis

### View para monitoramento

```sql
CREATE OR REPLACE VIEW v_sequence_status AS
SELECT
    s.name AS sequence_name,
    s.type,
    s.status AS sequence_status,
    COUNT(us.id) FILTER (WHERE us.status = 'pending') AS pending_users,
    COUNT(us.id) FILTER (WHERE us.status = 'active') AS active_users,
    COUNT(us.id) FILTER (WHERE us.status = 'completed') AS completed_users,
    COUNT(us.id) FILTER (WHERE us.status = 'cancelled' AND us.cancel_reason = 'condition_met') AS converted_users,
    COUNT(us.id) FILTER (WHERE us.status = 'cancelled' AND us.cancel_reason != 'condition_met') AS cancelled_users,
    ROUND(
        COUNT(us.id) FILTER (WHERE us.cancel_reason = 'condition_met')::NUMERIC /
        NULLIF(COUNT(us.id), 0) * 100, 2
    ) AS conversion_rate
FROM sequences s
LEFT JOIN user_sequences us ON us.sequence_id = s.id
GROUP BY s.id, s.name, s.type, s.status
ORDER BY s.priority, s.name;
```

### View para próximos envios

```sql
CREATE OR REPLACE VIEW v_pending_sends AS
SELECT
    us.id AS user_sequence_id,
    u.whatsapp_number,
    u.name AS user_name,
    s.name AS sequence_name,
    us.current_step,
    s.steps->us.current_step->>'message_key' AS message_key,
    us.next_scheduled_at,
    us.next_scheduled_at - NOW() AS time_until_send
FROM user_sequences us
JOIN users u ON u.id = us.user_id
JOIN sequences s ON s.id = us.sequence_id
WHERE us.status IN ('pending', 'active')
  AND us.next_scheduled_at IS NOT NULL
ORDER BY us.next_scheduled_at ASC;
```

---

## Exemplos de Uso

### 1. Criar sequência de Twitter Discovery

```sql
-- Inserir sequência
INSERT INTO sequences (name, description, type, target_filter, cancel_condition, steps, status, priority)
VALUES (
    'twitter_discovery',
    'Apresenta feature de download do Twitter após usuário bater limite',
    'feature_discovery',
    '{"first_sticker_at": {"gte": "2025-01-10"}, "twitter_feature_used": false}',
    'twitter_feature_used = true',
    '[
        {"step": 0, "delay_hours": 4, "message_key": "twitter_d0"},
        {"step": 1, "delay_days": 7, "message_key": "twitter_d7"},
        {"step": 2, "delay_days": 15, "message_key": "twitter_d15"},
        {"step": 3, "delay_days": 30, "message_key": "twitter_d30"}
    ]'::JSONB,
    'active',
    10
);

-- Inserir mensagens
INSERT INTO sequence_messages (message_key, sequence_id, message_type, title, body, footer, buttons)
SELECT
    'twitter_d0',
    id,
    'buttons',
    '🎬 Novidade pra você!',
    'Oi {name}! 👋

Sabia que além de figurinhas, eu também *baixo vídeos do X (Twitter)*?

É só me enviar o link do tweet! 🔗',
    'Experimente agora!',
    '[{"id": "btn_twitter_learn", "text": "🎬 Quero saber mais!"}, {"id": "btn_twitter_dismiss", "text": "⏭️ Agora não"}]'::JSONB
FROM sequences WHERE name = 'twitter_discovery';
```

### 2. Criar sequência de recuperação de funil

```sql
INSERT INTO sequences (name, description, type, target_filter, cancel_condition, steps, status)
VALUES (
    'funnel_recovery_no_sticker',
    'Recupera usuários que cadastraram mas nunca criaram figurinha',
    'funnel_recovery',
    '{"first_sticker_at": null}',
    'first_sticker_at IS NOT NULL',
    '[
        {"step": 0, "delay_hours": 24, "message_key": "recovery_d1"},
        {"step": 1, "delay_days": 3, "message_key": "recovery_d3_sticker"},
        {"step": 2, "delay_days": 7, "message_key": "recovery_d7_last"}
    ]'::JSONB,
    'active'
);
```

### 3. Inscrever usuário em sequência

```sql
-- Via RPC
SELECT enroll_user_in_sequence(
    '31dc9561-d1f1-4a5a-a951-be15d2641f23',  -- user_id
    'twitter_discovery',
    '{"trigger": "limit_hit", "sticker_count": 3}'::JSONB
);
```

---

## Integração TypeScript (RPC Type-Safe)

> ⚠️ **IMPORTANTE:** Seguir a arquitetura RPC type-safe documentada em `docs/sprints/SPRINT-14-RPC-TYPE-SAFE.md`.
> Nunca usar `supabase.rpc()` diretamente - sempre usar `rpc()` do `src/rpc/index.ts`.

### 1. Adicionar tipos em `src/rpc/types.ts`

```typescript
// ============================================
// SEQUENCE FUNCTIONS
// ============================================

/**
 * Step pendente para processamento
 * Retornado por get_pending_sequence_steps (TABLE)
 */
export interface SequenceStepPending {
  user_sequence_id: string;
  user_id: string;
  user_number: string;
  user_name: string;
  sequence_id: string;
  sequence_name: string;
  sequence_type: string;
  current_step: number;
  step_config: Record<string, unknown>;
  message_key: string;
  cancel_condition: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Resultado de advance_sequence_step
 * Retorna JSONB com status da operação
 */
export interface AdvanceStepResult {
  success: boolean;
  action: 'advanced' | 'completed' | 'step_failed';
  next_step?: number;
  next_scheduled_at?: string;
  total_steps?: number;
  current_step?: number;
  error?: string;
}

/**
 * Analytics de uma sequência
 * Retornado por get_sequence_analytics (JSONB)
 */
export interface SequenceAnalytics {
  sequence_id: string;
  period: {
    start: string;
    end: string;
  };
  totals: {
    enrolled: number;
    active: number;
    completed: number;
    cancelled: number;
    converted: number;
  };
  conversion_rate: number | null;
  step_completion: Array<{
    step: number;
    sent: number;
    completion_rate: number | null;
  }> | null;
  events_by_type: Record<string, number> | null;
}
```

### 2. Adicionar no registry em `src/rpc/registry.ts`

```typescript
// Adicionar import no topo:
import type {
  // ... imports existentes ...
  SequenceStepPending,
  AdvanceStepResult,
  SequenceAnalytics,
} from './types.js';

// Adicionar no RPC_REGISTRY:

// ═══════════════════════════════════════════════════════════════
// SEQUENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Inscreve usuário em uma sequência de comunicação
 * @returns UUID do user_sequence criado, ou NULL se não inscreveu
 */
enroll_user_in_sequence: {
  type: 'scalar' as const,
  params: {} as {
    p_user_id: string;
    p_sequence_name: string;
    p_metadata?: Record<string, unknown>;
  },
  returns: {} as string | null,
},

/**
 * Busca steps de sequência prontos para envio
 * @returns Array de steps pendentes com dados do usuário e mensagem
 */
get_pending_sequence_steps: {
  type: 'table' as const,
  params: {} as { p_limit?: number },
  returns: {} as SequenceStepPending,
},

/**
 * Avança sequência para próximo step após envio
 * @returns Status da operação (advanced, completed, ou step_failed)
 */
advance_sequence_step: {
  type: 'scalar' as const,
  params: {} as {
    p_user_sequence_id: string;
    p_success?: boolean;
    p_metadata?: Record<string, unknown>;
  },
  returns: {} as AdvanceStepResult,
},

/**
 * Cancela sequência de um usuário
 * @returns TRUE se cancelou, FALSE se não encontrou
 */
cancel_user_sequence: {
  type: 'scalar' as const,
  params: {} as {
    p_user_sequence_id: string;
    p_reason?: string;
    p_metadata?: Record<string, unknown>;
  },
  returns: {} as boolean,
},

/**
 * Verifica e cancela sequências que atingiram cancel_condition
 * @returns Número de sequências canceladas
 */
check_sequence_cancel_conditions: {
  type: 'scalar' as const,
  params: {} as Record<string, never>,
  returns: {} as number,
},

/**
 * Busca analytics de uma sequência
 * @returns Métricas agregadas (totals, conversion_rate, step_completion)
 */
get_sequence_analytics: {
  type: 'scalar' as const,
  params: {} as {
    p_sequence_id: string;
    p_start_date?: string;
    p_end_date?: string;
  },
  returns: {} as SequenceAnalytics,
},
```

### 3. Cuidados com PostgreSQL (evitar bugs conhecidos)

> ⚠️ **NUNCA usar OUT parameters para funções SCALAR!**
> Isso causa retorno de objeto `{campo: valor}` ao invés do valor direto.
> Ver bug documentado em SPRINT-14-RPC-TYPE-SAFE.md seção "Limitações Conhecidas".

```sql
-- ❌ ERRADO - OUT parameter causa bug
CREATE FUNCTION enroll_user_in_sequence(
  p_user_id UUID,
  OUT user_sequence_id UUID  -- ← PROBLEMA! Retorna {"user_sequence_id": "xxx"}
)
RETURNS UUID ...

-- ✅ CORRETO - Retorno direto
CREATE FUNCTION enroll_user_in_sequence(
  p_user_id UUID,
  p_sequence_name VARCHAR
)
RETURNS UUID  -- Retorna "xxx" diretamente
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_sequence_id UUID;
BEGIN
  -- ... lógica ...
  RETURN v_user_sequence_id;  -- ← Retorno direto
END;
$$;
```

### 4. Mapeamento de tipos RPC

| Função PostgreSQL | Tipo RPC | Retorno TypeScript |
|-------------------|----------|-------------------|
| `enroll_user_in_sequence` | `scalar` | `string \| null` |
| `get_pending_sequence_steps` | `table` | `SequenceStepPending[]` |
| `advance_sequence_step` | `scalar` | `AdvanceStepResult` |
| `cancel_user_sequence` | `scalar` | `boolean` |
| `check_sequence_cancel_conditions` | `scalar` | `number` |
| `get_sequence_analytics` | `scalar` | `SequenceAnalytics` |

### 5. Uso no código

```typescript
import { rpc } from '../rpc';

// ✅ Type-safe - TypeScript infere tipos automaticamente
const userSequenceId = await rpc('enroll_user_in_sequence', {
  p_user_id: userId,
  p_sequence_name: 'twitter_discovery',
  p_metadata: { trigger: 'limit_hit' },
});
// userSequenceId é string | null

// ✅ Type-safe - retorna array tipado
const pendingSteps = await rpc('get_pending_sequence_steps', { p_limit: 50 });
// pendingSteps é SequenceStepPending[]

for (const step of pendingSteps) {
  // step.user_number, step.message_key, etc. têm autocomplete

  const result = await rpc('advance_sequence_step', {
    p_user_sequence_id: step.user_sequence_id,
    p_success: true,
  });
  // result é AdvanceStepResult

  if (result.action === 'completed') {
    console.log(`Sequence completed after ${result.total_steps} steps`);
  }
}

// ✅ Type-safe - analytics tipado
const analytics = await rpc('get_sequence_analytics', {
  p_sequence_id: sequenceId,
});
// analytics.totals.converted, analytics.conversion_rate, etc.
```

---

## Integração com Worker

O worker precisará de um novo job para processar sequências:

```typescript
// src/jobs/processSequenceSteps.ts

import { rpc } from '../rpc';
import { sendText, sendButtons } from '../services';
import logger from '../config/logger';

export async function processSequenceSteps(): Promise<void> {
  // 1. Verificar condições de cancelamento
  const cancelledCount = await rpc('check_sequence_cancel_conditions', {});
  if (cancelledCount > 0) {
    logger.info({ cancelledCount }, 'Cancelled sequences due to conditions met');
  }

  // 2. Buscar steps pendentes
  const pendingSteps = await rpc('get_pending_sequence_steps', { p_limit: 50 });

  for (const step of pendingSteps) {
    try {
      // 3. Buscar template da mensagem
      const message = await getSequenceMessage(step.message_key);

      // 4. Enviar mensagem
      await sendSequenceMessage(step, message);

      // 5. Avançar step
      await rpc('advance_sequence_step', {
        p_user_sequence_id: step.user_sequence_id,
        p_success: true,
      });

    } catch (error) {
      logger.error({ error, step }, 'Failed to process sequence step');

      await rpc('advance_sequence_step', {
        p_user_sequence_id: step.user_sequence_id,
        p_success: false,
        p_metadata: { error: error.message },
      });
    }
  }
}
```

---

## Checklist de Implementação

### Fase 1: Database
- [ ] Criar migration com tabelas (`sequences`, `sequence_messages`, `user_sequences`, `sequence_events`)
- [ ] Criar índices e triggers
- [ ] Criar views (`v_sequence_status`, `v_pending_sends`)

### Fase 2: RPCs PostgreSQL
- [ ] `enroll_user_in_sequence` (SCALAR → UUID | NULL)
- [ ] `get_pending_sequence_steps` (TABLE)
- [ ] `advance_sequence_step` (SCALAR → JSONB)
- [ ] `cancel_user_sequence` (SCALAR → BOOLEAN)
- [ ] `check_sequence_cancel_conditions` (SCALAR → INT)
- [ ] `get_sequence_analytics` (SCALAR → JSONB)
- [ ] ⚠️ Verificar: nenhum OUT parameter nas funções SCALAR

### Fase 3: TypeScript (RPC Type-Safe)
- [ ] Adicionar tipos em `src/rpc/types.ts`:
  - [ ] `SequenceStepPending`
  - [ ] `AdvanceStepResult`
  - [ ] `SequenceAnalytics`
- [ ] Adicionar no registry `src/rpc/registry.ts`:
  - [ ] `enroll_user_in_sequence`
  - [ ] `get_pending_sequence_steps`
  - [ ] `advance_sequence_step`
  - [ ] `cancel_user_sequence`
  - [ ] `check_sequence_cancel_conditions`
  - [ ] `get_sequence_analytics`
- [ ] Adicionar testes em `tests/rpc/rpc.test.ts`
- [ ] Verificar build: `npm run build`

### Fase 4: Worker
- [ ] Criar `src/jobs/processSequenceSteps.ts`
- [ ] Criar `src/services/sequenceMessageService.ts` (buscar/enviar mensagens)
- [ ] Adicionar job ao cron (a cada 5 minutos)
- [ ] Testar com usuário de teste

### Fase 5: Sequências Iniciais
- [ ] Criar sequência `twitter_discovery` (d+0, d+7, d+15, d+30)
- [ ] Criar sequência `cleanup_feature` (remove fundo/borda)
- [ ] Criar templates de mensagens para cada step
- [ ] Configurar cancel_conditions

### Fase 6: Admin Panel (opcional)
- [ ] View de sequências ativas
- [ ] Métricas de conversão
- [ ] Pausar/ativar sequências

---

## Referências

- `docs/sprints/SPRINT-14-RPC-TYPE-SAFE.md` - Arquitetura RPC obrigatória
- `docs/sprints/SPRINT-13-AB-EXPERIMENTS.md` - Sistema de experimentos (referência)
- `src/rpc/` - Implementação RPC type-safe
