# 🔄 Mapeamento de Endpoints: Z-API → Meta Cloud API

**Referência técnica para migração de código**

---

## Resumo Rápido

| Operação | Z-API | Meta Cloud API | Diferença |
|----------|-------|-----------------|-----------|
| **Autenticação** | Header `Client-Token` | Header `Authorization: Bearer` | ✅ Mais seguro |
| **Enviar Texto** | POST `/send-text` | POST `/{id}/messages` + JSON | ✅ RESTful |
| **Enviar Sticker** | POST `/send-sticker` | POST `/{id}/messages` + JSON | ✅ Unificado |
| **Enviar Botões** | POST `/send-buttons` | POST `/{id}/messages` (interactive) | ✅ Nativo |
| **Webhook** | POST endpoint custom | POST endpoint custom + verify token | ✅ Padrão OAuth |
| **Rate Limit** | 60 msgs/min por conta | 1000/s global (ou aumento) | ✅ Mais generoso |

---

## 1️⃣ Enviar Texto

### Z-API (Antigo)

```typescript
// src/services/zapiApi.ts
import axios from 'axios';

const api = axios.create({
  baseURL: `https://api.z-api.io/instances/${Z_API_INSTANCE}/token/${Z_API_TOKEN}`,
  headers: {
    'Client-Token': Z_API_CLIENT_TOKEN,
  },
});

export async function sendText(
  userNumber: string,
  text: string,
  options?: { delayMessage?: number; delayTyping?: number }
): Promise<void> {
  const response = await api.post('/send-text', {
    phone: sanitizePhoneNumber(userNumber),
    message: text,
    delayMessage: options?.delayMessage,
    delayTyping: options?.delayTyping,
  });

  console.log('Message sent:', response.data.messageId);
}
```

### Meta Cloud API (Novo)

```typescript
// src/services/metaCloudApi.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://graph.facebook.com/v21.0',
  headers: {
    'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
  },
});

export async function sendText(
  userNumber: string,
  text: string,
  options?: { preview_url?: boolean }
): Promise<string> {
  const response = await api.post(`/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to: sanitizePhoneNumber(userNumber),
    type: 'text',
    text: {
      preview_url: options?.preview_url ?? true,
      body: text,
    },
  });

  const messageId = response.data.messages[0].id;
  console.log('Message sent:', messageId);
  return messageId;
}
```

### Diferenças Principais

| Aspecto | Z-API | Meta | Impacto |
|---------|-------|------|--------|
| **Base URL** | Z-API proprietary | Graph API padrão | Mais estável |
| **Autenticação** | Client-Token header | Bearer token | Mais seguro |
| **Delay na mensagem** | ✅ `delayMessage` param | ❌ Não suportado | Perder feature? |
| **Preview de URL** | ❌ Automático | ✅ `preview_url` param | Melhor controle |
| **Timeout** | 30s padrão | 30s (mesmo) | Nenhum |

---

## 2️⃣ Enviar Sticker (Figurinha)

### Z-API (Antigo)

```typescript
export async function sendSticker(
  userNumber: string,
  stickerUrl: string
): Promise<void> {
  const response = await api.post('/send-sticker', {
    phone: sanitizePhoneNumber(userNumber),
    sticker: stickerUrl,  // URL direta da figurinha .webp
  });

  logger.info('[Z-API] Sticker sent:', response.data.messageId);
}
```

**Exemplo de resposta:**
```json
{
  "messageId": "BAE5123456789",
  "zaapId": "3EB123456789@c.us",
  "id": "true"
}
```

### Meta Cloud API (Novo)

```typescript
export async function sendSticker(
  userNumber: string,
  stickerUrl: string
): Promise<string> {
  const response = await api.post(`/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to: sanitizePhoneNumber(userNumber),
    type: 'sticker',  // Meta tem tipo 'sticker' nativo
    sticker: {
      link: stickerUrl,  // URL pública do .webp
    },
  });

  const messageId = response.data.messages[0].id;
  logger.info('[Meta] Sticker sent:', messageId);
  return messageId;
}
```

**Exemplo de resposta:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    { "input": "5511999999999", "wa_id": "5511999999999" }
  ],
  "messages": [
    { "id": "wamid.HBEVGRVxyz==", "message_status": "accepted" }
  ]
}
```

