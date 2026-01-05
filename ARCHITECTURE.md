# 🏗️ StickerBot - Arquitetura e Fluxo Completo

## 📋 Índice
1. [Visão Geral das APIs](#visão-geral-das-apis)
2. [Fluxo Principal](#fluxo-principal)
3. [Fluxo de Assinatura Completo](#fluxo-de-assinatura-completo)
4. [Mensagens e Copies](#mensagens-e-copies)
5. [Listas e Botões Interativos](#listas-e-botões-interativos)
6. [Detalhamento Técnico](#detalhamento-técnico)

---

## 🔄 Visão Geral das APIs

### **Evolution API** (Recepção)
- **Função**: Receber webhooks do WhatsApp
- **Endpoint**: `https://stickers.ytem.com.br/webhook`
- **Responsável por**:
  - Conectar com WhatsApp via Baileys
  - Receber mensagens dos usuários
  - Enviar webhooks para nosso backend
  - Enviar mensagens de TEXTO simples

### **Avisa API** (Envio Interativo)
- **Função**: Enviar mensagens interativas
- **Endpoint**: `https://www.avisaapi.com.br/api`
- **Responsável por**:
  - Enviar LISTAS interativas (selection lists)
  - Enviar BOTÕES interativos
  - Recursos avançados de WhatsApp Business

### **Backend StickerBot**
- **Função**: Processar lógica de negócio
- **Endpoint**: `https://stickers.ytem.com.br`
- **Responsável por**:
  - Receber webhooks da Evolution API
  - Processar comandos e mensagens
  - Decidir qual API usar para resposta
  - Gerenciar assinaturas e limites

---

## 📊 Fluxo Principal

```
┌─────────────┐
│   USUÁRIO   │
│  (WhatsApp) │
└──────┬──────┘
       │
       │ 1. Envia mensagem
       ↓
┌──────────────────┐
│  Evolution API   │ ← Conectado ao WhatsApp via Baileys
│   (VPS Porto)    │
└────────┬─────────┘
         │
         │ 2. Webhook POST
         │    https://stickers.ytem.com.br/webhook
         ↓
┌─────────────────────────────┐
│   Backend StickerBot        │
│   (Docker Swarm - VPS)      │
│                             │
│  1. Valida webhook          │
│  2. Identifica tipo         │
│  3. Processa comando        │
│  4. Decide resposta         │
└──────┬──────────────┬───────┘
       │              │
       │              │
       ↓              ↓
┌──────────────┐  ┌────────────────┐
│ Evolution    │  │  Avisa API     │
│   sendText   │  │  sendList      │
│              │  │  sendButtons   │
└──────┬───────┘  └────────┬───────┘
       │                   │
       │                   │
       └─────────┬─────────┘
                 │
                 ↓
         ┌──────────────┐
         │   WhatsApp   │
         │   (Usuário)  │
         └──────────────┘
```

---

## 🎯 Fluxo de Assinatura Completo

### **1. Novo Usuário - Boas-vindas**

```
Usuário conecta pela primeira vez
         ↓
┌────────────────────────────────┐
│ Backend detecta novo usuário   │
│ Cria registro no Supabase      │
└────────────┬───────────────────┘
             ↓
     ┌───────────────┐
     │ Evolution API │
     │  sendText()   │
     └───────┬───────┘
             ↓
┌─────────────────────────────────────────────────┐
│ 🎉 Olá Paulo, bem-vindo ao *StickerBot*!       │
│                                                 │
│ Envie uma imagem ou GIF e eu transformo        │
│ em figurinha para você! 🎨                     │
│                                                 │
│ ✨ *PLANO GRATUITO*                            │
│ Você tem *4 figurinhas por dia* para usar.    │
│                                                 │
│ 💎 *QUER MAIS?*                                │
│                                                 │
│ [1] 💰 *Premium* - R$ 5,00/mês                 │
│     • 20 figurinhas/dia                        │
│     • 15 vídeos Twitter/dia                    │
│     • Suporte prioritário                      │
│                                                 │
│ [2] 🚀 *Ultra* - R$ 9,90/mês                   │
│     • Figurinhas ILIMITADAS                    │
│     • Vídeos Twitter ILIMITADOS                │
│     • Processamento prioritário                │
│     • Suporte VIP                              │
│                                                 │
│ Digite *1* ou *2* para conhecer os planos!    │
│ Digite *começar* para usar o plano gratuito.  │
└─────────────────────────────────────────────────┘
```

**API Usada:** Evolution API (sendText) - Texto simples
**Arquivo:** `src/services/messageService.ts` → `sendWelcomeMessage()`
**Função:** `getWelcomeMenu()` em `menuService.ts`

---

### **2. Comando "planos" - Lista Interativa**

```
Usuário digita: "planos"
         ↓
┌────────────────────────────────┐
│ Backend processa comando       │
│ Detecta: normalizedText ===    │
│         'planos'               │
└────────────┬───────────────────┘
             ↓
      ┌──────────────┐
      │  Avisa API   │
      │  sendList()  │
      └──────┬───────┘
             ↓
┌─────────────────────────────────────────────────┐
│        💎 *ESCOLHA SEU PLANO*                   │
│                                                 │
│ Selecione o plano ideal para você:             │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ 📋 Ver Planos                    [▼]    │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ Ao clicar abre lista:                          │
│ ┌─────────────────────────────────────────┐   │
│ │ 🆓 Gratuito                             │   │
│ │ 4 figurinhas/dia • 4 vídeos Twitter/dia │   │
│ ├─────────────────────────────────────────┤   │
│ │ 💰 Premium - R$ 5,00/mês                │   │
│ │ 20 figurinhas/dia • 15 vídeos Twitter/  │   │
│ │ dia • Suporte prioritário               │   │
│ ├─────────────────────────────────────────┤   │
│ │ 🚀 Ultra - R$ 9,90/mês                  │   │
│ │ ILIMITADO • Processamento prioritário • │   │
│ │ Suporte VIP                             │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**API Usada:** Avisa API (sendList) - Lista interativa
**Arquivo:** `src/services/menuService.ts` → `sendPlansListMenu()`
**Row IDs:**
- `plan_free` → Plano gratuito
- `plan_premium` → Plano Premium
- `plan_ultra` → Plano Ultra

---

### **3. Usuário Seleciona Plano - Lista de Pagamento**

```
Usuário clica: "💰 Premium - R$ 5,00/mês"
         ↓
┌─────────────────────────────────────────┐
│ Evolution envia webhook:                │
│ type: "listResponseMessage"             │
│ selectedRowId: "plan_premium"           │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Backend processa interação              │
│ Detecta: interactive.id === "plan_      │
│          premium"                       │
│ Salva contexto no Redis:                │
│   state: "awaiting_payment_method"      │
│   metadata: { selected_plan: "premium" }│
└────────────┬────────────────────────────┘
             ↓
      ┌──────────────┐
      │  Avisa API   │
      │  sendList()  │
      └──────┬───────┘
             ↓
┌─────────────────────────────────────────────────┐
│    💰 *PAGAMENTO - PLANO PREMIUM*               │
│                                                 │
│ Valor: R$ 5,00/mês                             │
│                                                 │
│ Escolha sua forma de pagamento:                │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ 💳 Escolher Pagamento            [▼]    │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ Ao clicar abre lista:                          │
│ ┌─────────────────────────────────────────┐   │
│ │ 💳 Cartão de Crédito                    │   │
│ │ Pagamento instantâneo via Stripe        │   │
│ ├─────────────────────────────────────────┤   │
│ │ 🧾 Boleto Bancário                      │   │
│ │ Confirmação em até 3 dias úteis         │   │
│ ├─────────────────────────────────────────┤   │
│ │ 🔑 PIX                                   │   │
│ │ Pagamento instantâneo • Ativação em 5   │   │
│ │ minutos                                 │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**API Usada:** Avisa API (sendList) - Lista interativa
**Arquivo:** `src/services/menuService.ts` → `sendPaymentMethodList()`
**Row IDs:**
- `payment_card` → Cartão de crédito (Stripe)
- `payment_boleto` → Boleto bancário (Stripe)
- `payment_pix` → PIX

---

### **4a. Opção: Cartão/Boleto - Link Stripe**

```
Usuário clica: "💳 Cartão de Crédito"
         ↓
┌─────────────────────────────────────────┐
│ Backend processa:                       │
│ interactive.id === "payment_card"       │
│ Gera link Stripe com metadata           │
└────────────┬────────────────────────────┘
             ↓
      ┌──────────────┐
      │ Evolution API│
      │  sendText()  │
      └──────┬───────┘
             ↓
┌─────────────────────────────────────────────────┐
│ 🎉 *Ótima escolha!*                            │
│                                                 │
│ Você selecionou o plano *Premium* por          │
│ R$ 5,00/mês.                                   │
│                                                 │
│ 🔗 *Clique no link abaixo para pagar:*         │
│                                                 │
│ https://buy.stripe.com/fZuaEWalB8dKb4e9ZS?    │
│ client_reference_id=5511946304133              │
│                                                 │
│ ✅ *Pagamento 100% seguro* via Stripe          │
│ 💳 Cartão, Pix ou boleto                       │
│ 🔄 Cancele quando quiser                       │
│                                                 │
│ ⚡ *Ativação instantânea:*                     │
│ Assim que o pagamento for confirmado, seu      │
│ plano será ativado automaticamente!            │
│                                                 │
│ Tem dúvidas? Digite *ajuda*.                   │
└─────────────────────────────────────────────────┘
```

**API Usada:** Evolution API (sendText) - Texto com link
**Arquivo:** `src/routes/webhook.ts` → Handler de `payment_card`/`payment_boleto`
**Função:** `getPaymentLinkMessage()` em `menuService.ts`

**Webhook Stripe → Backend:**
Quando pagamento confirmado:
```
Stripe → https://stickers.ytem.com.br/stripe/webhook
Backend ativa assinatura no Supabase
Envia mensagem de confirmação
```

---

### **4b. Opção: PIX - Botão Interativo**

```
Usuário clica: "🔑 PIX"
         ↓
┌─────────────────────────────────────────┐
│ Backend processa:                       │
│ interactive.id === "payment_pix"        │
│ Gera chave PIX aleatória                │
│ Cria registro pending no Supabase       │
└────────────┬────────────────────────────┘
             ↓
      ┌──────────────┐
      │  Avisa API   │
      │ sendButtons()│
      └──────┬───────┘
             ↓
┌─────────────────────────────────────────────────┐
│        💰 *Pagamento via PIX*                   │
│                                                 │
│ 📋 *Plano:* Premium                            │
│ 💵 *Valor:* R$ 5,00                            │
│                                                 │
│ 🔑 *Chave PIX (Aleatória):*                    │
│ ```a1b2c3d4-e5f6-7890-abcd-ef1234567890```    │
│                                                 │
│ 📝 *Instruções:*                               │
│ 1. Copie a chave PIX acima                     │
│ 2. Abra seu app de pagamento                   │
│ 3. Faça o PIX no valor exato                   │
│ 4. Após pagar, clique em "Já Paguei"          │
│                                                 │
│ ⏱️ Seu plano será ativado em até 5 minutos    │
│ após a confirmação.                            │
│                                                 │
│ ⚠️ *Importante:* Você tem 30 minutos para      │
│ concluir o pagamento.                          │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │         ✅ Já Paguei                     │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ Pagamento seguro                               │
└─────────────────────────────────────────────────┘
```

**API Usada:** Avisa API (sendButtons) - Botões interativos
**Arquivo:** `src/services/menuService.ts` → `sendPixPaymentWithButton()`
**Button ID:** `button_confirm_pix`

---

### **5. Confirmação PIX - Ativação da Assinatura**

```
Usuário clica: "✅ Já Paguei"
         ↓
┌─────────────────────────────────────────┐
│ Evolution envia webhook:                │
│ type: "buttonsResponseMessage"          │
│ selectedButtonId: "button_confirm_pix"  │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Backend processa:                       │
│ 1. Busca contexto no Redis              │
│ 2. Pega plano selecionado: "premium"    │
│ 3. Cria job no Bull Queue                │
│    → activate-pix-subscription          │
│ 4. Job aguarda 5 minutos                │
│ 5. Ativa assinatura no Supabase         │
└────────────┬────────────────────────────┘
             ↓
      ┌──────────────┐
      │ Evolution API│
      │  sendText()  │
      └──────┬───────┘
             ↓
┌─────────────────────────────────────────────────┐
│ ✅ *Confirmação Recebida!*                     │
│                                                 │
│ 🔄 Estamos processando seu pagamento PIX.      │
│                                                 │
│ ⏱️ Seu plano *Premium* será ativado em até 5   │
│ minutos após a confirmação do pagamento pelo   │
│ banco.                                         │
│                                                 │
│ 📱 Você receberá uma mensagem de confirmação   │
│ assim que seu plano estiver ativo.             │
│                                                 │
│ Agradecemos pela confiança! 🙏                 │
└─────────────────────────────────────────────────┘
```

**API Usada:** Evolution API (sendText) - Texto simples
**Arquivo:** `src/routes/webhook.ts` → Handler de `button_confirm_pix`

**Após 5 minutos (Job Worker):**
```
┌─────────────────────────────────────────┐
│ Worker processa job                     │
│ 1. Ativa assinatura no Supabase         │
│ 2. Define subscription_ends_at = +30d   │
│ 3. Atualiza plan = "premium"            │
└────────────┬────────────────────────────┘
             ↓
      ┌──────────────┐
      │ Evolution API│
      │  sendText()  │
      └──────┬───────┘
             ↓
┌─────────────────────────────────────────────────┐
│ 🎉 *PAGAMENTO CONFIRMADO!*                     │
│                                                 │
│ Seu plano *Premium 💰* foi ativado com         │
│ sucesso!                                       │
│                                                 │
│ ✅ *Benefícios liberados:*                     │
│ • Figurinhas: 20/dia                           │
│ • Vídeos Twitter: 15/dia                       │
│ • Suporte prioritário ✅                       │
│                                                 │
│ 🚀 *Já pode usar agora mesmo!*                 │
│ Envie suas imagens e GIFs para criar           │
│ figurinhas incríveis!                          │
│                                                 │
│ Dúvidas? Digite *ajuda*                        │
└─────────────────────────────────────────────────┘
```

**API Usada:** Evolution API (sendText) - Texto simples
**Arquivo:** `src/workers/subscriptionWorker.ts` → Job handler
**Função:** `getSubscriptionActivatedMessage()` em `menuService.ts`

---

## 📝 Mensagens e Copies

### **Mensagem de Boas-vindas**
```
🎉 Olá {userName}, bem-vindo ao *StickerBot*!

Envie uma imagem ou GIF e eu transformo em figurinha para você! 🎨

✨ *PLANO GRATUITO*
Você tem *4 figurinhas por dia* para usar.

💎 *QUER MAIS?*

[1] 💰 *Premium* - R$ 5,00/mês
    • 20 figurinhas/dia
    • 15 vídeos Twitter/dia
    • Sem marca d'água

[2] 🚀 *Ultra* - R$ 9,90/mês
    • Figurinhas ILIMITADAS
    • Vídeos Twitter ILIMITADOS
    • Processamento prioritário
    • Sem marca d'água

Digite *1* ou *2* para conhecer os planos!
Digite *começar* para usar o plano gratuito.
```
**Arquivo:** `src/services/menuService.ts:28-50`

---

### **Mensagem de Limite Atingido**
```
⚠️ *Limite Atingido!* {emoji}

Você já usou *{dailyCount}/{dailyLimit} {feature}* hoje.

Seu limite será renovado às *00:00* (horário de Brasília).

💎 *UPGRADE E TENHA MAIS!*

[1] 💰 *Premium* - R$ 5,00/mês
    • 20 figurinhas/dia
    • 15 vídeos Twitter/dia
    • Suporte prioritário
    • {benefit}

[2] 🚀 *Ultra* - R$ 9,90/mês
    • Figurinhas *ILIMITADAS*
    • Vídeos Twitter *ILIMITADOS*
    • Processamento prioritário
    • Suporte VIP
    • 🔥 *Nunca mais espere!*

Digite *1* ou *2* para fazer upgrade agora!
```
**Arquivo:** `src/services/menuService.ts:52-77`

---

### **Detalhes Plano Premium**
```
💰 *PLANO PREMIUM*
R$ 5,00/mês - Cancele quando quiser

✨ *BENEFÍCIOS:*
✅ 20 figurinhas por dia
✅ 15 vídeos do Twitter por dia
✅ Suporte prioritário
✅ 5x mais que o plano gratuito!

📊 *COMPARAÇÃO:*
Plano Gratuito: 4 figurinhas/dia
Plano Premium: 20 figurinhas/dia (+400%!)

🎯 *PERFEITO PARA:*
• Quem usa figurinhas regularmente
• Grupos de amigos
• Criadores de conteúdo

Digite *CONFIRMAR* para assinar agora!
Digite *VOLTAR* para ver outros planos.
```
**Arquivo:** `src/services/menuService.ts:79-101`

---

### **Detalhes Plano Ultra**
```
🚀 *PLANO ULTRA*
R$ 9,90/mês - Cancele quando quiser

🔥 *BENEFÍCIOS:*
✅ Figurinhas *ILIMITADAS*
✅ Vídeos Twitter *ILIMITADOS*
✅ Processamento prioritário
✅ Suporte VIP
✅ Nunca mais espere!

📊 *COMPARAÇÃO:*
Plano Gratuito: 4 figurinhas/dia
Plano Premium: 20 figurinhas/dia
Plano Ultra: *ILIMITADO* 🔥

🎯 *PERFEITO PARA:*
• Uso intensivo
• Negócios e marketing
• Administradores de grupos
• Criadores profissionais

Digite *CONFIRMAR* para assinar agora!
Digite *VOLTAR* para ver outros planos.
```
**Arquivo:** `src/services/menuService.ts:103-126`

---

### **Status da Assinatura Ativa**
```
✨ *Sua Assinatura*

📋 Plano: *{planName}*
📅 Renova em: {daysLeft} dias
🔄 Status: Ativo

🎯 *Seus Limites:*
• Figurinhas: {limit}
• Vídeos Twitter: {limit}
• Processamento prioritário ⚡

Continue enviando suas imagens e GIFs! 🎨
```
**Arquivo:** `src/services/menuService.ts:191-207`

---

### **Ajuda**
```
❓ *AJUDA - StickerBot*

🎨 *COMO USAR:*
1. Envie uma imagem ou GIF
2. Receba sua figurinha pronta!
3. Para vídeos do Twitter, envie o link

💎 *COMANDOS:*
• *planos* - Ver planos disponíveis
• *status* - Ver sua assinatura
• *ajuda* - Ver esta mensagem

💳 *PAGAMENTO:*
• Aceitamos cartão, Pix e boleto
• Processamento via Stripe (seguro)
• Cobrança mensal automática
• Cancele quando quiser, sem multa

🔒 *SEGURANÇA:*
Seus dados estão protegidos. Não armazenamos informações de cartão.

Mais dúvidas? Envie sua pergunta que respondo!
```
**Arquivo:** `src/services/menuService.ts:216-238`

---

## 🎛️ Listas e Botões Interativos

### **Lista 1: Planos Disponíveis**

**Trigger:** Usuário digita "planos"

**Estrutura Avisa API:**
```typescript
{
  number: "5511946304133",
  buttontext: "📋 Ver Planos",
  toptext: "💎 *ESCOLHA SEU PLANO*",
  desc: "Selecione o plano ideal para você:",
  list: [
    {
      RowId: "plan_free",
      title: "🆓 Gratuito",
      desc: "4 figurinhas/dia • 4 vídeos Twitter/dia"
    },
    {
      RowId: "plan_premium",
      title: "💰 Premium - R$ 5,00/mês",
      desc: "20 figurinhas/dia • 15 vídeos Twitter/dia • Suporte prioritário"
    },
    {
      RowId: "plan_ultra",
      title: "🚀 Ultra - R$ 9,90/mês",
      desc: "ILIMITADO • Processamento prioritário • Suporte VIP"
    }
  ]
}
```

**Arquivo:** `src/services/menuService.ts:261-285`

**Webhook Retorno (Evolution API):**
```json
{
  "event": "messages.upsert",
  "data": {
    "message": {
      "listResponseMessage": {
        "singleSelectReply": {
          "selectedRowId": "plan_premium"
        }
      }
    }
  }
}
```

---

### **Lista 2: Métodos de Pagamento**

**Trigger:** Usuário seleciona plano (plan_premium ou plan_ultra)

**Estrutura Avisa API:**
```typescript
{
  number: "5511946304133",
  buttontext: "💳 Escolher Pagamento",
  toptext: "💰 *PAGAMENTO - PLANO PREMIUM*",
  desc: "Valor: R$ 5,00/mês\n\nEscolha sua forma de pagamento:",
  list: [
    {
      RowId: "payment_card",
      title: "💳 Cartão de Crédito",
      desc: "Pagamento instantâneo via Stripe"
    },
    {
      RowId: "payment_boleto",
      title: "🧾 Boleto Bancário",
      desc: "Confirmação em até 3 dias úteis"
    },
    {
      RowId: "payment_pix",
      title: "🔑 PIX",
      desc: "Pagamento instantâneo • Ativação em 5 minutos"
    }
  ]
}
```

**Arquivo:** `src/services/menuService.ts:300-340`

---

### **Botão: Confirmar Pagamento PIX**

**Trigger:** Usuário seleciona "payment_pix"

**Estrutura Avisa API:**
```typescript
{
  number: "5511946304133",
  title: "💰 *Pagamento via PIX*",
  desc: `📋 *Plano:* Premium
💵 *Valor:* R$ 5,00

🔑 *Chave PIX (Aleatória):*
\`\`\`a1b2c3d4-e5f6-7890-abcd-ef1234567890\`\`\`

📝 *Instruções:*
1. Copie a chave PIX acima
2. Abra seu app de pagamento
3. Faça o PIX no valor exato
4. Após pagar, clique em "Já Paguei"

⏱️ Seu plano será ativado em até 5 minutos após a confirmação.

⚠️ *Importante:* Você tem 30 minutos para concluir o pagamento.`,
  footer: "Pagamento seguro",
  buttons: [
    {
      id: "button_confirm_pix",
      text: "✅ Já Paguei"
    }
  ]
}
```

**Arquivo:** `src/services/menuService.ts:342-372`

**Webhook Retorno (Evolution API):**
```json
{
  "event": "messages.upsert",
  "data": {
    "message": {
      "buttonsResponseMessage": {
        "selectedButtonId": "button_confirm_pix"
      }
    }
  }
}
```

---

### **Botão: Conversão Twitter para Sticker**

**Trigger:** Após download bem-sucedido de vídeo do Twitter

**Estrutura Avisa API:**
```typescript
{
  number: "5511946304133",
  title: "🎨 *Quer transformar em figurinha?*",
  desc: "Converter em figurinha animada",
  buttons: [
    {
      id: "button_convert_sticker_153ed191-fd42-4f2a-baaa-50118848f167",
      text: "✅ Sim, quero!"
    },
    {
      id: "button_video_only",
      text: "⏭️ Só o vídeo"
    }
  ]
}
```

**Arquivo:** `src/worker.ts:560-599` (após download Twitter)

**Webhook Retorno (Evolution API):**
```json
{
  "event": "messages.upsert",
  "data": {
    "message": {
      "buttonsResponseMessage": {
        "selectedButtonId": "button_convert_sticker_153ed191-fd42-4f2a-baaa-50118848f167"
      }
    }
  }
}
```

**Fluxo Completo:**

```
1️⃣ Usuário envia link Twitter
   → Backend adiciona job download-twitter-video

2️⃣ Worker processa:
   → Baixa vídeo via VxTwitter API
   → Upload para Supabase Storage
   → Envia vídeo para usuário (Evolution API)
   → Salva download_id no banco
   → Envia botões de conversão (Avisa API)

3️⃣ Usuário clica "✅ Sim, quero!"
   → Backend detecta button_convert_sticker_{id}
   → Adiciona job na fila convert-twitter-sticker
   → Envia "🎨 Processando conversão..."

4️⃣ Worker converte:
   → Busca vídeo do Storage (pelo download_id)
   → Processa com FFmpeg (max 10s, 512x512, 15fps)
   → Upload sticker para Storage
   → Envia figurinha animada (Evolution API)
   → Atualiza converted_to_sticker = true
   → Envia "✅ Figurinha criada com sucesso!"

5️⃣ Alternativa: Usuário clica "⏭️ Só o vídeo"
   → Backend envia confirmação
   → "✅ Tudo certo! Seu vídeo está salvo na conversa."
```

**Créditos Utilizados:**
- Download Twitter: 1 crédito Twitter
- Converter para sticker: 1 crédito Sticker (separado!)

**Validações:**
- ✅ Verifica limite de Twitter antes de baixar
- ✅ Verifica limite de Sticker antes de converter
- ✅ Auto-trim vídeos > 10 segundos
- ✅ Idempotência: nunca envia vídeo 2x

---

## 🔧 Detalhamento Técnico

### **Mapeamento API por Tipo de Mensagem**

| Tipo de Mensagem | API Usada | Função | Arquivo |
|-----------------|-----------|---------|---------|
| Texto simples | Evolution API | `sendText()` | `src/services/evolutionApi.ts` |
| Lista interativa | Avisa API | `sendList()` | `src/services/avisaApi.ts` |
| Botões interativos | Avisa API | `sendButtons()` | `src/services/avisaApi.ts` |
| Mídia (sticker, imagem, vídeo) | Evolution API | `sendSticker()`, `sendMedia()` | `src/services/evolutionApi.ts` |

---

### **Fluxo de Webhooks**

```
┌────────────────────────────────────────────────────┐
│             WEBHOOKS - EVOLUTION API               │
└────────────────────────────────────────────────────┘

1. messages.upsert (Nova mensagem)
   ↓
   ┌─ Texto normal → Processa comando
   ├─ Imagem/GIF → Cria job process-sticker
   ├─ Link Twitter → Cria job download-twitter-video
   ├─ listResponseMessage → Processa seleção de lista
   └─ buttonsResponseMessage → Processa clique em botão

2. messages.update (Atualização de status)
   ↓
   Ignorado (apenas tracking)

3. send.message (Mensagem enviada)
   ↓
   Ignorado (fromMe: true)

4. connection.update (Status da conexão)
   ↓
   Log informativo
```

---

### **Estados de Conversação (Redis)**

```typescript
type ConversationState =
  | 'awaiting_payment_method'  // Após selecionar plano
  | 'none'                     // Estado padrão

interface ConversationContext {
  user_number: string;
  state: ConversationState;
  metadata: {
    selected_plan?: 'premium' | 'ultra';
    payment_link?: string;
    timestamp?: string;
  };
  created_at: string;
  expires_at: string; // 10 minutos
}
```

**Arquivo:** `src/utils/conversationContext.ts`

**Key Pattern Redis:** `context:{userNumber}`

**Exemplo:**
```
context:5511946304133 = {
  "user_number": "5511946304133",
  "state": "awaiting_payment_method",
  "metadata": {
    "selected_plan": "premium",
    "timestamp": "2026-01-04T18:26:10.000Z"
  },
  "created_at": "2026-01-04T18:26:10.000Z",
  "expires_at": "2026-01-04T18:36:10.000Z"
}
```

---

### **Jobs no Bull Queue**

**Queue: process-sticker**
- Processa imagens/GIFs
- Transforma em sticker
- Verifica limites diários
- Salva em pending se ultrapassou limite

**Queue: download-twitter-video**
- Baixa vídeos do Twitter
- Valida limites de Twitter
- Upload para Supabase Storage
- Envia vídeo para usuário
- Envia botões de conversão

**Queue: convert-twitter-sticker** (NOVO ✨)
- Converte vídeos Twitter em figurinhas
- Busca vídeo do Storage pelo download_id
- Processa com FFmpeg (auto-trim, resize)
- Verifica limite de Sticker (separado do Twitter!)
- Envia figurinha animada

**Queue: activate-pix-subscription**
- Aguarda 5 minutos (delay)
- Ativa assinatura no Supabase
- Envia mensagem de confirmação

**Queue: scheduled-jobs**
- Roda todo dia às 8h (cron)
- Envia stickers pendentes
- Reseta contadores diários

---

### **Integrações Externas**

**Stripe (Pagamentos)**
- Webhook: `https://stickers.ytem.com.br/stripe/webhook`
- Eventos monitorados:
  - `checkout.session.completed`
  - `invoice.payment_succeeded`
  - `customer.subscription.deleted`

**Supabase (Banco de Dados)**
- Tabelas principais:
  - `users` - Dados dos usuários
  - `stickers` - Histórico de stickers
  - `daily_usage` - Contadores diários

---

### **Logs Importantes**

**Webhook recebido:**
```json
{
  "level": 30,
  "msg": "Webhook received",
  "event": "messages.upsert",
  "instance": "meu-zap",
  "messageType": "listResponseMessage"
}
```

**Resposta interativa detectada:**
```json
{
  "level": 30,
  "msg": "Interactive response detected",
  "userNumber": "5511946304133",
  "type": "list",
  "id": "plan_premium"
}
```

**Menu enviado:**
```json
{
  "level": 30,
  "msg": "Plans list menu sent via Avisa API",
  "userNumber": "5511946304133"
}
```

---

## 🎨 Diagrama de Decisão: Qual API Usar?

```
Preciso enviar mensagem ao usuário
            ↓
    ┌───────────────┐
    │ Que tipo de   │
    │ mensagem?     │
    └───────┬───────┘
            │
    ┌───────┴───────┐
    │               │
    ↓               ↓
┌────────┐    ┌──────────┐
│ TEXTO  │    │ INTERATIVA│
│ SIMPLES│    │ (lista/   │
│        │    │ botões)   │
└───┬────┘    └─────┬────┘
    │               │
    ↓               ↓
┌────────────┐  ┌──────────────┐
│ Evolution  │  │  Avisa API   │
│    API     │  │              │
│ sendText() │  │ sendList()   │
│            │  │ sendButtons()│
└────────────┘  └──────────────┘
```

---

## 📱 Exemplo Real de Fluxo Completo

**Cenário:** Paulo quer assinar o plano Premium com PIX

```
1️⃣ Paulo digita: "planos"
   → Evolution API recebe
   → Backend processa
   → Avisa API envia LISTA interativa
   → Paulo vê 3 opções: Gratuito, Premium, Ultra

2️⃣ Paulo clica: "💰 Premium - R$ 5,00/mês"
   → Evolution API envia webhook (listResponseMessage)
   → Backend processa (selectedRowId: "plan_premium")
   → Salva contexto no Redis (awaiting_payment_method)
   → Avisa API envia LISTA de pagamento
   → Paulo vê 3 opções: Cartão, Boleto, PIX

3️⃣ Paulo clica: "🔑 PIX"
   → Evolution API envia webhook (listResponseMessage)
   → Backend processa (selectedRowId: "payment_pix")
   → Gera chave PIX aleatória
   → Cria registro no Supabase (pending)
   → Avisa API envia BOTÃO "✅ Já Paguei"
   → Paulo faz o PIX no banco

4️⃣ Paulo clica: "✅ Já Paguei"
   → Evolution API envia webhook (buttonsResponseMessage)
   → Backend processa (selectedButtonId: "button_confirm_pix")
   → Cria JOB no Bull Queue (delay 5 min)
   → Evolution API envia TEXTO de confirmação
   → Paulo vê: "✅ Confirmação Recebida! Aguarde 5 min..."

5️⃣ Após 5 minutos:
   → Worker processa job
   → Ativa assinatura no Supabase
   → Evolution API envia TEXTO de ativação
   → Paulo vê: "🎉 PAGAMENTO CONFIRMADO! Seu plano Premium foi ativado!"

6️⃣ Paulo envia uma imagem
   → Evolution API recebe
   → Backend verifica limites (agora tem 20/dia)
   → Cria job process-sticker
   → Worker processa imagem
   → Evolution API envia STICKER
   → Paulo recebe figurinha ✅
```

---

## 🔐 Segurança e Validações

### **Validação de Webhooks**

**Evolution API:**
```typescript
// Verifica se webhook é do nosso instance
if (instance !== process.env.EVOLUTION_INSTANCE) {
  return reply.status(403).send({ error: 'Invalid instance' });
}

// Ignora mensagens enviadas pelo próprio bot
if (fromMe) {
  logger.info('❌ Ignoring message from self');
  return reply.status(200).send({ status: 'ignored_self' });
}
```

**Stripe:**
```typescript
// Verifica assinatura do webhook
const signature = request.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  request.body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### **Rate Limiting**

- **Evolution API:** 10 webhooks/segundo por usuário
- **Avisa API:** 30 mensagens/minuto
- **Bull Queue:** 5 jobs/segundo

### **Expiração de Contextos**

- **Redis Context:** 10 minutos (600s)
- **PIX Payment:** 30 minutos
- **Video Selection:** 5 minutos

---

## 📊 Métricas e Logs

**Eventos Rastreados:**
```typescript
logMenuInteraction(userNumber, 'plans_overview');
logMenuInteraction(userNumber, 'plan_selected', 'premium');
logMenuInteraction(userNumber, 'payment_method_selected', 'pix');
logMenuInteraction(userNumber, 'pix_payment_confirmed');
```

**Logs Estruturados:**
```json
{
  "level": 30,
  "time": 1767562276108,
  "msg": "Interactive response detected",
  "userNumber": "5511946304133",
  "type": "button",
  "id": "button_confirm_pix"
}
```

---

## 🚀 Deploy e Ambiente

**VPS (Production):**
- Evolution API: Docker Swarm
- Backend: Docker Swarm (2 replicas)
- Worker: Docker Swarm (2 replicas)
- Redis: Compartilhado (ytem-databases)
- PostgreSQL: Supabase Cloud

**Local (Development):**
- Evolution API: Docker Compose
- Backend: Docker Compose ou `npm run dev`
- Worker: Docker Compose
- Redis: Docker Compose
- PostgreSQL: Docker Compose

**IMPORTANTE:** Nunca rodar local e VPS ao mesmo tempo com mesma conta WhatsApp!

---

## 📞 Contatos e Links

**APIs:**
- Evolution API: `http://localhost:8080` (local) / `http://evolution_api:8080` (VPS)
- Avisa API: `https://www.avisaapi.com.br/api`
- Stripe: `https://api.stripe.com/v1`
- Supabase: `https://ludlztjdvwsrwlsczoje.supabase.co`

**Documentação:**
- Evolution API: https://doc.evolution-api.com
- Avisa API: https://www.avisaapi.com.br/docs
- Stripe: https://stripe.com/docs/api

---

## ✅ Checklist de Funcionamento

- [ ] Evolution API conectada ao WhatsApp
- [ ] Backend recebendo webhooks
- [ ] Avisa API com token válido
- [ ] Redis funcionando (contextos)
- [ ] Supabase conectado (usuários)
- [ ] Stripe configurado (webhooks)
- [ ] Workers processando jobs
- [ ] Listas interativas funcionando
- [ ] Botões interativos funcionando (PIX, Twitter)
- [ ] Pagamentos PIX funcionando
- [ ] Pagamentos Stripe funcionando
- [ ] Ativação automática de assinaturas
- [ ] Envio de stickers funcionando
- [ ] Download de Twitter funcionando
- [ ] Conversão Twitter → Sticker funcionando

---

**Última atualização:** 05/01/2026
**Versão:** 1.1.0

**Mudanças nesta versão:**
- ✅ Removidas referências a "marca d'água" (feature descontinuada)
- ✅ Adicionados botões de conversão Twitter → Sticker
- ✅ Documentado fluxo completo de conversão interativa
- ✅ Adicionada fila `convert-twitter-sticker`
- ✅ Mensagens simplificadas (sem stats técnicos)
