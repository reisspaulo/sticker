#!/bin/bash

# Exemplos práticos de uso da Evolution API com cURL

API_KEY="YOUR_EVOLUTION_API_KEY"
API_URL="http://localhost:8080"
INSTANCE="meu-whatsapp"

echo "========================================"
echo "Evolution API - Exemplos com cURL"
echo "========================================"
echo ""

# 1. Criar Instância
echo "1️⃣  Criar Instância"
echo "---"
echo "curl -X POST $API_URL/instance/create \\"
echo "  -H 'apikey: $API_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"instanceName\": \"$INSTANCE\","
echo "    \"integration\": \"WHATSAPP-BAILEYS\""
echo "  }'"
echo ""

# 2. Obter QR Code
echo "2️⃣  Obter QR Code"
echo "---"
echo "curl $API_URL/instance/connect/$INSTANCE \\"
echo "  -H 'apikey: $API_KEY' | jq ."
echo ""

# 3. Verificar Status
echo "3️⃣  Verificar Status da Conexão"
echo "---"
echo "curl $API_URL/instance/connectionState/$INSTANCE \\"
echo "  -H 'apikey: $API_KEY' | jq ."
echo ""

# 4. Enviar Mensagem de Texto
echo "4️⃣  Enviar Mensagem de Texto"
echo "---"
echo "curl -X POST $API_URL/message/sendText/$INSTANCE \\"
echo "  -H 'apikey: $API_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"number\": \"5511999999999\","
echo "    \"text\": \"Olá! Mensagem via Evolution API\""
echo "  }' | jq ."
echo ""

# 5. Enviar Imagem
echo "5️⃣  Enviar Imagem"
echo "---"
echo "curl -X POST $API_URL/message/sendMedia/$INSTANCE \\"
echo "  -H 'apikey: $API_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"number\": \"5511999999999\","
echo "    \"mediatype\": \"image\","
echo "    \"media\": \"https://picsum.photos/512/512\","
echo "    \"caption\": \"Imagem de exemplo\""
echo "  }' | jq ."
echo ""

# 6. Enviar Sticker
echo "6️⃣  Enviar Sticker (Figurinha)"
echo "---"
echo "curl -X POST $API_URL/message/sendSticker/$INSTANCE \\"
echo "  -H 'apikey: $API_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"number\": \"5511999999999\","
echo "    \"sticker\": {"
echo "      \"image\": \"https://picsum.photos/512/512\""
echo "    }"
echo "  }' | jq ."
echo ""

# 7. Listar Todas as Instâncias
echo "7️⃣  Listar Todas as Instâncias"
echo "---"
echo "curl $API_URL/instance/fetchInstances \\"
echo "  -H 'apikey: $API_KEY' | jq ."
echo ""

# 8. Buscar Conversas
echo "8️⃣  Buscar Conversas"
echo "---"
echo "curl $API_URL/chat/findChats/$INSTANCE \\"
echo "  -H 'apikey: $API_KEY' | jq ."
echo ""

# 9. Enviar Localização
echo "9️⃣  Enviar Localização"
echo "---"
echo "curl -X POST $API_URL/message/sendLocation/$INSTANCE \\"
echo "  -H 'apikey: $API_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"number\": \"5511999999999\","
echo "    \"latitude\": -23.550520,"
echo "    \"longitude\": -46.633308,"
echo "    \"name\": \"Av. Paulista\","
echo "    \"address\": \"Avenida Paulista, São Paulo - SP\""
echo "  }' | jq ."
echo ""

# 10. Deletar Instância
echo "🔟 Deletar Instância (CUIDADO!)"
echo "---"
echo "curl -X DELETE $API_URL/instance/delete/$INSTANCE \\"
echo "  -H 'apikey: $API_KEY' | jq ."
echo ""

echo "========================================"
echo "💡 Dica: Remova '| jq .' se não tiver jq instalado"
echo "========================================"
