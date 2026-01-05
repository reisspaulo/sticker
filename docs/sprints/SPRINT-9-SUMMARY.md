# Sprint 9 - Download de Vídeos do Twitter (Processamento)

**Status:** ✅ CONCLUÍDO
**Data:** 28/12/2024

---

## Objetivo

Implementar o processamento de downloads de vídeos do Twitter no worker BullMQ, incluindo upload para Supabase Storage, envio via Evolution API e salvamento de metadata.

---

## Arquivos Criados

### 1. `/src/services/twitterStorage.ts` ✅

**Funções implementadas:**
- `uploadTwitterVideo(buffer, userNumber, tweetId)` - Upload de vídeos para Supabase Storage
- `deleteTwitterVideo(path)` - Deleta vídeo do storage
- `getTwitterVideoUrl(path)` - Retorna URL pública do vídeo

**Detalhes:**
- Bucket: `twitter-videos`
- Path pattern: `{userNumber}/{tweetId}-{timestamp}.mp4`
- Content-Type: `video/mp4`
- Retorna objeto com `path`, `url` e `size`

---

## Arquivos Modificados

### 2. `/src/config/queue.ts` ✅

**Alterações:**
- Adicionada nova fila: `downloadTwitterVideoQueue`
- Mesmas configurações de retry e cleanup das outras filas
- Exportada junto com as outras filas

```typescript
export const downloadTwitterVideoQueue = new Queue('download-twitter-video', queueOptions);
```

---

### 3. `/src/services/evolutionApi.ts` ✅

**Nova função adicionada:**

```typescript
export async function sendVideo(
  userNumber: string,
  videoUrl: string,
  caption?: string
): Promise<void>
```

**Detalhes:**
- Endpoint: `POST /message/sendMedia/{instance}`
- Parâmetros: `{ number, mediatype: 'video', media, caption? }`
- Logs estruturados de envio e erros
- Tratamento de erros do Evolution API

---

### 4. `/src/worker.ts` ✅

**Worker adicionado:** `downloadTwitterVideoWorker`

**Fluxo de processamento:**

1. **Step 1: Download do Twitter**
   - Chama `downloadTwitterVideo(username, tweetId)`
   - Valida sucesso e extrai buffer + metadata
   - Log de tamanho, duração e autor

2. **Step 2: Upload para Supabase Storage**
   - Chama `uploadTwitterVideo(buffer, userNumber, tweetId)`
   - Recebe `path` e `url` pública
   - Log de storage path

3. **Step 3: Envio via Evolution API**
   - Monta caption com informações do vídeo
   - Chama `sendVideo(userNumber, url, caption)`
   - Log de envio bem-sucedido

4. **Step 4: Salvar metadata no banco**
   - Insert em `twitter_downloads` com todos os dados
   - Campos: tweet_id, author, duration, size, likes, etc.
   - Não falha se houver erro (vídeo já foi enviado)

5. **Step 5: Incrementar contador do usuário**
   - Chama `incrementTwitterDownloadCount(userId)`
   - Atualiza `twitter_download_count` na tabela users

**Tratamento de erros:**
- Log estruturado de erros
- Salva erro no banco via `logError()`
- Envia mensagem de erro ao usuário
- Permite retry do BullMQ

**Configurações:**
- Concurrency: 3 downloads simultâneos
- Queue: `download-twitter-video`
- Graceful shutdown incluído

---

## Supabase Storage

### Bucket: `twitter-videos` ✅

**Configurações:**
- **Público:** true
- **Tamanho máximo:** 16 MB (limite do WhatsApp)
- **MIME types permitidos:**
  - `video/mp4`
  - `video/webm`
  - `video/quicktime`

