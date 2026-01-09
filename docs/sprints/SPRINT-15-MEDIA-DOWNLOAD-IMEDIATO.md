# Sprint 15 - Download de Midia Imediato no Webhook

**Status:** INVESTIGACAO
**Data Inicio:** 09/01/2026
**Ultima Atualizacao:** 09/01/2026

---

## Resumo Executivo

### O Que E?

Mudanca arquitetural para baixar midia do WhatsApp imediatamente no webhook, antes de criar o job na fila. Isso previne erro 400 quando midia expira.

### Por Que?

Em 09/01/2026, usuario Carlos Bistecone enviou 4 imagens de uma vez. 3 processaram ok, 1 falhou com Error 400 porque a midia expirou antes do worker processar.

### Objetivo

Garantir que **100% das midias** sejam baixadas enquanto ainda estao disponiveis no WhatsApp, eliminando falhas por expiracao.

---

## Problema Detalhado

### Bug 1: JobId Duplicado ✅ CORRIGIDO (09/01/2026)

**Status:** ✅ Fix deployado em 09/01/2026

**Caso real:** Usuario Arielle enviou 11 imagens, apenas 4 foram processadas!

```typescript
// webhook.ts L1726 - ANTES (BUG):
jobId: `${userNumber}-${Date.now()}`,

// DEPOIS (FIX):
jobId: `${userNumber}-${Date.now()}-${body.data.key.id}`,
```

**Problema:** `Date.now()` tem precisao de milissegundos. Se 2 imagens chegam no mesmo milissegundo, elas tem o **mesmo jobId**. BullMQ rejeita jobIds duplicados silenciosamente!

**Commit:** `01abc10` - fix(webhook): prevent jobId collision when multiple images arrive simultaneously

**Impacto corrigido:** ~30-50% das imagens perdidas quando usuario envia multiplas de uma vez.

---

### Bug 2: Media Expirada (Error 400)

```
Usuario envia 4 imagens rapidamente
        |
        v
Webhook cria 4 jobs na fila (quase instantaneo)
        |
        v
Worker pega Job 1 -> downloadMedia() -> OK
Worker pega Job 2 -> downloadMedia() -> OK
Worker pega Job 3 -> downloadMedia() -> OK
Worker pega Job 4 -> downloadMedia() -> ERROR 400 (midia expirou!)
```

### Por Que Acontece?

1. **WhatsApp mantem midia temporariamente** - URLs expiram em minutos
2. **Jobs competem por recursos** - Concurrency 5, mas podem atrasar
3. **Fila pode ter jobs pendentes** - Novos jobs esperam
4. **Download so acontece no worker** - Tarde demais

### Logs do Caso Real (Carlos Bistecone)

```
08:42:15 - Recebeu imagem 1 -> Job criado
08:42:15 - Recebeu imagem 2 -> Job criado
08:42:16 - Recebeu imagem 3 -> Job criado
08:42:16 - Recebeu imagem 4 -> Job criado
08:42:17 - Worker processou Job 1 -> OK
08:42:18 - Worker processou Job 2 -> OK
08:42:19 - Worker processou Job 3 -> OK
08:42:20 - Worker processou Job 4 -> ERROR 400
```

### Impacto

| Metrica | Valor |
|---------|-------|
| Frequencia estimada | 5-10% dos usuarios que enviam multiplas imagens |
| Experiencia do usuario | Frustrante (imagem "some") |
| Logs de erro | Dificil diagnosticar |

---

## Arquitetura Atual (Problema)

