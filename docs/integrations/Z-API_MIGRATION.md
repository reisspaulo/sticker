# Z-API - Documentacao de Migracao e Plano de Contingencia

## Visao Geral

A Z-API e uma API de integracao com WhatsApp brasileira que oferece:
- Mensagens ilimitadas (sem cobranca por mensagem)
- Pagamento em Real (R$)
- Suporte 24/7 em portugues
- Setup rapido (~10 minutos)

**Status atual**: Plano de contingencia para substituir Evolution API + Avisa API em caso de falha.

---

## Dados da Instancia

```
Instance ID: 3ECBB8EF0D54F1DC47CCEA71E5C779FD
Token: C510A0F9C0E015918EF628F0
Base URL: https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/
```

**Variaveis de ambiente necessarias:**
```bash
Z_API_INSTANCE=3ECBB8EF0D54F1DC47CCEA71E5C779FD
Z_API_TOKEN=C510A0F9C0E015918EF628F0
Z_API_CLIENT_TOKEN=<obter_no_painel_z-api>
```

---

## Comparacao de Endpoints

### Evolution API vs Z-API

| Funcao | Evolution API | Z-API |
|--------|---------------|-------|
| Enviar sticker | `POST /message/sendSticker/{instance}` | `POST /send-sticker` |
| Enviar texto | `POST /message/sendText/{instance}` | `POST /send-text` |
| Enviar video | `POST /message/sendMedia/{instance}` | `POST /send-video` |
| Download midia | `POST /chat/getBase64FromMediaMessage/{instance}` | URL direta no webhook |
| Status conexao | `GET /instance/connectionState/{instance}` | `GET /status` |

### Avisa API vs Z-API

| Funcao | Avisa API | Z-API |
|--------|-----------|-------|
| Botoes interativos | `POST /actions/buttons` | `POST /send-button-actions` |
| Listas interativas | `POST /actions/sendList` | `POST /send-option-list` |
| Botao PIX | `POST /buttons/pix` | `POST /send-button-pix` |

---

## Endpoints Z-API Detalhados

### 1. Enviar Sticker

```
POST https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-sticker
```

**Headers:**
```json
{
  "Client-Token": "SEU_CLIENT_TOKEN",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "phone": "5511999999999",
  "sticker": "https://url-do-sticker.webp"
}
```

**Resposta (200):**
```json
{
  "zaapId": "id-interno-z-api",
  "messageId": "id-whatsapp",
  "id": "id-whatsapp"
}
```

### 2. Enviar Texto

```
POST https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-text
```

**Body:**
```json
{
  "phone": "5511999999999",
  "message": "Texto da mensagem"
}
```

**Parametros opcionais:**
- `delayMessage`: 1-15 segundos de delay antes de enviar
- `delayTyping`: 1-15 segundos mostrando "digitando..."

### 3. Enviar Video

```
POST https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-video
```

**Body:**
```json
{
  "phone": "5511999999999",
  "video": "https://url-do-video.mp4",
  "caption": "Legenda opcional"
}
```

**Parametros opcionais:**
- `viewOnce`: boolean - mensagem visualizacao unica
- `async`: boolean - processamento em background

### 4. Botoes Interativos

```
POST https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-button-actions
```

**Body:**
```json
{
  "phone": "5511999999999",
  "message": "Texto da mensagem",
  "title": "Titulo (opcional)",
  "footer": "Rodape (opcional)",
  "buttonActions": [
    {
      "type": "REPLY",
      "label": "Opcao 1",
      "id": "btn_1"
    },
    {
      "type": "URL",
      "label": "Acessar site",
      "url": "https://exemplo.com"
    },
    {
      "type": "CALL",
      "label": "Ligar",
      "phone": "5511999999999"
    }
  ]
}
```

**IMPORTANTE:** Nao misturar os 3 tipos de botao simultaneamente (causa erro no WhatsApp Web).

### 5. Botao PIX

```
POST https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-button-pix
```

**Headers:**
```json
{
  "Client-Token": "SEU_CLIENT_TOKEN",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "phone": "5511999999999",
  "pixKey": "00020126580014br.gov.bcb.pix...",
  "type": "EVP",
  "merchantName": "Pagar Premium"
}
```

**Parametros:**
- `phone`: Numero do destinatario (apenas digitos com DDI)
- `pixKey`: Codigo PIX Copia e Cola completo
- `type`: Tipo da chave PIX (opcoes: CPF, CNPJ, PHONE, EMAIL, EVP)
- `merchantName`: Titulo do botao (opcional, padrao: "Pix")

