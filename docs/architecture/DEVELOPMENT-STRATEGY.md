# 🎯 Estratégia de Desenvolvimento - Sticker Bot

**Data:** 26/12/2025
**Status:** Desenvolvimento Local → Produção VPS (Sprint 8)

---

## 📋 Resumo Executivo

**Decisão:** Desenvolver e testar **TUDO LOCALMENTE** antes de mover para produção.

**Motivo:** Validar funcionalidades sem riscos antes de deploy em produção.

---

## 🏗️ Arquitetura Atual

### **Fase 1: Desenvolvimento Local** (Sprints 2-7) ← ESTAMOS AQUI

```
┌─────────────────────────────────────────────┐
│         Mac Local (localhost)               │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │     Evolution API (Docker Compose)    │ │
│  │  - evolution_api:8080                 │ │
│  │  - evolution_postgres:5432            │ │
│  │  - evolution_redis:6379               │ │
│  │  - evolution_manager:3001             │ │
│  └────────────┬──────────────────────────┘ │
│               │ (webhook)                  │
│               ↓                            │
│  ┌───────────────────────────────────────┐ │
│  │     Sticker Bot (npm run dev)         │ │
│  │  - Backend: localhost:3000            │ │
│  │  - Worker: npm run dev:worker         │ │
│  └───────────────────────────────────────┘ │
│               ↓                            │
│  ┌───────────────────────────────────────┐ │
│  │   Supabase Cloud                      │ │
│  │  - PostgreSQL (tabelas)               │ │
│  │  - Storage (buckets)                  │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Componentes:**
- ✅ **Evolution API:** `docker-compose up -d` (local)
- ✅ **Sticker Bot:** `npm run dev` (local)
- ✅ **Supabase:** Cloud (já em produção)
- ✅ **Redis:** Container local (compartilhado)

**URLs:**
- Evolution API: `http://localhost:8080`
- Evolution Manager: `http://localhost:3001`
- Sticker Bot: `http://localhost:3000`
- Webhook: `http://localhost:3000/webhook`

---

### **Fase 2: Produção Completa** (Sprint 8) ← FUTURO

```
┌─────────────────────────────────────────────────┐
│              VPS (157.230.50.63)                │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │         Traefik (Reverse Proxy)          │  │
│  │  - SSL Automático (Let's Encrypt)        │  │
│  │  - your-evolution-api.com → evolution_api        │  │
│  │  - your-domain.com → sticker_backend│  │
│  └──────────────┬───────────────────────────┘  │
│                 │                               │
│  ┌──────────────┴───────────────────────────┐  │
│  │        Docker Swarm Network              │  │
│  │                                          │  │
│  │  ┌─────────────────┐  ┌───────────────┐ │  │
│  │  │ evolution_api   │  │sticker_backend│ │  │
│  │  │ (WhatsApp)      │──│ (Fastify API) │ │  │
│  │  └─────────────────┘  └───────────────┘ │  │
│  │                                          │  │
│  │  ┌─────────────────┐  ┌───────────────┐ │  │
│  │  │evolution_postgres│ │sticker_worker │ │  │
│  │  │ (Dados WhatsApp)│  │  (BullMQ)     │ │  │
│  │  └─────────────────┘  └───────────────┘ │  │
│  │                                          │  │
│  │  ┌─────────────────┐                    │  │
│  │  │ evolution_redis │                    │  │
│  │  │ (Cache + Filas) │                    │  │
│  │  └─────────────────┘                    │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
           ↑                    ↑
           │                    │
    WhatsApp Web          Supabase Cloud
    (conexão WSS)        (PostgreSQL + Storage)
```

**Componentes:**
- ✅ **Evolution API:** Docker Swarm na VPS
- ✅ **Sticker Bot:** Docker Swarm na VPS
- ✅ **Supabase:** Cloud (mesmo)
- ✅ **Redis:** Container na VPS
- ✅ **Traefik:** SSL automático

**URLs:**
- Evolution API: `https://your-evolution-api.com`
- Sticker Bot: `https://your-domain.com`
- Webhook: `https://your-domain.com/webhook`

---

## 📁 Estrutura de Arquivos

### **Diretório Atual:** `/Users/paulohenrique/sticker/`