### Diferenças

| Aspecto | Z-API | Meta | Impacto |
|---------|-------|------|---------|
| **Endpoint** | `/send-sticker` | `/{id}/messages` | Unificado |
| **Tipo de mídia** | `sticker` | `sticker` | Compatível |
| **URL vs Upload** | ✅ Link direto | ✅ Link direto (ou media ID) | Mesmo comportamento |
| **Formato esperado** | `.webp` ou `.png` | `.webp` apenas (max 100KB estático, 500KB animado) | ⚠️ Validar tamanho |
| **Message ID** | `messageId` no response | `messages[0].id` | Novo formato |

---

## 3️⃣ Enviar Botões (Interactive)

### Z-API (Antigo)

```typescript
interface SendButtonsRequest {
  number: string;
  message: string;
  title?: string;
  footer?: string;
  buttons: Array<{
    type: 'REPLY' | 'URL' | 'CALL';
    label: string;
    id?: string;  // Para REPLY buttons
    url?: string;  // Para URL buttons
  }>;
}

export async function sendButtons(
  userNumber: string,
  request: SendButtonsRequest
): Promise<void> {
  const response = await api.post('/send-buttons', {
    phone: sanitizePhoneNumber(userNumber),
    message: request.message,
    title: request.title,
    footer: request.footer,
    buttons: request.buttons,
  });

  logger.info('[Z-API] Buttons sent:', response.data.messageId);
}
```

**Uso:**
```typescript
sendButtons(userNumber, {
  number: userNumber,
  message: 'Escolha uma opção:',
  buttons: [
    { type: 'REPLY', id: 'upgrade_premium', label: '💰 Premium' },
    { type: 'REPLY', id: 'upgrade_ultra', label: '🚀 Ultra' },
  ],
});
```

### Meta Cloud API (Novo)