### Fluxo Visual

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL (COM BUG)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌─────────┐               │
│  │ WhatsApp │───>│ Evolution API│───>│ Webhook │               │
│  └──────────┘    └──────────────┘    └────┬────┘               │
│                                           │                     │
│                                           v                     │
│                                    ┌─────────────┐              │
│                                    │ Cria Job    │              │
│                                    │ (messageKey)│              │
│                                    └──────┬──────┘              │
│                                           │                     │
│                                           v                     │
│                                    ┌─────────────┐              │
│                                    │ Fila BullMQ │              │
│                                    └──────┬──────┘              │
│                                           │                     │
│                              ┌────────────┼────────────┐        │
│                              │            │            │        │
│                              v            v            v        │
│                         ┌────────┐   ┌────────┐   ┌────────┐   │
│                         │ Job 1  │   │ Job 2  │   │ Job 3  │   │
│                         └───┬────┘   └───┬────┘   └───┬────┘   │
│                             │            │            │        │
│                             v            v            v        │
│                       downloadMedia  downloadMedia  downloadMedia│
│                             │            │            │        │
│                             v            v            v        │
│                            OK           OK        ERROR 400    │
│                                                   (expirou!)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Codigo Atual (webhook.ts L1710-1727)

```typescript
// Job data salva apenas messageKey - download acontece DEPOIS
const jobData: ProcessStickerJobData = {
  userNumber,
  userName,
  messageType: validation.messageType as 'image' | 'gif',
  fileUrl: validation.fileUrl,
  messageKey: body.data.key,  // <-- PROBLEMA: So guarda referencia
  mimetype: validation.mimetype,
  fileLength: validation.fileLength,
  duration: validation.duration,
  userId: user.id,
  status: !limitCheck.allowed ? 'pendente' : 'enviado',
};

const job = await processStickerQueue.add('process-sticker', jobData, {
  jobId: `${userNumber}-${Date.now()}`,
});
```

### Codigo Atual (worker.ts - processStaticSticker)

```typescript
// Worker baixa midia usando messageKey - pode ter expirado!
const stickerBuffer = await processStaticSticker(jobData.messageKey);
```

### Codigo Atual (stickerProcessor.ts L22)

```typescript
// Download acontece aqui - se expirou, Error 400
const imageBuffer = await downloadMedia(messageKey);
```

---

## Arquitetura Proposta (Opcao A)

### Fluxo Visual

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO PROPOSTO (OPCAO A)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌─────────┐               │
│  │ WhatsApp │───>│ Evolution API│───>│ Webhook │               │
│  └──────────┘    └──────────────┘    └────┬────┘               │
│                                           │                     │
│                                           v                     │
│                                    ┌─────────────┐              │
│                                    │ 1. Download │ <-- IMEDIATO!│
│                                    │   (midia    │              │
│                                    │    fresca)  │              │
│                                    └──────┬──────┘              │
│                                           │                     │
│                                           v                     │
│                                    ┌─────────────┐              │
│                                    │ 2. Upload   │              │
│                                    │   Supabase  │              │
│                                    │ (temp-media)│              │
│                                    └──────┬──────┘              │
│                                           │                     │
│                                           v                     │
│                                    ┌─────────────┐              │
│                                    │ 3. Cria Job │              │
│                                    │(storagePath)│              │
│                                    └──────┬──────┘              │
│                                           │                     │
│                                           v                     │
│                                    ┌─────────────┐              │
│                                    │ Fila BullMQ │              │
│                                    └──────┬──────┘              │
│                                           │                     │
│                              ┌────────────┼────────────┐        │
│                              │            │            │        │
│                              v            v            v        │
│                         ┌────────┐   ┌────────┐   ┌────────┐   │
│                         │ Job 1  │   │ Job 2  │   │ Job 3  │   │
│                         └───┬────┘   └───┬────┘   └───┬────┘   │
│                             │            │            │        │
│                             v            v            v        │
│                       downloadFromStorage (nunca expira!)      │
│                             │            │            │        │
│                             v            v            v        │
│                            OK           OK           OK        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Principio

```
ANTES: Webhook guarda REFERENCIA (messageKey) -> Worker baixa DEPOIS
DEPOIS: Webhook baixa AGORA -> Guarda ARQUIVO -> Worker le ARQUIVO
```

