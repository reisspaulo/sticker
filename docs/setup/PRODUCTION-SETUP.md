# 🏗️ Documentação da Infraestrutura de Produção

> **Projeto:** Sticker Bot WhatsApp
> **Ambiente:** Produção
> **Última atualização:** 28/12/2024

---

## 📋 Visão Geral

### **Stack Tecnológico**

```
Frontend/Interface: WhatsApp (via Evolution API)
Backend: Node.js 20 + Fastify + TypeScript
Worker: BullMQ (Redis)
Database: PostgreSQL (Supabase)
Storage: S3-compatible (Supabase Storage)
Queue: Redis
Deployment: Docker Swarm
Reverse Proxy: Traefik
CI/CD: Manual via Docker Build + Push
Secrets: Doppler
```

---

## 🌍 Domínios e DNS

### **Domínio Principal**
```
ytem.com.br
```

### **Subdomínios Ativos**

| Subdomínio | Serviço | IP | Porta | SSL |
|------------|---------|----|----|-----|
| `wa.ytem.com.br` | Evolution API | 69.62.100.250 | 8080 | ✅ Let's Encrypt |
| `stickers.ytem.com.br` | Sticker Bot Backend | 69.62.100.250 | 3000 | ✅ Let's Encrypt |

### **Configuração DNS**

**Registrador:** (Não especificado no código)

**Registros:**
```dns
; A Records
wa.ytem.com.br.         IN  A   69.62.100.250
stickers.ytem.com.br.   IN  A   69.62.100.250

; TTL recomendado: 3600 (1 hora)
```

### **Fluxo de Requisição**

```
Cliente (WhatsApp/Browser)
    ↓
DNS Resolver
    ↓
69.62.100.250:443 (HTTPS)
    ↓
Traefik (Reverse Proxy)
    ↓
┌─────────────────┬─────────────────┐
│ wa.ytem.com.br  │ stickers.ytem   │
│      ↓          │      ↓          │
│ Evolution API   │ Sticker Backend │
│   (Port 8080)   │   (Port 3000)   │
└─────────────────┴─────────────────┘
```

---

## 🐳 Docker Swarm Stack

### **VPS Host**
```
IP: 69.62.100.250
OS: Linux (assumido)
Docker: Swarm Mode
Acesso: SSH via password (Doppler: VPS_HOST, VPS_USER, VPS_PASSWORD)
```

### **Networks**

```yaml
networks:
  traefik-public:
    external: true     # Rede compartilhada para Traefik
  ytem-backend:
    external: true     # Rede interna para serviços
```

### **Serviços Deployados**

#### **1. Backend (sticker_backend)**

```yaml
Service: sticker_backend
Image: ghcr.io/reisspaulo/sticker-bot-backend:latest
Command: node dist/server.js
Replicas: 1
Placement: manager node
Port: 3000 (interno)
Networks:
  - traefik-public
  - ytem-backend
```

**Variáveis de Ambiente:**
```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
SUPABASE_URL=https://ludlztjdvwsrwlsczoje.supabase.co
SUPABASE_SERVICE_KEY=<from-doppler>
REDIS_URL=redis://:ytem_redis_secure_2024@ytem-databases_redis:6379
EVOLUTION_API_URL=http://evolution_evolution_api:8080
EVOLUTION_API_KEY=<from-doppler>
EVOLUTION_INSTANCE=meu-zap
```

**Recursos:**
```yaml
Limits:
  CPU: 0.5
  Memory: 512M
Reservations:
  CPU: 0.1
  Memory: 128M
```

**Health Check:**
```bash
URL: https://stickers.ytem.com.br/health
Interval: 30s
Path: /health
Expected: {"status":"healthy"}
```

**Traefik Labels:**
```yaml
traefik.enable: true
traefik.docker.network: traefik-public
traefik.http.routers.sticker-api.rule: Host(`stickers.ytem.com.br`)
traefik.http.routers.sticker-api.entrypoints: websecure
traefik.http.routers.sticker-api.tls: true
traefik.http.routers.sticker-api.tls.certresolver: letsencrypt
traefik.http.services.sticker-api.loadbalancer.server.port: 3000
traefik.http.services.sticker-api.loadbalancer.healthcheck.path: /health
traefik.http.services.sticker-api.loadbalancer.healthcheck.interval: 30s
```

---

#### **2. Worker (sticker_worker)**

```yaml
Service: sticker_worker
Image: ghcr.io/reisspaulo/sticker-bot-worker:latest
Command: node dist/worker.js
Replicas: 1
Placement: manager node
Networks:
  - traefik-public
  - ytem-backend
```

