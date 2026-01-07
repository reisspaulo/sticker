# AbacatePay - Plano de Implementação

> **Status:** Planejamento
> **Data:** 07/01/2026
> **Objetivo:** Substituir fluxo manual de PIX por gateway automatizado

---

## 1. Visão Geral

### Por que AbacatePay?

| Critério | Stripe | AbacatePay |
|----------|--------|------------|
| PIX no Brasil | Não disponível | ✅ Disponível |
| Taxa PIX | - | R$ 0,80 fixo |
| Cartão de Crédito | ✅ | ⚠️ Beta fechado |
| Facilidade de integração | Excelente | Excelente |
| Webhook automático | ✅ | ✅ |

### Fluxo Atual vs Novo

```
ATUAL (Manual):
1. Usuário pede upgrade
2. Bot envia chave PIX estática
3. Usuário paga manualmente
4. Usuário clica "Já Paguei"
5. Sistema confia no usuário e ativa após 5min

NOVO (AbacatePay):
1. Usuário pede upgrade
2. Sistema cria cobrança via API
3. Bot envia QR Code dinâmico + copia-e-cola
4. Usuário paga
5. Webhook confirma pagamento REAL
6. Sistema ativa instantaneamente
```

---

## 2. Credenciais

### API Keys

| Ambiente | API Key | Uso |
|----------|---------|-----|
| **Development** | `abc_dev_Ztj4Q3DnFhGxTFBYCCwqAZhD` | Testes locais |
| **Production** | `abc_live_XXXXXXX` | Produção (criar no dashboard) |

> ⚠️ Keys `abc_dev_*` processam transações de teste
> ⚠️ Keys `abc_live_*` processam transações reais

### Webhook

| Campo | Valor |
|-------|-------|
| **Nome** | `StickerBot Pagamentos` |
| **URL** | `https://stickers.ytem.com.br/webhook/abacatepay` |
| **Secret** | `stickerbot_webhook_2024_secret` |
| **Eventos** | `billing.paid` |

### Links Úteis

- **Dashboard:** https://www.abacatepay.com/app
- **Documentação:** https://docs.abacatepay.com
- **API Base URL:** https://api.abacatepay.com/v1
- **Suporte:** ajuda@abacatepay.com

---

## 3. API Reference

### Autenticação

```
Header: Authorization: Bearer <api-key>
```

### Criar Cobrança PIX

```http
POST https://api.abacatepay.com/v1/pixQrCode/create
Content-Type: application/json
Authorization: Bearer abc_dev_Ztj4Q3DnFhGxTFBYCCwqAZhD
```

**Request Body:**

```json
{
  "amount": 500,
  "description": "StickerBot Premium - Mensal",
  "expiresIn": 1800,
  "customer": {
    "name": "João Silva",
    "cellphone": "(11) 99999-9999",
    "email": "joao@email.com",
    "taxId": "123.456.789-01"
  },
  "metadata": {
    "externalId": "user_uuid_aqui",
    "plan": "premium",
    "userNumber": "5511999999999"
  }
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `amount` | number | ✅ | Valor em **centavos** (500 = R$ 5,00) |
| `description` | string | ❌ | Descrição (max 140 chars) |
| `expiresIn` | number | ❌ | Expiração em segundos |
| `customer` | object | ❌ | Dados do cliente |
| `metadata` | object | ❌ | Dados extras (retornados no webhook) |

**Response (200):**

```json
{
  "error": null,
  "data": {
    "id": "pix_char_EG6tXWWbEqaBu6sU2Srxdusp",
    "amount": 500,
    "status": "PENDING",
    "devMode": true,
    "brCode": "00020101021126580014BR.GOV.BCB.PIX...",
    "brCodeBase64": "data:image/png;base64,iVBORw0KGgo...",
    "platformFee": 80,
    "description": "StickerBot Premium - Mensal",
    "createdAt": "2026-01-07T18:20:26.596Z",
    "updatedAt": "2026-01-07T18:20:26.596Z",
    "expiresAt": "2026-01-07T18:50:26.596Z"
  }
}
```

| Campo | Descrição |
|-------|-----------|
| `id` | ID único da cobrança |
| `brCode` | Código copia-e-cola PIX |
| `brCodeBase64` | QR Code em base64 (PNG) |
| `platformFee` | Taxa da plataforma (80 = R$ 0,80) |
| `status` | `PENDING`, `PAID`, `EXPIRED` |
| `devMode` | `true` se ambiente de teste |

### Simular Pagamento (Dev Mode)

```http
POST https://api.abacatepay.com/v1/pixQrCode/simulate-payment?id=pix_char_XXX
Authorization: Bearer abc_dev_Ztj4Q3DnFhGxTFBYCCwqAZhD
```

### Verificar Status

```http
GET https://api.abacatepay.com/v1/pixQrCode/check?id=pix_char_XXX
Authorization: Bearer abc_dev_Ztj4Q3DnFhGxTFBYCCwqAZhD
```

---

## 4. Webhook

### Evento: `billing.paid`

Disparado quando um pagamento PIX é confirmado.

**URL configurada:** `https://stickers.ytem.com.br/webhook/abacatepay`