**Criado via SQL:**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'twitter-videos',
  'twitter-videos',
  true,
  16777216,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
);
```

---

## Banco de Dados

### Tabela: `twitter_downloads` ✅

**Criada via migration:** `create_twitter_downloads_table`

**Colunas:**
- `id` (UUID) - Primary key
- `user_number` (TEXT) - Número do WhatsApp
- `tweet_id` (TEXT) - ID do tweet
- `tweet_url` (TEXT) - URL completa
- `video_url` (TEXT) - URL direta do vídeo (VxTwitter)
- `author_username` (TEXT) - @username do autor
- `author_name` (TEXT) - Nome completo do autor
- `tweet_text` (TEXT) - Texto do tweet
- `video_duration_ms` (INTEGER) - Duração em milissegundos
- `video_size_bytes` (BIGINT) - Tamanho do arquivo
- `video_resolution` (TEXT) - ex: "1920x1080"
- `likes` (INTEGER) - Curtidas do tweet
- `retweets` (INTEGER) - Retweets
- `storage_path` (TEXT) - Path no Supabase Storage
- `processed_url` (TEXT) - URL pública do vídeo
- `downloaded_at` (TIMESTAMP) - Data/hora do download
- `converted_to_sticker` (BOOLEAN) - Se foi convertido
- `sent_at` (TIMESTAMP) - Data/hora do envio

**Índices:**
- `idx_twitter_downloads_user` - em `user_number`
- `idx_twitter_downloads_tweet` - em `tweet_id`
- `idx_twitter_downloads_downloaded_at` - em `downloaded_at`

---

### Tabela: `users` - Nova coluna ✅

**Migration:** `add_twitter_download_count`

**Coluna adicionada:**
```sql
ALTER TABLE users
ADD COLUMN twitter_download_count INTEGER DEFAULT 0;
```

**Função criada:**
```sql
CREATE OR REPLACE FUNCTION increment_twitter_download_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE users
  SET twitter_download_count = twitter_download_count + 1,
      last_interaction = NOW()
  WHERE id = p_user_id
  RETURNING twitter_download_count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Arquivos Já Existentes (Sprint 8)

Os seguintes arquivos foram criados na Sprint 8 e estão sendo utilizados:

### `/src/services/twitterService.ts`
- `downloadTwitterVideo(username, tweetId)` - Download via VxTwitter API
- `getVideoMetadata(username, tweetId)` - Metadados do tweet
- Validações de tamanho e duração

### `/src/services/twitterLimits.ts`
- `checkTwitterDailyLimit(userId)` - Verifica limite diário
- `incrementTwitterDownloadCount(userId)` - Incrementa contador
- `getRemainingTwitterDownloads(userId)` - Downloads restantes
- Limite: 10 downloads/dia

### `/src/types/twitter.ts`
- `VxTwitterResponse` - Tipo da resposta da API
- `TwitterVideoMetadata` - Metadados do vídeo
- `TwitterDownloadResult` - Resultado do download
- `TwitterDownloadJobData` - Dados do job BullMQ

### `/src/utils/urlDetector.ts`
- `detectTwitterUrl(text)` - Detecta URLs do Twitter
- `extractTweetInfo(url)` - Extrai username e tweetId
- Regex: `/(twitter|x)\.com\/(\w+)\/status\/(\d+)/`

---

## Testes

### Scripts de teste disponíveis:

1. **`/scripts/test-twitter-service.ts`**
   - Testa download de vídeo do Twitter
   - Valida metadata

2. **`/scripts/test-twitter-full-flow.ts`**
   - Testa fluxo completo end-to-end
   - Simula webhook e respostas do usuário

3. **`/scripts/test-twitter-final.ts`**
   - Teste manual de download
   - Salva vídeo localmente

### Como testar:

```bash
# Testar serviço de Twitter
npx tsx scripts/test-twitter-service.ts

# Testar fluxo completo (requer servidor rodando)
npx tsx scripts/test-twitter-full-flow.ts

# Testar download manual
npx tsx scripts/test-twitter-final.ts "https://x.com/usuario/status/123456"
```

---

## Validações Implementadas

