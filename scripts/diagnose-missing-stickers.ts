import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Redis connection
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = {
  host: redisUrl.includes('://') ? new URL(redisUrl).hostname : redisUrl.split(':')[0],
  port: redisUrl.includes('://')
    ? parseInt(new URL(redisUrl).port || '6379')
    : parseInt(redisUrl.split(':')[1] || '6379'),
  password: redisUrl.includes('://') ? new URL(redisUrl).password || undefined : undefined,
};

async function diagnose() {
  console.log('\n🔍 DIAGNÓSTICO DE STICKERS FALTANDO\n');
  console.log('=' .repeat(80));

  const phones = ['5511999999991', '5511999999992'];

  for (const phone of phones) {
    console.log(`\n📱 Investigando: ${phone}`);
    console.log('-'.repeat(80));

    // 1. Dados do usuário
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp_number', phone)
      .single();

    if (!user) {
      console.log('❌ Usuário não encontrado');
      continue;
    }

    console.log('\n👤 DADOS DO USUÁRIO:');
    console.log(`   Nome: ${user.name}`);
    console.log(`   Daily Count: ${user.daily_count}`);
    console.log(`   Daily Limit: ${user.daily_limit}`);
    console.log(`   Onboarding Step: ${user.onboarding_step}`);
    console.log(`   First Sticker At: ${user.first_sticker_at || 'NULL'}`);
    console.log(`   Created At: ${user.created_at}`);

    // 2. Contar stickers
    const { data: stickers, count: stickerCount } = await supabase
      .from('stickers')
      .select('*', { count: 'exact' })
      .eq('user_number', phone);

    console.log(`\n🎨 STICKERS NO BANCO: ${stickerCount || 0}`);
    if (stickers && stickers.length > 0) {
      stickers.forEach((s, idx) => {
        console.log(`   ${idx + 1}. ${s.tipo} - ${s.status} - ${s.created_at}`);
      });
    }

    // 3. Verificar usage_logs
    const { data: processingLogs } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_number', phone)
      .in('action', ['processing_started', 'sticker_created', 'processing_failed'])
      .order('created_at', { ascending: false });

    console.log(`\n📊 USAGE LOGS (processing):`)
    if (processingLogs && processingLogs.length > 0) {
      processingLogs.forEach((log) => {
        console.log(`   [${log.created_at}] ${log.action}`);
        if (log.details) {
          console.log(`      Details: ${JSON.stringify(log.details, null, 2)}`);
        }
      });
    } else {
      console.log('   ⚠️  Nenhum log de processing encontrado');
    }

    // 4. Verificar todos os logs recentes
    const { data: allLogs } = await supabase
      .from('usage_logs')
      .select('action, created_at')
      .eq('user_number', phone)
      .order('created_at', { ascending: false })
      .limit(20);

    console.log(`\n📝 ÚLTIMOS 20 LOGS (todas as ações):`);
    if (allLogs && allLogs.length > 0) {
      const grouped = allLogs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(grouped).forEach(([action, count]) => {
        console.log(`   ${action}: ${count}`);
      });
    }

    // 5. ANÁLISE
    console.log(`\n🔍 ANÁLISE:`);

    if (user.daily_count > 0 && stickerCount === 0) {
      console.log('   ⚠️  PROBLEMA IDENTIFICADO:');
      console.log('      - daily_count foi incrementado (webhook funcionou)');
      console.log('      - Mas nenhum sticker foi salvo no banco (worker falhou)');
      console.log('      - Possíveis causas:');
      console.log('        1. Worker nunca processou o job');
      console.log('        2. Worker crashou antes de salvar no banco');
      console.log('        3. Insert no banco falhou silenciosamente');
    }

    if (user.onboarding_step > 0 && !user.first_sticker_at) {
      console.log('   ⚠️  INCONSISTÊNCIA:');
      console.log('      - onboarding_step > 0 mas first_sticker_at é NULL');
      console.log('      - Isso indica que o worker não completou o processo');
    }
  }

  // 6. Verificar fila BullMQ
  console.log('\n\n📦 VERIFICANDO FILA BULLMQ\n');
  console.log('=' .repeat(80));

  try {
    const queue = new Queue('process-sticker', { connection: redisConnection });

    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const failed = await queue.getFailed();
    const delayed = await queue.getDelayed();

    console.log(`\n📊 STATUS DA FILA:`);
    console.log(`   Waiting: ${waiting.length}`);
    console.log(`   Active: ${active.length}`);
    console.log(`   Failed: ${failed.length}`);
    console.log(`   Delayed: ${delayed.length}`);

    // Procurar jobs dos nossos usuários
    const allJobs = [...waiting, ...active, ...failed, ...delayed];
    const relevantJobs = allJobs.filter((job) =>
      phones.includes(job.data.userNumber)
    );

    if (relevantJobs.length > 0) {
      console.log(`\n🔍 JOBS ENCONTRADOS PARA OS USUÁRIOS:`);
      relevantJobs.forEach((job) => {
        console.log(`\n   Job ID: ${job.id}`);
        console.log(`   Usuário: ${job.data.userNumber}`);
        console.log(`   Status: ${job.getState()}`);
        console.log(`   Tentativas: ${job.attemptsMade}/${job.opts.attempts || 3}`);
        if (job.failedReason) {
          console.log(`   Erro: ${job.failedReason}`);
        }
      });
    } else {
      console.log(`\n   ℹ️  Nenhum job encontrado para esses usuários na fila`);
    }

    await queue.close();
  } catch (error) {
    console.error('❌ Erro ao acessar fila BullMQ:', error);
  }

  // 7. RECOMENDAÇÕES
  console.log('\n\n💡 RECOMENDAÇÕES\n');
  console.log('=' .repeat(80));
  console.log(`
1. Se daily_count > 0 mas não há stickers:
   → O webhook incrementou mas o worker falhou
   → Verificar logs do worker para erros
   → Verificar se workers estão rodando

2. Se não há logs de "sticker_created":
   → logStickerCreated() nunca foi chamado
   → Worker crashou antes de completar
   → Verificar BullMQ para jobs falhados

3. Se first_sticker_at é NULL:
   → Update do first_sticker_at falhou
   → Pode ser erro silencioso no Supabase

4. Ação imediata:
   → Reiniciar workers: docker-compose restart worker
   → Verificar variáveis de ambiente (SUPABASE_URL, SUPABASE_SERVICE_KEY)
   → Verificar logs: docker logs sticker-worker-1 --tail 500
  `);
}

diagnose().catch(console.error);
