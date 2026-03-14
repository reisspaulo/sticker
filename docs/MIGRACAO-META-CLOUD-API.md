# 🚀 Migração para Meta Cloud API (WhatsApp Oficial)

**Data:** 2026-03-12
**Status:** Documentação completa para implementação
**Objetivo:** Migrar de Z-API para Meta Cloud API oficial

---

## 📋 Índice
1. [Onboarding & Setup](#onboarding--setup)
2. [Billing & Configuração de Pagamento](#billing--configuração-de-pagamento)
3. [Endpoints da Meta Cloud API](#endpoints-da-meta-cloud-api)
4. [Mapeamento de Endpoints](#mapeamento-de-endpoints-za-api--meta-cloud-api)
5. [Implementação Técnica](#implementação-técnica)
6. [Reaproveitamento do Banco de Dados](#reaproveitamento-do-banco-de-dados)
7. [Plano de Migração](#plano-de-migração)

---

## Onboarding & Setup

### Passo 1: Registrar Negócio na Meta

1. **Acesse Meta for Developers**
   - URL: https://developers.facebook.com/
   - Login com conta Facebook pessoal

2. **Criar App**
   - Dashboard → Meus Apps → Criar Aplicação
   - Tipo: Business
   - Nome: `sticker-bot` ou similar
   - Email de contato: seu email

3. **Adicionar Produto WhatsApp**
   - Dentro do App → Produtos → Adicionar Produto
   - Buscar "WhatsApp"
   - Clicar "Configurar"

### Passo 2: Verificar Negócio

**Importante:** Antes de qualquer coisa, você precisa verificar o negócio:

- https://www.facebook.com/business/help/2058794217920225
- Nome do negócio deve corresponder ao registrado
- Verificação por telefone ou documento (leva 1-3 dias úteis)
- **SEM verificação = API não funciona**

### Passo 3: Registrar Número de Telefone

1. Vá para: Meta for Developers → App → WhatsApp → Configurações Gerais
2. Clique em "Adicionar Número de Telefone"
3. **Opções:**
   - **Número existente:** Migrar número já em uso (leva 24h de verificação)
   - **Novo número:** Comprar número oficial da Meta (R$ 5-10/mês, vem com aprovação instantânea)

**Recomendação para começar:** Use novo número → depois migra seu número antigo

### Passo 4: Obter Credenciais

Após verificação, você terá:

```
WHATSAPP_BUSINESS_ACCOUNT_ID=sua_conta_id
WHATSAPP_PHONE_NUMBER_ID=seu_numero_id
WHATSAPP_PHONE_NUMBER=seu_numero  # ex: 5511999999999
WHATSAPP_ACCESS_TOKEN=seu_token_de_acesso  # Válido por ~60 dias
```

**Onde encontrar:**
- Meta for Developers → App → WhatsApp → Configurações Gerais
- Access Token → Gerar no seu App Roles (Type: System User)

---

## Billing & Configuração de Pagamento

### Ativar Cobrança

1. **Acesse Meta Ads Manager**
   - URL: https://business.facebook.com/adsmanager

2. **Configurar Método de Pagamento**
   - Lado esquerdo → Configurações de Faturamento
   - Clique em "Adicionar Método de Pagamento"
   - **Tipos aceitos no Brasil:**
     - Cartão de crédito (Visa, Mastercard)
     - Débito em conta bancária

3. **Métodos Recomendados:**
   - **Cartão de crédito** = mais rápido (aprovação instantânea)
   - **Transferência bancária** = mais lento (3-5 dias)

### Limites Iniciais

- **Primeiro mês:** R$ 100 de limite
- **Segundo mês:** R$ 500
- **Terceiro mês:** R$ 2.000+
- Limites aumentam gradualmente conforme seu histórico de pagamento

### Monitoramento de Despesas

```
Meta for Developers → App → WhatsApp → Configurações Gerais
        ↓
Estatísticas/Insights → Aba "Faturamento"
```

**Você verá:**
- Quantidade de mensagens enviadas
- Custo por dia
- Previsão de fatura mensal

---

## Endpoints da Meta Cloud API

### Referência Oficial
- Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Versão Recomendada: v21.0 ou superior
- Base URL: `https://graph.facebook.com/v21.0/`

### Autenticação

```bash
# Todos os requests incluem:
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
```

### 1️⃣ Enviar Mensagem de Texto

**POST** `/v21.0/{phone-number-id}/messages`

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "preview_url": true,
    "body": "Olá! Como posso ajudar?"
  }
}
```

**Resposta:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "5511999999999",
      "wa_id": "5511999999999"
    }
  ],
  "messages": [
    {
      "id": "wamid.xxxxx",
      "message_status": "accepted"
    }
  ]
}
```

### 2️⃣ Enviar Mensagem com Botões (Interactive)

**POST** `/v21.0/{phone-number-id}/messages`

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": {
      "text": "Escolha uma opção:"
    },
    "action": {
      "buttons": [
        {
          "type": "reply",
          "reply": {
            "id": "upgrade_premium",
            "title": "💰 Premium - R$ 5/mês"
          }
        },
        {
          "type": "reply",
          "reply": {
            "id": "upgrade_ultra",
            "title": "🚀 Ultra - R$ 9,90/mês"
          }
        }
      ]
    }
  }
}
```

### 3️⃣ Enviar Sticker (Figurinha)

**POST** `/v21.0/{phone-number-id}/messages`

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "sticker",
  "sticker": {
    "link": "https://seu-dominio.com/sticker.webp"
  }
}
```

**⚠️ Importante:** Meta usa tipo `sticker` (não `image`). Formato obrigatório: `.webp`. Limites: 100KB (estático), 500KB (animado). Dimensões: 512x512px.

### 4️⃣ Enviar Vídeo

**POST** `/v21.0/{phone-number-id}/messages`

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "video",
  "video": {
    "link": "https://seu-dominio.com/video.mp4",
    "caption": "Seu vídeo do Twitter!"
  }
}
```

### 5️⃣ Usar Template (Marketing)

**POST** `/v21.0/{phone-number-id}/messages`

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "template",
  "template": {
    "name": "limit_reached",
    "language": {
      "code": "pt_BR",
      "policy": "deterministic"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "4"
          },
          {
            "type": "text",
            "text": "00:00"
          }
        ]
      }
    ]
  }
}
```

### 6️⃣ Receber Mensagens (Webhook)

**POST** `seu-dominio.com/webhook/whatsapp`

```json
{
  "entry": [
    {
      "id": "business_account_id",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "551133334444",
              "phone_number_id": "numero_id",
              "business_account_id": "business_id"
            },
            "contacts": [
              {
                "profile": {
                  "name": "João Silva"
                },
                "wa_id": "5511999999999"
              }
            ],
            "messages": [
              {
                "from": "5511999999999",
                "id": "wamid.xxxxx",
                "timestamp": "1234567890",
                "type": "image",
                "image": {
                  "mime_type": "image/jpeg",
                  "sha256": "xxxx",
                  "id": "media_id_12345"
                  // NOTA: NÃO vem "link" no webhook!
                  // Para obter o arquivo: GET /v21.0/{media_id_12345} → url temporária → download
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### 7️⃣ Upload de Mídia (Opcional)

**POST** `/v21.0/{phone-number-id}/media`

```bash
curl -X POST \
  https://graph.facebook.com/v21.0/{phone_number_id}/media \
  -H "Authorization: Bearer {token}" \
  -F "messaging_product=whatsapp" \
  -F "file=@sticker.webp;type=image/webp"
```

**Resposta:**
```json
{
  "id": "media_id_12345"
}
```

---

## Mapeamento de Endpoints: Z-API → Meta Cloud API

| Funcionalidade | Z-API | Meta Cloud API |
|---|---|---|
| **Enviar Texto** | POST `/send-text` | POST `/messages` (type: text) |
| **Enviar Sticker** | POST `/send-sticker` | POST `/messages` (type: sticker) |
| **Enviar Vídeo** | POST `/send-video` | POST `/messages` (type: video) |
| **Enviar Botões** | POST `/send-buttons` | POST `/messages` (type: interactive) |
| **Receber Webhook** | POST `/webhook/zapi` | POST `/webhook/whatsapp` |
| **Validar Token** | Header `Client-Token` | Header `Authorization: Bearer` |
| **Rate Limiting** | 60 msgs/min por conta | 1000 msgs/s global (ajustável) |

---

## Implementação Técnica

### Estrutura de Novo Serviço

```typescript
// src/services/metaCloudApi.ts

import axios, { AxiosInstance } from 'axios';
import logger from '../config/logger';

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

if (!accessToken || !phoneNumberId) {
  throw new Error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID required');
}

const api: AxiosInstance = axios.create({
  baseURL: 'https://graph.facebook.com/v21.0',
  timeout: 30000,
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});

// ============================================
// ENVIAR STICKER (FIGURINHA)
// ============================================

export async function sendSticker(
  userNumber: string,
  stickerUrl: string
): Promise<string> {
  try {
    const response = await api.post(`/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: sanitizePhone(userNumber),
      type: 'sticker',
      sticker: {
        link: stickerUrl, // URL pública de .webp (max 100KB estático, 500KB animado)
      },
    });

    logger.info({
      msg: '[Meta Cloud API] Sticker sent',
      userNumber,
      messageId: response.data.messages[0].id,
    });

    return response.data.messages[0].id;
  } catch (error) {
    logger.error({
      msg: '[Meta Cloud API] Failed to send sticker',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

// ============================================
// ENVIAR BOTÕES (INTERACTIVE)
// ============================================

export async function sendButtons(
  userNumber: string,
  message: string,
  buttons: Array<{ id: string; label: string }>
): Promise<string> {
  try {
    const response = await api.post(`/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: sanitizePhone(userNumber),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: message,
        },
        action: {
          buttons: buttons.map((btn) => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.label,
            },
          })),
        },
      },
    });

    return response.data.messages[0].id;
  } catch (error) {
    logger.error({
      msg: '[Meta Cloud API] Failed to send buttons',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

// ============================================
// ENVIAR TEXTO
// ============================================

export async function sendText(
  userNumber: string,
  text: string,
  options?: { delayMessage?: number; delayTyping?: number } // ignorados na Meta
): Promise<string> {
  const response = await api.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to: sanitizePhone(userNumber),
    type: 'text',
    text: { preview_url: true, body: text },
  });
  return response.data.messages[0].id;
}

// ============================================
// ENVIAR VÍDEO
// ============================================

export async function sendVideo(
  userNumber: string,
  videoUrl: string,
  caption?: string,
  options?: { viewOnce?: boolean; async?: boolean } // ignorados na Meta
): Promise<string> {
  const response = await api.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to: sanitizePhone(userNumber),
    type: 'video',
    video: { link: videoUrl, caption },
  });
  return response.data.messages[0].id;
}

