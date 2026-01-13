-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED: Limit Reached V2 Campaign (INSTANT)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Campanha instantânea para quando usuário atinge limite diário.
-- Substitui o experimento upgrade_message_v1.
--
-- Tipo: instant (sem delays, mensagem enviada imediatamente)
-- Variantes: control, benefit, social_proof, hybrid (25% cada)
-- Trigger: limit_hit (chamado diretamente, não por scheduler)
--
-- Data: 13/01/2026
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Inserir campanha (tipo instant)
INSERT INTO campaigns (
    name,
    description,
    campaign_type,
    trigger_config,
    target_filter,
    cancel_condition,
    status,
    priority,
    settings
) VALUES (
    'limit_reached_v2',
    'Mensagem instantânea quando usuário atinge limite diário. Substitui upgrade_message_v1.',
    'instant',
    '{"event_name": "limit_hit"}'::jsonb,
    '{"subscription_plan": "free"}'::jsonb,
    NULL,  -- Sem cancel condition (mensagem única)
    'active',
    100,  -- Alta prioridade
    '{
        "is_instant": true,
        "skip_send_window": false,
        "log_events": true
    }'::jsonb
);

-- 2. Inserir step único (delay_hours = 0 para instant)
WITH campaign AS (
    SELECT id FROM campaigns WHERE name = 'limit_reached_v2'
)
INSERT INTO campaign_steps (campaign_id, step_order, step_key, delay_hours, variants)
SELECT
    campaign.id,
    0,
    'instant',
    0,  -- Sem delay (instant)
    ARRAY['control', 'benefit', 'social_proof', 'hybrid']
FROM campaign;

-- 3. Mensagens - Variante CONTROL (padrão detalhado)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'limit_reached_v2' AND cs.step_key = 'instant'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'control',
    'buttons',
    E'⚠️ *Limite Atingido!* 😊',
    E'Você já usou *{count}/{limit} figurinhas* hoje.\n\nSeu limite será renovado às *00:00* (horário de Brasília).\n\n💎 *FAÇA UPGRADE E TENHA MAIS!*\n\n💰 *Premium (R$ 5/mês)*\n• 20 figurinhas/dia\n\n🚀 *Ultra (R$ 9,90/mês)*\n• Figurinhas *ILIMITADAS*',
    '[
        {"id": "button_premium_plan", "text": "💰 Premium - R$ 5/mês"},
        {"id": "button_ultra_plan", "text": "🚀 Ultra - R$ 9,90/mês"},
        {"id": "button_dismiss_upgrade", "text": "❌ Agora Não"}
    ]'::jsonb
FROM step;

-- 4. Mensagens - Variante BENEFIT (foco em ganho)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'limit_reached_v2' AND cs.step_key = 'instant'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'benefit',
    'buttons',
    E'*{count}/{limit} figurinhas usadas* ✨',
    E'Com Premium você teria +16 hoje.\nCom Ultra, sem limite nenhum.\n\nPremium: R$ 5/mês\nUltra: R$ 9,90/mês',
    '[
        {"id": "button_premium_plan", "text": "Premium +16/dia"},
        {"id": "button_ultra_plan", "text": "Ultra Ilimitado"},
        {"id": "button_dismiss_upgrade", "text": "Esperar"}
    ]'::jsonb
FROM step;

-- 5. Mensagens - Variante SOCIAL_PROOF (prova social)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'limit_reached_v2' AND cs.step_key = 'instant'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'social_proof',
    'buttons',
    E'*Suas figurinhas de hoje acabaram* 😊',
    E'Você usou {count}/{limit}.\n\nMais de 150 pessoas fizeram upgrade este mês para criar sem esperar.\n\nPremium: 20/dia por R$ 5\nUltra: Sem limite por R$ 9,90',
    '[
        {"id": "button_premium_plan", "text": "Quero Premium"},
        {"id": "button_ultra_plan", "text": "Quero Ultra"},
        {"id": "button_dismiss_upgrade", "text": "Depois"}
    ]'::jsonb
FROM step;

-- 6. Mensagens - Variante HYBRID (mix)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'limit_reached_v2' AND cs.step_key = 'instant'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'hybrid',
    'buttons',
    E'*Fim das figurinhas de hoje* 🎨',
    E'Usuários Premium criam em média 12 figurinhas por dia.\nUsuários Ultra criam sem limite.\n\nQual combina mais com você?',
    '[
        {"id": "button_premium_plan", "text": "Premium R$5"},
        {"id": "button_ultra_plan", "text": "Ultra R$9,90"},
        {"id": "button_dismiss_upgrade", "text": "Nenhum"}
    ]'::jsonb
FROM step;

-- 7. Pausar experimento antigo
UPDATE experiments
SET status = 'paused',
    updated_at = NOW()
WHERE name = 'upgrade_message_v1'
AND status != 'paused';

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC: get_instant_campaign_message
-- ═══════════════════════════════════════════════════════════════════════════════
-- Busca mensagem de uma campanha instant, sorteando variante para o usuário
-- Registra atribuição para analytics e retorna mensagem configurada

