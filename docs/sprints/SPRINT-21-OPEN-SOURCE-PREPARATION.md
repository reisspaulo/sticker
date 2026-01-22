# Sprint 21 - Open Source Preparation

**Data:** 2026-01-22
**Status:** Planejamento
**Motivo:** WhatsApp baniu o numero por uso de API nao oficial (Z-API). Projeto sera arquivado como open source.

---

## Contexto

O projeto Sticker Bot recebeu muitos usuarios e o numero do WhatsApp foi banido por usar APIs nao oficiais (Z-API/Evolution API). Este sprint documenta a preparacao do projeto para ser disponibilizado como open source.

### Decisao

Disponibilizar o codigo como **open source educacional** com:
- Codigo completo funcional
- Documentacao de como rodar
- Aviso claro sobre riscos de usar APIs nao oficiais
- Remocao de dados sensiveis

---

## Analise da Infraestrutura Atual

### 1. Gerenciamento de Secrets (Doppler)

#### Projetos no Doppler (Organization: YTEM)

```
Doppler Organization: YTEM
├── brazyl          - Political Transparency Platform (criado 2025-12-09)
├── example-project - Projeto de exemplo
├── stepyo          - Step-by-Step Process Documentation (criado 2025-12-28)
├── sticker         - WhatsApp Sticker Bot (criado 2025-12-27) ← ESTE PROJETO
└── ytem            - WhatsApp CRM Platform (criado 2025-12-24)
```

#### Projeto STICKER - Configs e Secrets

```
Project: sticker
├── dev          (desenvolvimento local)
├── dev_personal (desenvolvimento pessoal)
├── stg          (staging)
└── prd          (producao)
```

**Secrets em sticker/prd (32 secrets):**

