# ✅ Meta Cloud API - Setup Rápido (Checklist)

**Tempo total:** ~1-2 dias úteis (dependendo de verificação de negócio)

---

## 📋 Checklist de Onboarding

### Dia 1: Registro & Verificação

- [ ] Acesse https://developers.facebook.com/
- [ ] Faça login com Facebook pessoal
- [ ] Vá para "Meus Apps"
- [ ] Clique "Criar Aplicação"
  - [ ] Tipo: **Business**
  - [ ] Nome da app: `sticker-bot`
  - [ ] Email: seu email

- [ ] Aguarde criação (2-3 minutos)

### Dia 1b: Verificar Negócio (OBRIGATÓRIO)

⚠️ **Isso é crítico!** Sem isso, API não funciona.

- [ ] Dentro da app → Configurações → Básico
- [ ] Procure por "Conta de negócio"
- [ ] Clique em "Verificar"
- [ ] Escolha método:
  - [ ] **Recomendado:** Telefone (instantâneo)
  - [ ] Documento (1-3 dias)
- [ ] Complete verificação

### Dia 1c: Adicionar Produto WhatsApp

- [ ] No app, procure "Adicionar produto"
- [ ] Busque "WhatsApp"
- [ ] Clique "Configurar"
- [ ] Escolha tipo de conta:
  - [ ] **Nova conta:** Registre número novo (5-10 min)
  - [ ] **Existente:** Migre número (24h de verificação)

**Se escolheu nova conta:**
- [ ] Número será fornecido automaticamente
- [ ] Você receberá `WHATSAPP_PHONE_NUMBER_ID`
- [ ] Você receberá `WHATSAPP_BUSINESS_ACCOUNT_ID`

### Dia 2: Configurar Pagamento

- [ ] Acesse https://business.facebook.com/
- [ ] Esquerda → "Configurações de Faturamento"
- [ ] "Adicionar Método de Pagamento"
- [ ] Escolha:
  - [ ] **Cartão de crédito** (Visa/Mastercard) - Instantâneo ⭐
  - [ ] Débito bancário - 3-5 dias

- [ ] Defina limite de gastos: R$ 500 (para começar)
- [ ] Aceite Termos de Serviço

### Dia 2b: Gerar Access Token

- [ ] No app Facebook → Ferramentas → Gerenciar tokens
- [ ] Clique "Gerar Token de Acesso"
- [ ] Tipo: **System User**
- [ ] Permissões: `whatsapp_business_messaging`
- [ ] **Copie e salve em local seguro!** (válido por ~60 dias)

```
WHATSAPP_ACCESS_TOKEN=seu_token_aqui
```

### Dia 2c: Configurar Webhook

- [ ] App → WhatsApp → Configurações
- [ ] Clique "Editar Webhook Callback"
- [ ] Preencha:

| Campo | Valor |
|-------|-------|
| **Callback URL** | `https://seu-dominio.com/webhook/meta` |
| **Verify Token** | `seu_token_secreto_aqui` (crie um) |
| **Subscribe Fields** | `messages`, `message_status` |

- [ ] Clique "Verificar e Salvar"

**Meta vai fazer POST em seu webhook com query params:**
```
POST https://seu-dominio.com/webhook/meta?hub_mode=subscribe&hub_challenge=xxxx&hub_verify_token=seu_token_secreto
```

---

## 🔑 Variáveis de Ambiente

Salve em seu `.env`:

```bash
# ==================== META CLOUD API ====================
WHATSAPP_ACCESS_TOKEN=seu_access_token_aqui
WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id  # ex: 1234567890
WHATSAPP_BUSINESS_ACCOUNT_ID=seu_business_id  # ex: 9876543210
WHATSAPP_PHONE_NUMBER=seu_numero_whatsapp     # ex: 5511999999999
WHATSAPP_WEBHOOK_TOKEN=seu_webhook_token      # ex: abc123xyz

# ==================== OPCIONAL ====================
# Para migrations gradual (rodar ambas as APIs)
Z_API_INSTANCE=seu_instance  # Manter por agora
Z_API_TOKEN=seu_token
Z_API_CLIENT_TOKEN=seu_client_token
```

---

## 📞 Testando Localmente (Sem Deploy)

### Opção 1: Usar Postman

1. Baixe Postman: https://www.postman.com/downloads/
2. Importe a collection (veja links úteis)
3. Teste endpoint básico:

```
POST https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages

Headers:
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
Content-Type: application/json

Body:
{
  "messaging_product": "whatsapp",
  "to": "5511987654321",
  "type": "text",
  "text": {
    "body": "Olá! Teste da Meta Cloud API"
  }
}
```

### Opção 2: Usar cURL