**Payload esperado:**

```json
{
  "event": "billing.paid",
  "data": {
    "id": "pix_char_EG6tXWWbEqaBu6sU2Srxdusp",
    "amount": 500,
    "status": "PAID",
    "proof": "E2E1767810072973JE1Z1DXF",
    "metadata": {
      "externalId": "user_uuid_aqui",
      "plan": "premium",
      "userNumber": "5511999999999"
    }
  }
}
```

### Validação do Webhook

**Método 1 - Query Parameter:**
```
?webhookSecret=stickerbot_webhook_2024_secret
```

**Método 2 - HMAC Signature:**
```
Header: X-Webhook-Signature: <sha256-hash>
```

### Segurança

```typescript
// Validar webhook secret
function validateWebhook(req: Request): boolean {
  const secret = req.query.webhookSecret;
  return secret === process.env.ABACATEPAY_WEBHOOK_SECRET;
}
```

---

## 5. Banco de Dados

### Tabela Existente: `pix_payments`

Já existe e pode ser reutilizada com algumas adaptações.

**Estrutura atual:**

```sql
CREATE TABLE pix_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  user_number TEXT NOT NULL,
  user_name TEXT,
  plan TEXT NOT NULL,
  pix_key TEXT,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  error_message TEXT
);
```

### Novas Colunas Necessárias

```sql
-- Migration: add_abacatepay_fields
ALTER TABLE pix_payments ADD COLUMN IF NOT EXISTS abacatepay_id TEXT;
ALTER TABLE pix_payments ADD COLUMN IF NOT EXISTS br_code TEXT;
ALTER TABLE pix_payments ADD COLUMN IF NOT EXISTS br_code_base64 TEXT;
ALTER TABLE pix_payments ADD COLUMN IF NOT EXISTS payment_proof TEXT;
ALTER TABLE pix_payments ADD COLUMN IF NOT EXISTS platform_fee INTEGER;
ALTER TABLE pix_payments ADD COLUMN IF NOT EXISTS dev_mode BOOLEAN DEFAULT false;

-- Índice para busca por ID do AbacatePay
CREATE INDEX IF NOT EXISTS idx_pix_payments_abacatepay_id ON pix_payments(abacatepay_id);

-- Atualizar status possíveis
COMMENT ON COLUMN pix_payments.status IS 'pending, paid, expired, activated, failed';
```

### Status Flow

```
pending → paid → activated
    ↓       ↓
expired  failed
```

---

## 6. Variáveis de Ambiente

### Adicionar no Doppler

```bash
# Config: dev
doppler secrets set \
  ABACATEPAY_API_KEY="abc_dev_Ztj4Q3DnFhGxTFBYCCwqAZhD" \
  ABACATEPAY_WEBHOOK_SECRET="stickerbot_webhook_2024_secret" \
  --project sticker --config dev

# Config: prd (quando tiver key de produção)
doppler secrets set \
  ABACATEPAY_API_KEY="abc_live_XXXXXXX" \
  ABACATEPAY_WEBHOOK_SECRET="stickerbot_webhook_2024_secret" \
  --project sticker --config prd
```

### Arquivo de Tipos

```typescript
// src/config/env.ts
interface Env {
  // ... existentes
  ABACATEPAY_API_KEY: string;
  ABACATEPAY_WEBHOOK_SECRET: string;
}
```

---

## 7. Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/services/abacatePayService.ts` | Cliente da API AbacatePay |
| `src/routes/abacatePayWebhook.ts` | Endpoint do webhook |

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/services/pixPaymentService.ts` | Usar AbacatePay API |
| `src/services/menuService.ts` | Enviar QR Code dinâmico |
| `src/server.ts` | Registrar rota do webhook |
| `src/config/env.ts` | Novas variáveis |

---

## 8. Implementação Detalhada

### 8.1 AbacatePay Service

```typescript
// src/services/abacatePayService.ts

interface CreatePixChargeParams {
  amount: number; // em centavos
  description: string;
  expiresIn?: number; // segundos
  metadata?: {
    externalId: string;
    plan: string;
    userNumber: string;
  };
}

interface PixChargeResponse {
  id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  brCode: string;
  brCodeBase64: string;
  platformFee: number;
  expiresAt: string;
  devMode: boolean;
}

class AbacatePayService {
  private apiKey: string;
  private baseUrl = 'https://api.abacatepay.com/v1';

  async createPixCharge(params: CreatePixChargeParams): Promise<PixChargeResponse>;
  async getChargeStatus(chargeId: string): Promise<PixChargeResponse>;
  async simulatePayment(chargeId: string): Promise<PixChargeResponse>; // dev only
}
```

### 8.2 Webhook Handler

```typescript
// src/routes/abacatePayWebhook.ts

// POST /webhook/abacatepay
async function handleAbacatePayWebhook(req, res) {
  // 1. Validar webhook secret
  // 2. Parsear evento
  // 3. Se billing.paid:
  //    - Buscar pagamento pelo abacatepay_id
  //    - Atualizar status para 'paid'
  //    - Ativar assinatura do usuário
  //    - Enviar mensagem de confirmação via WhatsApp
  // 4. Retornar 200 OK
}
```

### 8.3 Fluxo de Upgrade

```typescript
// Quando usuário clica em "Assinar Premium"

