-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED: Cleanup Feature V2 Campaign
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Campanha de descoberta das features de edição (remover fundo, remover bordas).
-- Migração da sequence cleanup_feature (draft) para o sistema de campaigns.
--
-- Trigger: Após usuário criar N figurinhas (nth_sticker)
-- Cancel: Usuário usa feature de cleanup (cleanup_feature_used = true)
-- Mensagens: D0 (4h após trigger), D7
--
-- Data: 13/01/2026
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Inserir campanha (status = draft para ativar manualmente depois)
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
    'cleanup_feature_v2',
    'Apresenta features de remover fundo e bordas das figurinhas para usuários após criarem algumas figurinhas',
    'hybrid',
    '{"event_name": "nth_sticker", "initial_delay_hours": 4, "sticker_count": 5}'::jsonb,
    '{"subscription_plan": "free"}'::jsonb,
    'cleanup_feature_used = true',
    'draft',  -- Começa em draft, ativar manualmente
    15,
    '{
        "rate_limit_ms": 200,
        "batch_size": 50,
        "randomize_minutes": 30,
        "send_window_start": 8,
        "send_window_end": 22
    }'::jsonb
);

-- 2. Inserir steps (D0, D7)
WITH campaign AS (
    SELECT id FROM campaigns WHERE name = 'cleanup_feature_v2'
)
INSERT INTO campaign_steps (campaign_id, step_order, step_key, delay_hours, variants)
SELECT
    campaign.id,
    step_order,
    step_key,
    delay_hours,
    NULL -- Sem A/B por enquanto
FROM campaign, (VALUES
    (0, 'day_0', 4),      -- 4 horas após trigger
    (1, 'day_7', 168)     -- 7 dias depois (168h)
) AS steps(step_order, step_key, delay_hours);

-- 3. Mensagem D0 (primeira mensagem)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'cleanup_feature_v2' AND cs.step_key = 'day_0'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'default',
    'buttons',
    '',
    E'Sabia que você pode editar suas figurinhas? ✨\n\n🎨 *Remover Fundo* - Deixa só a pessoa/objeto\n🧹 *Remover Bordas* - Tira as bordas brancas\n\nDepois de criar uma figurinha, é só clicar nos botões de edição!',
    '[{"id": "btn_cleanup_learn", "text": "✨ Quero ver!"}, {"id": "btn_cleanup_dismiss", "text": "❌ Não preciso"}]'::jsonb
FROM step;

-- 4. Mensagem D7 (lembrete)
WITH step AS (
    SELECT cs.id
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'cleanup_feature_v2' AND cs.step_key = 'day_7'
)
INSERT INTO campaign_messages (step_id, variant, content_type, title, body, buttons)
SELECT
    step.id,
    'default',
    'buttons',
    '',
    E'Lembrete: suas figurinhas podem ficar ainda melhores! 🎨\n\n✨ Remova o fundo para deixar só o que importa\n🧹 Remova bordas brancas para ficar perfeita\n\nÉ só enviar uma imagem e clicar nos botões de edição!',
    '[{"id": "btn_cleanup_learn", "text": "✨ Quero testar!"}, {"id": "btn_cleanup_dismiss", "text": "❌ Agora não"}]'::jsonb
FROM step;

-- 5. Deletar sequence antiga (estava em draft, sem usuários)
DELETE FROM sequences WHERE name = 'cleanup_feature';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Verificação
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_campaign_count INT;
    v_step_count INT;
    v_message_count INT;
    v_sequence_count INT;
BEGIN
    SELECT COUNT(*) INTO v_campaign_count FROM campaigns WHERE name = 'cleanup_feature_v2';
    SELECT COUNT(*) INTO v_step_count
    FROM campaign_steps cs
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'cleanup_feature_v2';
    SELECT COUNT(*) INTO v_message_count
    FROM campaign_messages cm
    JOIN campaign_steps cs ON cs.id = cm.step_id
    JOIN campaigns c ON c.id = cs.campaign_id
    WHERE c.name = 'cleanup_feature_v2';
    SELECT COUNT(*) INTO v_sequence_count FROM sequences WHERE name = 'cleanup_feature';

    RAISE NOTICE 'cleanup_feature_v2 criada: % campanha, % steps, % mensagens',
        v_campaign_count, v_step_count, v_message_count;
    RAISE NOTICE 'sequence cleanup_feature deletada: % restantes', v_sequence_count;

    IF v_campaign_count != 1 OR v_step_count != 2 OR v_message_count != 2 THEN
        RAISE EXCEPTION 'Seed incompleto! Esperado: 1 campanha, 2 steps, 2 mensagens';
    END IF;

    IF v_sequence_count != 0 THEN
        RAISE EXCEPTION 'Sequence antiga não foi deletada!';
    END IF;
END $$;
