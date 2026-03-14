# 🚀 Sticker Bot - Setup Guide

Bot de WhatsApp que transforma imagens em stickers automaticamente.

> 📡 **API:** Meta Cloud API (WhatsApp Oficial) - ver [MIGRACAO-META-CLOUD-API.md](MIGRACAO-META-CLOUD-API.md)
> 🆕 **Templates:** Sistema de templates para janela 24h - ver [META-TEMPLATES.md](META-TEMPLATES.md)

---

## 📋 Requisitos

- **Node.js** 20+
- **Docker** e **Docker Compose**
- **Supabase** (conta gratuita)
- **Meta Cloud API** (conta Meta Business configurada) - ver [META-SETUP-CHECKLIST.md](META-SETUP-CHECKLIST.md)

---

## 🔧 Setup Local

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```bash
cp .env.example .env
```

Edite `.env` e preencha:

```env
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Supabase (pegar do dashboard)
SUPABASE_URL=https://YOUR_SUPABASE_PROJECT_ID.supabase.co
SUPABASE_SERVICE_KEY=seu-service-key-aqui

# Meta Cloud API (WhatsApp Oficial)
WHATSAPP_ACCESS_TOKEN=seu-token-aqui
WHATSAPP_PHONE_NUMBER_ID=seu-phone-number-id
WHATSAPP_BUSINESS_ACCOUNT_ID=seu-business-account-id
WHATSAPP_WEBHOOK_TOKEN=seu-webhook-verify-token
META_API_VERSION=v22.0
USE_META=true
```

### 3. Rodar em Desenvolvimento

```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Worker
npm run dev:worker
```

---

## 🧪 Estratégia de Desenvolvimento

**IMPORTANTE:** Este projeto segue uma estratégia de **desenvolvimento local primeiro**.

- ✅ **Sprints 2-7:** Desenvolvimento e testes LOCAL (Evolution + Sticker Bot no Mac)
- 🚀 **Sprint 8:** Deploy COMPLETO para VPS (produção real 24/7)

**Por quê?**
- Validar todas as funcionalidades sem riscos
- Testar integração completa localmente
- Menor risco ao fazer deploy em produção

Ver detalhes: `DEVELOPMENT-STRATEGY.md`

---

## 🐳 Deploy Local com Docker

### Build e Start

```bash
# Build da imagem
docker compose -f docker-compose.bot.yml build

# Iniciar serviços
docker compose -f docker-compose.bot.yml up -d
```

### Ver Logs

```bash
# Logs do backend
docker logs -f sticker_bot_backend

# Logs do worker
docker logs -f sticker_bot_worker
```

### Parar Serviços

```bash
docker compose -f docker-compose.bot.yml down
```

---

## 🧪 Testar

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-27T...",
  "services": {
    "supabase": "connected",
    "meta_cloud_api": "connected"
  }
}
```

### 2. Testar Webhook

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "meu-zap",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test123"
      },
      "pushName": "Paulo",
      "messageType": "imageMessage"
    }
  }'
```

---

## 📊 Verificar Banco de Dados

### Ver Usuários

```sql
SELECT * FROM users;
```

### Ver Stickers

```sql
SELECT * FROM stickers ORDER BY created_at DESC LIMIT 10;
```

### Ver Buckets

```sql
SELECT id, name, public, file_size_limit FROM storage.buckets
WHERE id IN ('stickers-estaticos', 'stickers-animados');
```

---

## 🔗 Configurar Meta Cloud API

### Webhook (recepção de mensagens)
Configurado no Meta Business Manager → WhatsApp → Configuration:

1. **Callback URL:** `https://your-domain.com/webhook/meta`
2. **Verify Token:** mesmo valor de `WHATSAPP_WEBHOOK_TOKEN`
3. **Subscription Fields:** `messages`

### Templates (envio fora da janela 24h)
Templates pré-aprovados no Meta Business Manager.
Ver guia completo: [META-TEMPLATES.md](META-TEMPLATES.md)

### Detalhes
Ver guia completo: [META-SETUP-CHECKLIST.md](META-SETUP-CHECKLIST.md)

---

## 🐞 Troubleshooting

### Erro: "SUPABASE_URL must be defined"

- Verifique se o `.env` existe
- Verifique se as variáveis estão preenchidas

### Erro: "Meta Cloud API token expired"

- Tokens temporários expiram em ~1h
- Gere token permanente via System User no Meta Business Manager
- Atualize via: `docker service update --env-add WHATSAPP_ACCESS_TOKEN=novo-token sticker_backend`

### Erro: "Health check failed"

- Verifique logs: `docker logs sticker_bot_backend`
- Verifique conexões: Supabase, Evolution API

---

## 📁 Estrutura do Projeto

