#!/bin/bash
set -e

echo "🛑 Parando ambiente local..."
echo ""

# Parar e remover containers
echo "1️⃣  Parando Sticker Bot..."
docker-compose -f docker-compose.bot.yml down

echo ""
echo "2️⃣  Parando Evolution API..."
docker-compose down

echo ""
echo "✅ Ambiente local parado!"
echo ""

# Verificar se ainda há containers rodando
RUNNING=$(docker ps -a | grep -E "sticker|evolution" || true)

if [ -n "$RUNNING" ]; then
  echo "⚠️  Ainda há containers relacionados ao projeto:"
  echo "$RUNNING"
  echo ""
  echo "Para remover completamente:"
  echo "  docker rm -f \$(docker ps -aq | xargs)"
else
  echo "✅ Nenhum container local relacionado ao projeto"
fi

echo ""
echo "📊 Verificar portas:"
lsof -i :3000 2>/dev/null | grep LISTEN || echo "   ✅ Porta 3000 livre"
lsof -i :8080 2>/dev/null | grep LISTEN || echo "   ✅ Porta 8080 livre"

echo ""
echo "🚀 Agora você pode testar o deploy na VPS sem conflitos!"
echo ""