```bash
#!/bin/bash

TOKEN="seu_access_token"
PHONE_ID="seu_phone_number_id"
TO_NUMBER="5511987654321"

curl -X POST https://graph.facebook.com/v21.0/${PHONE_ID}/messages \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "'${TO_NUMBER}'",
    "type": "text",
    "text": {
      "body": "Hello from Meta Cloud API!"
    }
  }'
```

**Resposta esperada:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{"input": "5511987654321", "wa_id": "5511987654321"}],
  "messages": [{"id": "wamid.xxxxx", "message_status": "accepted"}]
}
```

### Opção 3: Testar Webhook Localmente

```bash
# 1. Inicie seu servidor local
npm run dev

# 2. Use ngrok para expor seu localhost
npx ngrok http 3000

# 3. Atualize a URL do webhook em Meta for Developers:
# https://seu-ngrok-url.ngrok.io/webhook/meta

# 4. Teste envio
curl -X POST https://seu-ngrok-url.ngrok.io/webhook/meta \
  -H "Content-Type: application/json" \
  -d @webhook-test-payload.json
```

---

## 🔍 Monitoramento & Debugging

### Verificar Saúde da API

```bash
curl -X GET \
  "https://graph.facebook.com/v21.0/me/whatsapp_business_accounts" \
  -H "Authorization: Bearer {TOKEN}"
```

Resposta esperada:
```json
{
  "data": [
    {
      "id": "seu_business_id",
      "name": "StickerBot"
    }
  ]
}
```

### Ver Logs de Mensagens

1. Meta for Developers → App → WhatsApp
2. Aba "Logs"
3. Filtre por:
   - `phone_number_id` = seu number ID
   - Data/hora
   - Status

### Checar Limite de Rate

```bash
curl -X GET \
  "https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}?fields=rate_limit_data" \
  -H "Authorization: Bearer {TOKEN}"
```

---

## 💳 Entender Cobrança

### Acompanhar Gastos em Tempo Real

1. **Ads Manager** → https://business.facebook.com/adsmanager/
2. Lado esquerdo → "Faturamento"
3. Aba "Resumo da Fatura"

Você verá:
- Saldo atual (crédito ou débito)
- Gasto do mês
- Data do próximo ciclo de cobrança

### Onde Aparecem as Mensagens

Meta agrupa o custo em:
- **Utility Messages:** Respostas em janela 24h (R$ 0,03-0,05)
- **Marketing Messages:** Templates disparados fora da janela (R$ 0,30-0,35)
- **Service Messages:** Confirmação de pedidos (grátis)
- **Authentication:** SMS de 2FA (R$ 0,02)

**No seu caso (Sticker Bot):**
- Usuário manda foto → 0 custo (ele iniciou)
- Bot responde figurinha → 0 custo (Utility, 24h)
- Bot envia menu com botões → 0 custo (Utility, 24h)
- Bot dispara lembrete (48h depois) → **R$ 0,035** (Marketing)
- Campanha de upgrade → **R$ 0,035 cada** (Marketing)

---

## ⚠️ Problemas Comuns

### "Invalid access token"
**Causa:** Token expirou ou é inválido
**Solução:** Regenere token em Meta for Developers → Gerar novo

### "Phone number not verified"
**Causa:** Número não foi verificado
**Solução:** Aguarde 24h ou tente migrar número existente

### "Business account not verified"
**Causa:** Verificação de negócio pendente
**Solução:** Complete verificação em Meta Business Suite

### "Webhook not responding"
**Causa:** Sua URL está inacessível ou offline
**Solução:** Verifique DNS, firewall, e se seu servidor está rodando

### "Message rate limit exceeded"
**Causa:** Enviando muitas mensagens muito rápido
**Solução:** Meta tem limite de ~1000 msgs/dia. Implemente fila (BullMQ já tem)

---

## 📈 Escalabilidade

| Volume | Restrição | Solução |
|--------|-----------|---------|
| 0-1000 msgs/dia | Limite padrão | Nenhuma |
| 1000-10k msgs/dia | Rate limiting | Solicitar aumento no suporte Meta |
| 10k+ msgs/dia | Conta Enterprise | Contatar vendas Meta |

Para solicitar aumento:
1. Meta for Developers → App → WhatsApp → Suporte
2. Clique "Entre em contato conosco"
3. Descreva caso de uso

---

## 🎯 Próximos Passos

Após completar este checklist:

1. **Desenvolver:** Implementar `metaCloudApi.ts`
2. **Testar:** Enviar mensagens via Postman
3. **Integrar:** Adaptar webhook
4. **Deploy:** Colocar em produção
5. **Monitorar:** Acompanhar logs e custos

---

## 📞 Suporte

### Meta Business Help
- https://www.facebook.com/business/help/

### Developer Documentation
- https://developers.facebook.com/docs/whatsapp/

### Status da API
- https://graph.facebook.com/status

---

**Última atualização:** 2026-03-12
**Status:** Pronto para implementação
