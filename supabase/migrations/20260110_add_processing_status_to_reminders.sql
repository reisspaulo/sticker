-- Migration: Add 'processing' status to scheduled_reminders table
-- Date: 2026-01-10
-- Issue: Atomic lock failing because 'processing' status is not in constraint
--
-- Problem:
--   sendScheduledRemindersJob tries to claim reminders with:
--   UPDATE status='processing' WHERE status='pending'
--   But constraint only allows: pending, sent, canceled, failed
--   Result: Both workers get constraint error → both skip → reminders stuck
--
-- Solution:
--   Add 'processing' to allowed statuses for atomic locking

-- Drop existing check constraint
ALTER TABLE scheduled_reminders
  DROP CONSTRAINT IF EXISTS scheduled_reminders_status_check;

-- Add new check constraint with 'processing' status
ALTER TABLE scheduled_reminders
  ADD CONSTRAINT scheduled_reminders_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'canceled'::text, 'failed'::text]));

-- Add comment for documentation
COMMENT ON CONSTRAINT scheduled_reminders_status_check ON scheduled_reminders IS
'Valid reminder statuses:
- pending: Waiting to be sent (not yet scheduled_for time)
- processing: Being processed by a worker (transient state for atomic lock)
- sent: Successfully sent to user
- canceled: User dismissed or conditions changed
- failed: Sending failed (error occurred)';
