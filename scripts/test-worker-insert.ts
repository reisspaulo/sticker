#!/usr/bin/env tsx
/**
 * Teste direto de insert no Supabase para simular o que o worker faz
 * Objetivo: Reproduzir o erro de insert que está causando perda de dados
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

console.log('\n🧪 TESTE DE INSERT NO SUPABASE (Simulando Worker)\n');
console.log('='.repeat(80));
console.log('');

// Verificar variáveis
console.log('📋 Configuração:');
console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Definida' : '❌ NÃO DEFINIDA'}`);
console.log(`   URL: ${supabaseUrl}`);
console.log(`   SERVICE_KEY: ${supabaseServiceKey ? '✅ Definida' : '❌ NÃO DEFINIDA'}`);
console.log(`   KEY (primeiros 30): ${supabaseServiceKey.substring(0, 30)}...`);
console.log('');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis não definidas!');
  console.error('   Execute: doppler run --project sticker --config prd -- npx tsx scripts/test-worker-insert.ts');
  process.exit(1);
}

// Criar cliente (EXATAMENTE como o worker faz em src/config/supabase.ts)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

console.log('✅ Cliente Supabase criado');
console.log('');

async function testInsert() {
  console.log('🎨 TESTE 1: Insert de Sticker (EXATAMENTE como worker faz)');
  console.log('-'.repeat(80));
  console.log('');

  // Simular dados do worker (linhas 125-134 de src/worker.ts)
  const testData = {
    user_number: '5511999999999', // Número de teste
    tipo: 'estatico' as const,
    original_url: 'whatsapp:test_message_id_12345',
    processed_url: 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co/storage/v1/object/public/stickers-estaticos/test.webp',
    storage_path: 'user_5511999999999/test_12345.webp',
    file_size: 45678,
    processing_time_ms: 1234,
    status: 'enviado' as const,
  };

  console.log('📦 Dados a inserir:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');

  const startTime = Date.now();

  console.log('⏳ Executando insert...');
  const { data, error: stickerError } = await supabase
    .from('stickers')
    .insert(testData)
    .select()
    .single();

  const duration = Date.now() - startTime;

  console.log('');
  console.log(`⏱️  Tempo: ${duration}ms`);
  console.log('');

  if (stickerError) {
    console.log('❌ ERRO AO INSERIR:');
    console.log('');
    console.log('   Mensagem:', stickerError.message);
    console.log('   Código:', stickerError.code);
    console.log('   Detalhes:', stickerError.details);
    console.log('   Hint:', stickerError.hint);
    console.log('');
    console.log('🔍 Objeto de erro completo:');
    console.log(JSON.stringify(stickerError, null, 2));
    console.log('');
    console.log('⚠️  ESTE É O PROBLEMA QUE ESTÁ CAUSANDO PERDA DE DADOS!');
    console.log('   O worker loga esse erro mas continua executando.');
    console.log('   Linha 136-143 de src/worker.ts');
    return false;
  } else {
    console.log('✅ INSERT BEM-SUCEDIDO!');
    console.log('');
    console.log('   ID:', data.id);
    console.log('   Criado em:', data.created_at);
    console.log('');

    // Limpar teste
    console.log('🧹 Limpando registro de teste...');
    const { error: deleteError } = await supabase
      .from('stickers')
      .delete()
      .eq('id', data.id);

    if (deleteError) {
      console.log('   ⚠️  Erro ao deletar:', deleteError.message);
    } else {
      console.log('   ✅ Registro removido');
    }

    return true;
  }
}

async function testFirstStickerUpdate() {
  console.log('');
  console.log('📅 TESTE 2: Update de first_sticker_at (linhas 146-163)');
  console.log('-'.repeat(80));
  console.log('');

  const testUserNumber = '5511999999999';

  // Tentar atualizar (vai falhar porque usuário não existe, mas é o comportamento esperado)
  console.log(`⏳ Tentando atualizar first_sticker_at para ${testUserNumber}...`);

  const { error: firstStickerError } = await supabase
    .from('users')
    .update({ first_sticker_at: new Date().toISOString() })
    .eq('whatsapp_number', testUserNumber)
    .is('first_sticker_at', null);

  console.log('');

  if (firstStickerError) {
    console.log('⚠️  Erro ao atualizar (esperado, usuário de teste não existe):');
    console.log('   Mensagem:', firstStickerError.message);
    console.log('   Código:', firstStickerError.code);
    console.log('');
    console.log('   ℹ️  Este erro é logado como warning no worker (linha 152-157)');
  } else {
    console.log('✅ Update executado (nenhuma linha afetada - usuário não existe)');
  }
}

async function testUsageLog() {
  console.log('');
  console.log('📊 TESTE 3: Insert em usage_logs (linhas 210-219 via logStickerCreated)');
  console.log('-'.repeat(80));
  console.log('');

  const testLog = {
    user_number: '5511999999999',
    action: 'sticker_created' as const,
    details: {
      user_name: 'Test User',
      message_type: 'image',
      file_size: 45678,
      processing_time_ms: 1234,
      tipo: 'estatico',
      status: 'enviado',
      storage_path: 'user_5511999999999/test.webp',
    },
    created_at: new Date().toISOString(),
  };

  console.log('📦 Dados do log:');
  console.log(JSON.stringify(testLog, null, 2));
  console.log('');

  console.log('⏳ Executando insert em usage_logs...');
  const startTime = Date.now();

  const { data, error } = await supabase
    .from('usage_logs')
    .insert(testLog)
    .select()
    .single();

  const duration = Date.now() - startTime;

  console.log('');
  console.log(`⏱️  Tempo: ${duration}ms`);
  console.log('');

  if (error) {
    console.log('❌ ERRO AO INSERIR LOG:');
    console.log('');
    console.log('   Mensagem:', error.message);
    console.log('   Código:', error.code);
    console.log('');
    console.log('🔍 Erro completo:');
    console.log(JSON.stringify(error, null, 2));
    console.log('');
    console.log('⚠️  PROBLEMA: Se este insert falhar, não há registro de auditoria!');
    console.log('   Código em src/services/usageLogs.ts:36-57');
    return false;
  } else {
    console.log('✅ LOG INSERIDO COM SUCESSO!');
    console.log('');
    console.log('   ID:', data.id);
    console.log('   Criado em:', data.created_at);
    console.log('');

    // Limpar teste
    console.log('🧹 Limpando log de teste...');
    const { error: deleteError } = await supabase
      .from('usage_logs')
      .delete()
      .eq('id', data.id);

    if (deleteError) {
      console.log('   ⚠️  Erro ao deletar:', deleteError.message);
    } else {
      console.log('   ✅ Log removido');
    }

    return true;
  }
}

async function testConnectionHealth() {
  console.log('');
  console.log('🏥 TESTE 4: Health Check da Conexão Supabase');
  console.log('-'.repeat(80));
  console.log('');

  console.log('⏳ Testando query simples...');
  const startTime = Date.now();

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  const duration = Date.now() - startTime;

  console.log('');
  console.log(`⏱️  Tempo de resposta: ${duration}ms`);
  console.log('');

  if (error) {
    console.log('❌ ERRO DE CONEXÃO:');
    console.log('   Mensagem:', error.message);
    console.log('   Código:', error.code);
    console.log('');
    console.log('🚨 PROBLEMA CRÍTICO: Worker não consegue conectar ao Supabase!');
    return false;
  } else {
    console.log('✅ Conexão OK!');
    console.log(`   Latência: ${duration}ms`);

    if (duration > 1000) {
      console.log('   ⚠️  LATÊNCIA ALTA! Pode causar timeouts.');
    } else if (duration > 500) {
      console.log('   ⚠️  Latência moderada');
    } else {
      console.log('   ✅ Latência baixa (ótimo)');
    }

    return true;
  }
}

async function runAllTests() {
  console.log('🚀 EXECUTANDO TODOS OS TESTES\n');

  const results = {
    insert: false,
    update: false,
    log: false,
    health: false,
  };

  // Teste 1: Insert de sticker
  try {
    results.insert = await testInsert();
  } catch (err) {
    console.log('💥 EXCEÇÃO NÃO CAPTURADA:');
    console.log(err);
  }

  // Teste 2: Update first_sticker_at
  try {
    await testFirstStickerUpdate();
    results.update = true; // Esse teste sempre passa (warning é esperado)
  } catch (err) {
    console.log('💥 EXCEÇÃO NÃO CAPTURADA:');
    console.log(err);
  }

  // Teste 3: Insert em usage_logs
  try {
    results.log = await testUsageLog();
  } catch (err) {
    console.log('💥 EXCEÇÃO NÃO CAPTURADA:');
    console.log(err);
  }

  // Teste 4: Health check
  try {
    results.health = await testConnectionHealth();
  } catch (err) {
    console.log('💥 EXCEÇÃO NÃO CAPTURADA:');
    console.log(err);
  }

  // Resumo final
  console.log('');
  console.log('');
  console.log('='.repeat(80));
  console.log('📊 RESUMO DOS TESTES');
  console.log('='.repeat(80));
  console.log('');

  console.log(`✅ Conexão Supabase: ${results.health ? 'OK' : 'FALHOU'}`);
  console.log(`${results.insert ? '✅' : '❌'} Insert em stickers: ${results.insert ? 'OK' : 'FALHOU'}`);
  console.log(`✅ Update first_sticker_at: OK (warning esperado)`);
  console.log(`${results.log ? '✅' : '❌'} Insert em usage_logs: ${results.log ? 'OK' : 'FALHOU'}`);
  console.log('');

  if (!results.health) {
    console.log('🚨 DIAGNÓSTICO: Problema de CONEXÃO com Supabase');
    console.log('   - Verificar SUPABASE_URL e SUPABASE_SERVICE_KEY');
    console.log('   - Verificar firewall/DNS');
    console.log('   - Verificar se Supabase está online');
  } else if (!results.insert || !results.log) {
    console.log('🚨 DIAGNÓSTICO: Problema de PERMISSÕES ou SCHEMA');
    console.log('   - Verificar RLS policies');
    console.log('   - Verificar constraints de tabela');
    console.log('   - Verificar se SERVICE_KEY tem permissões corretas');
  } else {
    console.log('✅ DIAGNÓSTICO: Configuração Supabase está CORRETA!');
    console.log('');
    console.log('   O problema NÃO está nas credenciais ou configuração.');
    console.log('   Possíveis causas:');
    console.log('   1. Worker crasha antes de completar o processamento');
    console.log('   2. Timeout de rede intermitente');
    console.log('   3. Out of Memory (OOM) matando o processo');
    console.log('');
    console.log('   Próximos passos:');
    console.log('   - Verificar logs do Docker para OOM kills');
    console.log('   - Adicionar retry logic com exponential backoff');
    console.log('   - Tornar erros de insert CRÍTICOS (throw error)');
  }

  console.log('');
  console.log('='.repeat(80));
}

runAllTests().catch((err) => {
  console.error('');
  console.error('💥 ERRO FATAL:');
  console.error(err);
  process.exit(1);
});