async function handleUpgradeRequest(userNumber: string, plan: PlanType) {
  // 1. Criar cobrança no AbacatePay
  const charge = await abacatePay.createPixCharge({
    amount: plan === 'premium' ? 500 : 990, // R$ 5,00 ou R$ 9,90
    description: `StickerBot ${plan} - Mensal`,
    expiresIn: 1800, // 30 minutos
    metadata: {
      externalId: user.id,
      plan,
      userNumber,
    },
  });

  // 2. Salvar no banco
  await savePendingPayment({
    ...charge,
    userId: user.id,
    userNumber,
    plan,
  });

  // 3. Enviar QR Code via WhatsApp
  await sendPixPaymentMessage(userNumber, {
    qrCodeBase64: charge.brCodeBase64,
    copyPaste: charge.brCode,
    amount: charge.amount / 100,
    expiresAt: charge.expiresAt,
  });
}
```

---

## 9. Mensagens WhatsApp

### Mensagem de Pagamento PIX

```
💳 *Pagamento PIX - StickerBot Premium*

Valor: *R$ 5,00*
Validade: 30 minutos

📱 *Opção 1:* Escaneie o QR Code abaixo

📋 *Opção 2:* Copie o código PIX:
```
[CÓDIGO COPIA-E-COLA]
```

Após o pagamento, seu plano será ativado *automaticamente*! ✅
```

### Mensagem de Confirmação

```
🎉 *Pagamento Confirmado!*

Seu plano *Premium* foi ativado com sucesso!

✅ 50 stickers por dia
✅ Stickers animados
✅ Sem marca d'água
✅ Suporte prioritário

Válido até: DD/MM/AAAA

Aproveite! 🚀
```

---

## 10. Testes

### Teste Manual (Dev Mode)

```bash
# 1. Criar cobrança
curl -X POST "https://api.abacatepay.com/v1/pixQrCode/create" \
  -H "Authorization: Bearer abc_dev_Ztj4Q3DnFhGxTFBYCCwqAZhD" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "description": "Teste"}'

# 2. Simular pagamento
curl -X POST "https://api.abacatepay.com/v1/pixQrCode/simulate-payment?id=pix_char_XXX" \
  -H "Authorization: Bearer abc_dev_Ztj4Q3DnFhGxTFBYCCwqAZhD"

# 3. Verificar se webhook foi recebido
# (checar logs do servidor)
```

### Testes Automatizados

```typescript
describe('AbacatePayService', () => {
  it('should create PIX charge');
  it('should handle webhook payment confirmation');
  it('should activate subscription after payment');
  it('should handle expired payments');
  it('should validate webhook secret');
});
```

---

## 11. Taxas e Custos

### Por Transação

| Plano | Valor | Taxa AbacatePay | Líquido |
|-------|-------|-----------------|---------|
| Premium | R$ 5,00 | R$ 0,80 | R$ 4,20 |
| Ultra | R$ 9,90 | R$ 0,80 | R$ 9,10 |

### Saques

- **Até 20 saques/mês:** R$ 0,80 cada
- **A partir do 21º:** R$ 2,50 cada
- **Saque mínimo:** R$ 3,00
- **Prazo normal:** 32 dias
- **Antecipação:** 1,5% + R$ 0,80

---

## 12. Checklist de Implementação

### Pré-requisitos

- [ ] Criar API Key de produção no dashboard
- [ ] Configurar webhook de produção
- [ ] Adicionar secrets no Doppler (prd)

### Banco de Dados

- [ ] Criar migration para novas colunas
- [ ] Aplicar migration em produção

### Backend

- [ ] Criar `abacatePayService.ts`
- [ ] Criar rota `/webhook/abacatepay`
- [ ] Adaptar `pixPaymentService.ts`
- [ ] Adaptar `menuService.ts` para enviar QR Code
- [ ] Adicionar variáveis de ambiente

### Testes

- [ ] Testar criação de cobrança (dev)
- [ ] Testar webhook localmente
- [ ] Testar simulação de pagamento
- [ ] Testar fluxo completo em staging

### Deploy

- [ ] Deploy para produção
- [ ] Testar com pagamento real (R$ 5,00)
- [ ] Monitorar logs por 24h

---

## 13. Rollback Plan

Se algo der errado:

1. **Desativar webhook** no dashboard AbacatePay
2. **Reverter código** para versão anterior (fluxo manual)
3. **Comunicar usuários** que pagamentos estão temporariamente manuais

---

## 14. Futuro

### Cartão de Crédito

- Status: Beta fechado
- Taxa: 3,5% + R$ 0,60
- Ação: Solicitar acesso em ajuda@abacatepay.com

### Assinatura Recorrente

- Verificar se AbacatePay suporta
- Alternativa: Criar job mensal para cobrar

---

**Documento criado em:** 07/01/2026
**Última atualização:** 07/01/2026
**Autor:** Claude + Paulo