**Resposta (200):**
```json
{
  "zaapId": "id-interno-z-api",
  "messageId": "id-whatsapp",
  "id": "id-whatsapp"
}
```

**IMPORTANTE:** Botao PIX so funciona com chaves validas e depende de fatores especificos do WhatsApp.

### 6. Lista Interativa

```
POST https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-option-list
```

**Body:**
```json
{
  "phone": "5511999999999",
  "message": "Escolha uma opcao:",
  "optionList": {
    "title": "Titulo da lista",
    "buttonLabel": "Ver opcoes",
    "options": [
      {
        "id": "opt_1",
        "title": "Opcao 1",
        "description": "Descricao da opcao 1"
      },
      {
        "id": "opt_2",
        "title": "Opcao 2",
        "description": "Descricao da opcao 2"
      }
    ]
  }
}
```

### 6. Status da Conexao

```
GET https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/status
```

**Resposta:**
```json
{
  "connected": true,
  "error": null,
  "smartphoneConnected": true
}
```

**Possiveis erros:**
- `"You are already connected."`
- `"You need to restore the session."`
- `"You are not connected."`

---

## Webhook - Recebimento de Mensagens

### Configurar Webhook

```
PUT https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/update-webhook-received
```

**Body:**
```json
{
  "value": "https://seu-servidor.com/webhook/zapi"
}
```

**Ou configurar todos de uma vez:**
```
PUT https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/update-every-webhooks
```

**IMPORTANTE:** Z-API so aceita webhooks HTTPS.

### Payload do Webhook (mensagem recebida)

```json
{
  "messageId": "id-da-mensagem",
  "phone": "5511999999999",
  "fromMe": false,
  "status": "RECEIVED",
  "momment": 1704672000000,
  "type": "ReceivedCallback",
  "text": {
    "message": "Texto da mensagem"
  }
}
```

**Para mensagens com midia:**
```json
{
  "messageId": "id-da-mensagem",
  "phone": "5511999999999",
  "fromMe": false,
  "image": {
    "imageUrl": "https://storage.z-api.io/instances/.../image.jpeg",
    "caption": "legenda",
    "mimeType": "image/jpeg"
  }
}
```

**IMPORTANTE:** Arquivos de midia expiram em 30 dias no storage da Z-API.

---

## Mapeamento de Codigo

### De `evolutionApi.ts` para `zapiApi.ts`

| Funcao Evolution | Funcao Z-API | Mudancas |
|------------------|--------------|----------|
| `sendSticker(userNumber, stickerUrl)` | `sendSticker(phone, sticker)` | `number` -> `phone` |
| `sendText(userNumber, text)` | `sendText(phone, message)` | `text` -> `message` |
| `sendVideo(userNumber, videoUrl, caption)` | `sendVideo(phone, video, caption)` | Campo diferente |
| `downloadMedia(messageKey)` | N/A | URL ja vem no webhook |
| `checkConnection()` | `checkConnection()` | Resposta diferente |

### De `avisaApi.ts` para `zapiApi.ts`

| Funcao Avisa | Funcao Z-API | Mudancas |
|--------------|--------------|----------|
| `sendButtons(request)` | `sendButtonActions(request)` | Formato de botoes diferente |
| `sendList(request)` | `sendOptionList(request)` | Estrutura diferente |
| `sendPixButton(request)` | `sendPixButton(request)` | Parametros diferentes: `number`→`phone`, `pix`→`pixKey`, adicionar `type` |

---

## Plano de Contingencia

### Timeline de Ativacao em Emergencia

| Etapa | Tempo | Acao |
|-------|-------|------|
| 1. Detectar falha | ~1 min | Alerta de health check |
| 2. Criar instancia | ~30 seg | `POST /integrator/on-demand` |
| 3. Assinar instancia | ~30 seg | `POST /integrator/on-demand/subscription` |
| 4. Conectar WhatsApp | ~1-2 min | Escanear QR code |
| 5. Configurar webhooks | ~30 seg | `PUT /update-every-webhooks` |
| 6. Deploy codigo | ~2-3 min | Trocar env vars + restart |
| 7. Testar | ~30 seg | Enviar mensagem teste |
| **TOTAL** | **~6-8 min** | Sistema operacional |

### Comandos de Ativacao Rapida

