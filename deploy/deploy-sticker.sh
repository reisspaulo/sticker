#!/bin/bash
set -e

# ============================================================================
# ⚠️  ATENÇÃO: Este script NÃO faz build de código novo!
# ============================================================================
#
# Use este script APENAS para:
#   - Atualizar variáveis de ambiente (secrets do Doppler)
#   - Recriar a stack Docker (mudanças de infraestrutura)
#
# Para deploy de CÓDIGO NOVO, use:
#   git push origin main  (CI/CD automático)
#
# Este script usa a imagem :latest que pode estar desatualizada!
# O CI/CD usa tags específicas (:SHA) que garantem o código correto.
# ============================================================================

echo ""
echo "⚠️  AVISO: Este script é para deploy de INFRAESTRUTURA, não código!"
echo "   Para código novo, use: git push origin main"
echo ""
read -p "Continuar mesmo assim? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelado. Use 'git push origin main' para deploy de código."
    exit 1
fi
echo ""

# Deploy Sticker Bot Stack with Doppler Secrets
# Usage: ./deploy/deploy-sticker.sh [dev|prd]

CONFIG="${1:-prd}"
VPS_HOST="root@YOUR_VPS_IP"
STACK_NAME="sticker"

echo "🚀 Deploying Sticker Bot Stack (config: $CONFIG)..."
echo ""

# Verify Doppler is logged in
if ! doppler me &>/dev/null; then
  echo "❌ Doppler is not authenticated! Run: doppler login"
  exit 1
fi

# Verify project and config exist
if ! doppler configs --project sticker | grep -q "$CONFIG"; then
  echo "❌ Config '$CONFIG' not found in project 'sticker'"
  echo "Available configs:"
  doppler configs --project sticker
  exit 1
fi

echo "1️⃣  Loading secrets from Doppler..."

# Load all secrets from Doppler
SUPABASE_URL=$(doppler secrets get SUPABASE_URL --plain --project sticker --config "$CONFIG")
SUPABASE_SERVICE_KEY=$(doppler secrets get SUPABASE_SERVICE_KEY --plain --project sticker --config "$CONFIG")
EVOLUTION_API_KEY=$(doppler secrets get EVOLUTION_API_KEY --plain --project sticker --config "$CONFIG")
EVOLUTION_INSTANCE=$(doppler secrets get EVOLUTION_INSTANCE --plain --project sticker --config "$CONFIG")
API_KEY=$(doppler secrets get API_KEY --plain --project sticker --config "$CONFIG")
OPENAI_API_KEY=$(doppler secrets get OPENAI_API_KEY --plain --project sticker --config "$CONFIG")
STRIPE_SECRET_KEY=$(doppler secrets get STRIPE_SECRET_KEY --plain --project sticker --config "$CONFIG")
STRIPE_WEBHOOK_SECRET=$(doppler secrets get STRIPE_WEBHOOK_SECRET --plain --project sticker --config "$CONFIG")
STRIPE_PREMIUM_PAYMENT_LINK=$(doppler secrets get STRIPE_PREMIUM_PAYMENT_LINK --plain --project sticker --config "$CONFIG")
STRIPE_ULTRA_PAYMENT_LINK=$(doppler secrets get STRIPE_ULTRA_PAYMENT_LINK --plain --project sticker --config "$CONFIG")
STRIPE_STICKER_PREMIUM_PRODUCT_ID=$(doppler secrets get STRIPE_STICKER_PREMIUM_PRODUCT_ID --plain --project sticker --config "$CONFIG")
STRIPE_STICKER_ULTRA_PRODUCT_ID=$(doppler secrets get STRIPE_STICKER_ULTRA_PRODUCT_ID --plain --project sticker --config "$CONFIG")
AVISA_API_URL=$(doppler secrets get AVISA_API_URL --plain --project sticker --config "$CONFIG")
AVISA_API_TOKEN=$(doppler secrets get AVISA_API_TOKEN --plain --project sticker --config "$CONFIG")
LOG_LEVEL=$(doppler secrets get LOG_LEVEL --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "info")

