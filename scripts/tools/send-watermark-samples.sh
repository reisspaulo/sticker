#!/bin/bash

# Configurações
EVOLUTION_URL="https://your-domain.com/evolution"
EVOLUTION_KEY="YOUR_EVOLUTION_API_KEY"
INSTANCE="meu-zap"
PHONE="5511999999999"
SAMPLES_DIR="watermark-samples"

echo "🎨 Enviando amostras de marca d'água para WhatsApp..."
echo ""

# Mensagem inicial
echo "📱 Enviando mensagem inicial..."
curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${PHONE}\",
    \"text\": \"🧪 *TESTE DE MARCA D'ÁGUA*\\n\\nVou enviar 5 figurinhas para você comparar:\\n\\n0️⃣ SEM marca d'água (planos pagos)\\n1️⃣ 15% opacidade (MUITO sutil)\\n2️⃣ 25% opacidade (Sutil)\\n3️⃣ 40% opacidade (Discreta)\\n4️⃣ 60% opacidade (Bem visível)\\n\\nAguarde...\",
    \"delay\": 1000
  }"

sleep 3

# Enviar sticker sem marca d'água
echo ""
echo "0️⃣ Enviando: SEM marca d'água..."
curl -X POST "${EVOLUTION_URL}/message/sendMedia/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -F "number=${PHONE}" \
  -F "mediaMessage=@${SAMPLES_DIR}/sticker-no-watermark.webp" \
  -F 'options={"delay":1000,"presence":"composing"}'

sleep 2

curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${PHONE}\",
    \"text\": \"0️⃣ *SEM Marca d'água*\\nComo ficaria para usuários Premium/Ultra\",
    \"delay\": 500
  }"

sleep 3

# Enviar sticker 15%
echo ""
echo "1️⃣ Enviando: 15% opacidade..."
curl -X POST "${EVOLUTION_URL}/message/sendMedia/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -F "number=${PHONE}" \
  -F "mediaMessage=@${SAMPLES_DIR}/sticker-watermark-15.webp" \
  -F 'options={"delay":1000,"presence":"composing"}'

sleep 2

curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${PHONE}\",
    \"text\": \"1️⃣ *15% Opacidade*\\nMUITO sutil - quase invisível\",
    \"delay\": 500
  }"

sleep 3

# Enviar sticker 25%
echo ""
echo "2️⃣ Enviando: 25% opacidade..."
curl -X POST "${EVOLUTION_URL}/message/sendMedia/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -F "number=${PHONE}" \
  -F "mediaMessage=@${SAMPLES_DIR}/sticker-watermark-25.webp" \
  -F 'options={"delay":1000,"presence":"composing"}'

sleep 2

curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${PHONE}\",
    \"text\": \"2️⃣ *25% Opacidade*\\nSutil - perceptível mas não invasiva\",
    \"delay\": 500
  }"

sleep 3

# Enviar sticker 40%
echo ""
echo "3️⃣ Enviando: 40% opacidade..."
curl -X POST "${EVOLUTION_URL}/message/sendMedia/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -F "number=${PHONE}" \
  -F "mediaMessage=@${SAMPLES_DIR}/sticker-watermark-40.webp" \
  -F 'options={"delay":1000,"presence":"composing"}'

sleep 2

curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${PHONE}\",
    \"text\": \"3️⃣ *40% Opacidade*\\nDiscreta - visível mas não incomoda\",
    \"delay\": 500
  }"

sleep 3

# Enviar sticker 60%
echo ""
echo "4️⃣ Enviando: 60% opacidade..."
curl -X POST "${EVOLUTION_URL}/message/sendMedia/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -F "number=${PHONE}" \
  -F "mediaMessage=@${SAMPLES_DIR}/sticker-watermark-60.webp" \
  -F 'options={"delay":1000,"presence":"composing"}'

sleep 2

curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${PHONE}\",
    \"text\": \"4️⃣ *60% Opacidade*\\nBem visível - mais destacada\",
    \"delay\": 500
  }"

sleep 3

# Mensagem final
echo ""
echo "📨 Enviando mensagem final..."
curl -X POST "${EVOLUTION_URL}/message/sendText/${INSTANCE}" \
  -H "apikey: ${EVOLUTION_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"number\": \"${PHONE}\",
    \"text\": \"✅ *Teste concluído!*\\n\\nQual versão você achou ideal?\\n\\n💭 *Reflexões:*\\n• 15-25% = Quase invisível, pouco incentivo para upgrade\\n• 40% = Equilíbrio entre visível e discreta\\n• 60% = Muito visível, pode frustrar usuários free\\n\\n🤔 Lembre-se: marca d'água muito invasiva pode fazer usuários desistirem do bot completamente.\\n\\nO que você acha?\",
    \"delay\": 1000
  }"

echo ""
echo "✅ Todas as amostras foram enviadas!"
