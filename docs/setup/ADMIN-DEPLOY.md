# 🎨 Deploy Rápido - Admin Panel

**Guia definitivo para deploy do painel administrativo**

**URL Produção**: https://admin-your-domain.com

---

## ✅ Processo Correto (SEMPRE use este)

### Passo a Passo

```bash
# 1. Modificar código no admin panel
cd admin-panel
# Editar arquivos em src/app/, src/components/, etc.

# 2. Testar localmente (OPCIONAL)
doppler run -- npm run dev
# Abre http://localhost:3001

# 3. Voltar para raiz do projeto
cd ..

# 4. Commit das mudanças
git add admin-panel/
git commit -m "fix(admin): descrição da mudança"

# 5. Push para main → Deploy automático
git push origin main

# 6. Acompanhar deploy no GitHub Actions
# https://github.com/your-username/sticker/actions
# Workflow: "Deploy Sticker Admin"

# 7. Verificar produção (após 2-3 minutos)
# https://admin-your-domain.com
```

**Tempo total**: ~2-3 minutos (automático)

---

## ❌ NÃO FAÇA ISSO (Erros Comuns)

### ❌ NUNCA use Vercel

```bash
# ❌ ERRADO - Não está configurado!
npx vercel --prod
vercel deploy

# ✅ CORRETO - Use git push
git push origin main
```

### ❌ NUNCA esqueça de commitar

```bash
# ❌ ERRADO - Só fez push sem commit
git push origin main  # Nada acontece!

# ✅ CORRETO - Commit primeiro
git add admin-panel/
git commit -m "fix(admin): mudança"
git push origin main
```

### ❌ NUNCA faça deploy manual

O admin panel **NÃO tem** deploy manual. Sempre use GitHub Actions.

---

## 🔍 Como Funciona (Internamente)

### Trigger Automático

O workflow `.github/workflows/deploy-admin.yml` roda quando:
- ✅ Push na branch `main` **E**
- ✅ Arquivos modificados em `admin-panel/**`

**Exemplo**:
```bash
# Esse commit dispara deploy do admin
git add admin-panel/src/app/page.tsx
git commit -m "fix(admin): ajustar layout"
git push origin main
# → GitHub Actions detecta mudança em admin-panel/**
# → Executa deploy-admin.yml

# Esse commit NÃO dispara deploy do admin (só backend)
git add src/routes/webhook.ts
git commit -m "fix(backend): corrigir webhook"
git push origin main
# → GitHub Actions detecta mudança em src/**
# → Executa deploy-sticker.yml (não admin)
```

### Passos do Deploy (Automático)

```
1. GitHub Actions inicia workflow
   ↓
2. Checkout do código
   ↓
3. Build Docker image (Next.js)
   - Usa SUPABASE_URL e SUPABASE_ANON_KEY como build args
   ↓
4. Push para ghcr.io/your-username/sticker-admin:latest
   ↓
5. SSH na VPS
   ↓
6. Docker service update (zero-downtime)
   - Service: sticker_admin
   - Traefik route: admin-your-domain.com
   ↓
7. Verificação de saúde
   ↓
8. ✅ Deploy concluído
```

---

## 📊 Monitoramento do Deploy

### Ver Status em Tempo Real

```bash
# Opção 1: GitHub UI
# https://github.com/your-username/sticker/actions
# Clica no workflow "Deploy Sticker Admin"

# Opção 2: Via CLI
gh run list --workflow="Deploy Sticker Admin" --limit 3

# Opção 3: Acompanhar workflow rodando
gh run watch
```

### Verificar Logs na VPS

```bash
# Logs do serviço admin
~/bin/vps-ssh "docker service logs --tail 50 sticker_admin"

# Logs em tempo real
~/bin/vps-ssh "docker service logs -f sticker_admin"

# Status do serviço
~/bin/vps-ssh "docker service ps sticker_admin"
```

### Health Check

```bash
# Verificar se admin está respondendo
curl -I https://admin-your-domain.com

# Deve retornar:
# HTTP/2 200 OK
```

---

## 🆘 Troubleshooting

### Problema: Deploy não inicia

**Sintoma**: Fez push mas workflow não aparece em Actions

**Causa**: Mudanças não estavam em `admin-panel/**`

**Solução**:
```bash
# Verificar se commitou arquivos do admin
git log -1 --stat | grep admin-panel

# Se não aparecer, arquivos não estavam staged
git add admin-panel/
git commit --amend --no-edit
git push --force origin main
```

---

### Problema: Deploy falha no build

**Sintoma**: Workflow falha no step "Build and push Docker image"

**Causas comuns**:
- Erro de TypeScript no código
- Dependência faltando em package.json
- Variável de ambiente faltando

**Solução**:
```bash
# Testar build localmente primeiro
cd admin-panel
npm run build

# Se falhar localmente, corrigir e tentar novamente
```

---

### Problema: Admin mostra código antigo

**Sintoma**: Deploy passou mas admin ainda mostra versão antiga

