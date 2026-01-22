# Doppler Setup - Sticker Bot

Guia para configurar e usar Doppler no projeto Sticker Bot.

---

## REGRA DE OURO

```
NUNCA crie arquivos .env com secrets reais.
SEMPRE use: doppler run <comando>
```

---

## Pre-requisitos

- Acesso ao projeto `sticker` no Doppler
- Doppler CLI instalado e autenticado (`doppler login`)

---

## Estrutura do Projeto

```
Doppler Organization: YTEM
└── Project: sticker
    ├── Config: dev          (desenvolvimento local)
    ├── Config: dev_personal (desenvolvimento pessoal)
    ├── Config: stg          (staging - futuro)
    └── Config: prd          (producao VPS)
```

---

## Secrets Necessarios

| Secret | Descricao | Onde obter |
|--------|-----------|------------|
| SUPABASE_URL | URL do projeto | Supabase Dashboard -> Settings -> API |
| SUPABASE_SERVICE_KEY | Service role key | Supabase Dashboard -> Settings -> API |
| REDIS_URL | URL do Redis | Configuracao local ou VPS |
| EVOLUTION_API_URL | URL da Evolution API | wa-manager ou localhost |
| EVOLUTION_API_KEY | API Key global | wa-manager -> Settings |
| EVOLUTION_INSTANCE | Nome da instancia | wa-manager -> Instances |
| LOG_LEVEL | Nivel de log | debug (dev) / info (prd) |

> **IMPORTANTE:** Todos os valores reais ficam APENAS no Doppler. Nunca em arquivos.

---

## Desenvolvimento Local

### Setup inicial (uma vez)

```bash
cd /Users/paulohenrique/sticker
doppler setup --project sticker --config dev
```

### Rodar o projeto

```bash
# Backend
doppler run npm run dev

# Worker (outro terminal)
doppler run npm run dev:worker

# Qualquer comando
doppler run <comando>
```

### Verificar health

```bash
curl http://localhost:3000/health
```

---

## Deploy para Producao

```bash
# Deploy completo (usa Doppler config prd automaticamente)
./deploy/deploy-sticker.sh prd
```

O script:
1. Carrega secrets do Doppler (config `prd`)
2. Gera stack file temporario
3. Copia para VPS
4. Deploy via `docker stack deploy`
5. Deleta arquivo temporario

---

## Comandos Uteis

```bash
# Ver todos os secrets (mascarados)
doppler secrets --project sticker --config dev

# Ver valor de um secret
doppler secrets get SUPABASE_URL --plain --project sticker --config dev

# Atualizar um secret
doppler secrets set SECRET_NAME="novo_valor" --project sticker --config dev

# Listar projetos
doppler projects

# Listar configs
doppler configs --project sticker
```

---

## Adicionar Novo Secret

1. Adicione no Doppler Dashboard ou via CLI:
```bash
doppler secrets set NOVO_SECRET="valor" --project sticker --config dev
doppler secrets set NOVO_SECRET="valor" --project sticker --config prd
```

2. Use no codigo:
```typescript
const meuSecret = process.env.NOVO_SECRET;
```

3. Redeploy (prd):
```bash
./deploy/deploy-sticker.sh prd
```

---

## Rotacao de Secrets

Se um secret for comprometido:

```bash
# 1. Gere novo secret no servico (Supabase, Evolution, etc)

# 2. Atualize no Doppler
doppler secrets set SECRET_NAME="novo_valor" --project sticker --config prd

# 3. Redeploy
./deploy/deploy-sticker.sh prd

# 4. Revogue o secret antigo no servico
```

---

## Seguranca

### NUNCA faca

- Criar arquivos .env com secrets reais
- Commitar secrets no Git
- Usar console.log() com secrets
- Compartilhar secrets via chat/email
- Usar anon_key no backend (sempre service_role)

### SEMPRE faca

- Use `doppler run` em desenvolvimento
- Obtenha secrets via Doppler Dashboard
- Rotacione secrets se comprometidos
- Use configs diferentes para dev/prd

---

## Troubleshooting

### "Doppler is not authenticated"

```bash
doppler login
```

### "Project not found"

```bash
doppler projects  # Ver projetos disponiveis
```

### "Config not found"

```bash
doppler configs --project sticker  # Ver configs
```

### Secret nao esta sendo injetado

```bash
# Verificar se existe
doppler secrets get SECRET_NAME --project sticker --config dev

# Testar injecao
doppler run env | grep SECRET_NAME
```

---

## Referencias

- **Doppler Dashboard:** https://dashboard.doppler.com
- **Doppler Docs:** https://docs.doppler.com
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Evolution Manager:** https://your-evolution-manager.com

---

**Ultima atualizacao:** 2026-01-09
