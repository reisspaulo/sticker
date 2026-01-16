# CRÍTICO: Análise de Burst de Webhooks e Risco de Spam

## Executive Summary

**🚨 DESCOBERTA CRÍTICA:** O sistema tem rate limiting **apenas em campanhas**, mas **NÃO nas respostas diretas do webhook**. Isso significa que picos de tráfego podem gerar centenas de mensagens instantâneas, caracterizando envio em massa para o WhatsApp.

**Status:** 🔴 **VULNERÁVEL** - Sem proteção contra bursts no webhook
**Risco:** 🔴 **ALTO** - Pode causar novo ban do WhatsApp
**Prioridade:** 🚨 **URGENTE** - Implementar rate limiting no webhook

---

## 1. Cenários de Risco Identificados

### 🔴 CENÁRIO 1: Flood de Novos Usuários (ALTO RISCO)

**Situação:** 100 pessoas descobrem o bot simultaneamente (ex: viralização, post em grupo grande)

**Fluxo atual:**
```typescript
// src/routes/webhook.ts:1869
if (user.onboarding_step === 0) {
  await sendText(userNumber, getWelcomeMessageForNewUser(userName, userLimit));
  // ↑ ENVIADO INSTANTANEAMENTE, SEM FILA
}
```

**O que acontece:**
1. 100 webhooks recebidos em <100ms
2. 100 calls para `sendText()` **em paralelo**
3. 100 requisições simultâneas para Evolution API
4. **Resultado:** 100 mensagens enviadas em <2 segundos

**Volume:**
| Tempo | Mensagens Enviadas |
|-------|-------------------|
| 0-2s | 100 (welcome) |
| 2-5s | 100 (onboarding step 1) |
| 5-10s | 100-200 (figurinhas processadas) |
| **TOTAL 10s** | **300-400 mensagens** |

**Por que é spam:**
- WhatsApp detecta 100+ mensagens em segundos
- Padrão de bot automatizado (todas mensagens idênticas)
- Sem intervalo entre envios

---

### 🔴 CENÁRIO 2: Spike de Confirmações de Pagamento (ALTO RISCO)

**Situação:** 50 usuários confirmam PIX ao mesmo tempo (promoção, Black Friday)

**Fluxo atual:**
```typescript
// src/routes/webhook.ts:280-300
if (interactive.id === 'button_confirm_pix') {
  const result = await activatePixSubscription(userNumber);

  if (result.success) {
    // INSTANTÂNEO - sem fila, sem delay
    await sendText(userNumber, getSubscriptionActivatedMessage(pending.plan));
  }
}
```

**O que acontece:**
1. 50 webhooks recebidos (clique no botão)
2. 50 calls para `sendText()` **em paralelo**
3. 50 confirmações instantâneas

**Volume:** 50 mensagens em <1 segundo

**Agravante:** Além da confirmação, cada ativação pode disparar:
- Welcome to premium (mais 1 mensagem)
- Unlock de features (mais 1-2 mensagens)
- **Total possível:** 150-200 mensagens em 5 segundos

---

### 🟡 CENÁRIO 3: Limite Diário Atingido (MÉDIO RISCO - PARCIALMENTE PROTEGIDO)

**Situação:** 100 usuários atingem limite diário ao mesmo tempo (horário de pico)

**Fluxo atual:**
```typescript
// src/routes/webhook.ts:2000-2018
const limitCheck = await checkAndIncrementDailyLimitAtomic(user.id);

if (!limitCheck.allowed) {
  let wasAlreadyNotified = await setLimitNotifiedAtomic(user.id);

  if (!wasAlreadyNotified) {
    await sendLimitReachedMessage(userNumber, userName, 0);
  }
}
```

**Proteção:** ✅ Atomic flag previne duplicatas (1 mensagem/usuário/dia)

**O que acontece:**
1. 100 usuários atingem limite
2. Atomic check: apenas PRIMEIRO por usuário envia
3. 100 mensagens enviadas (1 por usuário)

**Volume:** 100 mensagens, mas espaçadas (não todos ao mesmo tempo)

**Risco:** MÉDIO - Ainda são 100 mensagens rapidamente, mas não instantâneo

---

### 🔴 CENÁRIO 4: Usuários Brasileiros = DOBRO de Mensagens (ALTO RISCO)

**Situação:** Bot usa 2 APIs - Evolution (todos) + Avisa (brasileiros)