---

## Componentes Afetados

### Arquivos a MODIFICAR

| Arquivo | O Que Muda | Linhas Aproximadas | Risco |
|---------|------------|-------------------|-------|
| `src/routes/webhook.ts` | Adiciona download + upload antes de criar job | L1700-1730 | ALTO |
| `src/worker.ts` | Le do Storage em vez de Evolution API | L200-300 | MEDIO |
| `src/services/stickerProcessor.ts` | Recebe buffer direto ou path | L13-22 | MEDIO |
| `src/services/gifProcessor.ts` | Recebe buffer direto ou path | Similar | MEDIO |
| `src/services/supabaseStorage.ts` | Adiciona funcoes para temp-media | Novas funcoes | BAIXO |
| `src/types/jobs.ts` ou inline | Atualiza interface ProcessStickerJobData | Tipo | BAIXO |

### Arquivos que NAO MUDAM

| Arquivo | Motivo |
|---------|--------|
| `src/services/evolutionApi.ts` | Funcao downloadMedia continua igual |
| `src/services/avisaApi.ts` | Nao relacionado com midia |
| `src/config/queue.ts` | Estrutura das filas nao muda |
| `src/config/supabase.ts` | Configuracao nao muda |
| `Dockerfile` | Sem novas dependencias |
| `docker-compose.yml` | Infraestrutura nao muda |

---

## Mudancas de Codigo Detalhadas

### 1. Supabase Storage (supabaseStorage.ts)

**Novas funcoes a adicionar:**

```typescript
// Bucket: temp-media (arquivos temporarios, auto-cleanup 24h)

/**
 * Upload midia temporaria (antes de processar)
 * @param buffer - Buffer da midia baixada
 * @param userNumber - Numero do usuario
 * @param mimetype - Tipo da midia (image/jpeg, image/gif, etc)
 * @returns Path no storage
 */
export async function uploadTempMedia(
  buffer: Buffer,
  userNumber: string,
  mimetype: string
): Promise<string> {
  const sanitizedNumber = userNumber.replace(/[^0-9]/g, '');
  const timestamp = Date.now();
  const randomId = randomBytes(8).toString('hex');

  // Determina extensao pelo mimetype
  const ext = mimetype.includes('gif') ? 'gif' :
              mimetype.includes('png') ? 'png' : 'jpg';

  const path = `${sanitizedNumber}/${timestamp}_${randomId}.${ext}`;

  const { error } = await supabase.storage
    .from('temp-media')
    .upload(path, buffer, {
      contentType: mimetype,
      cacheControl: '3600',
    });

  if (error) {
    throw new Error(`Failed to upload temp media: ${error.message}`);
  }

  return path;
}

/**
 * Download midia temporaria do storage
 * @param path - Path retornado pelo uploadTempMedia
 * @returns Buffer da midia
 */
export async function downloadTempMedia(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from('temp-media')
    .download(path);

  if (error) {
    throw new Error(`Failed to download temp media: ${error.message}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Deleta midia temporaria apos processar
 * @param path - Path no storage
 */
export async function deleteTempMedia(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('temp-media')
    .remove([path]);

  if (error) {
    logger.warn({ msg: 'Failed to delete temp media', path, error });
    // Nao lanca erro - cleanup vai pegar depois
  }
}
```

### 2. Webhook (webhook.ts)

**ANTES (L1710-1727):**
```typescript
const jobData: ProcessStickerJobData = {
  userNumber,
  userName,
  messageType: validation.messageType as 'image' | 'gif',
  fileUrl: validation.fileUrl,
  messageKey: body.data.key,
  mimetype: validation.mimetype,
  fileLength: validation.fileLength,
  duration: validation.duration,
  userId: user.id,
  status: !limitCheck.allowed ? 'pendente' : 'enviado',
};

