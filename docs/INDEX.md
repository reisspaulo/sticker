# 📚 Documentação do Sticker Bot

> Índice completo da documentação organizada por tema

---

## 🚀 Começar Aqui

| Documento | Descrição |
|-----------|-----------|
| [**Guia de Operações**](operations/QUICK-CHANGES-GUIDE.md) | Como acessar VPS, ver logs, troubleshooting |
| [**CI/CD Workflow**](setup/CI-CD-WORKFLOW.md) | Como fazer deploy (git push → produção) |
| [**Admin Panel Deploy**](ADMIN_PANEL_DEPLOYMENT.md) | ⭐ Checklist obrigatório para deploy do Admin Panel |
| [**CHANGELOG**](../CHANGELOG.md) | Registro de todas as mudanças do projeto |
| [**Regras de Negócio**](business/BUSINESS_RULES.md) | 85+ regras do bot documentadas |

---

## 📁 Estrutura da Documentação

### 🔧 Operações (`operations/`)

Guias para o dia-a-dia de operações e manutenção.

| Documento | Descrição |
|-----------|-----------|
| [QUICK-CHANGES-GUIDE.md](operations/QUICK-CHANGES-GUIDE.md) | **Principal** - Acesso VPS, logs Docker, logs Supabase, troubleshooting |
| [MONITORING.md](operations/MONITORING.md) | Sistema de monitoramento e alertas |
| [TROUBLESHOOTING.md](operations/TROUBLESHOOTING.md) | Solução de problemas comuns |

---

### ⚙️ Setup e Deploy (`setup/`)

Configuração inicial e processos de deploy.

| Documento | Descrição |
|-----------|-----------|
| [CI-CD-WORKFLOW.md](setup/CI-CD-WORKFLOW.md) | **Recomendado** - Deploy automatizado via GitHub Actions |
| [DEPLOYMENT-PROCESS.md](setup/DEPLOYMENT-PROCESS.md) | Deploy manual (backup/emergência) |
| [DOPPLER-SETUP.md](setup/DOPPLER-SETUP.md) | Configuração de secrets no Doppler |
| [PRODUCTION-SETUP.md](setup/PRODUCTION-SETUP.md) | Setup completo de produção |
| [CLOUDFLARE-DNS-SETUP.md](setup/CLOUDFLARE-DNS-SETUP.md) | Configuração de DNS |
| [GITHUB-ACTIONS-SETUP.md](setup/GITHUB-ACTIONS-SETUP.md) | Setup inicial do CI/CD |
| [QUICK-DEPLOY.md](setup/QUICK-DEPLOY.md) | Comandos rápidos de deploy |
| [CONFIGURACAO.md](setup/CONFIGURACAO.md) | Configurações gerais |
| [SUPABASE_MCP_SETUP.md](setup/SUPABASE_MCP_SETUP.md) | Setup do Supabase MCP |

---

### 🏗️ Arquitetura (`architecture/`)

Documentação técnica e de planejamento.

| Documento | Descrição |
|-----------|-----------|
| [ARCHITECTURE.md](architecture/ARCHITECTURE.md) | Visão geral da arquitetura |
| [ARQUITETURA_360.md](architecture/ARQUITETURA_360.md) | Arquitetura detalhada |
| [PRD-BOT-STICKERS.md](architecture/PRD-BOT-STICKERS.md) | Product Requirements Document |
| [DEVELOPMENT-STRATEGY.md](architecture/DEVELOPMENT-STRATEGY.md) | Estratégia de desenvolvimento |

---

### ✨ Features (`features/`)

Documentação das funcionalidades do bot.

