# 🎨 Admin Panel - Sticker Project

Painel administrativo para gerenciar stickers, emoções e celebridades.

## 📋 Índice

- [Desenvolvimento Local](#-desenvolvimento-local)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Deploy](#-deploy)
- [Troubleshooting](#-troubleshooting)

## 🚀 Desenvolvimento Local

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Doppler CLI instalado ([instruções](../../docs/setup/DOPPLER-SETUP.md))

### Setup Inicial

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configure o Doppler:**
   ```bash
   doppler setup
   # Selecione:
   # Project: sticker
   # Config: dev
   ```

3. **Verifique as variáveis de ambiente:**
   ```bash
   doppler secrets
   ```

### Rodar Localmente

```bash
doppler run -- npm run dev
```

⚠️ **IMPORTANTE:** NUNCA rode `npm run dev` diretamente! Sempre use Doppler.

O painel estará disponível em [http://localhost:3000](http://localhost:3000).

### Por que usar Doppler?

✅ **Benefícios:**
- Sem arquivos `.env` com credenciais reais no repositório
- Mesmo ambiente para todos os desenvolvedores
- Rotação de secrets centralizada
- Auditoria de acesso a credenciais

❌ **Evite:**
- ~~`npm run dev`~~ (não terá as variáveis de ambiente)
- ~~Criar arquivo `.env.local`~~ (risco de vazamento)
- ~~Commitar credenciais~~ (bloqueado pelo pre-commit hook)

## 📁 Estrutura do Projeto

```
admin-panel/
├── src/
│   ├── app/              # App Router do Next.js 16
│   │   ├── (dashboard)/  # Layout autenticado
│   │   └── login/        # Página de login
│   ├── components/       # Componentes React
│   │   ├── stickers/     # Componentes específicos de stickers
│   │   └── ui/           # Componentes reutilizáveis
│   ├── hooks/            # Custom hooks
│   │   ├── useBatchActions.ts
│   │   └── useStickers.ts
│   ├── lib/              # Configurações
│   │   ├── auth.tsx      # AuthProvider com Zustand
│   │   └── supabase.ts   # Cliente Supabase singleton
│   └── stores/           # Zustand stores
├── public/               # Assets estáticos
├── doppler.yaml          # Configuração do Doppler
└── package.json
```

### Tecnologias Principais

- **Framework:** Next.js 16 (App Router)
- **Autenticação:** Supabase Auth com @supabase/ssr
- **State Management:** Zustand
- **UI:** TailwindCSS + shadcn/ui
- **Secrets:** Doppler

## 🚢 Deploy

O deploy é automatizado via GitHub Actions.

### Processo de Deploy

1. **Desenvolvimento:**
   ```bash
   doppler run -- npm run dev
   # Teste suas mudanças
   ```

2. **Build Local (opcional):**
   ```bash
   doppler run -- npm run build
   ```

3. **Commit e Push:**
   ```bash
   git add .
   git commit -m "feat: sua feature"
   git push origin main
   ```

4. **GitHub Actions:**
   - Build da imagem Docker
   - Injeta secrets do GitHub como build-args
   - Deploy no VPS via Docker Swarm

### Variáveis de Ambiente

**Desenvolvimento:** Doppler (`config: dev`)
```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Produção:** GitHub Secrets → Docker build-args
- Configurado em: `.github/workflows/deploy-admin.yml`
- Gerenciado em: GitHub Repository Settings → Secrets

📚 **Documentação completa:** [docs/setup/ADMIN-DEPLOY.md](../../docs/setup/ADMIN-DEPLOY.md)

## 🔧 Troubleshooting

### Erro: "Missing environment variables"

```bash
# Verifique se o Doppler está configurado:
doppler setup

# Liste as variáveis disponíveis:
doppler secrets

# Se estiver vazio, configure os secrets:
doppler secrets set NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
doppler secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-chave"
```

### Erro: "Multiple GoTrueClient instances detected"

Este erro foi corrigido na migração para @supabase/ssr. Se ainda ocorrer:

1. Verifique se está usando o singleton correto em `src/lib/supabase.ts`
2. Não crie novos clientes Supabase fora de `createClient()`
3. Use `useAuth()` hook para acessar autenticação

📚 **Mais detalhes:** [docs/decisions/supabase-ssr-implementation.md](../../docs/decisions/supabase-ssr-implementation.md)

### Build falhando no CI/CD

1. Verifique os logs no GitHub Actions
2. Confirme que os secrets estão configurados:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Teste o build localmente: `doppler run -- npm run build`

### Queries travando ou loop infinito

Verifique os hooks `useStickers.ts` e `useBatchActions.ts`:
- Options do React Query devem estar memoizadas
- Não recrie objetos em cada render
- Use `useMemo` ou `useCallback` quando necessário

## 📚 Documentação Adicional

- [🚀 Deploy Guide](../../docs/setup/ADMIN-DEPLOY.md) - Guia completo de deploy
- [🔐 Doppler Setup](../../docs/setup/DOPPLER-SETUP.md) - Configuração do Doppler
- [📝 Changelog](../../CHANGELOG.md) - Histórico de mudanças
- [🏗️ Architecture](../../docs/INDEX.md) - Documentação arquitetural

## 🆘 Precisa de Ajuda?

1. Consulte o [QUICK_REFERENCE.md](../../docs/QUICK_REFERENCE.md) para comandos comuns
2. Verifique os logs: `doppler run -- npm run dev` (modo verbose)
3. Revise o [Troubleshooting Guide](../../docs/ADMIN_PANEL_DEPLOYMENT.md#-troubleshooting)

---

**⚡ Lembre-se:** Sempre use `doppler run -- npm run dev` para desenvolvimento!