```typescript
interface InteractiveButton {
  id: string;
  title: string;  // Não 'label', é 'title'
}

export async function sendButtons(
  userNumber: string,
  message: string,
  buttons: InteractiveButton[],
  options?: { header?: string; footer?: string }
): Promise<string> {
  const response = await api.post(`/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to: sanitizePhoneNumber(userNumber),
    type: 'interactive',
    interactive: {
      type: 'button',
      header: options?.header ? { type: 'text', text: options.header } : undefined,
      body: {
        text: message,
      },
      footer: options?.footer ? { text: options.footer } : undefined,
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title,
          },
        })),
      },
    },
  });

  const messageId = response.data.messages[0].id;
  logger.info('[Meta] Buttons sent:', messageId);
  return messageId;
}
```

**Uso:**
```typescript
sendButtons(
  userNumber,
  'Escolha uma opção:',
  [
    { id: 'upgrade_premium', title: '💰 Premium - R$ 5/mês' },
    { id: 'upgrade_ultra', title: '🚀 Ultra - R$ 9,90/mês' },
  ]
);
```

### Diferenças

| Aspecto | Z-API | Meta | Impacto |
|---------|-------|------|---------|
| **Tipos de botão** | REPLY, URL, CALL | Reply (texto plano) | ⚠️ Perder URL/CALL |
| **Label vs Title** | `label` | `title` | Renomear |
| **Max botões** | Até 10 | Até 3 | ⚠️ Limitar |
| **Header/Footer** | ✅ Opcionais | ✅ Opcionais (mas estrutura diferente) | Compatível |
| **Componentes** | Simples | Complexo (header, body, footer, action) | Mais estruturado |

⚠️ **IMPORTANTE:** Meta limita a **3 botões** por mensagem!

---

## 4️⃣ Enviar Vídeo

### Z-API (Antigo)

```typescript
export async function sendVideo(
  userNumber: string,
  videoUrl: string,
  caption?: string,
  options?: { viewOnce?: boolean }
): Promise<void> {
  const response = await api.post('/send-video', {
    phone: sanitizePhoneNumber(userNumber),
    video: videoUrl,
    caption: caption,
    viewOnce: options?.viewOnce,
  });

  logger.info('[Z-API] Video sent:', response.data.messageId);
}
```

### Meta Cloud API (Novo)

```typescript
export async function sendVideo(
  userNumber: string,
  videoUrl: string,
  caption?: string
): Promise<string> {
  const response = await api.post(`/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to: sanitizePhoneNumber(userNumber),
    type: 'video',
    video: {
      link: videoUrl,
      caption: caption,
    },
  });

  const messageId = response.data.messages[0].id;
  logger.info('[Meta] Video sent:', messageId);
  return messageId;
}
```

### Diferenças

| Aspecto | Z-API | Meta | Impacto |
|---------|-------|------|---------|
| **Endpoint** | `/send-video` | `/{id}/messages` | Unificado |
| **View Once** | ✅ Suportado | ❌ Não disponível via Cloud API | ⚠️ Perder feature |
| **Caption** | ✅ Sim | ✅ Sim | Mantém |

---

## 5️⃣ Receber Webhooks

### Z-API (Antigo)

```typescript
// src/routes/webhookZapi.ts
app.post('/webhook/zapi', async (request, reply) => {
  const body = request.body;

  // Z-API envia evento assim:
  // {
  //   "event": "MENSAGEM_NOVA",
  //   "timestamp": 1234567890,
  //   "instanceId": "...",
  //   "payload": {
  //     "messages": [{
  //       "id": "...",
  //       "from": "5511999999999",
  //       "body": "texto",
  //       "timestamp": 1234567890,
  //       "media": { ... } // se tiver mídia
  //     }]
  //   }
  // }

  const message = body.payload?.messages?.[0];
  if (!message) return reply.code(200).send('ok');

  await handleUserMessage({
    from: message.from,
    text: message.body,
    messageId: message.id,
  });

  return reply.code(200).send('ok');
});
```

### Meta Cloud API (Novo)

```typescript
// src/routes/webhookMeta.ts
import crypto from 'crypto';

// Validação de webhook (Meta envia verify_token em query)
app.get('/webhook/meta', (request, reply) => {
  const token = request.query.hub_verify_token;
  const challenge = request.query.hub_challenge;

  if (token === process.env.WHATSAPP_WEBHOOK_TOKEN) {
    return reply.send(challenge);  // Meta valida e ativa webhook
  }

  return reply.code(403).send('Invalid token');
});

// Receber mensagens
app.post('/webhook/meta', async (request, reply) => {
  const body = request.body;

  // Meta envia assim:
  // {
  //   "entry": [{
  //     "changes": [{
  //       "value": {
  //         "messages": [{
  //           "id": "wamid.xxxxx",
  //           "from": "5511999999999",
  //           "timestamp": "1234567890",
  //           "type": "text",
  //           "text": { "body": "..." }
  //         }],
  //         "contacts": [{
  //           "profile": { "name": "João" },
  //           "wa_id": "5511999999999"
  //         }]
  //       }
  //     }]
  //   }]
  // }

  // Extrai mensagem da estrutura aninhada
  const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
  if (!messages || !messages.length) {
    return reply.code(200).send('ok');  // Retorna rápido (Meta quer <20s)
  }

  const message = messages[0];

  // Parse de tipos diferentes
  let payload = {
    from: message.from,
    messageId: message.id,
    timestamp: message.timestamp,
    type: message.type,
  };

  if (message.type === 'text') {
    payload.text = message.text?.body;
  } else if (message.type === 'image') {
    // NOTA: Meta envia media ID, NÃO URL direta!
    // Precisa chamar GET /{media_id} para obter URL temporária
    payload.imageId = message.image?.id;
    payload.imageMimeType = message.image?.mime_type;
  } else if (message.type === 'sticker') {
    payload.stickerId = message.sticker?.id;
  } else if (message.type === 'interactive') {
    payload.buttonId = message.interactive?.button_reply?.id;
    payload.listId = message.interactive?.list_reply?.id;
  }

  // Processa em background
  handleUserMessage(payload).catch(err => {
    logger.error('Failed to process message', err);
  });

  return reply.code(200).send('ok');  // Responde rápido
});
```

### Diferenças

| Aspecto | Z-API | Meta | Impacto |
|---------|-------|------|---------|
| **Estrutura** | Simples `payload` | Aninhada `entry[0].changes[0].value` | ⚠️ Parser mais complexo |
| **Verificação** | Custom token | Verify token em query (GET) | Padrão OAuth mais seguro |
| **Tipos de msg** | Misturados | Separados (type: "text", "image", etc) | Parsing mais explícito |
| **Timestamp** | Number (milliseconds) | String (seconds) | ⚠️ Converter tipo |
| **Media URL** | Em `media.link` | Em `{type}.link` | Estrutura diferente |

---

## 6️⃣ Templates (Marketing)

### Z-API (Antigo)

```typescript
// Z-API não tinha suporte nativo a templates
// Você mandava texto formatado manualmente
await sendText(userNumber, `
💎 *PLANO PREMIUM*
Valor: R$ 5,00/mês
Benefícios: 20 figurinhas/dia
`);
```

### Meta Cloud API (Novo)

```typescript
// Meta permite templates pré-aprovados para compliance
export async function sendTemplate(
  userNumber: string,
  templateName: string,
  parameters?: string[]
): Promise<string> {
  const response = await api.post(`/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to: sanitizePhoneNumber(userNumber),
    type: 'template',
    template: {
      name: templateName,  // ex: 'limit_reached'
      language: {
        code: 'pt_BR',
        policy: 'deterministic',
      },
      components: [
        {
          type: 'body',
          parameters: (parameters || []).map((p) => ({
            type: 'text',
            text: p,
          })),
        },
      ],
    },
  });

  return response.data.messages[0].id;
}

