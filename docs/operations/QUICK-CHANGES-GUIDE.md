# 🚀 Guia de Mudanças Rápidas - Sticker Bot

> Documentação atualizada em: 28/12/2024
> Ambiente: Produção em https://stickers.ytem.com.br

---

## 📋 Índice

1. [Arquitetura em Produção](#arquitetura-em-produção)
2. [Processo de Deploy](#processo-de-deploy)
3. [Mudanças Rápidas Comuns](#mudanças-rápidas-comuns)
4. [QR Code e WhatsApp](#qr-code-e-whatsapp)
5. [Domínios e Subdomínios](#domínios-e-subdomínios)
6. [Troubleshooting](#troubleshooting)

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
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Supabase (Cloud)      │
              │  - PostgreSQL          │
              │  - Storage (S3)        │
              └────────────────────────┘
```

### **Serviços Rodando**

| Serviço | URL | Porta | Função |
|---------|-----|-------|--------|
| **Backend** | https://stickers.ytem.com.br | 3000 | API REST + Webhooks |
| **Worker** | - | - | Processa filas BullMQ |
| **Evolution API** | https://wa.ytem.com.br | 8080 | Integração WhatsApp |
| **Redis** | ytem-databases_redis:6379 | 6379 | Filas + Cache |
| **Supabase** | ludlztjdvwsrwlsczoje.supabase.co | 443 | Banco + Storage |

### **Imagens Docker**

```bash
ghcr.io/reisspaulo/sticker-bot-backend:latest  # Backend + Worker (mesma imagem)
ghcr.io/reisspaulo/sticker-bot-worker:latest   # Worker (mesma imagem)
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
├── wa.ytem.com.br          → Evolution API (WhatsApp)
│   └── Porta: 8080
│   └── Certificado: Let's Encrypt
│   └── Traefik: evolution_api
│
└── stickers.ytem.com.br    → Sticker Bot (Backend)
    └── Porta: 3000
    └── Certificado: Let's Encrypt
    └── Traefik: sticker_backend
```

### **Configuração DNS**

| Subdomínio | Tipo | Destino | TTL |
|------------|------|---------|-----|
| wa | A | 69.62.100.250 | 3600 |
| stickers | A | 69.62.100.250 | 3600 |

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
| Evolution API | https://wa.ytem.com.br |
| Supabase Dashboard | https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje |
| Doppler (Secrets) | https://dashboard.doppler.com/ |
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

**Última atualização:** 28/12/2024
**Mantido por:** Paulo Henrique
**Versão:** 1.0
