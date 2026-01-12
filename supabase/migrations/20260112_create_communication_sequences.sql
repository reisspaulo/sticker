-- ============================================
-- Migration: Communication Sequences System
-- Date: 2026-01-12
-- Description: Sistema generico para sequencias de comunicacao automatizadas
-- Ref: docs/architecture/COMMUNICATION_SEQUENCES_SCHEMA.md
-- ============================================

-- ============================================
-- 1. TABELAS
-- ============================================

-- 1.1 Configuracao das sequencias/campanhas
CREATE TABLE IF NOT EXISTS sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificacao
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    -- Tipo da sequencia
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'feature_discovery',
        'funnel_recovery',
        're_engagement',
        'upsell',
        'educational',
        'seasonal',
        'onboarding'
    )),

    -- Criterios de entrada (JSONB para flexibilidade)
    target_filter JSONB NOT NULL DEFAULT '{}',

    -- Condicao de cancelamento automatico (SQL boolean expression)
    cancel_condition TEXT,

    -- Configuracao dos steps
    steps JSONB NOT NULL,

    -- Controle
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',
        'active',
        'paused',
        'archived'
    )),

    -- Prioridade (menor = maior prioridade)
    priority INT NOT NULL DEFAULT 100,

    -- Limites
    max_users INT,

    -- Configuracoes adicionais
    settings JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,

    -- Validacao
    CONSTRAINT valid_steps CHECK (jsonb_array_length(steps) > 0)
);

-- 1.2 Templates de mensagens
CREATE TABLE IF NOT EXISTS sequence_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificacao
    message_key VARCHAR(100) NOT NULL UNIQUE,
    sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,

    -- Conteudo
    title TEXT,
    body TEXT NOT NULL,
    footer TEXT,

    -- Tipo de mensagem
    message_type VARCHAR(30) NOT NULL DEFAULT 'text' CHECK (message_type IN (
        'text',
        'buttons',
        'list',
        'media',
        'media_buttons'
    )),

    -- Botoes (JSONB)
    buttons JSONB,

    -- Midia anexa (JSONB)
    media JSONB,

    -- Variantes A/B (opcional)
    variants JSONB,

    -- Metadados
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 Usuarios em sequencias
CREATE TABLE IF NOT EXISTS user_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacionamentos
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,

    -- Progresso
    current_step INT NOT NULL DEFAULT 0,
    next_scheduled_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'active',
        'completed',
        'cancelled',
        'failed'
    )),

    -- Razao do cancelamento
    cancel_reason VARCHAR(100),

    -- Variante A/B
    variant VARCHAR(50),

    -- Metadados
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Usuario so pode estar em uma instancia de cada sequencia
    CONSTRAINT unique_user_sequence UNIQUE (user_id, sequence_id)
);

-- 1.4 Eventos de tracking
CREATE TABLE IF NOT EXISTS sequence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacionamentos
    user_sequence_id UUID NOT NULL REFERENCES user_sequences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,

    -- Evento
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'enrolled',
        'step_scheduled',
        'step_sent',
        'step_failed',
        'completed',
        'cancelled',
        'message_delivered',
        'message_read',
        'button_clicked',
        'link_clicked',
        'replied',
        'converted',
        'opted_out'
    )),

    -- Detalhes
    step INT,
    message_key VARCHAR(100),

    -- Dados adicionais
    metadata JSONB NOT NULL DEFAULT '{}',

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. INDICES
-- ============================================

-- Sequences
CREATE INDEX IF NOT EXISTS idx_sequences_status ON sequences(status);
CREATE INDEX IF NOT EXISTS idx_sequences_type ON sequences(type);
CREATE INDEX IF NOT EXISTS idx_sequences_priority ON sequences(priority) WHERE status = 'active';

