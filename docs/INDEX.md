# Documentacao do Projeto Sticker Bot

> Indice completo da documentacao organizada por tema

---

## Inicio Rapido

- **[README Principal](README.md)** - Guia de setup e desenvolvimento local

---

## Arquitetura e Planejamento

### Documentos Estrategicos

| Documento | Descricao |
|-----------|-----------|
| **[PRD - Product Requirements](architecture/PRD-BOT-STICKERS.md)** | Requisitos completos do produto, personas, arquitetura tecnica |
| **[Estrategia de Desenvolvimento](architecture/DEVELOPMENT-STRATEGY.md)** | Roadmap de sprints, arquitetura local vs producao |

### O que contem

**PRD-BOT-STICKERS.md:**
- Problema e solucao
- Personas (Memeir, Empreendedora, Entusiasta)
- Requisitos funcionais (RF01-RF10)
- Requisitos nao funcionais (Performance, Seguranca, Observabilidade)
- Modelo de dados (Tabelas: users, stickers, usage_logs)
- Fluxos de usuario detalhados
- Mensagens do bot
- Roadmap de 8 sprints
- Metricas de sucesso
- Riscos e mitigacoes

**DEVELOPMENT-STRATEGY.md:**
- Decisao: Desenvolvimento LOCAL primeiro (Sprints 2-7)
- Deploy completo para VPS (Sprint 8)
- Arquitetura atual vs futura
- Fluxo de trabalho completo
- Checklist de progresso

---

## Setup e Configuracao

### Guias de Setup Inicial

| Documento | Descricao |
|-----------|-----------|
| **[Doppler - Setup Completo](setup/DOPPLER-SETUP-COMPLETE.md)** | Configuracao de secrets (7/7 configurados) |
| **[Doppler - Sucesso](setup/DOPPLER-SUCCESS.md)** | Resumo da configuracao Doppler |
| **[Cloudflare DNS - Sucesso](setup/CLOUDFLARE-DNS-SUCCESS.md)** | DNS configurado e propagado |
| **[Cloudflare - Resumo](setup/CLOUDFLARE-SUMMARY.md)** | Guia rapido de configuracao DNS |
| **[Supabase MCP Setup](setup/SUPABASE_MCP_SETUP.md)** | Configuracao do Supabase MCP para Claude Code |

### O que contem

**DOPPLER-SETUP-COMPLETE.md:**
- 7/7 secrets configurados (dev + prd)
- Como obter service keys
- Comandos uteis do Doppler
- Troubleshooting

**CLOUDFLARE-DNS-SUCCESS.md:**
- DNS propagado (stickers.ytem.com.br)
- Proxy Cloudflare ativado
- SSL Full (strict) configurado
- 9 arquivos atualizados com dominio correto

**SUPABASE_MCP_SETUP.md:**
- MCP configurado para Storage, Database, Functions
- Como autenticar
- Exemplos de uso com Claude Code

---

## Sprints - Implementacao

### Resumos por Sprint

| Documento | Sprint | Descricao |
|-----------|--------|-----------|
| **[Sprint 1 - Infraestrutura](sprints/SPRINT-1-SUMMARY.md)** | Sprint 1 | Supabase, Doppler, DNS Cloudflare (✅ 100% COMPLETO) |
| **[Sprint 2 - Webhook & Deteccao](sprints/SPRINT-2-SUMMARY.md)** | Sprint 2 | Endpoint webhook, validacao de mensagens (✅ COMPLETO) |
| **[Sprints 4-7 - Resumo Completo](sprints/SPRINTS-4-7-SUMMARY.md)** | Sprints 4-7 | Stickers animados, limite diario, jobs, testes (✅ COMPLETO) |
| **[Quick Start - Sprints 4-7](sprints/QUICK-START-SPRINTS-4-7.md)** | Sprints 4-7 | Guia rapido para testar sprints 4-7 |
| **[Arquivos Criados - Sprints 4-7](sprints/ARQUIVOS-CRIADOS.md)** | Sprints 4-7 | Lista de arquivos criados/modificados |

### O que foi implementado

**Sprint 1 (✅ 100%):**
- Supabase (DB + Storage)
- Doppler (7/7 secrets)
- DNS Cloudflare (stickers.ytem.com.br)

**Sprint 2 (✅ 100%):**
- Webhook recebe mensagens Evolution API
- Detecta imagens vs GIFs
- Valida formato/tamanho
- Adiciona job na fila BullMQ

**Sprint 3 (✅ 100%):**
- Processamento de stickers estaticos (Sharp)
- Upload para Supabase Storage
- Integracao com Evolution API

