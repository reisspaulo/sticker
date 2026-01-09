-- Script para corrigir usuários com onboarding_step travado em 1
-- Executar APÓS o deploy do fix atômico
-- Data: 2026-01-09

-- ============================================
-- PASSO 1: Identificar usuários afetados
-- ============================================
SELECT
  u.id,
  u.whatsapp_number,
  u.name,
  u.onboarding_step as current_step,
  COUNT(s.id) as total_stickers,
  MIN(s.created_at) AT TIME ZONE 'America/Sao_Paulo' as first_sticker,
  MAX(s.created_at) AT TIME ZONE 'America/Sao_Paulo' as last_sticker,
  CASE
    WHEN COUNT(s.id) >= 3 THEN 3
    ELSE COUNT(s.id)
  END as correct_step
FROM users u
LEFT JOIN stickers s ON s.user_number = u.whatsapp_number
WHERE u.onboarding_step = 1
AND u.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.id, u.whatsapp_number, u.name, u.onboarding_step
HAVING COUNT(s.id) >= 3
ORDER BY COUNT(s.id) DESC;

-- ============================================
-- PASSO 2: Corrigir onboarding_step
-- ============================================

-- IMPORTANTE: Revisar a lista acima antes de executar!

WITH user_corrections AS (
  SELECT
    u.id,
    u.whatsapp_number,
    u.onboarding_step as old_step,
    CASE
      WHEN COUNT(s.id) >= 3 THEN 3
      ELSE COUNT(s.id)
    END as new_step,
    COUNT(s.id) as total_stickers
  FROM users u
  LEFT JOIN stickers s ON s.user_number = u.whatsapp_number
  WHERE u.onboarding_step = 1
  AND u.created_at >= NOW() - INTERVAL '7 days'
  GROUP BY u.id, u.whatsapp_number, u.onboarding_step
  HAVING COUNT(s.id) >= 3
)
UPDATE users
SET
  onboarding_step = user_corrections.new_step,
  updated_at = NOW()
FROM user_corrections
WHERE users.id = user_corrections.id;

-- ============================================
-- PASSO 3: Verificar correção
-- ============================================
SELECT
  u.id,
  u.whatsapp_number,
  u.name,
  u.onboarding_step as corrected_step,
  COUNT(s.id) as total_stickers,
  u.updated_at AT TIME ZONE 'America/Sao_Paulo' as updated_at_brt
FROM users u
LEFT JOIN stickers s ON s.user_number = u.whatsapp_number
WHERE u.updated_at >= NOW() - INTERVAL '5 minutes'
GROUP BY u.id, u.whatsapp_number, u.name, u.onboarding_step, u.updated_at
ORDER BY u.updated_at DESC
LIMIT 20;

-- ============================================
-- PASSO 4: Estatísticas antes vs depois
-- ============================================

-- ANTES DO FIX (usuários com bug):
SELECT
  'ANTES (BUG)' as status,
  COUNT(*) as usuarios_afetados
FROM users u
WHERE u.onboarding_step = 1
AND u.created_at >= NOW() - INTERVAL '7 days'
AND (SELECT COUNT(*) FROM stickers WHERE user_number = u.whatsapp_number) >= 3;

-- DEPOIS DO FIX (deve ser 0):
SELECT
  'DEPOIS (CORRIGIDO)' as status,
  COUNT(*) as usuarios_afetados
FROM users u
WHERE u.onboarding_step = 1
AND u.created_at >= NOW() - INTERVAL '7 days'
AND (SELECT COUNT(*) FROM stickers WHERE user_number = u.whatsapp_number) >= 3;

-- ============================================
-- LOGS PARA AUDITORIA
-- ============================================

-- Ver quantos foram corrigidos
SELECT
  'TOTAL CORRIGIDO' as metrica,
  COUNT(*) as quantidade
FROM users
WHERE updated_at >= NOW() - INTERVAL '10 minutes'
AND onboarding_step = 3;
