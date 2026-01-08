# 🚀 Guia de Mudanças Rápidas - Sticker Bot

> Documentação atualizada em: 08/01/2026
> Ambiente: Produção em https://stickers.ytem.com.br

> **📚 Documentos relacionados:**
> - [CI/CD Workflow (Deploy Automatizado)](../setup/CI-CD-WORKFLOW.md) - Como fazer deploy via git push
> - [Deploy Manual (Emergência)](../setup/DEPLOYMENT-PROCESS.md)
> - [Configuração do Doppler](../setup/DOPPLER-SETUP.md)

---

## 📋 Índice

1. [Como Acessar a VPS](#como-acessar-a-vps)
2. [Arquitetura em Produção](#arquitetura-em-produção)
3. [Processo de Deploy](#processo-de-deploy)
4. [Mudanças Rápidas Comuns](#mudanças-rápidas-comuns)
5. [QR Code e WhatsApp](#qr-code-e-whatsapp)
6. [Domínios e Subdomínios](#domínios-e-subdomínios)
7. [Troubleshooting](#troubleshooting)
8. [Logs do Supabase](#logs-do-supabase)

---

## 🔐 Como Acessar a VPS

### **Pré-requisitos**

Antes de acessar a VPS, você precisa instalar e configurar:

#### 1. Instalar Doppler CLI

```bash
# macOS
brew install dopplerhq/cli/doppler

# Linux
curl -sLf https://cli.doppler.com/install.sh | sudo bash
```

#### 2. Instalar sshpass

```bash
# macOS (tap especial necessário)
brew install hudochenkov/sshpass/sshpass

# Linux (Ubuntu/Debian)
sudo apt-get install sshpass
```

#### 3. Fazer login no Doppler

```bash
doppler login
```

Isso abre o navegador para autenticar. Você precisa ter acesso ao projeto **brazyl** na organização YTEM.

#### 4. Criar o script vps-ssh

Crie o arquivo `~/bin/vps-ssh`:

```bash
mkdir -p ~/bin
cat > ~/bin/vps-ssh << 'EOF'
#!/bin/bash
# VPS SSH Wrapper - Usa Doppler para injetar credenciais

set -e

if ! command -v doppler &> /dev/null; then
    echo "❌ Doppler CLI não encontrado. Instale com: brew install dopplerhq/cli/doppler"
    exit 1
fi

VPS_HOST=$(doppler secrets get VPS_HOST --plain --config prd --project brazyl 2>/dev/null)
VPS_USER=$(doppler secrets get VPS_USER --plain --config prd --project brazyl 2>/dev/null)
VPS_PASSWORD=$(doppler secrets get VPS_PASSWORD --plain --config prd --project brazyl 2>/dev/null)

if [ -z "$VPS_HOST" ] || [ -z "$VPS_USER" ] || [ -z "$VPS_PASSWORD" ]; then
    echo "❌ Credenciais não encontradas no Doppler (projeto brazyl, config prd)"
    exit 1
fi

if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass não encontrado. Instale com: brew install hudochenkov/sshpass/sshpass"
    exit 1
fi

if [ -z "$1" ]; then
    echo "🔐 Conectando à VPS ${VPS_HOST}..."
    SSHPASS="$VPS_PASSWORD" sshpass -e ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}"
else
    SSHPASS="$VPS_PASSWORD" sshpass -e ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" "$@"
fi
EOF

chmod +x ~/bin/vps-ssh
```

#### 5. Adicionar ao PATH

Adicione ao seu `~/.zshrc` ou `~/.bashrc`:

```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### **Usando o vps-ssh**

```bash
# Abrir shell interativo na VPS
vps-ssh

# Executar comando único
vps-ssh "docker ps"

# Ver logs do backend
vps-ssh "docker service logs sticker_backend --tail 50"

# Ver status dos serviços
vps-ssh "docker service ls | grep sticker"
```

### **Verificar se está funcionando**

```bash
vps-ssh "echo 'Conexão OK' && hostname"
# Deve retornar: Conexão OK + nome do servidor
```

---

## 🏗️ Arquitetura em Produção

### **Infraestrutura**

```
┌─────────────────────────────────────────────────────────────┐
│                     VPS (69.62.100.250)                      │
│                     Docker Swarm Stack                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Backend    │  │    Worker    │  │  Evolution API  │  │
│  │   (Fastify)  │  │   (BullMQ)   │  │  (wa.ytem.com)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                  │                   │            │
│         └──────────┬───────┴───────────────────┘            │
│                    │                                        │
│         ┌──────────▼────────────┐                          │
│         │  Redis (ytem-redis)   │                          │
│         └───────────────────────┘                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Admin Panel (Next.js)                    │  │
│  │           admin-stickers.ytem.com.br                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Supabase (Cloud)      │
              │  - PostgreSQL          │
              │  - Storage (S3)        │
              │  - Auth (usuarios)     │
              └────────────────────────┘
```

### **Serviços Rodando**

| Serviço | URL | Porta | Função |
|---------|-----|-------|--------|
| **Backend** | https://stickers.ytem.com.br | 3000 | API REST + Webhooks |
| **Worker** | - | - | Processa filas BullMQ |
| **Admin Panel** | https://admin-stickers.ytem.com.br | 3000 | Gestao de stickers/emocoes |
| **Evolution API** | https://wa.ytem.com.br | 8080 | Integração WhatsApp |
| **Redis** | ytem-databases_redis:6379 | 6379 | Filas + Cache |
| **Supabase** | ludlztjdvwsrwlsczoje.supabase.co | 443 | Banco + Storage + Auth |

### **Imagens Docker**

```bash
ghcr.io/reisspaulo/sticker-bot-backend:latest  # Backend + Worker (mesma imagem)
ghcr.io/reisspaulo/sticker-bot-worker:latest   # Worker (mesma imagem)
ghcr.io/reisspaulo/sticker-admin:latest        # Admin Panel (Next.js)
```

---

## 🔄 Processo de Deploy

### **Deploy Completo (Passo a Passo)**

#### **1. Fazer Alterações no Código**

```bash
# Edite os arquivos necessários em src/
code src/services/messageService.ts  # Exemplo
```

#### **2. Testar Localmente (Opcional)**

```bash
npm run build  # Verifica se compila
npm test       # Se tiver testes
```

#### **3. Build TypeScript**

```bash
npm run build
```

Isso gera a pasta `dist/` com o código JavaScript compilado.

#### **4. Build e Push da Imagem Docker**

```bash
# Build para arquitetura AMD64 (VPS) e push para GitHub Container Registry
docker buildx build \
  --platform linux/amd64 \
  -t ghcr.io/reisspaulo/sticker-bot-backend:latest \
  -t ghcr.io/reisspaulo/sticker-bot-worker:latest \
  . \
  --push
```

**⚠️ IMPORTANTE:**
- Usar `--platform linux/amd64` (servidor é Linux AMD64, não ARM64)
- As duas tags são a mesma imagem (backend e worker usam o mesmo código)

#### **5. Atualizar Serviços na VPS**

```bash
# Conecta na VPS e atualiza os serviços
vps-ssh "docker service update --force --with-registry-auth \
  --image ghcr.io/reisspaulo/sticker-bot-backend:latest sticker_backend && \
  docker service update --force --with-registry-auth \
  --image ghcr.io/reisspaulo/sticker-bot-worker:latest sticker_worker"
```

**O que isso faz:**
- `--force`: Força atualização mesmo se imagem não mudou
- `--with-registry-auth`: Usa credenciais do Docker para puxar imagem privada
- Atualiza backend e worker em paralelo

#### **6. Verificar Saúde**

```bash
# Health check
curl https://stickers.ytem.com.br/health | jq '.'

# Deve retornar:
{
  "status": "healthy",
  "timestamp": "2025-12-28T02:34:25.576Z",
  "services": {
    "redis": "connected",
    "supabase": "connected"
  }
}
```

#### **7. Verificar Logs**

```bash
# Backend logs
vps-ssh "docker service logs sticker_backend --tail 50"

# Worker logs
vps-ssh "docker service logs sticker_worker --tail 50"
```

---

### **Deploy Rápido (Script Automatizado)**

Use o script já criado:

```bash
./deploy/deploy-sticker.sh prd
```

**O script faz:**
1. ✅ Carrega secrets do Doppler
2. ✅ Gera arquivo de stack com secrets
3. ✅ Copia para VPS
4. ✅ Faz deploy com `docker stack deploy`
5. ✅ Aguarda convergência
6. ✅ Testa health check

**Mas atenção:** Esse script **NÃO faz build da imagem**! Você precisa fazer o passo 4 antes.

---

## ⚡ Mudanças Rápidas Comuns

### **1. Alterar Mensagens (Copy)**

**Arquivo:** `src/services/messageService.ts`

```typescript
export async function sendWelcomeMessage(
  remoteJid: string,
  userName: string
): Promise<void> {
  const message = `Olá ${userName}! 👋\n\nBem-vindo ao bot de figurinhas!`;
  //              ↑ ALTERE AQUI

  await sendText(remoteJid, message);
}
```

**Deploy:**
```bash
npm run build
docker buildx build --platform linux/amd64 \
  -t ghcr.io/reisspaulo/sticker-bot-backend:latest \
  -t ghcr.io/reisspaulo/sticker-bot-worker:latest . --push
vps-ssh "docker service update --force --with-registry-auth \
  --image ghcr.io/reisspaulo/sticker-bot-backend:latest sticker_backend"
```

**Tempo:** ~5 minutos

---

### **2. Adicionar Campo na Tabela**

#### **2.1. Criar Migration**

```bash
# Acesse Supabase Dashboard ou use a CLI
# https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje
```

**SQL:**
```sql
-- Adicionar coluna
ALTER TABLE stickers
ADD COLUMN tags text[];

-- Adicionar comentário
COMMENT ON COLUMN stickers.tags IS 'Tags para categorização';

-- Criar índice (se necessário)
CREATE INDEX idx_stickers_tags ON stickers USING GIN(tags);
```

#### **2.2. Atualizar Código**

**Arquivo:** `src/types/evolution.ts` (ou criar interface)

```typescript
export interface Sticker {
  id: string;
  user_number: string;
  storage_path: string;
  tipo: 'estatico' | 'animado';
  tags?: string[];  // ← NOVO CAMPO
  // ... outros campos
}
```

**Arquivo:** `src/worker.ts` (atualizar insert)

```typescript
const { error: stickerError } = await supabase.from('stickers').insert({
  user_number: userNumber,
  tipo,
  storage_path: path,
  file_size: processedBuffer.length,
  tags: ['meme', 'engraçado'],  // ← USAR NOVO CAMPO
  // ... outros campos
});
```

#### **2.3. Deploy**

Mesmo processo do item 1.

**Tempo:** ~10 minutos

---

### **3. Alterar Limites (ex: stickers por dia)**

**Arquivo:** `src/routes/webhook.ts`

```typescript
// Linha 132
const hasReachedLimit = await checkDailyLimit(user.id);
```

**Arquivo:** `src/services/userService.ts`

```typescript
export async function checkDailyLimit(userId: string): Promise<boolean> {
  const DAILY_LIMIT = 10;  // ← ALTERE AQUI

  const user = await getUserById(userId);
  return user.daily_count >= DAILY_LIMIT;
}
```

**Também alterar no worker:**

**Arquivo:** `src/worker.ts`

```typescript
// Linha 134
const remainingToday = Math.max(0, 10 - newCount);
//                                  ↑ ALTERE AQUI TAMBÉM
```

**Deploy:** Mesmo processo do item 1.

**Tempo:** ~5 minutos

---

### **4. Adicionar Nova Variável de Ambiente**

#### **4.1. Adicionar no Doppler**

```bash
# Via CLI
doppler secrets set NEW_FEATURE_ENABLED=true --project sticker --config prd

# Ou via Dashboard: https://dashboard.doppler.com/
```

#### **4.2. Atualizar Stack File**

**Arquivo:** `deploy/deploy-sticker.sh`

```bash
# Linha 35 - Carregar secret
NEW_FEATURE_ENABLED=$(doppler secrets get NEW_FEATURE_ENABLED --plain --project sticker --config "$CONFIG")

# Linha 62 - Adicionar no environment do backend
environment:
  - NODE_ENV=production
  - NEW_FEATURE_ENABLED=${NEW_FEATURE_ENABLED}  # ← NOVO
```

#### **4.3. Usar no Código**

```typescript
const isFeatureEnabled = process.env.NEW_FEATURE_ENABLED === 'true';

if (isFeatureEnabled) {
  // ... lógica da feature
}
```

#### **4.4. Deploy**

```bash
# Atualizar stack (não precisa rebuild da imagem se só mudou env var)
./deploy/deploy-sticker.sh prd
```

**Tempo:** ~3 minutos

---

### **5. Alterar Tamanho/Qualidade dos Stickers**

**Arquivo:** `src/services/stickerProcessor.ts`

```typescript
// Linha ~40 - Tamanho máximo
const MAX_DIMENSION = 512;  // ← ALTERE (max 512 para WhatsApp)

// Linha ~80 - Qualidade
.webp({ quality: 90 })  // ← ALTERE (0-100)
```

**Arquivo:** `src/services/gifProcessor.ts`

```typescript
// Linha ~60 - Tamanho
const MAX_DIMENSION = 512;  // ← ALTERE

// Linha ~100 - FPS
const targetFps = 15;  // ← ALTERE
```

**Deploy:** Mesmo processo do item 1.

**Tempo:** ~5 minutos

---

### **6. Alterar Admin Panel**

O Admin Panel é uma aplicação Next.js separada para gerenciar stickers e classificação de emoções.

#### **Arquivos Principais**

| Arquivo | Função |
|---------|--------|
| `admin-panel/src/app/page.tsx` | Página principal (listagem de stickers) |
| `admin-panel/src/app/login/page.tsx` | Página de login |
| `admin-panel/src/lib/auth.tsx` | Contexto de autenticação |
| `admin-panel/src/lib/supabase.ts` | Cliente Supabase |

#### **Deploy do Admin Panel**

```bash
# 1. Fazer alterações
cd admin-panel
code src/app/page.tsx

# 2. Commit e push (deploy automático)
git add .
git commit -m "feat: melhora UI do admin"
git push origin main

# 3. Acompanhar em:
# https://github.com/reisspaulo/sticker/actions
```

**Workflow**: `.github/workflows/deploy-admin.yml`

#### **Autenticação**

O admin usa Supabase Auth com verificação de role:
- Apenas usuários com `role = 'admin'` na tabela `user_profiles` podem acessar
- Login: https://admin-stickers.ytem.com.br/login

#### **Criar Novo Admin**

```sql
-- Via Supabase SQL Editor
-- 1. Primeiro crie o usuário via Auth (Dashboard ou API)
-- 2. Depois atualize o role:
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'novo.admin@empresa.com';
```

#### **Verificar Logs do Admin**

```bash
vps-ssh "docker service logs sticker_admin --tail 50"
```

**Tempo:** ~3 minutos (deploy automático via GitHub Actions)

---

## 📱 QR Code e WhatsApp

### **Como Funciona**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Evolution   │────▶│   Instância  │────▶│   WhatsApp   │
│     API      │     │   "meu-zap"  │     │    Client    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
       │ 1. Gera QR Code    │                     │
       │◀───────────────────│                     │
       │                    │                     │
       │ 2. Apresenta QR    │                     │
       │──────────────────────────────────────────▶│
       │                    │ 3. Usuário escaneia │
       │                    │◀────────────────────│
       │                    │                     │
       │ 4. Conecta         │                     │
       │◀───────────────────│◀────────────────────│
```

### **Gerar QR Code**

```bash
# Gerar e abrir QR code automaticamente
curl -s https://wa.ytem.com.br/instance/connect/meu-zap \
  -H "apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" | \
  jq -r '.base64' | \
  sed 's/data:image\/png;base64,//' | \
  base64 -D > /tmp/whatsapp-qrcode.png && \
  open /tmp/whatsapp-qrcode.png
```

### **Verificar Status da Conexão**

```bash
curl -s https://wa.ytem.com.br/instance/fetchInstances \
  -H "apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" | \
  jq '.[0] | {name, connectionStatus, profileName}'
```

**Retorno esperado:**
```json
{
  "name": "meu-zap",
  "connectionStatus": "open",
  "profileName": "Clareoou"
}
```

### **Configurar Webhook**

```bash
curl -X POST https://wa.ytem.com.br/webhook/set/meu-zap \
  -H "apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://stickers.ytem.com.br/webhook",
    "enabled": true,
    "events": [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "CONNECTION_UPDATE"
    ],
    "headers": {
      "apikey": "I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
    }
  }'
```

### **Se Desconectar**

**Reconectar:**
```bash
# Gerar novo QR code e escanear novamente
curl -s https://wa.ytem.com.br/instance/connect/meu-zap \
  -H "apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
```

---

## 🌐 Domínios e Subdomínios

### **Estrutura de Domínios**

```
ytem.com.br (Domínio principal)
├── wa.ytem.com.br              → Evolution API (WhatsApp)
│   └── Porta: 8080
│   └── Certificado: Let's Encrypt
│   └── Traefik: evolution_api
│
├── stickers.ytem.com.br        → Sticker Bot (Backend)
│   └── Porta: 3000
│   └── Certificado: Let's Encrypt
│   └── Traefik: sticker_backend
│
└── admin-stickers.ytem.com.br  → Admin Panel (Next.js)
    └── Porta: 3000
    └── Certificado: Let's Encrypt
    └── Traefik: sticker_admin
    └── Auth: Supabase (role=admin)
```

### **Configuração DNS**

| Subdomínio | Tipo | Destino | TTL |
|------------|------|---------|-----|
| wa | A | 69.62.100.250 | 3600 |
| stickers | A | 69.62.100.250 | 3600 |
| admin-stickers | A | 69.62.100.250 | 3600 |

### **Traefik (Reverse Proxy)**

**Labels no Docker Stack:**

```yaml
services:
  backend:
    deploy:
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=traefik-public"
        - "traefik.http.routers.sticker-api.rule=Host(`stickers.ytem.com.br`)"
        - "traefik.http.routers.sticker-api.entrypoints=websecure"
        - "traefik.http.routers.sticker-api.tls=true"
        - "traefik.http.routers.sticker-api.tls.certresolver=letsencrypt"
        - "traefik.http.services.sticker-api.loadbalancer.server.port=3000"
```

**Como funciona:**
1. Traefik escuta em `443` (HTTPS)
2. Recebe request para `stickers.ytem.com.br`
3. Verifica labels e roteia para `sticker_backend:3000`
4. Gerencia certificado SSL automaticamente

### **Certificados SSL**

- **Gerados automaticamente** por Let's Encrypt
- **Renovação automática** pelo Traefik
- Válidos por 90 dias
- Armazenados em volume do Traefik

**Verificar certificado:**
```bash
echo | openssl s_client -connect stickers.ytem.com.br:443 2>/dev/null | \
  openssl x509 -noout -dates
```

---

## 🔧 Troubleshooting

### **Backend/Worker não iniciando**

```bash
# Ver logs
vps-ssh "docker service logs sticker_backend --tail 100"
vps-ssh "docker service logs sticker_worker --tail 100"

# Verificar replicas
vps-ssh "docker service ps sticker_backend"
vps-ssh "docker service ps sticker_worker"

# Reiniciar serviços
vps-ssh "docker service update --force sticker_backend"
vps-ssh "docker service update --force sticker_worker"
```

### **Webhook não recebendo mensagens**

**1. Verificar se webhook está configurado:**
```bash
curl https://wa.ytem.com.br/webhook/find/meu-zap \
  -H "apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" | jq '.'
```

**2. Verificar se Evolution está conectado:**
```bash
curl https://wa.ytem.com.br/instance/connectionState/meu-zap \
  -H "apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" | jq '.'
```

**3. Testar endpoint webhook diretamente:**
```bash
curl https://stickers.ytem.com.br/webhook
# Deve retornar: {"status":"online",...}
```

### **Stickers não sendo processados**

**1. Verificar Redis:**
```bash
curl https://stickers.ytem.com.br/health | jq '.services.redis'
# Deve retornar: "connected"
```

**2. Ver fila do BullMQ:**
```bash
vps-ssh "docker service logs sticker_worker --tail 50 | grep 'Processing sticker job'"
```

**3. Verificar Supabase:**
```bash
curl https://stickers.ytem.com.br/health | jq '.services.supabase'
# Deve retornar: "connected"
```

### **Imagem não atualiza após deploy**

**Problema:** Docker usa cache

**Solução:**
```bash
# Force pull da nova imagem
vps-ssh "docker service update --force --with-registry-auth \
  --image ghcr.io/reisspaulo/sticker-bot-backend:latest sticker_backend"
```

---

## 📊 Logs do Supabase

O Supabase tem logs separados por serviço. Acesse pelo dashboard:

**URL Base:** https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje/logs

### **Tipos de Logs**

| Tipo | URL | O que mostra |
|------|-----|--------------|
| **API Logs** | [/logs/edge-logs](https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje/logs/edge-logs) | Requisições HTTP à API REST |
| **Postgres Logs** | [/logs/postgres-logs](https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje/logs/postgres-logs) | Queries SQL, erros de banco |
| **Auth Logs** | [/logs/auth-logs](https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje/logs/auth-logs) | Login, signup, tokens |
| **Storage Logs** | [/logs/storage-logs](https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje/logs/storage-logs) | Upload/download de arquivos |

### **Queries Úteis no Log Explorer**

```sql
-- Erros nas últimas 24h
select * from edge_logs
where status_code >= 400
order by timestamp desc
limit 100

-- Requests lentos (>1s)
select * from edge_logs
where request_time > 1000
order by timestamp desc

-- Erros de insert em stickers
select * from postgres_logs
where error_message ilike '%stickers%'
order by timestamp desc
```

### **Acessar via CLI (opcional)**

```bash
# Instalar Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Ver logs do projeto
supabase logs --project-ref ludlztjdvwsrwlsczoje
```

### **Dicas de Debug**

1. **Sticker não salva?** → Verificar Postgres Logs por erros de INSERT
2. **Imagem não carrega?** → Verificar Storage Logs por erros de upload
3. **API lenta?** → Verificar Edge Logs por requests com alto `request_time`
4. **Erro 500?** → Filtrar Edge Logs por `status_code = 500`

---

## 📚 Referências Rápidas

### **Comandos Úteis**

```bash
# Ver status de todos os serviços
vps-ssh "docker service ls | grep sticker"

# Ver logs em tempo real
vps-ssh "docker service logs -f sticker_backend"

# Escalar worker (aumentar concorrência)
vps-ssh "docker service scale sticker_worker=2"

# Ver recursos usados
vps-ssh "docker stats --no-stream"

# Limpar imagens antigas
vps-ssh "docker system prune -af"
```

### **URLs Importantes**

| Recurso | URL |
|---------|-----|
| Backend Health | https://stickers.ytem.com.br/health |
| Backend Webhook | https://stickers.ytem.com.br/webhook |
| Admin Panel | https://admin-stickers.ytem.com.br |
| Evolution API | https://wa.ytem.com.br |
| Supabase Dashboard | https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje |
| Doppler (Secrets) | https://dashboard.doppler.com/ |
| GitHub Actions | https://github.com/reisspaulo/sticker/actions |
| GitHub Container Registry | https://github.com/reisspaulo/sticker-bot/pkgs/container/sticker-bot-backend |

### **Credenciais**

**Onde estão:**
- Doppler: Projeto `sticker`, Config `prd`
- Acessar via: `doppler secrets --project sticker --config prd`

**Variáveis importantes:**
```bash
SUPABASE_URL
SUPABASE_SERVICE_KEY
EVOLUTION_API_KEY
EVOLUTION_INSTANCE
REDIS_URL
VPS_HOST
VPS_USER
VPS_PASSWORD
```

---

## 📝 Checklist de Deploy

```markdown
- [ ] Código alterado e testado localmente
- [ ] `npm run build` executado com sucesso
- [ ] Imagem Docker construída para linux/amd64
- [ ] Imagem enviada para ghcr.io
- [ ] Serviços atualizados na VPS
- [ ] Health check passou
- [ ] Logs verificados (sem erros)
- [ ] Teste manual funcionando (enviar imagem)
- [ ] Webhook recebendo eventos
- [ ] Worker processando filas
```

---

## 🆘 Contatos de Emergência

**Se algo der muito errado:**

1. **Rollback rápido:**
```bash
# Ver versões anteriores
vps-ssh "docker service inspect sticker_backend --format='{{.PreviousSpec.TaskTemplate.ContainerSpec.Image}}'"

# Voltar para versão anterior (se souber o SHA)
vps-ssh "docker service update --image ghcr.io/reisspaulo/sticker-bot-backend@sha256:XXXXX sticker_backend"
```

2. **Desligar tudo:**
```bash
vps-ssh "docker stack rm sticker"
```

3. **Religar:**
```bash
./deploy/deploy-sticker.sh prd
```

---

**Última atualização:** 08/01/2026
**Mantido por:** Paulo Henrique
**Versão:** 1.1
