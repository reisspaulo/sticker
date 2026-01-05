-- Create conversation_contexts table for menu state management
CREATE TABLE IF NOT EXISTS conversation_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_number TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('awaiting_plan_selection', 'awaiting_confirmation', 'none')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_user_number ON conversation_contexts(user_number);
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_expires_at ON conversation_contexts(expires_at);

-- Create cleanup function to delete expired contexts
CREATE OR REPLACE FUNCTION cleanup_expired_conversation_contexts()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_contexts WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
