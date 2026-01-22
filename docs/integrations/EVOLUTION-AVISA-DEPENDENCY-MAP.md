# Mapeamento Completo de Dependências: Evolution API + Avisa API → Z-API

**Data**: 2026-01-19
**Objetivo**: Migrar de 2 provedores (Evolution + Avisa) para 1 provedor único (Z-API)
**Status**: Mapeamento completo antes da implementação

---

## 📋 Índice

1. [Resumo Executivo](#resumo-executivo)
2. [Arquivos do Código](#arquivos-do-código)
3. [Endpoints Utilizados](#endpoints-utilizados)
4. [Banco de Dados](#banco-de-dados)
5. [Variáveis de Ambiente](#variáveis-de-ambiente)
6. [Webhooks](#webhooks)
7. [Jobs e Workers](#jobs-e-workers)
8. [Front-end/Admin](#front-end-admin)
9. [Payload Evolution vs Z-API](#payload-evolution-vs-z-api)
10. [Plano de Migração](#plano-de-migração)

---

## 1. Resumo Executivo

### Estado Atual
- **Evolution API**: Para stickers, textos, vídeos, download de mídia
- **Avisa API**: Para botões interativos, listas, botão PIX (apenas brasileiros)
- **Problema**: 2 dependências, 2 pontos de falha, 2 contratos

### Estado Futuro
- **Z-API**: Um único provedor com 100% de cobertura de features
- **Benefícios**:
  - Menos complexidade
  - Suporte 24/7 em português
  - Pagamento em reais
  - Botão PIX nativo

---

## 2. Arquivos do Código

### 2.1 Arquivos que Usam Evolution API (17 arquivos)

| Arquivo | Função | Dependência |
|---------|--------|-------------|
| `src/services/evolutionApi.ts` | **API client principal** | ⭐ CRÍTICO |
| `src/worker.ts` | Envia stickers processados | `sendSticker()` |
| `src/routes/webhook.ts` | Recebe eventos, envia respostas | `sendText()`, `sendVideo()` |
| `src/services/gifProcessor.ts` | Processa GIFs animados | `sendSticker()` |
| `src/services/stickerProcessor.ts` | Processa imagens estáticas | `sendSticker()` |
| `src/services/messageService.ts` | Envia mensagens de texto | `sendText()` |
| `src/services/stripeWebhook.ts` | Notifica confirmação de pagamento | `sendText()` |
| `src/services/onboardingService.ts` | Envia mensagens de boas-vindas | `sendText()` |
| `src/services/menuService.ts` | Envia menus e ajuda | `sendText()` |
| `src/services/sequenceService.ts` | Envia sequências automáticas | `sendText()` |
| `src/services/campaignService.ts` | Envia campanhas | `sendText()` |
| `src/jobs/sendPendingStickers.ts` | **Job diário** - Envia stickers pendentes | `sendSticker()` |
| `src/jobs/sendScheduledReminders.ts` | **Job cron** - Lembretes de pagamento | `sendText()` |
| `src/jobs/processSequenceSteps.ts` | **Job cron** - Sequências automáticas | `sendText()` |
| `src/jobs/activatePendingPixSubscription.ts` | **Job polling** - Ativa assinaturas PIX | `sendText()` |
| `src/middleware/auth.ts` | Valida API key do webhook | Usa `EVOLUTION_API_KEY` |
| `admin-panel/src/app/api/*/route.ts` | **Admin panel** - Vários endpoints | Lê logs de API |

### 2.2 Arquivos que Usam Avisa API (7 arquivos)

| Arquivo | Função | Dependência |
|---------|--------|-------------|
| `src/services/avisaApi.ts` | **API client principal** | ⭐ CRÍTICO |
| `src/services/menuService.ts` | Botões interativos e listas | `sendButtons()`, `sendList()` |
| `src/services/menuService.ts` | Botão PIX para pagamento | `sendPixButton()` |
| `src/services/onboardingService.ts` | Menu de boas-vindas (BR) | `sendButtons()` |
| `src/services/campaignService.ts` | Campanhas com botões | `sendButtons()` |
| `src/jobs/sendScheduledReminders.ts` | Lista de opções de pagamento | `sendList()` |
| `src/jobs/activatePendingPixSubscription.ts` | Botão PIX após confirmação | `sendPixButton()` |

### 2.3 Funções Críticas

#### evolutionApi.ts
```typescript
// FUNÇÕES QUE PRECISAM SER MIGRADAS:
- sendSticker(userNumber: string, stickerUrl: string)
- sendText(userNumber: string, text: string)
- sendVideo(userNumber: string, videoUrl: string, caption?: string)
- downloadMedia(messageKey: MessageKey): Promise<Buffer>
- checkConnection(): Promise<boolean>
```

#### avisaApi.ts
```typescript
// FUNÇÕES QUE PRECISAM SER MIGRADAS:
- isBrazilianNumber(phoneNumber: string): boolean
- sendButtons(request: SendButtonsRequest)
- sendList(request: SendListRequest)
- sendPixButton(request: SendPixButtonRequest)
- setWebhook(webhookUrl: string)
- getWebhook()
```

---

## 3. Endpoints Utilizados

### 3.1 Evolution API → Z-API

| Função | Endpoint Evolution | Endpoint Z-API | Mudanças |
|--------|-------------------|----------------|----------|
| Enviar sticker | `POST /message/sendSticker/{instance}` | `POST /send-sticker` | `number` → `phone` |
| Enviar texto | `POST /message/sendText/{instance}` | `POST /send-text` | `text` → `message` |
| Enviar vídeo | `POST /message/sendMedia/{instance}` | `POST /send-video` | `videoUrl` → `video` |
| Download mídia | `POST /chat/getBase64FromMediaMessage/{instance}` | N/A - URL direta no webhook | Não precisa download |
| Status conexão | `GET /instance/connectionState/{instance}` | `GET /status` | Resposta diferente |

### 3.2 Avisa API → Z-API

| Função | Endpoint Avisa | Endpoint Z-API | Mudanças |
|--------|---------------|----------------|----------|
| Botões interativos | `POST /actions/buttons` | `POST /send-button-actions` | Formato diferente |
| Lista interativa | `POST /actions/sendList` | `POST /send-option-list` | Estrutura diferente |
| Botão PIX | `POST /buttons/pix` | `POST /send-button-pix` | `number`→`phone`, `pix`→`pixKey`, adicionar `type` |

### 3.3 Headers de Autenticação

```typescript
// ANTES (Evolution):
headers: {
  'apikey': process.env.EVOLUTION_API_KEY
}

// ANTES (Avisa):
headers: {
  'Authorization': `Bearer ${process.env.AVISA_API_TOKEN}`
}

// DEPOIS (Z-API - unificado):
headers: {
  'Client-Token': process.env.Z_API_CLIENT_TOKEN,
  'Content-Type': 'application/json'
}
```

---

## 4. Banco de Dados

### 4.1 Tabelas Afetadas

#### `users` (tabela principal)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,

  -- Campos relacionados a API:
  daily_count INT DEFAULT 0,              -- Incrementado no webhook
  first_sticker_at TIMESTAMPTZ,           -- Definido no worker após sendSticker()
  last_interaction TIMESTAMPTZ,           -- Atualizado no webhook

  -- Assinaturas (afetam limites):
  subscription_plan TEXT DEFAULT 'free',  -- 'free' | 'premium' | 'ultra'
  subscription_status TEXT DEFAULT 'inactive',
  subscription_ends_at TIMESTAMPTZ,

  -- Twitter (usa sendVideo da Evolution):
  twitter_feature_used BOOLEAN DEFAULT FALSE,

  -- Campos de tempo:
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_reset_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `stickers` (armazena stickers enviados)
```sql
CREATE TABLE stickers (
  id UUID PRIMARY KEY,
  user_number VARCHAR(20) NOT NULL,
  tipo VARCHAR(10) NOT NULL,              -- 'estatico' | 'animado'

  -- URLs e storage:
  original_url TEXT NOT NULL,             -- WhatsApp message ID
  processed_url TEXT NOT NULL,            -- Supabase Storage URL
  storage_path TEXT NOT NULL,

  -- Envio via Evolution API:
  status VARCHAR(10) DEFAULT 'enviado',   -- 'enviado' | 'pendente'
  sent_at TIMESTAMPTZ,                    -- Quando sendSticker() foi chamado

  -- Métricas:
  file_size INT,
  processing_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES CRÍTICOS:
CREATE INDEX idx_stickers_user_number ON stickers(user_number);
CREATE INDEX idx_stickers_status ON stickers(status);
```

#### `pending_sticker_sends` (log de tentativas)
```sql
CREATE TABLE pending_sticker_sends (
  id UUID PRIMARY KEY,
  sticker_id UUID REFERENCES stickers(id),
  user_id UUID REFERENCES users(id),
  user_number VARCHAR(20) NOT NULL,

  -- Rastreamento:
  attempt_number INTEGER DEFAULT 1,
  status VARCHAR(20) NOT NULL,            -- 'attempting' | 'sent' | 'failed'

  -- Resultado:
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  error_code VARCHAR(50),

  -- Metadata:
  worker_id VARCHAR(100),
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `usage_logs` (auditoria de todas as APIs)
```sql
-- Tabela inferida do código (usageLogs.ts)
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY,
  user_number VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL,            -- Ver UsageAction type abaixo
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ações relacionadas às APIs:
-- 'sticker_sent'     - Logs de sendSticker()
-- 'message_sent'     - Logs de sendText()
-- 'menu_sent'        - Logs de sendButtons()/sendList()
-- 'pix_button_sent'  - Logs de sendPixButton()
```

#### `campaigns` e `user_campaigns` (campanhas automáticas)
```sql
-- Campanhas usam sendText() e sendButtons()/sendList()
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  campaign_type VARCHAR(50) NOT NULL,     -- 'drip' | 'event' | 'hybrid'
  status VARCHAR(20) DEFAULT 'draft',     -- 'draft' | 'active' | 'paused' | 'ended'

  -- Steps da campanha (JSON com mensagens e delays):
  steps JSONB NOT NULL,                   -- Cada step pode ter botões (Avisa API)

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_campaigns (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  campaign_id UUID REFERENCES campaigns(id),
  current_step INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  next_scheduled_at TIMESTAMPTZ
);
```

#### `twitter_downloads` (usa sendVideo)
```sql
-- Tabela inferida das migrations
CREATE TABLE twitter_downloads (
  id UUID PRIMARY KEY,
  user_number VARCHAR(20) NOT NULL,
  tweet_url TEXT NOT NULL,
  video_url TEXT,                         -- Enviado via sendVideo()
  status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Campos que Dependem de API Calls

| Tabela | Campo | Depende de | Função |
|--------|-------|------------|--------|
| `users` | `first_sticker_at` | Evolution API | Definido após `sendSticker()` bem-sucedido |
| `users` | `daily_count` | Webhook | Incrementado ao receber mensagem |
| `users` | `last_interaction` | Webhook | Atualizado ao receber mensagem |
| `stickers` | `status` | Evolution API | 'pendente' se `sendSticker()` falhar |
| `stickers` | `sent_at` | Evolution API | Timestamp de `sendSticker()` |
| `usage_logs` | `action` | Todas as APIs | Logs de cada chamada |
| `pending_sticker_sends` | `sent_at` | Evolution API | Timestamp de envio bem-sucedido |

---

## 5. Variáveis de Ambiente

### 5.1 Variáveis Atuais (Evolution + Avisa)

```bash
# Evolution API
EVOLUTION_API_URL=http://evolution_evolution_api:8080
EVOLUTION_API_KEY=YOUR_EVOLUTION_API_KEY
EVOLUTION_INSTANCE=meu-zap

# Avisa API
AVISA_API_URL=https://www.avisaapi.com.br/api
AVISA_API_TOKEN=ROm8VZyoVYWTBmJjHfANrV3Ls3vF5SwLuzonI7U68K6l40SfKUIOJkybF6iq
```

### 5.2 Variáveis Necessárias (Z-API)

```bash
# Z-API (substitui AMBAS as APIs acima)
Z_API_INSTANCE=3ECBB8EF0D54F1DC47CCEA71E5C779FD
Z_API_TOKEN=C510A0F9C0E015918EF628F0
Z_API_CLIENT_TOKEN=<obter_no_painel_z-api>
Z_API_BASE_URL=https://api.z-api.io
```

### 5.3 Locais que Precisam Ser Atualizados

| Arquivo/Local | Variáveis | Ação |
|---------------|-----------|------|
| `src/services/evolutionApi.ts` | `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` | ❌ Remover |
| `src/services/avisaApi.ts` | `AVISA_API_URL`, `AVISA_API_TOKEN` | ❌ Remover |
| `src/services/zapiApi.ts` | N/A | ✅ Criar (novo arquivo) |
| `.env.docker.example` | Todas | 🔄 Atualizar |
| `deploy/deploy-sticker.sh` | Todas | 🔄 Atualizar |
| `deploy/stack-sticker.yml` | Todas | 🔄 Atualizar |
| `.github/workflows/deploy-admin.yml` | Todas | 🔄 Atualizar |
| Doppler (secrets) | Todas | 🔄 Atualizar via CLI |

---

## 6. Webhooks

### 6.1 Webhook Atual (Evolution API)

**Endpoint configurado**: `https://seu-dominio.com/webhook`
**Handler**: `src/routes/webhook.ts`

**Payload Structure (Evolution API)**:
```typescript
interface WebhookPayload {
  instance: string;
  event: 'messages.upsert' | 'connection.update' | ...;
  data: {
    key: {
      remoteJid: string;              // Ex: "5511999999999@s.whatsapp.net"
      fromMe: boolean;
      id: string;                     // Message ID
    };
    message: {
      conversation?: string;          // Texto simples
      imageMessage?: {
        url: string;
        mimetype: string;
        caption?: string;
      };
      videoMessage?: { ... };
      stickerMessage?: { ... };

      // Interactive responses (via Avisa API):
      buttonsResponseMessage?: {
        selectedButtonId: string;
      };
      listResponseMessage?: {
        singleSelectReply: {
          selectedRowId: string;
        };
      };
    };
    messageType: string;
  };
}
```

### 6.2 Webhook Futuro (Z-API)

**Endpoint**: `https://seu-dominio.com/webhook/zapi` (novo endpoint)
**Handler**: `src/routes/webhookZapi.ts` (novo arquivo)

**Payload Structure (Z-API)**:
```typescript
interface ZAPIWebhookPayload {
  messageId: string;
  phone: string;                      // Ex: "5511999999999" (sem sufixo)
  fromMe: boolean;
  status: 'RECEIVED' | 'SENT' | 'READ' | ...;
  momment: number;                    // Unix timestamp
  type: 'ReceivedCallback';

  // Texto:
  text?: {
    message: string;
  };

  // Imagem:
  image?: {
    imageUrl: string;                 // URL DIRETA (não precisa download)
    caption?: string;
    mimeType: string;
  };

  // Vídeo:
  video?: {
    videoUrl: string;
    caption?: string;
    mimeType: string;
  };

  // Botão clicado:
  buttonsResponseMessage?: {
    selectedButtonId: string;
  };

  // Lista selecionada:
  listResponseMessage?: {
    singleSelectReply: {
      selectedRowId: string;
    };
  };
}
```

### 6.3 Mudanças no Webhook Handler

| Campo | Evolution API | Z-API | Conversão Necessária |
|-------|---------------|-------|---------------------|
| User ID | `data.key.remoteJid` | `phone` | Remover `@s.whatsapp.net` |
| Message ID | `data.key.id` | `messageId` | Renomear campo |
| From self | `data.key.fromMe` | `fromMe` | Já compatível ✅ |
| Texto | `data.message.conversation` | `text.message` | Acessar campo diferente |
| Imagem URL | Precisa download | `image.imageUrl` | URL direta ✅ |
| Timestamp | `data.messageTimestamp` | `momment` | Renomear |

### 6.4 Configuração do Webhook

```bash
# Evolution API (webhook configurado via dashboard)
# N/A - manual

# Z-API (webhook configurado via API)
curl -X PUT "https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/update-every-webhooks" \
  -H "Client-Token: ${Z_API_CLIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"value": "https://seu-dominio.com/webhook/zapi"}'
```

---

## 7. Jobs e Workers

### 7.1 Jobs que Usam Evolution API

| Job | Arquivo | Função API | Quando Roda | Impacto |
|-----|---------|-----------|-------------|---------|
| **process-sticker** | `src/worker.ts` | `sendSticker()` | Assíncrono (BullMQ) | ⭐ CRÍTICO |
| **send-pending-stickers** | `src/jobs/sendPendingStickers.ts` | `sendSticker()` | Cron: `*/5 * * * *` (5 min) | Alto |
| **send-scheduled-reminders** | `src/jobs/sendScheduledReminders.ts` | `sendText()` | Cron: `*/1 * * * *` (1 min) | Alto |
| **process-sequence-steps** | `src/jobs/processSequenceSteps.ts` | `sendText()` | Cron: `*/1 * * * *` (1 min) | Médio |
| **activate-pending-pix** | `src/jobs/activatePendingPixSubscription.ts` | `sendText()` | Polling: 30s | Alto |

### 7.2 Jobs que Usam Avisa API

| Job | Arquivo | Função API | Quando Roda | Impacto |
|-----|---------|-----------|-------------|---------|
| **send-scheduled-reminders** | `src/jobs/sendScheduledReminders.ts` | `sendList()` | Cron: `*/1 * * * *` (1 min) | Alto |
| **activate-pending-pix** | `src/jobs/activatePendingPixSubscription.ts` | `sendPixButton()` | Polling: 30s | Alto |

### 7.3 Worker Principal (BullMQ)

**Arquivo**: `src/worker.ts`

**Fluxo Atual**:
```
1. Recebe job do Redis (via BullMQ)
2. Processa imagem → sticker (Sharp/ffmpeg)
3. Upload para Supabase Storage
4. ❗ sendSticker() via Evolution API  ← PONTO DE FALHA
5. Salva metadata no banco (stickers table)
6. Logs (usage_logs)
```

**Problema**: Se Evolution API falhar no step 4, sticker não é salvo (step 5 nunca acontece).

**Solução Z-API**: Mesma lógica, apenas trocar chamada de API.

---

## 8. Front-end/Admin

### 8.1 Admin Panel Queries

**Pasta**: `admin-panel/src/app/api/`

O admin panel NÃO chama as APIs diretamente. Ele apenas:
- Lê dados do Supabase (tabelas `users`, `stickers`, `usage_logs`)
- Exibe métricas (taxa de sucesso, latência, etc.)

**Impacto da migração**: ✅ **ZERO** - Admin apenas lê dados do banco.

### 8.2 Tabelas Consultadas pelo Admin

| Rota | Tabela | Dados Exibidos |
|------|--------|---------------|
| `/api/analytics/*` | `usage_logs` | Logs de API calls |
| `/api/users/*` | `users` | Lista de usuários, daily_count |
| `/api/campaigns/*` | `campaigns`, `user_campaigns` | Status de campanhas |
| `/(dashboard)/stickers/*` | `stickers` | Stickers enviados, status |

---

## 9. Payload Evolution vs Z-API

### 9.1 sendSticker()

**Evolution API**:
```typescript
await axios.post(
  `${EVOLUTION_API_URL}/message/sendSticker/${EVOLUTION_INSTANCE}`,
  {
    number: "5511999999999",
    sticker: "https://supabase.co/.../sticker.webp"
  },
  { headers: { apikey: EVOLUTION_API_KEY } }
);

// Resposta:
{
  "key": {
    "id": "msg-id",
    "remoteJid": "5511999999999@s.whatsapp.net",
    "fromMe": true
  },
  "status": "PENDING"
}
```

**Z-API**:
```typescript
await axios.post(
  `https://api.z-api.io/instances/${Z_API_INSTANCE}/token/${Z_API_TOKEN}/send-sticker`,
  {
    phone: "5511999999999",           // SEM sufixo @s.whatsapp.net
    sticker: "https://supabase.co/.../sticker.webp"
  },
  { headers: { 'Client-Token': Z_API_CLIENT_TOKEN } }
);

// Resposta:
{
  "zaapId": "...",
  "messageId": "msg-id",
  "id": "msg-id"
}
```

### 9.2 sendText()

**Evolution API**:
```typescript
{
  number: "5511999999999",
  text: "Olá! Seu sticker foi criado."
}
```

**Z-API**:
```typescript
{
  phone: "5511999999999",
  message: "Olá! Seu sticker foi criado."  // 'text' → 'message'
}
```

### 9.3 sendButtons() - Avisa vs Z-API

**Avisa API**:
```typescript
{
  number: "5511999999999",
  options: [
    { type: 1, text: "Opção 1" },
    { type: 1, text: "Opção 2" },
    { type: 1, text: "Opção 3" }
  ],
  title: "Escolha uma opção",
  description: "Clique em um botão",
  footer: "StickerZap"
}
```

**Z-API**:
```typescript
{
  phone: "5511999999999",
  message: "Escolha uma opção",
  title: "Título (opcional)",
  footer: "StickerZap",
  buttonActions: [
    { type: "REPLY", label: "Opção 1", id: "btn_1" },
    { type: "REPLY", label: "Opção 2", id: "btn_2" },
    { type: "REPLY", label: "Opção 3", id: "btn_3" }
  ]
}
```

### 9.4 sendPixButton() - Avisa vs Z-API

**Avisa API**:
```typescript
{
  number: "5511999999999",
  name: "Pagar Premium",
  pix: "00020126580014br.gov.bcb.pix..."  // Código PIX Copia e Cola
}
```

**Z-API**:
```typescript
{
  phone: "5511999999999",
  pixKey: "00020126580014br.gov.bcb.pix...",
  type: "EVP",                             // CPF | CNPJ | PHONE | EMAIL | EVP
  merchantName: "Pagar Premium"
}
```

---

## 10. Plano de Migração

### 10.1 Fase 1: Preparação ✅ COMPLETA

- [x] Criar arquivo `src/services/zapiApi.ts`
- [x] Implementar todas as funções equivalentes:
  - [x] `sendSticker()`
  - [x] `sendText()`
  - [x] `sendVideo()`
  - [x] `sendButtons()`
  - [x] `sendList()`
  - [x] `sendPixButton()`
  - [x] `checkConnection()`
  - [x] `setWebhook()` e `getWebhook()`
- [x] Criar novo webhook handler `src/routes/webhookZapi.ts`
- [x] Criar feature flags `USE_ZAPI` e `ZAPI_WEBHOOK_ENABLED`
- [x] Criar adapter `src/services/whatsappApi.ts`
- [x] Atualizar todos os imports (17 arquivos):
  - [x] `src/worker.ts`
  - [x] `src/routes/webhook.ts`
  - [x] `src/services/messageService.ts`
  - [x] `src/services/menuService.ts`
  - [x] `src/services/onboardingService.ts`
  - [x] `src/services/stripeWebhook.ts`
  - [x] `src/services/sequenceService.ts`
  - [x] `src/services/campaignService.ts`
  - [x] `src/services/gifProcessor.ts`
  - [x] `src/services/stickerProcessor.ts`
  - [x] `src/jobs/sendPendingStickers.ts`
  - [x] `src/jobs/sendScheduledReminders.ts`
  - [x] `src/jobs/processSequenceSteps.ts`
  - [x] `src/jobs/activatePendingPixSubscription.ts`
- [x] Registrar webhook Z-API no `src/server.ts`
- [x] Adicionar logs de feature flags na inicialização
- [ ] Adicionar variáveis de ambiente Z-API no Doppler
- [ ] Atualizar `.env.docker.example` com variáveis Z-API

### 10.2 Fase 2: Deploy em Staging (1 dia)

- [ ] Deploy do código com feature flag `USE_ZAPI=false`
- [ ] Conectar WhatsApp à instância Z-API (QR code)
- [ ] Configurar webhook Z-API
- [ ] Ativar feature flag `USE_ZAPI=true` em staging
- [ ] Testes manuais:
  - Enviar imagem → receber sticker
  - Enviar comando `/planos` → receber lista
  - Enviar comando `/pagar` → receber botão PIX
  - Verificar logs e banco de dados

### 10.3 Fase 3: Deploy em Produção (1 dia)

- [ ] Verificar saldo/créditos na conta Z-API
- [ ] Conectar WhatsApp de produção à Z-API
- [ ] Ativar feature flag `USE_ZAPI=true` em produção
- [ ] Monitorar por 1 hora:
  - Taxa de erro < 1%
  - Latência < 5s
  - Jobs completando normalmente
- [ ] Se OK: remover código Evolution + Avisa
- [ ] Se ERRO: rollback para `USE_ZAPI=false`

### 10.4 Fase 4: Limpeza (1 dia)

- [ ] Remover arquivos:
  - `src/services/evolutionApi.ts`
  - `src/services/avisaApi.ts`
- [ ] Remover variáveis de ambiente antigas
- [ ] Remover feature flag (deixar Z-API como padrão)
- [ ] Atualizar documentação
- [ ] Desligar containers Evolution API (stack Docker)
- [ ] Cancelar conta Avisa API

### 10.5 Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Z-API instável | Baixa | Alto | Manter Evolution como backup por 7 dias |
| Webhook não funciona | Média | Alto | Testar em staging primeiro |
| Formato de payload diferente | Alta | Médio | Mapping bem documentado (este doc) |
| Timeout em envios | Média | Médio | Já temos retry com exponential backoff |
| Perda de mensagens durante migração | Baixa | Alto | Deploy em horário de baixa demanda |

---

## 📊 Checklist de Verificação Pré-Migração

```
[ ] Todos os 17 arquivos que usam evolutionApi foram identificados
[ ] Todos os 7 arquivos que usam avisaApi foram identificados
[ ] Todas as 8 tabelas afetadas foram mapeadas
[ ] Todas as 6 variáveis de ambiente foram listadas
[ ] Webhook payload mapping está completo
[ ] Todos os 5 jobs foram identificados
[ ] Admin panel impacto = zero confirmado
[ ] Payloads de request/response documentados
[ ] Plano de migração em 4 fases definido
[ ] Estratégia de rollback definida
```

---

## 📦 Arquivos Criados na Migração

### Novos Arquivos (4 arquivos)
1. **`src/services/zapiApi.ts`** (713 linhas)
   - Cliente completo da Z-API
   - Funções: sendSticker, sendText, sendVideo, sendButtons, sendList, sendPixButton
   - Rate limiting integrado
   - Logging automático
   - Fallback para texto simples em números não-brasileiros

2. **`src/services/whatsappApi.ts`** (312 linhas)
   - **Adapter pattern** para abstrair qual API usar
   - Seleciona Evolution+Avisa ou Z-API baseado em feature flag
   - Interface unificada para todo o código
   - Permite troca de provider sem mudanças em 17+ arquivos

3. **`src/routes/webhookZapi.ts`** (198 linhas)
   - Webhook handler para Z-API
   - Transforma payload Z-API → formato Evolution (compatibilidade)
   - Permite reutilizar toda lógica de negócio existente

4. **`src/config/features.ts`** (58 linhas)
   - Sistema de feature flags
   - `USE_ZAPI`: Controla qual API usar (false = Evolution+Avisa, true = Z-API)
   - `ZAPI_WEBHOOK_ENABLED`: Habilita endpoint /webhook/zapi
   - Logs na inicialização para visibilidade

### Arquivos Modificados (15 arquivos)
- ✅ `src/worker.ts` - Import trocado para whatsappApi
- ✅ `src/server.ts` - Webhook Z-API registrado, feature flags logados
- ✅ `src/routes/webhook.ts` - Import trocado
- ✅ `src/services/*` (7 arquivos) - Imports trocados
- ✅ `src/jobs/*` (4 arquivos) - Imports trocados

**Total de alterações**: 4 arquivos criados + 15 arquivos modificados = **19 arquivos**

---

## 🚀 Status Atual da Migração

### ✅ Fase 1: Preparação - COMPLETA (100%)

Todos os 17 arquivos que usavam Evolution API e Avisa API foram atualizados para usar o adapter `whatsappApi.ts`.

**O que foi feito:**
- ✅ Z-API client implementado e testado (zapiApi.ts)
- ✅ Adapter criado para abstrair provider (whatsappApi.ts)
- ✅ Feature flags implementadas (USE_ZAPI, ZAPI_WEBHOOK_ENABLED)
- ✅ Webhook Z-API handler criado (webhookZapi.ts)
- ✅ Todos os imports atualizados (worker, services, jobs)
- ✅ Server.ts registra webhook Z-API condicionalmente
- ✅ Logs de feature flags na inicialização

**Pronto para:**
- 🔄 Testes locais com `USE_ZAPI=false` (modo atual - Evolution+Avisa)
- 🔄 Deploy em staging
- 🔄 Testes com `USE_ZAPI=true` (modo Z-API)

---

## 🎯 Próximos Passos

### 1. Configurar Variáveis de Ambiente (5 min)

Adicionar no Doppler (projeto `sticker`, configs `stg` e `prd`):
```bash
# Z-API Credentials (obter em https://admin.z-api.io/)
Z_API_INSTANCE=<ver_painel_z-api>
Z_API_TOKEN=<ver_painel_z-api>
Z_API_CLIENT_TOKEN=<ver_painel_z-api>
Z_API_BASE_URL=https://api.z-api.io

# Feature Flags (MANTER FALSE até testar em staging)
USE_ZAPI=false
ZAPI_WEBHOOK_ENABLED=false
```

**⚠️ As credenciais devem estar APENAS no Doppler, nunca no git!**

### 2. Deploy em Staging (30 min)

```bash
# 1. Deploy com flags desabilitadas (modo atual)
doppler run --project sticker --config stg -- ./deploy/deploy-sticker.sh

# 2. Verificar logs - deve mostrar:
#    🚩 Feature Flags:
#      USE_ZAPI: ❌ DISABLED (WhatsApp API provider)
#      ZAPI_WEBHOOK_ENABLED: ❌ DISABLED (Z-API webhook)
#    ℹ️  Evolution API mode is ACTIVE

# 3. Testar que tudo funciona normalmente
#    - Enviar imagem → receber sticker (Evolution API)
#    - Comando /planos → receber lista (Avisa API)
#    - Verificar logs e banco de dados
```

### 3. Conectar WhatsApp na Z-API (10 min)

```bash
# 1. Acessar painel Z-API: https://admin.z-api.io/
# 2. Conectar WhatsApp via QR code
# 3. Configurar webhook:
curl -X PUT \
  "https://api.z-api.io/instances/${Z_API_INSTANCE}/token/${Z_API_TOKEN}/update-every-webhooks" \
  -H "Client-Token: ${Z_API_CLIENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"value": "https://seu-dominio.com/webhook/zapi"}'
```

### 4. Ativar Z-API em Staging (1 hora)

```bash
# 1. Atualizar flags no Doppler (config stg):
doppler secrets set USE_ZAPI=true ZAPI_WEBHOOK_ENABLED=true \
  --project sticker --config stg

# 2. Restart workers e server:
vps-ssh "docker service update --force sticker_worker sticker_server"

# 3. Verificar logs - deve mostrar:
#    🚩 Feature Flags:
#      USE_ZAPI: ✅ ENABLED (WhatsApp API provider)
#      ZAPI_WEBHOOK_ENABLED: ✅ ENABLED (Z-API webhook)
#    ⚠️  Z-API mode is ACTIVE
#    📝 Z-API Webhook endpoint: http://0.0.0.0:3000/webhook/zapi

# 4. Testar TODAS as funcionalidades:
#    - ✅ Enviar imagem → receber sticker
#    - ✅ Comando /planos → receber lista
#    - ✅ Comando /pagar → receber botão PIX
#    - ✅ Enviar Twitter URL → receber vídeo
#    - ✅ Verificar logs: "[Z-API]" em todas as operações
#    - ✅ Verificar banco: stickers salvos, usage_logs com sucesso

# 5. Monitorar por 1 hora:
#    - Taxa de erro < 1%
#    - Latência < 5s
#    - Jobs completando normalmente
#    - Nenhum crash ou timeout

# 6. Se TUDO OK: Prosseguir para produção
#    Se ERRO: Rollback com USE_ZAPI=false
```

### 5. Deploy em Produção (1 dia)

Seguir mesmo processo do staging, mas com mais cautela:
- Deploy em horário de baixa demanda
- Monitorar por 24 horas
- Manter Evolution API online por 7 dias como backup

### 6. Limpeza (após 7 dias)

Se tudo estável em produção:
- Remover código antigo (evolutionApi.ts, avisaApi.ts)
- Remover variáveis de ambiente antigas
- Desligar containers Evolution API
- Cancelar conta Avisa API
- Remover feature flags (deixar Z-API como padrão)

---

**Atualizado em**: 2026-01-19 (Fase 1 completa)