**Variáveis de Ambiente:**
```bash
NODE_ENV=production
LOG_LEVEL=info
SUPABASE_URL=https://ludlztjdvwsrwlsczoje.supabase.co
SUPABASE_SERVICE_KEY=<from-doppler>
REDIS_URL=redis://:ytem_redis_secure_2024@ytem-databases_redis:6379
EVOLUTION_API_URL=http://evolution_evolution_api:8080
EVOLUTION_API_KEY=<from-doppler>
EVOLUTION_INSTANCE=meu-zap
```

**Recursos:**
```yaml
Limits:
  CPU: 1.0
  Memory: 1024M
Reservations:
  CPU: 0.25
  Memory: 256M
```

**Concorrência:**
- BullMQ workers: 5 simultâneos
- Scheduled jobs: 1 simultâneo

---

#### **3. Evolution API (evolution_evolution_api)**

```yaml
Service: evolution_evolution_api
Stack: evolution (stack separado)
URL: https://wa.ytem.com.br
Instance: meu-zap
Status: open (conectado)
Profile: Clareoou
```

**API Key:**
```
I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=
```

**Webhook Configurado:**
```json
{
  "url": "https://stickers.ytem.com.br/webhook",
  "enabled": true,
  "events": [
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "MESSAGES_DELETE",
    "SEND_MESSAGE",
    "CONNECTION_UPDATE"
  ],
  "headers": {
    "apikey": "I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
  }
}
```

---

#### **4. Redis (ytem-databases_redis)**

```yaml
Service: ytem-databases_redis
Stack: ytem-databases (stack separado)
Port: 6379
Password: ytem_redis_secure_2024
Network: ytem-backend
```

**Uso:**
- Filas BullMQ (process-sticker, scheduled-jobs)
- Cache de sessões
- Pub/Sub para eventos

---

## 🗄️ Supabase (Database + Storage)

### **Projeto Supabase**

```
URL: https://ludlztjdvwsrwlsczoje.supabase.co
Project ID: ludlztjdvwsrwlsczoje
Region: us-east-1 (assumido)
Tier: Free/Pro (não especificado)
```

### **Banco de Dados (PostgreSQL)**

**Connection String:**
```
postgresql://postgres:[password]@db.ludlztjdvwsrwlsczoje.supabase.co:5432/postgres
```

**Tabelas:**

#### **users**
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text UNIQUE NOT NULL,
  name text,
  daily_count integer DEFAULT 0,
  last_reset_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_interaction timestamptz DEFAULT now()
);