const job = await processStickerQueue.add('process-sticker', jobData, {
  jobId: `${userNumber}-${Date.now()}`,
});
```

**DEPOIS:**
```typescript
// 1. Download midia IMEDIATAMENTE (enquanto fresca)
let tempMediaPath: string | undefined;
try {
  const mediaBuffer = await downloadMedia(body.data.key);

  // 2. Upload para storage temporario
  tempMediaPath = await uploadTempMedia(
    mediaBuffer,
    userNumber,
    validation.mimetype
  );

  fastify.log.info({
    msg: 'Media downloaded and uploaded to temp storage',
    userNumber,
    tempMediaPath,
    size: mediaBuffer.length,
  });
} catch (downloadError) {
  // Se falhar o download, loga e retorna erro ao Evolution
  // (melhor falhar rapido do que criar job que vai falhar)
  fastify.log.error({
    msg: 'Failed to download media immediately',
    error: downloadError instanceof Error ? downloadError.message : 'Unknown',
    userNumber,
  });

  return reply.status(500).send({
    status: 'error',
    reason: 'media_download_failed',
  });
}

// 3. Criar job com path do storage
const jobData: ProcessStickerJobData = {
  userNumber,
  userName,
  messageType: validation.messageType as 'image' | 'gif',
  tempMediaPath,              // NOVO: Path no Supabase
  // messageKey: body.data.key, // REMOVIDO: Nao precisa mais
  mimetype: validation.mimetype,
  fileLength: validation.fileLength,
  duration: validation.duration,
  userId: user.id,
  status: !limitCheck.allowed ? 'pendente' : 'enviado',
};

const job = await processStickerQueue.add('process-sticker', jobData, {
  jobId: `${userNumber}-${Date.now()}`,
});
```

### 3. Worker (worker.ts)

**ANTES:**
```typescript
// Processamento de imagem estatica
if (jobData.messageType === 'image') {
  stickerBuffer = await processStaticSticker(jobData.messageKey);
}
```

**DEPOIS (com suporte a ambos formatos para transicao):**
```typescript
// Processamento de imagem estatica
if (jobData.messageType === 'image') {
  let mediaBuffer: Buffer;

  // Suporte a ambos formatos (transicao)
  if (jobData.tempMediaPath) {
    // NOVO: Le do storage
    mediaBuffer = await downloadTempMedia(jobData.tempMediaPath);
  } else if (jobData.messageKey) {
    // LEGADO: Baixa da Evolution API (jobs antigos)
    mediaBuffer = await downloadMedia(jobData.messageKey);
  } else {
    throw new Error('Job missing both tempMediaPath and messageKey');
  }

  stickerBuffer = await processStaticStickerFromBuffer(mediaBuffer);

  // Limpa arquivo temporario apos processar
  if (jobData.tempMediaPath) {
    await deleteTempMedia(jobData.tempMediaPath).catch(() => {});
  }
}
```

### 4. Sticker Processor (stickerProcessor.ts)

**Adicionar nova funcao:**
```typescript
/**
 * Processa sticker a partir de buffer ja baixado
 * @param imageBuffer - Buffer da imagem
 * @returns Buffer do sticker WebP
 */
export async function processStaticStickerFromBuffer(
  imageBuffer: Buffer
): Promise<Buffer> {
  const startTime = Date.now();

  try {
    // Mesmo codigo atual, mas sem o downloadMedia()
    const metadata = await sharp(imageBuffer).metadata();

    // ... resto do processamento igual ...

    return processedBuffer;
  } catch (error) {
    // ... tratamento de erro igual ...
  }
}
```

---

## Infraestrutura Necessaria

### Supabase Storage - Novo Bucket

**Criar via Dashboard ou SQL:**

```sql
-- Criar bucket para midia temporaria
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('temp-media', 'temp-media', false, 10485760); -- 10MB limit

