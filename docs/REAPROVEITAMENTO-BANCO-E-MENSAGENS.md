# ♻️ Reaproveitamento de Banco de Dados, Mensagens e Lógica

**Resposta curta:** ✅ **Sim! ~90% pode ser reutilizado. Apenas a layer de envio (API) e webhook mudam.**

---

## 📊 O Que Continua Igual

### ✅ **Banco de Dados (100% compatível)**

O banco foi feito bem separado da API. Todas as tabelas funcionam identicamente com Meta Cloud API:

```sql
-- Tabelas que CONTINUAM AS MESMAS (nomes reais do banco)

1. users (1,105 rows)
   └─ id (UUID)
   └─ whatsapp_number (TEXT, UNIQUE) -- chave principal de identificação
   └─ name (TEXT)
   └─ daily_count (INT4) -- contador diário de stickers
   └─ daily_limit (INT4) -- limite diário (2/3/4 via experimento)
   └─ subscription_plan (TEXT) -- 'free'/'premium'/'ultra'
   └─ subscription_status (TEXT) -- 'active'/'inactive'
   └─ twitter_download_count (INT4)
   └─ onboarding_step (INT4) -- 1/2/3
   └─ limit_experiment_variant (TEXT) -- 'limit_2'/'limit_3'/'limit_4'
   └─ first_sticker_at, last_interaction, created_at, updated_at

2. stickers (4,912 rows)
   └─ id (UUID)
   └─ user_number (TEXT) -- ref ao whatsapp_number do usuario
   └─ storage_path (TEXT) -- caminho no Supabase Storage
   └─ processed_url (TEXT) -- URL pública do .webp
   └─ file_size (INT4) -- média 82KB
   └─ tipo (TEXT) -- 'estatico'/'animado'
   └─ status (TEXT) -- 'enviado'/'pendente'/'sending'
   └─ face_detected (BOOL) -- 35% dos stickers têm rosto
   └─ emotion_tags (TEXT[]) -- array: 'feliz','triste','surpresa', etc
   └─ celebrity_id (UUID) -- ref a celebrities (142 stickers)
   └─ processing_time_ms (INT4) -- média 4.3s

3. subscriptions (1 row - Stripe)
   └─ id, user_id (UUID)
   └─ stripe_customer_id, stripe_subscription_id, stripe_price_id
   └─ plan_type (TEXT) -- 'premium'/'ultra'
   └─ status (TEXT)
   └─ current_period_start/end (TIMESTAMPTZ)

4. pix_payments (23 rows)
   └─ id, user_id, user_number, user_name
   └─ plan (TEXT), amount (NUMERIC), pix_key (TEXT)
   └─ status (TEXT) -- 'pending'/'activated'
   └─ confirmed_at, activated_at, expires_at

5. campaigns (4 campanhas)
   └─ id, name, description, campaign_type ('instant'/'hybrid'/'event')
   └─ trigger_config (JSONB), target_filter (JSONB)
   └─ status ('active'/'paused'/'draft'), priority (INT4)

6. sequences + sequence_messages (NÃO é 'communication_sequences')
   └─ sequences: id, name, type, steps (JSONB), status, priority
   └─ sequence_messages: id, message_key, body, buttons (JSONB)

7. conversation_contexts (0 rows - limpa por TTL)
   └─ id, user_number (TEXT), state (TEXT), metadata (JSONB)
   └─ expires_at (TIMESTAMPTZ) -- auto-limpeza

8. usage_logs (164,089 rows -- MAIOR tabela, 60MB)
   └─ id, user_number (TEXT), action (TEXT), details (JSONB)
   └─ NÃO existem tabelas 'stickers_sent' ou 'messages_sent' separadas
   └─ Tudo é log em usage_logs com action = 'sticker_sent', 'message_sent', etc

9. pending_sticker_sends (98 rows)
   └─ id, sticker_id, user_id, user_number
   └─ status ('attempting'/'sent'/'failed'), attempt_number, error_message

10. celebrities (8 celebridades, 4 treinadas)
    └─ id, slug, name, embeddings_count, training_status
    └─ celebrity_photos (11 fotos de treino no Storage)

⋯ E mais ~29 tabelas (campaign_events, campaign_steps, campaign_messages,
  user_campaigns, user_sequences, sequence_events, experiment_events,
  experiments, user_experiments, scheduled_reminders, twitter_downloads,
  sticker_packs, sticker_pack_items, url_links, url_clicks, job_logs,
  worker_logs, bot_stickers, campaign_workflow_nodes/edges, etc)
```

**Zero mudança necessária no schema para a migração de API!** (apenas 2-3 colunas novas para tracking de meta_message_id)

---

### ✅ **Mensagens (100% reutilizáveis)**

