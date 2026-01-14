# 🚀 Deploy Rápido - Sticker Bot

**Resumo dos comandos mais usados**

---

## 🎯 Deploy via CI/CD (RECOMENDADO)

**Método principal:** Deploy automático com zero-downtime

```bash
# 1. Fazer mudanças no código
# ... editar arquivos em src/ ...

# 2. Commit e push para main
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# 3. Acompanhar deploy
# https://github.com/reisspaulo/sticker/actions

# 4. Verificar produção (após 2-3 min)
curl https://stickers.ytem.com.br/health | jq
```

**📖 Documentação completa:** [CI-CD-WORKFLOW.md](./CI-CD-WORKFLOW.md)

**Tempo total**: ~2-3 minutos (automático)

---

## 📦 Deploy Manual (Backup/Emergência)

```bash
# 1. Parar ambiente local
./scripts/stop-local.sh

# 2. Build + transferir + deploy
docker build --no-cache --platform linux/amd64 -t ghcr.io/reisspaulo/stickerbot:latest .
docker tag ghcr.io/reisspaulo/stickerbot:latest ghcr.io/reisspaulo/stickerbot:latest

docker save ghcr.io/reisspaulo/stickerbot:latest | gzip | vps-ssh "gunzip | docker load"
docker save ghcr.io/reisspaulo/stickerbot:latest | gzip | vps-ssh "gunzip | docker load"

vps-ssh "docker service update --force --image ghcr.io/reisspaulo/stickerbot:latest sticker_backend"
vps-ssh "docker service update --force --image ghcr.io/reisspaulo/stickerbot:latest sticker_worker"

# 3. Verificar
vps-ssh "docker service logs --tail 20 sticker_backend"
vps-ssh "docker service logs --tail 20 sticker_worker"
curl https://stickers.ytem.com.br/health
```

**Tempo total**: ~8 minutos

---

## 🔧 Desenvolvimento Local

```bash
# Iniciar ambiente local
./scripts/start-local.sh

# Parar ambiente local
./scripts/stop-local.sh

# Logs em tempo real
docker-compose logs -f                           # Evolution
docker-compose -f docker-compose.bot.yml logs -f # Bot
```

---

## 🔍 Verificações Rápidas

```bash
# Status dos serviços na VPS
vps-ssh "docker service ls | grep sticker"

# Logs recentes
vps-ssh "docker service logs --tail 50 sticker_backend"
vps-ssh "docker service logs --tail 50 sticker_worker"

# Health check
curl https://stickers.ytem.com.br/health

# Verificar se tem containers locais rodando
docker ps -a | grep -E "sticker|evolution"
lsof -i :3000  # Backend local
lsof -i :8080  # Evolution local
```

---

## 🆘 Problemas Comuns

### Bot responde 2 vezes / Código antigo

```bash
# Parar containers locais
./scripts/stop-local.sh
```

### Código não atualiza na VPS

```bash
# Build com --no-cache
docker build --no-cache --platform linux/amd64 -t ghcr.io/reisspaulo/stickerbot:latest .
```

### Serviço não inicia

```bash
# Ver erro
vps-ssh "docker service ps sticker_backend --no-trunc"

# Rollback
vps-ssh "docker service update --rollback sticker_backend"
```

---

## 🔄 Monitoramento de Deploy (CI/CD)

### Verificar Status do Deploy

```bash
# Ver workflow em execução
# https://github.com/reisspaulo/sticker/actions

# Ver logs dos serviços na VPS
vps-ssh "docker service logs -f sticker_backend"

# Monitorar health em tempo real
while true; do curl -s https://stickers.ytem.com.br/health | jq '.status,.version'; sleep 1; done
```

### Rollback (se necessário)

```bash
# Rollback imediato via Docker Swarm
vps-ssh "docker service update --rollback sticker_backend"
vps-ssh "docker service update --rollback sticker_worker"
```

---

## 📚 Documentação Completa

- **CI/CD Workflow**: [CI-CD-WORKFLOW.md](./CI-CD-WORKFLOW.md) - Guia completo do deploy automatizado
- **GitHub Actions Setup**: [GITHUB-ACTIONS-SETUP.md](./GITHUB-ACTIONS-SETUP.md) - Configuração inicial
- **Processo manual**: [DEPLOYMENT-PROCESS.md](./DEPLOYMENT-PROCESS.md) - Deploy manual (backup)
- **Setup do Doppler**: [DOPPLER-SETUP.md](./DOPPLER-SETUP.md)
- **Guia geral**: [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)