// Uso
await sendTemplate(userNumber, 'limit_reached', ['4', '00:00']);
```

### Diferenças

| Aspecto | Z-API | Meta | Impacto |
|---------|-------|------|---------|
| **Templates** | Não suportado | ✅ Suportado | ✅ Melhor compliance |
| **Pré-aprovação** | N/A | Precisa ser aprovado | Processo manual |
| **Custo** | Mesmo que texto | Mais barato (R$ 0,03) | ✅ Economia |
| **Variáveis** | N/A | Sim (parâmetros dinâmicos) | ✅ Flexibilidade |

---

## 7️⃣ Tratamento de Erros

### Z-API (Antigo)

```typescript
try {
  await api.post('/send-text', payload);
} catch (error) {
  if (error.response?.status === 401) {
    // Token inválido
  } else if (error.response?.status === 429) {
    // Rate limit
  } else if (error.response?.data?.error) {
    // Erro customizado
    console.error(error.response.data.error);
  }
}
```

### Meta Cloud API (Novo)

```typescript
try {
  await api.post(`/${phoneNumberId}/messages`, payload);
} catch (error) {
  if (error.response?.status === 400) {
    // Validação (ex: número inválido)
    // error.response.data.error.message
    logger.error('[Meta] Validation error:', error.response.data);
  } else if (error.response?.status === 401) {
    // Token expirou
    logger.error('[Meta] Unauthorized - token expired');
  } else if (error.response?.status === 429) {
    // Rate limit
    logger.error('[Meta] Rate limited - espere antes de reenviar');
  } else if (error.response?.status === 500) {
    // Erro do servidor Meta
    logger.error('[Meta] Server error - tente novamente');
  }

  throw error;
}
```

**Exemplo de erro 400:**
```json
{
  "error": {
    "message": "Invalid phone number format",
    "type": "OAuthException",
    "code": 400,
    "error_subcode": 2200
  }
}
```

---

## 8️⃣ Download de Mídia (Recebida via Webhook)

### Z-API (Antigo)

```typescript
// Z-API envia URL direta no webhook - basta fazer fetch
const mediaUrl = webhookPayload.image.imageUrl; // URL direta
const buffer = await fetch(mediaUrl).then(r => r.arrayBuffer());
```

### Meta Cloud API (Novo)

```typescript
// Meta envia apenas o media ID no webhook - precisa de 2 chamadas extras