// ============================================
// DOWNLOAD DE MÍDIA (2 passos - diferente da Z-API!)
// ============================================

export async function downloadMedia(mediaId: string): Promise<Buffer> {
  // Passo 1: Obter URL temporária (válida por 5 min)
  const mediaInfo = await api.get(`/${mediaId}`);
  const tempUrl = mediaInfo.data.url;

  // Passo 2: Download com autenticação
  const response = await fetch(tempUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Media download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ============================================
// RECEBER WEBHOOK
// ============================================

export function validateWebhookToken(token: string): boolean {
  return token === process.env.WHATSAPP_WEBHOOK_TOKEN;
}

export function parseWebhookMessage(body: any) {
  const value = body.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  // Extrair nome do contato (Meta envia separado)
  const contactName = value?.contacts?.[0]?.profile?.name;

  return {
    from: message.from,           // whatsapp_number do remetente
    messageId: message.id,        // wamid.xxxxx
    timestamp: message.timestamp, // string (segundos, não ms!)
    type: message.type,           // 'text', 'image', 'sticker', 'interactive', etc
    contactName,                  // nome do perfil do WhatsApp

    // Conteúdo por tipo
    text: message.text?.body,
    // NOTA: Meta envia media ID, NÃO URL direta (diferente da Z-API!)
    imageId: message.image?.id,       // precisa chamar downloadMedia()
    stickerId: message.sticker?.id,   // idem
    videoId: message.video?.id,       // idem
    // Resposta de botão interativo
    buttonId: message.interactive?.button_reply?.id,
    buttonText: message.interactive?.button_reply?.title,
    // Resposta de lista
    listId: message.interactive?.list_reply?.id,
  };
}

// ============================================
// CONEXÃO / STATUS
// ============================================

export async function checkConnection(): Promise<boolean> {
  try {
    const response = await api.get(`/${phoneNumberId}`);
    return !!response.data.id;
  } catch {
    return false;
  }
}

// ============================================
// HELPER
// ============================================

function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isBrazilianNumber(phoneNumber: string): boolean {
  return sanitizePhone(phoneNumber).startsWith('55');
}
```

### Webhook Route

```typescript
// src/routes/webhookMeta.ts

import { FastifyInstance } from 'fastify';
import * as metaApi from '../services/metaCloudApi';
import { handleUserMessage } from '../services/messageService';

export async function webhookMeta(app: FastifyInstance) {
  // GET - Meta valida o webhook na primeira vez
  app.get('/webhook/meta', async (request, reply) => {
    const token = request.query.hub_verify_token;
    const challenge = request.query.hub_challenge;

    if (metaApi.validateWebhookToken(token as string)) {
      return reply.send(challenge);
    }

    return reply.code(403).send('Invalid token');
  });

  // POST - Receber mensagens
  app.post('/webhook/meta', async (request, reply) => {
    const body = request.body as any;

    const message = metaApi.parseWebhookMessage(body);
    if (!message) {
      return reply.code(200).send('ok'); // Meta quer resposta rápida
    }

    // Processar mensagem em background
    handleUserMessage({
      from: message.from,
      text: message.text,
      imageUrl: message.imageUrl,
      buttonId: message.buttonId,
      messageId: message.messageId,
    }).catch(err => {
      logger.error({
        msg: 'Failed to process message',
        error: err,
      });
    });

    return reply.code(200).send('received');
  });
}
```

### Configuração de Webhook na Meta

1. Vá para: Meta for Developers → App → WhatsApp → Configurações
2. Clique em "Editar Webhook"
3. Preencha:
   - **Callback URL:** `https://seu-dominio.com/webhook/meta`
   - **Verify Token:** Uma string aleatória (salve em `WHATSAPP_WEBHOOK_TOKEN`)
   - **Subscribe to this field:** `messages` + `message_template_status_update`

---

## Reaproveitamento do Banco de Dados

### ✅ Tabelas que CONTINUAM AS MESMAS

```sql
-- Nomes reais das tabelas e colunas no Supabase:
users (whatsapp_number TEXT UNIQUE)        -- 1,105 users
stickers (user_number TEXT)                 -- 4,912 stickers
subscriptions (user_id UUID)                -- Stripe integration
pix_payments (user_id, user_number)         -- 23 pagamentos
campaigns (id, name, status)                -- 4 campanhas
sequences + sequence_messages               -- Sistema de sequências
conversation_contexts (user_number TEXT)     -- Estado temporário (TTL)
usage_logs (user_number, action, details)   -- 164k logs (NÃO existem tabelas separadas stickers_sent/messages_sent)
pending_sticker_sends (sticker_id, user_id) -- Queue de envio
celebrities + celebrity_photos              -- Face detection/embeddings
```

**NOTA:** A coluna principal de identificação é `whatsapp_number` (não `phone_number`).
Logs de envio ficam em `usage_logs` com campo `action` ('sticker_sent', 'message_sent', 'menu_sent', etc).

### 📝 Tabelas que PRECISAM DE AJUSTE

```sql
-- Adicionar coluna para rastrear message_id da Meta nos stickers
ALTER TABLE stickers
ADD COLUMN IF NOT EXISTS meta_message_id TEXT UNIQUE;

-- Adicionar coluna nos logs de envio pendente
ALTER TABLE pending_sticker_sends
ADD COLUMN IF NOT EXISTS meta_message_id TEXT;

-- Para rastrear status de delivery (importante pra cobranças da Meta)
CREATE TABLE IF NOT EXISTS meta_message_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,       -- wamid.xxxx da Meta
  user_number TEXT NOT NULL,      -- whatsapp_number do usuário
  status TEXT,                    -- 'sent', 'delivered', 'read', 'failed'
  error_code TEXT,                -- código de erro da Meta (se houver)
  timestamp TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (user_number) REFERENCES users(whatsapp_number)
);
CREATE INDEX idx_meta_msg_status_user ON meta_message_status(user_number);
CREATE INDEX idx_meta_msg_status_id ON meta_message_status(message_id);
```

### 🔄 Serviços que CONTINUAM IGUAL (via adapter `whatsappApi.ts`)

- `menuService.ts` - Lógica de menu (importa de whatsappApi, não precisa mudar)
- `stickerProcessor.ts` - Processamento de sticker (Sharp/FFmpeg)
- `messageService.ts` - Orquestração de mensagens
- `campaignService.ts` - Campanhas (adaptar só lógica de 24h/templates)
- `sequenceService.ts` - Sequências (adaptar só lógica de 24h/templates)
- `supabaseStorage.ts` - Armazenamento de mídia
- `userService.ts` - RPCs: increment_daily_count, etc
- `stickerProcessor.ts` / `gifProcessor.ts` - FFmpeg/Sharp não muda
- `pixPaymentService.ts` - Stripe/PIX (workaround no envio do botão)
- `onboardingService.ts` - Fluxo de onboarding

### 🔧 Arquivos que PRECISAM SER CRIADOS/ALTERADOS

```
CRIAR:   src/services/metaCloudApi.ts       (novo provider)
CRIAR:   src/routes/webhookMeta.ts          (parser de webhook novo)
ALTERAR: src/services/whatsappApi.ts        (adicionar flag USE_META no adapter)
ALTERAR: src/config/features.ts             (adicionar USE_META)
MANTER:  src/services/zapiApi.ts            (para rollback, remover depois)
```

---

## ⚠️ Mudanças Críticas (Não Existiam na Z-API)

### Regra de 24 Horas (Conversation-Based Pricing)

A Meta cobra por "conversas", não por mensagens individuais. Regra:

- **Dentro de 24h** após o usuário enviar mensagem: pode responder livremente (Utility/Service)
- **Fora de 24h**: SÓ pode enviar **templates pré-aprovados** (Marketing)

**Impacto no Sticker Bot:**
- Respostas a fotos/comandos → OK (usuário iniciou, janela aberta)
- Lembretes Wave 1 (6h) → OK (ainda dentro da janela)
- Lembretes Wave 2 (48h) → **Precisa de template aprovado**
- Campanhas de upgrade → **Precisa de template aprovado**

**Templates que precisam ser criados:**
1. `reminder_wave2` - Lembrete de retorno
2. `upgrade_offer` - Oferta de plano premium/ultra
3. `campaign_message` - Campanhas genéricas
4. `payment_confirm` - Confirmação de pagamento

Tempo de aprovação: 24-48h por template.

### PIX Button (Sem Equivalente)

Z-API tinha `/send-button-pix` nativo. Meta não tem. Workaround: enviar texto formatado com código PIX copiável, ou usar template com botão de URL para link de pagamento externo.

### Download de Mídia (2 Passos)

Z-API enviava URL direta no webhook. Meta envia apenas `media_id`. Para obter o arquivo:
1. `GET /{media_id}` → retorna URL temporária (válida por 5 min)
2. `GET {url_temporaria}` com Bearer token → download do arquivo

### Adapter Pattern Existente

O projeto já tem `src/services/whatsappApi.ts` que abstrai o provider via feature flags. Basta adicionar flag `USE_META` e as chamadas para `metaCloudApi` no adapter. Os 17+ arquivos que consomem a API (menuService, messageService, etc.) **não precisam ser alterados**.

---

## Plano de Migração

### **Fase 1: Setup (Dia 1-3)**

- [ ] Registrar negócio na Meta
- [ ] Verificar negócio (documentos)
- [ ] Criar número de telefone (ou migrar existente)
- [ ] Obter Access Token
- [ ] Configurar método de pagamento
- [ ] Validar webhook

### **Fase 2: Desenvolvimento (Dia 4-7)**

- [ ] Criar `metaCloudApi.ts`
- [ ] Criar `webhookMeta.ts`
- [ ] Adaptar `menuService.ts`
- [ ] Testar mensagens de texto
- [ ] Testar botões interativos
- [ ] Testar envio de figurinhas
- [ ] Testar recebimento de webhook

### **Fase 3: Testes (Dia 8-10)**

- [ ] Teste E2E com usuário real
- [ ] Validar taxa de entrega
- [ ] Validar cobrança (verificar no Ads Manager)
- [ ] Testar rate limiting
- [ ] Validar tratamento de erros

### **Fase 4: Deploy (Dia 11-12)**

- [ ] Desativar Z-API
- [ ] Ativar Meta Cloud API em produção
- [ ] Monitorar logs
- [ ] Criar runbook de troubleshooting

---

## Comparação de Custos (Simulação)

### Z-API (Anterior)
- **Custo fixo:** R$ 50-100/mês (Z-API premium)
- **Por mensagem:** ~R$ 0,08-0,15
- **100 usuários/dia, 3 msgs cada:** R$ 24/dia = R$ 720/mês
- **Total:** ~R$ 770-820/mês ⚠️

### Meta Cloud API (Novo)
- **Custo fixo:** R$ 0 (apenas pague o que usar)
- **Por template disparado:** R$ 0,035
- **100 usuários/dia, 10% conversão:** R$ 0,35/dia = R$ 10,50/mês
- **Lembretes (3 waves):** R$ 115,50/mês
- **Total:** ~R$ 126/mês ✅

### **ECONOMIA: ~85% de redução** 🎉

---

## Documentação & Links Úteis

### Oficial da Meta
- [Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Message Types](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/message-types)
- [Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example)
- [Pricing](https://www.whatsapp.com/business/pricing)

### Ferramentas
- [Postman Collection](https://www.postman.com/downloads/) - Testar endpoints
- [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer) - Testar na web

### Roadmap
- [ ] Suporte a catálogos de produtos (future)
- [ ] Fluxos automáticos avançados (future)
- [ ] AI-powered respostas (future)

---

## FAQ

**P: Quanto custa migrar?**
R: Nada! Você só desativa Z-API e ativa Meta.

**P: Vai perder historico de mensagens?**
R: Não! O banco continua igual. Só muda o serviço de envio.

**P: Preciso reverificar o número?**
R: Se for número novo, sim. Se for migrar número existente, Meta verifica automaticamente.

**P: Como faço debug de mensagens?**
R: Meta for Developers → App → WhatsApp → Logs → Filtre por número de telefone

**P: Qual é o limite de mensagens?**
R: Começando com ~1000 msgs/dia. Aumenta automaticamente.

---

**Próximos passos:** Começar pela Fase 1 do plano de migração!
