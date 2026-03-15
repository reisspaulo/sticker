# 🚀 Guia de Mudanças Rápidas - Sticker Bot

> Documentação atualizada em: 14/03/2026
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
5. [Meta Cloud API e WhatsApp](#meta-cloud-api-e-whatsapp)
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
│                     VPS (YOUR_VPS_IP)                      │
│                     Docker Swarm Stack                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Backend    │  │    Worker    │                        │
│  │   (Fastify)  │  │   (BullMQ)   │                        │
│  └──────┬───────┘  └──────┬───────┘                        │
│         │                  │                                │
│         └──────────┬───────┘                                │
│                    │                                        │
│         ┌──────────▼────────────┐                          │
│         │  Redis (ytem-redis)   │                          │
│         └───────────────────────┘                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Admin Panel (Next.js)                    │  │
│  │         admin-stickers.ytem.com.br                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                     ┌─────┴─────┐
                     ▼           ▼
    ┌────────────────────┐  ┌──────────────────────┐
    │  Supabase (Cloud)  │  │  Meta Cloud API      │
    │  - PostgreSQL      │  │  (WhatsApp Business)  │
    │  - Storage (S3)    │  │  - Webhooks           │
    │  - Auth (usuarios) │  │  - Templates (HSM)    │
    └────────────────────┘  └──────────────────────┘
```

> **Nota:** Evolution API foi removida. O provedor de WhatsApp atual e o Meta Cloud API (WhatsApp Business Platform), configurado via Meta Business Manager.

### **Serviços Rodando**

| Serviço | URL | Porta | Função |
|---------|-----|-------|--------|
| **Backend** | https://stickers.ytem.com.br | 3000 | API REST + Webhooks (Meta Cloud API) |
| **Worker** | - | - | Processa filas BullMQ |
| **Admin Panel** | https://admin-stickers.ytem.com.br | 3000 | Gestao de stickers/emocoes |
| **Redis** | ytem-databases_redis:6379 | 6379 | Filas + Cache |
| **Supabase** | YOUR_SUPABASE_PROJECT_ID.supabase.co | 443 | Banco + Storage + Auth |

### **Imagens Docker**

```bash
ghcr.io/your-username/stickerbot:latest  # Backend + Worker (mesma imagem)
ghcr.io/your-username/sticker-admin:latest        # Admin Panel (Next.js)
```

---

## 🔄 Processo de Deploy

> **⚠️ IMPORTANTE:** Sempre use CI/CD via GitHub Actions como primeira opção!
> O deploy manual só deve ser usado em emergências.

### **Deploy via CI/CD (Opção Padrão)** ✅

Esta é a forma **recomendada** de fazer deploy. Basta fazer commit e push para a branch `main`.

#### **1. Fazer Alterações no Código**

```bash
# Edite os arquivos necessários em src/
code src/services/messageService.ts  # Exemplo
```

#### **2. Testar Localmente (Recomendado)**

```bash
npm run build  # Verifica se compila
npm test       # Se tiver testes
```

#### **3. Commit e Push**

```bash
git add .
git commit -m "fix: descrição da mudança"
git push origin main
```

#### **4. Acompanhar Deploy**

O GitHub Actions fará automaticamente:
- Build da imagem Docker
- Push para GitHub Container Registry
- Deploy na VPS

**Acompanhe em:** https://github.com/your-username/sticker/actions

#### **5. Verificar Saúde (após ~3-5 min)**

```bash
# Health check via SSH + docker exec (recomendado, evita anti-bot do servidor)
vps-ssh "docker exec \$(docker ps --filter name=sticker_backend -q | head -1) node -e \"fetch('http://localhost:3000/health').then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))\""

# Deve retornar:
{
  "status": "healthy",
  "timestamp": "2026-03-14T02:34:25.576Z",
  "services": {
    "redis": "connected",
    "supabase": "connected"
  },
  "git_sha": "abc123...",
  "deployed_at": "2026-03-14T..."
}
```

> **Nota:** Nao use `curl https://stickers.ytem.com.br/health` de fora do servidor. O Traefik/VPS tem protecao anti-bot (fingerprinting JS) que retorna HTML em vez de JSON para clientes nao-browser. O health check do CI/CD roda via SSH + `docker exec` + `node` dentro do container por esse motivo.

#### **6. Verificar Logs**

```bash
# Backend logs
vps-ssh "docker service logs sticker_backend --tail 50"

# Worker logs
vps-ssh "docker service logs sticker_worker --tail 50"
```

---

### **Deploy Manual (Apenas Emergência)** ⚠️

> **Use apenas quando:** CI/CD está fora do ar, precisa de deploy urgente sem esperar pipeline, ou está debugando problemas de build.

#### **1. Build TypeScript**

```bash
npm run build
```

#### **2. Build e Push da Imagem Docker**

```bash
# Build para arquitetura AMD64 (VPS) e push para GitHub Container Registry
docker buildx build \
  --platform linux/amd64 \
  -t ghcr.io/your-username/stickerbot:latest \
  . \
  --push
```

**Notas:**
- Usar `--platform linux/amd64` (servidor é Linux AMD64, não ARM64)
- As duas tags são a mesma imagem (backend e worker usam o mesmo código)

#### **3. Atualizar Serviços na VPS**

```bash
vps-ssh "docker service update --force --with-registry-auth \
  --image ghcr.io/your-username/stickerbot:latest sticker_backend && \
  docker service update --force --with-registry-auth \
  --image ghcr.io/your-username/stickerbot:latest sticker_worker"
```

#### **4. Verificar Saúde e Logs**

Mesmos passos 5 e 6 do deploy via CI/CD.

---

### **Deploy de Stack (Mudanças de Infraestrutura)**

Use quando precisar alterar variáveis de ambiente ou configuração do Docker Swarm:

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

**Nota:** Esse script **NÃO faz build da imagem**! Use após CI/CD ou deploy manual.

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
  -t ghcr.io/your-username/stickerbot:latest . --push
vps-ssh "docker service update --force --with-registry-auth \
  --image ghcr.io/your-username/stickerbot:latest sticker_backend"
```

**Tempo:** ~5 minutos

---

### **2. Adicionar Campo na Tabela**

#### **2.1. Criar Migration**

```bash
# Acesse Supabase Dashboard ou use a CLI
# https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID
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
# https://github.com/your-username/sticker/actions
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

## 📱 Meta Cloud API e WhatsApp

### **Como Funciona**

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Meta Cloud API  │────▶│  WhatsApp Business│────▶│   Usuarios   │
│  (graph.facebook │     │  Phone Number     │     │  (WhatsApp)  │
│   .com/v21.0)    │     │  Registration     │     │              │
└──────────────────┘     └──────────────────┘     └──────────────┘
       │                         │                       │
       │ 1. Webhook configurado  │                       │
       │    no Meta Business Mgr │                       │
       │                         │                       │
       │ 2. Mensagem recebida    │                       │
       │◀────────────────────────│◀──────────────────────│
       │                         │                       │
       │ 3. Resposta via API     │                       │
       │────────────────────────▶│──────────────────────▶│
```

> **Nota:** Meta Cloud API nao usa QR Code. O numero de WhatsApp Business e registrado via Meta Business Manager com verificacao por SMS/chamada telefonica.

### **Verificar Webhook**

O webhook e configurado no Meta Business Manager (App Dashboard > WhatsApp > Configuration):
- **Callback URL:** `https://stickers.ytem.com.br/webhook`
- **Verify Token:** configurado no Doppler (`META_WEBHOOK_VERIFY_TOKEN`)
- **Subscribed fields:** `messages`

### **Verificar Status da Conexao**

```bash
# Health check do backend (via SSH, evita anti-bot)
vps-ssh "docker exec \$(docker ps --filter name=sticker_backend -q | head -1) node -e \"fetch('http://localhost:3000/health').then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2)))\""
```

### **Janela de Conversacao (24h)**

Meta Cloud API tem uma regra de janela de 24h:
- **Dentro da janela (24h apos ultima mensagem do usuario):** pode enviar mensagens livres (texto, midia, stickers)
- **Fora da janela:** so pode enviar **templates** (mensagens pre-aprovadas pela Meta)
- O sistema usa `templateService.ts` para enviar templates quando necessario (ex: stickers pendentes)

---

## 🌐 Domínios e Subdomínios

### **Estrutura de Domínios**

```
ytem.com.br (Domínio principal)
│
├── stickers.ytem.com.br        → Sticker Bot (Backend)
│   └── Porta: 3000
│   └── Certificado: Let's Encrypt
│   └── Traefik: sticker_backend
│   └── Webhook: Meta Cloud API
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
| wa | A | YOUR_VPS_IP | 3600 |
| stickers | A | YOUR_VPS_IP | 3600 |
| admin-stickers | A | YOUR_VPS_IP | 3600 |

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

### **Webhook não recebendo mensagens (Meta Cloud API)**

**1. Verificar se webhook está configurado no Meta:**
- Acessar [Meta App Dashboard](https://developers.facebook.com/apps/) > seu app > WhatsApp > Configuration
- Confirmar que Callback URL e `https://stickers.ytem.com.br/webhook`
- Confirmar que Verify Token bate com `META_WEBHOOK_VERIFY_TOKEN` no Doppler

**2. Testar endpoint webhook diretamente:**
```bash
# Via SSH (evita anti-bot)
vps-ssh "docker exec \$(docker ps --filter name=sticker_backend -q | head -1) node -e \"fetch('http://localhost:3000/webhook').then(r=>r.text()).then(console.log)\""
```

**3. Verificar logs de webhook:**
```bash
vps-ssh "docker service logs sticker_backend --tail 100 | grep -i webhook"
```

### **Stickers não sendo processados**

**1. Verificar Redis e Supabase (via SSH):**
```bash
vps-ssh "docker exec \$(docker ps --filter name=sticker_backend -q | head -1) node -e \"fetch('http://localhost:3000/health').then(r=>r.json()).then(d=>console.log('Redis:', d.services.redis, '| Supabase:', d.services.supabase))\""
# Deve retornar: Redis: connected | Supabase: connected
```

**2. Ver fila do BullMQ:**
```bash
vps-ssh "docker service logs sticker_worker --tail 50 | grep 'Processing sticker job'"
```

### **Imagem não atualiza após deploy**

**Problema:** Docker usa cache (build ou pull)

**Solução:**
```bash
# Force pull da nova imagem
vps-ssh "docker service update --force --with-registry-auth \
  --image ghcr.io/your-username/stickerbot:latest sticker_backend"
```

> **Nota:** O CI/CD agora usa `no-cache: true` no Docker build para evitar que o GitHub Actions cache sirva camadas stale. Veja a secao de Known Issues abaixo.

---

### **Known Issues & Fixes (Marco 2026)**

#### 1. Anti-bot protection bloqueia health check externo

**Problema:** O servidor (Traefik/VPS) tem protecao anti-bot que retorna uma pagina HTML de fingerprinting JS em vez de JSON quando o request vem de um cliente nao-browser (ex: `curl` do GitHub Actions runner).

**Impacto:** CI health check via `curl https://stickers.ytem.com.br/health` recebia HTML, interpretava como falha, e acionava rollback automatico.

**Fix:** Health check agora roda via SSH + `docker exec` + `node` dentro do container, fazendo request para `http://localhost:3000/health` (bypassa Traefik/anti-bot completamente).

```yaml
# No deploy-sticker.yml - health check roda DENTRO do container
docker exec $CONTAINER_ID node -e "
  fetch('http://localhost:3000/health')
    .then(r => r.json())
    .then(d => { /* verifica status e SHA */ })
"
```

#### 2. VPS nao tem `jq` instalado

**Problema:** Quando movemos o health check para rodar via SSH na VPS, usamos `jq` para parsear JSON. Porem a VPS nao tem `jq` instalado, causando falha no health check e rollback.

**Fix:** Substituimos `jq` por `node -e` (Node.js ja existe dentro do container Docker). O health check agora usa `docker exec` + `node` para parsear JSON nativamente.

#### 3. Docker build cache serve codigo stale

**Problema:** O GitHub Actions Docker build usava `cache-from: type=gha` que servia camadas de cache com codigo-fonte antigo, mesmo com novo commit SHA nos build args. A imagem resultante tinha codigo desatualizado.

**Fix:** Desabilitado cache com `no-cache: true` no step de build do workflow. Trade-off: builds levam ~1 min a mais, mas garantem codigo correto.

```yaml
# .github/workflows/deploy-sticker.yml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    no-cache: true  # Garante que nao usa cache stale
```

---

## 📊 Logs do Supabase

O Supabase tem logs separados por serviço. Acesse pelo dashboard:

**URL Base:** https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/logs

### **Tipos de Logs**

| Tipo | URL | O que mostra |
|------|-----|--------------|
| **API Logs** | [/logs/edge-logs](https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/logs/edge-logs) | Requisições HTTP à API REST |
| **Postgres Logs** | [/logs/postgres-logs](https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/logs/postgres-logs) | Queries SQL, erros de banco |
| **Auth Logs** | [/logs/auth-logs](https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/logs/auth-logs) | Login, signup, tokens |
| **Storage Logs** | [/logs/storage-logs](https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/logs/storage-logs) | Upload/download de arquivos |

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
supabase logs --project-ref YOUR_SUPABASE_PROJECT_ID
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
| Meta App Dashboard | https://developers.facebook.com/apps/ |
| Supabase Dashboard | https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID |
| Doppler (Secrets) | https://dashboard.doppler.com/ |
| GitHub Actions | https://github.com/your-username/sticker/actions |
| GitHub Container Registry | https://github.com/your-username/sticker/pkgs/container/stickerbot |

### **Credenciais**

**Onde estão:**
- Doppler: Projeto `sticker`, Config `prd`
- Acessar via: `doppler secrets --project sticker --config prd`

**Variáveis importantes:**
```bash
SUPABASE_URL
SUPABASE_SERVICE_KEY
META_ACCESS_TOKEN
META_PHONE_NUMBER_ID
META_WEBHOOK_VERIFY_TOKEN
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
vps-ssh "docker service update --image ghcr.io/your-username/stickerbot@sha256:XXXXX sticker_backend"
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

**Última atualização:** 14/03/2026
**Mantido por:** Paulo Henrique
**Versão:** 1.2