# Z-API credentials
Z_API_INSTANCE=$(doppler secrets get Z_API_INSTANCE --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "")
Z_API_TOKEN=$(doppler secrets get Z_API_TOKEN --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "")
Z_API_CLIENT_TOKEN=$(doppler secrets get Z_API_CLIENT_TOKEN --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "")
Z_API_BASE_URL=$(doppler secrets get Z_API_BASE_URL --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "https://api.z-api.io")

# Z-API feature flags
USE_ZAPI=$(doppler secrets get USE_ZAPI --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "false")
ZAPI_WEBHOOK_ENABLED=$(doppler secrets get ZAPI_WEBHOOK_ENABLED --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "false")

# Meta Cloud API
USE_META=$(doppler secrets get USE_META --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "false")
META_WEBHOOK_ENABLED=$(doppler secrets get META_WEBHOOK_ENABLED --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "false")
WHATSAPP_ACCESS_TOKEN=$(doppler secrets get WHATSAPP_ACCESS_TOKEN --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "")
WHATSAPP_PHONE_NUMBER_ID=$(doppler secrets get WHATSAPP_PHONE_NUMBER_ID --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "")
WHATSAPP_BUSINESS_ACCOUNT_ID=$(doppler secrets get WHATSAPP_BUSINESS_ACCOUNT_ID --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "")
WHATSAPP_WEBHOOK_TOKEN=$(doppler secrets get WHATSAPP_WEBHOOK_TOKEN --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "")
META_API_VERSION=$(doppler secrets get META_API_VERSION --plain --project sticker --config "$CONFIG" 2>/dev/null || echo "v22.0")

echo "✅ Secrets loaded (28 variables)"
echo ""

echo "2️⃣  Generating stack file with secrets..."

# Generate temporary stack file with all secrets
cat > /tmp/stack-sticker-full.yml <<EOF
version: "3.9"

networks:
  traefik-public:
    external: true
  ytem-backend:
    external: true

