-- ═══════════════════════════════════════════════════════════════════════════════
-- UNIFIED CAMPAIGNS SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Unifica experimentos A/B e sequências (drip campaigns) em um único sistema.
--
-- Baseado nos bugs encontrados nos commits:
-- - Race conditions: FOR UPDATE SKIP LOCKED em todas RPCs
-- - Tipos RPC: Usar TEXT não VARCHAR, retornar primitivos não RECORD
-- - Constraints: Status intermediário 'processing' para locks
-- - JobId: Garantir unicidade
-- - Lógica: Contexto importa (handlers específicos)
--
-- Data: 13/01/2026
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. CAMPAIGNS - Definição da campanha
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,

    -- Tipo de campanha
    -- 'drip': Baseado em tempo (d+0, d+7, d+15, d+30)
    -- 'event': Dispara em evento específico (ex: first_message, limit_hit)
    -- 'hybrid': Combina evento inicial + follow-ups por tempo
    campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN ('drip', 'event', 'hybrid')),

    -- Configuração de trigger
    -- drip: {"initial_delay_hours": 4}
    -- event: {"event_name": "first_message", "send_immediately": true}
    -- hybrid: {"event_name": "limit_hit", "initial_delay_hours": 4}
    trigger_config JSONB NOT NULL DEFAULT '{}',

    -- Quem pode entrar (filtro SQL-like)
    -- Ex: {"min_stickers": 3, "subscription_plan": "free", "created_after": "2026-01-10"}
    target_filter JSONB,

    -- Quando parar de enviar (SQL executado dinamicamente)
    -- Ex: "twitter_feature_used = true"
    -- Ex: "subscription_plan != 'free'"
    cancel_condition TEXT,

    -- Controle
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'ended')),
    priority INT DEFAULT 0,                 -- Maior = mais importante
    max_users INT,                          -- Limite de usuários (NULL = ilimitado)

    -- Settings gerais
    -- Ex: {"rate_limit_ms": 200, "batch_size": 50, "randomize_minutes": 30}
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

-- Índice para buscar campanhas ativas
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(campaign_type);

COMMENT ON TABLE campaigns IS 'Definição de campanhas (unifica experimentos e sequências)';
COMMENT ON COLUMN campaigns.campaign_type IS 'drip=tempo, event=gatilho, hybrid=ambos';
COMMENT ON COLUMN campaigns.cancel_condition IS 'SQL executado contra tabela users para verificar cancelamento';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. CAMPAIGN_STEPS - Steps/Waves da campanha
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaign_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Ordem e identificação
    step_order INT NOT NULL,                        -- 0, 1, 2, 3...
    step_key VARCHAR(50) NOT NULL,                  -- 'day_0', 'wave_1', 'welcome'

    -- Quando enviar (relativo ao enrollment ou step anterior)
    delay_hours INT DEFAULT 0,                      -- 0 = imediato, 168 = 7 dias

    -- Janela de envio (evitar madrugada)
    -- NULL = usar settings da campanha
    send_window JSONB,                              -- {"start_hour": 8, "end_hour": 22}

    -- Variantes para A/B (NULL = sem A/B neste step)
    -- Ex: ["control", "benefit", "urgency", "social_proof"]
    variants JSONB,

    -- Pesos das variantes (NULL = distribuição igual)
    -- Ex: {"control": 25, "benefit": 25, "urgency": 25, "social_proof": 25}
    variant_weights JSONB,

    -- Metadata extra
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(campaign_id, step_order),
    UNIQUE(campaign_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_campaign_steps_campaign ON campaign_steps(campaign_id);

COMMENT ON TABLE campaign_steps IS 'Steps/waves de uma campanha com suporte a A/B por step';
COMMENT ON COLUMN campaign_steps.variants IS 'Array de variantes para A/B test neste step';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CAMPAIGN_MESSAGES - Conteúdo das mensagens
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id UUID NOT NULL REFERENCES campaign_steps(id) ON DELETE CASCADE,

    -- Variante (NULL ou 'default' = mensagem padrão)
    variant VARCHAR(50) DEFAULT 'default',

    -- Tipo de conteúdo
    content_type VARCHAR(20) NOT NULL DEFAULT 'text'
        CHECK (content_type IN ('text', 'buttons', 'sticker', 'image', 'video')),

    -- Conteúdo textual
    -- IMPORTANTE: title NUNCA deve ser NULL para Avisa API (pode ser string vazia '')
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    footer TEXT,

    -- Botões (para content_type = 'buttons')
    -- Ex: [{"id": "btn_campaign_learn", "text": "🎬 Quero ver!"}]
    -- IMPORTANTE: Usar prefixo btn_campaign_ para diferenciar de outros handlers
    buttons JSONB,

    -- Mídia (para content_type = 'sticker', 'image', 'video')
    -- Ex: {"type": "sticker", "url": "https://...", "sticker_id": "..."}
    media JSONB,

    -- Placeholders disponíveis: {name}, {user_name}, {count}, {limit}, {feature}, {emoji}
    -- Processados em runtime

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(step_id, variant)
);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_step ON campaign_messages(step_id);

