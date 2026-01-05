# 📚 Avisa API - Documentação de Endpoints

**Base URL:** `https://www.avisaapi.com.br/api`
**Autenticação:** Bearer Token no header `Authorization`

---

## 🔘 1. Send Buttons (Botões Interativos)

Envia uma mensagem com botões interativos que o usuário pode clicar.

### Endpoint
```
POST {{baseurl}}/actions/buttons
```

### Headers
```
Content-Type: application/json
Authorization: Bearer {{seutoken}}
```

### Request Body
```json
{
  "number": "555199999999",
  "title": "Sua mensagem aqui",
  "desc": "This is a desc",
  "footer": "This is a footer",
  "buttons": [
    {
      "id": "btn1",
      "text": "long description"
    },
    {
      "id": "btn2",
      "text": "very good description"
    }
  ]
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `number` | string | ✅ | Número do WhatsApp (com DDI) |
| `title` | string | ✅ | Título principal da mensagem |
| `desc` | string | ❌ | Descrição adicional |
| `footer` | string | ❌ | Texto no rodapé |
| `buttons` | array | ✅ | Lista de botões (máx 3) |
| `buttons[].id` | string | ✅ | ID único do botão |
| `buttons[].text` | string | ✅ | Texto exibido no botão |

### Response
```json
{
  "status": true,
  "message": "Buttons sent successfully",
  "data": {
    "number": "5511946304133@s.whatsapp.net",
    "response": {
      "code": 200,
      "data": {
        "Details": "Sent",
        "Id": "3EB0C2D4820B75285901D5",
        "Timestamp": "2026-01-04T17:52:46.898268099Z"
      },
      "success": true
    }
  }
}
```

### Exemplo NodeJS (Axios)
```javascript
const axios = require('axios');

const data = {
  "number": "555199999999",
  "title": "💎 Escolha seu plano",
  "desc": "Selecione uma das opções abaixo:",
  "footer": "StickerBot",
  "buttons": [
    {
      "id": "premium",
      "text": "💰 Premium - R$ 5,00"
    },
    {
      "id": "ultra",
      "text": "🚀 Ultra - R$ 9,90"
    }
  ]
};

const config = {
  method: 'post',
  url: 'https://www.avisaapi.com.br/api/actions/buttons',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer SEU_TOKEN'
  },
  data
};

axios.request(config)
  .then((response) => console.log(response.data))
  .catch((error) => console.log(error));