**Sprint 4 (✅ 100%):**
- Processamento de GIFs animados (FFmpeg)
- Conversao para WebP animado (512x512, 15fps)
- Upload para bucket stickers-animados

**Sprint 5 (✅ 100%):**
- Gerenciamento de usuarios (userService)
- Limite diario (10 stickers/dia)
- CRM de retencao (mensagens personalizadas)
- Sistema de pendentes

**Sprint 6 (✅ 100%):**
- Jobs agendados (node-cron)
- Reset de contadores (meia-noite)
- Envio de pendentes (8h da manha)

**Sprint 7 (✅ 100%):**
- Endpoint /stats (estatisticas completas)
- Logs estruturados (Pino)
- Monitoramento de performance

---

## Features Experimentais

### Novas Funcionalidades (em avaliação)

| Documento | Descricao | Status |
|-----------|-----------|--------|
| **[Download de Vídeos do Twitter](TWITTER-VIDEO-DOWNLOAD.md)** | Solução completa para baixar vídeos do Twitter/X via VxTwitter API | ✅ TESTADO E FUNCIONANDO |

### O que contem

**TWITTER-VIDEO-DOWNLOAD.md:**
- Resumo executivo da solução encontrada
- Problemas e soluções testadas
- VxTwitter API: como funciona
- 3 testes realizados com 100% de sucesso
- Implementação: código e fluxo completo
- **NOVO (v2.0):** Sistema de respostas baseadas em texto
- **NOVO (v2.0):** Gerenciamento de contexto com Redis
- **NOVO (v2.0):** Mensagens do bot em português
- **NOVO (v2.0):** Timeout automático (5 minutos)
- Roadmap de integração no bot
- Potencial de monetização
- Expansão para outras plataformas (TikTok, Instagram, YouTube)

**Status atual:**
- ✅ Solução validada e pronta para implementação
- ✅ API gratuita e sem autenticação
- ✅ 100% compatível com WhatsApp
- ✅ Sistema de UX definido (respostas texto vs botões)
- 📋 Aguardando decisão de implementação

---

## Deployment

### Guias de Deploy

Todos os guias de deployment estao na pasta `/deploy/`:

| Documento | Descricao | Status |
|-----------|-----------|--------|
| **[deploy/CI-CD-WORKFLOW.md](../deploy/CI-CD-WORKFLOW.md)** | 🎯 **PRINCIPAL:** Guia completo do deploy automatizado via GitHub Actions | ✅ IMPLEMENTADO |
| **[deploy/GITHUB-ACTIONS-SETUP.md](../deploy/GITHUB-ACTIONS-SETUP.md)** | Setup inicial do CI/CD (primeira vez) | ✅ CONFIGURADO |
| **[deploy/QUICK-DEPLOY.md](../deploy/QUICK-DEPLOY.md)** | Referencia rapida de comandos | ✅ ATUALIZADO |
| **[deploy/DEPLOYMENT-PROCESS.md](../deploy/DEPLOYMENT-PROCESS.md)** | Processo manual de deploy (backup/emergencia) | 📚 LEGACY |
| **[deploy/DEPLOYMENT-GUIDE.md](../deploy/DEPLOYMENT-GUIDE.md)** | Guia geral de deployment | 📚 LEGACY |
| **[deploy/DOPPLER-SETUP.md](../deploy/DOPPLER-SETUP.md)** | Setup detalhado do Doppler | ✅ ATIVO |
| **[deploy/CLOUDFLARE-DNS-SETUP.md](../deploy/CLOUDFLARE-DNS-SETUP.md)** | Setup DNS no Cloudflare | ✅ ATIVO |

### Deploy Automatizado (CI/CD) - Método Recomendado

✅ **Zero-downtime deployment** com 2 réplicas
✅ **Rollback automático** se algo falhar
✅ **Deploy em ~2-3 minutos** após push

```bash
# 1. Fazer mudanças no código
# ... editar arquivos em src/ ...

# 2. Commit e push para main
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 3. Pronto! Deploy automático
# Acompanhar em: https://github.com/reisspaulo/sticker/actions
```

**📖 Ver documentação completa:** [CI-CD-WORKFLOW.md](../deploy/CI-CD-WORKFLOW.md)

### Deploy Manual (Backup/Emergência)

```bash
# Apenas para emergências ou quando GitHub Actions estiver indisponível
./deploy/deploy-sticker.sh prd
```

**📖 Ver documentação completa:** [DEPLOYMENT-PROCESS.md](../deploy/DEPLOYMENT-PROCESS.md)

---