| Categoria | Secrets |
|-----------|---------|
| **WhatsApp** | `EVOLUTION_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE`, `Z_API_BASE_URL`, `Z_API_CLIENT_TOKEN`, `Z_API_INSTANCE`, `Z_API_TOKEN`, `ZAPI_WEBHOOK_ENABLED`, `USE_ZAPI`, `AVISA_API_TOKEN`, `AVISA_API_URL` |
| **Supabase** | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Redis** | `REDIS_URL` |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PREMIUM_PAYMENT_LINK`, `STRIPE_ULTRA_PAYMENT_LINK`, `STRIPE_STICKER_PREMIUM_PRODUCT_ID`, `STRIPE_STICKER_ULTRA_PRODUCT_ID` |
| **OpenAI** | `OPENAI_API_KEY` |
| **Admin** | `ADMIN_WHATSAPP`, `API_KEY` |
| **VPS/Training** | `VPS_TRAINING_API_KEY`, `VPS_TRAINING_API_URL` |
| **GitHub** | `GITHUB_TOKEN` |
| **Sistema** | `LOG_LEVEL`, `DOPPLER_*` |

#### Projeto BRAZYL - Secrets (59 secrets)

| Categoria | Secrets |
|-----------|---------|
| **APIs Gov** | `CAMARA_API_URL`, `SENADO_API_URL`, `TSE_API_URL`, `TRANSPARENCIA_API_*` |
| **Supabase** | `SUPABASE_*`, `DATABASE_URL`, `POSTGRES_DIRECT_PASSWORD` |
| **WhatsApp** | `EVOLUTION_*`, `AVISA_*` |
| **Stripe** | `STRIPE_*` |
| **AI** | `OPENAI_*`, `AI_*` |
| **Instagram** | `INSTAGRAM_*` (7 secrets) |
| **Cloudflare** | `CLOUDFLARE_*` |
| **VPS** | `VPS_HOST`, `VPS_USER`, `VPS_PASSWORD` |
| **Twitter/X** | `X_API_BEARER_TOKEN` |

#### Projeto YTEM - Secrets (74 secrets)

| Categoria | Secrets |
|-----------|---------|
| **Avisa API** | `AVISA_*` (8 secrets) - Rate limits, tokens, fallbacks |
| **OpenAI/LLM** | `OPENAI_*`, `GOOGLE_*`, `LLM_PROVIDER` (12 secrets) |
| **Supabase** | `SUPABASE_*` |
| **Redis** | `REDIS_*` (9 secrets) - Pool config, timeouts |
| **N8N** | `N8N_*` (3 secrets) |
| **LangChain** | `LANGCHAIN_*`, `LANGSMITH_*` |
| **VPS** | `VPS_*` (6 secrets) - Inclui Postgres config |
| **Features** | `FEATURE_*` (5 flags) |
| **Sentry** | `SENTRY_*` (4 secrets) |
| **Security** | `JWT_SECRET`, `ENCRYPTION_KEY` |

#### Projeto STEPYO - Secrets (17 secrets)

| Categoria | Secrets |
|-----------|---------|
| **Auth** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_*` |
| **Supabase** | `SUPABASE_*`, `NEXT_PUBLIC_SUPABASE_*` |
| **OpenAI** | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| **URLs** | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` |

---

### Decisao sobre Doppler

**Regra atual:** Nunca `.env` com secrets reais - sempre `doppler run`

**Para open source:**
- Manter Doppler como opcao para quem quiser
- Adicionar suporte a `.env` tradicional como padrao
- Documentar ambos os metodos

**IMPORTANTE - NAO APAGAR:**
- Os projetos `brazyl`, `ytem`, `stepyo` sao projetos SEPARADOS e ativos
- Contem credenciais de VPS compartilhadas (`VPS_HOST`, `VPS_USER`, `VPS_PASSWORD`)
- O projeto `sticker` pode ser arquivado, mas os outros devem permanecer

### 2. CI/CD (GitHub Actions)

| Workflow | Arquivo | Funcao |
|----------|---------|--------|
| CI | `.github/workflows/ci.yml` | Lint, Build, Tests |
| Deploy Backend | `.github/workflows/deploy-sticker.yml` | Build Docker + Deploy VPS |
| Deploy Admin | `.github/workflows/deploy-admin.yml` | Deploy Admin Panel |

**Features:**
- Zero downtime (rolling updates)
- Rollback automatico
- Verificacao de versao (git SHA)
- Cache de build Docker

### 3. Arquitetura de Producao

```
VPS (Docker Swarm)
├── sticker_backend   (Fastify API - porta 3000)
├── sticker_worker    (BullMQ processor)
├── sticker_admin     (Next.js admin panel)
└── Traefik           (reverse proxy + SSL)

