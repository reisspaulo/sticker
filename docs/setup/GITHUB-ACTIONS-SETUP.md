# 🚀 GitHub Actions - Setup Guide

**Tempo estimado:** 10 minutos

---

## 📋 Checklist

- [ ] Criar GitHub Personal Access Token
- [ ] Adicionar secrets no GitHub
- [ ] Fazer primeiro deploy via GitHub Actions
- [ ] Escalar serviços para 2 réplicas na VPS
- [ ] Testar zero-downtime deployment

---

## 1️⃣ Criar GitHub Personal Access Token

### Por que preciso?

O `GITHUB_TOKEN` padrão do Actions **não** tem permissão para push em GHCR (GitHub Container Registry). Precisa criar um Personal Access Token (PAT) com a scope correta.

### Como criar:

```bash
# 1. Acessar: https://github.com/settings/tokens

# 2. Clicar em "Generate new token" → "Generate new token (classic)"

# 3. Configurar:
#    Nome: "Sticker Bot CI/CD"
#    Expiration: No expiration (ou 1 ano)
#
#    Scopes necessários:
#    ✅ write:packages  (push para GHCR)
#    ✅ read:packages   (pull do GHCR)
#    ✅ repo (se repositório privado)

# 4. Clicar em "Generate token"

# 5. COPIAR O TOKEN (só aparece uma vez!)
#    Formato: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **IMPORTANTE:** Salve o token em lugar seguro! Ele não aparece novamente.

---

## 2️⃣ Adicionar Secrets no GitHub

### Acessar configurações:

1. Ir para: https://github.com/reisspaulo/sticker/settings/secrets/actions
2. Clicar em "New repository secret"

### Secrets necessários:

| Nome | Valor | Como obter |
|------|-------|------------|
| `VPS_HOST` | `69.62.100.250` | IP da VPS |
| `VPS_USER` | `root` | Usuário SSH |
| `VPS_SSH_KEY` | Chave privada SSH | Ver abaixo |

---

### Como obter VPS_SSH_KEY:

**Opção A: Usar chave existente do Doppler**

```bash
# Pegar do Doppler
doppler secrets get VPS_SSH_PRIVATE_KEY --project sticker --config prd --plain

# Copiar TUDO (incluindo -----BEGIN e -----END)
# Colar no GitHub Secret
```

**Opção B: Gerar nova chave**

```bash
# 1. Gerar chave
ssh-keygen -t ed25519 -C "github-actions@stickerbot" -f ~/.ssh/github_actions_sticker

# 2. Adicionar chave pública na VPS
cat ~/.ssh/github_actions_sticker.pub | vps-ssh "cat >> ~/.ssh/authorized_keys"

# 3. Testar conexão
ssh -i ~/.ssh/github_actions_sticker root@69.62.100.250 "echo 'Conexão OK!'"

# 4. Copiar chave PRIVADA para GitHub Secret
cat ~/.ssh/github_actions_sticker
# Copiar TUDO (incluindo BEGIN/END)
```

---

## 3️⃣ Escalar Serviços para 2 Réplicas

**Precisa fazer ANTES do primeiro deploy via Actions!**

```bash
# 1. Deploy do stack atualizado (com 2 réplicas configuradas)
./deploy/deploy-sticker.sh prd

# Ou manualmente:
vps-ssh "docker stack deploy -c /root/sticker/stack-sticker.yml sticker"

# 2. Verificar que subiu 2 réplicas
vps-ssh "docker service ls | grep sticker"

# Deve mostrar:
# sticker_backend   replicated   2/2
# sticker_worker    replicated   2/2

# 3. Aguardar convergência (1-2 minutos)
vps-ssh "docker service ps sticker_backend"
vps-ssh "docker service ps sticker_worker"
```

---

## 4️⃣ Primeiro Deploy via GitHub Actions

### Opção A: Push para main (automático)

```bash
# Fazer qualquer mudança no código
git add .
git commit -m "Enable CI/CD with GitHub Actions"
git push origin main

