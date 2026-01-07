# 🚀 Processo de Deploy - Sticker Bot

**Última atualização:** 2026-01-05
**Stack:** sticker
**VPS:** srv1007351 (69.62.100.250)
**Arquitetura:** x86_64 (Ubuntu 22.04)

---

## 📋 Visão Geral

O Sticker Bot usa **CI/CD automatizado** via GitHub Actions com zero-downtime deployment:

### 🎯 Método Recomendado: CI/CD (GitHub Actions)

✅ **Deploy automático** a cada push na branch `main`
✅ **Zero downtime** com 2 réplicas e rolling updates
✅ **Rollback automático** se algo falhar

**📖 Documentação completa:** [CI-CD-WORKFLOW.md](./CI-CD-WORKFLOW.md)

**Quick start:**
```bash
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
# Pronto! Deploy automático em ~2-3 minutos
```

### 📦 Método Alternativo: Deploy Manual (Backup/Emergência)

Usar apenas quando:
- GitHub Actions estiver indisponível
- Precisar fazer deploy sem commit
- Deploy de emergência

**Processo resumido abaixo ↓**

---

## 🏗️ Arquitetura de Deploy

```
┌─────────────────────────────────────────────────┐
│              CLOUDFLARE DNS                     │
│         stickers.ytem.com.br                    │
└──────────────────┬──────────────────────────────┘
                   │
                   │ HTTPS (443)
                   ▼
┌──────────────────────────────────────────────────┐
│              TRAEFIK PROXY                       │
│       (Reverse Proxy + SSL Manager)              │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │    stickers.ytem.com.br                  │  │
│  │    - /webhook (Evolution API)            │  │
│  │    - /stripe/webhook (Stripe)            │  │
│  │    - /health                             │  │
│  └───────────────────┬──────────────────────┘  │
└────────────────────┬─┴──────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│  STICKER BOT    │      │ STICKER WORKER  │
│   (Backend)     │      │   (BullMQ)      │
│   1 réplica     │      │   1 réplica     │
└────────┬────────┘      └────────┬────────┘
         │                        │
         └────────────┬───────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
┌──────────────┐ ┌────────┐ ┌──────────────┐
│   SUPABASE   │ │ REDIS  │ │ EVOLUTION API│
│ (PostgreSQL) │ │(Cache) │ │  (WhatsApp)  │
└──────────────┘ └────────┘ └──────────────┘
```

---

## 🔑 Secrets Management (Doppler)

### Configuração

```bash
# Login no Doppler (primeira vez)
doppler login

# Ver projeto e configs
doppler projects
doppler configs --project sticker

# Ver secrets atuais
doppler secrets --project sticker --config prd
```

### Secrets Necessários

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `SUPABASE_URL` | URL do Supabase | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service key do Supabase | `eyJhbGci...` |
| `EVOLUTION_API_KEY` | Chave da Evolution API | `I1hKpeX0...` |
| `EVOLUTION_INSTANCE` | Nome da instância | `meu-zap` |
| `API_KEY` | Chave da API do bot | `c77c117de...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_...` |
| `STRIPE_PREMIUM_PAYMENT_LINK` | Link de pagamento Premium | `https://buy.stripe.com/...` |
| `STRIPE_ULTRA_PAYMENT_LINK` | Link de pagamento Ultra | `https://buy.stripe.com/...` |
| `STRIPE_STICKER_PREMIUM_PRODUCT_ID` | Product ID Premium | `prod_...` |
| `STRIPE_STICKER_ULTRA_PRODUCT_ID` | Product ID Ultra | `prod_...` |
| `LOG_LEVEL` | Nível de log | `info` / `debug` |

### Adicionar/Atualizar Secrets

```bash
# Adicionar individualmente
doppler secrets set STRIPE_SECRET_KEY="sk_live_..." --project sticker --config prd

# Adicionar múltiplos via script (veja scripts/add-doppler-secrets.sh)
./scripts/add-doppler-secrets.sh
```

---

## 🐳 Build e Publicação de Imagens

### ⚠️ Limitações Atuais

**GHCR Push não funciona** porque o `GITHUB_TOKEN` atual não tem a scope `read:packages`.

**Solução atual**: Build local + transferência manual via `docker save/load`

**Solução futura**: Configurar GitHub Actions para build/push automático (CI/CD)

---

### Processo Manual (RECOMENDADO)

#### 1. Parar Containers Locais