COMMENT ON TABLE campaign_messages IS 'Conteúdo das mensagens por variante';
COMMENT ON COLUMN campaign_messages.title IS 'OBRIGATÓRIO pela Avisa API - nunca NULL';
COMMENT ON COLUMN campaign_messages.buttons IS 'Usar prefixo btn_campaign_ nos IDs';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. USER_CAMPAIGNS - Usuário inscrito em campanha
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Progresso
    current_step INT DEFAULT 0,

    -- Variante sorteada (se campanha/step tiver A/B)
    variant VARCHAR(50),

    -- Agendamento
    next_scheduled_at TIMESTAMPTZ,

    -- Status com suporte a lock atômico
    -- IMPORTANTE: 'processing' permite atomic lock sem constraint violation
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'processing', 'completed', 'cancelled')),

    cancel_reason VARCHAR(100),

    -- Metadata do enrollment
    -- Ex: {"trigger": "limit_hit", "daily_count": 4, "source": "webhook"}
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,                 -- Quando primeiro step foi enviado
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_user_campaigns_user ON user_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_campaigns_campaign ON user_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_user_campaigns_status ON user_campaigns(status) WHERE status IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS idx_user_campaigns_scheduled ON user_campaigns(next_scheduled_at)
    WHERE status IN ('pending', 'active');

