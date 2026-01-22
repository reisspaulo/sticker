#!/bin/bash

# Deploy Evolution API para VPS usando Docker Swarm + Doppler
# Uso: ./deploy/deploy-evolution.sh [env]
# Exemplo: ./deploy/deploy-evolution.sh prd

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuração
VPS_HOST="root@157.230.50.63"
STACK_NAME="evolution"
ENV="${1:-prd}"

echo -e "${GREEN}🚀 Deploy Evolution API - Ambiente: ${ENV}${NC}"

# 1. Verificar se Doppler está configurado
echo -e "${YELLOW}📋 Verificando Doppler...${NC}"
if ! command -v doppler &> /dev/null; then
    echo -e "${RED}❌ Doppler CLI não encontrado. Instale: https://docs.doppler.com/docs/install-cli${NC}"
    exit 1
fi

# 2. Verificar acesso à VPS
echo -e "${YELLOW}🔌 Testando conexão com VPS...${NC}"
if ! ssh -o ConnectTimeout=5 "$VPS_HOST" "echo 'OK'" &> /dev/null; then
    echo -e "${RED}❌ Não foi possível conectar à VPS${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Conexão com VPS OK${NC}"

# 3. Gerar stack file com secrets do Doppler
echo -e "${YELLOW}🔐 Carregando secrets do Doppler (config: ${ENV})...${NC}"
TEMP_STACK=$(mktemp)

# Exportar secrets como variáveis de ambiente e substituir no stack file
doppler secrets download --project sticker --config "$ENV" --no-file --format env | \
  while IFS='=' read -r key value; do
    export "$key=$value"
  done

# Processar stack file (substituir ${EVOLUTION_API_KEY})
envsubst < deploy/stack-evolution.yml > "$TEMP_STACK"

echo -e "${GREEN}✅ Stack file gerado com secrets${NC}"

# 4. Copiar stack file para VPS
echo -e "${YELLOW}📤 Copiando stack file para VPS...${NC}"
scp "$TEMP_STACK" "$VPS_HOST:/tmp/stack-evolution.yml"
rm "$TEMP_STACK"
echo -e "${GREEN}✅ Stack file copiado${NC}"

# 5. Deploy no Docker Swarm
echo -e "${YELLOW}🐳 Fazendo deploy no Docker Swarm...${NC}"
ssh "$VPS_HOST" << 'ENDSSH'
  # Verificar se Swarm está ativo
  if ! docker node ls &> /dev/null; then
    echo "Inicializando Docker Swarm..."
    docker swarm init
  fi

  # Criar rede traefik-public se não existir
  if ! docker network ls | grep -q traefik-public; then
    echo "Criando rede traefik-public..."
    docker network create --driver=overlay --attachable traefik-public
  fi

  # Deploy stack
  docker stack deploy -c /tmp/stack-evolution.yml evolution

  # Aguardar services iniciarem
  echo "Aguardando services iniciarem..."
  sleep 10

  # Verificar status
  echo ""
  echo "📊 Status dos serviços:"
  docker service ls | grep evolution
ENDSSH

echo -e "${GREEN}✅ Deploy concluído!${NC}"
echo ""
echo -e "${GREEN}🔗 URLs Disponíveis:${NC}"
echo -e "   Evolution API:     ${GREEN}https://your-evolution-api.com${NC}"
echo -e "   Evolution Manager: ${GREEN}https://your-evolution-manager.com${NC}"
echo ""
echo -e "${YELLOW}📝 Próximos passos:${NC}"
echo -e "   1. Aguardar SSL ser gerado (~1 minuto)"
echo -e "   2. Acessar: ${GREEN}https://your-evolution-api.com/instance/connect/meu-zap${NC}"
echo -e "   3. Escanear QR Code com WhatsApp"
echo -e "   4. Configurar webhook: ${GREEN}https://your-domain.com/webhook${NC}"
echo ""
echo -e "${YELLOW}🔍 Monitorar logs:${NC}"
echo -e "   ssh root@157.230.50.63 'docker service logs evolution_evolution_api -f'"
