# 📡 Documentação de Endpoints - Evolution API

> Referência completa de todos os endpoints disponíveis na Evolution API v2.2.3

## 🔑 Autenticação

Todos os endpoints requerem autenticação via header:

```http
apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=
```

## 🌐 Base URL

```
http://localhost:8080
```

## 📚 Documentação Interativa

Acesse a documentação Swagger interativa em:
- **URL:** http://localhost:8080/manager
- **Credenciais:** Use a API Key acima

---

## 📋 Índice de Endpoints

- [Instance (Instâncias)](#instance---instâncias)
- [Message (Mensagens)](#message---mensagens)
- [Chat (Conversas)](#chat---conversas)
- [Contact (Contatos)](#contact---contatos)
- [Group (Grupos)](#group---grupos)
- [Webhook](#webhook)

---

## Instance - Instâncias

### Criar Instância

Cria uma nova instância do WhatsApp.

**Endpoint:**
```http
POST /instance/create
```

**Headers:**
```json
{
  "apikey": "I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "instanceName": "meu-whatsapp",
  "integration": "WHATSAPP-BAILEYS"
}
```

**Resposta (200 OK):**
```json
{
  "instance": {
    "instanceName": "meu-whatsapp",
    "instanceId": "uuid-aqui",
    "integration": "WHATSAPP-BAILEYS",
    "status": "close"
  },
  "hash": "hash-unico",
  "webhook": {},
  "websocket": {},
  "settings": {
    "rejectCall": false,
    "msgCall": "",
    "groupsIgnore": false,
    "alwaysOnline": false,
    "readMessages": false,
    "readStatus": false,
    "syncFullHistory": false
  }
}
```

**Exemplo cURL:**
```bash
curl -X POST http://localhost:8080/instance/create \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "instanceName": "meu-whatsapp",
    "integration": "WHATSAPP-BAILEYS"
  }'
```

---

### Conectar Instância (Obter QR Code)

Obtém o QR Code para conectar a instância ao WhatsApp.

**Endpoint:**
```http
GET /instance/connect/{instanceName}
```

**Headers:**
```json
{
  "apikey": "I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
}
```

**Resposta (200 OK):**
```json
{
  "pairingCode": null,
  "code": "codigo-qr-texto",
  "base64": "data:image/png;base64,iVBORw0KGgo...",
  "count": 1
}
```

**Exemplo cURL:**
```bash
curl http://localhost:8080/instance/connect/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

### Verificar Status da Conexão

Verifica o estado atual da conexão da instância.

**Endpoint:**
```http
GET /instance/connectionState/{instanceName}
```

**Resposta (200 OK):**
```json
{
  "instance": {
    "instanceName": "meu-whatsapp",
    "state": "open"
  }
}
```

**Estados possíveis:**
- `close` - Desconectado
- `connecting` - Conectando
- `open` - Conectado

**Exemplo cURL:**
```bash
curl http://localhost:8080/instance/connectionState/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

### Listar Todas as Instâncias

Lista todas as instâncias criadas.

**Endpoint:**
```http
GET /instance/fetchInstances
```

**Resposta (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "meu-whatsapp",
    "connectionStatus": "open",
    "ownerJid": "5511999999999@s.whatsapp.net",
    "profileName": "Meu Nome",
    "profilePicUrl": "url-da-foto",
    "integration": "WHATSAPP-BAILEYS",
    "number": "5511999999999"
  }
]
```

**Exemplo cURL:**
```bash
curl http://localhost:8080/instance/fetchInstances \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

### Deletar Instância

Remove uma instância e todos seus dados.

**Endpoint:**
```http
DELETE /instance/delete/{instanceName}
```

**Resposta (200 OK):**
```json
{
  "status": "SUCCESS",
  "error": false,
  "response": {
    "message": "Instance deleted"
  }
}
```

**Exemplo cURL:**
```bash
curl -X DELETE http://localhost:8080/instance/delete/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

### Logout da Instância

Desconecta a instância do WhatsApp sem deletar.

**Endpoint:**
```http
DELETE /instance/logout/{instanceName}
```

**Exemplo cURL:**
```bash
curl -X DELETE http://localhost:8080/instance/logout/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

## Message - Mensagens

### Enviar Mensagem de Texto

Envia uma mensagem de texto simples.

**Endpoint:**
```http
POST /message/sendText/{instanceName}
```

**Body:**
```json
{
  "number": "5511999999999",
  "text": "Olá! Esta é uma mensagem de teste.",
  "delay": 1000
}
```

**Parâmetros:**
- `number` (obrigatório): Número do destinatário no formato internacional
- `text` (obrigatório): Texto da mensagem
- `delay` (opcional): Delay em ms antes de enviar

**Resposta (200 OK):**
```json
{
  "key": {
    "remoteJid": "5511999999999@s.whatsapp.net",
    "fromMe": true,
    "id": "message-id"
  },
  "message": {
    "conversation": "Olá! Esta é uma mensagem de teste."
  },
  "messageTimestamp": "1703612345"
}
```

**Exemplo cURL:**
```bash
curl -X POST http://localhost:8080/message/sendText/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "text": "Olá! Mensagem via Evolution API"
  }'
```

---

### Enviar Mídia (Imagem, Vídeo, Áudio)

Envia arquivo de mídia.

**Endpoint:**
```http
POST /message/sendMedia/{instanceName}
```

**Body:**
```json
{
  "number": "5511999999999",
  "mediatype": "image",
  "media": "https://exemplo.com/imagem.jpg",
  "caption": "Legenda da imagem",
  "fileName": "imagem.jpg"
}
```

**Tipos de mídia:**
- `image` - Imagens (JPG, PNG)
- `video` - Vídeos (MP4, AVI)
- `audio` - Áudios (MP3, OGG)
- `document` - Documentos (PDF, DOC, etc)

**Exemplo cURL:**
```bash
curl -X POST http://localhost:8080/message/sendMedia/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "mediatype": "image",
    "media": "https://exemplo.com/foto.jpg",
    "caption": "Olha essa foto!"
  }'
```

---

### Enviar Sticker (Figurinha)

Envia um sticker/figurinha.

**Endpoint:**
```http
POST /message/sendSticker/{instanceName}
```

**Body:**
```json
{
  "number": "5511999999999",
  "sticker": {
    "image": "https://exemplo.com/sticker.png"
  }
}
```

**Formatos suportados:**
- PNG (estático)
- WebP (estático ou animado)
- JPEG (convertido automaticamente)

**Exemplo cURL:**
```bash
curl -X POST http://localhost:8080/message/sendSticker/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "sticker": {
      "image": "https://exemplo.com/sticker.png"
    }
  }'
```

📖 **Documentação completa:** [docs/STICKERS.md](STICKERS.md)

---

### Enviar Áudio (PTT - Push to Talk)

Envia um áudio como mensagem de voz.

**Endpoint:**
```http
POST /message/sendWhatsAppAudio/{instanceName}
```

**Body:**
```json
{
  "number": "5511999999999",
  "audio": "https://exemplo.com/audio.mp3"
}
```

**Exemplo cURL:**
```bash
curl -X POST http://localhost:8080/message/sendWhatsAppAudio/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "audio": "https://exemplo.com/audio.mp3"
  }'
```

---

### Enviar Localização

Envia uma localização geográfica.

**Endpoint:**
```http
POST /message/sendLocation/{instanceName}
```

**Body:**
```json
{
  "number": "5511999999999",
  "latitude": -23.550520,
  "longitude": -46.633308,
  "name": "Av. Paulista",
  "address": "Avenida Paulista, São Paulo - SP"
}
```

**Exemplo cURL:**
```bash
curl -X POST http://localhost:8080/message/sendLocation/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "latitude": -23.550520,
    "longitude": -46.633308,
    "name": "Av. Paulista"
  }'
```

---

### Enviar Contato

Envia um cartão de contato.

**Endpoint:**
```http
POST /message/sendContact/{instanceName}
```

**Body:**
```json
{
  "number": "5511999999999",
  "contact": {
    "fullName": "João Silva",
    "wuid": "5511888888888",
    "phoneNumber": "5511888888888",
    "organization": "Empresa LTDA"
  }
}
```

**Exemplo cURL:**
```bash
curl -X POST http://localhost:8080/message/sendContact/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "contact": {
      "fullName": "João Silva",
      "wuid": "5511888888888",
      "phoneNumber": "5511888888888"
    }
  }'
```

---

## Chat - Conversas

### Listar Conversas

Lista todas as conversas ativas.

**Endpoint:**
```http
GET /chat/findChats/{instanceName}
```

**Exemplo cURL:**
```bash
curl http://localhost:8080/chat/findChats/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

### Buscar Mensagens

Busca mensagens de uma conversa específica.

**Endpoint:**
```http
GET /chat/findMessages/{instanceName}
```

**Query Parameters:**
- `remoteJid`: ID da conversa (ex: 5511999999999@s.whatsapp.net)
- `limit`: Número de mensagens (padrão: 50)
- `offset`: Offset para paginação

**Exemplo cURL:**
```bash
curl 'http://localhost:8080/chat/findMessages/meu-whatsapp?remoteJid=5511999999999@s.whatsapp.net&limit=20' \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

### Marcar como Lido

Marca mensagens como lidas.

**Endpoint:**
```http
POST /chat/markMessageAsRead/{instanceName}
```

**Body:**
```json
{
  "readMessages": [
    {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "message-id"
    }
  ]
}
```

---

## Contact - Contatos

### Buscar Contatos

Lista todos os contatos sincronizados.

**Endpoint:**
```http
GET /chat/findContacts/{instanceName}
```

**Exemplo cURL:**
```bash
curl http://localhost:8080/chat/findContacts/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

### Obter Foto de Perfil

Obtém a foto de perfil de um contato.

**Endpoint:**
```http
GET /chat/getProfilePicture/{instanceName}
```

**Query Parameters:**
- `number`: Número do contato

**Exemplo cURL:**
```bash
curl 'http://localhost:8080/chat/getProfilePicture/meu-whatsapp?number=5511999999999' \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

## Group - Grupos

### Listar Grupos

Lista todos os grupos que a instância participa.

**Endpoint:**
```http
GET /group/findGroupInfos/{instanceName}
```

**Exemplo cURL:**
```bash
curl http://localhost:8080/group/findGroupInfos/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

### Criar Grupo

Cria um novo grupo.

**Endpoint:**
```http
POST /group/create/{instanceName}
```

**Body:**
```json
{
  "subject": "Meu Grupo",
  "description": "Descrição do grupo",
  "participants": ["5511999999999", "5511888888888"]
}
```

---

### Enviar Mensagem para Grupo

Use os mesmos endpoints de mensagem, mas com o ID do grupo:

```bash
curl -X POST http://localhost:8080/message/sendText/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "120363XXXXXXXXX@g.us",
    "text": "Mensagem para o grupo"
  }'
```

---

## Webhook

### Configurar Webhook Global

Configure um webhook para receber eventos.

**Endpoint:**
```http
POST /webhook/set/{instanceName}
```

**Body:**
```json
{
  "enabled": true,
  "url": "https://seu-servidor.com/webhook",
  "webhookByEvents": false,
  "events": [
    "QRCODE_UPDATED",
    "CONNECTION_UPDATE",
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "SEND_MESSAGE"
  ]
}
```

**Eventos disponíveis:**
- `QRCODE_UPDATED` - QR Code atualizado
- `CONNECTION_UPDATE` - Status de conexão mudou
- `MESSAGES_UPSERT` - Nova mensagem recebida
- `MESSAGES_UPDATE` - Mensagem atualizada
- `SEND_MESSAGE` - Mensagem enviada
- `CONTACTS_UPDATE` - Contatos atualizados
- `CHATS_UPDATE` - Conversas atualizadas
- `GROUP_UPDATE` - Grupo atualizado

---

## 🔧 Exemplos Práticos

### Criar instância e conectar

```bash
# 1. Criar instância
curl -X POST http://localhost:8080/instance/create \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{"instanceName": "bot", "integration": "WHATSAPP-BAILEYS"}'

# 2. Obter QR Code
curl http://localhost:8080/instance/connect/bot \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' | jq -r '.base64' > qrcode.txt

# 3. Verificar status
curl http://localhost:8080/instance/connectionState/bot \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

## 📚 Recursos Adicionais

- 📖 [Documentação Oficial Evolution API v2](https://doc.evolution-api.com/v2/pt)
- 📖 [Documentação Oficial Evolution API v1](https://doc.evolution-api.com/v1/pt)
- 🔧 [Collection Postman](https://www.postman.com/agenciadgcode/evolution-api)
- 🐙 [GitHub Oficial](https://github.com/EvolutionAPI/evolution-api)

---

**Última atualização:** 26/12/2025
**Versão da API:** 2.2.3
