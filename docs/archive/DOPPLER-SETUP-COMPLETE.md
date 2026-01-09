# Doppler Setup - COMPLETO

**Data:** 26/12/2025
**Status:** COMPLETO - Projeto criado, configs prontos, 7/7 secrets configurados

---

## O que foi feito

### 1. Projeto Criado
```
Projeto: sticker
Descricao: WhatsApp Sticker Bot - Transforma imagens em stickers
```

### 2. Configs Criados

| Config | Environment | Uso |
|--------|-------------|-----|
| `dev` | dev | Desenvolvimento local |
| `dev_personal` | dev | Desenvolvimento pessoal (branch feature) |
| `stg` | stg | Staging (testes pre-producao) |
| `prd` | prd | Producao (VPS) |

### 3. Secrets Configurados

| Secret | Dev | Prd | Descricao |
|--------|-----|-----|-----------|
| SUPABASE_URL | OK | OK | URL do projeto Supabase |
| SUPABASE_SERVICE_KEY | OK | OK | Service role key (acesso total) |
| REDIS_URL | OK | OK | URL do Redis |
| EVOLUTION_API_URL | OK | OK | URL da Evolution API |
| EVOLUTION_API_KEY | OK | OK | API Key global da Evolution |
| EVOLUTION_INSTANCE | OK | OK | Nome da instancia WhatsApp |
| LOG_LEVEL | OK | OK | Nivel de log (debug/info) |

**Total:** 7/7 secrets configurados (100%)

> **IMPORTANTE:** Valores reais estao APENAS no Doppler. Use `doppler secrets` para visualizar.

---

## Como usar

### Ver secrets

```bash
# Listar todos (valores mascarados por padrao)
doppler secrets --project sticker --config dev

# Ver valor de um secret especifico
doppler secrets get SUPABASE_URL --plain --project sticker --config dev
```

### Rodar localmente

```bash
# Setup inicial (uma vez)
doppler setup --project sticker --config dev

# Rodar backend
doppler run npm run dev

# Rodar worker
doppler run npm run dev:worker
```

### Atualizar secret

```bash
doppler secrets set SECRET_NAME="novo_valor" --project sticker --config dev
```

---

## Como funciona

### Doppler Injection

Quando voce roda `doppler run npm run dev`:

1. Doppler carrega secrets do config `dev`
2. Injeta como variaveis de ambiente
3. Executa `npm run dev`
4. Aplicacao le variaveis de `process.env`
5. **Zero** secrets no codigo ou arquivos `.env`

### Deploy para Producao

O script `deploy/deploy-sticker.sh`:

1. Carrega secrets do config `prd`
2. Gera stack file temporario com secrets injetados
3. Copia para VPS via SCP
4. Deploy via `docker stack deploy`
5. Deleta arquivo temporario (seguranca)

---

## Troubleshooting

### Erro: "Project not found"

```bash
doppler projects  # Listar projetos disponiveis
```

### Erro: "Config not found"

```bash
doppler configs --project sticker  # Listar configs
```

### Secret nao esta sendo injetado

```bash
# Verificar se secret existe
doppler secrets get SECRET_NAME --project sticker --config dev

# Verificar se esta rodando com Doppler
doppler run env | grep SECRET_NAME
```

---

**Status Final:** 100% COMPLETO
**Proximo Passo:** `doppler run npm run dev`
