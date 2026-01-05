#!/bin/bash
set -e

# Add/Update secrets in Doppler from .env file
# Usage: ./scripts/add-doppler-secrets.sh [config]

CONFIG="${1:-prd}"
PROJECT="sticker"

echo "🔐 Adding secrets to Doppler..."
echo "   Project: ${PROJECT}"
echo "   Config: ${CONFIG}"
echo ""

# Check if Doppler is authenticated
if ! doppler me &>/dev/null; then
  echo "❌ Doppler is not authenticated!"
  echo "   Run: doppler login"
  exit 1
fi

# Check if project exists
if ! doppler projects | grep -q "${PROJECT}"; then
  echo "❌ Project '${PROJECT}' not found in Doppler"
  echo ""
  echo "Create it first:"
  echo "  1. Go to https://dashboard.doppler.com"
  echo "  2. Create project: ${PROJECT}"
  echo "  3. Create config: ${CONFIG}"
  exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found"
  exit 1
fi

echo "📋 Extracting secrets from .env..."
echo ""

# Extract secrets from .env
API_KEY=$(grep "^API_KEY=" .env | cut -d'=' -f2)
OPENAI_API_KEY=$(grep "^OPENAI_API_KEY=" .env | cut -d'=' -f2)
STRIPE_SECRET_KEY=$(grep "^STRIPE_SECRET_KEY=" .env | cut -d'=' -f2)
STRIPE_WEBHOOK_SECRET=$(grep "^STRIPE_WEBHOOK_SECRET=" .env | cut -d'=' -f2)
STRIPE_PREMIUM_PAYMENT_LINK=$(grep "^STRIPE_PREMIUM_PAYMENT_LINK=" .env | cut -d'=' -f2)
STRIPE_ULTRA_PAYMENT_LINK=$(grep "^STRIPE_ULTRA_PAYMENT_LINK=" .env | cut -d'=' -f2)
STRIPE_STICKER_PREMIUM_PRODUCT_ID=$(grep "^STRIPE_STICKER_PREMIUM_PRODUCT_ID=" .env | cut -d'=' -f2)
STRIPE_STICKER_ULTRA_PRODUCT_ID=$(grep "^STRIPE_STICKER_ULTRA_PRODUCT_ID=" .env | cut -d'=' -f2)

# Validate required secrets
if [ -z "$API_KEY" ] || [ -z "$STRIPE_SECRET_KEY" ]; then
  echo "❌ Required secrets not found in .env"
  echo "   Make sure .env has: API_KEY, STRIPE_SECRET_KEY"
  exit 1
fi

echo "✅ Found 8 secrets in .env"
echo ""
echo "🚀 Setting secrets in Doppler..."

doppler secrets set \
  --project "${PROJECT}" \
  --config "${CONFIG}" \
  "API_KEY=${API_KEY}" \
  "OPENAI_API_KEY=${OPENAI_API_KEY}" \
  "STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}" \
  "STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}" \
  "STRIPE_PREMIUM_PAYMENT_LINK=${STRIPE_PREMIUM_PAYMENT_LINK}" \
  "STRIPE_ULTRA_PAYMENT_LINK=${STRIPE_ULTRA_PAYMENT_LINK}" \
  "STRIPE_STICKER_PREMIUM_PRODUCT_ID=${STRIPE_STICKER_PREMIUM_PRODUCT_ID}" \
  "STRIPE_STICKER_ULTRA_PRODUCT_ID=${STRIPE_STICKER_ULTRA_PRODUCT_ID}"

echo ""
echo "✅ Secrets updated successfully!"
echo ""
echo "📝 Verify secrets:"
echo "   doppler secrets --project ${PROJECT} --config ${CONFIG}"
echo ""
echo "🚀 Ready to deploy:"
echo "   ./deploy/deploy-sticker.sh ${CONFIG}"
echo ""