-- Policy: apenas service_role pode acessar
CREATE POLICY "Service role full access" ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'temp-media')
WITH CHECK (bucket_id = 'temp-media');
```

**Lifecycle Policy (auto-cleanup):**
- Configurar no Dashboard do Supabase
- Deletar arquivos com mais de 24 horas
- Ou: criar job schedulado para cleanup

### Redis / BullMQ

Nenhuma mudanca necessaria.

### Docker

Nenhuma mudanca necessaria.

---

## Riscos e Mitigacoes

### RISCO ALTO: Latencia do Webhook

| Cenario | Antes | Depois | Impacto |
|---------|-------|--------|---------|
| 1 imagem | ~100ms | ~1-2s | Aceitavel |
| 5 imagens | ~500ms | ~5-10s | Preocupante |
| 10 imagens | ~1s | ~10-20s | Pode dar timeout |

**Mitigacoes:**
1. Evolution API tem timeout de 30s - suficiente para maioria
2. Paralelizar downloads se multiplas imagens? (aumenta complexidade)
3. Aceitar limitacao: maximo X imagens por vez

### RISCO ALTO: Falha no Meio do Webhook

**Cenario:** Download OK, Upload OK, Criar Job FALHA

```
1. Midia baixada -> OK
2. Midia salva no storage -> OK
3. Job criado -> FALHA (Redis down, etc)
4. Arquivo fica orfao no storage
```

**Mitigacoes:**
1. Lifecycle policy no bucket (auto-delete 24h)
2. Job schedulado de cleanup (lista arquivos velhos e deleta)
3. Logs para monitorar arquivos orfaos

### RISCO MEDIO: Custo de Storage

| Metrica | Estimativa |
|---------|-----------|
| Tamanho medio imagem | ~500KB |
| Tamanho medio GIF | ~2MB |
| Stickers/dia | ~1000 |
| Storage/dia (pico) | ~500MB-2GB |
| Custo Supabase | Incluido no plano |

**Mitigacoes:**
1. Worker deleta arquivo apos processar
2. Lifecycle policy (24h)
3. Monitorar uso de storage

### RISCO MEDIO: Jobs Antigos na Fila

**Cenario:** Deploy acontece com jobs na fila usando formato antigo

```
Antes do deploy:
  Job { messageKey: {...} }  <- Formato antigo

Apos deploy:
  Worker espera tempMediaPath mas recebe messageKey