```
sticker/
├── .env                        # ⚠️ Evolution API configs (não commitar)
├── .env.example                # ✅ Template Sticker Bot
├── .gitignore                  # ✅ Ignora .env e secrets
│
├── docker-compose.yml          # ⚠️ Evolution API (local)
├── docker-compose.bot.yml      # ✅ Sticker Bot (local dev)
│
├── src/                        # ✅ Código do Sticker Bot
│   ├── config/
│   ├── routes/
│   ├── server.ts
│   └── worker.ts
│
├── deploy/                     # ✅ Deploy files (VPS)
│   ├── stack-sticker.yml       # Sticker Bot (Docker Swarm)
│   ├── deploy-sticker.sh       # Deploy script
│   ├── DEPLOYMENT-GUIDE.md
│   ├── DOPPLER-SETUP.md
│   └── CLOUDFLARE-DNS-SETUP.md
│
├── Dockerfile                  # ✅ Sticker Bot image
├── package.json                # ✅ Dependencies
├── tsconfig.json               # ✅ TypeScript config
│
├── PRD-BOT-STICKERS.md         # ✅ Product Requirements
├── DEVELOPMENT-STRATEGY.md     # ✅ Este arquivo
├── SPRINT-1-SUMMARY.md         # ✅ Sprint 1 resumo
├── DOPPLER-SUCCESS.md          # ✅ Doppler setup
├── CLOUDFLARE-DNS-SUCCESS.md   # ✅ DNS setup
└── README-SETUP.md             # ✅ Setup guide
```

**Observações:**
- ⚠️ `.env` é da **Evolution API** (não do Sticker Bot!)
- ✅ Sticker Bot usa **Doppler** (sem .env em produção)
- ✅ `.env` está no `.gitignore` (não será commitado)

---

## 🚀 Roadmap de Desenvolvimento

### **Sprint 1: Infraestrutura Base** ✅ COMPLETA

**Status:** ✅ 100% Concluída (26/12/2025)

**O que foi feito:**
- [x] Projeto Node.js + TypeScript configurado
- [x] Supabase configurado (tabelas + storage)
- [x] Redis + BullMQ configurado
- [x] Doppler configurado (7/7 secrets)
- [x] DNS Cloudflare configurado (your-domain.com)
- [x] Estrutura de deployment criada
- [x] Documentação completa

**Ambiente:** LOCAL
- Evolution API: Rodando local (docker-compose)
- Sticker Bot: Código pronto, ainda não rodando

---

### **Sprint 2: Webhook & Detecção** ⏳ PRÓXIMA

**Status:** ⏳ Pendente

**Objetivo:** Receber webhooks e detectar tipos de mensagem

**Ambiente:** LOCAL
- Evolution API: localhost:8080
- Sticker Bot: localhost:3000
- Webhook: `http://localhost:3000/webhook`

**Tarefas:**
- [ ] Implementar endpoint `/webhook`
- [ ] Detectar imageMessage vs videoMessage
- [ ] Validar formato e tamanho
- [ ] Retornar erros personalizados
- [ ] Configurar webhook na Evolution Manager

**Como testar:**
1. `docker-compose up -d` (Evolution API)
2. `npm run dev` (Sticker Bot backend)
3. `npm run dev:worker` (Sticker Bot worker)
4. Configurar webhook no Evolution Manager: `http://localhost:3000/webhook`
5. Enviar imagem via WhatsApp
6. Verificar logs do Sticker Bot

---

### **Sprints 3-7: Desenvolvimento Completo** ⏳ FUTURO

**Ambiente:** LOCAL (Evolution + Sticker Bot)

**Sprints:**
- Sprint 3: Stickers Estáticos (Sharp)
- Sprint 4: Stickers Animados (FFmpeg)
- Sprint 5: Limite Diário + CRM
- Sprint 6: Jobs Agendados
- Sprint 7: Testes + Monitoramento

**Critério de Sucesso:**
- ✅ Todas as funcionalidades testadas localmente
- ✅ Testes unitários passando
- ✅ Testes de integração passando
- ✅ Bot funcionando 100% em ambiente de desenvolvimento

---