**Exemplo - Download de Twitter:**
```typescript
// src/worker.ts:559-598
if (downloadId) {
  // 1. Envia vídeo via Evolution API
  await sendSticker(userNumber, uploadResult.url);

  // 2. Envia botões via Avisa API (brasileiros)
  await sendButtons({
    number: userNumber,
    title: '🎨 *Quer transformar em figurinha?*',
    buttons: [
      { id: `button_convert_sticker_${downloadId}`, text: '✅ Sim, quero!' },
      { id: 'button_video_only', text: '⏭️ Só o vídeo' },
    ],
  });
}
```

**Volume duplicado:**
| Ação | Evolution API | Avisa API | Total |
|------|---------------|-----------|-------|
| 100 brasileiros baixam Twitter | 100 vídeos | 100 botões | **200 msgs** |
| 50 confirmam pagamento | 50 textos | 50 menus PIX | **100 msgs** |
| 100 novos usuários (BR) | 100 welcome | 100 onboarding | **200 msgs** |

**Impacto:** Usuários brasileiros geram **2x o volume** de mensagens

**Por que 2 APIs?**
- Evolution API: Mensagens básicas (texto, sticker, vídeo)
- Avisa API: Features interativas (botões, listas) - **apenas para brasileiros**

---

### 🟡 CENÁRIO 5: Processamento de Figurinhas (MÉDIO RISCO - PROTEGIDO)

**Situação:** 100 usuários enviam imagens para converter em figurinha

**Fluxo atual:**
```typescript
// src/worker.ts:277
const processStickerWorker = new Worker<ProcessStickerJobData>(
  'process-sticker',
  async (job) => { /* ... */ },
  {
    connection: redisConnection,
    concurrency: 5,  // ← APENAS 5 PARALELOS
  }
);
```

**Proteção:** ✅ BullMQ limita a 5 jobs simultâneos

**O que acontece:**
1. 100 imagens recebidas
2. Enfileiradas no Redis (BullMQ)
3. Worker processa 5 por vez
4. Cada figurinha leva ~5-15 segundos
5. 100 figurinhas = 3-5 minutos total

**Volume:** 5 mensagens/min (espaçadas), **NÃO** 100 instantâneas

**Risco:** BAIXO - Worker concurrency protege contra burst

---

## 2. Análise de Código: O Que Está Protegido vs Vulnerável

### ✅ O QUE ESTÁ PROTEGIDO (Rate Limiting Existente)

#### 1. Campanhas - MUITO BEM PROTEGIDO
```typescript
// src/services/campaignService.ts:323-413
export async function processPendingCampaignMessages(
  limit: number = 15,        // Máx 15 msgs por execução
  rateLimitMs: number = 3000 // 3 segundos entre cada
): Promise<{ sent: number; failed: number; total: number }> {

  for (const message of messages) {
    const success = await sendCampaignMessage(message);

    // Rate limiting
    if (rateLimitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, rateLimitMs));
      // ↑ AGUARDA 3 segundos antes da próxima
    }
  }
}
```

**Proteções:**
- ✅ Máximo 15 mensagens por job
- ✅ 3 segundos entre cada mensagem
- ✅ Worker serial (concurrency: 1)
- ✅ Job roda a cada 60 segundos

**Taxa efetiva:** ~20 mensagens/minuto (para TODAS as campanhas)

---

#### 2. Pending Stickers - PROTEGIDO
```typescript
// src/worker.ts:1051
await new Promise((resolve) => setTimeout(resolve, 200));
// ↑ 200ms entre cada figurinha pendente
```

**Proteção:** ✅ Delay de 200ms entre envios

---

#### 3. Worker Concurrency - PROTEGIDO
```typescript
// Limites de concorrência por worker
{
  'process-sticker': 5,          // 5 figurinhas simultâneas
  'download-twitter-video': 3,   // 3 downloads simultâneos
  'convert-twitter-sticker': 2,  // 2 conversões simultâneas
  'cleanup-sticker': 2,          // 2 cleanups simultâneos
}
```

**Proteção:** ✅ Workers não processam tudo ao mesmo tempo

---

#### 4. Duplicate Notifications - PROTEGIDO
```typescript
// src/routes/webhook.ts:2000
let wasAlreadyNotified = await setLimitNotifiedAtomic(user.id);

if (!wasAlreadyNotified) {
  await sendLimitReachedMessage(userNumber, userName, 0);
}
```

**Proteção:** ✅ Atomic flag previne mensagens duplicadas

---

### ❌ O QUE NÃO ESTÁ PROTEGIDO (SEM Rate Limiting)