## Sprints e Progresso

### Sprint 1: Infraestrutura Base (COMPLETA)

| Documento | Descricao |
|-----------|-----------|
| **[Sprint 1 - Resumo](sprints/SPRINT-1-SUMMARY.md)** | Resumo completo da Sprint 1 |

**Status:** COMPLETA
**Data:** 26/12/2024

**O que foi feito:**
- Projeto Node.js + TypeScript configurado
- Supabase configurado (tabelas + storage)
- Redis + BullMQ configurado
- Doppler configurado (7/7 secrets)
- DNS Cloudflare configurado (stickers.ytem.com.br)
- Estrutura de deployment criada
- Documentacao completa

---

### Sprint 2: Webhook & Deteccao (COMPLETA)

| Documento | Descricao |
|-----------|-----------|
| **[Sprint 2 - Resumo](sprints/SPRINT-2-SUMMARY.md)** | Resumo completo da Sprint 2 |

**Status:** COMPLETA
**Data:** 26/12/2024

**O que foi feito:**
- Endpoint webhook funcional com validacao de API key
- Deteccao de tipos de mensagem (imagem vs GIF)
- Validacoes completas (formato, tamanho, duracao)
- Integracao com BullMQ para enfileiramento
- Logs estruturados com Pino
- Testes automatizados (8 cenarios)

**Arquivos criados:**
- `/src/types/evolution.ts` - Tipos TypeScript
- `/src/middleware/auth.ts` - Validacao de API key
- `/src/utils/messageValidator.ts` - Validacao de mensagens
- `/scripts/test-webhook.sh` - Suite de testes

**Como testar:**
```bash
# Iniciar servidor
npm run dev

# Executar testes
export EVOLUTION_API_KEY="your-key"
./scripts/test-webhook.sh
```

**Proxima Sprint:** Sprint 3 - Processamento de Stickers

---

## Estrutura Completa do Projeto

```
sticker/
├── docs/                           # Documentacao organizada
│   ├── INDEX.md                   # Este arquivo (indice)
│   ├── README.md                  # Guia principal de setup
│   │
│   ├── architecture/              # Arquitetura e planejamento
│   │   ├── PRD-BOT-STICKERS.md
│   │   └── DEVELOPMENT-STRATEGY.md
│   │
│   ├── setup/                     # Guias de setup inicial
│   │   ├── DOPPLER-SETUP-COMPLETE.md
│   │   ├── DOPPLER-SUCCESS.md
│   │   ├── CLOUDFLARE-DNS-SUCCESS.md
│   │   ├── CLOUDFLARE-SUMMARY.md
│   │   └── SUPABASE_MCP_SETUP.md
│   │
│   ├── sprints/                   # Resumos de sprints
│   │   └── SPRINT-1-SUMMARY.md
│   │
│   ├── CONFIGURACAO.md            # Configuracao Evolution API
│   ├── ENDPOINTS.md               # Endpoints Evolution API
│   ├── STICKERS.md                # Stickers Evolution API
│   └── STICKERS_ANIMADOS.md       # Stickers animados
│
├── deploy/                        # Scripts e configs de deploy
│   ├── DEPLOYMENT-GUIDE.md
│   ├── DOPPLER-SETUP.md
│   ├── CLOUDFLARE-DNS-SETUP.md
│   ├── stack-sticker.yml
│   └── deploy-sticker.sh
│
├── src/                           # Codigo TypeScript
│   ├── config/
│   ├── routes/
│   ├── server.ts
│   └── worker.ts
│
├── README.md                      # README raiz (Evolution API)
├── INDEX.md                       # Indice Evolution API
├── QUICKSTART.md                  # Quickstart Evolution API
├── docker-compose.yml             # Docker Compose
├── Dockerfile                     # Build image
├── package.json                   # Dependencies
└── tsconfig.json                  # TypeScript config
```

---

## Roadmap de Desenvolvimento

### Fase Atual: Desenvolvimento Local (Sprints 2-7)

- **Sprint 1:** Infraestrutura Base (COMPLETA)
- **Sprint 2:** Webhook & Deteccao (COMPLETA)
- **Sprint 3:** Stickers Estaticos (PROXIMA)
- **Sprint 4:** Stickers Animados
- **Sprint 5:** Limite Diario + CRM
- **Sprint 6:** Jobs Agendados
- **Sprint 7:** Testes + Monitoramento

### Fase Final: Deploy Producao (Sprint 8)

- Mover Evolution API para VPS
- Mover Sticker Bot para VPS
- Producao 24/7 independente do Mac

