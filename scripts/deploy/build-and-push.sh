#!/bin/bash
set -e

# Build and Push Docker Image to GHCR
# Usage: ./scripts/build-and-push.sh [tag]

TAG="${1:-latest}"
REGISTRY="ghcr.io"
NAMESPACE="reisspaulo"
IMAGE_NAME="${REGISTRY}/${NAMESPACE}/stickerbot"

echo "🐳 Building and pushing Sticker Bot image..."
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

# Build image
echo "1️⃣  Building image..."
docker build \
  --platform linux/amd64 \
  -t "${IMAGE_NAME}:${TAG}" \
  -f Dockerfile \
  .

echo ""
echo "2️⃣  Pushing image to GHCR..."
docker push "${IMAGE_NAME}:${TAG}"

echo ""
echo "✅ Image pushed successfully!"
echo ""
echo "   Image: ${IMAGE_NAME}:${TAG}"
echo ""
echo "📝 Next steps:"
echo "   1. Deploy to VPS:"
echo "      ./deploy/deploy-sticker.sh prd"
echo ""
echo "   2. Or update services manually:"
echo "      vps-ssh \"docker service update --force --image ${IMAGE_NAME}:${TAG} sticker_backend\""
echo "      vps-ssh \"docker service update --force --image ${IMAGE_NAME}:${TAG} sticker_worker\""
echo ""
