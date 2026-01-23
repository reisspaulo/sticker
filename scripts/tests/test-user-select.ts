import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const supabaseKey = 'YOUR_SUPABASE_SERVICE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSelect() {
  console.log('Testing user select...\n');
  
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('whatsapp_number', '5511999999999')
    .single();

  if (fetchError) {
    console.log('❌ Select error:', JSON.stringify(fetchError, null, 2));
  } else {
    console.log('✅ User found!');
    console.log('User:', JSON.stringify(existingUser, null, 2));
  }
}

testSelect();
