# 🎯 StickerBot - Arquitetura 360° (Dual-API)

## 📊 Visão Geral

**Estratégia:** Usar **Evolution API** + **Avisa API** em conjunto para maximizar funcionalidades.

| API | Função | Recursos |
|-----|--------|----------|
| **Evolution API** | Receber webhooks + Enviar stickers/vídeos | Webhooks, Stickers, GIFs, Vídeos, Mensagens texto simples |
| **Avisa API** | Mensagens interativas | Botões, Carrosséis, PIX, Menus, Listas |

---

## 🔄 Fluxo Completo de Mensagens

### 1️⃣ ENTRADA (Webhook - Evolution API)
**Arquivo:** `src/routes/webhook.ts`

```
WhatsApp → Evolution API → POST /webhook → Nossa aplicação
```

**Tipos de mensagem recebidos:**
- ✅ Imagens (`imageMessage`)
- ✅ GIFs (`videoMessage` com gifPlayback)
- ✅ Texto (`conversation` ou `extendedTextMessage`)
- ✅ Links do Twitter (texto com URL)

**Validações:**
- ❌ Ignora mensagens de si mesmo (`fromMe: true`)
- ❌ Ignora eventos que não são `messages.upsert`
- ✅ Processa apenas mensagens de usuários

---

### 2️⃣ PROCESSAMENTO POR TIPO

#### 📝 A) COMANDOS GLOBAIS (Texto)

| Comando | Estado Atual | Melhorar com Avisa API |
|---------|--------------|------------------------|
| `planos`, `plans` | ✅ Texto simples | 🚀 **Botões: [1] Premium [2] Ultra** |
| `status`, `assinatura` | ✅ Texto simples | 💡 Botão "Fazer Upgrade" se free |
| `ajuda`, `help`, `começar` | ✅ Texto simples | 💡 Menu de botões com ações |

**Implementação atual:**
```typescript
// webhook.ts linhas 152-190
if (normalizedText === 'planos') {
  await sendText(userNumber, getPlansOverviewMenu()); // Texto simples
  await saveConversationContext(userNumber, 'awaiting_plan_selection');
}
```

**🎯 MELHORIA COM AVISA API:**
```typescript
// Enviar com BOTÕES interativos
await avisaApi.sendInteractiveButtons(userNumber, {
  text: getPlansOverviewMenu(),
  buttons: [
    { id: 'premium', text: '💰 Premium - R$ 5,00' },
    { id: 'ultra', text: '🚀 Ultra - R$ 9,90' }
  ]
});
```

---

#### 💬 B) CONTEXTOS DE CONVERSA (Redis)

**Arquivo:** `src/utils/conversationContext.ts`

**Estados possíveis:**
1. `awaiting_plan_selection` - Aguardando escolha entre Premium/Ultra
2. `awaiting_confirmation` - Aguardando confirmação de compra

**Fluxo atual (TEXTO):**
```
User: "planos"
Bot: [Texto] "Digite 1 ou 2"

User: "1"
Bot: [Texto] "Detalhes Premium... Digite CONFIRMAR"

User: "confirmar"
Bot: [Texto com link de pagamento]
```

**🎯 FLUXO MELHORADO (BOTÕES):**
```
User: "planos"
Bot: [Botões] [💰 Premium] [🚀 Ultra]

User: [Clica em Premium]
Bot: [Carrossel] Detalhes do plano + [Botão CONFIRMAR]

User: [Clica CONFIRMAR]
Bot: [Botão PIX] Link direto para pagamento
```

---

#### 🎨 C) STICKERS/GIFS (Imagens)

**Arquivo:** `src/worker.ts` (worker do BullMQ)

**Fluxo:**
```
1. Webhook recebe imagem/GIF
2. Valida tipo e tamanho
3. Checa limite diário do usuário
4. Adiciona job na fila (BullMQ)
5. Worker processa:
   - Baixa mídia via Evolution API
   - Converte para sticker (Sharp/FFmpeg)
   - Upload no Supabase Storage
   - ENVIA via Evolution API (sendSticker)
6. Atualiza contador diário
7. Envia confirmação ao usuário
```