### **Sprint 8: Deploy Produção Completo** 🎯 FINAL

**Status:** ⏳ Aguardando Sprints 2-7

**Objetivo:** Mover TUDO para VPS (Evolution + Sticker Bot)

**Ambiente:** VPS (157.230.50.63)

**Tarefas:**
- [ ] Criar stack file Evolution API
- [ ] Configurar DNS `your-evolution-api.com`
- [ ] Migrar dados WhatsApp (sessions + PostgreSQL)
- [ ] Deploy Evolution na VPS
- [ ] Deploy Sticker Bot na VPS
- [ ] Integrar via Docker network
- [ ] Configurar SSL automático (Traefik)
- [ ] Testes end-to-end em produção

**Critério de Sucesso:**
- ✅ Sistema rodando 24/7
- ✅ Independente do Mac
- ✅ SSL em tudo
- ✅ WhatsApp estável

---

## 🔐 Secrets Management

### **Development (Local)**

```bash
# Evolution API (.env file)
AUTHENTICATION_API_KEY=YOUR_EVOLUTION_API_KEY
DATABASE_CONNECTION_URI=postgresql://evolution:evolution_password@postgres:5432/evolution
CACHE_REDIS_URI=redis://redis:6379

# Sticker Bot (Doppler - config dev)
doppler run npm run dev
```

**Secrets no Doppler (dev):**
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- REDIS_URL=redis://localhost:6379
- EVOLUTION_API_URL=http://localhost:8080
- EVOLUTION_API_KEY
- EVOLUTION_INSTANCE
- LOG_LEVEL=debug

---

### **Production (VPS)**

```bash
# Evolution API (Doppler - config prd)
# Novos secrets a serem adicionados na Sprint 8

# Sticker Bot (Doppler - config prd)
SUPABASE_URL (mesmo)
SUPABASE_SERVICE_KEY (mesmo)
REDIS_URL=redis://redis:6379 (Docker network)
EVOLUTION_API_URL=http://evolution_api:8080 (Docker network)
EVOLUTION_API_KEY (mesmo)
EVOLUTION_INSTANCE (mesmo)
LOG_LEVEL=info
```

---

## 🧪 Como Testar Localmente

### **1. Iniciar Evolution API**

```bash
cd /Users/paulohenrique/sticker

# Iniciar todos os containers
docker-compose up -d

# Verificar se está rodando
docker ps

# Ver logs
docker logs -f evolution_api
```

**Acessar:**
- API: http://localhost:8080
- Manager: http://localhost:3001

### **2. Iniciar Sticker Bot**

```bash
cd /Users/paulohenrique/sticker

# Terminal 1 - Backend
doppler run --project sticker --config dev npm run dev

# Terminal 2 - Worker
doppler run --project sticker --config dev npm run dev:worker
```

**Acessar:**
- Health Check: http://localhost:3000/health
- Ping: http://localhost:3000/ping

### **3. Configurar Webhook**

1. Acesse: http://localhost:3001
2. Login com credenciais Evolution
3. Instâncias → Selecionar instância
4. Webhook → Configurar:
   - URL: `http://localhost:3000/webhook`
   - Events: `MESSAGES_UPSERT`
5. Salvar

### **4. Testar Fluxo Completo**

```bash
# 1. Enviar imagem via WhatsApp
# 2. Ver logs do backend
docker logs -f sticker_bot_backend

# 3. Ver logs do worker
docker logs -f sticker_bot_worker

# 4. Verificar Supabase
# - Tabela stickers
# - Bucket stickers-estaticos
```

---

## ⚠️ Limitações do Ambiente Local

### **Desenvolvimento (Atual):**

**Funciona:**
- ✅ Receber webhooks da Evolution API
- ✅ Processar stickers
- ✅ Upload para Supabase
- ✅ Enviar stickers via Evolution API
- ✅ Jobs agendados (BullMQ)
- ✅ Testes unitários e integração

**NÃO Funciona:**
- ❌ **Produção 24/7** (Mac precisa estar ligado)
- ❌ **Alta disponibilidade** (se Mac desligar, WhatsApp desconecta)
- ❌ **SSL público** (apenas localhost)
- ❌ **DNS público** (apenas localhost)
- ❌ **Webhooks externos** (Evolution não recebe de fora do Mac)

