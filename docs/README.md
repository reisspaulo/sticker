# 🚀 Sticker Bot - Setup Guide

Bot de WhatsApp que transforma imagens em stickers automaticamente.

> 🆕 **NOVO:** [Download de Vídeos do Twitter](TWITTER-VIDEO-DOWNLOAD.md) - Solução testada e funcionando!
> 📝 **v2.0:** Sistema de respostas baseado em texto + gerenciamento de contexto

---

## 📋 Requisitos

- **Node.js** 20+
- **Docker** e **Docker Compose**
- **Supabase** (conta gratuita)
- **Evolution API** (já configurada)

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
SUPABASE_URL=https://ludlztjdvwsrwlsczoje.supabase.co
SUPABASE_SERVICE_KEY=seu-service-key-aqui

# Evolution API (local)
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=
EVOLUTION_INSTANCE=meu-zap
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
    "evolution_api": "connected"
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

## 🔗 Conectar Evolution API

### Local (dev)
No dashboard da Evolution API (http://localhost:3001), configure o webhook:

1. Vá em **Instâncias** → **meu-zap**
2. Clique em **Webhook**
3. URL: `http://localhost:3000/webhook`
4. Events: Selecione `MESSAGES_UPSERT`
5. Salvar

### Produção ✅ Deployado
Evolution API rodando em: https://wa.ytem.com.br

Configure webhook via Evolution Manager (https://wa-manager.ytem.com.br):
1. Instâncias → **meu-zap**
2. Webhook URL: `https://stickers.ytem.com.br/webhook`
3. Events: `MESSAGES_UPSERT`

---

## 🐞 Troubleshooting

### Erro: "SUPABASE_URL must be defined"

- Verifique se o `.env` existe
- Verifique se as variáveis estão preenchidas

### Erro: "Evolution API connection refused"

- Certifique-se que Evolution API está rodando
- Local: `docker ps | grep evolution`
- Produção: `curl https://wa.ytem.com.br`

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

- ☁️ **DNS Cloudflare configurado** (stickers.ytem.com.br → 69.62.100.250)
- 🔑 Acesso ao Doppler (projeto `sticker`)
- 🖥️ Acesso à VPS (69.62.100.250 - Contabo srv1007351)
- 📦 GitHub Container Registry configurado
- ✅ **Evolution API deployada** (https://wa.ytem.com.br)

### 1. Configurar DNS no Cloudflare ⚠️ PRIMEIRO PASSO

**Antes de tudo**, configure o DNS:

1. Acesse: https://dash.cloudflare.com
2. Selecione domínio **ytem.com.br**
3. DNS → **Add record**:
   - **Type:** A
   - **Name:** stickers
   - **IPv4:** 69.62.100.250
   - **Proxy:** ☁️ Proxied (ON)
   - **TTL:** Auto
4. SSL/TLS → **Full (strict)**

**DNS já configurados:**
- ✅ wa.ytem.com.br → Evolution API
- ✅ wa-manager.ytem.com.br → Evolution Manager

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
  SUPABASE_URL="https://ludlztjdvwsrwlsczoje.supabase.co" \
  SUPABASE_SERVICE_KEY="<service_key>" \
  EVOLUTION_API_URL="http://evolution_api:8080" \
  EVOLUTION_API_KEY="I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" \
  EVOLUTION_INSTANCE="meu-zap" \
  LOG_LEVEL="info" \
  --project sticker --config prd
```

### 3. Build e Deploy

```bash
# 1. Build código
npm run build

# 2. Build imagem Docker
docker build -t ghcr.io/reisspaulo/sticker-bot-backend:latest -t ghcr.io/reisspaulo/sticker-bot-worker:latest .

# 3. Push para registry
docker push ghcr.io/reisspaulo/sticker-bot-backend:latest
docker push ghcr.io/reisspaulo/sticker-bot-worker:latest

# 4. Deploy para VPS (aguarda DNS propagar se necessário)
./deploy/deploy-sticker.sh prd
```

### 4. Verificar Deploy

```bash
# Verificar DNS (deve resolver)
dig stickers.ytem.com.br

# Health check (deve retornar 200)
curl https://stickers.ytem.com.br/health

# Verificar certificado SSL (deve ser Let's Encrypt)
echo | openssl s_client -servername stickers.ytem.com.br -connect stickers.ytem.com.br:443 2>/dev/null | openssl x509 -noout -issuer

# Ver logs (usar vps-ssh wrapper)
vps-ssh "docker service logs sticker_backend --tail 100"

# Ver status
vps-ssh "docker service ls | grep sticker"

# Verificar Evolution API
curl https://wa.ytem.com.br
```

### 5. Configurar Webhook na Evolution API ✅

Acessar Evolution Manager: https://wa-manager.ytem.com.br

1. Instâncias → **meu-zap** (b2b76790-7a59-4eae-81dc-7dfabd0784b8)
2. Webhook → **URL:** `https://stickers.ytem.com.br/webhook`
3. Events → Selecione `MESSAGES_UPSERT`
4. Salvar

### 📚 Guias Detalhados

- **DNS Cloudflare:** `deploy/CLOUDFLARE-DNS-SETUP.md` ⚠️ **Ler primeiro!**
- **Doppler Setup:** `deploy/DOPPLER-SETUP.md`
- **Deployment Guide:** `deploy/DEPLOYMENT-GUIDE.md`

---

## 🚀 Status do Projeto

**Sprints Concluídos:**
- [x] Sprint 1: Setup inicial
- [x] Sprint 2-7: Desenvolvimento local completo
- [x] Sprint 8 (Parte 1): Evolution API deployada ✅

**Próximos Passos:**
- [ ] Sprint 8 (Parte 2): Deploy Sticker Bot
- [ ] Configurar webhook Evolution → Sticker Bot
- [ ] Testes end-to-end em produção

**URLs em Produção:**
- ✅ Evolution API: https://wa.ytem.com.br
- ✅ Evolution Manager: https://wa-manager.ytem.com.br
- ⏳ Sticker Bot: https://stickers.ytem.com.br (pendente)

---

**Última atualização:** 2025-12-27
