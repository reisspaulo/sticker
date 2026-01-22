# ⚡ Referência Rápida - Sticker Project

Comandos e processos mais usados no dia-a-dia.

---

## 🚀 Deploy

### Admin Panel

```bash
# 1. Testar localmente
cd admin-panel
doppler run -- npm run dev

# 2. Verificar build
doppler run -- npm run build

# 3. Commit (pre-commit hook valida automaticamente)
cd ..
git add admin-panel/
git commit -m "feat(admin): descrição"
git push origin main

# 4. Deploy automático via GitHub Actions
# Aguardar 2-3 minutos
# Verificar: https://admin-your-domain.com
```

**Checklist rápido:**
- ✅ Login funciona?
- ✅ Queries executam?
- ✅ CHANGELOG atualizado?

**Docs:** [ADMIN_PANEL_DEPLOYMENT.md](ADMIN_PANEL_DEPLOYMENT.md)

### Backend (Bot)

```bash
# Via CI/CD (recomendado)
git push origin main

# Manual (emergência)
vps-ssh "cd /path/to/project && git pull && docker service update sticker_backend"
```

**Docs:** [CI-CD-WORKFLOW.md](setup/CI-CD-WORKFLOW.md)

---

## 🔍 Troubleshooting

### Admin Panel não carrega

```bash
# 1. Verificar logs do Supabase
# Acessar: https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/logs

# 2. Testar localmente
cd admin-panel
doppler run -- npm run dev

# 3. Verificar middleware
# Ver: admin-panel/middleware.ts

# 4. Verificar RLS policies
# Acessar: https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/auth/policies
```

### Queries não executam

```bash
# 1. Browser DevTools > Network tab
# Verificar se requests são feitos para Supabase

# 2. Console do browser
# Procurar por erros ou warnings

# 3. Verificar cookies
# Application tab > Cookies > localhost:3000
# Deve ter cookies do Supabase
```

### Bot não responde

```bash
# 1. Ver logs
vps-ssh "docker service logs sticker_backend --tail 50 -f"

# 2. Ver status
vps-ssh "docker service ls | grep sticker"

# 3. Health check
curl https://your-domain.com/health
```

**Docs:** [QUICK-CHANGES-GUIDE.md](operations/QUICK-CHANGES-GUIDE.md)

---

## 📝 Documentação

### Adicionar nova feature

```bash
# 1. Criar branch
git checkout -b feature/nome-feature

# 2. Implementar e testar

# 3. Documentar
# - Atualizar CHANGELOG.md
# - Se decisão importante, criar ADR em docs/decisions/
# - Seguir template: docs/FEATURE_TEMPLATE.md

# 4. Commit
git add .
git commit -m "feat: descrição"
# Pre-commit hook vai validar automaticamente

# 5. Push e PR
git push origin feature/nome-feature
```

### Atualizar documentação existente

```bash
# Principais docs para manter atualizados:
- CHANGELOG.md                          # TODAS as mudanças
- docs/INDEX.md                         # Índice geral
- docs/ADMIN_PANEL_DEPLOYMENT.md        # Checklist de deploy
- docs/architecture/FLOWCHARTS.md       # Fluxos do bot
- docs/decisions/                       # ADRs
```

---

## 🔧 Comandos Úteis

### Admin Panel

```bash
# Dev server
doppler run -- npm run dev

# Build
doppler run -- npm run build

# Linter
npm run lint

# Type check
npx tsc --noEmit
```

### Backend

```bash
# Dev local
doppler run -- npm run dev

# Ver logs VPS
vps-ssh "docker service logs sticker_backend --tail 50"

# Restart service
vps-ssh "docker service update --force sticker_backend"

# Ver status
vps-ssh "docker service ls | grep sticker"
```

### Git

```bash
# Ver status com warnings do pre-commit
git status

# Commit (ativa pre-commit hook automaticamente)
git commit -m "type(scope): description"

# Bypass pre-commit (USE COM CUIDADO)
git commit --no-verify -m "message"

# Ver histórico
git log --oneline -10
```

---

## 🔑 Links Importantes

| Recurso | URL |
|---------|-----|
| **Admin Panel** | https://admin-your-domain.com/ |
| **Bot Backend** | https://your-domain.com/ |
| Supabase Dashboard | https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID |
| GitHub Actions | https://github.com/your-username/sticker/actions |
| Doppler | https://dashboard.doppler.com |

---

## 📚 Documentação Completa

| Documento | Quando Usar |
|-----------|-------------|
| [INDEX.md](INDEX.md) | Índice completo de toda documentação |
| [CHANGELOG.md](../CHANGELOG.md) | Ver histórico de mudanças |
| [ADMIN_PANEL_DEPLOYMENT.md](ADMIN_PANEL_DEPLOYMENT.md) | Deploy do admin panel |
| [CI-CD-WORKFLOW.md](setup/CI-CD-WORKFLOW.md) | Deploy do backend |
| [DOCUMENTATION_GUIDE.md](DOCUMENTATION_GUIDE.md) | Como manter docs atualizadas |
| [FEATURE_TEMPLATE.md](FEATURE_TEMPLATE.md) | Template para novas features |
| [decisions/](decisions/) | Decisões arquiteturais (ADRs) |

---

## 🆘 Emergência

### Rollback Rápido

**Admin Panel:**
```bash
# Via Docker Swarm (VPS)
vps-ssh "docker service update --rollback sticker_admin"
```

**Backend:**
```bash
# Via Docker Swarm (VPS)
vps-ssh "docker service update --rollback sticker_backend"
```

### Contatos

- **Desenvolvedor Principal:** [Nome]
- **Email:** [email]
- **Slack/Discord:** [canal]

---

## 🎯 Pre-commit Hook

O pre-commit hook **automaticamente valida**:
- ✅ Nenhum secret no código
- ✅ Nenhum arquivo .env commitado
- ✅ Documentação atualizada (para arquivos críticos)
- ✅ CHANGELOG atualizado (mudanças no admin panel)

**Arquivos monitorados:**
- Admin Panel: `lib/supabase/*`, `middleware.ts`, `hooks/useAuth.ts`, `app/login/*`
- Backend: `routes/webhook.ts`, `services/menuService.ts`, `worker.ts`, `config/queue.ts`

---

**Última Atualização:** 2026-01-11
**Versão:** 1.0