---

## 🎯 Quando Mover para Produção?

**Depois que:**
1. ✅ Sprint 2 completa (webhooks funcionando)
2. ✅ Sprint 3 completa (stickers estáticos processando)
3. ✅ Sprint 4 completa (stickers animados processando)
4. ✅ Sprint 5 completa (limite diário + CRM funcionando)
5. ✅ Sprint 6 completa (jobs agendados rodando)
6. ✅ Sprint 7 completa (testes passando, monitoramento OK)

**Então:**
7. 🚀 **Sprint 8:** Mover Evolution + Sticker Bot para VPS

---

## 📊 Checklist de Progresso

### **Infraestrutura** ✅

- [x] TypeScript configurado
- [x] Supabase configurado
- [x] Doppler configurado (7/7 secrets)
- [x] DNS Cloudflare configurado
- [x] Evolution API rodando local
- [x] Documentação completa

### **Desenvolvimento** ⏳

- [ ] Sprint 2: Webhook & Detecção
- [ ] Sprint 3: Stickers Estáticos
- [ ] Sprint 4: Stickers Animados
- [ ] Sprint 5: Limite Diário + CRM
- [ ] Sprint 6: Jobs Agendados
- [ ] Sprint 7: Testes + Monitoramento

### **Produção** ⏳

- [ ] Sprint 8: Deploy Evolution para VPS
- [ ] Sprint 8: Deploy Sticker Bot para VPS
- [ ] Sprint 8: Integração completa
- [ ] Sprint 8: Testes end-to-end produção

---

## 🔄 Fluxo de Trabalho

```
┌─────────────────────────────────────────────┐
│  1. Desenvolver Sprint Localmente          │
│     - Evolution API: localhost:8080        │
│     - Sticker Bot: localhost:3000          │
│     - Testar integração                    │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│  2. Validar Funcionalidade                  │
│     - Testes unitários                      │
│     - Testes integração                     │
│     - Testar com WhatsApp real              │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│  3. Repetir para Sprints 2-7                │
│     - Cada sprint adiciona funcionalidade   │
│     - Sempre testando localmente            │
└──────────────┬──────────────────────────────┘
               ↓
┌─────────────────────────────────────────────┐
│  4. Sprint 8: Deploy Completo VPS           │
│     - Mover Evolution API                   │
│     - Mover Sticker Bot                     │
│     - Produção 24/7                         │
└─────────────────────────────────────────────┘
```

---

## 💡 Dicas Importantes

### **Durante Desenvolvimento:**

1. **Sempre use Doppler:**
   ```bash
   doppler run npm run dev
   ```
   Nunca hardcode secrets!

2. **Monitore logs:**
   ```bash
   # Evolution API
   docker logs -f evolution_api

   # Sticker Bot
   npm run dev  # já mostra logs
   ```

3. **Teste antes de commitar:**
   ```bash
   npm run build  # verifica TypeScript
   npm test       # roda testes (quando implementar)
   ```

4. **Backup instâncias WhatsApp:**
   ```bash
   # Fazer backup do volume ANTES de mover para VPS
   docker volume inspect evolution_instances
   ```

### **Antes de ir para Produção (Sprint 8):**

1. ✅ Todas as sprints testadas e funcionando
2. ✅ Testes unitários com coverage >70%
3. ✅ Documentação completa
4. ✅ Backup das instâncias WhatsApp
5. ✅ Doppler configurado com secrets de produção
6. ✅ DNS configurado (your-evolution-api.com)

---

## 📚 Documentação Relacionada

- **PRD Completo:** `PRD-BOT-STICKERS.md`
- **Setup Local:** `README-SETUP.md`
- **Deploy VPS:** `deploy/DEPLOYMENT-GUIDE.md`
- **Doppler:** `DOPPLER-SUCCESS.md`
- **DNS:** `CLOUDFLARE-DNS-SUCCESS.md`
- **Sprint 1:** `SPRINT-1-SUMMARY.md`

---

**Última atualização:** 26/12/2025
**Próximo passo:** Sprint 2 - Webhook & Detecção (desenvolvimento local)

---

*Documentado por: Claude Code*
