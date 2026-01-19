import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function investigateUsers() {
  const phones = ['553398030035', '5517982298432'];
  const names = ['Vitoria', 'Heitor'];

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];
    const name = names[i];

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📱 Investigando: ${name} (${phone})`);
    console.log('='.repeat(80));

    // 1. Buscar usuário
    const { data: users, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('phone_number', phone);

    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
      continue;
    }

    if (!users || users.length === 0) {
      console.log('⚠️  Usuário não encontrado no banco');
      continue;
    }

    const user = users[0];
    console.log('\n👤 Dados do Usuário:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nome: ${user.display_name}`);
    console.log(`   Telefone: ${user.phone_number}`);
    console.log(`   Plan: ${user.subscription_tier || 'free'}`);
    console.log(`   Daily Count: ${user.daily_count}`);
    console.log(`   Total Stickers: ${user.total_stickers_created}`);
    console.log(`   Criado em: ${user.created_at}`);
    console.log(`   Última atividade: ${user.last_interaction_at}`);

    // 2. Buscar últimos logs de uso
    const { data: logs, error: logsError } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (logsError) {
      console.error('❌ Erro ao buscar logs:', logsError);
    } else {
      console.log(`\n📊 Últimos ${logs?.length || 0} eventos:`);
      logs?.forEach((log, idx) => {
        const time = new Date(log.created_at).toLocaleString('pt-BR');
        console.log(`   ${idx + 1}. [${time}] ${log.event_type}`);
        if (log.metadata) {
          const meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
          if (meta.error) console.log(`      ❌ Erro: ${meta.error}`);
          if (meta.message) console.log(`      💬 ${meta.message}`);
          if (meta.reason) console.log(`      ℹ️  ${meta.reason}`);
        }
      });
    }

    // 3. Buscar stickers criados
    const { data: stickers, error: stickersError } = await supabase
      .from('stickers')
      .select('id, tipo, created_at, file_size')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (stickersError) {
      console.error('❌ Erro ao buscar stickers:', stickersError);
    } else {
      console.log(`\n🎨 Últimos ${stickers?.length || 0} stickers:`);
      stickers?.forEach((s, idx) => {
        const time = new Date(s.created_at).toLocaleString('pt-BR');
        const size = (s.file_size / 1024).toFixed(1);
        console.log(`   ${idx + 1}. [${time}] ${s.tipo} (${size} KB)`);
      });
    }

    // 4. Buscar subscription ativa
    const { data: subs, error: subsError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (subsError) {
      console.error('❌ Erro ao buscar subscription:', subsError);
    } else if (subs && subs.length > 0) {
      const sub = subs[0];
      console.log('\n💳 Subscription:');
      console.log(`   Plan: ${sub.plan_type}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Válido até: ${sub.current_period_end}`);
    } else {
      console.log('\n💳 Subscription: Nenhuma ativa (plano FREE)');
    }
  }
}

investigateUsers().catch(console.error);