```

---

## 💳 2. PIX Button (Botão de Pagamento PIX)

Envia um código PIX copiável para o usuário.

### Endpoint
```
POST {{baseurl}}/buttons/pix
```

### Headers
```
Content-Type: application/json
Authorization: Bearer {{seutoken}}
```

### Request Body
```json
{
  "number": "555199999999",
  "pix": "Seu Código PIX aqui"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `number` | string | ✅ | Número do WhatsApp (com DDI) |
| `pix` | string | ✅ | Código PIX copia e cola |

### Response
```json
{
  "status": true,
  "message": "Message sent successfully",
  "data": {
    "number": "5511946304133@s.whatsapp.net",
    "message": "00020126580014br.gov.bcb.pix...",
    "response": {
      "code": 200,
      "data": {
        "Details": "Sent",
        "Id": "3EB0F2127634B35DC00ACA",
        "Timestamp": "2026-01-04T17:52:51.551523768Z"
      },
      "success": true
    }
  }
}
```

### Exemplo NodeJS (Axios)
```javascript
const axios = require('axios');

const data = {
  "number": "555199999999",
  "pix": "00020126580014br.gov.bcb.pix..."
};

const config = {
  method: 'post',
  url: 'https://www.avisaapi.com.br/api/buttons/pix',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer SEU_TOKEN'
  },
  data
};

axios.request(config)
  .then((response) => console.log(response.data))
  .catch((error) => console.log(error));
```

---

## 📋 Endpoints Pendentes

Adicione aqui conforme necessário:

### 3. Send List (Lista Interativa)

Envia uma mensagem com uma lista interativa que o usuário pode expandir e selecionar.

#### Endpoint
```
POST {{baseurl}}/actions/sendList
```

#### Headers
```
Content-Type: application/json
Authorization: Bearer {{seutoken}}
```

#### Request Body
```json
{
  "number": "555199999999",
  "buttontext": "Sua mensagem aqui",
  "desc": "This is a list",
  "toptext": "This is a list top",
  "list": [
    {
      "title": "menu button 1",
      "desc": "long description",
      "RowId": "1"
    },
    {
      "title": "menu button 2",
      "desc": "very good description",
      "RowId": "2"
    }
  ]
}
```

#### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `number` | string | ✅ | Número do WhatsApp (com DDI) |
| `buttontext` | string | ✅ | Texto do botão que abre a lista |
| `desc` | string | ❌ | Descrição/corpo da mensagem |
| `toptext` | string | ❌ | Texto no topo da lista |
| `list` | array | ✅ | Lista de itens (min 1, max 10) |
| `list[].title` | string | ✅ | Título do item |
| `list[].desc` | string | ❌ | Descrição do item |
| `list[].RowId` | string | ✅ | ID único do item |

#### Response
```json
{
  "status": true,
  "message": "List sent successfully",
  "data": {
    "number": "5511946304133@s.whatsapp.net",
    "response": {
      "code": 200,
      "data": {
        "Timestamp": "2026-01-04T17:55:37.391827992Z",
        "details": "sent",
        "id": "3EB003ECDD847AC7174EBB"
      },
      "success": true
    }
  }
}
```

#### Exemplo NodeJS (Axios)
```javascript
const axios = require('axios');

const data = {
  "number": "555199999999",
  "buttontext": "📋 Ver Planos",
  "desc": "Escolha o plano ideal para você:",
  "toptext": "💎 Planos Disponíveis",
  "list": [
    {
      "title": "💰 Premium - R$ 5,00/mês",
      "desc": "20 figurinhas/dia",
      "RowId": "premium"
    },
    {
      "title": "🚀 Ultra - R$ 9,90/mês",
      "desc": "ILIMITADO",
      "RowId": "ultra"
    }
  ]
};

const config = {
  method: 'post',
  url: 'https://www.avisaapi.com.br/api/actions/sendList',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer SEU_TOKEN'
  },
  data
};

axios.request(config)
  .then((response) => console.log(response.data))
  .catch((error) => console.log(error));
```

---

## ⚙️ 4. Set Webhook (Configurar Webhook)

Configura a URL que receberá os webhooks de respostas dos usuários.

### Endpoint
```
POST {{baseurl}}/webhook
```

### Headers
```
Content-Type: application/json
Authorization: Bearer {{seutoken}}
```

### Request Body
```json
{
  "webhook": "https://seu-webhook.com/endpoint"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `webhook` | string | ✅ | URL completa do webhook (HTTPS) |

### Response
```json
{
  "status": true,
  "message": "Webhook configured successfully"
}
```

### Exemplo NodeJS (Axios)
```javascript
const axios = require('axios');

const data = {
  "webhook": "https://seu-dominio.com/webhook/avisa"
};

const config = {
  method: 'post',
  url: 'https://www.avisaapi.com.br/api/webhook',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer SEU_TOKEN'
  },
  data
};

axios.request(config)
  .then((response) => console.log(response.data))
  .catch((error) => console.log(error));
```

---

## 🔍 5. Show Webhook (Consultar Webhook)

Retorna a URL do webhook configurado atualmente.

### Endpoint
```
GET {{baseurl}}/webhook
```

### Headers
```
Authorization: Bearer {{seutoken}}
```

### Response
```json
{
  "status": true,
  "webhook": "https://seu-dominio.com/webhook/avisa"
}
```

### Exemplo NodeJS (Axios)
```javascript
const axios = require('axios');

const config = {
  method: 'get',
  url: 'https://www.avisaapi.com.br/api/webhook',
  headers: {
    'Authorization': 'Bearer SEU_TOKEN'
  }
};

axios.request(config)
  .then((response) => console.log(response.data))
  .catch((error) => console.log(error));
```

---

### 6. Send Message (Texto Simples)
```
POST {{baseurl}}/actions/sendMessage
```
*Documentação pendente*

### 7. Send Media (Imagem/Vídeo)
```
POST {{baseurl}}/actions/sendMedia
```
*Documentação pendente*

---

## 🔧 Notas Técnicas

### Formato de Número
- Deve incluir DDI (código do país)
- Não incluir `@s.whatsapp.net`
- Exemplo: `5511999999999` (Brasil: 55 + DDD 11 + número)

### Limites
- **Botões:** Máximo 3 botões por mensagem
- **Texto do botão:** Máximo 20 caracteres
- **Título:** Máximo 60 caracteres
- **Lista:** Mínimo 1, máximo 10 itens por lista
- **Título do item:** Máximo 24 caracteres

### Webhooks
Para receber respostas dos botões, configure webhook no painel da Avisa API.

---

## ✅ Status de Implementação

| Endpoint | Documentado | Implementado | Testado |
|----------|-------------|--------------|---------|
| Send Buttons | ✅ | ✅ | ✅ |
| PIX Button | ✅ | ✅ | ✅ |
| Send List | ✅ | ✅ | ✅ |
| Set Webhook | ✅ | ⏳ | ⏳ |
| Show Webhook | ✅ | ⏳ | ⏳ |
| Send Message | ❌ | ❌ | ❌ |
| Send Media | ❌ | ❌ | ❌ |

---

**Última atualização:** 2026-01-04
