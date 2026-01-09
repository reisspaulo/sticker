# Doppler Setup - SUCESSO!

**Status:** COMPLETO
**Data:** 26/12/2025

---

## O que foi configurado

### 1. Projeto Criado
```
Projeto: sticker
Descricao: WhatsApp Sticker Bot - Transforma imagens em stickers
Configs: dev, dev_personal, stg, prd
```

### 2. Secrets Configurados (7/7)

**Config DEV** (desenvolvimento local):
```bash
SUPABASE_URL=<doppler:dev>
SUPABASE_SERVICE_KEY=<doppler:dev>
REDIS_URL=redis://localhost:6379
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=<doppler:dev>
EVOLUTION_INSTANCE=<doppler:dev>
LOG_LEVEL=debug
```

**Config PRD** (producao VPS):
```bash
SUPABASE_URL=<doppler:prd>
SUPABASE_SERVICE_KEY=<doppler:prd>
REDIS_URL=redis://redis:6379
EVOLUTION_API_URL=http://evolution_api:8080
EVOLUTION_API_KEY=<doppler:prd>
EVOLUTION_INSTANCE=<doppler:prd>
LOG_LEVEL=info
```

> **IMPORTANTE:** Todos os valores reais estao no Doppler. NUNCA hardcode secrets.

---

## Como usar

### 1. Setup Local (uma vez)

```bash
cd /Users/paulohenrique/sticker
doppler setup --project sticker --config dev
```

### 2. Rodar com Doppler

```bash
# Terminal 1 - Backend
doppler run npm run dev

# Terminal 2 - Worker
doppler run npm run dev:worker
```

### 3. Verificar se funcionou

```bash
curl http://localhost:3000/health
```

---

## Comandos Uteis

```bash
# Ver todos os secrets (valores mascarados)
doppler secrets --project sticker --config dev

# Atualizar um secret
doppler secrets set SECRET_NAME="novo_valor" --project sticker --config dev

# Rodar qualquer comando com secrets injetados
doppler run --project sticker --config dev <seu_comando>
```

---

## Seguranca

### NUNCA faca

- Commitar secrets no Git
- Criar arquivos .env com secrets reais
- Usar `console.log()` com secrets
- Compartilhar secrets via chat/email

### SEMPRE faca

- Use `doppler run` em desenvolvimento
- Obtenha secrets via Doppler Dashboard
- Rotacione secrets se comprometidos

---

**Total de secrets configurados:** 7/7 (100%)
**Pronto para deploy:** Sim