### 1. Tamanho do vídeo
- Máximo: 16 MB (limite do WhatsApp)
- Validado no download e no upload

### 2. Duração do vídeo
- Máximo: 90 segundos (limite do WhatsApp)
- Validado na função `downloadTwitterVideo()`

### 3. Formato
- Aceita: MP4, WebM, QuickTime
- VxTwitter sempre retorna MP4

---

## Mensagens ao Usuário

### Mensagem de sucesso (caption do vídeo):

```
🐦 Vídeo do Twitter baixado com sucesso!

📊 Informações:
• Autor: @username (Nome Completo)
• Duração: 10.5s
• Tamanho: 1.2 MB
• Curtidas: 1234
```

### Mensagem de erro:

```
❌ Erro ao baixar vídeo do Twitter.

[mensagem de erro específica]

💡 Tente novamente com outro link.
```

---

## Logs Estruturados

Todos os passos do processamento geram logs estruturados:

```typescript
logger.info({
  msg: 'Processing Twitter video download job',
  jobId: job.id,
  userNumber,
  tweetUrl,
  tweetId,
});
```

**Logs incluem:**
- Job ID
- User number
- Tweet URL/ID
- File size
- Duration
- Processing time
- Errors (com stack trace)

---

## Integração com Sistema Existente

### Worker mantém compatibilidade:
- ✅ Worker de stickers continua funcionando
- ✅ Worker de scheduled jobs continua funcionando
- ✅ Graceful shutdown funciona para todos os workers
- ✅ Logs estruturados seguem mesmo padrão

### Contadores separados:
- `daily_count` - Para stickers
- `twitter_download_count` - Para vídeos do Twitter
- Limites independentes (10 cada)

---

## Próximos Passos (Sprint 10)

A Sprint 10 deve implementar:

1. **Detecção de URLs no webhook**
   - Modificar `/src/routes/webhook.ts`
   - Detectar links do Twitter em mensagens de texto
   - Criar job `download-twitter-video`

2. **Sistema de contexto (Redis)**
   - Pergunta "Quer transformar em figurinha?"
   - Aguardar resposta "sim" ou "não"
   - Timeout de 5 minutos

3. **Conversão para sticker**
   - Reutilizar FFmpeg existente
   - Criar job `video-to-sticker`
   - Marcar `converted_to_sticker = true`

---

## Verificação de Conclusão

- [x] Bucket `twitter-videos` criado
- [x] Tabela `twitter_downloads` criada
- [x] Coluna `twitter_download_count` adicionada
- [x] Função `increment_twitter_download_count` criada
- [x] Arquivo `twitterStorage.ts` criado
- [x] Fila `downloadTwitterVideoQueue` adicionada
- [x] Função `sendVideo()` implementada
- [x] Worker `downloadTwitterVideoWorker` implementado
- [x] Event handlers configurados
- [x] Graceful shutdown atualizado
- [x] Projeto compila sem erros
- [x] Logs estruturados implementados
- [x] Tratamento de erros completo

---

## Build Status

```bash
npm run build
```

**Resultado:** ✅ Build bem-sucedido, sem erros TypeScript

---

## Comandos para Desenvolvimento

```bash
# Desenvolvimento (modo watch)
npm run dev:worker

# Produção
npm run start:worker

# Build
npm run build

# Testes
npx tsx scripts/test-twitter-service.ts
```

---

## Observações Importantes

1. **Sprint 8 foi parcialmente implementada** - Os serviços principais (twitterService, twitterLimits, urlDetector) já existiam
2. **Sprint 9 completou o worker** - Implementou o processamento assíncrono via BullMQ
3. **Sprint 10 falta** - Integração com webhook e sistema de contexto

---

**Conclusão:** Sprint 9 foi completada com sucesso! O worker de download de vídeos do Twitter está funcional e integrado ao sistema existente, mantendo compatibilidade com os workers de stickers e jobs agendados.