**IMPORTANTE**: Parar todos os containers locais para evitar conflitos de resposta duplicada:

```bash
# Parar e remover containers locais
docker-compose down && docker-compose -f docker-compose.bot.yml down

# Verificar que nada está rodando
docker ps -a | grep -E "sticker|evolution"
```

#### 2. Build Local

```bash
# Build única imagem (backend + worker usam a mesma)
docker build \
  --no-cache \
  --platform linux/amd64 \
  -t ghcr.io/reisspaulo/stickerbot:latest \
  -f Dockerfile \
  .
```

**Por que `--no-cache`?**
- Garante que o código TypeScript é recompilado do zero
- Evita usar código antigo de builds anteriores

**Por que `--platform linux/amd64`?**
- VPS usa arquitetura x86_64 (AMD64)
- Mac usa ARM64 (Apple Silicon), precisa cross-compile

#### 3. Tag para Backend

```bash
# Backend e Worker usam mesma imagem base
docker tag ghcr.io/reisspaulo/stickerbot:latest ghcr.io/reisspaulo/sticker-bot-backend:latest
```

#### 4. Transferir para VPS

```bash
# Exportar imagem local e carregar na VPS (via pipe)
# Backend
docker save ghcr.io/reisspaulo/sticker-bot-backend:latest | gzip | vps-ssh "gunzip | docker load"

# Worker
docker save ghcr.io/reisspaulo/stickerbot:latest | gzip | vps-ssh "gunzip | docker load"
```

**Tamanho**: ~465MB compactado, ~5 minutos de transferência

#### 5. Atualizar Serviços na VPS

```bash
# Atualizar backend
vps-ssh "docker service update --force --image ghcr.io/reisspaulo/sticker-bot-backend:latest sticker_backend"

# Atualizar worker
vps-ssh "docker service update --force --image ghcr.io/reisspaulo/stickerbot:latest sticker_worker"
```

#### 6. Verificar Deploy

```bash
# Ver logs do backend
vps-ssh "docker service logs --tail 20 sticker_backend"

# Ver logs do worker
vps-ssh "docker service logs --tail 20 sticker_worker"

# Testar health check
curl https://stickers.ytem.com.br/health
```

---

### ~~Processo via GHCR (NÃO FUNCIONA ATUALMENTE)~~

```bash
# ⚠️ NÃO USE - Token sem permissão read:packages

# Login no GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u reisspaulo --password-stdin
# ❌ Erro: Error saving credentials

# Push das imagens
docker push ghcr.io/reisspaulo/sticker-bot-backend:latest
# ❌ Erro: denied: permission_denied
```

**Para habilitar GHCR**:
1. Criar novo GitHub Personal Access Token com scope `write:packages` e `read:packages`
2. Ou configurar GitHub Actions para build/push automático

---

## 📦 Deploy na VPS

### Via Script Automatizado (RECOMENDADO)

```bash
# Deploy completo (prd)
./deploy/deploy-sticker.sh prd

# Deploy em dev
./deploy/deploy-sticker.sh dev
```

O script faz:
1. ✅ Valida login no Doppler
2. ✅ Carrega todos os secrets do Doppler
3. ✅ Gera stack file com secrets injetados
4. ✅ Copia para VPS
5. ✅ Faz deploy via Docker Swarm
6. ✅ Aguarda convergência (60s)
7. ✅ Verifica health check
8. ✅ Limpa arquivos temporários

### Deploy Manual

```bash
# 1. Gerar stack com secrets do Doppler
doppler run --project sticker --config prd \
  -- envsubst < deploy/stack-sticker.yml > /tmp/stack-sticker-full.yml

# 2. Copiar para VPS
vps-ssh "cat > /tmp/stack-sticker.yml" < /tmp/stack-sticker-full.yml

# 3. Deploy
vps-ssh "docker stack deploy -c /tmp/stack-sticker.yml sticker"

# 4. Verificar
vps-ssh "docker service ls | grep sticker"
vps-ssh "docker service logs sticker_backend --tail 50"
```

---

## 🔍 Verificações e Monitoramento

### Status dos Serviços

```bash
# Ver todos os serviços do stack
vps-ssh "docker service ls | grep sticker"

# Ver réplicas e status
vps-ssh "docker stack ps sticker"

# Ver configuração do serviço
vps-ssh "docker service inspect sticker_backend --pretty"
```

### Logs

