# Como Usar a Funcionalidade de Download de Vídeos do Twitter

## Visão Geral

O bot agora pode detectar URLs do Twitter/X em mensagens de texto e preparar jobs para download de vídeos.

---

## Fluxo de Uso

### 1. Usuário Envia Mensagem com URL

O usuário envia uma mensagem de texto contendo uma URL do Twitter:

```
Olá, baixa esse vídeo: https://x.com/username/status/1234567890
```

ou

```
https://twitter.com/username/status/1234567890
```

### 2. Bot Detecta e Valida

O bot:
1. Detecta a URL do Twitter na mensagem
2. Extrai o username e tweet ID
3. Valida o formato da URL
4. Cria um job na fila `download-twitter-video`

### 3. Resposta do Webhook

O webhook retorna:

```json
{
  "status": "queued",
  "jobId": "twitter-5511999999999-1703771234567",
  "messageType": "twitter_video",
  "processingTime": 45
}
```

---

## URLs Suportadas

### Formatos Aceitos

- `https://twitter.com/username/status/1234567890`
- `https://x.com/username/status/1234567890`
- `http://twitter.com/username/status/1234567890` (raro)
- `http://x.com/username/status/1234567890` (raro)

### Com ou Sem www

- `https://www.twitter.com/...` ✅
- `https://twitter.com/...` ✅
- `https://www.x.com/...` ✅
- `https://x.com/...` ✅

### Texto ao Redor

O bot detecta URLs mesmo com texto ao redor:

```
"Olá, veja isso: https://x.com/user/status/123 é incrível!"
```

---

## Validações Aplicadas

### No Webhook (antes do download)

1. **Formato da URL**
   - Deve corresponder ao padrão `(twitter|x).com/username/status/ID`
   - Username e ID devem estar presentes

### No Serviço de Download

1. **Tamanho do Arquivo**
   - Máximo: 16MB (limite do WhatsApp)
   - Se maior, retorna erro

2. **Duração do Vídeo**
   - Máximo: 90 segundos (limite do WhatsApp)
   - Se maior, retorna erro

3. **Existência do Vídeo**
   - Verifica se o tweet contém vídeo
   - Aceita tipos: `video` e `gif`

---

## Job Data

Quando uma URL do Twitter é detectada, o seguinte job é criado:

```typescript
{
  userNumber: "5511999999999",
  userName: "João Silva",
  tweetUrl: "https://x.com/username/status/1234567890",
  tweetId: "1234567890",
  username: "username",
  userId: "uuid-do-usuario",
  messageId: "message-id-whatsapp"
}
```

Este job é adicionado à fila `download-twitter-video` para processamento posterior.

---

## Testes

### Teste de Detecção de URL

```bash
npx tsx scripts/test-url-detector.ts
```

Este teste verifica:
- Detecção de URLs do Twitter/X
- Extração de username e tweet ID
- Validação de formatos
- Rejeição de URLs inválidas

### Teste de Integração

```bash
npx tsx scripts/test-integration.ts
```

Este teste verifica:
- Validação de mensagens com URLs do Twitter
- Compatibilidade com mensagens de imagem/GIF
- Tipo correto de mensagem (`twitter_video`)
- Fluxo completo de validação

### Teste de Download (quando API estiver estável)

```bash
npx tsx scripts/test-twitter-service.ts "https://x.com/username/status/123"
```

Este teste verifica:
- Busca de metadados via VxTwitter API
- Download do vídeo
- Salvamento em disco
- Validações de tamanho e duração

---

## Exemplos de Uso

### Exemplo 1: URL Simples

**Entrada:**
```
https://x.com/NASA/status/1234567890
```

**Processamento:**
- URL detectada: ✅
- Username: `NASA`
- Tweet ID: `1234567890`
- Job criado: ✅

### Exemplo 2: URL com Texto

**Entrada:**
```
Olá! Baixa esse vídeo pra mim: https://twitter.com/SpaceX/status/9876543210
```

**Processamento:**
- URL detectada: ✅
- Username: `SpaceX`
- Tweet ID: `9876543210`
- Job criado: ✅

### Exemplo 3: URL Inválida

**Entrada:**
```
https://twitter.com/user/invalid
```

**Processamento:**
- URL detectada: ❌
- Erro: "Only images and GIFs are supported"
- Job criado: ❌

---

## Compatibilidade

### Mensagens de Imagem

Continuam funcionando normalmente:

**Entrada:** Usuário envia foto
**Tipo:** `image`
**Processamento:** Fila `process-sticker`