services:
  # Backend API
  backend:
    image: ghcr.io/your-username/stickerbot:latest
    command: ["node", "dist/server.js"]
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=${LOG_LEVEL}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=redis://:YOUR_REDIS_PASSWORD@ytem-databases_redis:6379
      - EVOLUTION_API_URL=http://evolution_evolution_api:8080
      - EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
      - EVOLUTION_INSTANCE=${EVOLUTION_INSTANCE}
      - API_KEY=${API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      - STRIPE_PREMIUM_PAYMENT_LINK=${STRIPE_PREMIUM_PAYMENT_LINK}
      - STRIPE_ULTRA_PAYMENT_LINK=${STRIPE_ULTRA_PAYMENT_LINK}
      - STRIPE_STICKER_PREMIUM_PRODUCT_ID=${STRIPE_STICKER_PREMIUM_PRODUCT_ID}
      - STRIPE_STICKER_ULTRA_PRODUCT_ID=${STRIPE_STICKER_ULTRA_PRODUCT_ID}
      - AVISA_API_URL=${AVISA_API_URL}
      - AVISA_API_TOKEN=${AVISA_API_TOKEN}
      - Z_API_INSTANCE=${Z_API_INSTANCE}
      - Z_API_TOKEN=${Z_API_TOKEN}
      - Z_API_CLIENT_TOKEN=${Z_API_CLIENT_TOKEN}
      - Z_API_BASE_URL=${Z_API_BASE_URL}
      - USE_ZAPI=${USE_ZAPI}
      - ZAPI_WEBHOOK_ENABLED=${ZAPI_WEBHOOK_ENABLED}
      - USE_META=${USE_META}
      - META_WEBHOOK_ENABLED=${META_WEBHOOK_ENABLED}
      - WHATSAPP_ACCESS_TOKEN=${WHATSAPP_ACCESS_TOKEN}
      - WHATSAPP_PHONE_NUMBER_ID=${WHATSAPP_PHONE_NUMBER_ID}
      - WHATSAPP_BUSINESS_ACCOUNT_ID=${WHATSAPP_BUSINESS_ACCOUNT_ID}
      - WHATSAPP_WEBHOOK_TOKEN=${WHATSAPP_WEBHOOK_TOKEN}
      - META_API_VERSION=${META_API_VERSION}
    networks:
      - traefik-public
      - ytem-backend
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == manager
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        monitor: 30s
        max_failure_ratio: 0.3
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 5s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 128M
      labels:
        - "traefik.enable=true"
        - "traefik.docker.network=traefik-public"
        - "traefik.http.routers.sticker-api.rule=Host(\`your-domain.com\`)"
        - "traefik.http.routers.sticker-api.entrypoints=websecure"
        - "traefik.http.routers.sticker-api.tls=true"
        - "traefik.http.routers.sticker-api.tls.certresolver=letsencrypt"
        - "traefik.http.services.sticker-api.loadbalancer.server.port=3000"
        - "traefik.http.services.sticker-api.loadbalancer.healthcheck.path=/health"
        - "traefik.http.services.sticker-api.loadbalancer.healthcheck.interval=30s"

  # Worker (BullMQ processor)
  worker:
    image: ghcr.io/your-username/stickerbot:latest
    command: ["node", "dist/worker.js"]
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=${LOG_LEVEL}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - REDIS_URL=redis://:YOUR_REDIS_PASSWORD@ytem-databases_redis:6379
      - EVOLUTION_API_URL=http://evolution_evolution_api:8080
      - EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
      - EVOLUTION_INSTANCE=${EVOLUTION_INSTANCE}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AVISA_API_URL=${AVISA_API_URL}
      - AVISA_API_TOKEN=${AVISA_API_TOKEN}
      - Z_API_INSTANCE=${Z_API_INSTANCE}
      - Z_API_TOKEN=${Z_API_TOKEN}
      - Z_API_CLIENT_TOKEN=${Z_API_CLIENT_TOKEN}
      - Z_API_BASE_URL=${Z_API_BASE_URL}
      - USE_ZAPI=${USE_ZAPI}
      - ZAPI_WEBHOOK_ENABLED=${ZAPI_WEBHOOK_ENABLED}
    networks:
      - traefik-public
      - ytem-backend
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == manager
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        monitor: 30s
        max_failure_ratio: 0.3
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 5s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1024M
        reservations:
          cpus: '0.25'
          memory: 256M
EOF

echo "✅ Stack file generated"
echo ""

echo "3️⃣  Copying stack to VPS..."
vps-ssh "cat > /tmp/stack-sticker.yml" < /tmp/stack-sticker-full.yml

echo ""
echo "4️⃣  Deploying stack on VPS..."
vps-ssh "docker stack deploy -c /tmp/stack-sticker.yml ${STACK_NAME}"

echo ""
echo "5️⃣  Waiting for convergence (60s)..."
sleep 60

echo ""
echo "6️⃣  Health check..."

MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    STATUS=$(timeout 10 curl -s https://your-domain.com/health | jq -r '.status' 2>/dev/null || echo "error")

    if [ "$STATUS" = "healthy" ]; then
        echo ""
        echo "✅ Sticker Bot deployed successfully!"
        echo "🌐 https://your-domain.com"
        echo "🔗 Webhook: https://your-domain.com/webhook"
        echo "💚 Health: https://your-domain.com/health"
        echo ""
        echo "🔐 All secrets loaded from Doppler (config: $CONFIG)"

        # Clean up temp file
        rm -f /tmp/stack-sticker-full.yml

        exit 0
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⏳ Waiting for API to be healthy (attempt $RETRY_COUNT/$MAX_RETRIES)..."
        [ $RETRY_COUNT -lt $MAX_RETRIES ] && sleep 10
    fi
done

echo ""
echo "❌ Health check failed after $MAX_RETRIES attempts"
echo "💡 Check logs: vps-ssh 'docker service logs sticker_backend --tail 100'"
exit 1
