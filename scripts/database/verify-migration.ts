import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';
const supabaseKey = 'YOUR_SUPABASE_SERVICE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('🔍 Verificando migration...\n');

  // 1. Check if subscriptions table exists
  console.log('1️⃣ Verificando tabela subscriptions...');
  const { data: subscriptions, error: subsError } = await supabase
    .from('subscriptions')
    .select('*')
    .limit(1);

  if (subsError) {
    console.error('❌ Erro ao acessar tabela subscriptions:', subsError.message);
  } else {
    console.log('✅ Tabela subscriptions existe!');
    console.log(`   Registros: ${subscriptions.length}`);
  }

  // 2. Check if users table has new columns
  console.log('\n2️⃣ Verificando colunas na tabela users...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, subscription_plan, subscription_status, subscription_ends_at')
    .limit(1);

  if (usersError) {
    console.error('❌ Erro ao acessar colunas de subscription:', usersError.message);
  } else {
    console.log('✅ Colunas de subscription existem na tabela users!');
    if (users && users.length > 0) {
      console.log('   Exemplo:', {
        subscription_plan: users[0].subscription_plan,
        subscription_status: users[0].subscription_status,
        subscription_ends_at: users[0].subscription_ends_at,
      });
    }
  }

  // 3. Test getUserLimits logic
  console.log('\n3️⃣ Testando lógica de limites...');
  if (users && users.length > 0) {
    const userId = users[0].id;

    // Import getUserLimits
    const { getUserLimits } = await import('../src/services/subscriptionService');
    const limits = await getUserLimits(userId);

    console.log('✅ Limites do usuário:', limits);
  }

  console.log('\n✅ Verificação completa!');
}

verifyMigration().catch(console.error);
