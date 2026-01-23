# 🏗️ StickerBot - Arquitetura e Fluxo Completo

## 📋 Índice
1. [Visão Geral das APIs](#visão-geral-das-apis)
2. [Fluxo Principal](#fluxo-principal)
3. [Detecção de Números Internacionais](#-detecção-de-números-internacionais) 🆕
4. [Fluxo Estratégico: Mensagens de Texto](#-fluxo-estratégico-mensagens-de-texto) 🆕
5. [Fluxo de Assinatura Completo](#fluxo-de-assinatura-completo)
6. [Mensagens e Copies](#mensagens-e-copies)
7. [Listas e Botões Interativos](#listas-e-botões-interativos)
8. [Detalhamento Técnico](#detalhamento-técnico)

---

## 🔄 Visão Geral das APIs

### **Evolution API** (Recepção + Envio)
- **Função**: Receber webhooks e enviar mensagens básicas
- **Endpoint**: `https://your-domain.com/webhook`
- **Responsável por**:
  - Conectar com WhatsApp via Baileys
  - Receber mensagens dos usuários
  - Enviar webhooks para nosso backend
  - Enviar mensagens de TEXTO simples
  - Enviar mídia (stickers, imagens, vídeos)
  - **🌍 Fallback para números internacionais** (quando Avisa API não suporta)

### **Avisa API** (Envio Interativo)
- **Função**: Enviar mensagens interativas
- **Endpoint**: `https://www.avisaapi.com.br/api`
- **⚠️ LIMITAÇÃO**: Suporta apenas números brasileiros (+55)
- **Responsável por**:
  - Enviar LISTAS interativas (selection lists)
  - Enviar BOTÕES interativos
  - Enviar BOTÕES PIX (copia e cola nativo)
  - Recursos avançados de WhatsApp Business
- **Fallback automático**: Números internacionais são convertidos para texto via Evolution API

### **Backend StickerBot**
- **Função**: Processar lógica de negócio
- **Endpoint**: `https://your-domain.com`
- **Responsável por**:
  - Receber webhooks da Evolution API
  - Processar comandos e mensagens
  - **Detectar número brasileiro vs internacional**
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
         │    https://your-domain.com/webhook
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

## 🌍 Detecção de Números Internacionais

### **Problema**
A Avisa API suporta apenas números brasileiros (+55). Números internacionais (ex: Angola +244, EUA +1) recebem erro "Could not validate the provided number".

### **Solução: Fallback Automático**

```
Enviar mensagem interativa
           ↓
    ┌──────────────────┐
    │ isBrazilianNumber│
    │   (número)       │
    └────────┬─────────┘
             │
    ┌────────┴────────┐
    │                 │
    ↓                 ↓
┌────────┐      ┌────────────┐
│ +55?   │      │ Outro DDI? │
│ SIM    │      │ NÃO        │
└───┬────┘      └─────┬──────┘
    │                 │
    ↓                 ↓
┌────────────┐  ┌──────────────────┐
│ Avisa API  │  │ Evolution API    │
│ (interativo)│  │ (texto fallback) │
└────────────┘  └──────────────────┘
```

### **Funções Afetadas**

**Arquivo:** `src/services/avisaApi.ts`

| Função | BR (+55) | Internacional |
|--------|----------|---------------|
| `sendButtons()` | Botões nativos WhatsApp | Texto numerado: `1. Opção A\n2. Opção B` |
| `sendList()` | Lista interativa dropdown | Texto com itens: `📋 *Título:*\n1. *Item* - desc` |
| `sendPixButton()` | Botão PIX copia e cola | Código PIX em bloco de código |

### **Exemplo: sendButtons() para Angola**

**Input:**
```typescript
await sendButtons({
  number: '244974983551', // Angola
  title: '⚠️ Limite Atingido!',
  buttons: [
    { id: 'btn_premium', text: '💰 Premium' },
    { id: 'btn_ultra', text: '🚀 Ultra' },
  ]
});
```

**Output (texto via Evolution API):**
```
⚠️ Limite Atingido!

📋 *Opções:*
1. 💰 Premium
2. 🚀 Ultra
```

### **Detecção de Número Brasileiro**

```typescript
// src/services/avisaApi.ts:15-18
export function isBrazilianNumber(phoneNumber: string): boolean {
  const sanitized = phoneNumber.replace(/\D/g, '');
  return sanitized.startsWith('55');
}
```

**Arquivo:** `src/services/avisaApi.ts:15-18`

---

## 💬 Fluxo Estratégico: Mensagens de Texto

### **Problema Anterior**
Quando usuário enviava texto (ex: "oi"), o bot respondia com `getReminderMessage()` em TODA mensagem, causando spam.

### **Solução: Fluxo Estratégico (v1.6.0)**

```
Usuário envia TEXTO
        ↓
┌───────────────────────────┐
│ Verificar status usuário  │
└──────────┬────────────────┘
           │
    ┌──────┴──────┬──────────────┐
    ↓             ↓              ↓
┌────────┐  ┌──────────┐   ┌──────────┐
│ NOVO   │  │ ATINGIU  │   │ TEM      │
│ USUÁRIO│  │ LIMITE   │   │ QUOTA    │
└───┬────┘  └────┬─────┘   └────┬─────┘
    │            │              │
    ↓            ↓              ↓
┌──────────┐ ┌───────────┐ ┌──────────┐
│ Welcome  │ │ Upgrade   │ │ Silêncio │
│ Message  │ │ Menu      │ │ (200 OK) │
└──────────┘ └───────────┘ └──────────┘
```

### **Cenários**

**1. Novo Usuário (`onboarding_step === 0`)**
```
Usuário: "oi"
Bot: "🎉 Olá Paulo, bem-vindo ao *StickerBot*!

Envie uma imagem, vídeo ou GIF agora mesmo que eu transformo em figurinha! 🎨"
```

**2. Usuário que Atingiu Limite**
```
Usuário: "oi"
Bot: [Menu de upgrade com botões Premium/Ultra]
```
- Converte touchpoint em oportunidade de conversão
- A/B test: grupo controle vs grupo bônus

**3. Usuário com Quota Disponível**
```
Usuário: "oi"
Bot: (silêncio - não responde)
```
- Evita spam
- Usuário sabe usar o bot (já criou stickers)

### **Arquivo:** `src/routes/webhook.ts:1004-1066`

### **Deprecação: getReminderMessage()**

```typescript
/**
 * @deprecated Replaced by strategic flow in webhook.ts (2026-01-08)
 * - User with quota available → Silent ignore (no spam)
 * - User who hit limit → Upgrade menu (conversion opportunity)
 */
export function getReminderMessage(): string { ... }
```

**Arquivo:** `src/services/menuService.ts:650-661`

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
│ Envie uma imagem, vídeo ou GIF agora mesmo    │
│ que eu transformo em figurinha! 🎨            │
└─────────────────────────────────────────────────┘
```

**Estratégia:** Mensagem curta focada em ação imediata (Time to Value)
- Sem upsell no primeiro contato
- Usuário pode começar a usar imediatamente
- Planos são apresentados apenas quando usuário digita "planos" ou atinge limite

**API Usada:** Evolution API (sendText) - Texto simples
**Arquivo:** `src/services/messageService.ts` → `sendWelcomeMessage()`
**Função:** `getWelcomeMenu()` em `menuService.ts:23-27`

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
**Arquivo:** `src/services/menuService.ts:435-473` → `sendPlansListMenu()`
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
**Arquivo:** `src/services/menuService.ts:478-523` → `sendPaymentMethodList()`
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
│ client_reference_id=5511999999999              │
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
**Função:** `getPaymentLinkMessage()` em `menuService.ts:280-304`

**Webhook Stripe → Backend:**
Quando pagamento confirmado:
```
Stripe → https://your-domain.com/stripe/webhook
Backend ativa assinatura no Supabase
Envia mensagem de confirmação
```

---

### **4b. Opção: PIX - Fluxo em 3 Mensagens** ✨

```
Usuário clica: "🔑 PIX"
         ↓
┌─────────────────────────────────────────┐
│ Backend processa:                       │
│ interactive.id === "payment_pix"        │
│ Gera chave PIX aleatória (UUID)         │
│ Cria registro pending no Supabase       │
│ Envia 3 mensagens sequenciais:          │
└────────────┬────────────────────────────┘
             ↓
```

**Mensagem 1: Instruções** (Evolution API - sendText)
```
┌─────────────────────────────────────────────────┐
│        💰 *Pagamento via PIX*                   │
│                                                 │
│ 📋 *Plano:* Premium                            │
│ 💵 *Valor:* R$ 5,00                            │
│                                                 │
│ 📝 *COMO PAGAR:*                               │
│                                                 │
│ 1️⃣ Copie a chave PIX que vou enviar agora     │
│ 2️⃣ Abra seu app de pagamento                  │
│ 3️⃣ Cole a chave e pague *R$ 5,00*             │
│ 4️⃣ Após pagar, clique em "✅ Já Paguei"       │
│                                                 │
│ ⏱️ *Importante:*                               │
│ • Você tem 30 minutos para pagar               │
│ • Ativação em até 5 minutos após confirmação  │
│                                                 │
│ Enviando chave PIX... ⬇️                       │
└─────────────────────────────────────────────────┘
```

**Delay: 500ms**

**Mensagem 2: Chave PIX** (Avisa API - sendPixButton)
```
┌─────────────────────────────────────────────────┐
│ a1b2c3d4-e5f6-7890-abcd-ef1234567890           │
│                                                 │
│ [Botão nativo WhatsApp para copiar facilmente] │
└─────────────────────────────────────────────────┘
```

**Delay: 500ms**

**Mensagem 3: Confirmação** (Avisa API - sendButtons)
```
┌─────────────────────────────────────────────────┐
│              ✅ *Pagou?*                        │
│                                                 │
│ Clique no botão abaixo após fazer o PIX:      │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │         ✅ Já Paguei                     │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ Pagamento seguro                               │
└─────────────────────────────────────────────────┘
```

**APIs Usadas:**
- Evolution API (sendText) - Instruções
- Avisa API (sendPixButton) - Chave PIX com botão de copiar
- Avisa API (sendButtons) - Botão de confirmação

**Arquivo:** `src/services/menuService.ts:533-592` → `sendPixPaymentWithButton()`
**Button ID:** `button_confirm_pix`
**Endpoint PIX:** `POST /buttons/pix` (Avisa API)

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
**Arquivo:** `src/jobs/activatePendingPixSubscription.ts` → Job handler
**Função:** `getSubscriptionActivatedMessage()` em `menuService.ts:309-326`

---

## 📝 Mensagens e Copies

### **Mensagem de Boas-vindas**
```
🎉 Olá {userName}, bem-vindo ao *StickerBot*!

Envie uma imagem, vídeo ou GIF agora mesmo que eu transformo em figurinha! 🎨
```

**Estratégia:** Mensagem curta focada em "Time to Value"
- Usuário pode começar imediatamente
- Sem upsell no primeiro contato
- Planos apresentados via comando "planos" ou ao atingir limite

**Arquivo:** `src/services/menuService.ts:23-27`

---

### **Mensagem de Limite Atingido (Teste A/B com Botões Interativos)**

**Implementação:** Teste A/B entre dois grupos (50/50):
- **Grupo Controle**: Upsell direto com botões de upgrade
- **Grupo Bônus**: Oferta de créditos extras + upsell

**Grupo Controle** (apenas upgrade):
```
⚠️ *Limite Atingido!* {emoji}

Você já usou *{dailyCount}/{dailyLimit} {feature}* hoje.

Seu limite será renovado às *00:00* (horário de Brasília).

💎 *FAÇA UPGRADE E TENHA MAIS!*

💰 *Premium (R$ 5/mês)*
• 20 figurinhas/dia
• 15 vídeos Twitter/dia

🚀 *Ultra (R$ 9,90/mês)*
• Figurinhas *ILIMITADAS*
• Vídeos Twitter *ILIMITADOS*
• Processamento prioritário

[BOTÃO: 💰 Premium - R$ 5/mês] [BOTÃO: 🚀 Ultra - R$ 9,90/mês] [BOTÃO: ❌ Agora Não]
```

**Grupo Bônus** (bônus + upgrade):
```
⚠️ *Limite Atingido!* {emoji}

Você já usou *{dailyCount}/{dailyLimit} {feature}* hoje.

🎁 *PRESENTE ESPECIAL!*
Ganhe *+{bonusRemaining} {feature}* extras hoje!

Seu limite será renovado às *00:00*.

💎 *OU FAÇA UPGRADE:*

💰 *Premium (R$ 5/mês)*
• 20 figurinhas/dia
• 15 vídeos Twitter/dia

🚀 *Ultra (R$ 9,90/mês)*
• *ILIMITADO* 🔥

[BOTÃO: 🎁 Usar Bônus (+2)] [BOTÃO: 💰 Premium] [BOTÃO: 🚀 Ultra] [BOTÃO: ❌ Agora Não]
```

**Lógica de Bônus:**
- Máximo de 2 créditos extras por dia
- Cada clique em "Usar Bônus" incrementa `bonus_credits_today`
- Limite efetivo = limite base + bônus ativados
- Reset automático à meia-noite

**Tracking A/B:**
- Atribuição aleatória (50/50) no cadastro em `ab_test_group`
- Logs de conversão: `ab_test_upgrade_click`, `ab_test_bonus_used`, `ab_test_upgrade_dismissed`
- Armazenado em: `users.ab_test_group`, `users.bonus_credits_today`

**Arquivo:** `src/services/menuService.ts:66-199` → `sendLimitReachedMenu()`

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
**Arquivo:** `src/services/menuService.ts:204-251` → `getPlanDetailsMenu()`

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
**Arquivo:** `src/services/menuService.ts:204-251` → `getPlanDetailsMenu('ultra')`

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
**Arquivo:** `src/services/menuService.ts:331-349` → `getSubscriptionActiveMessage()`

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
**Arquivo:** `src/services/menuService.ts:365-388` → `getHelpMessage()`

---

### **Criação de Sticker - Silenciosa** ✨

**Após criação de sticker:**
```
(Apenas o sticker é enviado - SEM mensagens de confirmação)
(SEM botões de edição automáticos)
(SEM contagem de limite restante)
```

**Estratégia:**
- Stickers enviados silenciosamente
- Usuário não é interrompido
- Experiência fluida e limpa
- Mensagens APENAS quando atingir o limite

**Arquivo:** `src/worker.ts:102-157` → processStickerWorker (status handling)

---

### **Edição de Sticker - Processamento**

**Removendo bordas:**
```
🧹 *Removendo bordas...*

✨ Estou limpando as bordas brancas da sua figurinha!

Aguarde alguns segundos... ⏳
```

**Removendo fundo:**
```
✨ *Removendo fundo...*

🎨 Estou criando uma versão sem fundo da sua imagem!

Aguarde alguns segundos... ⏳
```

**Sticker perfeita (confirmação):**
```
✅ *Ótimo!*

🎁 Você tem *{remaining} figurinha{s} restante{s}* hoje.

Envie outra imagem quando quiser! 🎨
```

**Arquivo:** `src/routes/webhook.ts:508-663`

---

### **Edição de Sticker - Erro/Expiração**

**Contexto expirado (após 10 minutos):**
```
❌ *Contexto expirado*

Essa edição não está mais disponível.

Envie uma nova imagem para criar outra figurinha!
```

**Erro no processamento:**
```
❌ *Erro ao remover {tipo}*

Houve um problema ao processar sua imagem.

Por favor, tente novamente ou envie outra imagem.
```

**Arquivo:** `src/routes/webhook.ts:514-517`, `src/worker.ts:1203-1218`

---

## 🎛️ Listas e Botões Interativos

### **Lista 1: Planos Disponíveis**

**Trigger:** Usuário digita "planos"

**Estrutura Avisa API:**
```typescript
{
  number: "5511999999999",
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

**Arquivo:** `src/services/menuService.ts:435-473` → `sendPlansListMenu()`

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
  number: "5511999999999",
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

**Arquivo:** `src/services/menuService.ts:478-523` → `sendPaymentMethodList()`

---

### **Botão: Confirmar Pagamento PIX**

**Trigger:** Usuário seleciona "payment_pix"

**Estrutura Avisa API:**
```typescript
{
  number: "5511999999999",
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

**Arquivo:** `src/services/menuService.ts:533-592` → `sendPixPaymentWithButton()`

**Webhook Retorno (Evolution API ou Avisa API):**

Evolution API format:
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

Avisa API format (templateButtonReplyMessage):
```json
{
  "event": "messages.upsert",
  "data": {
    "message": {
      "templateButtonReplyMessage": {
        "selectedId": "button_confirm_pix",
        "selectedDisplayText": "✅ Já Paguei"
      }
    }
  }
}
```

**Bug Fix v1.4.0:** Sistema agora detecta ambos os formatos de botão! ✅

---

### **Botão: Conversão Twitter para Sticker**

**Trigger:** Após download bem-sucedido de vídeo do Twitter

**Estrutura Avisa API:**
```typescript
{
  number: "5511999999999",
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

### **Botões: Edição de Sticker** ✨

**Status:** Ativo (via fila `edit-buttons` com debounce de 10s)

**Trigger:** Após envio de sticker bem-sucedido (debounced)

**Estrutura Avisa API:**
```typescript
{
  number: "5511999999999",
  title: "🎨 *Gostou da figurinha?*",
  desc: "Quer fazer alguma edição?",
  footer: "Edições não contam no limite",
  buttons: [
    { id: "button_remove_borders", text: "🧹 Remover Bordas" },
    { id: "button_remove_background", text: "✨ Remover Fundo" },
    { id: "button_sticker_perfect", text: "✅ Está perfeita!" }
  ]
}
```

**Arquivo:** `src/services/menuService.ts:597-632` → `sendStickerEditButtons()`

**Fluxo Completo:**

```
1️⃣ Usuário envia imagem
   → Backend processa e envia sticker
   → Adiciona job edit-buttons (delay 10s debounce)

2️⃣ Worker edit-buttons processa:
   → Salva contexto no Redis (sticker_url, message_key, etc.)
   → Envia botões de edição via Avisa API

3️⃣ Usuário clica "🧹 Remover Bordas"
   → Backend detecta button_remove_borders
   → Adiciona job cleanup-sticker (PATH B)
   → Envia "🧹 Removendo bordas..."

4️⃣ Worker cleanup-sticker processa (PATH B):
   → Baixa sticker do Storage
   → Remove bordas brancas (sem rembg)
   → Upload nova versão
   → Envia sticker limpo

5️⃣ Alternativa: Usuário clica "✨ Remover Fundo"
   → Backend detecta button_remove_background
   → Adiciona job cleanup-sticker (PATH A)
   → Envia "✨ Removendo fundo..."
   → Worker usa rembg com modelo U²-Net
   → Envia sticker sem fundo

6️⃣ Alternativa: Usuário clica "✅ Está perfeita!"
   → Backend envia confirmação
   → Limpa contexto do Redis
```

**Importante:**
- Edições NÃO contam no limite diário
- Contexto expira em 10 minutos (Redis TTL)
- Worker `edit-buttons` tem concurrency: 5
- Worker `cleanup-sticker` tem concurrency: 2

**Arquivos:**
- Worker edit-buttons: `src/worker.ts:1434-1502`
- Worker cleanup-sticker: `src/worker.ts:1140-1420`
- Função de botões: `src/services/menuService.ts:597-632`

---

## 🔧 Detalhamento Técnico

### **Mapeamento API por Tipo de Mensagem**

| Tipo de Mensagem | API (BR +55) | API (Internacional) | Função | Arquivo |
|-----------------|--------------|---------------------|--------|---------|
| Texto simples | Evolution API | Evolution API | `sendText()` | `src/services/evolutionApi.ts` |
| Lista interativa | Avisa API | Evolution API (texto) | `sendList()` | `src/services/avisaApi.ts` |
| Botões interativos | Avisa API | Evolution API (texto) | `sendButtons()` | `src/services/avisaApi.ts` |
| **Botão PIX** | **Avisa API** | **Evolution API (texto)** | **`sendPixButton()`** | **`src/services/avisaApi.ts`** |
| Mídia (sticker, etc) | Evolution API | Evolution API | `sendSticker()`, `sendMedia()` | `src/services/evolutionApi.ts` |

**Nota:** Funções `sendButtons()`, `sendList()` e `sendPixButton()` detectam automaticamente se o número é brasileiro (`isBrazilianNumber()`) e aplicam o fallback adequado.

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
   ├─ buttonsResponseMessage → Processa clique em botão (Evolution)
   └─ templateButtonReplyMessage → Processa clique em botão (Avisa) ✨

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

**Nota v1.4.0:** Sistema agora detecta 2 formatos de botões:
- `buttonsResponseMessage` (Evolution API)
- `templateButtonReplyMessage` (Avisa API) ← **NOVO!**

Arquivos:
- Detecção: `src/utils/messageValidator.ts:getMessageType()`
- Extração: `src/utils/interactiveMessageDetector.ts:extractInteractiveResponse()`

---

### **Estados de Conversação (Redis)**

```typescript
type ConversationState =
  | 'awaiting_payment_method'  // Após selecionar plano
  | 'awaiting_sticker_edit'    // Após criar sticker, aguardando edição
  | 'none'                     // Estado padrão

interface ConversationContext {
  user_number: string;
  state: ConversationState;
  metadata: {
    // Metadata para pagamento
    selected_plan?: 'premium' | 'ultra';
    payment_link?: string;

    // Metadata para edição de sticker
    sticker_url?: string;           // URL do sticker criado
    sticker_path?: string;          // Path do sticker no storage
    message_key?: MessageKey;       // MessageKey original para download
    message_type?: 'image' | 'gif'; // Tipo da mídia original
    tipo?: 'estatico' | 'animado';  // Tipo do sticker criado

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
context:5511999999999 = {
  "user_number": "5511999999999",
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

**Queue: convert-twitter-sticker**
- Converte vídeos Twitter em figurinhas
- Busca vídeo do Storage pelo download_id
- Processa com FFmpeg (auto-trim, resize)
- Verifica limite de Sticker (separado do Twitter!)
- Envia figurinha animada

**Queue: cleanup-sticker** ✨
- Remove bordas brancas de stickers (PATH B)
- Remove fundo de imagens originais (PATH A)
- Usa rembg com modelo U²-Net AI
- Processa com ONNX Runtime CPU
- Não conta no limite diário
- PATH A: Se `messageType` presente → remove fundo da imagem original
- PATH B: Se `messageType` ausente → remove bordas do sticker criado

**Queue: activate-pix-subscription**
- Aguarda 5 minutos (delay)
- Ativa assinatura no Supabase
- Envia mensagem de confirmação

**Queue: edit-buttons** ✨
- Envia botões de edição após criação de sticker
- Debounce de 10 segundos (evita spam)
- Salva contexto de edição no Redis
- Concurrency: 5 (apenas envio de mensagens)

**Queue: scheduled-jobs**
- **send-pending-stickers**: Roda todo dia às 8:00 AM (São Paulo timezone)
  - Envia stickers que não foram enviados por limite atingido
  - Log completo na tabela `pending_sticker_sends`
  - Ver documentação completa: `PENDING_STICKERS.md`
- **reset-daily-counters**: Roda todo dia à meia-noite (São Paulo timezone)
  - Reseta contadores diários de todos os usuários

---

### **Integrações Externas**

**Stripe (Pagamentos)**
- Webhook: `https://your-domain.com/stripe/webhook`
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
  "userNumber": "5511999999999",
  "type": "list",
  "id": "plan_premium"
}
```

**Menu enviado:**
```json
{
  "level": 30,
  "msg": "Plans list menu sent via Avisa API",
  "userNumber": "5511999999999"
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

**Cenário 2:** Paulo quer remover o fundo de uma foto ✨

```
1️⃣ Paulo envia uma foto
   → Evolution API recebe
   → Backend adiciona job process-sticker
   → Worker processa imagem
   → Evolution API envia STICKER
   → Avisa API envia BOTÕES de edição
   → Paulo vê 3 opções: Remover Bordas, Remover Fundo, Está Perfeita

2️⃣ Paulo clica: "✨ Remover Fundo"
   → Evolution API envia webhook (buttonsResponseMessage)
   → Backend processa (selectedButtonId: "button_remove_background")
   → Salva contexto: awaiting_sticker_edit
   → Adiciona job cleanup-sticker (PATH A)
   → Evolution API envia TEXTO: "✨ Removendo fundo..."

3️⃣ Worker processa remoção de fundo:
   → Busca contexto no Redis (messageKey, messageType)
   → Baixa IMAGEM ORIGINAL via Evolution API
   → Salva em /tmp/bg-input-{id}.jpg
   → Executa: rembg i input.jpg output.png
   → Modelo U²-Net remove fundo (10-30s)
   → Converte para WebP
   → Upload para Supabase Storage
   → Evolution API envia NOVO STICKER (sem fundo)
   → Paulo recebe figurinha sem fundo ✅

4️⃣ Paulo envia outra imagem
   → Mesmo fluxo, mas agora clica "🧹 Remover Bordas"
   → Worker processa (PATH B):
     → Baixa STICKER JÁ CRIADO
     → Remove apenas bordas brancas
     → Preserva transparência existente
   → Paulo recebe sticker limpo ✅
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
  "userNumber": "5511999999999",
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

**Dependências Docker:**
- Base: `node:20-slim` (Debian)
- FFmpeg: Processamento de vídeos e GIFs
- Python 3: Runtime para rembg
- pip3: Gerenciador de pacotes Python
- rembg[cpu,cli]: Remoção de fundo com IA
  - ONNX Runtime CPU: Backend para inferência
  - U²-Net Model: Modelo pré-treinado (auto-download)
  - Cache: `/home/nodejs/.u2net`

**IMPORTANTE:**
- Nunca rodar local e VPS ao mesmo tempo com mesma conta WhatsApp!
- Modelos AI são baixados durante o build (~200MB)
- Primeira execução do rembg é mais rápida (modelos em cache)

---

## 📞 Contatos e Links

**APIs:**
- Evolution API: `http://localhost:8080` (local) / `http://evolution_api:8080` (VPS)
- Avisa API: `https://www.avisaapi.com.br/api`
- Stripe: `https://api.stripe.com/v1`
- Supabase: `https://YOUR_SUPABASE_PROJECT_ID.supabase.co`

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
- [ ] Envio de stickers funcionando (silencioso)
- [ ] Download de Twitter funcionando
- [ ] Conversão Twitter → Sticker funcionando
- [ ] Edição de stickers funcionando (botões via edit-buttons queue)
- [ ] rembg instalado com ONNX Runtime CPU
- [ ] Modelos AI pré-baixados no Docker
- [ ] **Detecção de números internacionais funcionando** 🆕
- [ ] **Fallback de texto para números não-BR** 🆕
- [ ] **Fluxo estratégico de texto (sem spam)** 🆕

---

**Última atualização:** 08/01/2026
**Versão:** 1.6.0

**Mudanças nesta versão (v1.6.0):** 🌍

**🌍 SUPORTE A NÚMEROS INTERNACIONAIS:**
- ✅ **NOVO:** Função `isBrazilianNumber()` para detectar números brasileiros (+55)
- ✅ **NOVO:** `sendButtons()` com fallback automático para texto em números internacionais
- ✅ **NOVO:** `sendList()` com fallback automático para texto em números internacionais
- ✅ **NOVO:** `sendPixButton()` com fallback automático para código PIX em texto
- ✅ **NOVO:** Seção "Detecção de Números Internacionais" na documentação
- 📁 **Arquivo:** `src/services/avisaApi.ts`
- 🔍 **Impacto:** Usuários de Angola, EUA, Europa agora recebem menus como texto

**💬 FLUXO ESTRATÉGICO DE TEXTO:**
- ✅ **NOVO:** Fluxo inteligente para mensagens de texto (webhook.ts:1004-1066)
  1. Novo usuário → Welcome message
  2. Usuário no limite → Menu de upgrade (conversão!)
  3. Usuário com quota → Silêncio (sem spam)
- ✅ **DEPRECADO:** `getReminderMessage()` marcada como deprecated
- ✅ **FIX:** Resolvido spam de mensagens repetidas para usuários existentes
- 📁 **Arquivo:** `src/routes/webhook.ts`, `src/services/menuService.ts`
- 🔍 **Impacto:** Experiência mais limpa, menos spam, mais conversões

**📊 TABELA DE APIs ATUALIZADA:**
- ✅ **ATUALIZADO:** Tabela agora mostra comportamento BR vs Internacional
- ✅ **ADICIONADO:** Nota sobre detecção automática de país

---

**Versão anterior (v1.5.0):** 📝

**📄 ATUALIZAÇÃO DA DOCUMENTAÇÃO:**
- ✅ **CORRIGIDO:** Mensagem de boas-vindas atualizada para versão curta (Time to Value)
- ✅ **CORRIGIDO:** Removida seção "DESCONTINUADO" sobre edit-buttons (funcionalidade está ativa!)
- ✅ **CORRIGIDO:** Todas as referências de linha atualizadas para corresponder ao código real
- ✅ **ADICIONADO:** Documentação completa da fila `edit-buttons` e fluxo de edição
- ✅ **ADICIONADO:** Queue `edit-buttons` na seção de Jobs do Bull Queue
- ✅ **ATUALIZADO:** Checklist de funcionamento reflete estado atual

**Versão anterior (v1.4.0):** 🎉

**🐛 BUG FIX CRÍTICO:**
- ✅ **CORRIGIDO:** Sistema agora detecta `templateButtonReplyMessage` da Avisa API
- ✅ **CORRIGIDO:** Botões Premium/Ultra agora funcionam corretamente
- ✅ **CORRIGIDO:** Fluxo de upgrade completo funcionando
- 📁 **Arquivos:** `src/utils/messageValidator.ts`, `src/utils/interactiveMessageDetector.ts`
- 🔍 **Impacto:** Usuários que clicavam em botões de upgrade não recebiam resposta (CRÍTICO)

**💳 MELHORIA NO FLUXO PIX:**
- ✅ **NOVO:** Fluxo PIX em 3 mensagens separadas
  1. Instruções claras (Evolution API - sendText)
  2. Chave PIX com botão de copiar (Avisa API - sendPixButton)
  3. Botão de confirmação (Avisa API - sendButtons)
- ✅ **MELHORIA UX:** Chave PIX agora usa endpoint dedicado `/buttons/pix`
- ✅ **MELHORIA UX:** Botão nativo WhatsApp para copiar facilmente
- ✅ **DELAY:** 500ms entre mensagens para garantir ordem
- 📁 **Arquivo:** `src/services/menuService.ts:sendPixPaymentWithButton()`

**📦 SISTEMA DE PENDING STICKERS:**
- ✅ **NOVO:** Stickers que excedem limite são salvos e enviados às 8h
- ✅ **NOVO:** Job automático `send-pending-stickers` (cron: 0 8 * * *)
- ✅ **NOVO:** Tabela `pending_sticker_sends` com log completo
- ✅ **NOVO:** Warning ao executar job fora de horário
- 📄 **Documentação:** Ver `PENDING_STICKERS.md` para detalhes completos

**📊 MELHORIAS TÉCNICAS:**
- ✅ **NOVO:** Suporte dual para formatos de botão (Evolution + Avisa)
- ✅ **NOVO:** Função `sendPixButton()` implementada
- ✅ **NOVO:** Logging detalhado de tentativas de envio pendentes
- ✅ **MELHORIA:** Arquitetura mais robusta para interações de botões

**Versão anterior (v1.2.0):**
- ✅ Adicionada funcionalidade de edição de stickers
- ✅ Implementado botão "🧹 Remover Bordas" (remove bordas brancas)
- ✅ Implementado botão "✨ Remover Fundo" (remove fundo da imagem original)
- ✅ Implementado botão "✅ Está perfeita!" (confirmação sem edição)
- ✅ Adicionado estado `awaiting_sticker_edit` no ConversationContext
- ✅ Adicionada fila `cleanup-sticker` com suporte a PATH A e PATH B
- ✅ Integrado rembg com ONNX Runtime CPU para processamento de IA
- ✅ Pré-download de modelos U²-Net durante build do Docker