-- Sequence Messages
CREATE INDEX IF NOT EXISTS idx_sequence_messages_sequence ON sequence_messages(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_messages_key ON sequence_messages(message_key);

-- User Sequences
CREATE INDEX IF NOT EXISTS idx_user_sequences_user ON user_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sequences_sequence ON user_sequences(sequence_id);
CREATE INDEX IF NOT EXISTS idx_user_sequences_status ON user_sequences(status);
CREATE INDEX IF NOT EXISTS idx_user_sequences_next_scheduled
    ON user_sequences(next_scheduled_at)
    WHERE status IN ('pending', 'active') AND next_scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sequences_active
    ON user_sequences(user_id, status)
    WHERE status IN ('pending', 'active');

-- Sequence Events
CREATE INDEX IF NOT EXISTS idx_sequence_events_user_sequence ON sequence_events(user_sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_events_user ON sequence_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sequence_events_sequence ON sequence_events(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_events_type ON sequence_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sequence_events_created ON sequence_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sequence_events_conversion
    ON sequence_events(sequence_id, event_type)
    WHERE event_type IN ('enrolled', 'converted', 'completed', 'cancelled');

-- ============================================
-- 3. TRIGGERS
-- ============================================

-- Trigger para updated_at em sequences
CREATE TRIGGER sequences_updated_at
    BEFORE UPDATE ON sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para updated_at em sequence_messages
CREATE TRIGGER sequence_messages_updated_at
    BEFORE UPDATE ON sequence_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para updated_at em user_sequences
CREATE TRIGGER user_sequences_updated_at
    BEFORE UPDATE ON user_sequences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. VIEWS
-- ============================================

-- View para monitoramento de sequencias
CREATE OR REPLACE VIEW v_sequence_status AS
SELECT
    s.id AS sequence_id,
    s.name AS sequence_name,
    s.type,
    s.status AS sequence_status,
    COUNT(us.id) FILTER (WHERE us.status = 'pending') AS pending_users,
    COUNT(us.id) FILTER (WHERE us.status = 'active') AS active_users,
    COUNT(us.id) FILTER (WHERE us.status = 'completed') AS completed_users,
    COUNT(us.id) FILTER (WHERE us.status = 'cancelled' AND us.cancel_reason = 'condition_met') AS converted_users,
    COUNT(us.id) FILTER (WHERE us.status = 'cancelled' AND COALESCE(us.cancel_reason, '') != 'condition_met') AS cancelled_users,
    ROUND(
        COUNT(us.id) FILTER (WHERE us.cancel_reason = 'condition_met')::NUMERIC /
        NULLIF(COUNT(us.id), 0) * 100, 2
    ) AS conversion_rate
FROM sequences s
LEFT JOIN user_sequences us ON us.sequence_id = s.id
GROUP BY s.id, s.name, s.type, s.status
ORDER BY s.priority, s.name;

-- View para proximos envios
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

-- ============================================
-- 5. RPCs
-- ============================================

-- 5.1 Inscrever usuario em sequencia
-- Retorna UUID do user_sequence ou NULL
CREATE OR REPLACE FUNCTION enroll_user_in_sequence(
    p_user_id UUID,
    p_sequence_name VARCHAR(100),
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
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
    -- Buscar sequencia ativa
    SELECT * INTO v_sequence
    FROM sequences
    WHERE name = p_sequence_name
      AND status = 'active';

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Verificar se usuario ja esta na sequencia
    IF EXISTS (
        SELECT 1 FROM user_sequences
        WHERE user_id = p_user_id
          AND sequence_id = v_sequence.id
          AND status IN ('pending', 'active')
    ) THEN
        RETURN NULL;
    END IF;

    -- Verificar limite de usuarios
    IF v_sequence.max_users IS NOT NULL THEN
        IF (
            SELECT COUNT(*) FROM user_sequences
            WHERE sequence_id = v_sequence.id
        ) >= v_sequence.max_users THEN
            RETURN NULL;
        END IF;
    END IF;

    -- Calcular proximo envio baseado no primeiro step
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

-- 5.2 Buscar steps pendentes para processar
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
      AND s.status IN ('active', 'paused')
    ORDER BY us.next_scheduled_at ASC
    LIMIT p_limit;
END;
$$;

-- 5.3 Avancar para proximo step
CREATE OR REPLACE FUNCTION advance_sequence_step(
    p_user_sequence_id UUID,
    p_success BOOLEAN DEFAULT TRUE,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
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

    -- Se falhou, nao avanca
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

    -- Calcular proximo agendamento
    v_next_step_config := v_sequence.steps->v_next_step;
    v_delay_hours := COALESCE(
        (v_next_step_config->>'delay_hours')::INT,
        (v_next_step_config->>'delay_days')::INT * 24,
        24
    );
    v_next_scheduled := NOW() + (v_delay_hours || ' hours')::INTERVAL;

    -- Atualizar para proximo step
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

-- 5.4 Cancelar sequencia
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

-- 5.5 Verificar e cancelar sequencias que atingiram condicao
CREATE OR REPLACE FUNCTION check_sequence_cancel_conditions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cancelled_count INT := 0;
    v_record RECORD;
    v_should_cancel BOOLEAN;
BEGIN
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
        BEGIN
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
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue processing
            RAISE NOTICE 'Error checking cancel condition for user_sequence %: %',
                v_record.user_sequence_id, SQLERRM;
        END;
    END LOOP;

    RETURN v_cancelled_count;
END;
$$;

-- 5.6 Analytics de uma sequencia
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
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'step', step,
                    'sent', sent_count,
                    'completion_rate', ROUND(sent_count::NUMERIC / NULLIF(enrolled_count, 0) * 100, 2)
                )
                ORDER BY step
            ), '[]'::JSONB)
            FROM (
                SELECT
                    se.step,
                    COUNT(*) FILTER (WHERE se.event_type = 'step_sent') AS sent_count,
                    (SELECT COUNT(*) FROM user_sequences WHERE sequence_id = p_sequence_id AND created_at BETWEEN p_start_date AND p_end_date) AS enrolled_count
                FROM sequence_events se
                WHERE se.sequence_id = p_sequence_id
                  AND se.created_at BETWEEN p_start_date AND p_end_date
                  AND se.step IS NOT NULL
                GROUP BY se.step
            ) stats
        ),
        'events_by_type', (
            SELECT COALESCE(jsonb_object_agg(event_type, cnt), '{}'::JSONB)
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

-- ============================================
-- 6. GRANTS (RLS)
-- ============================================

-- Habilitar RLS
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_events ENABLE ROW LEVEL SECURITY;

-- Policies para service role (backend)
CREATE POLICY "Service role full access on sequences"
    ON sequences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sequence_messages"
    ON sequence_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on user_sequences"
    ON user_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on sequence_events"
    ON sequence_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- DONE
-- ============================================
