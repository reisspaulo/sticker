#!/usr/bin/env tsx
/**
 * Libera jobs travados na fila do BullMQ
 * Jobs que ficam "active" por muito tempo (> 5 minutos) são movidos para "failed"
 */

import 'dotenv/config';
import { Queue } from 'bullmq';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

const redisConnection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
};

const MAX_PROCESSING_TIME_MS = 5 * 60 * 1000; // 5 minutos

async function fixStuckJobs() {
  console.log('\n🔧 LIBERANDO JOBS TRAVADOS\n');
  console.log('='.repeat(80));
  console.log('');

  const queue = new Queue('process-sticker', { connection: redisConnection });

  try {
    // Buscar jobs ativos
    const activeJobs = await queue.getActive();

    console.log(`📊 Encontrados ${activeJobs.length} jobs ativos\n`);

    let stuckCount = 0;
    let movedCount = 0;

    for (const job of activeJobs) {
      const processingTime = Date.now() - (job.processedOn || Date.now());
      const processingMinutes = Math.round(processingTime / 1000 / 60);

      if (processingTime > MAX_PROCESSING_TIME_MS) {
        stuckCount++;

        console.log(`🔴 Job TRAVADO detectado:`);
        console.log(`   ID: ${job.id}`);
        console.log(`   Usuário: ${job.data.userNumber}`);
        console.log(`   Tipo: ${job.data.messageType}`);
        console.log(`   Processando há: ${processingMinutes} minutos`);
        console.log(`   Tentativas: ${job.attemptsMade}`);
        console.log('');

        // Mover para failed
        try {
          await job.moveToFailed(
            {
              message: `Job stuck for ${processingMinutes} minutes - auto-failed by cleanup script`,
            },
            job.token || '',
            true
          );

          movedCount++;
          console.log(`   ✅ Movido para "failed" - será retentado automaticamente\n`);
        } catch (err) {
          console.log(`   ❌ Erro ao mover: ${err}\n`);
        }
      } else {
        const remainingTime = MAX_PROCESSING_TIME_MS - processingTime;
        const remainingMinutes = Math.round(remainingTime / 1000 / 60);

        console.log(`✅ Job processando normalmente:`);
        console.log(`   ID: ${job.id}`);
        console.log(`   Usuário: ${job.data.userNumber}`);
        console.log(`   Processando há: ${processingMinutes} minuto(s)`);
        console.log(`   Tempo restante antes de travar: ${remainingMinutes} minuto(s)\n`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('📊 RESUMO');
    console.log('='.repeat(80));
    console.log(`   Total de jobs ativos: ${activeJobs.length}`);
    console.log(`   Jobs travados encontrados: ${stuckCount}`);
    console.log(`   Jobs movidos para retry: ${movedCount}`);
    console.log('');

    if (movedCount > 0) {
      console.log('✅ Jobs liberados! BullMQ vai retentá-los automaticamente.');
      console.log('   Aguarde alguns segundos e verifique os logs do worker.');
    } else if (stuckCount === 0) {
      console.log('✅ Nenhum job travado encontrado. Tudo funcionando bem!');
    } else {
      console.log('⚠️  Alguns jobs não puderam ser movidos. Verifique os erros acima.');
    }

    console.log('');

    await queue.close();
  } catch (error) {
    console.error('❌ Erro ao processar jobs:', error);
    await queue.close();
    process.exit(1);
  }
}

fixStuckJobs();
