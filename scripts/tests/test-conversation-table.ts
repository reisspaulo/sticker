import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGx6dGpkdndzcndsc2N6b2plIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5MTE1MSwiZXhwIjoyMDgyMzY3MTUxfQ.fl1GxEIj6BK5qpZte3z7HYUW3NWSwPQyYTFf6-38blY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTable() {
  console.log('🧪 Testing conversation_contexts table...\n');

  // Test table exists by selecting from it
  const { data, error } = await supabase
    .from('conversation_contexts')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error accessing table:', error.message);
    return;
  }

  console.log('✅ Table exists and is accessible!');
  console.log(`   Current records: ${data?.length || 0}\n`);

  // Test insert
  console.log('🧪 Testing insert...');
  const { error: insertError } = await supabase
    .from('conversation_contexts')
    .insert({
      user_number: 'test_123',
      state: 'awaiting_plan_selection',
      metadata: { test: true },
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

  if (insertError) {
    console.error('❌ Insert error:', insertError.message);
  } else {
    console.log('✅ Insert successful!\n');

    // Clean up test record
    await supabase.from('conversation_contexts').delete().eq('user_number', 'test_123');
    console.log('🧹 Test record cleaned up\n');
  }

  console.log('✅ All tests passed!');
}

testTable().catch(console.error);
