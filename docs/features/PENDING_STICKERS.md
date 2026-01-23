# Sistema de Stickers Pendentes

## 📋 Visão Geral

Sistema automático para gerenciar e enviar stickers que não puderam ser enviados imediatamente devido ao limite diário do usuário.

---

## 🔄 Fluxo Completo

### 1. **Usuário Envia Imagem (Limite Atingido)**

**Localização:** `src/routes/webhook.ts:1172`

```typescript
status: !limitCheck.allowed ? 'pendente' : 'enviado'
```

**Quando acontece:**
- Usuário já atingiu limite diário (3 stickers grátis)
- Sistema marca sticker como `status='pendente'`

**Mensagem enviada ao usuário:**
```
📦 *Seu sticker foi salvo!*

Ele será enviado amanhã às 8h da manhã junto com os outros stickers pendentes.
```

**Localização da mensagem:** `src/services/messageService.ts:67`

---

### 2. **Sticker Salvo no Banco**

**Tabela:** `stickers`

```sql
INSERT INTO stickers (
  user_number,
  tipo,
  processed_url,
  storage_path,
  status  -- 'pendente'
)
```

**Localização:** `src/worker.ts:123`

---

### 3. **Scheduler Automático (8h da Manhã)**

**Configuração:** `src/jobs/index.ts:34-50`

```javascript
cron.schedule('0 8 * * *', async () => {
  await sendPendingStickersJob();
}, {
  timezone: 'America/Sao_Paulo'
});
```

**Quando roda:**
- ✅ Todo dia às **8:00 AM** (horário de São Paulo)
- ✅ Automático, não precisa intervenção manual

**O que faz:**
1. Busca TODOS os stickers com `status='pendente'`
2. Envia cada um (ordem FIFO - mais antigo primeiro)
3. Atualiza status para `status='enviado'`
4. Salva log completo em `pending_sticker_sends`

---

### 4. **Envio dos Stickers Pendentes**

**Função:** `sendPendingStickersJob()` em `src/jobs/sendPendingStickers.ts`

**Processo:**

```typescript
// 1. Busca todos os pendentes
SELECT * FROM stickers WHERE status='pendente' ORDER BY created_at ASC

// 2. Para cada sticker:
//    a) Cria log (status: 'attempting')
INSERT INTO pending_sticker_sends (sticker_id, status='attempting', ...)

//    b) Envia sticker silenciosamente
await sendSticker(userNumber, url)

//    c) Atualiza sticker
UPDATE stickers SET status='enviado' WHERE id=...

//    d) Atualiza log
UPDATE pending_sticker_sends SET status='sent', sent_at=NOW(), ...
```

**Logging completo:**
- ✅ Cada tentativa de envio registrada
- ✅ Número da tentativa (permite retry)
- ✅ Tempo de processamento
- ✅ Mensagens de erro detalhadas
- ✅ Worker que processou

---

## 📊 Tabela de Logging: `pending_sticker_sends`

### Estrutura

```sql
CREATE TABLE pending_sticker_sends (
  id UUID PRIMARY KEY,
  sticker_id UUID NOT NULL,           -- FK para stickers
  user_id UUID,                        -- FK para users
  user_number VARCHAR(20) NOT NULL,

  -- Tracking de tentativas
  attempt_number INTEGER DEFAULT 1,    -- 1, 2, 3... (retry)
  status VARCHAR(20),                  -- 'attempting', 'sent', 'failed'

  -- Resultado
  sent_at TIMESTAMPTZ,                 -- Quando foi enviado
  error_message TEXT,                  -- Se falhou, qual erro
  error_code VARCHAR(50),

  -- Métricas
  worker_id VARCHAR(100),              -- Qual worker processou
  processing_time_ms INTEGER,          -- Quanto tempo levou

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Consultas Úteis

**Ver todos os envios:**
```sql
SELECT
  user_number,
  COUNT(*) as stickers_sent,
  AVG(processing_time_ms) as avg_time_ms
FROM pending_sticker_sends
WHERE status = 'sent'
GROUP BY user_number;
```

**Ver tentativas falhadas:**
```sql
SELECT
  sticker_id,
  user_number,
  attempt_number,
  error_message,
  created_at
FROM pending_sticker_sends
WHERE status = 'failed'
ORDER BY created_at DESC;
```

**Ver último job executado:**
```sql
SELECT
  MIN(created_at) as started_at,
  MAX(sent_at) as finished_at,
  COUNT(*) as total_sent,
  AVG(processing_time_ms) as avg_time_ms
FROM pending_sticker_sends
WHERE DATE(created_at) = CURRENT_DATE;
```

---

## ⚙️ Execução Manual (Apenas Emergência!)

### ⚠️ **IMPORTANTE: Não executar fora do horário!**

```javascript
const { runJobManually } = require('./dist/jobs/index.js');

// ❌ NÃO FAZER ISSO fora das 8h da manhã!
await runJobManually('send-pending');

// ✅ Sistema vai avisar se não for 8h:
// "WARNING: Running send-pending job outside scheduled time (8:00 AM)!"
```

### Quando é aceitável executar manualmente:

1. **Teste em desenvolvimento** (não produção)
2. **Emergência** - sistema falhou às 8h e precisa reenviar
3. **Recuperação** - após corrigir bug que bloqueou envios

### Como executar corretamente:

```bash
# Via VPS (apenas emergência!)
vps-ssh "docker exec sticker_backend.1.<ID> node -e \"
const { runJobManually } = require('./dist/jobs/index.js');
runJobManually('send-pending').then(() => process.exit(0));
\""
```

---

## 🔍 Monitoramento

### Verificar se há stickers pendentes:

```sql
-- Quantos pendentes agora?
SELECT COUNT(*) FROM stickers WHERE status='pendente';