| Documento | Descrição |
|-----------|-----------|
| [STICKERS.md](features/STICKERS.md) | Como funcionam os stickers |
| [STICKERS_ANIMADOS.md](features/STICKERS_ANIMADOS.md) | Stickers animados (GIF/vídeo) |
| [TWITTER-VIDEO-DOWNLOAD.md](features/TWITTER-VIDEO-DOWNLOAD.md) | Download de vídeos do Twitter |
| [TWITTER-DOWNLOAD-QUICKREF.md](features/TWITTER-DOWNLOAD-QUICKREF.md) | Referência rápida Twitter |
| [TWITTER_FEATURE_USAGE.md](features/TWITTER_FEATURE_USAGE.md) | Uso da feature Twitter |
| [PENDING_STICKERS.md](features/PENDING_STICKERS.md) | Sistema de stickers pendentes |
| [VIDEO-SELECTION-IMPLEMENTATION.md](features/VIDEO-SELECTION-IMPLEMENTATION.md) | Seleção de qualidade de vídeo |
| [BACKGROUND-REMOVAL-RESEARCH.md](features/BACKGROUND-REMOVAL-RESEARCH.md) | Pesquisa: remoção de fundo |
| [TIKTOK-RESEARCH.md](features/TIKTOK-RESEARCH.md) | Pesquisa: integração TikTok |
| [FUTURE-FEATURES.md](features/FUTURE-FEATURES.md) | Features futuras planejadas |

---

### 📡 Meta Cloud API (WhatsApp Oficial)

Documentação da API oficial da Meta, usada em produção.

| Documento | Descrição |
|-----------|-----------|
| [**MIGRACAO-META-CLOUD-API.md**](MIGRACAO-META-CLOUD-API.md) | Guia completo de migração para Meta Cloud API |
| [**META-SETUP-CHECKLIST.md**](META-SETUP-CHECKLIST.md) | Checklist rápido de onboarding Meta |
| [**META-TEMPLATES.md**](META-TEMPLATES.md) | Templates de mensagem (janela 24h) |
| [**README-MIGRACAO.md**](README-MIGRACAO.md) | Status atual da migração |
| [ENDPOINT-MAPPING.md](ENDPOINT-MAPPING.md) | Mapeamento de endpoints legado → Meta |
| [REAPROVEITAMENTO-BANCO-E-MENSAGENS.md](REAPROVEITAMENTO-BANCO-E-MENSAGENS.md) | Reuso de banco e mensagens na migração |

---

### 🔌 Integrações (`integrations/`)

APIs e serviços externos (legado - ver Meta Cloud API acima para provider atual).

| Documento | Descrição |
|-----------|-----------|
| [AVISA_API_DOCS.md](integrations/AVISA_API_DOCS.md) | ⚠️ Legado - API de WhatsApp (Avisa) |
| [ABACATEPAY-IMPLEMENTATION.md](integrations/ABACATEPAY-IMPLEMENTATION.md) | Integração de pagamentos |
| [ENDPOINTS.md](integrations/ENDPOINTS.md) | ⚠️ Legado - Endpoints Evolution API |
| [Z-API_MIGRATION.md](integrations/Z-API_MIGRATION.md) | ⚠️ Legado - Migração Z-API |

---

### 💼 Negócio (`business/`)

Regras e lógica de negócio.

| Documento | Descrição |
|-----------|-----------|
| [BUSINESS_RULES.md](business/BUSINESS_RULES.md) | 85+ regras de negócio documentadas |

---

### 📅 Sprints (`sprints/`)

Histórico de desenvolvimento.

| Documento | Descrição |
|-----------|-----------|
| [**SPRINT-22-META-CLOUD-API-MIGRATION.md**](sprints/SPRINT-22-META-CLOUD-API-MIGRATION.md) | **Sprint 22 - Migração Meta Cloud API** (ATUAL) |
| [SPRINT-1-SUMMARY.md](sprints/SPRINT-1-SUMMARY.md) | Sprint 1 - Infraestrutura |
| [SPRINT-2-SUMMARY.md](sprints/SPRINT-2-SUMMARY.md) | Sprint 2 - Webhook |
| [SPRINTS-4-7-SUMMARY.md](sprints/SPRINTS-4-7-SUMMARY.md) | Sprints 4-7 - Features core |
| [SPRINT_8_SUMMARY.md](sprints/SPRINT_8_SUMMARY.md) | Sprint 8 - Deploy VPS |
| [SPRINT-9-SUMMARY.md](sprints/SPRINT-9-SUMMARY.md) | Sprint 9 - Twitter |
| [SPRINT-11-README.md](sprints/SPRINT-11-README.md) | Sprint 11 - Melhorias |