#### 1. Webhook Endpoint - SEM RATE LIMITING
```typescript
// src/routes/webhook.ts:57-85
fastify.addHook('preHandler', async (request, reply) => {
  if (request.method === 'POST') {
    await validateApiKey(request, reply);  // ← APENAS API key check
    // ❌ SEM rate limiting por IP
    // ❌ SEM rate limiting por número de telefone
    // ❌ SEM rate limiting global
  }
});
```

**Vulnerabilidade:** Aceita 100+ webhooks instantaneamente

---

#### 2. Welcome Messages - SEM RATE LIMITING
```typescript
// src/routes/webhook.ts:1869
if (user.onboarding_step === 0) {
  await sendText(userNumber, getWelcomeMessageForNewUser(userName, userLimit));
  // ❌ SEM fila
  // ❌ SEM delay
  // ❌ SEM throttle
}
```

**Vulnerabilidade:** 100 novos usuários = 100 mensagens instantâneas

---

#### 3. Payment Confirmations - SEM RATE LIMITING
```typescript
// src/routes/webhook.ts:280-300
if (result.success) {
  await sendText(userNumber, getSubscriptionActivatedMessage(pending.plan));
  // ❌ SEM fila
  // ❌ SEM delay
  // ❌ SEM limite de confirmações/minuto
}
```

**Vulnerabilidade:** 50 confirmações = 50 mensagens instantâneas

---

#### 4. Edit Buttons (Avisa API) - SEM RATE LIMITING
```typescript
// src/worker.ts:590
await sendButtons({
  number: userNumber,
  title: '🎨 *Quer transformar em figurinha?*',
  buttons: [/* ... */],
});
// ❌ SEM delay entre botões
// ❌ SEM batching
```

**Vulnerabilidade:** Botões enviados imediatamente após figurinha

---

## 3. Comparação: Campanhas vs Webhook Responses

| Aspecto | Campanhas | Webhook Responses |
|---------|-----------|-------------------|
| **Rate Limiting** | ✅ 3s entre msgs | ❌ Nenhum |
| **Batch Size** | ✅ 15 msgs max | ❌ Ilimitado |
| **Queueing** | ✅ BullMQ | ❌ Direto |
| **Concurrency** | ✅ 1 serial | ❌ 100+ paralelo |
| **Backoff** | ✅ Exponencial | ❌ Nenhum |
| **Cooling-off** | ✅ 24h novos | ❌ Nenhum |
| **Auto-pause** | ✅ >50% falha | ❌ Nenhum |

**Conclusão:** Campanhas têm **7 camadas de proteção**, webhooks têm **0**.

---

## 4. Cálculo de Volume: Cenário Real de Crescimento

### Cenário: Bot Viraliza (1,000 novos usuários em 1 hora)

**Breakdown por minuto:**
| Minuto | Novos Usuários | Welcome | Onboarding | Figurinhas | Total/min |
|--------|----------------|---------|------------|------------|-----------|
| 0-10 | 500 | 500 | 500 | 200 | **1,200** |
| 10-20 | 300 | 300 | 300 | 400 | **1,000** |
| 20-30 | 150 | 150 | 150 | 500 | **800** |
| 30-60 | 50 | 50 | 50 | 300 | **400/30min** |

**Pico:** **1,200 mensagens nos primeiros 10 minutos**

**WhatsApp detecta:**
- 120 mensagens/minuto = 2 mensagens/segundo
- Padrão consistente (todas welcome messages idênticas)
- Múltiplas contas recebendo ao mesmo tempo
- **= COMPORTAMENTO DE BOT / SPAM**

---

### Cenário: Black Friday (200 pagamentos em 30 min)

**Breakdown:**
| Ação | Mensagens | APIs Usadas |
|------|-----------|-------------|
| Confirmações PIX | 200 | Evolution |
| Ativação premium | 200 | Evolution |
| Welcome to premium | 200 | Avisa (BR) |
| Unlock de features | 100 | Avisa (BR) |
| **TOTAL** | **700 msgs em 30min** | Evolution + Avisa |

**Taxa:** 23 mensagens/minuto

**Risco:** MÉDIO-ALTO (perto do limite de spam)

---

## 5. Comparação com Sprint 20 (Ban Anterior)

### Ban Anterior (Sprint 20):
```
CAUSA: Loop de retry de campanhas
VOLUME: 26,388 mensagens em 24h
TAXA: ~18 msgs/min (constante)
PADRÃO: Retry infinito para mesmos usuários
```

