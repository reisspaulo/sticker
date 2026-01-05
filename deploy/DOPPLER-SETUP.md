# 🔐 Doppler Setup - Sticker Bot

Guia para configurar secrets no Doppler para o Sticker Bot.

---

## 📋 Pré-requisitos

- Acesso ao projeto `sticker` no Doppler
- Doppler CLI instalado e autenticado (`doppler login`)

---

## 🗂️ Estrutura do Projeto

```
Doppler Organization: YTEM
├── Project: sticker
    ├── Config: dev          (desenvolvimento local)
    ├── Config: dev_personal (desenvolvimento pessoal)
    ├── Config: stg          (staging - futuro)
    └── Config: prd          (produção VPS)
```

---

## 🔑 Secrets Necessários

### 1. Supabase (2 secrets)

```bash
# URL do projeto Supabase
SUPABASE_URL=https://ludlztjdvwsrwlsczoje.supabase.co

# Service Role Key (backend operations)
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Onde encontrar:**
- Dashboard Supabase → Project Settings → API
- URL: Project URL
- Service Key: service_role key (⚠️ NUNCA usar anon key no backend!)

### 2. Redis (Opcional - não usado atualmente)

```bash
# URL do Redis (atualmente não usado)
# REDIS_URL=redis://redis:6379
```

**Nota:**
- ⚠️ Evolution API v2.3.7 usa `CACHE_LOCAL_ENABLED=true` (cache em memória)
- Redis causava loops de conexão com `REDIS_ENABLED=true`
- Se precisar de Redis no futuro, usar: `redis://localhost:6379` (dev) ou `redis://redis:6379` (prod)

### 3. Evolution API (3 secrets) ✅ Deployada

```bash
# URL da Evolution API
EVOLUTION_API_URL=http://localhost:8080  # dev local
EVOLUTION_API_URL=http://evolution_api:8080  # prod VPS (Docker internal network)

# API Key (Global API Key da Evolution API)
EVOLUTION_API_KEY=I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=

# Nome da instância WhatsApp
EVOLUTION_INSTANCE=meu-zap
```

**URLs em produção:**
- Evolution API: https://wa.ytem.com.br
- Evolution Manager: https://wa-manager.ytem.com.br
- Instância ID: b2b76790-7a59-4eae-81dc-7dfabd0784b8

**Onde encontrar:**
- Acessar: https://wa-manager.ytem.com.br
- Settings → Global API Key
- Instances → Nome da instância

### 4. Configuração (1 secret)

```bash
# Nível de log
LOG_LEVEL=info  # dev: debug | prod: info
```

---

## 🚀 Configurar Secrets no Doppler

### Criar Projeto (se não existir)

```bash
# Criar projeto sticker
doppler projects create sticker

# Criar configs
doppler configs create dev --project sticker
doppler configs create dev_personal --project sticker
doppler configs create prd --project sticker
```

### Adicionar Secrets - Config DEV

```bash
doppler secrets set \
  SUPABASE_URL="https://ludlztjdvwsrwlsczoje.supabase.co" \
  SUPABASE_SERVICE_KEY="<service_key_aqui>" \
  EVOLUTION_API_URL="http://localhost:8080" \
  EVOLUTION_API_KEY="I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" \
  EVOLUTION_INSTANCE="meu-zap" \
  LOG_LEVEL="debug" \
  --project sticker \
  --config dev
```

### Adicionar Secrets - Config PRD

```bash
doppler secrets set \
  SUPABASE_URL="https://ludlztjdvwsrwlsczoje.supabase.co" \
  SUPABASE_SERVICE_KEY="<service_key_aqui>" \
  EVOLUTION_API_URL="http://evolution_api:8080" \
  EVOLUTION_API_KEY="I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" \
  EVOLUTION_INSTANCE="meu-zap" \
  LOG_LEVEL="info" \
  --project sticker \
  --config prd
```

---

## ✅ Verificar Secrets

### Listar todos os secrets

```bash
doppler secrets --project sticker --config prd
```

### Ver um secret específico

```bash
doppler secrets get SUPABASE_URL --plain --project sticker --config prd
```