```
sticker/
├── src/
│   ├── config/
│   │   ├── logger.ts         # Pino logger
│   │   ├── redis.ts          # Redis connection
│   │   ├── supabase.ts       # Supabase client
│   │   └── queue.ts          # BullMQ queues
│   ├── routes/
│   │   ├── webhook.ts        # Webhook endpoint
│   │   └── health.ts         # Health check
│   ├── services/             # Business logic (Sprint 2+)
│   ├── workers/              # Job processors (Sprint 3+)
│   ├── types/                # TypeScript types
│   ├── utils/                # Utility functions
│   ├── server.ts             # Fastify server
│   └── worker.ts             # BullMQ worker
├── dist/                     # Compiled TypeScript
├── docker-compose.bot.yml    # Docker config
├── Dockerfile                # Docker image
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
└── .env                      # Environment variables
```

---

## 🌐 Deploy para Produção

### Pré-requisitos

- ☁️ **DNS Cloudflare configurado** (your-domain.com → YOUR_VPS_IP)
- 🔑 Acesso ao Doppler (projeto `sticker`)
- 🖥️ Acesso à VPS (YOUR_VPS_IP - Contabo srv1007351)
- 📦 GitHub Container Registry configurado
- ✅ **Meta Cloud API configurada** (ver [META-SETUP-CHECKLIST.md](META-SETUP-CHECKLIST.md))

### 1. Configurar DNS no Cloudflare ⚠️ PRIMEIRO PASSO

**Antes de tudo**, configure o DNS:

1. Acesse: https://dash.cloudflare.com
2. Selecione domínio **your-domain.com**
3. DNS → **Add record**:
   - **Type:** A
   - **Name:** stickers
   - **IPv4:** YOUR_VPS_IP
   - **Proxy:** ☁️ Proxied (ON)
   - **TTL:** Auto
4. SSL/TLS → **Full (strict)**

Ver guia completo: `deploy/CLOUDFLARE-DNS-SETUP.md`

### 2. Configurar Doppler

Ver guia completo: `deploy/DOPPLER-SETUP.md`

```bash
# 1. Login no Doppler
doppler login

# 2. Criar projeto e configs
doppler projects create sticker
doppler configs create dev --project sticker
doppler configs create prd --project sticker

# 3. Adicionar secrets
doppler secrets set \
  SUPABASE_URL="https://YOUR_SUPABASE_PROJECT_ID.supabase.co" \
  SUPABASE_SERVICE_KEY="<service_key>" \
  EVOLUTION_API_URL="http://evolution_api:8080" \
  EVOLUTION_API_KEY="YOUR_EVOLUTION_API_KEY" \
  EVOLUTION_INSTANCE="meu-zap" \
  LOG_LEVEL="info" \
  --project sticker --config prd
```

### 3. Build e Deploy

```bash
# 1. Build código
npm run build

# 2. Build imagem Docker
docker build -t ghcr.io/your-username/stickerbot:latest -t ghcr.io/your-username/stickerbot:latest .

# 3. Push para registry
docker push ghcr.io/your-username/stickerbot:latest
docker push ghcr.io/your-username/stickerbot:latest

# 4. Deploy para VPS (aguarda DNS propagar se necessário)
./deploy/deploy-sticker.sh prd
```

### 4. Verificar Deploy

```bash
# Verificar DNS (deve resolver)
dig your-domain.com

# Health check (deve retornar 200)
curl https://your-domain.com/health

# Verificar certificado SSL (deve ser Let's Encrypt)
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -issuer

# Ver logs (usar vps-ssh wrapper)
vps-ssh "docker service logs sticker_backend --tail 100"

# Ver status
vps-ssh "docker service ls | grep sticker"

# Verificar Evolution API
curl https://your-evolution-api.com
```

### 5. Configurar Webhook Meta Cloud API

No Meta Business Manager → WhatsApp → Configuration:

1. **Callback URL:** `https://your-domain.com/webhook/meta`
2. **Verify Token:** valor de `WHATSAPP_WEBHOOK_TOKEN`
3. **Subscription Fields:** `messages`

### 📚 Guias Detalhados

- **Meta Cloud API:** [MIGRACAO-META-CLOUD-API.md](MIGRACAO-META-CLOUD-API.md)
- **Meta Setup:** [META-SETUP-CHECKLIST.md](META-SETUP-CHECKLIST.md)
- **DNS Cloudflare:** `deploy/CLOUDFLARE-DNS-SETUP.md`
- **Doppler Setup:** `deploy/DOPPLER-SETUP.md`
- **Deployment Guide:** `deploy/DEPLOYMENT-GUIDE.md`

---

## 🚀 Status do Projeto

**Concluído:**
- [x] Sprint 1: Setup inicial
- [x] Sprint 2-7: Desenvolvimento local completo
- [x] Sprint 8: Deploy VPS (Docker Swarm + Traefik)
- [x] Sprint 9+: Twitter, pagamentos, admin panel
- [x] Migração código Meta Cloud API

**Em andamento:**
- [ ] Registrar número real (+55) no Meta Business Manager
- [ ] Criar templates no Meta Business Manager
- [ ] Gerar token permanente (System User)
- [ ] Remover providers legados (Evolution, Avisa, Z-API)

**URLs em Produção:**
- ✅ Sticker Bot: https://your-domain.com
- ✅ Admin Panel: https://admin-your-domain.com

---

**Última atualização:** 2026-03-12