### Risco Atual (Webhook Burst):
```
CAUSA: Picos de tráfego sem rate limiting
VOLUME: 1,200+ msgs em 10 min (pico)
TAXA: 120 msgs/min (burst)
PADRÃO: Múltiplos destinatários simultâneos
```

**Comparação:**
| Métrica | Sprint 20 | Webhook Burst |
|---------|-----------|---------------|
| Volume total | 26k/24h | 1.2k/10min |
| Taxa média | 18/min | 120/min |
| **Taxa de pico** | 300/min | **600+/min** |
| Padrão | Retry loop | Welcome flood |
| Risco de ban | 🔴 Alto | 🔴 **MUITO ALTO** |

**Webhook burst é PIOR:** Taxa de pico 2x maior que campanhas descontroladas!

---

## 6. Proteções Implementadas (Sprint 20) NÃO Aplicam a Webhooks

### Sprint 20 protegeu:
1. ✅ Campanhas: backoff exponencial
2. ✅ Campanhas: rate limiting 3s
3. ✅ Campanhas: cooling-off 24h
4. ✅ Campanhas: limite de retries
5. ✅ Campanhas: auto-pause >50% falha
6. ✅ Monitoring: polling reduzido
7. ✅ Monitoring: timeout de 3min

### O que NÃO foi protegido:
1. ❌ Webhook: rate limiting de entrada
2. ❌ Webhook: throttling de respostas
3. ❌ Webhook: fila de mensagens diretas
4. ❌ Webhook: limite de mensagens/minuto
5. ❌ Dual API: batching de Evolution + Avisa

**Gap crítico:** Todas as proteções são para **campanhas agendadas**, mas **webhook responses são diretas**.

---

## 7. Soluções Recomendadas (URGENTE)

### 🚨 PRIORIDADE CRÍTICA (Implementar AGORA)

#### Solução 1: Rate Limiting no Webhook Endpoint
```typescript
// NOVO: Middleware de rate limiting
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 10,              // Máx 10 requisições
  timeWindow: '1 second', // Por segundo
  keyGenerator: (req) => {
    // Rate limit por número de telefone
    const body = req.body as WebhookPayload;
    return body.data?.key?.remoteJid || req.ip;
  },
  errorResponseBuilder: () => ({
    code: 429,
    error: 'Too Many Requests',
    message: 'Você está enviando mensagens muito rápido. Aguarde alguns segundos.',
  }),
});
```

**Impacto:**
- Limita 10 mensagens/seg por usuário
- Usuário recebe erro se exceder
- Previne flood de 100+ webhooks instantâneos

---

#### Solução 2: Queue de Welcome Messages
```typescript
// ANTES (direto, sem fila)
if (user.onboarding_step === 0) {
  await sendText(userNumber, getWelcomeMessageForNewUser(userName, userLimit));
}

// DEPOIS (enfileirado)
if (user.onboarding_step === 0) {
  await welcomeMessagesQueue.add(
    'send-welcome',
    { userNumber, userName, userLimit },
    {
      delay: Math.random() * 2000, // 0-2s randomizado
      removeOnComplete: true,
    }
  );
}
```

**Impacto:**
- Welcome messages enfileiradas
- Delay randomizado (0-2s)
- Evita burst de 100 mensagens simultâneas

---

#### Solução 3: Batching de Dual API (Evolution + Avisa)
```typescript
// ANTES (2 chamadas separadas)
await sendSticker(userNumber, url);  // Evolution API
await sendButtons(request);          // Avisa API

// DEPOIS (1 chamada combinada - se possível)
await sendStickerWithButtons(userNumber, url, buttons);
// OU ao menos adicionar delay:
await sendSticker(userNumber, url);
await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
await sendButtons(request);
```

**Impacto:**
- Reduz 50% do volume (2 msgs → 1 msg quando possível)
- Ou ao menos espaça as 2 mensagens com 1s de delay

---

#### Solução 4: Global Message Rate Limiter
```typescript
// NOVO: Rate limiter global (todas as mensagens)
class MessageRateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private readonly messagesPerMinute = 60; // 1 msg/seg global

  async send(sendFn: () => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(async () => {
        await sendFn();
        resolve();
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const sendFn = this.queue.shift();
      if (sendFn) {
        await sendFn();
        // Delay entre mensagens: 60000ms / 60 msgs = 1000ms
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.processing = false;
  }
}

// Usar em todos os sendText/sendButtons
const rateLimiter = new MessageRateLimiter();

await rateLimiter.send(() => sendText(userNumber, message));
```