Cloud Services
├── Supabase          (PostgreSQL + Storage + Auth)
├── Redis             (BullMQ queues + cache)
└── GHCR              (Container registry)
```

### 4. Integracao WhatsApp

| Provider | Status | Arquivo |
|----------|--------|---------|
| Evolution API | Implementado | `src/services/evolutionApi.ts` |
| Z-API | Implementado | `src/services/zapiApi.ts` |
| Avisa API | Implementado | `src/services/avisaApi.ts` |

**Abstraction layer:** `src/services/whatsappApi.ts`

### 5. Processamento de Midia

| Tipo | Biblioteca | Arquivo |
|------|------------|---------|
| Imagens | Sharp | `src/services/stickerProcessor.ts` |
| GIFs/Videos | FFmpeg | `src/services/gifProcessor.ts` |
| Twitter | twitter-downloader | `src/services/twitterService.ts` |

---

## Resultado do Scan de Secrets (2026-01-22)

### Resumo

| Tipo | Quantidade | Severidade |
|------|------------|------------|
| API Key Evolution | 19 arquivos | CRITICA |
| IP da VPS | 14 arquivos | ALTA |
| Supabase Project ID | 25 arquivos | MEDIA |
| Domínios your-domain.com | 100+ refs | MEDIA |
| GitHub username | 69 refs | BAIXA |
| Email pessoal | 18 arquivos | ALTA |
| Senha hardcoded | 14 arquivos | CRITICA |
| Telefones reais | 3 arquivos | MEDIA |

### Detalhes por Categoria

#### API Key Evolution (CRITICA)
```
YOUR_EVOLUTION_API_KEY
```

**Arquivos afetados (19):**
- `exemplos/curl/exemplos.sh`
- `docs/archive/QUICKSTART.md`
- `docs/archive/INDEX-OLD.md`
- `docs/features/STICKERS.md`
- `docs/features/STICKERS_ANIMADOS.md`
- `docs/setup/PRODUCTION-SETUP.md`
- `docs/setup/DEPLOYMENT-PROCESS.md`
- `docs/operations/TROUBLESHOOTING.md`
- `docs/operations/QUICK-CHANGES-GUIDE.md`
- `docs/README.md`
- `docs/integrations/ENDPOINTS.md`
- `docs/integrations/EVOLUTION-AVISA-DEPENDENCY-MAP.md`
- `docs/architecture/DEVELOPMENT-STRATEGY.md`
- `docs/architecture/ARQUITETURA_360.md`
- `scripts/tools/send-watermark-samples.sh`
- `scripts/tools/send-via-vps.sh`
- `scripts/tests/test-watermark.ts`
- `scripts/tests/test-api.sh`
- `scripts/examples/exemplo-sticker.sh`

#### IP da VPS (ALTA)
```
YOUR_VPS_IP
```

**Arquivos afetados (14):**
- `admin-panel/src/app/api/celebrities/[id]/train/route.ts`
- `deploy/deploy-sticker.sh`
- `docs/sprints/SPRINT-19-URL-TRACKING.md`
- `docs/setup/DEPLOYMENT-GUIDE.md`
- `docs/setup/PRODUCTION-SETUP.md`
- `docs/setup/CLOUDFLARE-DNS-SETUP.md`
- `docs/setup/DEPLOYMENT-PROCESS.md`
- `docs/setup/GITHUB-ACTIONS-SETUP.md`
- `docs/operations/MEMORY-INVESTIGATION.md`
- `docs/operations/QUICK-CHANGES-GUIDE.md`
- `docs/README.md`
- `README.md`
- `scripts/investigate-memory.sh`

#### Supabase Project ID (MEDIA)
```
YOUR_SUPABASE_PROJECT_ID
```

**Arquivos afetados (25+):**
- `admin-panel/setup-doppler.sh`
- `admin-panel/tests/deep-debug.spec.ts`
- `admin-panel/next.config.ts`
- `.mcp.json`
- `.claude/settings.local.json`
- `docs/` (multiplos arquivos)
- `scripts/database/` (multiplos arquivos)

#### Email Pessoal + Senha (CRITICA)
```
test@example.com
TEST_PASSWORD
```

**Arquivos afetados (18):**
- `admin-panel/tests/*.spec.ts` (14 arquivos de teste)
- `admin-panel/playwright-report/`
- `TEST_SCRIPTS_README.md`

#### Senha Redis (ALTA)
```
YOUR_REDIS_PASSWORD
```

**Arquivos afetados:**
- `FIXES-MISSING-STICKERS.md`

#### Telefones de Usuarios Reais (MEDIA)
```
553398030035, 5517982298432
```

**Arquivos afetados:**
- `docs/investigations/MISSING-STICKERS-INVESTIGATION.md`

---

## Checklist de Sanitizacao

### Fase 1: Remover Dados Sensiveis

#### 1.1 Documentacao (154 ocorrencias em docs/)

| Arquivo | Item a Remover | Status |
|---------|----------------|--------|
| `docs/operations/QUICK-CHANGES-GUIDE.md` | IP, API keys, URLs | [ ] |
| `docs/setup/PRODUCTION-SETUP.md` | IP, API keys, Supabase ID | [ ] |
| `docs/setup/DEPLOYMENT-PROCESS.md` | IP, API keys, Supabase ID | [ ] |
| `docs/features/STICKERS.md` | API key Evolution | [ ] |
| `docs/features/STICKERS_ANIMADOS.md` | API key Evolution | [ ] |
| `docs/integrations/ENDPOINTS.md` | API key Evolution | [ ] |
| `docs/architecture/ARQUITETURA_360.md` | API key Evolution | [ ] |
| `docs/investigations/MISSING-STICKERS-INVESTIGATION.md` | Telefones reais | [ ] |
| `README.md` | IP, Supabase ID | [ ] |

#### 1.2 Codigo

| Arquivo | Item | Status |
|---------|------|--------|
| `admin-panel/src/app/api/celebrities/[id]/train/route.ts` | IP hardcoded | [ ] |
| `admin-panel/src/app/api/connections/*/route.ts` | URL your-domain.com | [ ] |
| `admin-panel/src/app/api/links/route.ts` | URL your-shortener.com | [ ] |
| `admin-panel/next.config.ts` | Supabase hostname | [ ] |
| `.mcp.json` | Supabase project ID | [ ] |
| `.claude/settings.local.json` | TUDO (JWTs, senhas, etc) | [ ] |

#### 1.3 Testes (14 arquivos)

| Arquivo | Item | Status |
|---------|------|--------|
| `admin-panel/tests/*.spec.ts` | Email + senha hardcoded | [ ] |
| `admin-panel/playwright-report/` | Dados de teste | [ ] |

#### 1.4 Scripts

| Arquivo | Item | Status |
|---------|------|--------|
| `deploy/deploy-sticker.sh` | IP, URLs | [ ] |
| `deploy/stack-sticker.yml` | GHCR image, URLs | [ ] |
| `exemplos/curl/exemplos.sh` | API key | [ ] |
| `scripts/tools/*.sh` | API keys | [ ] |
| `scripts/tests/*.ts` | API keys | [ ] |
| `scripts/database/*.ts` | Supabase refs | [ ] |

#### 1.5 Outros

| Arquivo | Item | Status |
|---------|------|--------|
| `FIXES-MISSING-STICKERS.md` | Senha Redis | [ ] |
| `CHANGELOG.md` | URLs your-domain.com | [ ] |
| `TEST_SCRIPTS_README.md` | Email pessoal | [ ] |

### Fase 2: Genericizar Configuracao

#### 2.1 Criar `.env.example` Completo

```env
# Server
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Redis
REDIS_URL=redis://localhost:6379

# WhatsApp Provider (escolha um)
WHATSAPP_PROVIDER=evolution  # ou 'zapi' ou 'avisa'

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your-api-key
EVOLUTION_INSTANCE=your-instance

# Z-API (alternativa)
ZAPI_INSTANCE_ID=your-instance-id
ZAPI_TOKEN=your-token
ZAPI_CLIENT_TOKEN=your-client-token

# Stripe (opcional - para pagamentos)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Twitter Download (opcional)
# Nao requer credenciais - usa biblioteca publica
```

#### 2.2 Atualizar Documentacao

| Documento | Acao |
|-----------|------|
| `README.md` | Reescrever para open source |
| `docs/setup/QUICK-START.md` | Criar guia de instalacao local |
| `docs/setup/DOCKER-COMPOSE.md` | Criar docker-compose para dev |
| `CONTRIBUTING.md` | Criar guia de contribuicao |
| `LICENSE` | Confirmar MIT |

### Fase 3: Adicionar Docker Compose para Dev

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # Evolution API (opcional - para testes locais)
  evolution:
    image: atendai/evolution-api:latest
    ports:
      - "8080:8080"
    environment:
      - AUTHENTICATION_API_KEY=your-local-key
    volumes:
      - evolution_data:/evolution/instances

  # Backend
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    volumes:
      - ./src:/app/src

  # Worker
  worker:
    build: .
    command: npm run start:worker
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
      - backend

volumes:
  redis_data:
  evolution_data:
```

### Fase 4: Warnings e Disclaimers

#### 4.1 README Principal

```markdown
## Aviso Importante

Este projeto usa APIs **nao oficiais** do WhatsApp (Evolution API, Z-API).

O uso dessas APIs pode resultar em:
- Ban permanente do numero
- Violacao dos Termos de Servico do WhatsApp
- Problemas legais em algumas jurisdicoes

**Use por sua conta e risco.**

Para uso comercial, considere a [WhatsApp Business API oficial](https://business.whatsapp.com/products/business-platform).
```

#### 4.2 Adicionar ao Startup

```typescript
// src/server.ts
console.log(`
==============================================
        STICKER BOT - OPEN SOURCE
==============================================

Este projeto usa APIs NAO OFICIAIS do WhatsApp.
Uso pode resultar em BAN do numero.

Para producao comercial, use a API oficial:
https://business.whatsapp.com/

==============================================
`);
```

---

## Estrutura Final do Repositorio

```
sticker-bot/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint + Tests
│       └── docker-build.yml    # Build image (sem deploy)
├── admin-panel/                # Next.js admin (opcional)
├── docs/
│   ├── setup/
│   │   ├── QUICK-START.md      # Como rodar localmente
│   │   ├── DOCKER.md           # Setup com Docker
│   │   ├── SUPABASE.md         # Configurar Supabase
│   │   └── WHATSAPP-PROVIDERS.md
│   ├── architecture/
│   │   └── OVERVIEW.md
│   └── features/
│       ├── STICKERS.md
│       └── TWITTER-DOWNLOAD.md
├── scripts/
│   ├── database/
│   │   └── schema.sql          # Schema inicial
│   └── setup/
│       └── init-local.sh
├── src/
│   ├── config/
│   ├── routes/
│   ├── services/
│   └── ...
├── tests/
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── docker-compose.yml          # Dev environment
├── docker-compose.prod.yml     # Producao (exemplo)
├── Dockerfile
├── LICENSE
├── package.json
├── README.md                   # Novo README para open source
└── tsconfig.json
```

---

## Arquivos a Criar

### 1. Novo README.md

```markdown
# Sticker Bot

Bot de WhatsApp para criar figurinhas a partir de imagens, videos e links do Twitter/TikTok.

## Features

- Converter imagens em stickers
- Converter GIFs/videos em stickers animados
- Download de videos do Twitter
- Sistema de limites diarios
- Painel admin (opcional)

## Aviso

Este projeto usa APIs NAO OFICIAIS do WhatsApp. [Leia os riscos](#riscos)

## Quick Start

### Requisitos

- Node.js 20+
- Redis
- Supabase (ou PostgreSQL)
- Evolution API ou Z-API

### Instalacao

\`\`\`bash
git clone https://github.com/seu-usuario/sticker-bot.git
cd sticker-bot
npm install
cp .env.example .env
# Edite .env com suas configuracoes
npm run dev
\`\`\`

### Com Docker

\`\`\`bash
docker-compose up -d
\`\`\`

## Documentacao

- [Setup Completo](docs/setup/QUICK-START.md)
- [Arquitetura](docs/architecture/OVERVIEW.md)
- [Providers WhatsApp](docs/setup/WHATSAPP-PROVIDERS.md)

## Riscos

Este projeto usa APIs nao oficiais do WhatsApp...

## Licenca

MIT
```

### 2. CONTRIBUTING.md

```markdown
# Contribuindo

## Setup de Desenvolvimento

1. Fork o repositorio
2. Clone seu fork
3. Instale dependencias: `npm install`
4. Copie `.env.example` para `.env`
5. Inicie Redis: `docker-compose up redis -d`
6. Rode: `npm run dev`

## Commits

Usamos Conventional Commits:

- `feat:` Nova feature
- `fix:` Bug fix
- `docs:` Documentacao
- `refactor:` Refatoracao
- `test:` Testes

## Pull Requests

1. Crie uma branch: `git checkout -b feat/minha-feature`
2. Faca commits
3. Push: `git push origin feat/minha-feature`
4. Abra um PR

## Testes

\`\`\`bash
npm test
npm run lint
\`\`\`
```

### 3. docs/setup/WHATSAPP-PROVIDERS.md

```markdown
# Providers de WhatsApp

Este projeto suporta multiplos providers de WhatsApp.

## Evolution API (Recomendado para self-host)

Open source, pode rodar localmente.

\`\`\`env
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-api-key
EVOLUTION_INSTANCE=meu-bot
\`\`\`

**Setup:**
\`\`\`bash
docker run -d --name evolution \\
  -p 8080:8080 \\
  atendai/evolution-api:latest
\`\`\`

## Z-API (SaaS)

Servico pago, mais estavel.

\`\`\`env
WHATSAPP_PROVIDER=zapi
ZAPI_INSTANCE_ID=xxx
ZAPI_TOKEN=xxx
ZAPI_CLIENT_TOKEN=xxx
\`\`\`

## Aviso

Todos esses providers usam engenharia reversa do WhatsApp Web.
Isso viola os Termos de Servico e pode resultar em ban.
```

---

## Tarefas

### Prioridade Alta

- [ ] Criar script de sanitizacao automatica
- [ ] Reescrever README.md
- [ ] Criar docker-compose.yml para dev
- [ ] Criar .env.example completo
- [ ] Remover API keys dos docs
- [ ] Remover IPs e URLs especificas

### Prioridade Media

- [ ] Criar CONTRIBUTING.md
- [ ] Criar docs/setup/QUICK-START.md
- [ ] Criar docs/setup/WHATSAPP-PROVIDERS.md
- [ ] Simplificar CI/CD (remover deploy automatico)
- [ ] Criar schema.sql inicial

### Prioridade Baixa

- [ ] Adicionar badges ao README
- [ ] Criar GitHub issue templates
- [ ] Configurar GitHub Discussions
- [ ] Adicionar screenshots/GIFs de demo

---

## Decisoes de Arquitetura

### 1. Manter ou Remover Doppler?

**Decisao:** Manter como opcao, adicionar `.env` como alternativa

**Justificativa:**
- Doppler e otimo mas proprietario
- Maioria dos devs usa `.env`
- Documentar ambos os metodos

### 2. Manter ou Remover Admin Panel?

**Decisao:** Manter como opcional

**Justificativa:**
- Adiciona valor ao projeto
- Pode ser ignorado se nao precisar
- Documentar como "opcional"

### 3. Qual licenca usar?

**Decisao:** MIT (ja configurado no package.json)

**Justificativa:**
- Mais permissiva
- Padrao da industria
- Permite uso comercial

### 4. Manter historico de commits?

**Decisao:** Sim, mas limpar secrets se houver

**Justificativa:**
- Historico mostra evolucao do projeto
- Usar git-filter-repo se precisar limpar secrets
- Alternativa: squash tudo em um commit inicial

---

## Comandos Uteis

### Buscar secrets no codigo

```bash
# API keys
grep -r "apikey" --include="*.ts" --include="*.md" src/ docs/

# IPs
grep -rE "\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b" docs/

# URLs especificas
grep -r "ytem.com" --include="*.ts" --include="*.md" .

# Supabase project IDs
grep -r "supabase.co" --include="*.ts" --include="*.md" .
```

### Limpar historico git (se necessario)

```bash
# Instalar git-filter-repo
brew install git-filter-repo

# Remover arquivo com secrets do historico
git filter-repo --path secrets.json --invert-paths

# Remover string especifica de todo historico
git filter-repo --replace-text <(echo 'API_KEY_AQUI==>REMOVED')
```

---

## Timeline Estimada

| Fase | Duracao | Descricao |
|------|---------|-----------|
| 1 | 2-3h | Sanitizacao de docs e codigo |
| 2 | 1-2h | Criar docker-compose e .env.example |
| 3 | 2-3h | Reescrever README e docs de setup |
| 4 | 1h | Simplificar CI/CD |
| 5 | 1h | Review final e publicacao |

**Total estimado:** 7-10 horas

---

## Referencias

- [GitHub: Making a repo public](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [git-filter-repo](https://github.com/newren/git-filter-repo)
- [Choose a License](https://choosealicense.com/)
- [Evolution API](https://github.com/EvolutionAPI/evolution-api)

---

**Ultima atualizacao:** 2026-01-22
**Autor:** Paulo Henrique
