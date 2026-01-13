-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED: Payment Intent Reminder V2 Campaign
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Campanha de remarketing para usuários que selecionaram plano mas não pagaram.
-- Migração do experimento payment_intent_reminder_v1 para o sistema de campaigns.
--
-- Trigger: Usuário seleciona plano (payment_intent)
-- Cancel: Usuário completa pagamento (subscription_plan != 'free')
-- Waves: T+30min (wave_1), T+6h (wave_2), T+48h (wave_3)
-- Variantes: control, benefit, urgency, social_proof (25% cada)
--
-- Data: 13/01/2026
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Inserir campanha
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
    'payment_intent_reminder_v2',
    'Remarketing para usuários que selecionaram plano mas não completaram pagamento. 3 waves com 4 variantes A/B.',
    'event',
    '{"event_name": "payment_intent", "initial_delay_hours": 0.5}'::jsonb,
    '{"subscription_plan": "free"}'::jsonb,
    'subscription_plan != ''free''',
    'active',
    20,
    '{
        "rate_limit_ms": 200,
        "batch_size": 50,
        "randomize_minutes": 5,
        "send_window_start": 8,
        "send_window_end": 22,
        "include_international": false
    }'::jsonb
);

-- 2. Inserir steps (wave_1, wave_2, wave_3)
WITH campaign AS (
    SELECT id FROM campaigns WHERE name = 'payment_intent_reminder_v2'
)
INSERT INTO campaign_steps (campaign_id, step_order, step_key, delay_hours, variants)
SELECT
    campaign.id,
    step_order,
    step_key,
    delay_hours,
    '["control", "benefit", "urgency", "social_proof"]'::jsonb
FROM campaign, (VALUES
    (0, 'wave_1', 0.5),    -- 30 minutos após payment_intent
    (1, 'wave_2', 5.5),    -- +5.5 horas (total 6h)
    (2, 'wave_3', 42)      -- +42 horas (total 48h)
) AS steps(step_order, step_key, delay_hours);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Inserir mensagens para WAVE 1 (T+30min)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Wave 1 - Control
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_1'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'control',
    'buttons',
    'Seu plano {plan_name} está reservado ⏰',
    E'Escolha a forma de pagamento:\n\nPIX: Ativação em 5min\nCartão: Pagamento instantâneo\nBoleto: Até 3 dias úteis',
    NULL,
    '[{"id": "btn_pir_pix", "text": "🔑 PIX"}, {"id": "btn_pir_card", "text": "💳 Cartão"}, {"id": "btn_pir_dismiss", "text": "Mais tarde"}]'::jsonb
FROM step;

-- Wave 1 - Benefit
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_1'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'benefit',
    'buttons',
    'Com {plan_name} você teria {benefit_today} 🎨',
    'Finalize em 2 minutos com PIX ou cartão.',
    NULL,
    '[{"id": "btn_pir_pix", "text": "PIX Rápido"}, {"id": "btn_pir_card", "text": "Cartão"}, {"id": "btn_pir_dismiss", "text": "Mais tarde"}]'::jsonb
FROM step;

-- Wave 1 - Urgency
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_1'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'urgency',
    'buttons',
    'Plano {plan_name} reservado por mais 6 horas ⏱️',
    'Finalize com PIX e comece agora.',
    NULL,
    '[{"id": "btn_pir_pix", "text": "Finalizar PIX"}, {"id": "btn_pir_card", "text": "Outras formas"}, {"id": "btn_pir_dismiss", "text": "Lembrar depois"}]'::jsonb
FROM step;

-- Wave 1 - Social Proof
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_1'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'social_proof',
    'buttons',
    '47 pessoas fizeram upgrade hoje',
    'Complete seu {plan_name} agora:',
    NULL,
    '[{"id": "btn_pir_pix", "text": "Pagar com PIX"}, {"id": "btn_pir_card", "text": "Cartão"}, {"id": "btn_pir_dismiss", "text": "Ver depois"}]'::jsonb
FROM step;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Inserir mensagens para WAVE 2 (T+6h)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Wave 2 - Control
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_2'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'control',
    'buttons',
    'Seu plano {plan_name} expira em breve',
    'Finalize agora e comece a criar.',
    NULL,
    '[{"id": "btn_pir_pix", "text": "PIX"}, {"id": "btn_pir_card", "text": "Cartão"}, {"id": "btn_pir_dismiss", "text": "Cancelar"}]'::jsonb
FROM step;

