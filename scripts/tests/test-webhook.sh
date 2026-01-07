#!/bin/bash

# Test Webhook Script
# Tests different scenarios for the webhook endpoint

WEBHOOK_URL="http://localhost:3000/webhook"
API_KEY="${EVOLUTION_API_KEY:-your-api-key-here}"

echo "========================================="
echo "Testing Sticker Bot Webhook Endpoint"
echo "========================================="
echo ""

# Test 1: Invalid API Key
echo "Test 1: Request without API key (should fail with 401)"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "test-instance",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test-123"
      },
      "pushName": "Test User"
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "========================================="
echo ""

# Test 2: Valid Image Message
echo "Test 2: Valid image message (should succeed)"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "event": "messages.upsert",
    "instance": "test-instance",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test-456"
      },
      "pushName": "Test User",
      "messageType": "imageMessage",
      "message": {
        "imageMessage": {
          "url": "https://example.com/image.jpg",
          "mimetype": "image/jpeg",
          "fileLength": 1048576,
          "caption": "Test image"
        }
      }
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "========================================="
echo ""

# Test 3: Valid GIF Message
echo "Test 3: Valid GIF message (should succeed)"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "event": "messages.upsert",
    "instance": "test-instance",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test-789"
      },
      "pushName": "Test User",
      "messageType": "videoMessage",
      "message": {
        "videoMessage": {
          "url": "https://example.com/animation.mp4",
          "mimetype": "video/mp4",
          "fileLength": 2097152,
          "seconds": 5,
          "gifPlayback": true
        }
      }
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "========================================="
echo ""

# Test 4: Image too large
echo "Test 4: Image too large (should fail)"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "event": "messages.upsert",
    "instance": "test-instance",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test-large"
      },
      "pushName": "Test User",
      "messageType": "imageMessage",
      "message": {
        "imageMessage": {
          "url": "https://example.com/large.jpg",
          "mimetype": "image/jpeg",
          "fileLength": 6291456
        }
      }
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "========================================="
echo ""

# Test 5: GIF too long
echo "Test 5: GIF too long (should fail)"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "event": "messages.upsert",
    "instance": "test-instance",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test-long"
      },
      "pushName": "Test User",
      "messageType": "videoMessage",
      "message": {
        "videoMessage": {
          "url": "https://example.com/long.mp4",
          "mimetype": "video/mp4",
          "fileLength": 2097152,
          "seconds": 15,
          "gifPlayback": true
        }
      }
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "========================================="
echo ""

# Test 6: Invalid format
echo "Test 6: Invalid image format (should fail)"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "event": "messages.upsert",
    "instance": "test-instance",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test-invalid"
      },
      "pushName": "Test User",
      "messageType": "imageMessage",
      "message": {
        "imageMessage": {
          "url": "https://example.com/image.bmp",
          "mimetype": "image/bmp",
          "fileLength": 1048576
        }
      }
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "========================================="
echo ""

# Test 7: Text message (should be ignored)
echo "Test 7: Text message (should be ignored)"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "event": "messages.upsert",
    "instance": "test-instance",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "test-text"
      },
      "pushName": "Test User",
      "messageType": "conversation",
      "message": {
        "conversation": "Hello, this is a text message"
      }
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "========================================="
echo ""

# Test 8: Message from self (should be ignored)
echo "Test 8: Message from self (should be ignored)"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "event": "messages.upsert",
    "instance": "test-instance",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": true,
        "id": "test-fromme"
      },
      "pushName": "Bot",
      "message": {
        "imageMessage": {
          "url": "https://example.com/image.jpg",
          "mimetype": "image/jpeg",
          "fileLength": 1048576
        }
      }
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n\n"

echo "========================================="
echo "All tests completed!"
echo "========================================="
