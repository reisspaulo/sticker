# 🐦 Download de Vídeos do Twitter/X

> Documentação completa da solução de download de vídeos do Twitter para integração no bot de WhatsApp

---

## 📋 Índice

- [Resumo Executivo](#resumo-executivo)
- [O Problema](#o-problema)
- [Soluções Testadas](#soluções-testadas)
- [Solução Escolhida: VxTwitter API](#solução-escolhida-vxtwitter-api)
- [Como Funciona](#como-funciona)
- [Testes Realizados](#testes-realizados)
- [Implementação](#implementação)
- [Sistema de Respostas e UX](#-sistema-de-respostas-e-ux)
  - [Decisão de Design: Respostas Baseadas em Texto](#decisão-de-design-respostas-baseadas-em-texto)
  - [Fluxo de Interação com o Usuário](#fluxo-de-interação-com-o-usuário)
  - [Gerenciamento de Contexto](#gerenciamento-de-contexto)
  - [Detecção de Respostas](#detecção-de-respostas)
  - [Timeout Automático](#timeout-automático)
  - [Mensagens do Bot - Referência Completa](#mensagens-do-bot---referência-completa)
  - [Fluxo Técnico Completo](#fluxo-técnico-completo)
- [Próximos Passos](#próximos-passos)
- [Recursos e Links](#recursos-e-links)

---

## 🎯 Resumo Executivo

**Status:** ✅ **SOLUÇÃO ENCONTRADA E TESTADA**

Encontramos uma solução **100% funcional e gratuita** para baixar vídeos do Twitter/X usando a **VxTwitter API**.

### Características:

- ✅ **Gratuita** - Zero custos
- ✅ **Sem autenticação** - Não precisa de API keys
- ✅ **Confiável** - Testada e funcionando em dezembro de 2025
- ✅ **Completa** - Retorna metadados (autor, likes, duração, etc.)
- ✅ **Simples** - Apenas 2 requisições HTTP

### Resultado:

3 vídeos testados com **100% de sucesso**, todos compatíveis com WhatsApp.

---

## 🔍 O Problema

### Contexto

Sites como [ssstwitter.com](https://ssstwitter.com) e [x2twitter.com](https://x2twitter.com) conseguem baixar vídeos do Twitter facilmente. Queríamos replicar isso no nosso bot de WhatsApp para oferecer:

1. **Twitter → Vídeo** - Download direto
2. **Twitter → Sticker** - Conversão automática usando FFmpeg
3. **Twitter → GIF** - Para vídeos curtos

### Desafios Identificados

Em 2024/2025, o Twitter/X implementou restrições severas:

- ❌ **API Oficial** - Cara ($100/mês para 15k tweets)
- ❌ **Autenticação obrigatória** - Muitos endpoints exigem login
- ❌ **Rate limits agressivos** - Bloqueios frequentes
- ❌ **Mudanças constantes** - APIs não-oficiais quebram frequentemente

---

## 🧪 Soluções Testadas

### 1. Biblioteca NPM: `twitter-downloader`

**Pacote:** `twitter-downloader` (npm)

```bash
npm install twitter-downloader
```

**Resultado:** ❌ **FALHOU**

```
Error: Cannot read properties of undefined (reading 'reply_count')
```

**Por quê?** Biblioteca desatualizada, Twitter mudou a estrutura da API.

---

### 2. Biblioteca NPM: `twitter-video-dl-node`

**Repositório:** [7rikazhexde/twitter-video-dl-node](https://github.com/7rikazhexde/twitter-video-dl-node)

**Última atualização:** Outubro 2025 (promissor!)

```bash
git clone https://github.com/7rikazhexde/twitter-video-dl-node.git
cd twitter-video-dl-node
npm install
node twitter-video-dl-node.js <url> <output>
```

**Resultado:** ❌ **FALHOU**

```
Error: Cannot read properties of undefined (reading 'legacy')
```

**Por quê?** Twitter mudou a API GraphQL após outubro 2025.

---

### 3. yt-dlp (Command Line)

**Ferramenta:** [yt-dlp](https://github.com/yt-dlp/yt-dlp)

```bash
python3 -m pip install yt-dlp
python3 -m yt_dlp "https://x.com/.../status/..." -o video.mp4
```

**Resultado:** ❌ **FALHOU**

```
ERROR: [twitter] No video could be found in this tweet
```

**Por quê?** yt-dlp agora exige autenticação (cookies) para acessar tweets.

---

### 4. VxTwitter API (VENCEDOR!)

**API:** `api.vxtwitter.com`

**Resultado:** ✅ **100% SUCESSO**

- Não precisa de autenticação
- Funciona com qualquer tweet público
- Retorna metadados completos
- API gratuita e open-source

---

## 🏆 Solução Escolhida: VxTwitter API

### O Que É?

**VxTwitter** (também conhecido como **FxTwitter**) é um serviço open-source que:

- Corrige embeds quebrados do Twitter no Discord/Telegram
- Fornece uma API pública para acessar dados de tweets
- Permite download direto de vídeos, imagens e GIFs
- Funciona sem autenticação

### Por Que Escolhemos?

| Critério | VxTwitter | Outras Soluções |
|----------|-----------|-----------------|
| **Custo** | Gratuito | Pago ou gratuito limitado |
| **Autenticação** | Não precisa | Requer API keys/cookies |
| **Confiabilidade** | 100% nos testes | 0-50% nos testes |
| **Manutenção** | Ativa (2025) | Muitas abandonadas |
| **Metadados** | Completos | Limitados |
| **Open Source** | ✅ Sim | ❌ Não |

### Links Oficiais

- **API Docs:** https://docs.fxtwitter.com
- **GitHub:** https://github.com/FixTweet/FxTwitter
- **Website:** https://fxtwitter.com

---

## ⚙️ Como Funciona

### Fluxo Técnico

```
1. Tweet URL
   ↓
2. Extrair username e tweet ID
   ↓
3. Requisição: GET api.vxtwitter.com/{username}/status/{tweetId}
   ↓
4. Resposta JSON com metadados + URL do vídeo
   ↓
5. Download do vídeo (requisição HTTP simples)
   ↓
6. Vídeo em MP4 salvo localmente
```

### Exemplo de Código

```typescript
// 1. Extrair dados da URL
const match = tweetUrl.match(/(\w+)\/status\/(\d+)/);
const [, username, tweetId] = match;

// 2. Buscar metadados via API
const response = await axios.get(
  `https://api.vxtwitter.com/${username}/status/${tweetId}`
);

// 3. Extrair URL do vídeo
const videoMedia = response.data.media_extended.find(
  m => m.type === 'video' || m.type === 'gif'
);

// 4. Baixar vídeo
const videoResponse = await axios.get(videoMedia.url, {
  responseType: 'arraybuffer'
});

// 5. Salvar arquivo
fs.writeFileSync('video.mp4', Buffer.from(videoResponse.data));
```

### Estrutura da Resposta da API

```json
{
  "tweetID": "2004351254731149521",
  "user_name": "Nome do Usuário",
  "user_screen_name": "username",
  "text": "Texto do tweet",
  "date": "Fri Dec 26 00:39:12 +0000 2025",
  "date_epoch": 1766709552,
  "hasMedia": true,
  "likes": 29,
  "retweets": 0,
  "replies": 1,
  "mediaURLs": [
    "https://video.twimg.com/ext_tw_video/.../vid/.../video.mp4"
  ],
  "media_extended": [
    {
      "type": "video",
      "url": "https://video.twimg.com/.../video.mp4",
      "thumbnail_url": "https://pbs.twimg.com/.../thumb.jpg",
      "duration_millis": 10243,
      "size": {
        "width": 656,
        "height": 1222
      }
    }
  ]
}
```

### Campos Importantes

| Campo | Descrição | Uso |
|-------|-----------|-----|
| `hasMedia` | Indica se tem mídia | Validação inicial |
| `media_extended[]` | Array de mídias | Encontrar vídeos |
| `media_extended[].type` | Tipo: video, gif, photo | Filtrar vídeos |
| `media_extended[].url` | URL direta do vídeo | Download |
| `media_extended[].duration_millis` | Duração em ms | Validação WhatsApp |
| `media_extended[].size` | Largura x Altura | Info ao usuário |
| `user_screen_name` | Username | Nome do arquivo |
| `text` | Texto do tweet | Context ao usuário |

---

## ✅ Testes Realizados

### Teste 1: Tweet com Vídeo Vertical

**URL:** https://x.com/psicotikku/status/2004351254731149521

**Autor:** @psicotikku

**Texto:** "boa noite mutuals"

**Resultado:**
- ✅ Download bem-sucedido
- 📊 Tamanho: 1.01 MB
- ⏱️ Duração: 10.2 segundos
- 📐 Resolução: 656x1222 (vertical)
- ❤️ Curtidas: 29
- ✅ Compatível com WhatsApp

---

### Teste 2: Tweet com Vídeo Quadrado (Curto)

**URL:** https://x.com/i/status/2004988010874765353

**Autor:** @gatorainetto

**Texto:** "Fui pro cinema com um boyzinho e ele me perguntou..."

**Resultado:**
- ✅ Download bem-sucedido
- 📊 Tamanho: 0.64 MB
- ⏱️ Duração: 3.7 segundos
- 📐 Resolução: 726x720 (quase quadrado)
- ❤️ Curtidas: 2,507
- ✅ Compatível com WhatsApp

---

### Teste 3: Tweet com Vídeo Quadrado (Médio)

**URL:** https://x.com/i/status/2005255097572618394

**Autor:** @adaldnz

**Texto:** "meu namorado começou o ano em paris..."

**Resultado:**
- ✅ Download bem-sucedido
- 📊 Tamanho: 1.74 MB
- ⏱️ Duração: 11.5 segundos
- 📐 Resolução: 720x720 (quadrado)
- ❤️ Curtidas: 559
- ✅ Compatível com WhatsApp

---

### Resumo dos Testes

| Teste | Status | Tamanho | Duração | Resolução | WhatsApp OK? |
|-------|--------|---------|---------|-----------|--------------|
| #1 | ✅ | 1.01 MB | 10.2s | 656x1222 | ✅ Sim |
| #2 | ✅ | 0.64 MB | 3.7s | 726x720 | ✅ Sim |
| #3 | ✅ | 1.74 MB | 11.5s | 720x720 | ✅ Sim |

**Taxa de sucesso:** 100% (3/3)

### Validações de Compatibilidade

**Limites do WhatsApp:**
- Tamanho máximo: 16 MB
- Duração máxima: 90 segundos
- Formato: MP4, 3GP, AVI, MOV

**Todos os vídeos testados:**
- ✅ Tamanho < 16 MB
- ✅ Duração < 90 segundos
- ✅ Formato MP4

---

## 🛠️ Implementação

### Arquivo Criado

📄 **`/scripts/test-twitter-final.ts`**

Script completo de teste que:
- Extrai username e tweet ID da URL
- Busca metadados via VxTwitter API
- Baixa o vídeo
- Valida compatibilidade com WhatsApp
- Salva em `/temp/` com nome descritivo

### Como Usar o Script

```bash
# Testar com qualquer tweet
npx tsx scripts/test-twitter-final.ts "https://x.com/user/status/123456789"

# Exemplo
npx tsx scripts/test-twitter-final.ts "https://x.com/psicotikku/status/2004351254731149521"
```

### Exemplo de Output

```
🐦 Download de Vídeo do Twitter via VxTwitter API

URL: https://x.com/psicotikku/status/2004351254731149521

👤 Usuário: @psicotikku
🆔 Tweet ID: 2004351254731149521

📥 Buscando informações via VxTwitter API...
✅ Dados recebidos:

   Autor: psicuntykko (@psicotikku)
   Texto: "boa noite mutuals"
   Data: Fri Dec 26 00:39:12 +0000 2025
   Curtidas: 29 | Retweets: 0
   Tem mídia: Sim

📹 Vídeo encontrado!
   Tipo: video
   Duração: 10.2s
   Resolução: 656x1222
   URL: https://video.twimg.com/...

⬇️  Baixando vídeo...
   Progresso: 100.0%

✅ Download concluído!

📁 Informações do arquivo:
   Caminho: /temp/twitter-psicotikku-2004351254731149521.mp4
   Tamanho: 1.01 MB
   Bytes: 1,060,982

🔍 Validações para WhatsApp:
   ✅ Tamanho OK para WhatsApp (<16MB)
   ✅ Duração OK para WhatsApp (<90s)

🎉 Teste concluído com sucesso!
```

---

## 💬 Sistema de Respostas e UX

### Decisão de Design: Respostas Baseadas em Texto

**Por que não usamos botões interativos?**

A Evolution API v2.2.3 roda em modo **Baileys** (WhatsApp Web protocol), que tem as seguintes limitações:

| Recurso | Baileys | Cloud API |
|---------|---------|-----------|
| **Botões interativos** | ❌ Deprecados | ✅ Funcionam |
| **Listas** | ❌ Não funcionam | ✅ Funcionam |
| **Custo** | ✅ Gratuito | ❌ Pago |
| **Aprovação Meta** | ✅ Não precisa | ❌ Precisa Business |

**WhatsApp deprecou botões no Baileys** em 2024, tornando-os instáveis ou completamente quebrados. Por isso, optamos por **respostas baseadas em texto** ("sim"/"não") que são:

- ✅ **100% confiáveis** - Funcionam em qualquer modo
- ✅ **Simples** - Usuário entende imediatamente
- ✅ **Flexíveis** - Aceitamos múltiplas variações (sim, s, yes, y, 👍, ✅)
- ✅ **Sem dependências** - Não depende de APIs instáveis

---

### Fluxo de Interação com o Usuário

#### Passo 1: Usuário Envia Link do Twitter

```
Usuário: https://x.com/username/status/1234567890
```

**Bot detecta automaticamente** e adiciona job na fila.

---

#### Passo 2: Bot Envia o Vídeo

Após o download, o bot envia o vídeo com uma mensagem rica:

```
🐦 Vídeo do Twitter baixado com sucesso!

📊 Informações:
• Autor: @gatinho (Gatinhos Fofos)
• Duração: 10 segundos
• Tamanho: 1.2 MB
• Curtidas: 1.5K

💬 Quer transformar em figurinha? 🎨

Responda:
• "sim" ou "s" → Converter para sticker
• "não" ou "n" → Só o vídeo mesmo

⏱️ Você tem 5 minutos para responder
```

**Elementos da mensagem:**
- 🐦 Ícone identificador (Twitter)
- 📊 Metadados do vídeo (autor, duração, tamanho, curtidas)
- 💬 Pergunta clara e objetiva
- ✅ Instruções simples de resposta
- ⏱️ Aviso de timeout (transparência)

---

#### Passo 3A: Usuário Responde "Sim"

```
Usuário: sim
```

**Bot processa conversão:**

```
✅ Perfeito! Convertendo para figurinha...

⏳ Isso pode levar alguns segundos dependendo do tamanho do vídeo.
```

Após processamento (usando FFmpeg existente):

```
🎉 Pronto! Aqui está sua figurinha!

📊 Informações:
• Tipo: Sticker animado
• Tamanho: 512x512px
• Duração: 10s
• Formato: WebP

🎨 Você usou 6/10 figurinhas hoje
```

---

#### Passo 4B: Usuário Responde "Não"

```
Usuário: não
```

**Bot confirma:**

```
👍 Ok! Vídeo enviado sem conversão.

💡 Dica: Você pode enviar outro link do Twitter a qualquer momento!

📊 Downloads hoje: 1/10
```

---

#### Passo 5: Timeout (5 minutos)

Se o usuário não responder em 5 minutos:

```
⏱️ Tempo esgotado!

O vídeo foi enviado, mas não convertido para figurinha.

💡 Se quiser converter, basta enviar o link novamente!
```

**Contexto é limpo** automaticamente.

---

### Gerenciamento de Contexto

**Problema:** Como saber que a próxima mensagem do usuário é uma resposta à pergunta "Quer converter?"

**Solução:** Sistema de contexto em memória (Redis)

#### Estrutura do Contexto

```typescript
interface UserContext {
  state: 'awaiting_conversion_response';
  tweetId: string;
  downloadId: string;  // UUID do registro em twitter_downloads
  videoPath: string;   // Caminho no Supabase Storage
  expiresAt: number;   // Timestamp (Date.now() + 5 minutos)
}
```

#### Fluxo de Contexto

**1. Após enviar o vídeo:**

```typescript
// Salvar contexto no Redis
await redis.setex(
  `user_context:${whatsappNumber}`,
  300, // 5 minutos (TTL)
  JSON.stringify({
    state: 'awaiting_conversion_response',
    tweetId: '1234567890',
    downloadId: 'uuid-do-download',
    videoPath: 'twitter-videos/video.mp4',
    expiresAt: Date.now() + 5 * 60 * 1000
  })
);
```

**2. Ao receber nova mensagem do usuário:**

```typescript
// Verificar se há contexto ativo
const contextStr = await redis.get(`user_context:${whatsappNumber}`);

if (!contextStr) {
  // Não há contexto, processar como mensagem normal
  return;
}

const context: UserContext = JSON.parse(contextStr);

// Verificar se expirou (double-check)
if (Date.now() > context.expiresAt) {
  await redis.del(`user_context:${whatsappNumber}`);
  await sendMessage(whatsappNumber, '⏱️ Tempo esgotado! ...');
  return;
}

// Há contexto ativo, processar resposta
await processConversionResponse(whatsappNumber, message, context);
```

**3. Processar resposta do usuário:**

```typescript
async function processConversionResponse(
  whatsappNumber: string,
  message: string,
  context: UserContext
) {
  const response = message.toLowerCase().trim();

  // Detectar "SIM"
  if (['sim', 's', 'yes', 'y', '👍', '✅', 'ok'].includes(response)) {
    // Limpar contexto
    await redis.del(`user_context:${whatsappNumber}`);

    // Adicionar job de conversão
    await videoToStickerQueue.add('video-to-sticker', {
      userNumber: whatsappNumber,
      videoPath: context.videoPath,
      downloadId: context.downloadId
    });

    await sendMessage(
      whatsappNumber,
      '✅ Perfeito! Convertendo para figurinha...\n\n⏳ Isso pode levar alguns segundos.'
    );
    return;
  }

  // Detectar "NÃO"
  if (['não', 'nao', 'n', 'no', '👎', '❌', 'cancelar'].includes(response)) {
    // Limpar contexto
    await redis.del(`user_context:${whatsappNumber}`);

    // Atualizar registro
    await supabase
      .from('twitter_downloads')
      .update({ converted_to_sticker: false })
      .eq('id', context.downloadId);

    await sendMessage(
      whatsappNumber,
      '👍 Ok! Vídeo enviado sem conversão.\n\n💡 Dica: Você pode enviar outro link do Twitter a qualquer momento!'
    );
    return;
  }

  // Resposta inválida
  await sendMessage(
    whatsappNumber,
    '❓ Não entendi sua resposta.\n\n💬 Responda:\n• "sim" → Converter\n• "não" → Não converter\n\n⏱️ Tempo restante: ' +
    Math.floor((context.expiresAt - Date.now()) / 60000) + ' minutos'
  );
}
```

---

### Detecção de Respostas

**Variações aceitas:**

| Intenção | Variações Aceitas |
|----------|-------------------|
| **SIM** | sim, s, yes, y, 👍, ✅, ok, sim!, s!, yes! |
| **NÃO** | não, nao, n, no, 👎, ❌, cancelar, nope |

**Normalização:**
- `.toLowerCase()` - Ignora maiúsculas
- `.trim()` - Remove espaços
- Remove pontuação (!, ?, .)

```typescript
function normalizeResponse(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[!?.,]/g, '');
}
```

---

### Timeout Automático

**Implementação com Redis TTL:**

Redis automaticamente deleta chaves após o TTL (Time To Live). Quando setamos:

```typescript
await redis.setex(key, 300, value); // 300 segundos = 5 minutos
```

Após 5 minutos, `redis.get(key)` retorna `null` automaticamente.

**Job adicional para notificar usuário:**

Criar job agendado para rodar após 5 minutos:

```typescript
// Ao criar contexto
await timeoutQueue.add(
  'context-timeout-notification',
  {
    whatsappNumber,
    contextId: downloadId
  },
  {
    delay: 5 * 60 * 1000 // 5 minutos
  }
);
```

**Worker de timeout:**

```typescript
timeoutQueue.process('context-timeout-notification', async (job) => {
  const { whatsappNumber, contextId } = job.data;

  // Verificar se contexto ainda existe
  const context = await redis.get(`user_context:${whatsappNumber}`);

  if (context) {
    // Contexto ainda existe = usuário não respondeu
    await redis.del(`user_context:${whatsappNumber}`);

    await sendMessage(
      whatsappNumber,
      '⏱️ Tempo esgotado!\n\n' +
      'O vídeo foi enviado, mas não convertido para figurinha.\n\n' +
      '💡 Se quiser converter, basta enviar o link novamente!'
    );
  }
  // Se não existe, usuário já respondeu, não fazer nada
});
```

---

### Prioridade de Processamento

**Quando usuário tem contexto ativo:**

```typescript
// Em webhook.ts - Ordem de processamento

// 1. Verificar se há contexto ativo
const context = await getUserContext(whatsappNumber);
if (context && context.state === 'awaiting_conversion_response') {
  // Processar como resposta, MESMO se for imagem/vídeo/link
  await processConversionResponse(whatsappNumber, message, context);
  return; // Não processar como nova mensagem
}

// 2. Se não há contexto, processar normalmente
// - Detectar imagem → Processar sticker
// - Detectar link Twitter → Baixar vídeo
// - Detectar texto → Ignorar ou responder ajuda
```

**Casos especiais:**

- Se usuário envia **outro link do Twitter** enquanto aguarda resposta → **Cancela contexto anterior** e processa novo download
- Se usuário envia **imagem** enquanto aguarda resposta → **Processa como sticker** e limpa contexto Twitter

---

### Mensagens do Bot - Referência Completa

#### Download Bem-Sucedido

```
🐦 Vídeo do Twitter baixado com sucesso!

📊 Informações:
• Autor: @{username} ({name})
• Duração: {duration} segundos
• Tamanho: {size} MB
• Curtidas: {likes}

💬 Quer transformar em figurinha? 🎨

Responda:
• "sim" ou "s" → Converter para sticker
• "não" ou "n" → Só o vídeo mesmo

⏱️ Você tem 5 minutos para responder
```

#### Confirmação "Sim"

```
✅ Perfeito! Convertendo para figurinha...

⏳ Isso pode levar alguns segundos dependendo do tamanho do vídeo.
```

#### Conversão Concluída

```
🎉 Pronto! Aqui está sua figurinha!

📊 Informações:
• Tipo: Sticker animado
• Tamanho: 512x512px
• Duração: {duration}s
• Formato: WebP

🎨 Você usou {count}/10 figurinhas hoje
```

#### Confirmação "Não"

```
👍 Ok! Vídeo enviado sem conversão.

💡 Dica: Você pode enviar outro link do Twitter a qualquer momento!

📊 Downloads hoje: {count}/10
```

#### Timeout (5 minutos)

```
⏱️ Tempo esgotado!

O vídeo foi enviado, mas não convertido para figurinha.

💡 Se quiser converter, basta enviar o link novamente!
```

#### Resposta Inválida

```
❓ Não entendi sua resposta.

💬 Responda:
• "sim" → Converter
• "não" → Não converter

⏱️ Tempo restante: {minutes} minutos
```

#### Erro: Tweet Não Encontrado

```
❌ Não consegui encontrar esse tweet.

Possíveis motivos:
• Tweet foi deletado
• Perfil é privado
• Link está incorreto

💡 Verifique o link e tente novamente
```

#### Erro: Sem Vídeo no Tweet

```
❌ Esse tweet não tem vídeo.

💡 Eu só consigo baixar tweets com vídeos ou GIFs
```

#### Erro: Vídeo Muito Grande

```
⚠️ Vídeo muito grande para WhatsApp!

📊 Informações:
• Tamanho: {size} MB
• Limite WhatsApp: 16 MB

💡 Infelizmente não posso enviar esse vídeo
```

#### Erro: Vídeo Muito Longo

```
⚠️ Vídeo muito longo!

📊 Informações:
• Duração: {duration} segundos
• Limite WhatsApp: 90 segundos

💡 Infelizmente não posso enviar esse vídeo
```

#### Limite Diário Atingido

```
⚠️ Limite diário atingido!

📊 Você já baixou 10 vídeos hoje.

💡 Volte amanhã ou assine o plano Premium para downloads ilimitados!

🔗 Saiba mais: /premium
```

---

### Fluxo Técnico Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USUÁRIO ENVIA LINK DO TWITTER                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. WEBHOOK DETECTA URL (urlDetector.ts)                     │
│    - Regex: /(twitter|x)\.com\/[\w]+\/status\/\d+/          │
│    - Extrai username + tweet ID                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. VALIDAÇÕES INICIAIS                                      │
│    - Verifica limite diário (10/dia)                        │
│    - Verifica se já baixou esse tweet hoje                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. ADICIONA JOB "download-twitter-video" (BullMQ)           │
│    Payload: { tweetUrl, userNumber, instance }              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. WORKER PROCESSA JOB                                      │
│    a) Chama VxTwitter API                                   │
│    b) Valida tamanho/duração                                │
│    c) Baixa vídeo                                           │
│    d) Salva temporariamente em Supabase Storage             │
│    e) Registra em twitter_downloads                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. ENVIA VÍDEO VIA EVOLUTION API                            │
│    POST /message/sendMedia/{instance}                       │
│    { number, mediaUrl, caption }                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. ENVIA MENSAGEM "QUER CONVERTER?"                         │
│    POST /message/sendText/{instance}                        │
│    { number, text: "Quer transformar em figurinha..." }     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. CRIA CONTEXTO NO REDIS (TTL 5min)                        │
│    Key: user_context:{whatsappNumber}                       │
│    Value: { state, tweetId, downloadId, videoPath }         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. AGENDA JOB DE TIMEOUT (5min)                             │
│    Queue: timeoutQueue                                      │
│    Delay: 300000ms                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
                    ┌─────┴─────┐
                    │           │
            ┌───────▼───┐   ┌───▼──────┐
            │ SIM       │   │ NÃO      │
            └───────┬───┘   └───┬──────┘
                    │           │
        ┌───────────▼───────────▼──────────┐
        │ 10. WEBHOOK RECEBE NOVA MENSAGEM │
        │     - Detecta contexto ativo      │
        │     - Normaliza resposta          │
        └──────────────┬────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
    ┌─────▼─────┐           ┌──────▼──────┐
    │ "SIM"     │           │ "NÃO"       │
    └─────┬─────┘           └──────┬──────┘
          │                        │
    ┌─────▼──────────────┐   ┌─────▼──────────────┐
    │ Converter          │   │ Cancelar           │
    │ - Limpa contexto   │   │ - Limpa contexto   │
    │ - Add job FFmpeg   │   │ - Atualiza DB      │
    │ - Envia "⏳..."    │   │ - Envia "👍 OK"    │
    └────────────────────┘   └────────────────────┘
```

---

## 🚀 Próximos Passos

### Fase 1: Integração Básica no Bot

**Objetivo:** Permitir que usuários baixem vídeos do Twitter via WhatsApp

**Arquivos a criar:**

1. **`src/services/twitterService.ts`**
   - Função `downloadTwitterVideo(tweetUrl: string)`
   - Integração com VxTwitter API
   - Download e salvamento temporário

2. **`src/utils/urlDetector.ts`**
   - Detecta URLs do Twitter/X em mensagens
   - Regex: `/(twitter|x)\.com\/[\w]+\/status\/\d+/`
   - Retorna URL limpa

3. **`src/jobs/downloadTwitterVideoJob.ts`**
   - Job BullMQ para processar downloads
   - Payload: `{ tweetUrl, userPhone, instanceId }`
   - Timeout: 60 segundos

4. **Modificar `src/utils/messageValidator.ts`**
   - Adicionar detecção de URLs do Twitter
   - Retornar tipo: `twitter_video`

5. **Modificar `src/worker.ts`**
   - Adicionar processamento de `download-twitter-video`
   - Enviar vídeo via Evolution API
   - Perguntar: "Quer transformar em figurinha?"

**Fluxo completo:**

```
1. Usuário manda link do Twitter
   ↓
2. Webhook detecta URL (urlDetector.ts)
   ↓
3. Adiciona job "download-twitter-video" (BullMQ)
   ↓
4. Worker processa job:
   a) Chama twitterService.downloadTwitterVideo()
   b) Salva temporariamente no Supabase Storage
   c) Envia vídeo para usuário (Evolution API)
   d) Pergunta: "Quer transformar em figurinha? 🎨"
   ↓
5. Se usuário responder "sim":
   a) Adiciona job "video-to-sticker"
   b) Processa com FFmpeg (já existe no projeto)
   c) Envia sticker
   ↓
6. Limpa arquivos temporários
```

---

### Fase 2: Features Avançadas

#### 2.1 Conversão Automática para Sticker

- Detectar vídeos curtos (< 10s)
- Oferecer conversão automática
- Usar FFmpeg existente no projeto

#### 2.2 Suporte a GIFs Animados

- Detectar tipo `animated_gif`
- Converter para WebP animado
- Usar pipeline existente de stickers animados

#### 2.3 Download de Múltiplos Vídeos

- Tweets podem ter até 4 vídeos
- Baixar todos e enviar sequencialmente
- Perguntar qual converter em sticker

#### 2.4 Histórico de Downloads

**Tabela Supabase: `twitter_downloads`**

```sql
CREATE TABLE twitter_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_phone TEXT NOT NULL,
  tweet_id TEXT NOT NULL,
  tweet_url TEXT NOT NULL,
  video_url TEXT NOT NULL,
  author_username TEXT,
  author_name TEXT,
  tweet_text TEXT,
  video_duration_ms INTEGER,
  video_size_bytes BIGINT,
  video_resolution TEXT,
  likes INTEGER,
  retweets INTEGER,
  downloaded_at TIMESTAMP DEFAULT NOW(),
  converted_to_sticker BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_twitter_downloads_user ON twitter_downloads(user_phone);
CREATE INDEX idx_twitter_downloads_tweet ON twitter_downloads(tweet_id);
```

**Benefícios:**
- Analytics (tweets mais baixados)
- Evitar downloads duplicados
- Estatísticas para o usuário

#### 2.5 Comando `/stats-twitter`

Mostrar estatísticas ao usuário:
- Total de vídeos baixados
- Total de stickers criados
- Tweet mais popular que baixou
- Ranking de autores favoritos

---

### Fase 3: Expansão para Outras Plataformas

Pesquisar e implementar soluções similares para:

#### 3.1 TikTok

**API candidata:** SnapTik API, TikTok Scraper

**Desafio:** TikTok tem watermark, pode precisar de remoção

#### 3.2 Instagram Reels

**API candidata:** Instagram Downloader APIs (muitas opções pagas)

**Desafio:** Instagram é muito restritivo, difícil sem autenticação

#### 3.3 YouTube Shorts

**API candidata:** yt-dlp (funciona bem com YouTube)

**Desafio:** Vídeos podem ser muito grandes

#### 3.4 Facebook Vídeos

**API candidata:** Facebook Video Downloader APIs

**Desafio:** Requer autenticação para vídeos privados

---

## 📊 Diferenciais Competitivos

### O Que Outros Bots Não Têm

1. **Download Automático**
   - Só mandar o link, sem comandos
   - Detecção automática de URLs

2. **Conversão para Sticker**
   - Pergunta automática
   - Processamento com FFmpeg
   - Stickers estáticos e animados

3. **Metadados Ricos**
   - Mostra autor, likes, data
   - Contexto completo do tweet

4. **Multi-Plataforma** (futuro)
   - Twitter, TikTok, Instagram, YouTube
   - Um bot, várias fontes

---

## 💰 Potencial de Monetização

### Modelo Freemium

**Plano Gratuito:**
- 5 downloads de Twitter/dia
- Conversão para sticker: ilimitada
- Marca d'água: "Baixado via [SeuBot]"

**Plano Premium (R$ 9,90/mês):**
- Downloads ilimitados
- TikTok, Instagram, YouTube inclusos
- Sem marca d'água
- Histórico de downloads
- Estatísticas avançadas

### Modelo B2B

**Vender como serviço para:**
- Agências de marketing
- Criadores de conteúdo
- Empresas de social media

**Pricing:**
- R$ 50/mês - 500 downloads
- R$ 150/mês - 2000 downloads
- R$ 300/mês - Ilimitado

---

## 🔒 Considerações de Segurança

### Rate Limiting

Implementar rate limit por usuário:
- 10 downloads por hora
- 50 downloads por dia (gratuito)
- Ilimitado (premium)

### Validações

1. **URL válida** - Regex robusto
2. **Tamanho máximo** - Não baixar vídeos > 100MB
3. **Duração máxima** - Não baixar vídeos > 5 minutos
4. **Tipo de mídia** - Apenas vídeos e GIFs

### LGPD/Privacidade

- Não armazenar vídeos permanentemente
- Limpar cache após 24h
- Logs anonimizados
- Opção de deletar histórico

---

## 📚 Recursos e Links

### Documentação

- **VxTwitter API Docs:** https://docs.fxtwitter.com
- **GitHub VxTwitter:** https://github.com/FixTweet/FxTwitter
- **Evolution API:** https://doc.evolution-api.com

### Alternativas (para referência)

- **ssstwitter.com** - https://ssstwitter.com
- **x2twitter.com** - https://x2twitter.com
- **saveTweet.net** - https://savetwitter.net

### Ferramentas Testadas (falharam)

- ❌ `twitter-downloader` (npm) - Desatualizado
- ❌ `twitter-video-dl-node` (GitHub) - Quebrou após out/2025
- ❌ `yt-dlp` - Requer autenticação agora

### Bibliotecas Úteis

- **axios** - Requisições HTTP
- **sharp** - Processamento de imagens (já no projeto)
- **fluent-ffmpeg** - Processamento de vídeos (já no projeto)

---

## 📝 Conclusão

### ✅ O Que Foi Alcançado

1. ✅ Solução 100% funcional encontrada
2. ✅ 3 testes realizados com sucesso
3. ✅ Script de teste criado e documentado
4. ✅ Compatibilidade com WhatsApp validada
5. ✅ Roadmap de implementação definido

### 🎯 Próximos Passos Imediatos

1. **Decisão:** Implementar agora ou testar mais?
2. **Priorização:** Twitter primeiro ou multi-plataforma?
3. **Modelo de negócio:** Gratuito, freemium ou pago?

### 💡 Recomendação

**Implementar a Fase 1 (integração básica)** primeiro:
- Validar aceitação dos usuários
- Coletar feedback
- Medir uso real
- Depois expandir para outras plataformas

---

**Documentação criada em:** 28/12/2025
**Última atualização:** 28/12/2025
**Status:** ✅ Solução validada e pronta para implementação
**Changelog:**
- v2.0 (28/12/2025): Adicionado sistema de respostas baseadas em texto e gerenciamento de contexto
- v1.0 (28/12/2025): Documentação inicial com testes e validação da API

**Autor:** Paulo Henrique + Claude Code