-- Quem está esperando?
SELECT
  user_number,
  COUNT(*) as pending_count,
  MIN(created_at) as oldest_sticker
FROM stickers
WHERE status='pendente'
GROUP BY user_number;
```

### Verificar último envio:

```sql
-- Quando foi o último job?
SELECT MAX(created_at) FROM pending_sticker_sends;

-- Quantos foram enviados hoje?
SELECT COUNT(*)
FROM pending_sticker_sends
WHERE DATE(created_at) = CURRENT_DATE;
```

---

## 🚨 Alertas

### Sistema de Alertas Automático

Se o job `send-pending` falhar:
- ✅ Alerta enviado via WhatsApp (5511999999999)
- ✅ Alerta enviado via Discord (se configurado)
- ✅ Log completo salvo

**Configuração:** `src/jobs/sendPendingStickers.ts:230`

```typescript
await alertWorkerFailure({
  service: 'send-pending-stickers',
  errorType: 'job_failure',
  errorMessage: error.message,
  additionalInfo: { totalProcessed, sent, failed }
});
```

---

## 📝 Logs

### Logs do Scheduler

```bash
# Ver logs do job automático
docker service logs sticker_backend | grep "send-pending"

# Ver apenas sucessos
docker service logs sticker_backend | grep "SEND-PENDING-JOB" | grep "completed"

# Ver apenas erros
docker service logs sticker_backend | grep "SEND-PENDING-JOB" | grep "error"
```

### Tags de Log

- `[SEND-PENDING-JOB]` - Job principal
- `[PENDING-WORKER]` - Worker alternativo (não usado atualmente)
- `[ALERT]` - Alertas de falha

---

## ✅ Validação e Testes

### Como validar que está funcionando:

**1. Verificar scheduler ativo:**
```bash
docker service logs sticker_backend | grep "Scheduled jobs initialized"
# Deve mostrar: send-pending-stickers, schedule: '0 8 * * *', time: '8:00 AM'
```

**2. Criar sticker pendente:**
- Usar conta de teste que já atingiu limite
- Enviar imagem
- Verificar mensagem: "Ele será enviado amanhã às 8h da manhã"
- Confirmar no banco: `SELECT * FROM stickers WHERE status='pendente' ORDER BY created_at DESC LIMIT 1`

**3. Aguardar 8h da manhã:**
- Job roda automaticamente
- Verificar logs: `docker service logs sticker_backend | grep "send-pending" | tail -50`
- Confirmar envio: `SELECT * FROM pending_sticker_sends WHERE DATE(created_at) = CURRENT_DATE`

**4. Verificar no WhatsApp:**
- Usuário deve receber sticker às 8h (silenciosamente, sem mensagem)

---

## 🐛 Troubleshooting

### Stickers não foram enviados às 8h

**Verificar:**
```sql
-- 1. Há stickers pendentes?
SELECT COUNT(*) FROM stickers WHERE status='pendente';

-- 2. Job rodou hoje?
SELECT COUNT(*) FROM pending_sticker_sends WHERE DATE(created_at) = CURRENT_DATE;

-- 3. Houve erros?
SELECT * FROM pending_sticker_sends WHERE status='failed' ORDER BY created_at DESC LIMIT 10;
```

**Soluções:**
- Verificar logs do backend: `docker service logs sticker_backend | grep ERROR`
- Verificar se scheduler está ativo
- Executar manualmente (apenas emergência): `runJobManually('send-pending')`

### Stickers sendo enviados fora de horário

**Causa provável:** Alguém executou `runJobManually('send-pending')` fora das 8h

**Prevenção:**
- Sistema agora avisa se executar fora do horário
- Evitar executar manualmente exceto em emergência

---

## 📊 Estatísticas

### Performance Esperada

- **Tempo por sticker:** ~1-3 segundos
- **Taxa de sucesso:** 100% (em condições normais)
- **Delay entre stickers:** 200ms (evitar rate limit)

### Exemplo de Job Bem-Sucedido

```json
{
  "msg": "Send pending stickers job completed",
  "totalProcessed": 28,
  "sent": 28,
  "failed": 0,
  "totalTimeMs": 68595,
  "successRate": "100.0%"
}
```

---

## 🔐 Segurança

### Proteções Implementadas

1. **RLS (Row Level Security)** na tabela `pending_sticker_sends`
2. **Service role** tem acesso completo
3. **Usuários** só veem seus próprios logs
4. **Warning** ao executar job fora de horário

### Políticas RLS

```sql
-- Service role full access
CREATE POLICY "Service role has full access to pending_sticker_sends"
  ON pending_sticker_sends FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users view own logs
CREATE POLICY "Users can view their own pending_sticker_sends"
  ON pending_sticker_sends FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

---

## 📅 Histórico

**Criado:** 2026-01-07
**Versão:** 1.0
**Última atualização:** 2026-01-07

**Commits:**
- `903aef8` - Implementação inicial com logging completo
- `2656aae` - Correção de colunas (processed_url, user_id lookup)
- `[próximo]` - Adicionar warning para execução manual

---

## 🎯 Próximos Passos (Opcional)

- [ ] Dashboard visual para `pending_sticker_sends`
- [ ] Endpoint API `/health/pending-stickers` para monitoramento
- [ ] Retry automático para stickers que falharam
- [ ] Notificação de resumo diário (quantos foram enviados)
- [ ] Métricas de performance agregadas

---

**IMPORTANTE:** Este sistema garante que **"isso não pode acontecer"** novamente - todos os stickers pendentes são enviados às 8h da manhã com rastreabilidade completa!