```

**Mitigacoes:**
1. Worker suporta AMBOS formatos (transicao)
2. Ou: Drenar fila antes de deploy (esperar processar todos)
3. Ou: Deploy em horario de baixo uso

### RISCO BAIXO: Timeout no Download

**Cenario:** Evolution API demora muito para responder

**Mitigacoes:**
1. Timeout de 30s no axios (ja configurado)
2. Retornar erro 500 se falhar (usuario pode reenviar)
3. Log para monitorar frequencia

---

## Plano de Implementacao

### Fase 1: Preparacao (Sem Deploy)

| Passo | Tarefa | Tempo Est. |
|-------|--------|-----------|
| 1.1 | Criar bucket `temp-media` no Supabase | 10min |
| 1.2 | Adicionar funcoes em supabaseStorage.ts | 30min |
| 1.3 | Adicionar testes para novas funcoes | 30min |
| 1.4 | Atualizar tipo ProcessStickerJobData | 10min |

### Fase 2: Worker (Deploy Parcial)

| Passo | Tarefa | Tempo Est. |
|-------|--------|-----------|
| 2.1 | Worker aceita AMBOS formatos | 30min |
| 2.2 | Adicionar processStaticStickerFromBuffer | 20min |
| 2.3 | Testar localmente com jobs antigos | 20min |
| 2.4 | Deploy apenas worker | 10min |
| 2.5 | Monitorar: jobs antigos funcionando? | 30min |

### Fase 3: Webhook (Deploy Completo)

| Passo | Tarefa | Tempo Est. |
|-------|--------|-----------|
| 3.1 | Webhook faz download + upload | 45min |
| 3.2 | Testar localmente | 30min |
| 3.3 | Deploy webhook | 10min |
| 3.4 | Testar: enviar multiplas imagens | 15min |
| 3.5 | Monitorar logs por 1 hora | 60min |

### Fase 4: Cleanup (Apos Estabilizar)

| Passo | Tarefa | Tempo Est. |
|-------|--------|-----------|
| 4.1 | Remover suporte a messageKey do worker | 15min |
| 4.2 | Remover codigo morto | 15min |
| 4.3 | Atualizar documentacao | 20min |
| 4.4 | Deploy final | 10min |

**Tempo Total Estimado:** 6-8 horas

---

## Alternativas Consideradas

### Alternativa B: Retry com Backoff

```
Job falha -> Espera 2s -> Tenta de novo -> Espera 4s -> ...
```

**Rejeitada porque:**
- Se midia expirou, retry nao vai resolver
- Apenas adia o problema
- Usuario espera mais tempo para ver erro

### Alternativa C: Processar no Webhook (Sem Fila)

```
Webhook recebe -> Processa sticker -> Envia -> Responde
```

**Rejeitada porque:**
- Webhook ficaria bloqueado por 5-10s
- Nao escala (1 request = 1 processamento)
- Pode dar timeout em Evolution API

### Alternativa D: Cache de Media no Redis

```
Webhook -> Baixa midia -> Salva no Redis -> Job le do Redis
```

**Rejeitada porque:**
- Redis nao e ideal para arquivos grandes
- Limite de memoria
- Supabase Storage ja existe e e gratuito

---

## Metricas de Sucesso

### Antes da Mudanca

| Metrica | Valor Atual |
|---------|-------------|
| Taxa de erro 400 em download | ~5-10% (multiplas imagens) |
| Jobs falhando por midia expirada | Desconhecido |
| Reclamacoes de usuarios | Ocasionais |

### Depois da Mudanca

| Metrica | Valor Esperado |
|---------|----------------|
| Taxa de erro 400 em download | 0% |
| Jobs falhando por midia expirada | 0% |
| Latencia do webhook | +1-2s |

### Como Medir

1. **Logs:** Procurar por "Error 400" e "media expired"
2. **Dashboard:** Taxa de sucesso de jobs
3. **Usuario teste:** Enviar 10 imagens de uma vez

---

## Referencias

### Arquivos Principais

- `src/routes/webhook.ts` - Webhook principal (L1700-1730)
- `src/worker.ts` - Worker de processamento
- `src/services/stickerProcessor.ts` - Processamento de imagem
- `src/services/gifProcessor.ts` - Processamento de GIF
- `src/services/evolutionApi.ts` - Download de midia
- `src/services/supabaseStorage.ts` - Upload para storage

### Documentacao Relacionada

- `docs/architecture/FLOWCHARTS.md` - Fluxo de criacao de sticker
- `docs/architecture/ARCHITECTURE.md` - Arquitetura geral
- `docs/sprints/SPRINT-14-RPC-TYPE-SAFE.md` - Padrao de RPCs

### Logs do Caso Original

- Usuario: Carlos Bistecone
- UUID: Db80ea28-0e8b-4ebc-a568-3d0fb0c94709
- Data: 09/01/2026
- Erro: Error 400 em 1 de 4 imagens

---

## Historico

| Data | Mudanca | Autor |
|------|---------|-------|
| 09/01/2026 | Criacao do documento | Claude Opus 4.5 |
| 09/01/2026 | Investigacao completa | Claude Opus 4.5 |

---

## Decisao

**Status:** AGUARDANDO APROVACAO

Proximo passo: Revisar este documento e decidir se implementamos.

Perguntas para considerar:
1. O aumento de latencia no webhook e aceitavel?
2. Queremos fazer deploy em fases ou tudo de uma vez?
3. Qual horario de menor uso para deploy?