**CRÍTICO:** Evolution API tem endpoint exclusivo para stickers:
```typescript
// evolutionApi.ts linha 53
await api.post('/message/sendSticker/${instance}', {
  number: sanitizedNumber,
  sticker: stickerUrl,
});
```

**🚨 AVISA API NÃO TEM ENDPOINT DE STICKER**
- ✅ Evolution API: **OBRIGATÓRIO** para stickers
- ❌ Avisa API: Não suporta stickers

---

#### 🐦 D) VÍDEOS DO TWITTER

**Arquivo:** `src/routes/webhook.ts` (linhas 491-575)

**Fluxo:**
```
1. Detecta URL do Twitter no texto
2. Checa limite de downloads de vídeo
3. Extrai tweet info (ID, username)
4. Adiciona job no downloadTwitterVideoQueue
5. Worker baixa vídeo usando youtube-dl
6. Upload no Supabase
7. ENVIA via Evolution API (sendVideo)
8. Incrementa contador de Twitter
```

**Evolution API:**
```typescript
// evolutionApi.ts linha 192-247
await api.post('/message/sendMedia/${instance}', {
  number: sanitizedNumber,
  mediatype: 'video',
  media: videoUrl,
  caption: 'Vídeo baixado!',
});
```

**🚨 AVISA API:**
- ✅ Provavelmente **TEM** endpoint para vídeos
- Mas Evolution já funciona perfeitamente
- Manter Evolution para compatibilidade

---

### 3️⃣ MENUS E MENSAGENS

**Arquivo:** `src/services/menuService.ts`

#### 📋 Menus Existentes (TODOS EM TEXTO)

| Menu | Função | Linha | Uso Atual |
|------|--------|-------|-----------|
| `getWelcomeMenu()` | Boas-vindas | 21 | Texto + "Digite 1 ou 2" |
| `getLimitReachedMenu()` | Limite atingido | 49 | Texto + "Digite 1 ou 2" |
| `getPlanDetailsMenu()` | Detalhes Premium/Ultra | 82 | Texto + "Digite CONFIRMAR" |
| `getPlansOverviewMenu()` | Lista de planos | 136 | Texto + "Digite 1 ou 2" |
| `getPaymentLinkMessage()` | Link de pagamento | 163 | Texto + URL Stripe |
| `getSubscriptionActivatedMessage()` | Confirmação pagamento | 192 | Texto puro |
| `getSubscriptionActiveMessage()` | Status da assinatura | 215 | Texto puro |
| `getHelpMessage()` | Ajuda | 250 | Texto + lista de comandos |

---

## 🎯 PLANO DE INTEGRAÇÃO AVISA API

### ✅ ONDE USAR AVISA API (Mensagens Interativas)

#### 1. **Menu de Boas-Vindas** (`getWelcomeMenu`)
**ATUAL:** Texto
```
Digite *1* ou *2* para conhecer os planos!
```

**🚀 AVISA API:**
```json
{
  "type": "interactive_buttons",
  "buttons": [
    {"id": "premium", "text": "💰 Premium - R$ 5,00"},
    {"id": "ultra", "text": "🚀 Ultra - R$ 9,90"},
    {"id": "free", "text": "🆓 Usar Grátis"}
  ]
}
```

---

#### 2. **Limite Atingido** (`getLimitReachedMenu`)
**ATUAL:** Texto
```
Digite *1* ou *2* para fazer upgrade agora!
```

**🚀 AVISA API:**
```json
{
  "type": "interactive_buttons",
  "buttons": [
    {"id": "premium", "text": "💰 Premium (5x mais)"},
    {"id": "ultra", "text": "🚀 Ultra (ILIMITADO)"}
  ]
}
```

---

#### 3. **Detalhes do Plano** (`getPlanDetailsMenu`)
**ATUAL:** Texto longo + "Digite CONFIRMAR"

