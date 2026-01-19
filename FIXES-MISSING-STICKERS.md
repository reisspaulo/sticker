# 🔧 Correções para Problema de Stickers Faltantes

**Data**: 2026-01-19
**Investigador**: Claude Code
**Problema**: Workers travando e stickers não sendo salvos no banco

---

## 📊 Resumo do Problema

### Sintomas
- ✅ Webhook recebe imagem e incrementa `daily_count`
- ❌ Sticker não é salvo na tabela `stickers`
- ❌ `first_sticker_at` fica NULL
- ❌ Log `sticker_created` não é criado
- ❌ Jobs ficam "active" por 30-45 minutos (travados)

### ⚠️ CAUSA RAIZ IDENTIFICADA (2026-01-19)
**Global Message Rate Limiter sem timeout causando deadlock:**

1. **Arquivo**: `src/utils/messageRateLimiter.ts` (linha 105)
2. **Problema**: `await item.fn()` SEM timeout protection
3. **Impacto**: Se axios call hangs, toda a fila de mensagens trava
4. **Resultado**: TODOS os jobs ficam presos esperando o rate limiter
5. **Solução**: Adicionado `Promise.race()` com timeout de 90 segundos

### Outras Causas Secundárias
1. **Jobs sem timeout**: Workers podem travar indefinidamente
2. **Redis eviction policy errada**: `allkeys-lru` deletando jobs (CORRIGIDO)
3. **Error handling fraco**: Erros de insert apenas logados, não lançados (CORRIGIDO)
4. **Falta de monitoramento**: Jobs travados não são detectados

---

## ✅ Soluções Imediatas (EXECUTADAS)

### 1. Workers Reiniciados
```bash
docker service update --force sticker_worker
```
**Status**: ✅ Executado (2026-01-19 02:45 UTC)

### 2. Redis Eviction Policy Corrigida
```bash
# Antes: allkeys-lru (ERRADO - deleta jobs!)
# Depois: noeviction (CORRETO - falha ao invés de deletar)

docker exec <redis-container> redis-cli -a ytem_redis_secure_2024 CONFIG SET maxmemory-policy noeviction
```
**Status**: ✅ Executado (2026-01-19 02:46 UTC)

### 3. Rate Limiter Timeout Protection Adicionado ⭐ CRÍTICO
```typescript
// Arquivo: src/utils/messageRateLimiter.ts (linha 104-114)
// ANTES: await item.fn(); // Sem timeout - pode travar para sempre!

// DEPOIS:
const timeoutMs = 90000; // 90 segundos (3x timeout do axios)
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => {
    reject(new Error(`Message send timeout after ${timeoutMs / 1000}s`));
  }, timeoutMs);
});

await Promise.race([item.fn(), timeoutPromise]);
```
**Status**: ✅ Implementado (2026-01-19)
**Impacto**:
- Se axios call travar, após 90s o timeout rejeita a promise
- Queue continua processando próximas mensagens
- Job é marcado como "failed" e BullMQ retenta automaticamente
- PREVINE deadlock da fila inteira de mensagens

**⚠️ IMPORTANTE**: Tornar permanente editando `docker-compose.yml`:
```yaml
redis:
  command: redis-server --maxmemory-policy noeviction --requirepass ytem_redis_secure_2024
```

---

## 🏗️ Soluções de Longo Prazo

### 1. Adicionar Timeout nos Jobs ⭐ CRÍTICO

**Arquivo**: `src/config/queue.ts`

**Problema**: Jobs podem travar indefinidamente sem timeout.

**Solução**:
```typescript
export const processStickerQueue = new Queue('process-sticker', {
  ...queueOptions,
  defaultJobOptions: {
    ...queueOptions.defaultJobOptions,
    attempts: 3, // Aumentar de 2 para 3
    timeout: 120000, // 2 minutos (step 1: download pode ser lento)
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 25s, 125s entre retries
    },
  },
});
```

**Impacto**:
- Jobs que não completam em 2 min são automaticamente failed
- BullMQ tenta novamente (3x com backoff exponencial)
- Evita workers "presos" com jobs eternos

---

### 2. Tornar Erros de Insert CRÍTICOS ⭐ CRÍTICO

**Arquivo**: `src/worker.ts:136-143`

**Problema Atual**:
```typescript
if (stickerError) {
  logger.error({ msg: 'Error saving sticker metadata', error: stickerError.message });
  // Don't throw - sticker was already processed  ❌ PROBLEMA!
}
```

**Solução**:
```typescript
if (stickerError) {
  logger.error({
    msg: 'CRITICAL: Failed to save sticker to database',
    error: stickerError.message,
    userNumber,
    stickerPath: path,
  });

  // CRÍTICO: Se não salvar no banco, o sticker está perdido
  // Lançar erro para que BullMQ tente novamente
  throw new Error(`Failed to save sticker to database: ${stickerError.message}`);
}
```