COMMENT ON TABLE user_campaigns IS 'Inscrições de usuários em campanhas';
COMMENT ON COLUMN user_campaigns.status IS 'processing = lock atômico em andamento';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. CAMPAIGN_EVENTS - ÚNICO lugar para TODOS os eventos
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaign_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Referências
    user_campaign_id UUID REFERENCES user_campaigns(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

    -- Evento
    -- enrolled, step_scheduled, step_sent, step_failed
    -- button_clicked, converted, cancelled, completed
    -- Experimentos: menu_shown, upgrade_clicked, payment_started, dismiss_clicked
    event_type VARCHAR(50) NOT NULL,

    -- Contexto
    step_key VARCHAR(50),                   -- Em qual step aconteceu
    variant VARCHAR(50),                    -- Qual variante

    -- Dados extras
    -- Ex: {"button_id": "btn_x", "error": "...", "response_time_ms": 150}
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para analytics
CREATE INDEX IF NOT EXISTS idx_campaign_events_type ON campaign_events(event_type);
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON campaign_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_user ON campaign_events(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_events_created ON campaign_events(created_at);
CREATE INDEX IF NOT EXISTS idx_campaign_events_user_campaign ON campaign_events(user_campaign_id);

COMMENT ON TABLE campaign_events IS 'Todos os eventos de todas as campanhas (unificado)';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. HELPER FUNCTION: Sortear variante
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION campaign_select_variant(
    p_variants JSONB,       -- ["control", "test_a", "test_b"]
    p_weights JSONB         -- {"control": 50, "test_a": 25, "test_b": 25} ou NULL
)
RETURNS TEXT                -- IMPORTANTE: TEXT não VARCHAR (evita bug de tipo)
LANGUAGE plpgsql
AS $$
DECLARE
    v_rand FLOAT;
    v_cumulative FLOAT := 0;
    v_variant TEXT;
    v_weight FLOAT;
    v_default_weight FLOAT;
    v_array_length INT;
BEGIN
    -- Se não tem variantes, retorna default
    IF p_variants IS NULL OR jsonb_array_length(p_variants) = 0 THEN
        RETURN 'default';
    END IF;

    v_array_length := jsonb_array_length(p_variants);
    v_default_weight := 100.0 / v_array_length;
    v_rand := random() * 100;

    FOR v_variant IN SELECT jsonb_array_elements_text(p_variants)
    LOOP
        -- Usa peso definido ou distribui igualmente
        IF p_weights IS NOT NULL AND p_weights ? v_variant THEN
            v_weight := (p_weights->>v_variant)::FLOAT;
        ELSE
            v_weight := v_default_weight;
        END IF;

        v_cumulative := v_cumulative + v_weight;

        IF v_rand <= v_cumulative THEN
            RETURN v_variant;
        END IF;
    END LOOP;

    -- Fallback: primeiro da lista
    RETURN p_variants->>0;
END;
$$;

COMMENT ON FUNCTION campaign_select_variant IS 'Sorteia variante baseado nos pesos (ou distribuição igual)';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. RPC: Inscrever usuário em campanha
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION enroll_user_in_campaign(
    p_user_id UUID,
    p_campaign_name VARCHAR(100),
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID                -- IMPORTANTE: Retorna primitivo, não RECORD
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_campaign RECORD;
    v_user RECORD;
    v_first_step RECORD;
    v_variant TEXT;
    v_user_campaign_id UUID;
    v_next_scheduled TIMESTAMPTZ;
    v_randomize_minutes INT;
    v_should_cancel BOOLEAN;
BEGIN
    -- 1. Buscar campanha ativa
    SELECT * INTO v_campaign
    FROM campaigns
    WHERE name = p_campaign_name
      AND status = 'active';

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- 2. Verificar se usuário já está na campanha
    IF EXISTS (
        SELECT 1 FROM user_campaigns
        WHERE user_id = p_user_id
          AND campaign_id = v_campaign.id
    ) THEN
        RETURN NULL;
    END IF;

    -- 3. Buscar dados do usuário para validações
    SELECT * INTO v_user FROM users WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- 4. Verificar target_filter (se definido)
    IF v_campaign.target_filter IS NOT NULL THEN
        -- Verificar created_after
        IF v_campaign.target_filter ? 'created_after' THEN
            IF v_user.created_at < (v_campaign.target_filter->>'created_after')::TIMESTAMPTZ THEN
                RETURN NULL;
            END IF;
        END IF;

        -- Verificar subscription_plan
        IF v_campaign.target_filter ? 'subscription_plan' THEN
            IF v_user.subscription_plan != v_campaign.target_filter->>'subscription_plan' THEN
                RETURN NULL;
            END IF;
        END IF;

        -- Outros filtros podem ser adicionados aqui
    END IF;

    -- 5. Verificar cancel_condition (não inscreve se já é true)
    IF v_campaign.cancel_condition IS NOT NULL THEN
        EXECUTE format(
            'SELECT %s FROM users WHERE id = $1',
            v_campaign.cancel_condition
        ) INTO v_should_cancel USING p_user_id;

        IF v_should_cancel THEN
            RETURN NULL;
        END IF;
    END IF;

    -- 6. Verificar max_users (se definido)
    IF v_campaign.max_users IS NOT NULL THEN
        IF (SELECT COUNT(*) FROM user_campaigns WHERE campaign_id = v_campaign.id) >= v_campaign.max_users THEN
            RETURN NULL;
        END IF;
    END IF;

    -- 7. Buscar primeiro step
    SELECT * INTO v_first_step
    FROM campaign_steps
    WHERE campaign_id = v_campaign.id
    ORDER BY step_order
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;  -- Campanha sem steps
    END IF;

    -- 8. Sortear variante (se tiver A/B)
    IF v_first_step.variants IS NOT NULL THEN
        v_variant := campaign_select_variant(v_first_step.variants, v_first_step.variant_weights);
    ELSE
        v_variant := 'default';
    END IF;

    -- 9. Calcular próximo envio com randomização
    v_randomize_minutes := COALESCE((v_campaign.settings->>'randomize_minutes')::INT, 30);
    v_next_scheduled := NOW()
        + (v_first_step.delay_hours || ' hours')::INTERVAL
        + (random() * v_randomize_minutes || ' minutes')::INTERVAL;

    -- 10. Criar inscrição
    INSERT INTO user_campaigns (
        user_id, campaign_id, current_step, variant,
        next_scheduled_at, metadata, status
    ) VALUES (
        p_user_id, v_campaign.id, 0, v_variant,
        v_next_scheduled, p_metadata, 'pending'
    ) RETURNING id INTO v_user_campaign_id;

    -- 11. Registrar evento
    INSERT INTO campaign_events (
        user_campaign_id, user_id, campaign_id,
        event_type, step_key, variant, metadata
    ) VALUES (
        v_user_campaign_id, p_user_id, v_campaign.id,
        'enrolled', v_first_step.step_key, v_variant, p_metadata
    );

    RETURN v_user_campaign_id;
END;
$$;

COMMENT ON FUNCTION enroll_user_in_campaign IS 'Inscreve usuário em campanha com validações e sorteio de variante';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. RPC: Buscar mensagens pendentes para envio
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_pending_campaign_messages(
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    user_campaign_id UUID,
    user_id UUID,
    user_number TEXT,           -- IMPORTANTE: TEXT não VARCHAR (bug fix)
    user_name TEXT,             -- IMPORTANTE: TEXT não VARCHAR (bug fix)
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_locked_ids UUID[];
BEGIN
    -- IMPORTANTE: FOR UPDATE SKIP LOCKED evita duplicação quando múltiplos workers rodam
    -- Primeiro, pegamos e travamos os IDs
    SELECT array_agg(uc.id) INTO v_locked_ids
    FROM user_campaigns uc
    WHERE uc.status IN ('pending', 'active')
      AND uc.next_scheduled_at <= NOW()
    ORDER BY uc.next_scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED;

    -- Se não encontrou nada, retorna vazio
    IF v_locked_ids IS NULL OR array_length(v_locked_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    -- Atualiza status para 'processing' (atomic lock)
    UPDATE user_campaigns
    SET status = 'processing',
        updated_at = NOW()
    WHERE id = ANY(v_locked_ids);

    -- Retorna os dados completos
    RETURN QUERY
    SELECT
        uc.id as user_campaign_id,
        uc.user_id,
        u.whatsapp_number::TEXT as user_number,
        u.name::TEXT as user_name,
        uc.campaign_id,
        c.name as campaign_name,
        c.campaign_type,
        cs.step_order,
        cs.step_key,
        COALESCE(uc.variant, 'default')::VARCHAR(50) as variant,
        cm.content_type,
        cm.title,
        cm.body,
        cm.footer,
        cm.buttons,
        cm.media,
        c.cancel_condition,
        c.settings
    FROM user_campaigns uc
    JOIN campaigns c ON c.id = uc.campaign_id
    JOIN users u ON u.id = uc.user_id
    JOIN campaign_steps cs ON cs.campaign_id = c.id AND cs.step_order = uc.current_step
    LEFT JOIN campaign_messages cm ON cm.step_id = cs.id
        AND cm.variant = COALESCE(uc.variant, 'default')
    WHERE uc.id = ANY(v_locked_ids)
      AND c.status = 'active';
END;
$$;

COMMENT ON FUNCTION get_pending_campaign_messages IS 'Busca mensagens pendentes com FOR UPDATE SKIP LOCKED para evitar duplicação';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. RPC: Avançar step após envio
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION advance_campaign_step(
    p_user_campaign_id UUID,
    p_success BOOLEAN DEFAULT true,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TEXT                -- IMPORTANTE: TEXT não VARCHAR, retorna primitivo
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uc RECORD;
    v_current_step RECORD;
    v_next_step RECORD;
    v_next_scheduled TIMESTAMPTZ;
    v_randomize_minutes INT;
    v_result TEXT;
BEGIN
    -- 1. Buscar user_campaign com lock
    SELECT uc.*, c.name as campaign_name, c.settings, c.cancel_condition
    INTO v_uc
    FROM user_campaigns uc
    JOIN campaigns c ON c.id = uc.campaign_id
    WHERE uc.id = p_user_campaign_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'not_found';
    END IF;

    -- 2. Buscar step atual
    SELECT * INTO v_current_step
    FROM campaign_steps
    WHERE campaign_id = v_uc.campaign_id
      AND step_order = v_uc.current_step;

    -- 3. Registrar evento de envio
    INSERT INTO campaign_events (
        user_campaign_id, user_id, campaign_id,
        event_type, step_key, variant, metadata
    ) VALUES (
        p_user_campaign_id, v_uc.user_id, v_uc.campaign_id,
        CASE WHEN p_success THEN 'step_sent' ELSE 'step_failed' END,
        v_current_step.step_key, v_uc.variant, p_metadata
    );

    -- 4. Se falhou, volta status para 'active' (permite retry)
    IF NOT p_success THEN
        UPDATE user_campaigns
        SET status = 'active',
            updated_at = NOW()
        WHERE id = p_user_campaign_id;

        RETURN 'failed';
    END IF;

    -- 5. Buscar próximo step
    SELECT * INTO v_next_step
    FROM campaign_steps
    WHERE campaign_id = v_uc.campaign_id
      AND step_order = v_uc.current_step + 1;

    IF NOT FOUND THEN
        -- Completou a campanha
        UPDATE user_campaigns
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_user_campaign_id;

        INSERT INTO campaign_events (
            user_campaign_id, user_id, campaign_id, event_type, variant
        ) VALUES (
            p_user_campaign_id, v_uc.user_id, v_uc.campaign_id, 'completed', v_uc.variant
        );

        RETURN 'completed';
    END IF;

    -- 6. Calcular próximo envio
    v_randomize_minutes := COALESCE((v_uc.settings->>'randomize_minutes')::INT, 30);
    v_next_scheduled := NOW()
        + (v_next_step.delay_hours || ' hours')::INTERVAL
        + (random() * v_randomize_minutes || ' minutes')::INTERVAL;

    -- 7. Avançar para próximo step
    UPDATE user_campaigns
    SET current_step = v_next_step.step_order,
        next_scheduled_at = v_next_scheduled,
        status = 'active',
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW()
    WHERE id = p_user_campaign_id;

    -- 8. Registrar agendamento
    INSERT INTO campaign_events (
        user_campaign_id, user_id, campaign_id,
        event_type, step_key, variant, metadata
    ) VALUES (
        p_user_campaign_id, v_uc.user_id, v_uc.campaign_id,
        'step_scheduled', v_next_step.step_key, v_uc.variant,
        jsonb_build_object('scheduled_for', v_next_scheduled)
    );

    RETURN 'advanced';
END;
$$;

COMMENT ON FUNCTION advance_campaign_step IS 'Avança para próximo step ou completa campanha';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. RPC: Processar clique de botão (atômico)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_campaign_button_click(
    p_user_number TEXT,             -- IMPORTANTE: TEXT não VARCHAR
    p_campaign_name VARCHAR(100),
    p_button_id VARCHAR(100),
    p_should_cancel BOOLEAN DEFAULT true
)
RETURNS BOOLEAN                     -- IMPORTANTE: Retorna primitivo, não RECORD
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_uc RECORD;
    v_step RECORD;
BEGIN
    -- 1. Buscar user_id pelo número
    SELECT id INTO v_user_id
    FROM users
    WHERE whatsapp_number = p_user_number;

    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 2. Buscar e travar user_campaign ativo
    -- IMPORTANTE: FOR UPDATE SKIP LOCKED evita duplicação em cliques rápidos
    SELECT uc.*
    INTO v_uc
    FROM user_campaigns uc
    JOIN campaigns c ON c.id = uc.campaign_id
    WHERE uc.user_id = v_user_id
      AND c.name = p_campaign_name
      AND uc.status IN ('pending', 'active')
    FOR UPDATE SKIP LOCKED;

    -- Se não encontrou ou já está travado por outro processo
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 3. Buscar step atual
    SELECT * INTO v_step
    FROM campaign_steps
    WHERE campaign_id = v_uc.campaign_id
      AND step_order = v_uc.current_step;

    -- 4. Registrar evento de clique
    INSERT INTO campaign_events (
        user_campaign_id, user_id, campaign_id,
        event_type, step_key, variant, metadata
    ) VALUES (
        v_uc.id, v_user_id, v_uc.campaign_id,
        'button_clicked', v_step.step_key, v_uc.variant,
        jsonb_build_object(
            'button_id', p_button_id,
            'clicked_at', NOW()
        )
    );

    -- 5. Cancelar se solicitado
    IF p_should_cancel THEN
        UPDATE user_campaigns
        SET status = 'cancelled',
            cancel_reason = 'button_' || p_button_id,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_uc.id;

        INSERT INTO campaign_events (
            user_campaign_id, user_id, campaign_id,
            event_type, step_key, variant, metadata
        ) VALUES (
            v_uc.id, v_user_id, v_uc.campaign_id,
            'cancelled', v_step.step_key, v_uc.variant,
            jsonb_build_object(
                'reason', 'button_click',
                'button_id', p_button_id
            )
        );
    END IF;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION handle_campaign_button_click IS 'Processa clique de botão com lock atômico para evitar duplicação';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. RPC: Verificar e cancelar por cancel_condition
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_campaign_cancel_conditions()
RETURNS INT                         -- IMPORTANTE: Retorna primitivo
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cancelled INT := 0;
    v_record RECORD;
    v_should_cancel BOOLEAN;
BEGIN
    FOR v_record IN
        SELECT uc.id, uc.user_id, uc.campaign_id, uc.variant,
               c.cancel_condition, cs.step_key
        FROM user_campaigns uc
        JOIN campaigns c ON c.id = uc.campaign_id
        LEFT JOIN campaign_steps cs ON cs.campaign_id = c.id AND cs.step_order = uc.current_step
        WHERE uc.status IN ('pending', 'active')
          AND c.cancel_condition IS NOT NULL
    LOOP
        BEGIN
            -- Executar cancel_condition dinamicamente
            EXECUTE format(
                'SELECT %s FROM users WHERE id = $1',
                v_record.cancel_condition
            ) INTO v_should_cancel USING v_record.user_id;

            IF v_should_cancel THEN
                UPDATE user_campaigns
                SET status = 'cancelled',
                    cancel_reason = 'condition_met',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = v_record.id;

                INSERT INTO campaign_events (
                    user_campaign_id, user_id, campaign_id,
                    event_type, step_key, variant, metadata
                ) VALUES (
                    v_record.id, v_record.user_id, v_record.campaign_id,
                    'cancelled', v_record.step_key, v_record.variant,
                    jsonb_build_object('reason', 'condition_met')
                );

                v_cancelled := v_cancelled + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Log error mas continua processando
            RAISE NOTICE 'Error checking cancel condition for user_campaign %: %',
                v_record.id, SQLERRM;
        END;
    END LOOP;

    RETURN v_cancelled;
END;
$$;

COMMENT ON FUNCTION check_campaign_cancel_conditions IS 'Verifica e cancela campanhas que atingiram cancel_condition';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. RPC: Analytics de campanha
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_campaign_analytics(
    p_campaign_name VARCHAR(100),
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB                       -- JSONB é ok porque é um objeto complexo intencional
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_campaign_id UUID;
    v_result JSONB;
BEGIN
    -- Buscar campaign_id
    SELECT id INTO v_campaign_id
    FROM campaigns
    WHERE name = p_campaign_name;

    IF v_campaign_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Campaign not found');
    END IF;

    SELECT jsonb_build_object(
        'campaign', p_campaign_name,
        'period', jsonb_build_object(
            'start', p_start_date,
            'end', p_end_date
        ),
        'totals', (
            SELECT jsonb_build_object(
                'enrolled', COUNT(*) FILTER (WHERE event_type = 'enrolled'),
                'completed', COUNT(*) FILTER (WHERE event_type = 'completed'),
                'cancelled', COUNT(*) FILTER (WHERE event_type = 'cancelled'),
                'button_clicks', COUNT(*) FILTER (WHERE event_type = 'button_clicked'),
                'messages_sent', COUNT(*) FILTER (WHERE event_type = 'step_sent'),
                'messages_failed', COUNT(*) FILTER (WHERE event_type = 'step_failed')
            )
            FROM campaign_events
            WHERE campaign_id = v_campaign_id
              AND created_at BETWEEN p_start_date AND p_end_date
        ),
        'by_variant', (
            SELECT COALESCE(jsonb_object_agg(
                COALESCE(variant, 'default'),
                jsonb_build_object(
                    'enrolled', enrolled,
                    'button_clicks', clicks,
                    'completed', completed,
                    'click_rate', CASE WHEN enrolled > 0
                        THEN ROUND(clicks::NUMERIC / enrolled * 100, 2)
                        ELSE 0 END,
                    'completion_rate', CASE WHEN enrolled > 0
                        THEN ROUND(completed::NUMERIC / enrolled * 100, 2)
                        ELSE 0 END
                )
            ), '{}'::jsonb)
            FROM (
                SELECT
                    variant,
                    COUNT(*) FILTER (WHERE event_type = 'enrolled') as enrolled,
                    COUNT(*) FILTER (WHERE event_type = 'button_clicked') as clicks,
                    COUNT(*) FILTER (WHERE event_type = 'completed') as completed
                FROM campaign_events
                WHERE campaign_id = v_campaign_id
                  AND created_at BETWEEN p_start_date AND p_end_date
                GROUP BY variant
            ) sub
        ),
        'by_step', (
            SELECT COALESCE(jsonb_object_agg(
                step_key,
                jsonb_build_object(
                    'sent', sent,
                    'failed', failed,
                    'clicks', clicks
                )
            ), '{}'::jsonb)
            FROM (
                SELECT
                    step_key,
                    COUNT(*) FILTER (WHERE event_type = 'step_sent') as sent,
                    COUNT(*) FILTER (WHERE event_type = 'step_failed') as failed,
                    COUNT(*) FILTER (WHERE event_type = 'button_clicked') as clicks
                FROM campaign_events
                WHERE campaign_id = v_campaign_id
                  AND created_at BETWEEN p_start_date AND p_end_date
                  AND step_key IS NOT NULL
                GROUP BY step_key
            ) sub
        ),
        'funnel', (
            SELECT jsonb_agg(jsonb_build_object(
                'step', step_order,
                'step_key', step_key,
                'users_reached', users_at_step,
                'drop_off_rate', CASE WHEN prev_users > 0
                    THEN ROUND((1 - users_at_step::NUMERIC / prev_users) * 100, 2)
                    ELSE 0 END
            ) ORDER BY step_order)
            FROM (
                SELECT
                    cs.step_order,
                    cs.step_key,
                    COUNT(DISTINCT ce.user_id) as users_at_step,
                    LAG(COUNT(DISTINCT ce.user_id)) OVER (ORDER BY cs.step_order) as prev_users
                FROM campaign_steps cs
                LEFT JOIN campaign_events ce ON ce.campaign_id = cs.campaign_id
                    AND ce.step_key = cs.step_key
                    AND ce.event_type = 'step_sent'
                    AND ce.created_at BETWEEN p_start_date AND p_end_date
                WHERE cs.campaign_id = v_campaign_id
                GROUP BY cs.step_order, cs.step_key
            ) funnel_data
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_campaign_analytics IS 'Retorna analytics completos de uma campanha com funil, variantes e steps';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. RPC: Revert processing status (para recovery de falhas)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION revert_stuck_campaign_processing(
    p_older_than_minutes INT DEFAULT 10
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reverted INT;
BEGIN
    -- Reverte user_campaigns que ficaram travados em 'processing'
    -- (ex: worker crashou antes de completar)
    UPDATE user_campaigns
    SET status = 'active',
        updated_at = NOW()
    WHERE status = 'processing'
      AND updated_at < NOW() - (p_older_than_minutes || ' minutes')::INTERVAL;

    GET DIAGNOSTICS v_reverted = ROW_COUNT;

    RETURN v_reverted;
END;
$$;

COMMENT ON FUNCTION revert_stuck_campaign_processing IS 'Recupera campanhas travadas em processing (worker crash recovery)';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. GRANTS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Permitir que service_role acesse tudo
GRANT ALL ON campaigns TO service_role;
GRANT ALL ON campaign_steps TO service_role;
GRANT ALL ON campaign_messages TO service_role;
GRANT ALL ON user_campaigns TO service_role;
GRANT ALL ON campaign_events TO service_role;

-- Permitir execução das funções
GRANT EXECUTE ON FUNCTION campaign_select_variant TO service_role;
GRANT EXECUTE ON FUNCTION enroll_user_in_campaign TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_campaign_messages TO service_role;
GRANT EXECUTE ON FUNCTION advance_campaign_step TO service_role;
GRANT EXECUTE ON FUNCTION handle_campaign_button_click TO service_role;
GRANT EXECUTE ON FUNCTION check_campaign_cancel_conditions TO service_role;
GRANT EXECUTE ON FUNCTION get_campaign_analytics TO service_role;
GRANT EXECUTE ON FUNCTION revert_stuck_campaign_processing TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM DO SCHEMA UNIFICADO DE CAMPANHAS
-- ═══════════════════════════════════════════════════════════════════════════════
