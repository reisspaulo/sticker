# 🚀 Deployment Guide - Sticker Bot

Guia completo de deploy do Sticker Bot para VPS usando Docker Swarm + Doppler.

---

## 📋 Visão Geral

**Infraestrutura:**
- VPS: 69.62.100.250 (Contabo - srv1007351)
- Orquestrador: Docker Swarm
- Reverse Proxy: Traefik (SSL automático via Let's Encrypt)
- Secrets: Doppler
- Registry: GitHub Container Registry (ghcr.io)
- Domains:
  - Sticker Bot: stickers.ytem.com.br
  - Evolution API: wa.ytem.com.br
  - Evolution Manager: wa-manager.ytem.com.br

**Serviços:**
- `sticker_backend`: API Fastify (webhook + health check)
- `sticker_worker`: BullMQ worker (processamento assíncrono)
- `evolution_evolution_api`: Evolution API v2.3.7 (WhatsApp Gateway)
- `evolution_postgres`: PostgreSQL 15 (Evolution database)
- `evolution_manager`: Evolution Manager UI

**Redes:**
- `traefik-public`: Acesso ao Traefik (todos os serviços públicos)
- ⚠️ **Nota:** Evolution API foi deployada na mesma VPS usando apenas `traefik-public` network (Redis não usado - CACHE_LOCAL_ENABLED)

---

## 🏗️ Arquitetura

```
Internet
    ↓
[Cloudflare Proxy] (DDoS Protection)
    ↓
[Traefik] (SSL/Routing - VPS 69.62.100.250)
    ├→ wa.ytem.com.br → [Evolution API v2.3.7] → [PostgreSQL 15]
    ├→ wa-manager.ytem.com.br → [Evolution Manager]
    └→ stickers.ytem.com.br → [sticker_backend] → [Evolution API]
                                                → [Supabase]
         ↓
    [sticker_worker] → [Evolution API] (webhook queue)
                    → [Supabase] (sticker storage)
```

---

## 🔧 Pré-requisitos

### 1. DNS Cloudflare Configurado ⚠️ IMPORTANTE

**Antes de fazer deploy**, configure o DNS no Cloudflare:

```bash
# 1. Acessar Cloudflare Dashboard
# https://dash.cloudflare.com

# 2. Adicionar registro A:
# Type: A
# Name: stickers
# IPv4: 157.230.50.63
# Proxy: ☁️ Proxied (ON)
# TTL: Auto

# 3. Configurar SSL/TLS:
# Modo: Full (strict)
```

Ver guia completo: `deploy/CLOUDFLARE-DNS-SETUP.md`

### 2. Acesso à VPS

```bash
# Usar vps-ssh (Doppler + sshpass)
vps-ssh "docker node ls"

# Ou SSH direto (se tiver chave)
ssh root@69.62.100.250

# Verificar Docker Swarm
docker node ls
```

### 3. Doppler Configurado

```bash
# Login no Doppler
doppler login

# Verificar projeto e config
doppler secrets --project sticker --config prd
```

### 4. GitHub Container Registry

```bash
# Login no ghcr.io (necessário para push de imagens)
echo $GITHUB_TOKEN | docker login ghcr.io -u reisspaulo --password-stdin
```

### 5. Evolution API Deployada ✅

A Evolution API já está rodando na VPS:

```bash
# Testar Evolution API
curl https://wa.ytem.com.br

# Ver instâncias WhatsApp
curl https://wa.ytem.com.br/instance/fetchInstances \
  -H "apikey: ${EVOLUTION_API_KEY}"

# Conectar instância (gera QR Code)
open https://wa.ytem.com.br/instance/connect/meu-zap
```

**Instância ativa:** `meu-zap` (b2b76790-7a59-4eae-81dc-7dfabd0784b8)

### 6. Build da Imagem

```bash
# Build local
cd /Users/paulohenrique/sticker
npm run build

# Build imagem Docker
docker build -t ghcr.io/reisspaulo/sticker-bot-backend:latest .
docker build -t ghcr.io/reisspaulo/sticker-bot-worker:latest .

# Push para registry
docker push ghcr.io/reisspaulo/sticker-bot-backend:latest
docker push ghcr.io/reisspaulo/sticker-bot-worker:latest
```

---

## 🚀 Deploy

### Deploy Completo (Primeira vez)

```bash
# 1. Build e push imagens
npm run build
docker build -t ghcr.io/reisspaulo/sticker-bot-backend:latest -t ghcr.io/reisspaulo/sticker-bot-worker:latest .
docker push ghcr.io/reisspaulo/sticker-bot-backend:latest
docker push ghcr.io/reisspaulo/sticker-bot-worker:latest

# 2. Deploy stack com Doppler secrets
./deploy/deploy-sticker.sh prd
```

### Deploy Atualização

```bash
# 1. Fazer mudanças no código
# 2. Build e push nova imagem
npm run build
docker build -t ghcr.io/reisspaulo/sticker-bot-backend:latest .
docker push ghcr.io/reisspaulo/sticker-bot-backend:latest

# 3. Atualizar serviço (zero downtime)
ssh root@157.230.50.63 'docker service update --image ghcr.io/reisspaulo/sticker-bot-backend:latest sticker_backend'
```

### Deploy Apenas Worker

```bash
# Build e push
docker build -t ghcr.io/reisspaulo/sticker-bot-worker:latest .
docker push ghcr.io/reisspaulo/sticker-bot-worker:latest

# Update
ssh root@157.230.50.63 'docker service update --image ghcr.io/reisspaulo/sticker-bot-worker:latest sticker_worker'
```

---

## 🔍 Monitoramento

### Ver Status dos Serviços

```bash
# Listar todos os serviços do stack
ssh root@157.230.50.63 'docker service ls | grep sticker'

# Ver detalhes de um serviço
ssh root@157.230.50.63 'docker service ps sticker_backend'
ssh root@157.230.50.63 'docker service ps sticker_worker'
```

### Ver Logs

```bash
# Backend (últimas 100 linhas)
vps-ssh "docker service logs sticker_backend --tail 100"

# Worker (seguir em tempo real)
vps-ssh "docker service logs sticker_worker -f"

# Evolution API logs
vps-ssh "docker service logs evolution_evolution_api --tail 100"

# Filtrar por nível de log
vps-ssh "docker service logs sticker_backend --tail 100" | grep ERROR
```

### Health Check

```bash
# Via curl
curl https://stickers.ytem.com.br/health

# Via navegador
open https://stickers.ytem.com.br/health

# Ping simples
curl https://stickers.ytem.com.br/ping
```

---

## 🐞 Troubleshooting

### Serviço não inicia

```bash
# Ver logs detalhados
ssh root@157.230.50.63 'docker service logs sticker_backend --tail 200'

# Verificar se imagem existe
ssh root@157.230.50.63 'docker image ls | grep sticker'

# Verificar réplicas
ssh root@157.230.50.63 'docker service ls | grep sticker'
# Se mostrar 0/1, o serviço falhou ao iniciar
```

### Erro de conexão com Evolution API

```bash
# Verificar se Evolution API está rodando
vps-ssh "docker service ls | grep evolution"

# Testar conexão interna
vps-ssh "curl -I http://evolution_api:8080"

# Ver logs da Evolution API
vps-ssh "docker service logs evolution_evolution_api --tail 50"
```

**Nota:** Evolution API v2.3.7 usa `CACHE_LOCAL_ENABLED=true` (não Redis) para evitar loops de conexão.

### Erro de conexão com Supabase

```bash
# Verificar secrets no Doppler
doppler secrets get SUPABASE_URL SUPABASE_SERVICE_KEY --plain --config prd

# Verificar se está correto no serviço
ssh root@157.230.50.63 'docker service inspect sticker_backend --format "{{.Spec.TaskTemplate.ContainerSpec.Env}}"' | grep SUPABASE
```

### SSL não funciona (https://)

```bash
# Verificar se Traefik está rodando
vps-ssh "docker service ls | grep traefik"

# Verificar logs do Traefik
vps-ssh "docker service logs traefik_traefik --tail 50" | grep -E "stickers|wa.ytem"

# Verificar DNS (deve retornar IPs do Cloudflare, não VPS diretamente)
nslookup stickers.ytem.com.br
nslookup wa.ytem.com.br

# Testar HTTPS
curl -I https://stickers.ytem.com.br/health
curl -I https://wa.ytem.com.br
```

### Worker não processa jobs

```bash
# Ver logs do worker
ssh root@157.230.50.63 'docker service logs sticker_worker -f'

# Verificar se Redis está acessível
ssh root@157.230.50.63 'docker exec $(docker ps -q -f name=sticker_worker) sh -c "nc -zv redis 6379"'

# Listar jobs no Redis (usar redis-cli)
ssh root@157.230.50.63 'docker exec -it $(docker ps -q -f name=redis) redis-cli KEYS "*process-sticker*"'
```

---

## 🔄 Rollback

### Rollback para versão anterior

```bash
# Voltar para versão anterior (Docker Swarm mantém histórico)
ssh root@157.230.50.63 'docker service rollback sticker_backend'

# Ou especificar uma imagem antiga
ssh root@157.230.50.63 'docker service update --image ghcr.io/reisspaulo/sticker-bot-backend:v1.0.0 sticker_backend'
```

### Remover Stack Completamente

```bash
# Remove todos os serviços do stack
ssh root@157.230.50.63 'docker stack rm sticker'

# Aguardar limpeza (30s)
sleep 30

# Redeploy
./deploy/deploy-sticker.sh prd
```

---

## 📊 Métricas e Observabilidade

### Ver uso de recursos

```bash
# CPU e Memória por serviço
ssh root@157.230.50.63 'docker stats --no-stream' | grep sticker

# Detalhes de um container específico
ssh root@157.230.50.63 'docker stats $(docker ps -q -f name=sticker_backend)'
```

### Verificar filas (BullMQ)

```bash
# Conectar no Redis e ver filas
ssh root@157.230.50.63 'docker exec -it $(docker ps -q -f name=redis) redis-cli'

# No redis-cli:
KEYS bull:*                    # Listar todas as filas
LLEN bull:process-sticker     # Ver tamanho da fila
HGETALL bull:process-sticker:1 # Ver detalhes de um job
```

---

## 🔐 Segurança

### Rotação de Secrets

```bash
# 1. Atualizar no Doppler
doppler secrets set EVOLUTION_API_KEY="nova_key" --project sticker --config prd

# 2. Redeploy (pega novos secrets)
./deploy/deploy-sticker.sh prd
```

### Verificar secrets expostos

```bash
# Garantir que stack file NÃO tem secrets hardcoded
cat deploy/stack-sticker.yml | grep -E "(eyJ|sk_|AAAA|service_role)"
# Não deve retornar nada

# Secrets devem estar como ${VAR}
cat deploy/stack-sticker.yml | grep SUPABASE
# Deve mostrar: ${SUPABASE_URL}
```

---

## ☁️ Configuração DNS (Cloudflare)

### Passo a Passo Completo

Ver guia detalhado: `deploy/CLOUDFLARE-DNS-SETUP.md`

**Resumo:**
1. Criar registro A no Cloudflare: `stickers.ytem.com.br` → `157.230.50.63`
2. Ativar Proxy (☁️ laranja)
3. SSL/TLS Mode: **Full (strict)**
4. Aguardar propagação DNS (1-5 minutos)
5. Traefik obtém certificado SSL automaticamente via DNS Challenge

### Verificar DNS

```bash
# Deve resolver para IP do Cloudflare (proxy ativo)
dig stickers.ytem.com.br

# Testar HTTPS (após deploy)
curl https://stickers.ytem.com.br/health
```

---

## 📦 CI/CD (Futuro - GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build and push Docker image
        run: |
          docker build -t ghcr.io/reisspaulo/sticker-bot-backend:${{ github.sha }} .
          docker push ghcr.io/reisspaulo/sticker-bot-backend:${{ github.sha }}

      - name: Deploy to VPS
        run: |
          doppler run -- ./deploy/deploy-sticker.sh prd
```

---

## 📞 Checklist de Deploy

**Evolution API (Concluído ✅)**
- [x] DNS Cloudflare configurado (wa.ytem.com.br → 69.62.100.250)
- [x] Proxy Cloudflare ativado
- [x] Evolution API v2.3.7 deployada
- [x] PostgreSQL 15 rodando
- [x] Instância WhatsApp criada (meu-zap)
- [x] QR Code pronto para scan
- [x] HTTPS funcionando (https://wa.ytem.com.br)

**Sticker Bot (Pendente)**
- [ ] DNS Cloudflare configurado (stickers.ytem.com.br → 69.62.100.250)
- [ ] Código buildado (`npm run build`)
- [ ] Testes passando (`npm test`)
- [ ] Doppler configurado com secrets PRD
- [ ] Imagem Docker buildada e pushed
- [ ] Deploy executado (`./deploy/deploy-sticker.sh prd`)
- [ ] Health check passou (https://stickers.ytem.com.br/health)
- [ ] Webhook configurado na Evolution API

---

**Status:** 🟡 Evolution API deployada ✅ | Sticker Bot pendente
**Última atualização:** 2025-12-27

---

## 🔗 URLs em Produção

- **Evolution API:** https://wa.ytem.com.br
- **Evolution Manager:** https://wa-manager.ytem.com.br
- **Sticker Bot:** https://stickers.ytem.com.br (pendente)
- **Traefik Dashboard:** http://69.62.100.250:8080/dashboard/