**1. Criar nova instancia:**
```bash
curl -X POST "https://api.z-api.io/instances/integrator/on-demand" \
  -H "Client-Token: SEU_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "sticker-bot-contingency"}'
```

**2. Assinar instancia:**
```bash
curl -X POST "https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/integrator/on-demand/subscription" \
  -H "Client-Token: SEU_CLIENT_TOKEN" \
  -H "Content-Type: application/json"
```

**3. Obter QR Code:**
```bash
curl -X GET "https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/qrcode" \
  -H "Client-Token: SEU_CLIENT_TOKEN"
```

**4. Configurar webhooks:**
```bash
curl -X PUT "https://api.z-api.io/instances/{INSTANCE_ID}/token/{TOKEN}/update-every-webhooks" \
  -H "Client-Token: SEU_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "https://seu-servidor.com/webhook/zapi"}'
```

---

## Modelo de Pagamento

### Ciclo de Cobranca

- **Modelo:** Pos-pago
- **Ciclo:** Dia 1-31 de cada mes
- **Vencimento:** Dia 5 do mes seguinte
- **Moeda:** Real (R$)

### Exemplo Pratico

1. Assina instancia em 07/jan
2. Usa ate 06/fev (30 dias garantidos)
3. Boleto gerado em 01/fev
4. Vencimento: 05/fev

### Trial

- **Duracao:** 2 dias
- **Apos expirar:** Instancia deletada automaticamente
- **Nao precisa:** Cancelar manualmente

---

## Diferencas Importantes

### Formato do Numero

```
Evolution: "5511999999999" ou "5511999999999@s.whatsapp.net"
Z-API:     "5511999999999" (apenas numeros)
```

### Headers de Autenticacao

```
Evolution:
  apikey: {EVOLUTION_API_KEY}

Z-API:
  Client-Token: {Z_API_CLIENT_TOKEN}
```

### Resposta de Envio

```
Evolution:
{
  "key": { "id": "msg-id", "remoteJid": "...", "fromMe": true },
  "message": {...},
  "status": "..."
}

Z-API:
{
  "zaapId": "...",
  "messageId": "msg-id",
  "id": "msg-id"
}
```

### Download de Midia

```
Evolution: Endpoint dedicado /chat/getBase64FromMediaMessage
Z-API:     URL direta no webhook (imageUrl, videoUrl, documentUrl, etc)
```

---

## Checklist de Migracao

### Preparacao (fazer AGORA)
- [ ] Obter Client Token no painel Z-API
- [ ] Criar arquivo `src/services/zapiApi.ts`
- [ ] Implementar funcoes equivalentes
- [ ] Criar feature flag para alternar entre APIs
- [ ] Criar novo endpoint webhook para Z-API

### Ativacao (quando precisar)
- [ ] Criar/assinar instancia Z-API
- [ ] Conectar WhatsApp via QR code
- [ ] Configurar webhook
- [ ] Atualizar variaveis de ambiente
- [ ] Ativar feature flag
- [ ] Testar todas as funcionalidades

### Pos-ativacao
- [ ] Monitorar logs de erro
- [ ] Verificar entrega de stickers
- [ ] Verificar recebimento de mensagens
- [ ] Confirmar botoes interativos funcionando

---

## Links Uteis

- Documentacao oficial: https://developer.z-api.io/
- Painel administrativo: https://admin.z-api.io/
- Swagger/Postman: https://www.postman.com/docs-z-api
- GitHub: https://github.com/z-api

---

## Observacoes Finais

### Botao PIX
✅ A Z-API TEM endpoint de botao PIX!

Endpoint: POST /send-button-pix

Parametros:
- phone: numero do destinatario (apenas digitos com DDI)
- pixKey: codigo PIX Copia e Cola completo
- type: tipo da chave (CPF, CNPJ, PHONE, EMAIL, EVP)
- merchantName: titulo do botao (opcional, default: "Pix")

Exemplo:
```json
{
  "phone": "5511999999999",
  "pixKey": "00020126...",
  "type": "EVP",
  "merchantName": "Pagar Premium"
}
```

Documentacao: https://developer.z-api.io/message/send-button-pix

### Limitacao de Botoes
Nao misturar tipos CALL + URL + REPLY no mesmo envio. Usar:
- CALL + URL juntos: OK
- REPLY sozinho: OK
- Todos juntos: ERRO

### Expiracao de Arquivos
Midias no storage Z-API expiram em 30 dias. Se precisar armazenar permanentemente, fazer download e salvar no Supabase Storage.