As mensagens estão no admin-panel como dados JSON estruturados:

```typescript
// admin-panel/src/app/(dashboard)/bot/messages/page.tsx

const messages: BotMessage[] = [
  {
    id: 'welcome_new',
    category: 'onboarding',
    trigger: 'Usuário novo envia qualquer mensagem',
    title: 'Boas-vindas',
    type: 'text',
    content: `👋 Olá, {nome}! Eu sou o *StickerBot*!
📸 Me envie uma *imagem* ou *GIF* e eu transformo em figurinha instantaneamente!`,
    buttons: [/* ... */],
    nextStep: 'Aguarda mídia ou comando',
  },

  {
    id: 'limit_reached',
    category: 'limite',
    trigger: 'Usuário tenta criar sticker mas atingiu limite',
    title: 'Limite Atingido',
    type: 'buttons',
    content: `⚠️ *Limite Atingido!* 🎨
Você já usou *4/4 figurinhas* hoje.`,
    buttons: [
      { id: 'upgrade_premium', text: '💰 Premium - R$ 5/mês' },
      { id: 'upgrade_ultra', text: '🚀 Ultra - R$ 9,90/mês' },
    ],
  },
  // ... 50+ mensagens já prontas
];
```

**Essas mensagens podem ser:**
- ✅ Importadas para um CMS interno
- ✅ Convertidas para Templates da Meta (pré-aprovados)
- ✅ Usadas direto no backend (`menuService.ts`)

---

### ✅ **Serviços de Lógica (99% compatível)**

Todos os serviços de negócio continuam iguais:

```typescript
// src/services/ → TODOS CONTINUAM

menuService.ts
└─ sendLimitReachedMenu()      ✅ Mesmo método
└─ sendPlansListMenu()          ✅ Mesmo método
└─ sendWelcomeMessage()         ✅ Mesmo método

stickerService.ts
└─ processStickerFromImage()    ✅ Sharp/FFmpeg não muda
└─ convertToWebP()              ✅ FFmpeg não muda
└─ uploadToStorage()            ✅ Supabase Storage não muda

messageService.ts
└─ handleUserMessage()          ✅ Lógica não muda
└─ parseButtonClick()           ✅ Parse de botões
└─ orchestrateFlow()            ✅ Fluxo de mensagens

userService.ts
└─ getUserLimits()              ✅ Query ao Supabase
└─ incrementDailyCount()        ✅ RPC ao Supabase
└─ createOrUpdateUser()         ✅ Insert/update

campaignService.ts
└─ sendCampaignMessage()        ✅ Dispara mensagens
└─ trackCampaignEvent()         ✅ Log em banco

reminderService.ts
└─ scheduleReminders()          ✅ BullMQ não muda
└─ sendWave1Reminder()          ✅ Lógica não muda
```

**O projeto já tem um adapter (`whatsappApi.ts`)** que abstrai o provider via feature flags.
Os services acima importam de `whatsappApi.ts`, NÃO de `zapiApi.ts` diretamente.
Isso significa que **nenhum service precisa ter imports alterados** - basta adicionar `USE_META` no adapter.

**Exemplo real do adapter existente:**
```typescript
// src/services/whatsappApi.ts - JÁ EXISTE
export async function sendSticker(userNumber: string, stickerUrl: string): Promise<void> {
  if (featureFlags.USE_ZAPI) {
    return zapiApi.sendSticker(userNumber, stickerUrl);
  } else {
    return evolutionApi.sendSticker(userNumber, stickerUrl);
  }
}

// DEPOIS: adicionar Meta como mais um provider
export async function sendSticker(userNumber: string, stickerUrl: string): Promise<void> {
  if (featureFlags.USE_META) {
    return metaCloudApi.sendSticker(userNumber, stickerUrl);
  } else if (featureFlags.USE_ZAPI) {
    return zapiApi.sendSticker(userNumber, stickerUrl);
  } else {
    return evolutionApi.sendSticker(userNumber, stickerUrl);
  }
}
```

### ⚠️ **Exceções que precisam de mais trabalho**

Nem tudo é "só trocar import". Estes pontos precisam de atenção:

1. **Campanhas/Lembretes fora de 24h**: Meta exige templates pré-aprovados. O `campaignService` e `reminderService` precisam detectar se a janela de 24h está aberta e usar template se não estiver.

2. **PIX Button**: Z-API tinha botão PIX nativo. Meta não tem. O fluxo de pagamento PIX precisa de workaround (texto com código copiável).

3. **Download de mídia no webhook**: Z-API enviava URL direta. Meta envia `media_id` que precisa de 2 chamadas extras para obter o arquivo. O `downloadMedia` no adapter já trata isso parcialmente.

