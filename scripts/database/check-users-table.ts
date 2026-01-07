import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ludlztjdvwsrwlsczoje.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZGx6dGpkdndzcndsc2N6b2plIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njc5MTE1MSwiZXhwIjoyMDgyMzY3MTUxfQ.fl1GxEIj6BK5qpZte3z7HYUW3NWSwPQyYTFf6-38blY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  console.log('Checking users table structure...\n');
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1);
    
  if (error) {
    console.log('❌ Error:', error);
  } else {
    if (data && data.length > 0) {
      console.log('✅ Existing user columns:', Object.keys(data[0]));
      console.log('\nSample data:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('ℹ️ No users found, checking with empty insert...');
    }
  }
}

checkTable();
