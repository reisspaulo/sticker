-- Migration: Fix increment_bonus_credit to prevent race condition
-- Date: 2026-01-10
-- Issue: Users can exploit bonus credits by double-clicking (TOCTOU bug)
--
-- Problem:
--   Current implementation increments without validating limit:
--   1. User has bonus_credits_today = 1
--   2. User clicks button 2x rapidly
--   3. Both requests increment → user gets 3 credits instead of 2
--
-- Solution:
--   Add atomic validation inside the RPC function with FOR UPDATE lock

-- Drop existing function
DROP FUNCTION IF EXISTS public.increment_bonus_credit(uuid);

-- Recreate with atomic validation
CREATE OR REPLACE FUNCTION public.increment_bonus_credit(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_bonus INTEGER;
  new_bonus_count INTEGER;
BEGIN
  -- Lock row for atomic read
  SELECT bonus_credits_today INTO current_bonus
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Validate limit BEFORE incrementing (max 2 bonus/day)
  IF current_bonus >= 2 THEN
    RAISE EXCEPTION 'bonus_limit_reached'
      USING HINT = 'User already used 2 bonus credits today',
            DETAIL = format('Current bonus: %s/2', current_bonus);
  END IF;

  -- Increment only if validation passed
  UPDATE users
  SET bonus_credits_today = COALESCE(bonus_credits_today, 0) + 1,
      last_interaction = NOW()
  WHERE id = p_user_id
  RETURNING bonus_credits_today INTO new_bonus_count;

  RETURN new_bonus_count;
END;
$function$;

-- Add comment for documentation
COMMENT ON FUNCTION public.increment_bonus_credit(uuid) IS
'Atomically increments bonus credits for a user with limit validation.
Uses FOR UPDATE lock to prevent race conditions.
Raises exception if user already used 2 bonus credits today.';
