-- Migration: Add pending_sticker_sends table for comprehensive logging
-- Purpose: Track every attempt to send pending stickers for full traceability
-- Date: 2026-01-06

-- Table to log all pending sticker send attempts
CREATE TABLE IF NOT EXISTS pending_sticker_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sticker_id UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_number VARCHAR(20) NOT NULL,

  -- Attempt tracking
  attempt_number INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL CHECK (status IN ('attempting', 'sent', 'failed')),

  -- Result details
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  error_code VARCHAR(50),

  -- Metadata
  worker_id VARCHAR(100), -- To identify which worker instance processed it
  processing_time_ms INTEGER, -- How long the send took

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_pending_sticker_sends_sticker_id
  ON pending_sticker_sends(sticker_id);

CREATE INDEX IF NOT EXISTS idx_pending_sticker_sends_user_id
  ON pending_sticker_sends(user_id);

CREATE INDEX IF NOT EXISTS idx_pending_sticker_sends_status
  ON pending_sticker_sends(status);

CREATE INDEX IF NOT EXISTS idx_pending_sticker_sends_created_at
  ON pending_sticker_sends(created_at DESC);

-- Composite index for finding recent failed attempts
CREATE INDEX IF NOT EXISTS idx_pending_sticker_sends_status_created
  ON pending_sticker_sends(status, created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE pending_sticker_sends ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access
CREATE POLICY "Service role has full access to pending_sticker_sends"
  ON pending_sticker_sends
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Users can view their own send attempts
CREATE POLICY "Users can view their own pending_sticker_sends"
  ON pending_sticker_sends
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE pending_sticker_sends IS
  'Comprehensive log of all pending sticker send attempts for traceability and debugging';

COMMENT ON COLUMN pending_sticker_sends.attempt_number IS
  'Which attempt this is (1, 2, 3, etc.) - allows tracking retries';

COMMENT ON COLUMN pending_sticker_sends.worker_id IS
  'Identifier of the worker instance that processed this (hostname, container ID, etc.)';

COMMENT ON COLUMN pending_sticker_sends.processing_time_ms IS
  'How long the send operation took in milliseconds';