**🚀 AVISA API - CARROSSEL:**
```json
{
  "type": "carousel",
  "cards": [
    {
      "title": "💰 Premium",
      "description": "R$ 5,00/mês\n20 figurinhas/dia\n15 vídeos Twitter/dia",
      "buttons": [
        {"id": "confirm_premium", "text": "✅ Assinar Premium"}
      ]
    },
    {
      "title": "🚀 Ultra",
      "description": "R$ 9,90/mês\nFigurinhas ILIMITADAS\nVídeos ILIMITADOS",
      "buttons": [
        {"id": "confirm_ultra", "text": "✅ Assinar Ultra"}
      ]
    }
  ]
}
```

---

#### 4. **Link de Pagamento** (`getPaymentLinkMessage`)
**ATUAL:** Texto + URL do Stripe

**🚀 AVISA API - BOTÃO DE AÇÃO:**
```json
{
  "type": "interactive_url_button",
  "text": "Você selecionou Premium por R$ 5,00/mês",
  "button": {
    "text": "💳 Pagar Agora",
    "url": "https://buy.stripe.com/..."
  }
}
```

**💡 FUTURO - PIX NATIVO:**
```json
{
  "type": "pix_payment",
  "amount": 5.00,
  "description": "Sticker Bot Premium - Mensal",
  "merchant_name": "StickerBot"
}
```

---

#### 5. **Planos Overview** (`getPlansOverviewMenu`)
**ATUAL:** Texto

**🚀 AVISA API - LISTA INTERATIVA:**
```json
{
  "type": "interactive_list",
  "header": "💎 Escolha seu plano",
  "sections": [
    {
      "title": "Planos Pagos",
      "rows": [
        {
          "id": "premium",
          "title": "💰 Premium - R$ 5,00",
          "description": "20 figurinhas/dia, sem marca d'água"
        },
        {
          "id": "ultra",
          "title": "🚀 Ultra - R$ 9,90",
          "description": "ILIMITADO, processamento prioritário"
        }
      ]
    }
  ]
}
```

---

### ❌ ONDE NÃO USAR AVISA API (Manter Evolution)

| Funcionalidade | Motivo | API |
|----------------|--------|-----|
| **Enviar Stickers** | Avisa não tem endpoint | Evolution ✅ |
| **Processar GIFs** | Conversão + envio como sticker | Evolution ✅ |
| **Enviar Vídeos** | Evolution já funciona bem | Evolution ✅ |
| **Receber Webhooks** | Sistema atual funcionando | Evolution ✅ |
| **Download de mídia** | Evolution descriptografa WhatsApp | Evolution ✅ |

---

## 🏗️ ARQUITETURA PROPOSTA

### Camada de Serviços

```
src/services/
├── evolutionApi.ts    ← JÁ EXISTE (stickers, vídeos, webhooks)
├── avisaApi.ts        ← CRIAR (botões, carrosséis, PIX)
└── messagingService.ts ← CRIAR (decide qual API usar)
```

### messagingService.ts (Abstração)

```typescript
export async function sendWelcomeMessage(userNumber: string, userName: string) {
  // Decide qual API usar baseado no tipo de mensagem

  if (FEATURE_FLAGS.use_interactive_menus) {
    // Usa Avisa API com botões
    await avisaApi.sendInteractiveButtons(userNumber, {
      text: getWelcomeMenu(userName),
      buttons: [
        { id: 'premium', text: '💰 Premium' },
        { id: 'ultra', text: '🚀 Ultra' },
        { id: 'free', text: '🆓 Grátis' }
      ]
    });
  } else {
    // Fallback: Evolution API (texto simples)
    await evolutionApi.sendText(userNumber, getWelcomeMenu(userName));
  }
}

export async function sendSticker(userNumber: string, stickerUrl: string) {
  // Stickers SEMPRE via Evolution API (Avisa não suporta)
  await evolutionApi.sendSticker(userNumber, stickerUrl);
}
```

