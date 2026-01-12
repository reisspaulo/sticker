-- ========================================
-- FIX: set_limit_notified_atomic
-- Data: 12/01/2026
-- ========================================
--
-- PROBLEMA:
-- A funcao retornava TABLE(was_already_notified boolean), que o Supabase
-- envolve em um objeto {"was_already_notified": boolean}.
-- O codigo TypeScript esperava boolean direto, causando bug onde
-- mensagens de limite NUNCA eram enviadas (objeto e sempre truthy).
--
-- SOLUCAO:
-- Alterar para RETURNS boolean, retornando valor direto.
--
-- ========================================

-- Drop existing function
DROP FUNCTION IF EXISTS set_limit_notified_atomic(UUID);

-- Recreate with correct return type
CREATE OR REPLACE FUNCTION set_limit_notified_atomic(p_user_id UUID)
RETURNS boolean AS $$
DECLARE
  v_was_already_notified boolean;
  v_today_start timestamptz;
BEGIN
  -- Calculate start of today (Brasilia timezone)
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';

  -- Atomic update: set limit_notified_at if not already set today
  -- Uses SELECT FOR UPDATE to prevent race conditions
  UPDATE users
  SET
    limit_notified_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id
    AND (limit_notified_at IS NULL OR limit_notified_at < v_today_start)
  RETURNING (limit_notified_at < NOW() - INTERVAL '1 second') INTO v_was_already_notified;

  -- If no rows updated, user was already notified today
  IF NOT FOUND THEN
    v_was_already_notified := true;
  ELSE
    -- We just updated, so it wasn't notified before
    v_was_already_notified := false;
  END IF;

  -- Return boolean directly (not wrapped in TABLE)
  RETURN v_was_already_notified;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION set_limit_notified_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_limit_notified_atomic(UUID) TO service_role;

-- ========================================
-- VERIFICACAO
-- ========================================
-- Apos aplicar, testar com:
-- SELECT set_limit_notified_atomic('some-user-id');
-- Deve retornar: false (primeira vez) ou true (ja notificado)
-- NAO deve retornar: {"was_already_notified": false}