// Passo 1: Receber media ID do webhook
const mediaId = message.image?.id; // ex: "1234567890"

// Passo 2: Obter URL temporária (válida por 5 minutos)
const mediaInfo = await api.get(`/${mediaId}`);
const tempUrl = mediaInfo.data.url;

// Passo 3: Download usando o token de autenticação
const buffer = await fetch(tempUrl, {
  headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
}).then(r => r.arrayBuffer());
```

### Diferenças

| Aspecto | Z-API | Meta | Impacto |
|---------|-------|------|---------|
| **URL no webhook** | ✅ URL direta | ❌ Apenas media ID | ⚠️ Chamada extra |
| **Autenticação** | ❌ Não precisa | ✅ Bearer token no download | Mais seguro |
| **Validade da URL** | Permanente | 5 minutos | ⚠️ Processar rápido |
| **Latência** | 1 request | 2 requests (get URL + download) | ~200ms a mais |

---

## 9️⃣ PIX Button (Sem Equivalente Direto)

### Z-API (Antigo)

```typescript
// Z-API tem endpoint nativo para botão PIX
await api.post('/send-button-pix', {
  phone,
  pixKey: 'chave-pix-copia-e-cola',
  type: 'EVP',
  merchantName: 'StickerBot',
});
```

### Meta Cloud API (Novo)

```typescript
// Meta NÃO tem botão PIX nativo
// Workaround: enviar texto formatado com código PIX copiável

export async function sendPixFallback(
  userNumber: string,
  pixKey: string,
  amount?: string
): Promise<string> {
  const text = [
    '💳 *Pagamento via PIX*',
    '',
    amount ? `Valor: *R$ ${amount}*` : '',
    '',
    'Copie o código abaixo e cole no seu app de pagamento:',
    '',
    `\`\`\`${pixKey}\`\`\``,
    '',
    '✅ Após pagar, envie o comprovante aqui!',
  ].filter(Boolean).join('\n');

  return sendText(userNumber, text);
}

// Alternativa: usar template com botão de URL para link de pagamento
// (requer criar template pré-aprovado na Meta)
```

### Diferenças

| Aspecto | Z-API | Meta | Impacto |
|---------|-------|------|---------|
| **Botão PIX nativo** | ✅ Sim | ❌ Não existe | ⚠️ Perder UX |
| **Workaround** | N/A | Texto formatado ou template com URL | Funcional mas inferior |
| **Experiência** | 1 toque para pagar | Copiar/colar código | ⚠️ Mais fricção |

---

## ⚠️ Regra Crítica: Janela de 24 Horas (Templates)

A Meta Cloud API tem uma regra fundamental que a Z-API não tinha:

### Como funciona

```
Usuário manda mensagem → Abre janela de 24h
                          ↓
                          Dentro de 24h: pode enviar qualquer tipo de mensagem (grátis/barato)
                          ↓
                          Após 24h: SÓ pode enviar templates pré-aprovados (pago)