# Acompanhar deploy:
# https://github.com/reisspaulo/sticker/actions
```

### Opção B: Deploy manual (via UI)

1. Ir para: https://github.com/reisspaulo/sticker/actions
2. Selecionar workflow "Deploy Sticker Bot"
3. Clicar em "Run workflow" → "Run workflow"
4. Acompanhar progresso

---

## 5️⃣ Verificar Deploy

```bash
# Ver logs do workflow no GitHub Actions

# Verificar serviços na VPS
vps-ssh "docker service ps sticker_backend --no-trunc | head -5"
vps-ssh "docker service ps sticker_worker --no-trunc | head -5"

# Testar health check
curl https://stickers.ytem.com.br/health

# Ver logs
vps-ssh "docker service logs --tail 20 sticker_backend"
vps-ssh "docker service logs --tail 20 sticker_worker"
```

---

## 6️⃣ Testar Zero-Downtime

### Fazer uma mudança simples:

```typescript
// src/server.ts
app.get('/health', async (request, reply) => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.1',  // ← Mudar aqui
  };
});
```

### Deploy:

```bash
git add src/server.ts
git commit -m "test: Bump version to 1.0.1"
git push origin main
```

### Monitorar em tempo real:

```bash
# Terminal 1: Monitorar health check
while true; do
  curl -s https://stickers.ytem.com.br/health | jq '.status'
  sleep 1
done

# Terminal 2: Ver rolling update
vps-ssh "watch -n 1 'docker service ps sticker_backend'"

# Resultado esperado:
# ✅ Health check NUNCA falha (sempre "healthy")
# ✅ Vê containers sendo substituídos gradualmente
# ✅ Zero downtime!
```

---

## 🎯 Resultado Final

Após setup completo, você terá:

- ✅ **Deploy automático** a cada push na main
- ✅ **Zero downtime** (rolling update com 2 réplicas)
- ✅ **Rollback automático** se algo falhar
- ✅ **Build no GitHub** (não precisa mais Mac/Docker local)
- ✅ **Health checks** antes de rotear tráfego
- ✅ **Histórico de deploys** no GitHub Actions

---

## 🆘 Troubleshooting

### Erro: "denied: permission_denied" no push GHCR

**Causa:** Personal Access Token sem scope `write:packages`

**Solução:** Criar novo token com scopes corretas (ver passo 1)

---

### Erro: "SSH connection failed"

**Causa:** VPS_SSH_KEY incorreta ou não autorizada

**Solução:**

```bash
# Testar chave localmente
ssh -i ~/.ssh/chave_privada root@69.62.100.250

# Adicionar chave na VPS
cat ~/.ssh/chave_publica.pub | vps-ssh "cat >> ~/.ssh/authorized_keys"
```

---

### Deploy funciona mas ainda tem downtime

**Causa:** Serviços ainda com 1 réplica

**Solução:**

```bash
# Verificar réplicas
vps-ssh "docker service ls | grep sticker"

# Se mostrar 1/1, escalar para 2
vps-ssh "docker service scale sticker_backend=2 sticker_worker=2"
```

---

### Health check falha no workflow

**Causa:** URL incorreta ou serviço não iniciou

**Solução:**

```bash
# Testar manualmente
curl https://stickers.ytem.com.br/health

# Ver logs
vps-ssh "docker service logs sticker_backend --tail 50"

# Verificar Traefik
vps-ssh "docker service logs traefik_traefik | grep sticker"
```

---

## 📚 Próximos Passos

Após CI/CD funcionando, considere:

- [ ] Adicionar testes automáticos no workflow (`npm test`)
- [ ] Scan de vulnerabilidades (Trivy/Snyk)
- [ ] Notificações Slack/Discord
- [ ] Ambientes de staging (branch `develop`)
- [ ] Monitoring com Prometheus/Grafana

---

## 🔗 Links Úteis

- **GitHub Actions:** https://github.com/reisspaulo/sticker/actions
- **GHCR Packages:** https://github.com/reisspaulo?tab=packages
- **Tokens Settings:** https://github.com/settings/tokens
- **Secrets Settings:** https://github.com/reisspaulo/sticker/settings/secrets/actions
