#!/bin/bash
set -e

echo "🚀 Iniciando ambiente local..."
echo ""

# Verificar se Docker está rodando
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker não está rodando"
  echo "   Por favor, inicie o Docker Desktop"
  exit 1
fi

# Subir serviços
echo "1️⃣  Iniciando Evolution API (WhatsApp)..."
docker-compose up -d

echo ""
echo "2️⃣  Iniciando Sticker Bot..."
docker-compose -f docker-compose.bot.yml up -d

echo ""
echo "⏳ Aguardando serviços iniciarem (10s)..."
sleep 10

echo ""
echo "✅ Ambiente local iniciado!"
echo ""
echo "📋 Serviços disponíveis:"
echo "   • Backend:       http://localhost:3000"
echo "   • Health:        http://localhost:3000/health"
echo "   • Evolution API: http://localhost:8080"
echo "   • PostgreSQL:    localhost:5432"
echo "   • Redis:         localhost:6379"
echo ""
echo "📊 Verificar status:"
echo "   docker ps | grep -E 'sticker|evolution'"
echo ""
echo "📝 Ver logs:"
echo "   docker-compose logs -f                    # Evolution"
echo "   docker-compose -f docker-compose.bot.yml logs -f  # Bot"
echo ""
echo "⚠️  IMPORTANTE: Pare este ambiente antes de testar deploys!"
echo "   ./scripts/stop-local.sh"
echo ""
