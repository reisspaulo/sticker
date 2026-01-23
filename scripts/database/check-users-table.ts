import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const supabaseKey = 'YOUR_SUPABASE_SERVICE_KEY';

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
