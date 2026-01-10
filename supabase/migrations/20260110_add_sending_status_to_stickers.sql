-- Migration: Add 'sending' status to stickers table
-- Date: 2026-01-10
-- Issue: Prevent duplicate sticker sends when multiple workers run simultaneously
--
-- Problem:
--   sendPendingStickersJob runs on 2 workers at 8:00 AM
--   Both query: SELECT * FROM stickers WHERE status='pendente'
--   Both get same stickers → both send → DUPLICATES!
--
-- Solution:
--   Add 'sending' status to allow atomic lock:
--   Worker 1: UPDATE status='sending' WHERE status='pendente' → Success, sends
--   Worker 2: UPDATE status='sending' WHERE status='pendente' → No rows, skips

-- Drop existing check constraint
ALTER TABLE stickers
  DROP CONSTRAINT IF EXISTS stickers_status_check;

-- Add new check constraint with 'sending' status
ALTER TABLE stickers
  ADD CONSTRAINT stickers_status_check
  CHECK (status = ANY (ARRAY['enviado'::text, 'pendente'::text, 'sending'::text]));

-- Add comment for documentation
COMMENT ON CONSTRAINT stickers_status_check ON stickers IS
'Valid sticker statuses:
- enviado: Successfully sent to user
- pendente: Waiting to be sent (hit daily limit)
- sending: Being sent by a worker (transient state for atomic lock)';