```

### Impacto no Sticker Bot

| Cenário | Antes (Z-API) | Depois (Meta) |
|---------|---------------|---------------|
| Usuário manda foto e bot responde | Livre | ✅ Grátis (janela aberta) |
| Menu de botões após comando | Livre | ✅ Grátis (janela aberta) |
| Lembrete Wave 1 (6h depois) | Livre | ✅ Utility (R$ 0,03) - dentro da janela |
| Lembrete Wave 2 (48h depois) | Livre | ⚠️ **Precisa de template** (R$ 0,035) |
| Campanha de upgrade (dias depois) | Livre | ⚠️ **Precisa de template** (R$ 0,035) |

### Templates que precisam ser criados e aprovados na Meta

1. `reminder_wave2` - Lembrete de uso (48h+)
2. `upgrade_premium` - Oferta de upgrade
3. `campaign_general` - Campanhas genéricas
4. `payment_confirmation` - Confirmação de pagamento

**Tempo de aprovação:** 24-48h para cada template.

---

## 📝 Nota: Adapter Pattern Existente

O projeto já possui `src/services/whatsappApi.ts` que abstrai o provider via feature flag.
Isso significa que adicionar Meta Cloud API é adicionar um novo `else if` no adapter,
sem tocar nos 17+ arquivos que consomem a API.

```typescript
// whatsappApi.ts já faz isso:
if (featureFlags.USE_ZAPI) {
  return zapiApi.sendText(userNumber, text, options);
} else {
  return evolutionApi.sendText(userNumber, text);
}

// Basta adicionar:
if (featureFlags.USE_META) {
  return metaCloudApi.sendText(userNumber, text);
} else if (featureFlags.USE_ZAPI) {
  return zapiApi.sendText(userNumber, text, options);
}
```

Isso reduz significativamente o esforço - NÃO é preciso alterar imports em cada service.

---

## 📊 Tabela Comparativa Completa

| Funcionalidade | Z-API | Meta Cloud API | Esforço |
|---|---|---|---|
| Enviar texto | ✅ | ✅ | ⭐ Fácil |
| Enviar sticker | ✅ | ✅ | ⭐ Fácil |
| Enviar vídeo | ✅ | ✅ | ⭐ Fácil |
| Botões (Reply) | ✅ REPLY | ✅ | ⭐ Fácil |
| Botões (URL) | ✅ | ❌ | ⚠️ Não suportado |
| Botões (CALL) | ✅ | ❌ | ⚠️ Não suportado |
| PIX Button | ✅ Nativo | ❌ Workaround texto | ⚠️ Perda de UX |
| Delay em mensagens | ✅ | ❌ | ⚠️ Não suportado |
| View once vídeo | ✅ | ❌ | ⚠️ Não suportado |
| Download mídia | ✅ URL direta | ⚠️ 2 requests (ID→URL→download) | ⚠️ Mais complexo |
| Templates | ❌ | ✅ | ⭐ Novo recurso |
| Janela 24h | ❌ Sem restrição | ⚠️ Fora de 24h = só template | ⚠️ **Mudança de paradigma** |
| Webhook simples | ✅ | ✅ (mas estrutura diferente) | ⭐ Rewrite do parser |
| Verify token | ❌ Custom | ✅ | ⭐ Melhor |
| Rate limit | 60/min | 1000/s | ✅ Melhor |
| Custo | R$ 0,08+ | R$ 0,03-0,35 | ✅ Menor |

---

## 🎯 Checklist de Adaptação

### Alto Impacto
- [ ] Criar `metaCloudApi.ts` com mesma interface exportada
- [ ] Adicionar flag `USE_META` no adapter `whatsappApi.ts`
- [ ] Reescrever parser de webhook (estrutura completamente diferente)
- [ ] Implementar download de mídia em 2 passos (media ID → URL → download)
- [ ] Criar e aprovar templates na Meta (lembretes, campanhas, upgrade)
- [ ] Adaptar campanhas/lembretes para usar templates fora da janela de 24h

### Médio Impacto
- [ ] Limitar botões a 3 por mensagem (Meta não aceita mais)
- [ ] Substituir PIX button por texto formatado com código copiável
- [ ] Remover botões URL/CALL (só REPLY é suportado)
- [ ] Adicionar endpoint GET para verificação de webhook (hub_verify_token)
- [ ] Implementar error handling para códigos de erro da Meta

### Baixo Impacto
- [ ] Remover delay de mensagem (não suportado)
- [ ] Adicionar preview_url param para textos
- [ ] Validar tamanho de stickers (.webp max 100KB estático, 500KB animado)
- [ ] Implementar tracking de message_id no novo formato

---

**Próximo:** Começar implementação em `metaCloudApi.ts`