**Impacto:**
- Limita taxa GLOBAL de envio
- Todas as mensagens passam por fila única
- Garante no máximo 60 msgs/min (1 msg/seg)

---

### 🟡 PRIORIDADE ALTA (Próxima Sprint)

#### Solução 5: Circuit Breaker para Evolution API
```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(sendText, {
  timeout: 3000,           // 3s timeout
  errorThresholdPercentage: 50, // 50% de erro = abre
  resetTimeout: 30000,     // 30s para tentar novamente
});

breaker.on('open', () => {
  logger.error({ msg: '[CIRCUIT BREAKER] Evolution API circuit opened - too many failures' });
});

// Usar circuit breaker em vez de sendText direto
await breaker.fire(userNumber, message);
```

**Impacto:**
- Detecta quando Evolution API está com problemas
- Para de enviar mensagens temporariamente
- Previne loop de erros (como Sprint 20)

---

#### Solução 6: Monitoring de Taxa de Envio
```typescript
// NOVO: Monitorar taxa de mensagens em tempo real
class MessageVolumeMonitor {
  private messageCount = 0;
  private resetInterval: NodeJS.Timeout;

  constructor() {
    // Reset counter a cada minuto
    this.resetInterval = setInterval(() => {
      logger.info({
        msg: '[MESSAGE VOLUME] Messages sent in last minute',
        count: this.messageCount,
      });

      // Alerta se > 100 msgs/min
      if (this.messageCount > 100) {
        logger.warn({
          msg: '[MESSAGE VOLUME] HIGH VOLUME DETECTED',
          count: this.messageCount,
          threshold: 100,
        });
      }

      this.messageCount = 0;
    }, 60000);
  }

  increment(): void {
    this.messageCount++;
  }
}

// Usar em todos os envios
monitor.increment();
await sendText(userNumber, message);
```

**Impacto:**
- Visibilidade de volume em tempo real
- Alertas quando ultrapassar threshold
- Logs para análise pós-incident

---

### 🟢 PRIORIDADE MÉDIA (Melhorias)

#### Solução 7: Graceful Degradation (Modo Seguro)
```typescript
// Se taxa muito alta, entrar em "safe mode"
if (messageVolumeMonitor.getRate() > 100) {
  logger.warn({ msg: '[SAFE MODE] Entering safe mode - high message volume' });

  // Aumentar delays temporariamente
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5s em vez de 1s

  // Desabilitar features não-essenciais
  skipEditButtons = true;
  skipOnboardingMessages = true;
}
```

**Impacto:**
- Sistema auto-protege em picos
- Reduz features temporariamente
- Previne ban durante viralização

---

## 8. Plano de Implementação

### Fase 1: Emergencial (Esta Semana)
- [ ] Implementar rate limiting no webhook (10 req/seg)
- [ ] Queue de welcome messages (delay 0-2s)
- [ ] Global message rate limiter (60 msgs/min)
- [ ] Monitoring de volume em tempo real

**Tempo:** 2-3 dias
**Impacto:** Reduz 80% do risco de ban por burst

---

### Fase 2: Robustez (Próxima Semana)
- [ ] Circuit breaker para Evolution API
- [ ] Batching de dual API (Evolution + Avisa)
- [ ] Graceful degradation (safe mode)
- [ ] Dashboard de volume de mensagens

**Tempo:** 3-5 dias
**Impacto:** Sistema robusto para crescimento

---

### Fase 3: Otimização (Próximo Mês)
- [ ] Migrar para WhatsApp Business API oficial (se viável)
- [ ] Implementar priority queues (mensagens críticas first)
- [ ] A/B test de rate limits ideais
- [ ] Auto-scaling de workers baseado em volume

**Tempo:** 2-3 semanas
**Impacto:** Preparado para 10x crescimento

---

## 9. Métricas de Sucesso

### KPIs para Monitorar:

| Métrica | Threshold Seguro | Alerta | Crítico |
|---------|------------------|--------|---------|
| Msgs/minuto | <60 | 60-100 | >100 |
| Msgs/segundo (pico) | <10 | 10-20 | >20 |
| Webhook queue size | <50 | 50-200 | >200 |
| Evolution API errors | <5% | 5-10% | >10% |
| Response time | <500ms | 500ms-2s | >2s |

### Queries de Monitoramento:

