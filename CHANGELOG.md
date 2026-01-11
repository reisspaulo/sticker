# 📝 Changelog - Sticker Project

Todas as mudanças notáveis neste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Não Publicado]

### Admin Panel

#### 🔐 Segurança - 2026-01-11

**Implementado:** Setup completo do Doppler para admin-panel

**O que foi feito:**
- ✅ Criado `admin-panel/doppler.yaml` (config: sticker/dev)
- ✅ Criado script de setup: `admin-panel/setup-doppler.sh`
- ✅ Atualizado `admin-panel/README.md` com instruções completas do Doppler
- ✅ Atualizado `admin-panel/.env.example` referenciando Doppler
- ✅ Reforçado `admin-panel/.gitignore` para bloquear todos .env variants
- ✅ Atualizados todos os docs para usar `doppler run -- npm run dev`

**Documentos Atualizados:**
- `docs/setup/ADMIN-DEPLOY.md` - Todas referências de npm run dev → doppler run
- `docs/QUICK_REFERENCE.md` - Comandos e rollback corrigidos
- `admin-panel/README.md` - README completo com setup Doppler

**Desenvolvimento Local:**
```bash
cd admin-panel
doppler setup  # Project: sticker, Config: dev
doppler run -- npm run dev
```

**⚠️ AÇÃO NECESSÁRIA:**
O arquivo `admin-panel/.env.local` contém credenciais reais e **DEVE SER REMOVIDO**.
Antes de remover:
1. Verifique que as credenciais estão no Doppler
2. Teste que `doppler run -- npm run dev` funciona
3. Delete: `rm admin-panel/.env.local`

**Status:** ⚠️ Aguardando remoção de .env.local

#### ✅ Corrigido - 2026-01-11

**Problema:** Autenticação e queries não funcionando no admin panel (https://admin-stickers.ytem.com.br)
- Loop infinito (React Error #185)
- Queries travando
- Multiple GoTrueClient instances
- Redirect não funcionando

**Solução:** Implementado padrão do monitoring system
- Migrado para `@supabase/ssr` com singleton correto
- Substituído React Context por Zustand para gerenciamento de estado
- Implementado middleware simplificado
- Criado sistema de autenticação com cookies (SSR-compatible)
- Login com redirect manual usando `window.location.href`

**Arquivos Modificados:**
- `admin-panel/src/lib/supabase/client.ts` - Cliente browser (singleton)
- `admin-panel/src/lib/supabase/server.ts` - Cliente server
- `admin-panel/src/hooks/useAuth.ts` - Hook Zustand
- `admin-panel/middleware.ts` - Proteção de rotas
- `admin-panel/src/app/login/page.tsx` - Login com redirect
- `admin-panel/src/components/auth/AuthProvider.tsx` - Inicialização
- `admin-panel/src/app/providers.tsx` - Wrapper

**Documentação:**
- `docs/decisions/auth-architecture-fix.md` - ADR completo

**Resultado dos Testes:**
```
✅ Login funcionando perfeitamente
✅ 9 API requests executados
✅ 30 imagens de stickers carregadas
✅ Queries retornando dados (200/206)
```

**Status:** ✅ Testado em desenvolvimento
**Deploy Produção:** ⏳ Pendente

---

## [1.0.0] - Data do último deploy em produção

### Backend (Bot Stickers)

#### Adicionado
- Sistema de stickers estáticos
- Sistema de stickers animados
- Download de vídeos do Twitter
- Sistema de créditos
- CI/CD com GitHub Actions

#### Status
- ✅ Backend (Fastify): Produção
- ✅ Worker (BullMQ): Produção
- ✅ Stickers estáticos: Funcionando
- ✅ Stickers animados: Funcionando
- ✅ Download Twitter: Funcionando
- ✅ Sistema de créditos: Funcionando
- ✅ CI/CD: Automatizado
- ✅ Monitoramento: Ativo

---

## Como Usar Este Changelog

### Quando Adicionar uma Entrada

**SEMPRE** adicione uma entrada quando:
- 🆕 **Adicionar** uma nova feature
- 🔧 **Corrigir** um bug
- 🔄 **Modificar** comportamento existente
- 🗑️ **Remover** uma funcionalidade
- 🔐 **Segurança** - vulnerabilidades
- 🚀 **Deploy** para produção

### Categorias

- **Adicionado** - Novas features
- **Modificado** - Mudanças em features existentes
- **Depreciado** - Features que serão removidas
- **Removido** - Features removidas
- **Corrigido** - Bugs corrigidos
- **Segurança** - Vulnerabilidades corrigidas

### Template de Entrada

```markdown
#### Categoria - YYYY-MM-DD

**Descrição curta**
- Detalhe 1
- Detalhe 2

**Arquivos Modificados:**
- `caminho/arquivo1.ts`
- `caminho/arquivo2.ts`

**Documentação:**
- `docs/decisions/xxx.md`

**Status:** ✅ Testado / ⏳ Pendente / 🚀 Em Produção
```

---

## Links Rápidos

- [Documentação](./docs/INDEX.md)
- [Guia de Deploy](./docs/setup/CI-CD-WORKFLOW.md)
- [Decisões Arquiteturais](./docs/decisions/)
- [Admin Panel](https://admin-stickers.ytem.com.br/)
- [Bot Backend](https://stickers.ytem.com.br/)

---

**Última Atualização:** 2026-01-11
