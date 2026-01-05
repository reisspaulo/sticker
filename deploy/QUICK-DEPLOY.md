# 🚀 Deploy Rápido - Sticker Bot

**Resumo dos comandos mais usados**

---

## 📦 Deploy Completo (Produção)

```bash
# 1. Parar ambiente local
./scripts/stop-local.sh

# 2. Build + transferir + deploy
docker build --no-cache --platform linux/amd64 -t ghcr.io/reisspaulo/stickerbot:latest .
docker tag ghcr.io/reisspaulo/stickerbot:latest ghcr.io/reisspaulo/sticker-bot-backend:latest

docker save ghcr.io/reisspaulo/sticker-bot-backend:latest | gzip | vps-ssh "gunzip | docker load"
docker save ghcr.io/reisspaulo/stickerbot:latest | gzip | vps-ssh "gunzip | docker load"

vps-ssh "docker service update --force --image ghcr.io/reisspaulo/sticker-bot-backend:latest sticker_backend"
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

## 📚 Documentação Completa

- **Processo detalhado**: [DEPLOYMENT-PROCESS.md](./DEPLOYMENT-PROCESS.md)
- **Setup do Doppler**: [DOPPLER-SETUP.md](./DOPPLER-SETUP.md)
- **Guia geral**: [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)
