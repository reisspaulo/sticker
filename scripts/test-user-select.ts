import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ludlztjdvwsrwlsczoje.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGx6dGpkdndzcndsc2N6b2plIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5MTE1MSwiZXhwIjoyMDgyMzY3MTUxfQ.fl1GxEIj6BK5qpZte3z7HYUW3NWSwPQyYTFf6-38blY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSelect() {
  console.log('Testing user select...\n');
  
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('whatsapp_number', '5511946304133')
    .single();

  if (fetchError) {
    console.log('❌ Select error:', JSON.stringify(fetchError, null, 2));
  } else {
    console.log('✅ User found!');
    console.log('User:', JSON.stringify(existingUser, null, 2));
  }
}

testSelect();
