#!/bin/bash
set -e

# Build and Push Docker Images to GHCR
# Usage: ./scripts/build-and-push.sh [tag]

TAG="${1:-latest}"
REGISTRY="ghcr.io"
NAMESPACE="reisspaulo"
BACKEND_IMAGE="${REGISTRY}/${NAMESPACE}/sticker-bot-backend"
WORKER_IMAGE="${REGISTRY}/${NAMESPACE}/sticker-bot-worker"

echo "🐳 Building and pushing Sticker Bot images..."
echo "   Tag: ${TAG}"
echo "   Platform: linux/amd64"
echo ""

# Check if logged into GHCR
if ! docker info 2>/dev/null | grep -q "ghcr.io"; then
  echo "⚠️  Not logged into ghcr.io"
  echo ""
  echo "Login with:"
  echo "  echo \$GITHUB_TOKEN | docker login ghcr.io -u reisspaulo --password-stdin"
  echo ""
  read -p "Do you want to continue without login? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Build images
echo "1️⃣  Building backend image..."
docker build \
  --platform linux/amd64 \
  -t "${BACKEND_IMAGE}:${TAG}" \
  -f Dockerfile \
  .

echo ""
echo "2️⃣  Building worker image (same base, different command)..."
# Worker usa mesma imagem mas com comando diferente no stack
docker tag "${BACKEND_IMAGE}:${TAG}" "${WORKER_IMAGE}:${TAG}"

echo ""
echo "3️⃣  Pushing images to GHCR..."

echo "   Pushing backend..."
docker push "${BACKEND_IMAGE}:${TAG}"

echo "   Pushing worker..."
docker push "${WORKER_IMAGE}:${TAG}"

echo ""
echo "✅ Images pushed successfully!"
echo ""
echo "   Backend: ${BACKEND_IMAGE}:${TAG}"
echo "   Worker:  ${WORKER_IMAGE}:${TAG}"
echo ""
echo "📝 Next steps:"
echo "   1. Deploy to VPS:"
echo "      ./deploy/deploy-sticker.sh prd"
echo ""
echo "   2. Or update service manually:"
echo "      vps-ssh \"docker service update --force --image ${BACKEND_IMAGE}:${TAG} sticker_backend\""
echo "      vps-ssh \"docker service update --force --image ${WORKER_IMAGE}:${TAG} sticker_worker\""
echo ""