Ver detalhes: [DEVELOPMENT-STRATEGY.md](architecture/DEVELOPMENT-STRATEGY.md)

---

## Tecnologias

### Stack Principal

| Componente | Tecnologia |
|------------|------------|
| Backend | Fastify + TypeScript |
| Banco de Dados | PostgreSQL (Supabase) |
| Storage | Supabase Storage |
| Fila | Redis + BullMQ |
| Processamento Imagem | Sharp |
| Processamento GIF | FFmpeg |
| WhatsApp | Evolution API |
| Logs | Pino |
| Deploy | Docker Swarm |
| Secrets | Doppler |

### Infraestrutura

- VPS: Digital Ocean (157.230.50.63)
- DNS: Cloudflare
- SSL: Let's Encrypt (via Traefik)
- Dominio: stickers.ytem.com.br

---

## Links Uteis

### Dashboards

- **Supabase:** https://supabase.com/dashboard/project/ludlztjdvwsrwlsczoje
- **Cloudflare:** https://dash.cloudflare.com
- **Doppler:** https://dashboard.doppler.com

### Endpoints

- **Health Check (local):** http://localhost:3000/health
- **Health Check (producao):** https://stickers.ytem.com.br/health
- **Webhook (producao):** https://stickers.ytem.com.br/webhook

### Repositorio

- **GitHub:** (adicionar URL quando publicado)

---

## Comandos Rapidos

### Desenvolvimento Local

```bash
# Setup Doppler
cd /Users/paulohenrique/sticker
doppler setup --project sticker --config dev

# Rodar backend
doppler run npm run dev

# Rodar worker
doppler run npm run dev:worker

# Health check
curl http://localhost:3000/health
```

### Docker Local

```bash
# Build e iniciar
docker compose -f docker-compose.bot.yml up -d

# Ver logs
docker logs -f sticker_bot_backend
docker logs -f sticker_bot_worker

# Parar
docker compose -f docker-compose.bot.yml down
```

### Deploy Producao

```bash
# Build
npm run build
docker build -t ghcr.io/reisspaulo/sticker-bot-backend:latest .
docker push ghcr.io/reisspaulo/sticker-bot-backend:latest

# Deploy
./deploy/deploy-sticker.sh prd

# Verificar
curl https://stickers.ytem.com.br/health
ssh root@157.230.50.63 'docker service ls | grep sticker'
```

---

## Troubleshooting

### Erro: "SUPABASE_URL must be defined"

- Verifique Doppler: `doppler secrets --project sticker --config dev`
- Rode com Doppler: `doppler run npm run dev`

### Erro: "Redis connection refused"

- Verifique Redis: `docker ps | grep redis`
- Inicie Redis: `docker compose up -d redis`

### DNS nao resolve

```bash
# Limpar cache DNS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Verificar propagacao
dig stickers.ytem.com.br
```

### 502 Bad Gateway (producao)

```bash
# Ver logs
ssh root@157.230.50.63 'docker service logs sticker_backend --tail 100'

# Verificar status
ssh root@157.230.50.63 'docker service ls | grep sticker'
```

---

## Status do Projeto

| Componente | Status | Observacao |
|------------|--------|------------|
| Codigo TypeScript | PRONTO | Compilacao OK |
| Supabase (DB + Storage) | PRONTO | Tabelas e buckets criados |
| Redis + BullMQ | PRONTO | Configurado |
| Doppler Secrets | PRONTO | 7/7 secrets (dev + prd) |
| DNS Cloudflare | PRONTO | Propagado |
| Webhook Evolution | PRONTO | Sprint 2 completa |
| Processamento Stickers | PENDENTE | Sprint 3+ |
| Deploy VPS | PENDENTE | Sprint 8 |

---

## Proximos Passos

1. **Iniciar Sprint 3:** Processamento de Stickers (desenvolvimento local)
   - Implementar worker para consumir jobs da fila
   - Download de arquivos da Evolution API
   - Conversao de imagens para stickers (Sharp)
   - Upload via Evolution API

2. **Continuar Sprints 4-7:** Desenvolvimento local
   - Processar stickers animados (FFmpeg)
   - Implementar limite diario + CRM
   - Jobs agendados
   - Testes + Monitoramento

3. **Sprint 8:** Deploy completo para VPS
   - Mover Evolution API para VPS
   - Mover Sticker Bot para VPS
   - Producao 24/7

---

**Versao:** 1.1
**Ultima Atualizacao:** 26/12/2024
**Status:** Sprint 2 Completa - Pronto para Sprint 3

---

*Documentacao organizada por: Claude Code*
*Data: 26/12/2024*