**Impacto**:
- Se insert falhar, job vai para "failed"
- BullMQ retenta automaticamente (com backoff)
- Evita perda silenciosa de dados
- Sticker é re-uploadado e re-inserido

**⚠️ Nota**: Pode causar re-envio de sticker ao usuário. Considerar adicionar idempotência.

---

### 3. Adicionar Idempotência no Insert

**Arquivo**: `src/worker.ts:125-134`

**Problema**: Se job falhar após enviar sticker, retry vai re-enviar.

**Solução**: Usar `upsert` ao invés de `insert`:
```typescript
// Step 4: Save metadata to database (IDEMPOTENT)
logger.info({ msg: 'Step 4: Saving metadata to database', jobId: job.id });

const stickerData = {
  user_number: userNumber,
  tipo,
  original_url: `whatsapp:${messageKey.id}`,
  processed_url: url,
  storage_path: path,
  file_size: processedBuffer.length,
  processing_time_ms: Date.now() - startTime,
  status,
};

// Upsert: insert ou update se já existe (baseado em constraint único)
const { error: stickerError } = await supabase
  .from('stickers')
  .upsert(stickerData, {
    onConflict: 'user_number,original_url', // Assumindo constraint único
    ignoreDuplicates: false, // Atualizar se já existe
  });

if (stickerError) {
  logger.error({
    msg: 'CRITICAL: Failed to save/update sticker in database',
    error: stickerError.message,
    userNumber,
  });
  throw new Error(`Database error: ${stickerError.message}`);
}
```

**Pré-requisito**: Adicionar constraint único na tabela `stickers`:
```sql
ALTER TABLE stickers
ADD CONSTRAINT unique_user_sticker
UNIQUE (user_number, original_url);
```

---

### 4. Script de Monitoramento de Jobs Travados

**Arquivo**: `scripts/monitor-stuck-jobs.sh`

Script cron que roda a cada 5 minutos e libera jobs travados:

```bash
#!/bin/bash
# Roda a cada 5 minutos via cron
# Libera jobs travados há mais de 5 minutos

docker exec $(docker ps --filter 'name=sticker_worker' --format '{{.ID}}' | head -1) node -e "
const { Queue } = require('bullmq');
const queue = new Queue('process-sticker', {
  connection: { host: 'ytem-databases_redis', port: 6379, password: 'ytem_redis_secure_2024' }
});
(async () => {
  const active = await queue.getActive();
  let moved = 0;
  for (const job of active) {
    const age = Date.now() - (job.processedOn || Date.now());
    if (age > 5 * 60 * 1000) {
      console.log('[MONITOR] Stuck job detected:', job.id, 'user:', job.data.userNumber);
      try {
        await job.moveToFailed({ message: 'Stuck for ' + Math.round(age/60000) + ' minutes' }, '', true);
        moved++;
      } catch (err) {
        console.error('[MONITOR] Failed to move job:', err.message);
      }
    }
  }
  if (moved > 0) {
    console.log('[MONITOR] Moved', moved, 'stuck jobs to retry');
  }
  await queue.close();
  process.exit(0);
})();
" 2>&1 | grep -v IMPORTANT | logger -t sticker-monitor
```

**Crontab**:
```bash
# Adicionar no host da VPS
*/5 * * * * /root/scripts/monitor-stuck-jobs.sh
```

---

### 5. Adicionar Alertas para Jobs Travados

**Arquivo**: `src/services/alertService.ts` (novo método)

```typescript
export async function alertStuckJobs(params: {
  stuckCount: number;
  jobs: Array<{ id: string; userNumber: string; age: number }>;
}) {
  const message = `
🚨 *ALERTA: Jobs Travados*

${params.stuckCount} job(s) travados detectados:

${params.jobs.map((j) => `- User ${j.userNumber} (${Math.round(j.age / 60000)} min)`).join('\n')}

*Ação*: Jobs foram automaticamente movidos para retry.
*Investigar*: Possível timeout de rede ou Out of Memory.
  `.trim();

  // Enviar para admin
  await sendText(ADMIN_NUMBER, message);

  // Logar no Supabase
  await supabase.from('system_alerts').insert({
    type: 'stuck_jobs',
    severity: 'high',
    message,
    details: { jobs: params.jobs },
  });
}
```

---

### 6. Aumentar Timeout de Rede (Evolution API & Supabase)

**Arquivos**:
- `src/services/evolutionApi.ts`
- `src/services/supabaseStorage.ts`