```bash
# Logs em tempo real
vps-ssh "docker service logs -f sticker_backend"
vps-ssh "docker service logs -f sticker_worker"

# Últimas 100 linhas
vps-ssh "docker service logs --tail 100 sticker_backend"

# Filtrar erros
vps-ssh "docker service logs sticker_backend | grep -i error"
```

### Health Checks

```bash
# API Health
curl https://stickers.ytem.com.br/health

# Stats
curl https://stickers.ytem.com.br/stats

# Webhook (deve retornar status: online)
curl https://stickers.ytem.com.br/webhook
```

---

## 🔄 Atualizações

### Atualizar Imagem (sem rebuild)

```bash
# Força pull da imagem :latest e restart
vps-ssh "docker service update --force --image ghcr.io/reisspaulo/sticker-bot-backend:latest sticker_backend"
vps-ssh "docker service update --force --image ghcr.io/reisspaulo/sticker-bot-worker:latest sticker_worker"
```

### Atualizar Variável de Ambiente

```bash
# Atualizar uma env var
vps-ssh "docker service update --env-add LOG_LEVEL=debug sticker_backend"

# Remover env var
vps-ssh "docker service update --env-rm OLD_VAR sticker_backend"
```

### Escalar Serviços

```bash
# Aumentar réplicas do backend
vps-ssh "docker service scale sticker_backend=2"

# Desabilitar worker temporariamente
vps-ssh "docker service scale sticker_worker=0"
```

---

## 🆘 Troubleshooting

### ⚠️ Mensagens duplicadas / Código antigo executando

**Sintomas:**
- Bot responde 2 vezes à mesma mensagem
- Menu de planos mostra "marca d'água" mesmo após deploy
- Mudanças no código não aparecem

**Causa:**
Containers locais rodando com código antigo + VPS rodando código novo

**Solução:**
```bash
# 1. Parar todos os containers locais
docker-compose down && docker-compose -f docker-compose.bot.yml down

# 2. Verificar que nada está rodando
docker ps -a | grep -E "sticker|evolution"
# ✅ Deve retornar vazio

# 3. Verificar portas
lsof -i :3000  # Backend local
lsof -i :8080  # Evolution local
# ✅ Deve estar vazio ou apenas Docker Desktop

# 4. Testar novamente
# Enviar mensagem pro bot - deve vir apenas UMA resposta
```

**Prevenção:**
- Sempre parar containers locais antes de testar deploy
- Adicionar ao checklist de deploy

---

### Serviço não inicia

```bash
# Ver tarefas falhadas
vps-ssh "docker service ps sticker_backend --no-trunc"

# Ver logs de erro
vps-ssh "docker service logs sticker_backend --tail 200 | grep -A 5 -B 5 error"

# Ver eventos do serviço
vps-ssh "docker service ps sticker_backend --format 'table {{.Name}}\t{{.CurrentState}}\t{{.Error}}'"
```

### Rollback

```bash
# Ver histórico de updates
vps-ssh "docker service ps sticker_backend"

# Voltar para versão anterior
vps-ssh "docker service update --rollback sticker_backend"
```

### Restart Completo

```bash
# Método 1: Force update
vps-ssh "docker service update --force sticker_backend"

# Método 2: Redeploy stack
vps-ssh "docker stack deploy -c /root/stack-sticker.yml sticker"

# Método 3: Remove e recria
vps-ssh "docker stack rm sticker"
sleep 30
./deploy/deploy-sticker.sh prd
```

### Secrets não estão sendo carregados

```bash
# Verificar secrets no Doppler
doppler secrets --project sticker --config prd

# Verificar env vars dentro do container
vps-ssh "docker exec \$(docker ps -q -f name=sticker_backend) env | grep STRIPE"

# Redeploy com novos secrets
./deploy/deploy-sticker.sh prd
```

---

## 🔐 Configuração do Stripe Webhook

### 1. No Dashboard do Stripe

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em "+ Add endpoint"
3. URL: `https://stickers.ytem.com.br/stripe/webhook`
4. Eventos para escutar:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copie o **Webhook signing secret** (começa com `whsec_...`)

### 2. Adicionar Secret no Doppler

```bash
doppler secrets set STRIPE_WEBHOOK_SECRET="whsec_..." --project sticker --config prd
```

### 3. Redeploy

```bash
./deploy/deploy-sticker.sh prd
```

### 4. Testar Webhook

