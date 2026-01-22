# 🚀 Admin Panel - Deployment Checklist

**URL:** https://admin-your-domain.com/

Este documento serve como checklist obrigatório para qualquer deploy do Admin Panel.

---

## ⚠️ REGRA DE OURO

**NUNCA faça deploy direto para produção sem testar localmente primeiro!**

---

## 📋 Checklist Pré-Deploy

### 1. ✅ Testes Locais

```bash
# 1. Instalar dependências
cd admin-panel
npm install

# 2. Rodar servidor local
doppler run -- npm run dev

# 3. Rodar testes automatizados (se existirem)
npm test

# 4. Verificar build de produção
npm run build
```

**Verificações Manuais:**
- [ ] Login funciona (https://admin-your-domain.com/login)
- [ ] Redirect após login funciona
- [ ] Página /stickers carrega dados
- [ ] Página /stickers/emotions carrega dados
- [ ] Página /stickers/celebrities carrega dados
- [ ] Logout funciona
- [ ] Middleware protege rotas corretamente
- [ ] Não há erros no console do browser
- [ ] Não há warnings críticos no terminal

### 2. ✅ Documentação

- [ ] `CHANGELOG.md` atualizado com as mudanças
- [ ] Se houver decisão arquitetural, criar ADR em `docs/decisions/`
- [ ] Se houver mudanças em autenticação, atualizar `docs/decisions/auth-architecture-fix.md`
- [ ] `README.md` do admin-panel atualizado (se necessário)

### 3. ✅ Código

- [ ] Sem `console.log()` de debug esquecidos (exceto logs importantes)
- [ ] Sem comentários `// TODO` ou `// FIXME` críticos
- [ ] Sem variáveis hardcoded (usar env vars)
- [ ] Código commitado e pushed para GitHub
- [ ] Branch está atualizada com `main` (ou branch de deploy)

### 4. ✅ Segurança

- [ ] Nenhum secret no código (usar Doppler)
- [ ] Variáveis de ambiente configuradas no Doppler
- [ ] RLS policies do Supabase configuradas
- [ ] Middleware protege todas as rotas necessárias
- [ ] Pre-commit hook passou sem erros

### 5. ✅ Performance

- [ ] Build de produção testado (`npm run build`)
- [ ] Imagens otimizadas
- [ ] Sem queries N+1 (verificar Network tab)
- [ ] Lazy loading implementado onde necessário

---

## 🚀 Processo de Deploy

### Opção 1: Deploy Automático (Recomendado)

Se configurado CI/CD:

```bash
# 1. Commit e push
git add .
git commit -m "feat(admin): descrição da mudança"
git push origin main

# 2. Verificar GitHub Actions
# Acessar: https://github.com/your-username/sticker/actions

# 3. Aguardar deploy automático
```

### Opção 2: Deploy Manual via Vercel CLI

```bash
# 1. Instalar Vercel CLI (se não tiver)
npm install -g vercel

# 2. Deploy de preview (testar antes)
cd admin-panel
vercel

# 3. Se preview OK, deploy para produção
vercel --prod
```

### Opção 3: Deploy Manual via VPS (Se aplicável)

```bash
# 1. SSH na VPS
ssh user@vps-ip

# 2. Navegar para o diretório
cd /path/to/admin-panel

# 3. Pull do código
git pull origin main

# 4. Instalar dependências
npm install

# 5. Build
npm run build

# 6. Reiniciar serviço
pm2 restart admin-panel
# ou
systemctl restart admin-panel
```

---

## 🧪 Testes Pós-Deploy

**Espere 2-3 minutos após deploy para propagação**

### Verificação Rápida (2 min)

1. **Acesse a URL:** https://admin-your-domain.com/
   - [ ] Página carrega sem erro
   - [ ] Redirect para /login funciona

2. **Login:**
   - [ ] Login com credenciais válidas funciona
   - [ ] Redirect para home após login
   - [ ] Sessão persiste após refresh

3. **Funcionalidades Principais:**
   - [ ] /stickers carrega lista de stickers
   - [ ] Imagens aparecem corretamente
   - [ ] Paginação funciona
   - [ ] Filtros funcionam (se aplicável)

### Verificação Completa (5 min)

4. **Todas as Páginas:**
   - [ ] / (home/dashboard)
   - [ ] /stickers
   - [ ] /stickers/emotions
   - [ ] /stickers/celebrities

5. **Funcionalidades Avançadas:**
   - [ ] Criar/editar sticker
   - [ ] Deletar sticker
   - [ ] Batch actions (se aplicável)
   - [ ] Upload de imagens

6. **Performance:**
   - [ ] Tempo de carregamento < 3s
   - [ ] Sem erros no console
   - [ ] Sem memory leaks (verificar DevTools)

### Verificação de Monitoramento

7. **Logs e Métricas:**
   - [ ] Verificar logs no Vercel/VPS
   - [ ] Verificar Supabase logs (se API errors)
   - [ ] Verificar métricas de performance

---

## ❌ Rollback Rápido

Se algo der errado:

### Via Vercel

```bash
# 1. Ver deployments
vercel ls

# 2. Promover deployment anterior
vercel promote <deployment-url>
```

### Via GitHub Actions

1. Ir para: https://github.com/your-username/sticker/actions
2. Encontrar último deploy bem-sucedido
3. Clicar "Re-run workflow"

### Via VPS

```bash
# 1. SSH na VPS
ssh user@vps-ip

# 2. Voltar para commit anterior
cd /path/to/admin-panel
git log --oneline -10
git reset --hard <commit-hash>

# 3. Rebuild e reiniciar
npm install
npm run build
pm2 restart admin-panel
```

---

## 📊 Checklist de Verificação Por Feature

### Autenticação

- [ ] Login funciona
- [ ] Logout funciona
- [ ] Redirect após login
- [ ] Sessão persiste
- [ ] Middleware protege rotas
- [ ] Mensagens de erro claras

### Queries/Data Fetching

- [ ] Queries executam
- [ ] Dados aparecem
- [ ] Loading states funcionam
- [ ] Error states funcionam
- [ ] Paginação funciona
- [ ] Filtros funcionam

### UI/UX

- [ ] Layout responsivo
- [ ] Cores e estilos corretos
- [ ] Sem UI glitches
- [ ] Transições suaves
- [ ] Feedback ao usuário (toasts, etc)

---

## 🔧 Troubleshooting Comum

### Problema: Queries não executam

**Sintomas:** Página em branco, loading infinito

**Verificar:**
1. Middleware logs: `console.log` no middleware.ts
2. Supabase logs: https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/logs
3. Browser DevTools > Network tab
4. RLS policies: https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/auth/policies

**Solução:**
- Verificar se cookies estão sendo salvos
- Verificar se sessão está disponível no middleware
- Verificar RLS policies do Supabase

### Problema: Login não redireciona

**Sintomas:** Login sucede mas fica na página de login

**Verificar:**
1. Middleware está ativo?
2. Cookies estão sendo salvos?
3. `window.location.href` está sendo chamado?

**Solução:**
- Verificar `middleware.ts:38` - `getSession()` retorna sessão?
- Verificar `login/page.tsx:32` - `window.location.href` é executado?

### Problema: Multiple GoTrueClient instances

**Sintomas:** Warning no console do browser

**Causa:** Múltiplas instâncias do Supabase client

**Solução:**
- Verificar `lib/supabase/client.ts` - singleton está implementado?
- Verificar se não há `createClient()` sendo chamado em múltiplos lugares

---

## 📝 Template de Commit de Deploy

```
feat(admin): <descrição curta>

Mudanças:
- <mudança 1>
- <mudança 2>

Checklist:
- [x] Testado localmente
- [x] Build passa
- [x] Documentação atualizada
- [x] Pre-commit hook passou

Relacionado: #<issue-number>
```

---

## 📞 Contatos de Emergência

**Se algo crítico quebrar em produção:**

1. **Imediato:** Fazer rollback (ver seção acima)
2. **Notificar:** [Adicionar contatos da equipe]
3. **Criar Issue:** GitHub com label "critical"
4. **Post-mortem:** Documentar em `docs/decisions/` o que aconteceu

---

## 📚 Referências

- [Documentação Geral](./INDEX.md)
- [Autenticação Fix](./decisions/auth-architecture-fix.md)
- [CHANGELOG](../CHANGELOG.md)
- [Supabase Dashboard](https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID)
- [Vercel Dashboard](https://vercel.com/dashboard) (se aplicável)

---

**Última Atualização:** 2026-01-11
**Versão:** 1.0
**Mantido por:** Time de Desenvolvimento