**Causa**: Cache do browser ou deploy não aplicou

**Solução**:
```bash
# 1. Hard refresh no browser (Ctrl+Shift+R ou Cmd+Shift+R)

# 2. Se não resolver, forçar update do serviço
~/bin/vps-ssh "docker service update --force sticker_admin"

# 3. Verificar imagem atual
~/bin/vps-ssh "docker service inspect sticker_admin --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'"
```

---

### Problema: Admin retorna 502 Bad Gateway

**Sintoma**: https://admin-your-domain.com mostra erro 502

**Causa**: Container não está rodando ou falhou ao iniciar

**Solução**:
```bash
# 1. Ver status do serviço
~/bin/vps-ssh "docker service ps sticker_admin --no-trunc"

# 2. Ver logs para encontrar erro
~/bin/vps-ssh "docker service logs --tail 100 sticker_admin"

# 3. Se necessário, rollback
~/bin/vps-ssh "docker service update --rollback sticker_admin"
```

---

## 🔄 Rollback (Desfazer Deploy)

Se o deploy causou problemas:

```bash
# Rollback automático via Docker Swarm
~/bin/vps-ssh "docker service update --rollback sticker_admin"

# Verificar que voltou
curl -I https://admin-your-domain.com
```

**O rollback retorna para a versão anterior imediatamente.**

---

## 🧪 Testes Antes do Deploy

### Rodar Testes Playwright (Recomendado)

```bash
cd admin-panel

# Rodar todos os testes
npm run test

# Rodar teste específico
npx playwright test tests/login.spec.ts

# Ver relatório
npx playwright show-report
```

### Build Local (Rápido)

```bash
cd admin-panel

# Build de produção
npm run build

# Se passar, pode fazer deploy com confiança
```

---

## 📋 Checklist de Deploy

Antes de fazer push:

- [ ] Código testado localmente (`doppler run -- npm run dev`)
- [ ] Build passa (`doppler run -- npm run build`)
- [ ] Testes passam (`npm run test`) - se tiver
- [ ] Commit message claro e descritivo
- [ ] Arquivos corretos staged (`git status`)

Durante deploy:

- [ ] Workflow iniciou no GitHub Actions
- [ ] Build passou
- [ ] Deploy para VPS passou
- [ ] Health check passou

Após deploy:

- [ ] Admin abre em https://admin-your-domain.com
- [ ] Login funciona
- [ ] Funcionalidades testadas manualmente
- [ ] Sem erros no console do browser

---

## 🎯 Exemplos Reais

### Deploy de Correção de Bug

```bash
# 1. Fix no código
cd admin-panel
code src/app/(dashboard)/users/page.tsx

# 2. Testar
doppler run -- npm run dev
# Verificar que bug foi corrigido

# 3. Commit e deploy
cd ..
git add admin-panel/src/app/(dashboard)/users/page.tsx
git commit -m "fix(admin): corrigir filtro de usuários"
git push origin main

# 4. Aguardar deploy (~2-3 min)
# 5. Verificar em produção
```

### Deploy de Nova Feature

```bash
# 1. Implementar feature
cd admin-panel
code src/app/(dashboard)/new-feature/page.tsx

# 2. Adicionar ao menu
code src/components/layout/sidebar.tsx

# 3. Testar localmente
doppler run -- npm run dev

# 4. Build de produção para garantir
doppler run -- npm run build

# 5. Commit e deploy
cd ..
git add admin-panel/
git commit -m "feat(admin): adicionar página de nova feature"
git push origin main

# 6. Monitorar deploy
gh run watch

# 7. Testar em produção
```

### Deploy de Correções de Texto (Como fizemos hoje)

```bash
# 1. Corrigir textos
cd admin-panel
# Buscar e substituir "Usuarios" → "Usuários"

# 2. Commit e deploy
cd ..
git add admin-panel/src
git commit -m "fix(admin): corrigir acentuação em português"
git push origin main

# Deploy automático!
```

---

## 📚 Referências

- **Workflow completo**: `.github/workflows/deploy-admin.yml`
- **CI/CD Overview**: [CI-CD-WORKFLOW.md](./CI-CD-WORKFLOW.md)
- **Backend deploy**: [QUICK-DEPLOY.md](./QUICK-DEPLOY.md)
- **Setup inicial**: [GITHUB-ACTIONS-SETUP.md](./GITHUB-ACTIONS-SETUP.md)

---

## 🔑 Comandos Essenciais (Cole e Use)

```bash
# Deploy completo (processo normal)
git add admin-panel/
git commit -m "fix(admin): descrição"
git push origin main

# Ver status do último deploy
gh run list --workflow="Deploy Sticker Admin" --limit 1

# Ver logs em produção
~/bin/vps-ssh "docker service logs --tail 50 sticker_admin"

# Rollback se necessário
~/bin/vps-ssh "docker service update --rollback sticker_admin"
```

---

**Última atualização**: 2026-01-09
**Versão**: 1.0
**Responsável**: Sistema de Deploy Automatizado
