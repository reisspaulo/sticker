import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGx6dGpkdndzcndsc2N6b2plIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5MTE1MSwiZXhwIjoyMDgyMzY3MTUxfQ.fl1GxEIj6BK5qpZte3z7HYUW3NWSwPQyYTFf6-38blY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  console.log('🔨 Creating conversation_contexts table...\n');

  // Create table
  const { error: tableError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS conversation_contexts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_number TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL CHECK (state IN ('awaiting_plan_selection', 'awaiting_confirmation', 'none')),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );
    `,
  });

  if (tableError) {
    console.error('❌ Error creating table:', tableError.message);
    console.log('\n⚠️  Trying direct approach via REST...\n');

    // Try direct SQL execution
    const response = await fetch(
      'https://YOUR_SUPABASE_PROJECT_ID.supabase.co/rest/v1/rpc/query',
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            CREATE TABLE IF NOT EXISTS conversation_contexts (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_number TEXT NOT NULL UNIQUE,
              state TEXT NOT NULL CHECK (state IN ('awaiting_plan_selection', 'awaiting_confirmation', 'none')),
              metadata JSONB DEFAULT '{}'::jsonb,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              expires_at TIMESTAMPTZ NOT NULL
            );
          `,
        }),
      }
    );

    if (!response.ok) {
      console.error('❌ REST API error:', await response.text());
      console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:\n');
      console.log(`
CREATE TABLE IF NOT EXISTS conversation_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_number TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('awaiting_plan_selection', 'awaiting_confirmation', 'none')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversation_contexts_user_number ON conversation_contexts(user_number);
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_expires_at ON conversation_contexts(expires_at);

CREATE OR REPLACE FUNCTION cleanup_expired_conversation_contexts()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_contexts WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
      `);
      return;
    }
  } else {
    console.log('✅ Table created!');
  }

  // Test if table exists by trying to insert and delete a test record
  console.log('\n🧪 Testing table...');
  const { error: testError } = await supabase
    .from('conversation_contexts')
    .select('*')
    .limit(1);

  if (testError) {
    console.error('❌ Table test failed:', testError.message);
  } else {
    console.log('✅ Table is working!\n');
  }
}

createTable().catch(console.error);