-- Wave 2 - Benefit
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_2'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'benefit',
    'buttons',
    '{benefit_week} essa semana',
    E'Usuários {plan_name} criaram em média {benefit_week}.\n\nVocê ainda pode fazer upgrade:',
    NULL,
    '[{"id": "btn_pir_pix", "text": "Quero {plan_name}"}, {"id": "btn_pir_card", "text": "Pagar cartão"}, {"id": "btn_pir_dismiss", "text": "Não agora"}]'::jsonb
FROM step;

-- Wave 2 - Urgency
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_2'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'urgency',
    'buttons',
    'Sua reserva expira em 42 horas',
    E'{plan_benefit}\n\nFinalize agora:',
    NULL,
    '[{"id": "btn_pir_pix", "text": "Finalizar agora"}, {"id": "btn_pir_card", "text": "Ver formas"}, {"id": "btn_pir_dismiss", "text": "Deixar expirar"}]'::jsonb
FROM step;

-- Wave 2 - Social Proof
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_2'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'social_proof',
    'buttons',
    '{plan_name} é o plano mais escolhido',
    'Complete em 2 minutos:',
    NULL,
    '[{"id": "btn_pir_pix", "text": "PIX"}, {"id": "btn_pir_card", "text": "Cartão"}, {"id": "btn_pir_dismiss", "text": "Outro dia"}]'::jsonb
FROM step;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. Inserir mensagens para WAVE 3 (T+48h)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Wave 3 - Control
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_3'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'control',
    'buttons',
    'Última chance - {plan_name}',
    E'Sua reserva expira hoje.\n\n{plan_benefit}',
    NULL,
    '[{"id": "btn_pir_pix", "text": "Finalizar"}, {"id": "btn_pir_plans", "text": "Ver planos"}, {"id": "btn_pir_dismiss", "text": "Deixar expirar"}]'::jsonb
FROM step;

-- Wave 3 - Benefit
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_3'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'benefit',
    'buttons',
    'Perder {benefit_today}?',
    E'É isso que você deixa de criar com {plan_name}.\n\nÚltima chance:',
    NULL,
    '[{"id": "btn_pir_pix", "text": "Finalizar agora"}, {"id": "btn_pir_plans", "text": "Ver outros planos"}, {"id": "btn_pir_dismiss", "text": "Deixar passar"}]'::jsonb
FROM step;

-- Wave 3 - Urgency
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_3'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'urgency',
    'buttons',
    'Expira hoje - {plan_name}',
    'Última chance para garantir seu plano.',
    NULL,
    '[{"id": "btn_pir_pix", "text": "Quero agora"}, {"id": "btn_pir_plans", "text": "Ver outros"}, {"id": "btn_pir_dismiss", "text": "Cancelar"}]'::jsonb
FROM step;

-- Wave 3 - Social Proof
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2' AND cs.step_key = 'wave_3'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, footer, buttons)
SELECT
    step.id,
    'social_proof',
    'buttons',
    'Última oportunidade',
    'Junte-se aos usuários que criaram {total_week} figurinhas essa semana.',
    NULL,
    '[{"id": "btn_pir_pix", "text": "Finalizar"}, {"id": "btn_pir_plans", "text": "Ver planos"}, {"id": "btn_pir_dismiss", "text": "Não quero"}]'::jsonb
FROM step;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. Pausar experimento antigo
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE experiments
SET status = 'paused',
    ended_at = NOW(),
    notes = notes || ' | Migrado para campaigns: payment_intent_reminder_v2 em 13/01/2026'
WHERE name = 'payment_intent_reminder_v1';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Verificação
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_campaign_count INT;
    v_step_count INT;
    v_message_count INT;
    v_experiment_status TEXT;
BEGIN
    SELECT COUNT(*) INTO v_campaign_count FROM campaigns WHERE name = 'payment_intent_reminder_v2';
    SELECT COUNT(*) INTO v_step_count
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2';
    SELECT COUNT(*) INTO v_message_count
    FROM campaign_messages cm
    JOIN campaign_steps cs ON cs.id = cm.step_id
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'payment_intent_reminder_v2';
    SELECT status INTO v_experiment_status FROM experiments WHERE name = 'payment_intent_reminder_v1';

    RAISE NOTICE 'payment_intent_reminder_v2 criada: % campanha, % steps, % mensagens',
        v_campaign_count, v_step_count, v_message_count;
    RAISE NOTICE 'payment_intent_reminder_v1 status: %', v_experiment_status;

    IF v_campaign_count != 1 OR v_step_count != 3 OR v_message_count != 12 THEN
        RAISE EXCEPTION 'Seed incompleto! Esperado: 1 campanha, 3 steps, 12 mensagens (4 variantes x 3 steps)';
    END IF;

    IF v_experiment_status != 'paused' THEN
        RAISE EXCEPTION 'Experimento antigo não foi pausado!';
    END IF;
END $$;