### Mensagens de GIF

Continuam funcionando normalmente:

**Entrada:** Usuário envia GIF
**Tipo:** `gif`
**Processamento:** Fila `process-sticker`

### Mensagens de Texto com URL do Twitter

Nova funcionalidade:

**Entrada:** Usuário envia URL do Twitter
**Tipo:** `twitter_video`
**Processamento:** Fila `download-twitter-video`

---

## API VxTwitter

### Endpoint

```
https://api.vxtwitter.com/{username}/status/{tweetId}
```

### Exemplo de Resposta

```json
{
  "tweetID": "1234567890",
  "user_name": "Name",
  "user_screen_name": "username",
  "text": "Tweet text here",
  "date": "2024-12-28T10:00:00.000Z",
  "hasMedia": true,
  "mediaURLs": ["https://..."],
  "media_extended": [
    {
      "type": "video",
      "url": "https://video.twimg.com/...",
      "thumbnail_url": "https://...",
      "duration_millis": 15000,
      "size": {
        "width": 1280,
        "height": 720
      }
    }
  ],
  "likes": 1000,
  "retweets": 500
}
```

### Tratamento de Erros

- **404**: Tweet não encontrado ou deletado
- **429**: Rate limit atingido
- **Timeout**: Requisição demorou mais de 10s
- **No Media**: Tweet não contém vídeo

---

## Logs

### Detecção de URL

```
INFO: Processing message
  userNumber: "5511999999999"
  userName: "João Silva"
  detectedType: "twitter_video"
```

### Job Criado

```
INFO: Twitter video job added to queue
  jobId: "twitter-5511999999999-1703771234567"
  userNumber: "5511999999999"
  tweetId: "1234567890"
  processingTime: 45
```

### Erro de Validação

```
WARN: Message validation failed
  userNumber: "5511999999999"
  error: "URL do Twitter inválida"
  errorCode: "INVALID_TWITTER_URL"
```

---

## Banco de Dados

### Tabela: `twitter_downloads`

Metadados dos downloads são salvos aqui:

```sql
SELECT
  user_number,
  tweet_id,
  tweet_username,
  status,
  created_at
FROM twitter_downloads
WHERE user_number = '5511999999999'
ORDER BY created_at DESC;
```

### Campos Principais

- `user_number`: Número do WhatsApp
- `tweet_id`: ID do tweet
- `tweet_url`: URL original
- `video_url`: URL do vídeo no Twitter
- `status`: Status do download
- `error_message`: Mensagem de erro (se houver)

---

## Próximos Passos (Sprint 9)

Para completar a funcionalidade, será necessário:

1. **Criar Worker**
   - Processar jobs da fila `download-twitter-video`
   - Baixar vídeo usando `twitterService.downloadTwitterVideo()`
   - Salvar no Supabase Storage
   - Atualizar banco de dados
   - Enviar vídeo para usuário via WhatsApp

2. **Implementar Conversão** (opcional)
   - Converter vídeo para sticker
   - Cortar/comprimir se necessário

3. **Adicionar Melhorias**
   - Cache de vídeos já baixados
   - Retry logic
   - Estatísticas de uso

---

## Comandos Úteis

```bash
# Compilar projeto
npm run build

# Rodar testes
npx tsx scripts/test-url-detector.ts
npx tsx scripts/test-integration.ts

# Testar download (quando API estiver estável)
npx tsx scripts/test-twitter-service.ts "https://x.com/user/status/123"

# Ver logs do Supabase
# (usar ferramenta MCP: mcp__supabase__get_logs)
```

---

## Troubleshooting

### URL não detectada

**Problema:** Bot não reconhece URL do Twitter

**Solução:**
1. Verificar formato da URL
2. Deve conter `/status/` seguido de números
3. Testar com `test-url-detector.ts`

### Erro "No video found"

**Problema:** Tweet não contém vídeo

**Solução:**
1. Verificar se tweet realmente tem vídeo
2. Acessar tweet no navegador
3. VxTwitter API pode estar instável

### API VxTwitter instável

**Problema:** API retorna HTML em vez de JSON

**Solução:**
1. Aguardar estabilização da API
2. Tentar com tweets mais antigos
3. Verificar status da API em GitHub

---

## Suporte

Para dúvidas ou problemas:

1. Verificar logs do servidor
2. Rodar testes de integração
3. Consultar documentação completa em `SPRINT_8_IMPLEMENTATION.md`
