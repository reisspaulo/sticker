# Sistema de Monitoramento e Alertas

## 📊 Visão Geral

Sistema de alertas automáticos para detectar e notificar falhas críticas em tempo real, prevenindo outages prolongados.

## 🚨 Alertas Implementados

### 1. **RPC Failures (Crítico)**
**Quando dispara:**
- 5+ erros de RPC em 1 minuto
- Funções monitoradas:
  - `check_and_increment_daily_limit`
  - `set_limit_notified_atomic`

**Canais de notificação:**
- ✅ WhatsApp (admin: 5511946304133)
- ✅ Discord (se configurado: `DISCORD_WEBHOOK_URL`)

**Exemplo de alerta:**
```
🚨 ALERTA CRÍTICO - RPC FAILURE

⚠️ Serviço: atomicLimitService
🐛 Erro: check_and_increment_daily_limit
📝 Mensagem: column reference "daily_count" is ambiguous
🔢 Código: 42702
📊 Ocorrências: 12x no último minuto

⏰ Timestamp: 06/01/2026 18:30:45

🔥 AÇÃO NECESSÁRIA: Verificar logs e corrigir URGENTEMENTE!
```

### 2. **Worker Failures (Alerta)**
**Quando dispara:**
- 10+ erros de worker em 1 minuto

### 3. **API Failures (Alerta)**
**Quando dispara:**
- 20+ erros de API em 1 minuto

---

## 🔧 Thresholds Configurados

| Tipo | Threshold | Debounce | Ação |
|------|-----------|----------|------|
| RPC Errors | 5/min | 15min | WhatsApp + Discord |
| Worker Errors | 10/min | 15min | WhatsApp + Discord |
| API Errors | 20/min | 15min | WhatsApp + Discord |

**Debounce:** Após enviar um alerta, não envia novamente para o mesmo erro por 15 minutos (previne spam).

---

## 📡 Endpoints de Monitoramento

### 1. `GET /health/errors`
**Descrição:** Estatísticas de erros em tempo real

**Resposta:**
```json
{
  "timestamp": "2026-01-06T21:45:00.000Z",
  "errorStats": {
    "rpc_check_and_increment_daily_limit": {
      "count": 12,
      "firstError": "2026-01-06T21:44:30.000Z",
      "lastAlert": "2026-01-06T21:44:35.000Z"
    }
  },
  "totalErrorTypes": 1,
  "summary": {
    "activeErrors": 12,
    "errorTypes": ["rpc_check_and_increment_daily_limit"]
  }
}
```

### 2. `POST /health/errors/clear`
**Descrição:** Limpa contadores de erro (admin only)

**Headers:**
```
x-admin-token: <ADMIN_TOKEN>
```

**Resposta:**
```json
{
  "status": "ok",
  "message": "Error counters cleared successfully",
  "timestamp": "2026-01-06T21:45:00.000Z"
}
```

### 3. `GET /health`
**Descrição:** Status geral do sistema

**Resposta:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-06T21:45:00.000Z",
  "services": {
    "supabase": "ok",
    "redis": "ok"
  }
}
```

---

## 🔐 Variáveis de Ambiente

### Obrigatórias:
```bash
ADMIN_WHATSAPP=5511946304133  # WhatsApp do admin para alertas
EVOLUTION_API_URL=http://evolution_api:8080
EVOLUTION_API_KEY=xxx
```

### Opcionais:
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx  # Alertas no Discord
ADMIN_TOKEN=your-secret-token  # Para endpoints admin
```

---

## 🧪 Como Testar

### 1. **Simular falha de RPC (não recomendado em produção):**

```bash
# Quebrar temporariamente a função RPC
# (Apenas em ambiente de desenvolvimento)
psql -d $DATABASE_URL -c "DROP FUNCTION check_and_increment_daily_limit;"
```

### 2. **Enviar 6 imagens simultaneamente:**

Isso atingirá o threshold de 5 erros/min e disparará o alerta.

### 3. **Verificar estatísticas:**

```bash
curl https://stickers.ytem.com.br/health/errors
```

### 4. **Limpar contadores (após corrigir):**

```bash
curl -X POST https://stickers.ytem.com.br/health/errors/clear \
  -H "x-admin-token: $ADMIN_TOKEN"
```

---

## 📈 Monitoramento Contínuo

### Dashboard (futuramente):
- Grafana + Prometheus
- Visualização de error rates
- Alertas personalizados

### Logs:
Todos os alertas são logados com tag `[ALERT]`:

```bash
# Ver alertas disparados
docker service logs sticker_backend | grep "\[ALERT\]"
```

---

## 🛡️ Prevenções Implementadas

| Problema | Detecção | Tempo até alerta | Ação |
|----------|----------|------------------|------|
| RPC falha | 5 erros | ~30 segundos | WhatsApp + Discord |
| Worker trava | 10 erros | ~1 minuto | WhatsApp + Discord |
| API offline | 20 erros | ~1 minuto | WhatsApp + Discord |

---

## 🚀 Próximos Passos

- [ ] Adicionar Telegram como canal de alerta
- [ ] Email para alertas críticos
- [ ] Dashboard visual de monitoramento
- [ ] Alertas de recuperação automática
- [ ] PagerDuty integration
- [ ] Slack integration

---

## 📚 Arquitetura

```
┌─────────────┐
│ Webhook/API │
└──────┬──────┘
       │
       │ (Erro RPC)
       ▼
┌──────────────┐
│ alertService │
└──────┬───────┘
       │
       │ Threshold?
       │ Debounce?
       ▼
┌──────────────────┐
│ sendWhatsAppAlert│
│ sendDiscordAlert │
└──────────────────┘
       │
       ▼
   📱 Admin
```

---

**Criado:** 2026-01-06
**Versão:** 1.0
**Autor:** Claude Code
**Última atualização:** 2026-01-06
