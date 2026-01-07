#!/bin/bash

VPS_IP="157.230.50.63"
SAMPLES_DIR="watermark-samples"

echo "📦 Compactando amostras..."
tar -czf watermark-samples.tar.gz ${SAMPLES_DIR}/

echo "📤 Enviando para VPS..."
scp watermark-samples.tar.gz root@${VPS_IP}:/tmp/

echo "🚀 Executando script na VPS..."
ssh root@${VPS_IP} << 'ENDSSH'
cd /tmp
tar -xzf watermark-samples.tar.gz

# Configurações Evolution API (interna no Docker)
EVOLUTION_URL="http://evolution_evolution_api:8080"
EVOLUTION_KEY="I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
INSTANCE="meu-zap"
PHONE="5511946304133"

echo "📱 Enviando mensagem inicial..."
docker exec ytem-sticker-backend curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${PHONE}\",
    \"text\": \"🧪 *TESTE DE MARCA D'ÁGUA*\n\nVou enviar 5 figurinhas para você comparar:\n\n0️⃣ SEM marca d'água (planos pagos)\n1️⃣ 15% opacidade (MUITO sutil)\n2️⃣ 25% opacidade (Sutil)\n3️⃣ 40% opacidade (Discreta)\n4️⃣ 60% opacidade (Bem visível)\n\nAguarde...\"
  }"

sleep 3

# Copiar arquivos para dentro do container
docker cp watermark-samples ytem-sticker-backend:/tmp/

# Enviar cada figurinha
for file in "sticker-no-watermark.webp:0️⃣ SEM Marca d'água" \
            "sticker-watermark-15.webp:1️⃣ 15% Opacidade - MUITO sutil" \
            "sticker-watermark-25.webp:2️⃣ 25% Opacidade - Sutil" \
            "sticker-watermark-40.webp:3️⃣ 40% Opacidade - Discreta" \
            "sticker-watermark-60.webp:4️⃣ 60% Opacidade - Bem visível"; do

  filename="${file%%:*}"
  caption="${file#*:}"

  echo "📤 Enviando: ${caption}..."

  docker exec ytem-sticker-backend curl -X POST "${EVOLUTION_URL}/message/sendMedia/${INSTANCE}" \
    -H "apikey: ${EVOLUTION_KEY}" \
    -F "number=${PHONE}" \
    -F "mediaMessage=@/tmp/watermark-samples/${filename}"

  sleep 2

  docker exec ytem-sticker-backend curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
    -H "apikey: ${EVOLUTION_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"number\": \"${PHONE}\", \"text\": \"${caption}\"}"

  sleep 3
done

echo "✅ Mensagem final..."
docker exec ytem-sticker-backend curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${PHONE}\",
    \"text\": \"✅ *Teste concluído!*\n\nQual versão você achou ideal?\n\n💭 *Reflexões:*\n• 15-25% = Quase invisível\n• 40% = Equilíbrio\n• 60% = Muito visível\n\nO que você acha?\"
  }"

# Limpar
rm -rf watermark-samples watermark-samples.tar.gz

ENDSSH

echo "✅ Concluído!"