-- Dados: 3 usuários cadastrados
```

#### **stickers**
```sql
CREATE TABLE stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_number text NOT NULL,
  user_name text,
  storage_path text NOT NULL,
  processed_url text NOT NULL,
  original_url text,
  file_size integer,
  processing_time_ms integer,
  tipo text CHECK (tipo IN ('estatico', 'animado')),
  status text DEFAULT 'enviado' CHECK (status IN ('enviado', 'pendente')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Dados: 21 stickers
-- Total storage: ~3MB
-- Usuários: 2 (Paulo + 1 grupo)
```

#### **usage_logs**
```sql
CREATE TABLE usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_number text NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Actions disponíveis:
-- - webhook_received
-- - message_received
-- - processing_started
-- - sticker_created
-- - processing_completed
-- - processing_failed
-- - limit_reached
-- - error
```

### **Storage (Buckets)**

#### **stickers-estaticos**
```
Bucket: stickers-estaticos
Public: true
Allowed MIME types: image/webp
Max file size: 100KB
Path pattern: user_{number}/{timestamp}_{hash}.webp
```

**Exemplo:**
```
https://ludlztjdvwsrwlsczoje.supabase.co/storage/v1/object/public/stickers-estaticos/user_5511946304133/1766889344797_4a81c0e5ab7bbfeb.webp
```

#### **stickers-animados**
```
Bucket: stickers-animados
Public: true
Allowed MIME types: image/webp
Max file size: 500KB
Path pattern: user_{number}/{timestamp}_{hash}.webp
```

**Políticas RLS:** Desabilitadas (buckets públicos)

---

## 🔐 Secrets Management (Doppler)

### **Projeto Doppler**

```
Project: sticker
Configs:
  - dev (desenvolvimento)
  - prd (produção) ← ATIVO
```

### **Secrets em Produção (prd)**

```bash
# Supabase
SUPABASE_URL=https://ludlztjdvwsrwlsczoje.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG... (JWT token)

# Evolution API
EVOLUTION_API_URL=http://evolution_evolution_api:8080
EVOLUTION_API_KEY=I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=
EVOLUTION_INSTANCE=meu-zap

# Redis
REDIS_URL=redis://:ytem_redis_secure_2024@ytem-databases_redis:6379

# VPS Access (para deploy)
VPS_HOST=69.62.100.250
VPS_USER=root
VPS_PASSWORD=<password>

# Config
LOG_LEVEL=info
NODE_ENV=production
```

### **Acesso aos Secrets**

```bash
# Via CLI
doppler secrets --project sticker --config prd

# Obter secret específico
doppler secrets get SUPABASE_URL --plain --project sticker --config prd

# Injetar em comando
doppler run --project sticker --config prd -- npm start
```

---

## 📊 Monitoramento e Logs

### **Logs de Aplicação**

**Docker logs:**
```bash
# Backend
docker service logs sticker_backend --tail 100 --follow

# Worker
docker service logs sticker_worker --tail 100 --follow
```

**Formato dos logs:**
```json
{
  "level": 30,
  "time": 1766889344293,
  "pid": 1,
  "hostname": "b3e91b33ac3a",
  "msg": "Processing sticker job",
  "jobId": "5511946304133-1766889344287",
  "userNumber": "5511946304133"
}
```

**Níveis de log:**
- 10: trace
- 20: debug
- 30: info (padrão produção)
- 40: warn
- 50: error
- 60: fatal

### **Logs no Banco (usage_logs)**

Todos os eventos importantes são salvos em `usage_logs`:
- Webhooks recebidos
- Mensagens processadas
- Stickers criados
- Erros
- Limites atingidos

**Query útil:**
```sql
SELECT action, COUNT(*)
FROM usage_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY action;
```

### **Métricas**

**Health Check:**
```bash
curl https://stickers.ytem.com.br/health

# Retorna:
{
  "status": "healthy",
  "timestamp": "2025-12-28T02:34:25.576Z",
  "services": {
    "redis": "connected",
    "supabase": "connected"
  }
}
```

**Métricas de uso:**
```sql
-- Stickers processados hoje
SELECT COUNT(*) FROM stickers
WHERE created_at::date = CURRENT_DATE;

-- Tempo médio de processamento
SELECT AVG(processing_time_ms) as avg_ms FROM stickers
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Usuários ativos
SELECT COUNT(DISTINCT user_number) FROM stickers
WHERE created_at > NOW() - INTERVAL '7 days';
```

---

## 🔄 CI/CD Pipeline

### **Atual (Manual)**

```mermaid
graph LR
    A[Code Change] --> B[npm run build]
    B --> C[docker buildx build]
    C --> D[Push to GHCR]
    D --> E[VPS: docker service update]
    E --> F[Health Check]
```

**Comandos:**
```bash
# 1. Build TypeScript
npm run build

# 2. Build e push Docker
docker buildx build --platform linux/amd64 \
  -t ghcr.io/reisspaulo/sticker-bot-backend:latest \
  -t ghcr.io/reisspaulo/sticker-bot-worker:latest \
  . --push

# 3. Update services
vps-ssh "docker service update --force --with-registry-auth \
  --image ghcr.io/reisspaulo/sticker-bot-backend:latest sticker_backend && \
  docker service update --force --with-registry-auth \
  --image ghcr.io/reisspaulo/sticker-bot-worker:latest sticker_worker"
```

### **Container Registry**

```
Registry: GitHub Container Registry (ghcr.io)
Organization: reisspaulo
Images:
  - ghcr.io/reisspaulo/sticker-bot-backend:latest
  - ghcr.io/reisspaulo/sticker-bot-worker:latest
Visibility: Private
Authentication: GitHub PAT (via docker login)
```

---

## 📱 WhatsApp Integration

### **Evolution API Instance**

```json
{
  "id": "b2b76790-7a59-4eae-81dc-7dfabd0784b8",
  "name": "meu-zap",
  "connectionStatus": "open",
  "profileName": "Clareoou",
  "number": null,
  "integration": "WHATSAPP-BAILEYS",
  "serverUrl": "https://wa.ytem.com.br",
  "apikey": "I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
}
```

### **QR Code para Reconexão**

```bash
# Gerar QR code
curl -s https://wa.ytem.com.br/instance/connect/meu-zap \
  -H "apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" | \
  jq -r '.base64' | \
  sed 's/data:image\/png;base64,//' | \
  base64 -D > /tmp/qrcode.png && \
  open /tmp/qrcode.png
```

### **Webhook Endpoints**

**Recebe eventos:**
```
POST https://stickers.ytem.com.br/webhook
```

**Eventos processados:**
- `messages.upsert`: Nova mensagem recebida
- `messages.update`: Mensagem atualizada (status lida, etc)
- `connection.update`: Status da conexão mudou

**Ignorados:**
- Mensagens do próprio bot (`fromMe: true`)
- Mensagens de texto simples (não imagem/gif)
- Eventos que não são `messages.upsert`

---

## 🔒 Segurança

### **Autenticação**

**Backend API:**
```typescript
// Middleware: src/middleware/auth.ts
// Valida header 'apikey' contra EVOLUTION_API_KEY
```

**Evolution API:**
```
Header: apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=
```

### **SSL/TLS**

```
Certificados: Let's Encrypt
Renovação: Automática via Traefik
Válidos até: ~90 dias
TLS Version: 1.2+
```

### **Secrets**

- ❌ Não commitados no git
- ✅ Armazenados no Doppler
- ✅ Injetados em runtime via env vars
- ✅ Não aparecem em logs

### **Limitações**

- Rate limiting: Não implementado
- DDoS protection: Apenas Traefik básico
- WAF: Não configurado
- Firewall: Configuração padrão VPS

---

## 🚨 Disaster Recovery

### **Backup**

**Banco de Dados:**
- Supabase faz backup automático diário
- Recovery point: últimas 24h
- Restore: via Supabase Dashboard

**Storage:**
- Arquivos em S3 (Supabase)
- Durabilidade: 99.999999999% (11 noves)
- Não há backup adicional configurado

**Código:**
- Git repository (assumido GitHub)
- Container images no GHCR

### **Rollback**

```bash
# 1. Identificar versão anterior
vps-ssh "docker service inspect sticker_backend --format='{{json .PreviousSpec}}'"

# 2. Fazer rollback
vps-ssh "docker service rollback sticker_backend"
vps-ssh "docker service rollback sticker_worker"

# 3. Verificar
curl https://stickers.ytem.com.br/health
```

### **Reconstrução do Zero**

1. **VPS nova:**
```bash
# Instalar Docker Swarm
docker swarm init
```

2. **Deploy Traefik** (se necessário)

3. **Deploy Evolution API** (se necessário)

4. **Deploy Sticker Bot:**
```bash
./deploy/deploy-sticker.sh prd
```

5. **Reconectar WhatsApp:**
```bash
# Gerar QR code e escanear
```

---

## 📈 Capacidade e Scaling

### **Limites Atuais**

```
Usuários simultâneos: ~50-100 (estimado)
Stickers/hora: ~1000 (estimado)
Worker concurrency: 5 jobs simultâneos
Backend replicas: 1
Worker replicas: 1
```

### **Bottlenecks**

1. **Worker (processamento de imagem)**
   - CPU-bound (ffmpeg, sharp)
   - Solução: Aumentar replicas do worker

2. **Redis (filas)**
   - Compartilhado com outros serviços
   - Solução: Redis dedicado

3. **Supabase (free tier)**
   - Limites de storage e database
   - Solução: Upgrade para plano pago

### **Escalar Horizontalmente**

```bash
# Aumentar workers
vps-ssh "docker service scale sticker_worker=3"

# Aumentar backends (se necessário)
vps-ssh "docker service scale sticker_backend=2"
```

### **Otimizações Futuras**

- [ ] CDN para stickers (CloudFlare)
- [ ] Rate limiting por usuário
- [ ] Cache de stickers processados
- [ ] Compressão agressiva de imagens
- [ ] Queue prioritization (VIP users)

---

## 📞 Suporte

### **Acessos Necessários**

```
VPS SSH: root@69.62.100.250 (password via Doppler)
Doppler: https://dashboard.doppler.com/
Supabase: https://supabase.com/dashboard
GHCR: GitHub account com acesso ao registry
```

### **Comandos de Diagnóstico**

```bash
# Status geral
vps-ssh "docker service ls"

# Logs em tempo real
vps-ssh "docker service logs -f sticker_backend"

# Reiniciar tudo
vps-ssh "docker stack rm sticker"
./deploy/deploy-sticker.sh prd

# Verificar saúde
curl https://stickers.ytem.com.br/health
```

---

**Documentação mantida por:** Paulo Henrique
**Projeto:** Sticker Bot WhatsApp
**Versão:** 1.0
**Data:** 28/12/2024