### Testar localmente

```bash
# No diretório do projeto
cd /Users/paulohenrique/sticker

# Configurar projeto local
doppler setup --project sticker --config dev

# Rodar com Doppler (injeta env vars automaticamente)
doppler run npm run dev
doppler run npm run dev:worker
```

---

## 📦 Deploy para Produção

### Deploy Completo

```bash
# Deploy backend + worker com secrets do Doppler
./deploy/deploy-sticker.sh prd
```

**O que acontece:**
1. ✅ Carrega secrets do Doppler (config `prd`)
2. ✅ Gera stack file temporário com secrets injetados
3. ✅ Copia para VPS via vps-ssh (Doppler + sshpass)
4. ✅ Deploy via `docker stack deploy`
5. ✅ Health check automático
6. ✅ Deleta arquivo temporário (segurança)

**VPS em produção:**
- IP: 69.62.100.250 (Contabo - srv1007351)
- Acesso: vps-ssh (comando wrapper com Doppler)

### Atualizar um Secret

```bash
# 1. Atualizar no Doppler
doppler secrets set EVOLUTION_API_KEY="nova_key" --project sticker --config prd

# 2. Redeploy stack (pega o novo valor)
./deploy/deploy-sticker.sh prd
```

---

## 🔒 Segurança

### ✅ O que NUNCA fazer

- ❌ NUNCA commitar secrets no Git
- ❌ NUNCA usar `console.log()` com secrets
- ❌ NUNCA usar anon_key no backend (sempre service_role)
- ❌ NUNCA expor secrets em logs ou mensagens de erro

### ✅ Boas Práticas

- ✅ Todos os secrets no Doppler
- ✅ Usar `doppler run` em dev
- ✅ Rotacionar secrets regularmente
- ✅ Usar configs diferentes para dev/prd
- ✅ Auditar acessos via Doppler dashboard

### Rotação de Secrets

Se um secret for comprometido:

```bash
# 1. Gerar novo secret no serviço (Supabase, Evolution API, etc)
# 2. Atualizar no Doppler
doppler secrets set SECRET_NAME="novo_valor" --config prd

# 3. Redeploy
./deploy/deploy-sticker.sh prd

# 4. Revogar secret antigo no serviço
```

---

## 📚 Referências

- **Doppler Dashboard:** https://dashboard.doppler.com
- **Doppler Docs:** https://docs.doppler.com
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Evolution API:** https://wa.ytem.com.br (produção) | http://localhost:8080 (dev)
- **Evolution Manager:** https://wa-manager.ytem.com.br

---

## 🐞 Troubleshooting

### Erro: "Doppler is not authenticated"

```bash
doppler login
```

### Erro: "Config 'prd' not found"

```bash
# Criar config
doppler configs create prd --project sticker

# Adicionar secrets
doppler secrets set SUPABASE_URL="..." --config prd
```

### Erro: "docker stack deploy" falha

```bash
# Verificar logs
vps-ssh "docker service logs sticker_backend --tail 100"

# Verificar se Evolution API está rodando
vps-ssh "docker service ls | grep evolution"
vps-ssh "curl -I http://evolution_api:8080"
```

### Health check falha após deploy

```bash
# Ver status dos serviços
vps-ssh "docker service ls | grep sticker"

# Ver logs do backend
vps-ssh "docker service logs sticker_backend -f --tail 50"

# Verificar se consegue acessar Evolution API
vps-ssh "docker exec \$(docker ps -q -f name=sticker_backend) sh -c 'curl -I http://evolution_api:8080'"

# Verificar Evolution API status
curl https://wa.ytem.com.br
```

---

**Status:** ✅ Evolution API keys configurados | Sticker Bot pendente
**Última atualização:** 2025-12-27

---

## 🔗 Links Úteis

- **Evolution API (Produção):** https://wa.ytem.com.br
- **Evolution Manager:** https://wa-manager.ytem.com.br
- **Instância WhatsApp:** meu-zap (ID: b2b76790-7a59-4eae-81dc-7dfabd0784b8)
- **QR Code:** https://wa.ytem.com.br/instance/connect/meu-zap