---

### 🎯 Decisões Arquiteturais (`decisions/`)

ADRs (Architecture Decision Records) - Por quê tomamos cada decisão.

| Documento | Descrição |
|-----------|-----------|
| [auth-architecture-fix.md](decisions/auth-architecture-fix.md) | ⭐ Fix da autenticação do Admin Panel (2026-01-11) |
| [Outros ADRs](decisions/) | Decisões arquiteturais documentadas |

---

### 📦 Arquivados (`archive/`)

Documentos antigos ou obsoletos.

| Documento | Descrição |
|-----------|-----------|
| [QUICKSTART.md](archive/QUICKSTART.md) | Quick start antigo (desatualizado) |
| [INDEX-OLD.md](archive/INDEX-OLD.md) | Índice antigo |
| [DOCUMENTATION-UPDATES.md](archive/DOCUMENTATION-UPDATES.md) | Atualizações de docs |
| [*-SUCCESS.md](archive/) | Registros de configurações concluídas |

---

## 🔑 Links Rápidos

### Dashboards

| Serviço | URL |
|---------|-----|
| **Admin Panel** | https://admin-your-domain.com/ |
| Supabase | https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID |
| GitHub Actions | https://github.com/your-username/sticker/actions |
| Doppler | https://dashboard.doppler.com |

### Endpoints

| Endpoint | URL |
|----------|-----|
| **Admin Panel** | https://admin-your-domain.com/ |
| Health Check | https://your-domain.com/health |
| Webhook | https://your-domain.com/webhook |
| ~~Evolution API~~ | ⚠️ Legado - desativado |

### Comandos VPS

```bash
# Acessar VPS
vps-ssh

# Ver logs
vps-ssh "docker service logs sticker_backend --tail 50"

# Status dos serviços
vps-ssh "docker service ls | grep sticker"
```

---

## 📊 Status do Projeto

| Componente | Status |
|------------|--------|
| **Meta Cloud API** | 🔄 Código pronto, registro de número pendente |
| **Admin Panel** | ✅ Desenvolvimento (queries funcionando) |
| Backend (Fastify) | ✅ Produção |
| Worker (BullMQ) | ✅ Produção |
| Stickers estáticos | ✅ Funcionando |
| Stickers animados | ✅ Funcionando |
| Download Twitter | ✅ Funcionando |
| Sistema de créditos | ✅ Funcionando |
| CI/CD (GitHub Actions) | ✅ Automatizado |
| Monitoramento | ✅ Ativo |
| Templates Meta (janela 24h) | ✅ Implementado |
| Evolution/Avisa/Z-API | ⚠️ Legado - sendo removidos |

---

## 🆕 Atualizações Recentes

### 2026-03-12 - Migração Meta Cloud API
- [MIGRACAO-META-CLOUD-API.md](MIGRACAO-META-CLOUD-API.md) - Guia completo de migração
- [META-SETUP-CHECKLIST.md](META-SETUP-CHECKLIST.md) - Checklist de onboarding
- [META-TEMPLATES.md](META-TEMPLATES.md) - Templates para janela 24h
- [README-MIGRACAO.md](README-MIGRACAO.md) - Status da migração

### 2026-01-11 - Admin Panel & Infra
- [CHANGELOG.md](../CHANGELOG.md) - Registro de todas as mudanças
- [ADMIN_PANEL_DEPLOYMENT.md](ADMIN_PANEL_DEPLOYMENT.md) - Checklist de deploy do admin panel
- [FEATURE_TEMPLATE.md](FEATURE_TEMPLATE.md) - Template para documentar novas features
- [decisions/auth-architecture-fix.md](decisions/auth-architecture-fix.md) - Fix da autenticação

---

**Última atualização:** 12/03/2026
