# 🧪 Scripts de Teste - Admin Panel

Este diretório contém scripts para testar o admin panel com autenticação real.

## Scripts Disponíveis

### 1. `test-authenticated-flow.js` ⭐ RECOMENDADO

Testa o fluxo completo de autenticação através da UI.

**O que faz:**
- ✅ Abre o browser em modo visual
- ✅ Navega para `/login`
- ✅ Preenche email e senha
- ✅ Clica no botão de login
- ✅ Aguarda redirect para dashboard
- ✅ Navega para `/stickers`
- ✅ Monitora todas as queries Supabase
- ✅ Valida que dados carregam
- ✅ Gera relatório completo

**Como usar:**

```bash
# 1. Editar o script e preencher a senha (linha 74)
# Abra test-authenticated-flow.js e substitua 'SUA_SENHA_AQUI' pela senha real

# 2. Executar o script
node test-authenticated-flow.js
```

**Vantagens:**
- Testa o fluxo real que o usuário vai usar
- Visual e fácil de debugar
- Mais próximo do comportamento em produção

---

### 2. `test-programmatic-login.js` ⚡ AVANÇADO

Faz login via REST API do Supabase (mais rápido, sem UI).

**O que faz:**
- ⚡ Faz login via API REST do Supabase
- ⚡ Injeta a sessão diretamente no localStorage
- ⚡ Navega para `/stickers` já autenticado
- ⚡ Monitora queries e valida dados

**Como usar:**

```bash
# 1. Editar o script e preencher a senha (linha 54)
# Abra test-programmatic-login.js e substitua 'SUA_SENHA_AQUI' pela senha real

# 2. Executar com Doppler (precisa das env vars)
doppler run -- node test-programmatic-login.js
```

**Vantagens:**
- Mais rápido (não preenche formulário)
- Mais confiável (sem flakiness de UI)
- Pode ser reutilizado em múltiplos testes
- Útil para CI/CD

---

## 📋 Pré-requisitos

Ambos os scripts precisam:

1. **Playwright instalado**
   ```bash
   npm install playwright
   ```

2. **Dev server rodando**
   ```bash
   cd admin-panel
   doppler run -- npm run dev
   ```

3. **Credenciais válidas**
   - Email: `test@example.com` (já configurado)
   - Senha: Você precisa preencher nos scripts

---

## 🔍 O Que os Scripts Testam

### ✅ Checklist de Validação

- [ ] Login funciona
- [ ] Redirect após login funciona
- [ ] Middleware não bloqueia usuário autenticado
- [ ] Página `/stickers` carrega
- [ ] Hook `useStickers` é chamado
- [ ] Query Supabase é executada
- [ ] API retorna status 200/206
- [ ] Dados são recebidos (count > 0)
- [ ] Stickers são renderizados na tela
- [ ] Sem erros no console

### 📊 Monitoramento

Os scripts monitoram:

```
📤 API REQUEST: GET /rest/v1/stickers
📥 API RESPONSE: ✅ 206 /rest/v1/stickers
   📊 0-29/1993
```

E console logs:

```
📊 [BROWSER] 🔍 fetchStickers CALLED with options: {...}
📊 [BROWSER] 🔍 Executando query...
📊 [BROWSER] 🔍 Query completou!
```

---

## 🐛 Troubleshooting

### "Por favor, preencha a senha real no script!"

**Causa:** Você não editou o script para adicionar a senha.

**Solução:**
1. Abra o script em um editor
2. Encontre a linha: `const PASSWORD = 'SUA_SENHA_AQUI'`
3. Substitua por: `const PASSWORD = 'sua_senha_real'`
4. Salve e rode novamente

---

### "Variáveis de ambiente não encontradas"

**Causa:** Script `test-programmatic-login.js` precisa das env vars do Doppler.

**Solução:**
```bash
# Use doppler run
doppler run -- node test-programmatic-login.js

# Ou exporte as variáveis
export NEXT_PUBLIC_SUPABASE_URL="https://..."
export NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
node test-programmatic-login.js
```

---

### "Login falhou ou timeout no redirect"

**Possíveis causas:**
1. Senha incorreta
2. Email incorreto
3. Dev server não está rodando
4. Credenciais expiradas no Supabase

**Solução:**
1. Verifique as credenciais no banco
2. Confirme que dev server está em http://localhost:3000
3. Verifique se não há erros no console do dev server

---

### "Nenhuma query para /stickers foi executada"

**Possíveis causas:**
1. Middleware ainda está bloqueando
2. Sessão não foi configurada corretamente
3. Página não renderizou

**Debug:**
- Verifique se vê "✅ Login bem-sucedido" nos logs
- Confirme que o redirect para `/` aconteceu
- Veja se middleware está permitindo acesso

---

## 🎯 Próximos Passos

Depois de confirmar que os testes passam:

1. ✅ **Limpar código de debug**
   - Remover console.logs excessivos em `useStickers.ts`
   - Remover páginas de teste (`/test-*`)

2. ✅ **Commit das correções**
   ```bash
   git add admin-panel/src/utils/supabase/
   git add admin-panel/src/hooks/
   git add docs/decisions/supabase-ssr-implementation.md
   git commit -m "fix(admin): implement @supabase/ssr correctly"
   ```

3. ✅ **Deploy em produção**
   - Todas as variáveis já existem no Doppler prd
   - Middleware está configurado corretamente
   - Queries funcionam normalmente

---

## 📚 Referências

- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Playwright Testing](https://playwright.dev/docs/intro)
- [Login via REST API (mokkapps)](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test)