```sql
-- 1. Volume de mensagens por minuto (últimas 24h)
SELECT
    DATE_TRUNC('minute', created_at) as minute,
    COUNT(*) as message_count,
    CASE
        WHEN COUNT(*) > 100 THEN 'CRITICAL'
        WHEN COUNT(*) > 60 THEN 'WARNING'
        ELSE 'OK'
    END as status
FROM usage_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND event_type IN ('sticker_sent', 'message_sent')
GROUP BY minute
ORDER BY minute DESC;

-- 2. Novos usuários por minuto (detectar viralização)
SELECT
    DATE_TRUNC('minute', created_at) as minute,
    COUNT(*) as new_users
FROM users
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY minute
HAVING COUNT(*) > 10  -- Alertar se >10 novos usuários/min
ORDER BY minute DESC;

-- 3. Taxa de erro da Evolution API
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) FILTER (WHERE success = false) as errors,
    COUNT(*) as total,
    ROUND(100.0 * COUNT(*) FILTER (WHERE success = false) / COUNT(*), 2) as error_rate
FROM api_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND api_name = 'evolution'
GROUP BY hour
HAVING ROUND(100.0 * COUNT(*) FILTER (WHERE success = false) / COUNT(*), 2) > 5
ORDER BY hour DESC;
```

---

## 10. Comparação: Antes vs Depois das Proteções

### Cenário: 100 Novos Usuários em 1 Minuto

| Aspecto | ANTES (Atual) | DEPOIS (Com Proteções) |
|---------|---------------|------------------------|
| **Webhooks aceitos** | 100 instant | 100 instant (rate limit 10/seg) |
| **Welcome messages** | 100 instant | Enfileiradas (0-2s delay) |
| **Taxa de envio** | 100 msgs/10s | 60 msgs/min (global limiter) |
| **Pico detectado** | ❌ Não | ✅ Sim (alerta) |
| **Dual API** | 200 msgs total | 100-150 msgs (batching) |
| **Risco de ban** | 🔴 ALTO | 🟢 BAIXO |

---

## 11. Lições Aprendidas & Recomendações

### ❌ Erros de Design Atuais:

1. **Webhook = Response Direta**
   - Webhook deveria apenas **enfileirar**, não **responder**
   - Resposta imediata = sem controle de taxa

2. **Dual API sem Coordenação**
   - Evolution + Avisa enviam independentemente
   - Dobra o volume sem necessidade

3. **Rate Limiting Apenas em Campanhas**
   - Campanhas protegidas, webhooks não
   - Inconsistência perigosa

4. **Sem Visibilidade de Volume**
   - Não sabemos quantas msgs/min em real-time
   - Só descobrimos problema após ban

### ✅ Princípios para Futuro:

1. **SEMPRE enfileirar mensagens diretas**
   - Welcome, confirmações, notificações → Queue
   - Nunca enviar direto do webhook

2. **SEMPRE limitar taxa global**
   - Não importa a origem (campanha, webhook, etc)
   - Global limit de 60 msgs/min

3. **SEMPRE monitorar volume em tempo real**
   - Dashboard com msgs/min
   - Alertas quando > 60 msgs/min

4. **SEMPRE coordenar múltiplas APIs**
   - Se usar Evolution + Avisa, batching quando possível
   - Ou ao menos delay de 1s entre chamadas

5. **SEMPRE ter graceful degradation**
   - Em picos, desabilitar features não-essenciais
   - Priorizar mensagens críticas

6. **SEMPRE simular crescimento**
   - Testar com 100, 500, 1000 usuários simultâneos
   - Load testing regular

---

## 12. Referências

### Documentos Relacionados:
- [SPRINT-20-ANTI-SPAM-PROTECTION.md](./SPRINT-20-ANTI-SPAM-PROTECTION.md) - Proteções de campanhas
- [INVESTIGATION-MONITORING-POLLING.md](./INVESTIGATION-MONITORING-POLLING.md) - Polling do admin
- [QUICK-CHANGES-GUIDE.md](../operations/QUICK-CHANGES-GUIDE.md) - Como deployar

### Recursos Externos:
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy) - Limites oficiais
- [Rate Limiting Patterns](https://cloud.google.com/architecture/rate-limiting-strategies-techniques) - Google Cloud
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html) - Martin Fowler
- [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit) - Fastify plugin

---

**Status:** 🔴 CRÍTICO - Implementação urgente necessária
**Próxima ação:** Implementar Fase 1 (rate limiting + queue)
**Revisão:** Após implementação, load test com 100 usuários simultâneos
