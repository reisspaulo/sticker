import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ludlztjdvwsrwlsczoje.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGx6dGpkdndzcndsc2N6b2plIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5MTE1MSwiZXhwIjoyMDgyMzY3MTUxfQ.fl1GxEIj6BK5qpZte3z7HYUW3NWSwPQyYTFf6-38blY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('Testing user insert...\n');
  
  const testNumber = '5511946304133';
  
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
