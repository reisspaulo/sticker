# 📝 Changelog - Sticker Project

Todas as mudanças notáveis neste projeto serão documentadas aqui.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Não Publicado]

### Backend (Bot Stickers)

#### 🐛 Corrigido Bug Crítico - Mensagens de Limite Não Enviadas - 2026-01-12

**Problema:** Usuários que atingiam o limite diário de stickers não recebiam a mensagem com planos de upgrade.

**Root Cause:** A função PostgreSQL `set_limit_notified_atomic` tinha um parâmetro `OUT was_already_notified boolean` que fazia o PostgreSQL retornar um objeto `{"was_already_notified": false}` ao invés de um boolean simples. Como JavaScript trata objetos como truthy, a condição `if (!wasAlreadyNotified)` era sempre falsa.

**Correção em Duas Camadas:**

1. **Runtime validation** (`src/rpc/client.ts`):
   - Detecta quando PostgreSQL retorna RECORD ao invés de primitivo
   - Auto-extrai o valor de objetos com uma única propriedade
   - Loga warning para alertar sobre funções que precisam ser corrigidas

2. **PostgreSQL fix** (`scripts/database/migrations/fix-set-limit-notified-atomic.sql`):
   - Removido parâmetro OUT da função
   - Função agora retorna boolean diretamente

**Usuários Afetados Identificados:**
- Lost. (c01cd1d1-b659-467f-a65c-b4e0c725fc11)
- 𓃮✩𝓙᥆ᥲ᥆ 𝓟ᥱძr᥆✩𓃮 (4b72efa1-160d-47da-9c83-79e308c12327)

**Arquivos Modificados:**
- `src/rpc/client.ts` - Validação runtime para SCALAR RPCs
- `scripts/database/migrations/fix-set-limit-notified-atomic.sql` - Migração PostgreSQL

**Documentação:**
- `docs/sprints/SPRINT-14-RPC-TYPE-SAFE.md` - Seção "Limitações Conhecidas" atualizada

**Status:** ✅ Corrigido em produção

---

### Admin Panel

#### 🎨 Melhorias de UX e Correções - 2026-01-12

**Implementado:** Melhorias de interface, correções de português e date picker

**Navegação:**
- Adicionado link "Avançado" no menu Analytics
- Adicionado link "Ranking" no menu Usuários

**Date Picker com Calendário:**
- Novo componente `DatePickerWithRange` para seleção de período
- Presets de período (7, 14, 30, 60, 90 dias)
- Calendário duplo para seleção de data exata
- Implementado em Analytics Avançado e Ranking de Usuários

**Correções de Português:**
- Corrigidos acentos em todas as páginas do admin panel
- Páginas afetadas: layout, dashboard, analytics (todas), users, funnel, experiments, ranking

**UI:**
- Cor do gráfico "Novos Usuários" alterada de preto para amarelo (melhor visibilidade)

**Arquivos Adicionados:**
- `admin-panel/src/components/ui/date-picker.tsx`

**Arquivos Modificados:**
- `admin-panel/src/components/layout/sidebar.tsx`
- `admin-panel/src/app/(dashboard)/page.tsx`
- `admin-panel/src/app/(dashboard)/analytics/advanced/page.tsx`
- `admin-panel/src/app/(dashboard)/analytics/funnel/page.tsx`
- `admin-panel/src/app/(dashboard)/analytics/experiments/page.tsx`
- `admin-panel/src/app/(dashboard)/users/[id]/page.tsx`
- `admin-panel/src/app/(dashboard)/users/ranking/page.tsx`
- `admin-panel/src/components/charts/activity-heatmap.tsx`
- `admin-panel/src/app/layout.tsx`

#### 📊 Analytics Avançado e Ranking de Usuários - 2026-01-12

**Implementado:** Páginas de analytics avançado com heatmaps e ranking de usuários

**Novas Páginas:**
- `/analytics/advanced` - Heatmaps, análise por hora, retenção por coorte
- `/users/ranking` - Top usuários com filtros por plano (free, premium, ultra)

**Analytics Avançado:**
- Heatmap hora x dia da semana (stickers e cadastros)
- Métricas por hora do dia
- Tempo até primeiro sticker (distribuição)
- Retenção por coorte (D1, D7, D30)
- Identificação de picos de uso

**Ranking de Usuários:**
- Top 100 usuários por uso no período
- Filtros por plano (free, premium, ultra)
- Ordenação por stickers, frequência, última atividade
- Estatísticas por plano (média stickers, frequência média)
- Busca por número ou nome

#### ✨ Sprint 16 - Sistema de Treinamento de Celebridades - 2026-01-12

**Implementado:** Sistema completo para treinar reconhecimento facial de celebridades via Admin Panel

**Funcionalidades:**
- Upload de fotos de referência para celebridades
- Botão "Treinar" que dispara treinamento no VPS
- Polling em tempo real do status de treinamento
- Botão "Reprocessar" para processar stickers não reconhecidos após novo treinamento
- Contagem de stickers aguardando reconhecimento

**Arquivos Adicionados:**
- `admin-panel/src/app/api/celebrities/[id]/train/route.ts` - API para treinar via VPS
- `admin-panel/src/app/api/celebrities/[id]/reprocess/route.ts` - API para reprocessar stickers
- `admin-panel/src/hooks/useTrainingStatus.ts` - Hook para polling de status
- `admin-panel/src/hooks/useReprocess.ts` - Hook para reprocessamento

**Arquivos Modificados:**
- `admin-panel/src/components/stickers/CelebrityDialog.tsx` - Seções de treino e reprocessamento
- `admin-panel/src/lib/supabase/client.ts` - Fix para build-time (typeof window check)
- `admin-panel/src/app/api/celebrities/[id]/photos/route.ts` - Lazy Supabase init
- `admin-panel/src/app/api/celebrities/[id]/photos/[photoId]/route.ts` - Lazy Supabase init

**Documentação:**
- `docs/sprints/SPRINT-16-CELEBRITY-TRAINING.md` - PRD atualizado com fases concluídas

**VPS (já deployado):**
- FastAPI server na porta 8765 (`/opt/face-recognition/api/`)
- Endpoint `/train` para iniciar treinamento
- Worker que baixa fotos do Supabase e gera embeddings

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

**Problema:** Autenticação e queries não funcionando no admin panel (https://admin-your-domain.com)
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
- [Admin Panel](https://admin-your-domain.com/)
- [Bot Backend](https://your-domain.com/)

---

**Última Atualização:** 2026-01-12
