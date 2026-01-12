-- ========================================
-- FIX: set_limit_notified_atomic
-- Data: 12/01/2026
-- ========================================
--
-- PROBLEMA:
-- A funcao tinha um parametro OUT (was_already_notified boolean), que faz
-- o PostgreSQL retornar um objeto {"was_already_notified": boolean} mesmo
-- com RETURNS boolean.
-- O codigo TypeScript esperava boolean direto, causando bug onde
-- mensagens de limite NUNCA eram enviadas (objeto e sempre truthy).
--
-- SOLUCAO:
-- Remover o parametro OUT e retornar boolean diretamente.
--
-- ========================================

-- Remove a função com OUT parameter
DROP FUNCTION IF EXISTS set_limit_notified_atomic(uuid);

-- Cria versão correta SEM OUT parameter
CREATE FUNCTION set_limit_notified_atomic(p_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_affected int;
BEGIN
  -- Calculate start of today (Brasilia timezone) and update if not already notified
  UPDATE users
  SET limit_notified_at = NOW(), updated_at = NOW()
  WHERE id = p_user_id
    AND (limit_notified_at IS NULL
         OR limit_notified_at < date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo');

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- true = já foi notificado hoje (0 rows updated)
  -- false = primeira notificação do dia (1 row updated)
  RETURN v_rows_affected = 0;
END;
$$;

-- ========================================
-- VERIFICACAO
-- ========================================
-- Apos aplicar, verificar que NAO tem OUT parameter:
-- SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'set_limit_notified_atomic';
-- Deve retornar: "p_user_id uuid" (SEM "OUT was_already_notified boolean")
--
-- Testar:
-- SELECT set_limit_notified_atomic('some-user-id');
-- Deve retornar: true ou false (NAO um objeto)