CREATE OR REPLACE FUNCTION get_instant_campaign_message(
    p_user_id UUID,
    p_campaign_name TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
    campaign_id UUID,
    variant TEXT,
    title TEXT,
    body TEXT,
    buttons JSONB,
    content_type VARCHAR,
    is_new_assignment BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_campaign RECORD;
    v_step RECORD;
    v_existing_variant TEXT;
    v_selected_variant TEXT;
    v_message RECORD;
    v_user_campaign_id UUID;
BEGIN
    -- 1. Buscar campanha instant ativa
    SELECT c.* INTO v_campaign
    FROM campaigns c
    WHERE c.name = p_campaign_name
    AND c.status = 'active'
    AND c.campaign_type = 'instant';

    IF NOT FOUND THEN
        RAISE NOTICE '[CAMPAIGN-INSTANT] Campaign not found or not active: %', p_campaign_name;
        RETURN;
    END IF;

    -- 2. Buscar step único (instant tem apenas 1 step)
    SELECT cs.* INTO v_step
    FROM campaign_steps cs
    WHERE cs.campaign_id = v_campaign.id
    AND cs.step_order = 0;

    IF NOT FOUND THEN
        RAISE NOTICE '[CAMPAIGN-INSTANT] Step not found for campaign: %', p_campaign_name;
        RETURN;
    END IF;

    -- 3. Verificar se usuário já tem variante atribuída
    SELECT uc.metadata->>'variant' INTO v_existing_variant
    FROM user_campaigns uc
    WHERE uc.user_id = p_user_id
    AND uc.campaign_id = v_campaign.id;

    IF v_existing_variant IS NOT NULL THEN
        -- Usar variante existente
        v_selected_variant := v_existing_variant;

        RAISE NOTICE '[CAMPAIGN-INSTANT] Using existing variant % for user %', v_selected_variant, p_user_id;
    ELSE
        -- Sortear nova variante
        v_selected_variant := campaign_select_variant(v_step.variants);

        -- Registrar atribuição para analytics
        INSERT INTO user_campaigns (user_id, campaign_id, status, current_step, metadata)
        VALUES (
            p_user_id,
            v_campaign.id,
            'completed',  -- Instant = já completo
            0,
            jsonb_build_object(
                'variant', v_selected_variant,
                'trigger', 'limit_hit',
                'assigned_at', NOW(),
                'metadata', p_metadata
            )
        )
        RETURNING id INTO v_user_campaign_id;

        -- Registrar evento de assignment
        INSERT INTO campaign_events (user_campaign_id, event_type, step_key, variant, metadata)
        VALUES (
            v_user_campaign_id,
            'variant_assigned',
            'instant',
            v_selected_variant,
            p_metadata
        );

        RAISE NOTICE '[CAMPAIGN-INSTANT] Assigned new variant % to user %', v_selected_variant, p_user_id;
    END IF;

    -- 4. Buscar mensagem da variante
    SELECT cm.* INTO v_message
    FROM campaign_messages cm
    WHERE cm.step_id = v_step.id
    AND cm.variant = v_selected_variant;

    IF NOT FOUND THEN
        -- Fallback para control
        SELECT cm.* INTO v_message
        FROM campaign_messages cm
        WHERE cm.step_id = v_step.id
        AND cm.variant = 'control';

        RAISE NOTICE '[CAMPAIGN-INSTANT] Variant % not found, using control', v_selected_variant;
    END IF;

    -- 5. Retornar mensagem
    RETURN QUERY
    SELECT
        v_campaign.id,
        v_selected_variant,
        v_message.title,
        v_message.body,
        v_message.buttons,
        v_message.content_type,
        (v_existing_variant IS NULL);  -- is_new_assignment

END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC: log_campaign_instant_event
-- ═══════════════════════════════════════════════════════════════════════════════
-- Loga evento de campanha instant (menu_shown, button_clicked, converted, etc.)

CREATE OR REPLACE FUNCTION log_campaign_instant_event(
    p_user_id UUID,
    p_campaign_name TEXT,
    p_event_type TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_campaign RECORD;
    v_event_id UUID;
BEGIN
    -- Buscar user_campaign
    SELECT uc.*, c.name as campaign_name
    INTO v_user_campaign
    FROM user_campaigns uc
    JOIN campaigns c ON c.id = uc.campaign_id
    WHERE uc.user_id = p_user_id
    AND c.name = p_campaign_name
    ORDER BY uc.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE NOTICE '[CAMPAIGN-EVENT] No user_campaign found for user % campaign %', p_user_id, p_campaign_name;
        RETURN NULL;
    END IF;

    -- Inserir evento
    INSERT INTO campaign_events (
        user_campaign_id,
        event_type,
        step_key,
        variant,
        metadata
    )
    VALUES (
        v_user_campaign.id,
        p_event_type,
        'instant',
        v_user_campaign.metadata->>'variant',
        p_metadata
    )
    RETURNING id INTO v_event_id;

    RAISE NOTICE '[CAMPAIGN-EVENT] Event % logged for user % variant %',
        p_event_type, p_user_id, v_user_campaign.metadata->>'variant';

    RETURN v_event_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Verificação
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_campaign_count INT;
    v_step_count INT;
    v_message_count INT;
BEGIN
    SELECT COUNT(*) INTO v_campaign_count FROM campaigns WHERE name = 'limit_reached_v2';
    SELECT COUNT(*) INTO v_step_count
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'limit_reached_v2';
    SELECT COUNT(*) INTO v_message_count
    FROM campaign_messages cm
    JOIN campaign_steps cs ON cs.id = cm.step_id
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'limit_reached_v2';

    RAISE NOTICE 'limit_reached_v2 criada: % campanha, % step, % mensagens (variantes)',
        v_campaign_count, v_step_count, v_message_count;

    IF v_campaign_count != 1 OR v_step_count != 1 OR v_message_count != 4 THEN
        RAISE EXCEPTION 'Seed incompleto! Esperado: 1 campanha, 1 step, 4 mensagens';
    END IF;

    RAISE NOTICE 'RPCs criadas: get_instant_campaign_message, log_campaign_instant_event';
END $$;
