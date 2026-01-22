# 🎨 Sticker Bot - WhatsApp Sticker Generator

> Bot de WhatsApp para criação de figurinhas a partir de imagens, vídeos e links do Twitter/TikTok

**Produção:** https://your-domain.com

---

## 🚀 Quick Start

### Para Desenvolvedores

```bash
# 1. Clonar e instalar
git clone https://github.com/your-username/sticker.git
cd sticker
npm install

# 2. Configurar ambiente
cp .env.example .env
# Editar .env com suas credenciais

# 3. Rodar localmente
npm run dev
```

### Para Deploy

```bash
# Deploy automático via CI/CD
git add .
git commit -m "feat: nova funcionalidade"
git push origin main
# Pronto! Deploy automático em ~2-3 minutos
```

---

## 📚 Documentação

### Guias Principais

| Documento | Descrição |
|-----------|-----------|
| [Guia de Operações](docs/operations/QUICK-CHANGES-GUIDE.md) | **Como acessar VPS, ver logs, troubleshooting** |
| [CI/CD Workflow](docs/setup/CI-CD-WORKFLOW.md) | **Como fazer deploy (git push → produção)** |
| [Regras de Negócio](docs/business/BUSINESS_RULES.md) | Todas as regras do bot |

### Documentação Completa

```
docs/
├── operations/              # 🔧 Operações do dia-a-dia
│   ├── QUICK-CHANGES-GUIDE.md   # Acesso VPS, logs, troubleshooting
│   ├── MONITORING.md            # Monitoramento e alertas
│   └── TROUBLESHOOTING.md       # Solução de problemas
│
├── setup/                   # ⚙️ Configuração e Deploy
│   ├── CI-CD-WORKFLOW.md        # Deploy automatizado (recomendado)
│   ├── DEPLOYMENT-PROCESS.md    # Deploy manual (emergência)
│   ├── DOPPLER-SETUP.md         # Configuração de secrets
│   └── PRODUCTION-SETUP.md      # Setup de produção
│
├── architecture/            # 🏗️ Arquitetura
│   ├── ARCHITECTURE.md          # Visão geral do sistema
│   ├── ARQUITETURA_360.md       # Arquitetura detalhada
│   └── PRD-BOT-STICKERS.md      # Product Requirements
│
├── features/                # ✨ Funcionalidades
│   ├── STICKERS.md              # Como funcionam os stickers
│   ├── STICKERS_ANIMADOS.md     # Stickers animados (GIF/vídeo)
│   ├── TWITTER-VIDEO-DOWNLOAD.md # Download de vídeos do Twitter
│   └── PENDING_STICKERS.md      # Sistema de stickers pendentes
│
├── integrations/            # 🔌 Integrações
│   ├── AVISA_API_DOCS.md        # API de WhatsApp (Avisa)
│   ├── ABACATEPAY-IMPLEMENTATION.md # Pagamentos
│   └── ENDPOINTS.md             # Endpoints do bot
│
├── business/                # 💼 Negócio
│   └── BUSINESS_RULES.md        # 85+ regras de negócio
│
├── sprints/                 # 📅 Histórico de sprints
│   └── SPRINT-*.md              # Resumos de cada sprint
│
├── images/                  # 🖼️ Imagens da documentação
└── archive/                 # 📦 Docs arquivados
```

---

## 🛠️ Scripts

```
scripts/
├── database/                # 🗄️ Banco de dados
│   ├── migrations/              # Migrações SQL
│   ├── analytics*.sql           # Queries de analytics
│   └── apply-migration.ts       # Aplicar migrações
│
├── deploy/                  # 🚀 Deploy
│   ├── build-and-push.sh        # Build e push de imagem
│   └── add-doppler-secrets.sh   # Configurar secrets
│
├── tests/                   # 🧪 Testes
│   └── test-*.ts/sh             # 22 arquivos de teste
│
├── tools/                   # 🔧 Utilitários
│   ├── health-check.ts          # Verificar saúde do sistema
│   ├── add-celebrity.sh         # Adicionar celebridades
│   └── collect-avisa-*.ts       # Coletar docs da API
│
├── examples/                # 💡 Exemplos
│   ├── enviar-sticker.py        # Enviar sticker via Python
│   └── exemplo-sticker.sh       # Exemplo em shell
│
└── local/                   # 💻 Desenvolvimento local
    ├── start-local.sh           # Iniciar ambiente local
    └── stop-local.sh            # Parar ambiente local
```

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     VPS (YOUR_VPS_IP)                      │
│                     Docker Swarm Stack                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Backend    │  │    Worker    │  │  Evolution API  │   │
│  │   (Fastify)  │  │   (BullMQ)   │  │  (wa.ytem.com)  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘   │
│         │                  │                   │             │
│         └──────────┬───────┴───────────────────┘             │
│                    │                                         │
│         ┌──────────▼────────────┐                           │
│         │  Redis (ytem-redis)   │                           │
│         └───────────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Supabase (Cloud)      │
              │  - PostgreSQL          │
              │  - Storage (S3)        │
              └────────────────────────┘
```

### Serviços

| Serviço | URL | Função |
|---------|-----|--------|
| Backend | https://your-domain.com | API REST + Webhooks |
| Worker | - | Processa filas BullMQ |
| Evolution API | https://your-evolution-api.com | Integração WhatsApp |
| Supabase | YOUR_SUPABASE_PROJECT_ID.supabase.co | Banco + Storage |

---

## 🔑 Acessos Rápidos

### VPS

```bash
# Acessar VPS (requer Doppler configurado)
vps-ssh

# Ver logs do backend
vps-ssh "docker service logs sticker_backend --tail 50"

# Ver status dos serviços
vps-ssh "docker service ls | grep sticker"
```

### URLs Importantes

| Recurso | URL |
|---------|-----|
| Health Check | https://your-domain.com/health |
| Supabase Dashboard | https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID |
| GitHub Actions | https://github.com/your-username/sticker/actions |
| Doppler Secrets | https://dashboard.doppler.com |

---

## 📦 Tech Stack

| Tecnologia | Uso |
|------------|-----|
| **TypeScript** | Linguagem principal |
| **Fastify** | API REST |
| **BullMQ** | Filas de processamento |
| **Sharp** | Processamento de imagens |
| **FFmpeg** | Processamento de vídeos |
| **Supabase** | Banco de dados + Storage |
| **Redis** | Cache + Filas |
| **Docker Swarm** | Orquestração |
| **GitHub Actions** | CI/CD |
| **Doppler** | Gerenciamento de secrets |

---

## 📝 Licença

Projeto privado.

---

**Última atualização:** 07/01/2026