```bash
# Via Stripe CLI
stripe listen --forward-to https://stickers.ytem.com.br/stripe/webhook

# Trigger evento de teste
stripe trigger checkout.session.completed

# Ver logs
vps-ssh "docker service logs sticker_backend | grep 'Stripe webhook'"
```

---

## 📁 Estrutura de Arquivos

```
sticker/
├── deploy/
│   ├── deploy-sticker.sh           ← Script principal de deploy
│   ├── DEPLOYMENT-PROCESS.md       ← Este documento
│   └── stack-sticker.yml           ← Template do stack (sem secrets)
├── scripts/
│   ├── build-and-push.sh           ← Build + push imagens
│   └── add-doppler-secrets.sh      ← Adicionar secrets no Doppler
├── src/
│   ├── server.ts                   ← Backend (Fastify)
│   ├── worker.ts                   ← Worker (BullMQ)
│   └── routes/
│       ├── webhook.ts              ← Webhook Evolution API
│       └── stripeWebhook.ts        ← Webhook Stripe
├── Dockerfile                      ← Imagem única (backend + worker)
└── docker-compose.yml              ← Para desenvolvimento local
```

---

## 🔗 Links Importantes

| Recurso | URL |
|---------|-----|
| **API (Produção)** | https://stickers.ytem.com.br |
| **Health Check** | https://stickers.ytem.com.br/health |
| **Webhook Evolution** | https://stickers.ytem.com.br/webhook |
| **Webhook Stripe** | https://stickers.ytem.com.br/stripe/webhook |
| **Stats** | https://stickers.ytem.com.br/stats |
| **Container Registry** | https://github.com/reisspaulo?tab=packages |
| **Doppler Project** | https://dashboard.doppler.com/workplace/... |
| **Stripe Dashboard** | https://dashboard.stripe.com |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje |

---

## 📊 Checklist de Deploy

### Antes do Deploy

- [ ] Código testado localmente
- [ ] **Parar containers locais** (`docker-compose down`)
- [ ] Verificar que nada está rodando localmente (`docker ps`)
- [ ] Todos os secrets estão no Doppler
- [ ] Stripe webhook configurado (se necessário)

### Durante o Deploy

- [ ] **Build com `--no-cache --platform linux/amd64`**
- [ ] Tag imagem para backend (`docker tag ...`)
- [ ] **Transferir via `docker save/load`** (~5 min)
- [ ] Atualizar serviços (backend + worker)
- [ ] Aguardar convergência (~30s)
- [ ] Health check passou (`curl /health`)
- [ ] Logs sem erros críticos

### Após o Deploy

- [ ] **Confirmar que containers locais continuam parados**
- [ ] Testar webhook do WhatsApp (enviar imagem)
- [ ] Testar menu de planos ("planos") - deve vir UMA vez
- [ ] Verificar que NÃO tem marca d'água nas figurinhas
- [ ] Testar fluxo de assinatura (se mudou)
- [ ] Verificar logs por 5 minutos
- [ ] Verificar métricas de erro no Supabase

---

## 🚨 Em Caso de Problema

1. **Verificar logs**: `vps-ssh "docker service logs sticker_backend --tail 200"`
2. **Health check**: `curl https://stickers.ytem.com.br/health`
3. **Rollback**: `vps-ssh "docker service update --rollback sticker_backend"`
4. **Support**: Verificar documentação no `/root/brazyl-docs/`

---

---

## ✅ Status da Implementação

### CI/CD (GitHub Actions)

✅ **IMPLEMENTADO** (05/01/2026)

- [x] GitHub Actions configurado
- [x] Deploy automático a cada push
- [x] Zero-downtime deployment testado e validado
- [x] Rollback automático funcionando
- [x] 2 réplicas rodando (backend + worker)

**📖 Ver documentação completa:** [CI-CD-WORKFLOW.md](./CI-CD-WORKFLOW.md)

---

## 🔮 Próximos Passos

Melhorias possíveis para o futuro:

- [ ] Adicionar testes automáticos no workflow (npm test)
- [ ] Scan de vulnerabilidades (Trivy/Snyk)
- [ ] Implementar monitoramento com Prometheus/Grafana
- [ ] Setup de backups automáticos do Redis
- [ ] Documentar processo de disaster recovery
- [ ] Criar scripts `start-local.sh` e `stop-local.sh`
- [ ] Notificações de deploy (Slack/Discord)
- [ ] Ambientes de staging (branch develop)