---

## 📦 Endpoints Necessários da Avisa API

### 1. Enviar Mensagem com Botões
```
POST /api/send/buttons
Authorization: Bearer ROm8VZyoVYWTBmJjHfANrV3Ls3vF5SwLuzonI7U68K6l40SfKUIOJkybF6iq

{
  "phone": "5511999999999",
  "text": "Escolha um plano:",
  "buttons": [
    {"id": "premium", "text": "Premium"},
    {"id": "ultra", "text": "Ultra"}
  ]
}
```

### 2. Enviar Carrossel
```
POST /api/send/carousel
{
  "phone": "5511999999999",
  "cards": [...]
}
```

### 3. Enviar Lista Interativa
```
POST /api/send/list
{
  "phone": "5511999999999",
  "header": "Planos",
  "sections": [...]
}
```

### 4. Botão PIX (se disponível)
```
POST /api/send/pix
{
  "phone": "5511999999999",
  "amount": 5.00,
  "description": "Premium"
}
```

---

## 🔄 Fluxo de Integração

### FASE 1: Pesquisa
- [x] Mapear arquitetura atual
- [ ] Acessar documentação Avisa API
- [ ] Identificar endpoints disponíveis
- [ ] Validar suporte a botões/carrosséis/PIX

### FASE 2: Desenvolvimento
- [ ] Criar `avisaApi.ts` service
- [ ] Criar `messagingService.ts` (abstração)
- [ ] Adicionar feature flags
- [ ] Atualizar menus para usar botões

### FASE 3: Migração Gradual
- [ ] Testar menu de boas-vindas com botões
- [ ] Testar limite atingido com botões
- [ ] Testar detalhes de plano com carrossel
- [ ] Testar pagamento com botão de URL

### FASE 4: Produção
- [ ] Deploy em staging
- [ ] Testes A/B (texto vs botões)
- [ ] Monitorar taxa de conversão
- [ ] Deploy em produção

---

## ⚙️ Configuração

### Variáveis de Ambiente (Doppler)

```bash
# Evolution API (atual)
EVOLUTION_API_URL=http://evolution_api:8080
EVOLUTION_API_KEY=YOUR_EVOLUTION_API_KEY
EVOLUTION_INSTANCE=meu-zap

# Avisa API (adicionar)
AVISA_API_URL=https://www.avisaapi.com.br/api
AVISA_API_TOKEN=ROm8VZyoVYWTBmJjHfANrV3Ls3vF5SwLuzonI7U68K6l40SfKUIOJkybF6iq

# Feature Flags
USE_INTERACTIVE_MENUS=true
USE_PIX_PAYMENT=false  # Quando disponível
```

---

## 📊 Métricas para Acompanhar

| Métrica | Antes (Texto) | Depois (Botões) | Meta |
|---------|---------------|-----------------|------|
| Taxa de conversão (Free → Paid) | ? | ? | +30% |
| Tempo médio para upgrade | ? | ? | -50% |
| Taxa de abandono no checkout | ? | ? | -40% |
| Erros de digitação (resposta inválida) | Alto | Baixo | -90% |

---

## 🎯 RESUMO EXECUTIVO

**USAR EVOLUTION API:**
- ✅ Receber todos os webhooks
- ✅ Enviar stickers (EXCLUSIVO)
- ✅ Enviar GIFs processados
- ✅ Baixar mídias criptografadas
- ✅ Enviar vídeos do Twitter

**USAR AVISA API:**
- 🚀 Menus com botões interativos
- 🚀 Carrosséis de produtos (planos)
- 🚀 Listas de seleção
- 🚀 Botões de URL (pagamento)
- 🚀 PIX nativo (futuro)

**RESULTADO ESPERADO:**
- ✨ Experiência de usuário 10x melhor
- 📈 Aumento significativo em conversões
- 🎯 Menos erros de digitação
- ⚡ Processo de compra mais rápido