4. **Parser de webhook**: A estrutura do payload é completamente diferente (`entry[0].changes[0].value.messages` vs `payload.messages`). O route de webhook precisa ser reescrito.

---

## 📝 O Que Precisa de Adaptação Pequena

### 🔄 **Tabelas que Precisam de 1-2 Colunas**

```sql
-- ADICIONAR (não deleta nada, só expande):

-- 1. stickers (tabela real - 4,912 rows)
ALTER TABLE stickers
ADD COLUMN IF NOT EXISTS meta_message_id TEXT UNIQUE;
-- Para rastrear o wamid.xxxxx retornado pela Meta

-- 2. pending_sticker_sends (tabela real - 98 rows)
ALTER TABLE pending_sticker_sends
ADD COLUMN IF NOT EXISTS meta_message_id TEXT;
-- Para correlacionar envio com delivery status

-- 3. subscriptions → NENHUMA mudança
-- Stripe continua funcionando igual. Meta cuida das msgs, Stripe do pagamento.

-- 4. NOVA tabela: meta_message_status
CREATE TABLE IF NOT EXISTS meta_message_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,       -- wamid.xxxxx da Meta
  user_number TEXT NOT NULL,      -- whatsapp_number do usuário
  status TEXT,                    -- 'sent', 'delivered', 'read', 'failed'
  error_code TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (user_number) REFERENCES users(whatsapp_number)
);
CREATE INDEX idx_meta_msg_status_user ON meta_message_status(user_number);
CREATE INDEX idx_meta_msg_status_id ON meta_message_status(message_id);

-- NOTA: NÃO existem tabelas 'stickers_sent' ou 'messages_sent'.
-- Logs ficam em 'usage_logs' (164k rows) com campo action.
```

**Isso é tudo.** Nenhuma tabela existente é deletada ou alterada significativamente.

---

## 🎯 O Que SIM Muda

### ❌ **Arquivos que Precisam Ser Atualizados**

```
src/
├── services/
│   ├── metaCloudApi.ts         ← CRIAR (novo provider)
│   ├── whatsappApi.ts          ← ADAPTAR (adicionar USE_META no adapter existente)
│   ├── zapiApi.ts              ← MANTER (para rollback, remover depois)
│   ├── campaignService.ts      ← ADAPTAR (lógica de templates para msgs fora de 24h)
│   └── reminderService.ts      ← ADAPTAR (mesma lógica de 24h)
│
├── routes/
│   ├── webhookZapi.ts          ← MANTER (para rollback)
│   └── webhookMeta.ts          ← CRIAR (parser de webhook totalmente novo)
│
├── config/
│   └── features.ts             ← ADAPTAR (adicionar flag USE_META)
│
└── (resto continua 100% igual - services importam de whatsappApi.ts, não de zapiApi.ts)
```

**Nota:** Graças ao adapter pattern existente, `menuService.ts`, `messageService.ts`, `userService.ts` e outros NÃO precisam ser alterados. Eles já importam de `whatsappApi.ts`.

---

## 💾 Plano de Reaproveitamento (Passo a Passo)

### **Semana 1: Setup Meta + Templates**
- [ ] Configurar Meta Cloud API (checklist no doc anterior)
- [ ] Criar e submeter templates para aprovação (reminder, upgrade, campaign)
- [ ] Criar `metaCloudApi.ts` com mesma interface exportada

### **Semana 2: Implementação**
- [ ] Criar `webhookMeta.ts` (parser de webhook completo)
- [ ] Adicionar flag `USE_META` no adapter `whatsappApi.ts`
- [ ] Adaptar `campaignService` e `reminderService` para lógica de 24h/templates
- [ ] Implementar download de mídia em 2 passos
- [ ] Implementar workaround PIX (texto formatado)

### **Semana 3: Banco + Testes**
- [ ] Executar 2-3 migrations (adicionar colunas meta_message_id)
- [ ] E2E com usuário real (flag USE_META ligada)
- [ ] Validar delivery e cobrança no Ads Manager
- [ ] Testar todos os fluxos: sticker, menu, botões, campanha, PIX

### **Semana 4: Deploy Gradual**
- [ ] Deploy com flag USE_META para % de usuários
- [ ] Monitorar erros e custos
- [ ] Escalar para 100%
- [ ] Desativar Z-API

---

## 📊 Tabela de Reutilização

