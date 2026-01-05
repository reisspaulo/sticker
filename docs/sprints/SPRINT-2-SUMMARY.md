# Sprint 2 - Webhook & Message Detection

**Data de Conclusao:** 26/12/2024
**Status:** COMPLETA
**Duracao:** 1 dia

---

## Resumo Executivo

Sprint 2 implementou o sistema completo de recebimento e validacao de webhooks da Evolution API, incluindo deteccao inteligente de tipos de mensagem, validacoes robustas e enfileiramento de jobs para processamento.

---

## Objetivos Alcancados

- Endpoint webhook funcional
- Validacao de API key via middleware
- Deteccao de tipos de mensagem (imagem vs GIF)
- Validacoes completas (formato, tamanho, duracao)
- Integracao com BullMQ para enfileiramento
- Logs estruturados
- Testes automatizados (8 cenarios)

---

## Arquivos Criados

### Codigo TypeScript (3 novos)
1. `/src/types/evolution.ts` - Tipos e interfaces (79 linhas)
2. `/src/middleware/auth.ts` - Validacao de API key (35 linhas)
3. `/src/utils/messageValidator.ts` - Validacao de mensagens (155 linhas)

### Arquivo Modificado
1. `/src/routes/webhook.ts` - Endpoint webhook completo (145 linhas)

### Scripts
1. `/scripts/test-webhook.sh` - 8 cenarios de teste automatizados (245 linhas)

**Total de linhas de codigo:** ~614

---

## Features Implementadas

### 1. Autenticacao
- Validacao de API key via header `apikey`
- Retorno 401 se ausente
- Retorno 403 se invalida

### 2. Deteccao de Mensagens
- imageMessage (JPG, PNG, WebP)
- videoMessage com gifPlayback=true (GIFs em MP4/WebM)
- Ignora outros tipos (texto, audio, etc)

### 3. Validacoes

**Imagens:**
- Formato: JPG, PNG, WebP
- Tamanho: <= 5MB
- URL obrigatoria

**GIFs:**
- Formato: MP4, WebM
- gifPlayback: true
- Tamanho: <= 5MB
- Duracao: <= 10s

### 4. Enfileiramento
- Jobs adicionados na queue `process-sticker` (BullMQ)
- Job ID unico: `{userNumber}-{timestamp}`
- Dados completos para processamento

### 5. Logs Estruturados
- Webhook recebido
- Mensagem processada
- Validacao falhou
- Job adicionado
- Erros com stack trace

---

## Codigos de Erro

1. `UNSUPPORTED_MESSAGE_TYPE` - Nao e imagem nem GIF
2. `MISSING_IMAGE_URL` - URL ausente
3. `INVALID_IMAGE_FORMAT` - Formato nao aceito
4. `IMAGE_TOO_LARGE` - >5MB
5. `NOT_A_GIF` - Video sem gifPlayback
6. `MISSING_GIF_URL` - URL ausente
7. `INVALID_GIF_FORMAT` - Formato nao aceito
8. `GIF_TOO_LARGE` - >5MB
9. `GIF_TOO_LONG` - >10s

---

## Estrutura de Resposta

### Sucesso (200)
```json
{
  "status": "queued",
  "jobId": "5511999999999-1703634567890",
  "messageType": "image",
  "processingTime": 25
}
```

### Validacao Falhou (400)
```json
{
  "status": "validation_failed",
  "error": "Image too large (6.00MB). Maximum size is 5MB",
  "errorCode": "IMAGE_TOO_LARGE"
}
```

### Ignorado (200)
```json
{
  "status": "ignored",
  "reason": "not an image or gif"
}
```

---

## Como Testar

### 1. Iniciar Servicos
```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Bot
npm run dev
```

### 2. Testes Automatizados
```bash
export EVOLUTION_API_KEY="your-key"
./scripts/test-webhook.sh
```

### 3. Configurar Webhook na Evolution API
```bash
curl -X POST http://localhost:8080/webhook/set/meu-zap \
  -H "apikey: your-evolution-key" \
  -d '{
    "url": "http://localhost:3000/webhook",
    "webhook_by_events": true,
    "events": ["MESSAGES_UPSERT"]
  }'
```

---

## Testes Implementados

### Automatizados (8 cenarios via test-webhook.sh)
1. Request sem API key → 401
2. Imagem valida → 200 + job
3. GIF valido → 200 + job
4. Imagem grande → 400
5. GIF longo → 400
6. Formato invalido → 400
7. Texto → ignorado
8. Mensagem propria → ignorada

### Build & Lint
- `npm run build` - Sem erros
- `npm run lint` - 1 warning (pre-existente)

---

## Metricas

| Metrica | Valor |
|---------|-------|
| Linhas de codigo | ~614 |
| Arquivos novos | 4 |
| Arquivos modificados | 1 |
| Funcoes | 8 |
| Tipos/Interfaces | 10 |
| Validacoes | 9 |
| Testes | 8 cenarios |

---

## Dependencias Utilizadas

- Fastify (HTTP server)
- BullMQ (Job queue)
- IORedis (Redis client)
- Pino (Logger)
- TypeScript

---

## Criterios de Aceitacao - TODOS ATENDIDOS

- Webhook recebe mensagens da Evolution API
- Valida API key no header
- Detecta imageMessage vs videoMessage
- Valida formato (JPG, PNG, WebP, MP4, WebM)
- Valida tamanho (<5MB)
- Valida duracao de GIF (<10s)
- Retorna erros personalizados
- Adiciona job na fila BullMQ
- Logs estruturados
- Testes funcionando

---

## Proximos Passos (Sprint 3)

1. **Worker de Processamento**
   - Consumir jobs da fila
   - Download de arquivos
   - Conversao para stickers
   - Upload via Evolution API

2. **Gerenciamento de Limites**
   - Consultar Supabase
   - Verificar limite diario (10 conversoes)
   - Reset automatico

3. **Tratamento de Erros**
   - Retry de downloads
   - Fallback de conversao
   - Cleanup de arquivos temporarios

---

**Versao:** 1.0.0
**Desenvolvido por:** Claude Sonnet 4.5