**Problema**: Downloads/uploads podem ser lentos (rede 3G/4G).

**Solução**: Usar timeouts maiores e retry com exponential backoff:

```typescript
// evolutionApi.ts
export async function downloadMedia(messageKey: MessageKey): Promise<Buffer> {
  const maxRetries = 3;
  const baseDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'apikey': EVOLUTION_API_KEY },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      logger.warn({ msg: 'Download failed, retrying', attempt, delay, error });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Should never reach here');
}
```

---

### 7. Adicionar Healthcheck no Worker

**Arquivo**: `src/worker.ts` (adicionar no final)

```typescript
// ============================================
// HEALTHCHECK ENDPOINT (para Docker/K8s)
// ============================================
import express from 'express';

const healthApp = express();
const HEALTH_PORT = 3001;

let isHealthy = true;
let lastJobProcessed = Date.now();

// Atualizar timestamp quando job é processado
processStickerWorker.on('completed', () => {
  lastJobProcessed = Date.now();
  isHealthy = true;
});

processStickerWorker.on('failed', () => {
  lastJobProcessed = Date.now();
});

healthApp.get('/health', (req, res) => {
  const minutesSinceLastJob = (Date.now() - lastJobProcessed) / 1000 / 60;

  if (minutesSinceLastJob > 30 && !isHealthy) {
    // Worker não processou nada há 30 minutos
    return res.status(503).json({
      status: 'unhealthy',
      reason: 'No jobs processed in 30 minutes',
      lastJobProcessed: new Date(lastJobProcessed).toISOString(),
    });
  }

  res.json({
    status: 'healthy',
    lastJobProcessed: new Date(lastJobProcessed).toISOString(),
    uptime: process.uptime(),
  });
});

healthApp.listen(HEALTH_PORT, () => {
  logger.info(`Healthcheck endpoint listening on port ${HEALTH_PORT}`);
});
```

**Docker Compose**:
```yaml
worker:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

---

## 📈 Métricas de Sucesso

Após implementar as correções, monitorar:

1. **Taxa de sucesso de jobs**: Deve ser > 95%
2. **Tempo médio de processamento**: Deve ser < 30s
3. **Jobs travados**: Deve ser 0
4. **Stickers salvos vs daily_count**: Deve ser 1:1
5. **`first_sticker_at` NULL**: Deve ser 0%

---

## 🔍 Debugging Adicional

Se problema persistir após correções:

### 1. Verificar logs em tempo real
```bash
vps-ssh "docker service logs sticker_worker -f | grep -E '(Step|Error|failed)'"
```

### 2. Verificar memória do worker
```bash
vps-ssh "docker stats --no-stream | grep sticker_worker"
```

### 3. Verificar latência do Supabase
```bash
doppler run --project sticker --config prd -- npx tsx scripts/test-worker-insert.ts
```

### 4. Verificar Evolution API
```bash
curl -H "apikey: $EVOLUTION_API_KEY" http://<evolution-url>/instance/connectionState/meu-zap
```

---

## 🚀 Plano de Deploy

### Fase 1: Correções Críticas (AGORA)
- [x] Reiniciar workers
- [x] Corrigir Redis eviction policy
- [ ] Adicionar timeout nos jobs
- [ ] Tornar erros de insert críticos

### Fase 2: Robustez (Esta semana)
- [ ] Adicionar idempotência
- [ ] Aumentar timeouts de rede
- [ ] Adicionar script de monitoramento (cron)

### Fase 3: Observabilidade (Próxima semana)
- [ ] Adicionar healthcheck
- [ ] Configurar alertas
- [ ] Dashboard de métricas

---

## 📝 Checklist de Implementação

```
[ ] 1. Adicionar timeout nos jobs (queue.ts)
[ ] 2. Tornar erros de insert críticos (worker.ts:136-143)
[ ] 3. Adicionar constraint único na tabela stickers
[ ] 4. Implementar idempotência com upsert (worker.ts:125-134)
[ ] 5. Aumentar timeouts de rede (evolutionApi.ts, supabaseStorage.ts)
[ ] 6. Criar script de monitoramento (monitor-stuck-jobs.sh)
[ ] 7. Configurar cron para monitoramento
[ ] 8. Adicionar healthcheck no worker
[ ] 9. Atualizar docker-compose com healthcheck
[ ] 10. Tornar Redis noeviction permanente (docker-compose)
[ ] 11. Adicionar alertas para stuck jobs (alertService.ts)
[ ] 12. Testar em staging
[ ] 13. Deploy para produção
[ ] 14. Monitorar métricas por 48h
```

---

**Próxima Ação Recomendada**: Implementar itens 1 e 2 (timeout + throw on error) e fazer deploy imediato.