| Componente | Status | Esforço | Notas |
|---|---|---|---|
| **Banco de dados** | ✅ 100% | Mínimo | Apenas 2-3 colunas novas |
| **Tabelas** | ✅ 100% | Zero | Nenhuma deletada |
| **Mensagens** | ✅ 100% | Zero | Reusar JSON estruturado |
| **menuService** | ✅ 95% | Muito baixo | Adaptar imports |
| **stickerService** | ✅ 100% | Zero | Sharp/FFmpeg não muda |
| **userService** | ✅ 100% | Zero | Queries ao Supabase não mudam |
| **campaignService** | ✅ 95% | Muito baixo | Adaptar imports |
| **reminderService** | ✅ 95% | Muito baixo | Adaptar imports |
| **Fluxos de negócio** | ✅ 100% | Zero | Lógica não muda |
| **Supabase Storage** | ✅ 100% | Zero | Não muda |
| **BullMQ** | ✅ 100% | Zero | Job queue não muda |
| **Stripe** | ✅ 100% | Zero | Pagamento separado |

**Esforço total:** ~2-3 semanas (muito menos do que seria recriar do zero!)

---

## 🎁 Bônus: Código Reutilizável Específico

### **Converter Mensagens para Templates da Meta**

Você pode pegar as mensagens do admin-panel e criar templates pré-aprovados na Meta:

```typescript
// Converter mensagens JSON → Templates Meta
const messages = [
  { id: 'welcome_new', content: '👋 Olá...' },
  { id: 'limit_reached', content: '⚠️ Limite...' },
];

for (const msg of messages) {
  // POST /v21.0/{BUSINESS_ACCOUNT_ID}/message_templates
  await metaApi.createTemplate({
    name: msg.id,
    language: 'pt_BR',
    category: 'MARKETING',
    components: [{
      type: 'BODY',
      text: msg.content,
    }],
  });
}

// Benefícios:
// ✅ Templates pré-aprovados = mais rápido
// ✅ Custo menor (R$ 0,03 vs R$ 0,35)
// ✅ Melhor compliance (mensagens reviadas)
```

### **Reusar Fluxos de Campanhas**

```typescript
// Seus fluxos de campanha (BullMQ) continuam igual

// Antes: sendText(user, message, zapiApi)
// Depois: sendText(user, message, metaApi)

// Tudo que usa os serviços continua funcionando!
```

---

## 🚀 TL;DR (Resumo Executivo)

| O quê | Reutiliza? | Esforço |
|------|-----------|--------|
| **Banco completo** | ✅ Sim | 0h |
| **Tabelas** | ✅ Sim (+ 2-3 colunas) | 1h |
| **Mensagens** | ✅ Sim | 0h |
| **Services via adapter** | ✅ 100% (não precisam mudar) | 0h |
| **Novo metaCloudApi.ts** | Criar do zero | 8-12h |
| **Webhook parser** | Reescrever | 4-6h |
| **Templates (24h rule)** | Criar + adaptar campaign/reminder | 6-8h |
| **PIX workaround** | Texto formatado | 2h |
| **Media download (2 passos)** | Implementar | 2-3h |
| **Storage** | ✅ Sim | 0h |
| **Jobs (BullMQ)** | ✅ Sim | 0h |
| **Stripe payments** | ✅ Sim | 0h |
| | | |
| **TOTAL** | ✅ **~90%** reuso | **~30-40h** |

---

## 📞 Específicos Por Parte

### **Se você quer manter Z-API por enquanto (migração gradual):**

O adapter `whatsappApi.ts` já suporta isso nativamente via feature flags:

```typescript
// src/config/features.ts - adicionar:
USE_META: process.env.USE_META === 'true',

// whatsappApi.ts - o adapter já faz o switch:
// Basta mudar a env var USE_META=true para ativar
// Pode até fazer rollback instantâneo voltando para USE_ZAPI=true
```

### **Se você quer templates da Meta (mais barato):**

Criar templates pré-aprovados para:
- ✅ Bem-vindo (welcome_new)
- ✅ Limite atingido (limit_reached)
- ✅ Lembretes (wave_1, wave_2, wave_3)
- ✅ Confirmação de pagamento

Custa ~R$ 0,03 em vez de R$ 0,35!

---

## ✅ Conclusão

**Você consegue reusar ~90% do projeto.** Essencialmente:

1. ✅ Banco de dados = **continua 100%** (+ 2-3 colunas novas)
2. ✅ Mensagens = **continua 100%**
3. ✅ Lógica de negócio via adapter = **continua 100%** (não precisa mudar imports)
4. ❌ API de envio = **criar metaCloudApi.ts** (novo provider no adapter)
5. ❌ Webhook = **reescrever parser** (estrutura completamente diferente)
6. ⚠️ Campanhas/Lembretes = **adaptar para regra de 24h** (usar templates fora da janela)
7. ⚠️ PIX = **workaround** (texto formatado em vez de botão nativo)

**O adapter pattern existente (`whatsappApi.ts`) é o grande facilitador - ele isola a mudança.**

---

**Próximo passo:** Seguir o checklist em META-SETUP-CHECKLIST.md e depois implementar metaCloudApi.ts
