import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const supabaseKey = 'YOUR_SUPABASE_SERVICE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('Testing user insert...\n');
  
  const testNumber = '5511999999999';
  
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      whatsapp_number: testNumber,
      name: 'Paulo',
      daily_count: 0,
      last_reset_at: new Date().toISOString(),
      last_interaction: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.log('❌ Insert error:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('✅ User created successfully!');
    console.log('User ID:', newUser.id);
    console.log('Full user:', JSON.stringify(newUser, null, 2));
  }
}

testInsert();
