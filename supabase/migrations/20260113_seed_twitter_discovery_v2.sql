-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED: Twitter Discovery V2 Campaign
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Campanha de descoberta do feature de Twitter para usuários que batem o limite diário.
-- Substitui a sequence twitter_discovery do sistema antigo.
--
-- Trigger: Usuário bate limite diário (limit_hit)
-- Cancel: Usuário usa feature de Twitter (twitter_feature_used = true)
-- Mensagens: D0 (4h), D7, D15, D30
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
    'twitter_discovery_v2',
    'Apresenta feature de download de vídeos do Twitter para usuários que batem o limite diário',
    'hybrid',
    '{"event_name": "limit_hit", "initial_delay_hours": 4}'::jsonb,
    '{"subscription_plan": "free"}'::jsonb,
    'twitter_feature_used = true',
    'active',
    10,
    '{
        "rate_limit_ms": 200,
        "batch_size": 50,
        "randomize_minutes": 30,
        "send_window_start": 8,
        "send_window_end": 22
    }'::jsonb
);

-- 2. Inserir steps (D0, D7, D15, D30)
WITH campaign AS (
    SELECT id FROM campaigns WHERE name = 'twitter_discovery_v2'
)
INSERT INTO campaign_steps (campaign_id, step_order, step_key, delay_hours, variants)
SELECT
    campaign.id,
    step_order,
    step_key,
    delay_hours,
    NULL -- Sem A/B por enquanto
FROM campaign, (VALUES
    (0, 'day_0', 4),      -- 4 horas após bater limite
    (1, 'day_7', 168),    -- 7 dias depois (168h)
    (2, 'day_15', 192),   -- +8 dias (192h)
    (3, 'day_30', 360)    -- +15 dias (360h)
) AS steps(step_order, step_key, delay_hours);

-- 3. Inserir mensagens para cada step
-- Mensagem D0 (primeira mensagem, 4h após limite)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'twitter_discovery_v2' AND cs.step_key = 'day_0'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'default',
    'buttons',
    '',
    E'Sabia que você pode baixar vídeos do Twitter/X e transformar em figurinha? 🎬\n\nÉ só mandar o link do tweet aqui que a gente baixa o vídeo e transforma em sticker animado!\n\nQuer testar? Manda um link de tweet com vídeo 👇',
    '[{"id": "btn_campaign_twitter_learn", "text": "🎬 Quero ver!"}, {"id": "btn_campaign_twitter_dismiss", "text": "❌ Não quero"}]'::jsonb
FROM step;

-- Mensagem D7 (lembrete 7 dias depois)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'twitter_discovery_v2' AND cs.step_key = 'day_7'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'default',
    'buttons',
    '',
    E'Lembrete rápido: dá pra baixar vídeos do Twitter/X e transformar em figurinha animada! 🎬\n\nManda o link de qualquer tweet com vídeo e a gente faz a mágica ✨',
    '[{"id": "btn_campaign_twitter_learn", "text": "🎬 Quero ver!"}, {"id": "btn_campaign_twitter_dismiss", "text": "❌ Não quero"}]'::jsonb
FROM step;

-- Mensagem D15 (lembrete 15 dias depois)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'twitter_discovery_v2' AND cs.step_key = 'day_15'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'default',
    'buttons',
    '',
    E'Já experimentou baixar vídeos do Twitter/X? 📱\n\nAlém de baixar, a gente transforma o vídeo em figurinha animada pra você usar no WhatsApp!\n\nSó mandar o link do tweet aqui 👇',
    '[{"id": "btn_campaign_twitter_learn", "text": "🎬 Quero ver!"}, {"id": "btn_campaign_twitter_dismiss", "text": "❌ Não quero"}]'::jsonb
FROM step;

-- Mensagem D30 (última mensagem)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'twitter_discovery_v2' AND cs.step_key = 'day_30'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'default',
    'buttons',
    '',
    E'Última dica: você pode baixar vídeos do Twitter/X e transformar em figurinha animada! 🎥\n\nManda qualquer link de tweet com vídeo e veja a mágica acontecer ✨',
    '[{"id": "btn_campaign_twitter_learn", "text": "🎬 Quero ver!"}, {"id": "btn_campaign_twitter_dismiss", "text": "❌ Não quero"}]'::jsonb
FROM step;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Verificação: Confirmar que tudo foi criado corretamente
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_campaign_count INT;
    v_step_count INT;
    v_message_count INT;
BEGIN
    SELECT COUNT(*) INTO v_campaign_count FROM campaigns WHERE name = 'twitter_discovery_v2';
    SELECT COUNT(*) INTO v_step_count
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'twitter_discovery_v2';
    SELECT COUNT(*) INTO v_message_count
    FROM campaign_messages cm
    JOIN campaign_steps cs ON cs.id = cm.step_id
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'twitter_discovery_v2';

    RAISE NOTICE 'twitter_discovery_v2 criada: % campanha, % steps, % mensagens',
        v_campaign_count, v_step_count, v_message_count;

    IF v_campaign_count != 1 OR v_step_count != 4 OR v_message_count != 4 THEN
        RAISE EXCEPTION 'Seed incompleto! Esperado: 1 campanha, 4 steps, 4 mensagens';
    END IF;
END $$;
