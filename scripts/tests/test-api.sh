#!/bin/bash

# Evolution API - Script de Teste
# Use este script para testar a API sem precisar do Manager

API_KEY="I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
API_URL="http://localhost:8080"

echo "========================================="
echo "Evolution API - Testes Rápidos"
echo "========================================="
echo ""

# 1. Testar se a API está online
echo "1. Testando se a API está online..."
curl -s $API_URL/ | jq .
echo ""
echo ""

# 2. Criar uma instância
echo "2. Criar uma instância do WhatsApp"
echo "Execute este comando para criar:"
echo ""
echo "curl -X POST $API_URL/instance/create \\"
echo "  -H 'apikey: $API_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"instanceName\": \"meu-whatsapp\", \"qrcode\": true}'"
echo ""
echo ""

# 3. Conectar e obter QR Code
echo "3. Obter QR Code (após criar a instância):"
echo ""
echo "curl $API_URL/instance/connect/meu-whatsapp \\"
echo "  -H 'apikey: $API_KEY'"
echo ""
echo ""

# 4. Verificar status da conexão
echo "4. Verificar status da conexão:"
echo ""
echo "curl $API_URL/instance/connectionState/meu-whatsapp \\"
echo "  -H 'apikey: $API_KEY'"
echo ""
echo ""

# 5. Enviar mensagem
echo "5. Enviar mensagem de texto:"
echo ""
echo "curl -X POST $API_URL/message/sendText/meu-whatsapp \\"
echo "  -H 'apikey: $API_KEY' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"number\": \"5511999999999\", \"text\": \"Olá!\"}'"
echo ""
echo ""

# 6. Listar todas as instâncias
echo "6. Listar todas as instâncias:"
echo ""
echo "curl $API_URL/instance/fetchInstances \\"
echo "  -H 'apikey: $API_KEY' | jq ."
echo ""
echo ""

echo "========================================="
echo "Documentação completa:"
echo "https://doc.evolution-api.com/v2/pt"
echo "========================================="
