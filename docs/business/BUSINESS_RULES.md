# Regras de Negocio - StickerBot

> Documento central com todas as regras de negocio do sistema.
> Ultima atualizacao: 2026-01-07

---

## Indice

1. [Planos e Precos](#1-planos-e-precos)
2. [Limites e Quotas](#2-limites-e-quotas)
3. [A/B Test - Grupos Control vs Bonus](#3-ab-test---grupos-control-vs-bonus)
4. [Stickers Pendentes](#4-stickers-pendentes)
5. [Pagamento PIX](#5-pagamento-pix)
6. [Pagamento Stripe (Cartao/Boleto)](#6-pagamento-stripe-cartaoboleto)
7. [Ciclo de Vida da Assinatura](#7-ciclo-de-vida-da-assinatura)
8. [Onboarding](#8-onboarding)
9. [Processamento de Stickers](#9-processamento-de-stickers)
10. [Validacao de Mensagens](#10-validacao-de-mensagens)
11. [Twitter/X Downloads](#11-twitterx-downloads)
12. [Storage e Buckets](#12-storage-e-buckets)
13. [Experiencia do Usuario (UX)](#13-experiencia-do-usuario-ux)
14. [Mensagens e Notificacoes](#14-mensagens-e-notificacoes)
15. [Operacoes Atomicas (Race Conditions)](#15-operacoes-atomicas-race-conditions)
16. [Comandos de Texto](#16-comandos-de-texto)
17. [Usuarios](#17-usuarios)
18. [Reset Diario](#18-reset-diario)
19. [Filas e Workers (BullMQ)](#19-filas-e-workers-bullmq)

---

## 1. Planos e Precos

### BR-100: Tipos de Plano
| Plano | Preco | Stickers/dia | Twitter/dia | Marca d'agua | Prioridade |
|-------|-------|--------------|-------------|--------------|------------|
| Free | R$ 0 | 4 | 4 | Sim | Nao |
| Premium | R$ 5/mes | 20 | 15 | Nao | Nao |
| Ultra | R$ 9,90/mes | Ilimitado | Ilimitado | Nao | Sim |

**Fonte:** `src/types/subscription.ts:39-58`

### BR-101: Valor "Ilimitado"
- O valor `999999` representa "ilimitado" no sistema
- Usuarios Ultra nunca devem atingir limite

**Fonte:** `src/types/subscription.ts:53`

### BR-102: Smart Upsell
Menu de upgrade mostra apenas planos **superiores** ao atual:
- Free → mostra Premium e Ultra
- Premium → mostra apenas Ultra
- Ultra → nao mostra opcoes (nao deve atingir limite)

**Fonte:** `src/services/menuService.ts:84-96`

---

## 2. Limites e Quotas

### BR-200: Limite Efetivo
O limite efetivo de um usuario e calculado como:
```
limite_efetivo = limite_do_plano + bonus_credits_today (se grupo bonus)
```

**Fonte:** `src/services/userService.ts:204-205`

### BR-201: Verificacao de Limite
Usuario atingiu limite quando:
```
daily_count >= limite_efetivo
```

**Fonte:** `src/services/userService.ts:207`

### BR-202: Limite de Stickers Pendentes
- Maximo de **2 stickers pendentes** por usuario (grupo bonus)
- Se `pending_count >= 2`, usuario e bloqueado mesmo com bonus disponivel

**Fonte:** `src/routes/webhook.ts:1195`

### BR-203: Limite Twitter Independente
- Limite de downloads Twitter e **separado** do limite de stickers
- Usuario pode atingir limite de stickers mas ainda baixar videos (e vice-versa)

**Fonte:** `src/services/messageService.ts:346-347`

---

## 3. A/B Test - Grupos Control vs Bonus

### BR-300: Alocacao de Grupo
- Novos usuarios sao alocados **aleatoriamente** (50/50)
- `Math.random() < 0.5 ? 'control' : 'bonus'`
- Uma vez alocado, grupo **nunca muda**

**Fonte:** `src/services/userService.ts:55`

### BR-301: Comportamento Grupo CONTROL
Quando usuario CONTROL atinge limite:
1. E **bloqueado** completamente
2. **Nao** pode criar stickers pendentes
3. Recebe menu de upgrade (com throttle 1x/dia)
4. **Nao** recebe mensagem "Seu sticker foi salvo!"

**Fonte:** `src/routes/webhook.ts:1111-1143`

### BR-302: Comportamento Grupo BONUS
Quando usuario BONUS atinge limite:
1. Se `bonus_credits_today < 2`: mostra botao "Usar Bonus"
2. Se tem bonus disponivel: **sempre** mostra menu (sem throttle)
3. Se `pending_count < 2`: pode criar sticker pendente
4. Se `pending_count >= 2` e sem bonus: usa throttle de notificacao

**Fonte:** `src/routes/webhook.ts:1144-1243`

### BR-303: Creditos de Bonus
- Maximo de **2 creditos de bonus por dia**
- Cada clique em "Usar Bonus" incrementa `bonus_credits_today` em 1
- Cada credito aumenta `limite_efetivo` em +1
- Reseta a meia-noite junto com `daily_count`

**Fonte:** `src/routes/webhook.ts:413-441`

### BR-304: Validacao de Bonus
- Usuario deve estar no grupo `bonus` para usar bonus
- Se usuario de outro grupo tentar usar: erro + sugestao de upgrade

**Fonte:** `src/routes/webhook.ts:396-410`

---

## 4. Stickers Pendentes

### BR-400: Quem Pode Ter Pendentes
- **Apenas** usuarios do grupo `bonus` podem ter stickers pendentes
- Usuarios `control` sao bloqueados sem criar pendentes

**Fonte:** `src/routes/webhook.ts:1111-1112`

### BR-401: Criacao de Pendente
Sticker e criado como `status: 'pendente'` quando:
1. Usuario do grupo `bonus`
2. `daily_count >= limite_efetivo`
3. `pending_count < 2`

**Fonte:** `src/routes/webhook.ts:1236-1243`, `src/routes/webhook.ts:1257`

### BR-402: Envio de Pendentes
- Pendentes sao enviados as **8h da manha** (horario de Brasilia)
- Job `send-pending` executado via cron
- Status muda de `pendente` para `enviado` apos envio

**Fonte:** `src/worker.ts:814-1030`

### BR-403: Mensagem de Pendente
Mensagem "Seu sticker foi salvo!" **so** e enviada se `pendingCount > 0`

**Fonte:** `src/services/messageService.ts:64-71`

---

## 5. Pagamento PIX

### BR-500: Precos PIX
| Plano | Valor |
|-------|-------|
| Premium | R$ 5,00 |
| Ultra | R$ 9,90 |

**Fonte:** `src/services/pixPaymentService.ts:28-31`

### BR-501: Expiracao PIX
- Pagamento PIX expira em **30 minutos**
- Armazenado no Redis com TTL de 24h (safety buffer)
- Backup permanente no Supabase (`pix_payments`)

**Fonte:** `src/services/pixPaymentService.ts:59`

### BR-502: Fluxo de Confirmacao PIX
1. Usuario seleciona plano
2. Usuario seleciona "PIX" como metodo
3. Sistema gera codigo PIX e envia botao "Copiar Codigo"
4. Usuario paga e clica "Ja Paguei"
5. Status muda para `confirmed`
6. Job de ativacao e agendado com delay de 5 minutos

**Fonte:** `src/routes/webhook.ts:511-534`, `src/services/pixPaymentService.ts:216-285`

### BR-503: Ativacao PIX com Retry
- Delay de **5 minutos** antes de ativar (tempo para banco processar)
- **3 tentativas** com backoff exponencial
- Mensagem de erro so na ultima tentativa
- Se nao confirmado apos 3 tentativas: mensagem de "nao confirmado"

**Fonte:** `src/jobs/activatePendingPixSubscription.ts:17-103`

### BR-504: Armazenamento PIX
- Redis: cache rapido com TTL 24h
- Supabase: backup permanente (tabela `pix_payments`)
- Se nao encontrar no Redis, busca no Supabase e restaura para Redis

**Fonte:** `src/services/pixPaymentService.ts:133-210`

---

## 6. Pagamento Stripe (Cartao/Boleto)

### BR-600: Metodos de Pagamento Stripe
- Cartao de credito
- Boleto bancario
- Payment Links pre-configurados por plano

**Fonte:** `src/services/menuService.ts:6-9`

### BR-601: Identificacao do Usuario
- `client_reference_id` no Payment Link contem o numero do WhatsApp
- Usado para vincular pagamento ao usuario correto

**Fonte:** `src/services/menuService.ts:286`

### BR-602: Mapeamento Produto → Plano
- Cada produto no Stripe tem um Product ID
- Product ID mapeado para `PlanType` via env vars
- Fallback para `premium` se produto desconhecido

**Fonte:** `src/services/stripeWebhook.ts:17-20`, `src/services/stripeWebhook.ts:105`

---

## 7. Ciclo de Vida da Assinatura

### BR-700: Assinatura Ativa
Uma assinatura e considerada **ativa** apenas se TODAS condicoes forem verdadeiras:
1. `subscription_status === 'active'`
2. `subscription_ends_at` existe (nao e null)
3. `subscription_ends_at > now()` (nao expirou)

Se qualquer condicao falhar → usuario e tratado como **free**

**Fonte:** `src/services/subscriptionService.ts:48-53`

### BR-701: Eventos Stripe Tratados
| Evento | Acao |
|--------|------|
| `checkout.session.completed` | Criar/ativar assinatura |
| `customer.subscription.updated` | Atualizar status/plano |
| `customer.subscription.deleted` | Cancelar assinatura |

**Fonte:** `src/services/stripeWebhook.ts:289-314`

### BR-702: Confirmacao Automatica
- Apos pagamento confirmado (Stripe ou PIX), mensagem de confirmacao e enviada automaticamente via WhatsApp
- Mensagem inclui beneficios do plano ativado

**Fonte:** `src/services/stripeWebhook.ts:127-146`

### BR-703: Cancelamento
- Status muda para `canceled`
- Usuario volta para limites do plano `free`
- Sem multa (cancele quando quiser)

**Fonte:** `src/services/stripeWebhook.ts:261-284`

---

## 8. Onboarding

### BR-800: Steps de Onboarding
| Step | Descricao | Trigger |
|------|-----------|---------|
| 0 | Novo usuario | Criacao |
| 1 | Primeira figurinha | Primeiro sticker criado |
| 2 | Segunda figurinha | Segundo sticker |
| 3+ | Usuario ativo | Terceiro+ stickers |

**Fonte:** `src/services/onboardingService.ts:30-34`

### BR-801: Mensagens Progressivas
- **Step 1** (1a figurinha): "Sua primeira figurinha esta pronta!" - Aha! Moment
- **Step 2** (2a figurinha): "Mais uma pronta! Voce esta arrasando!"
- **Step 3+**: "Figurinha enviada!" - Mensagem simples

**Fonte:** `src/services/onboardingService.ts:94-113`

### BR-802: Apresentacao Twitter
- Apresentada **apos a 3a figurinha** (step 3)
- Apresentada **apenas uma vez** (`twitter_feature_shown`)
- Botoes: "Quero conhecer!" ou "Agora nao"

**Fonte:** `src/services/onboardingService.ts:129-155`

### BR-803: Tracking Twitter
- `twitter_feature_shown`: se ja foi apresentado
- `twitter_feature_used`: se usuario ja usou a feature
- `first_sticker_at`: timestamp da primeira figurinha

**Fonte:** `src/services/onboardingService.ts:11-16`

---

## 9. Processamento de Stickers

### BR-900: Especificacoes Sticker Estatico
| Propriedade | Valor |
|-------------|-------|
| Dimensao | 512x512 pixels |
| Formato | WebP |
| Qualidade inicial | 90% |
| Tamanho maximo | 500KB |
| Background | Transparente |

**Fonte:** `src/services/stickerProcessor.ts:38-84`

### BR-901: Reducao de Qualidade
- Se arquivo > 500KB, reduz qualidade em steps de 10%
- Qualidade minima: 40%
- Se ainda > 500KB apos 40%: erro

**Fonte:** `src/services/stickerProcessor.ts:83-109`

### BR-902: Especificacoes Sticker Animado (GIF)
| Propriedade | Valor |
|-------------|-------|
| Dimensao maxima | 512x512 pixels |
| Formato | WebP animado |
| FPS | 15 |
| Qualidade | 75 |
| Loop | Infinito (`-loop 0`) |
| Audio | Removido (`-an`) |

**Fonte:** `src/services/gifProcessor.ts:88-140`

### BR-903: Trim Automatico
- Se video/GIF muito longo, e cortado automaticamente para `maxDuration`
- Apenas o inicio e mantido

**Fonte:** `src/services/gifProcessor.ts:101-105`

---

## 10. Validacao de Mensagens

### BR-1000: Tamanho Maximo de Arquivo
- **5MB** para imagens e videos/GIFs

**Fonte:** `src/utils/messageValidator.ts:5`

### BR-1001: Duracao Maxima de GIF
- **10 segundos** para stickers animados

**Fonte:** `src/utils/messageValidator.ts:6`

### BR-1002: Formatos de Imagem Aceitos
- JPEG / JPG
- PNG
- WebP

**Fonte:** `src/utils/messageValidator.ts:8`

### BR-1003: Formatos de Video/GIF Aceitos
- MP4
- WebM
- GIF (as vezes vem como `image/gif`)

**Fonte:** `src/utils/messageValidator.ts:10-14`

### BR-1004: Tipos de Mensagem
| Tipo | Descricao |
|------|-----------|
| `image` | Imagem estatica |
| `gif` | Video/GIF animado |
| `twitter_video` | Link do Twitter/X |
| `button_response` | Resposta de botao interativo |
| `list_response` | Resposta de lista interativa |
| `other` | Texto/outros (ignorado para stickers) |

**Fonte:** `src/utils/messageValidator.ts:147-173`

### BR-1005: Prioridade de Deteccao
1. `buttonsResponseMessage` ou `templateButtonReplyMessage` → button_response
2. `listResponseMessage` → list_response
3. Texto com URL Twitter → twitter_video
4. `imageMessage` → image
5. `videoMessage` → gif
6. Outros → other

**Fonte:** `src/utils/messageValidator.ts:149-172`

---

## 11. Twitter/X Downloads

### BR-1100: URLs Aceitas
- `twitter.com/usuario/status/ID`
- `x.com/usuario/status/ID`

**Fonte:** `src/utils/urlDetector.ts`

### BR-1101: GIFs do Twitter
- GIFs do Twitter sao **automaticamente convertidos** em stickers animados
- Nao pergunta ao usuario se quer converter
- Conta como 1 download do limite Twitter

**Fonte:** `src/worker.ts:269-345`

### BR-1102: Videos com Multiplas Midias
- Se tweet tem multiplos videos: apresenta lista de selecao
- Usuario responde com numero (1, 2, 3...) ou "cancelar"
- Contexto salvo no Redis para processar resposta

**Fonte:** `src/worker.ts:348-349`

### BR-1103: Contagem Separada
- `twitter_download_count` e **independente** de `daily_count`
- Limites resetam juntos a meia-noite

**Fonte:** `src/services/userService.ts:143-145`

### BR-1104: Conversao Video Twitter → Sticker
Fluxo de conversao:
1. Usuario envia link do Twitter
2. Bot baixa e envia video (consome 1 credito TWITTER)
3. Bot envia botoes: "Quer transformar em figurinha?"
   - "Sim, quero!" (`button_convert_sticker_{id}`)
   - "So o video" (`button_video_only`)
4. Se clicar "Sim" → converte para sticker (consome 1 credito STICKER)

**Fonte:** `src/worker.ts:534-540`, `src/routes/webhook.ts:296-330`

### BR-1105: Consumo Duplo de Limites
| Acao | Limite Consumido |
|------|------------------|
| Baixar video do Twitter | 1 credito TWITTER |
| Converter video em sticker | 1 credito STICKER |

Justificativa: sao produtos diferentes (download vs criacao)

**Fonte:** `src/worker.ts` commit `b53c0bf`

### BR-1106: Video Ja Convertido
- Um video so pode ser convertido em sticker **uma vez**
- Campo `converted_to_sticker` no banco previne duplicatas
- Se ja convertido: erro "Video already converted to sticker"

**Fonte:** `src/worker.ts:665-667`

### BR-1107: Auto-Trim de Videos Longos
- Videos longos (>10s) sao cortados automaticamente
- Apenas o **inicio** e mantido (primeiros 10s)
- Usuario nao e notificado do corte

**Fonte:** `src/services/gifProcessor.ts:101-105`

### BR-1108: Limites de Download Twitter
| Limite | Valor | Motivo |
|--------|-------|--------|
| Tamanho maximo | 16MB | Limite do WhatsApp |
| Duracao maxima | 90 segundos | Limite do WhatsApp |
| Timeout download | 60 segundos | Evitar travamento |

**Fonte:** `src/services/twitterService.ts:15-18`

### BR-1109: Validacao Pre-Download
Antes de baixar, o sistema valida:
1. Duracao do video (metadata) <= 90s
2. Se > 90s: retorna erro sem baixar

Durante o download:
1. Se buffer > 16MB: aborta
2. Se timeout > 60s: aborta

**Fonte:** `src/services/twitterService.ts:162-191`

---

## 12. Storage e Buckets

### BR-1200: Buckets Supabase
| Bucket | Conteudo |
|--------|----------|
| `stickers-estaticos` | Stickers estaticos (WebP) |
| `stickers-animados` | Stickers animados (WebP) |
| `twitter-videos` | Videos baixados do Twitter |

**Fonte:** `src/services/supabaseStorage.ts:33`

### BR-1201: Estrutura de Path
```
user_{whatsapp_number}/{timestamp}_{randomId}.webp
```
Exemplo: `user_5511999999999/1704567890123_a1b2c3d4e5f6g7h8.webp`

**Fonte:** `src/services/supabaseStorage.ts:27-30`

### BR-1202: Cache Control
- Headers de cache: 3600 segundos (1 hora)
- Upsert desabilitado (nao sobrescreve)

**Fonte:** `src/services/supabaseStorage.ts:44-46`

---

## 13. Experiencia do Usuario (UX)

### BR-1300: Stickers Silenciosos
- Stickers sao enviados **sem mensagem de confirmacao**
- Nao envia "Figurinha enviada! X restantes"
- Reduz spam de 11 mensagens para 5 (para 4 stickers)

**Comportamento anterior (removido):**
```
1. Boas-vindas
2. Sticker 1 + "3 restantes"
3. Sticker 2 + "2 restantes"
4. Sticker 3 + "1 restante"
5. Sticker 4 + "0 restantes"
6. Botoes de edicao
Total: 11 mensagens
```

**Comportamento atual:**
```
1. Boas-vindas (so primeira vez)
2-5. Stickers silenciosos
6. Menu de limite (quando atingir)
Total: 5-6 mensagens
```

**Fonte:** commit `10f74fc`, `src/worker.ts:103,144-146`

### BR-1301: Twitter Flow Silencioso
- Removidas mensagens intermediarias do Twitter:
  - ❌ "Video baixado com sucesso!"
  - ❌ "Processando conversao..."
  - ❌ "Figurinha criada com sucesso!"
- Apenas envia: [Video] + [Botoes] + [Sticker]
- Reducao de 6 para 3 mensagens (50%)

**Fonte:** commit `c07ba04`

### BR-1302: Debounce de Alertas
- Alertas criticos tem debounce de 5 minutos
- Evita spam de alertas para o mesmo erro
- Controlado por `alertService.ts`

**Fonte:** `src/services/alertService.ts:137-162`

---

## 14. Mensagens e Notificacoes

### BR-1400: Throttle de Notificacao
- Menu de "limite atingido" e enviado **apenas 1x por dia** (quando sem bonus)
- Controlado por `limit_notified_at` no banco
- Funcao atomica `setLimitNotifiedAtomic` previne duplicatas

**Fonte:** `src/routes/webhook.ts:1119-1134`, `src/services/atomicLimitService.ts:83-108`

### BR-1401: Excecao ao Throttle
Grupo BONUS com creditos disponiveis **sempre** recebe menu (sem throttle)

**Fonte:** `src/routes/webhook.ts:1159-1191`

### BR-1402: Mensagem de Boas-vindas
- Enviada apenas para **novos usuarios**
- Versao curta focada em acao imediata (Time to Value)
- Texto: "Envie uma imagem, video ou GIF agora mesmo que eu transformo em figurinha!"

**Fonte:** `src/services/menuService.ts:23-26`

### BR-1403: Tipos de Erro
| Tipo | Descricao |
|------|-----------|
| `processing` | Erro ao processar sticker |
| `invalid_format` | Formato nao suportado |
| `file_too_large` | Arquivo > 5MB |
| `general` | Erro generico |

**Fonte:** `src/services/messageService.ts:162-228`

---

## 15. Operacoes Atomicas (Race Conditions)

### BR-1500: Verificacao Atomica de Limite
- Funcao RPC `check_and_increment_daily_limit()` usa `SELECT FOR UPDATE`
- Verifica limite **E** incrementa contador em uma unica transacao
- Previne bypass de limite quando multiplas imagens enviadas simultaneamente

**Problema resolvido:** Usuario enviava 5 imagens em 1 segundo, todas passavam no check de limite

**Fonte:** `src/services/atomicLimitService.ts`, commit `c457508`

### BR-1501: Notificacao Atomica de Limite
- Funcao RPC `set_limit_notified_atomic()` usa `SELECT FOR UPDATE`
- Apenas a primeira requisicao envia mensagem, outras sao ignoradas
- Previne envio de multiplas mensagens de limite

**Problema resolvido:** Usuario recebia 2+ mensagens de limite ao enviar imagens simultaneamente

**Fonte:** `src/services/atomicLimitService.ts:83-108`

### BR-1502: Welcome Message Atomica
- Usa `onboarding_step` com UPDATE atomico (`WHERE onboarding_step = 0`)
- Apenas uma requisicao consegue atualizar para step 1
- Apenas essa requisicao envia welcome message

**Problema resolvido:** Novos usuarios recebiam 2+ mensagens de boas-vindas

**Fonte:** commit `c457508`

### BR-1503: Anti-Loop Twitter
- Sistema robusto para prevenir loops infinitos no download de Twitter
- Detecta e bloqueia requisicoes duplicadas

**Fonte:** commit `13d1b2e`

---

## 16. Comandos de Texto

### BR-1600: Comandos Disponiveis
| Comando | Aliases | Acao |
|---------|---------|------|
| `planos` | `plans` | Mostra lista de planos |
| `status` | `assinatura` | Mostra status da assinatura |
| `ajuda` | `help`, `comecar` | Mostra mensagem de ajuda |

**Fonte:** `src/routes/webhook.ts:733-771`

### BR-1601: Comandos Case-Insensitive
- Todos os comandos sao normalizados para lowercase antes de comparacao
- `PLANOS`, `Planos`, `planos` funcionam igualmente

**Fonte:** `src/routes/webhook.ts:150`

---

## 17. Usuarios

### BR-1700: Criacao de Usuario
Ao receber primeira mensagem:
1. Busca usuario por `whatsapp_number`
2. Se nao existe: cria novo com grupo A/B aleatorio
3. `daily_count` inicia em 0
4. `bonus_credits_today` inicia em 0

**Fonte:** `src/services/userService.ts:25-97`

### BR-1701: Dados do Usuario via WhatsApp
| Campo | Origem |
|-------|--------|
| `whatsapp_number` | `remoteJid` sem `@s.whatsapp.net` |
| `name` | `pushName` ou "Usuario" (fallback) |

**Fonte:** `src/routes/webhook.ts:116-117`

### BR-1702: Grupo A/B Imutavel
- Grupo A/B e definido **apenas** na criacao do usuario
- Nunca e modificado posteriormente
- Garante consistencia do experimento

**Fonte:** `src/services/userService.ts:42-51`

### BR-1703: Mensagens do Proprio Bot
- Mensagens com `fromMe: true` sao **ignoradas**
- Evita loops infinitos

**Fonte:** `src/routes/webhook.ts:94-100`

---

## 18. Reset Diario

### BR-1800: Horario do Reset
- Reset ocorre a **meia-noite** (00:00) horario de Brasilia
- Tambem ha reset automatico quando usuario interage apos meia-noite

**Fonte:** `src/services/userService.ts:133-146`

### BR-1801: Campos Resetados
Na meia-noite, os seguintes campos sao zerados:
- `daily_count` → 0
- `twitter_download_count` → 0
- `bonus_credits_today` → 0
- `limit_notified_at` → null (implicitamente pela data)
- `last_reset_at` → timestamp atual

**Fonte:** `src/services/userService.ts:140-147`

### BR-1802: Reset Automatico (Lazy)
Se `last_reset_at < hoje_meia_noite`:
- Sistema reseta contadores automaticamente
- Ocorre na primeira interacao do dia

**Fonte:** `src/services/userService.ts:121-172`

---

## 19. Filas e Workers (BullMQ)

### BR-1900: Filas Disponiveis
| Fila | Descricao |
|------|-----------|
| `process-sticker` | Processamento de imagens/GIFs |
| `scheduled-jobs` | Jobs agendados (reset, pendentes) |
| `download-twitter-video` | Download de videos do Twitter |
| `convert-twitter-sticker` | Conversao Twitter → Sticker |
| `activate-pix-subscription` | Ativacao de assinatura PIX |
| `cleanup-sticker` | Remocao de bordas/backgrounds |
| `edit-buttons` | Envio debounced de botoes de edicao |

**Fonte:** `src/config/queue.ts:31-64`

### BR-1901: Concorrencia por Fila
| Fila | Concurrency | Justificativa |
|------|-------------|---------------|
| `process-sticker` | 5 | Alta demanda, processamento rapido |
| `download-twitter-video` | 3 | Limitado por I/O de rede |
| `convert-twitter-sticker` | 2 | Processamento pesado (FFmpeg) |
| `scheduled-jobs` | 1 | Jobs sequenciais (evita conflito) |
| `activate-pix-subscription` | 2 | Operacoes criticas |
| `cleanup-sticker` | 2 | Processamento pesado |
| `edit-buttons` | 5 | Apenas envio de mensagens |

**Fonte:** `src/worker.ts:239,625,809,1100,1160,1410,1483`

### BR-1902: Tentativas de Retry
| Tipo | Tentativas | Backoff |
|------|------------|---------|
| Default | 2 | Exponencial (2s, 4s) |
| PIX | 3 | Exponencial (5s, 25s, 125s) |

Justificativa: PIX e mais critico, precisa de mais tentativas

**Fonte:** `src/config/queue.ts:16-51`

### BR-1903: Retencao de Jobs
| Status | Retencao | Quantidade |
|--------|----------|------------|
| Completed | 24 horas | Ultimos 1000 |
| Failed | 7 dias | Todos |

**Fonte:** `src/config/queue.ts:21-27`

### BR-1904: Debounce de Edit Buttons
- Botoes de edicao (remover borda, fundo) enviados apos **10 segundos** de debounce
- Se usuario envia multiplos stickers rapido, recebe apenas 1 mensagem de botoes
- Implementado via `delay` no job

**Fonte:** `src/worker.ts:1536`

---

## Apendice A: Matriz de Decisao - Limite Atingido

```
Usuario atinge limite diario
          |
          v
    E grupo CONTROL?
        /     \
      Sim     Nao (BONUS)
       |           |
       v           v
   BLOQUEIA    Tem bonus disponivel? (bonus_credits_today < 2)
       |              /     \
       v           Sim      Nao
  [Throttle]        |         |
       |            v         v
       v      MOSTRA MENU   pending_count < 2?
  Ja notificou   (sempre)      /     \
  hoje?             |       Sim      Nao
   / \              v        |         |
 Sim  Nao      Usuario       v         v
  |    |       pode usar   SALVA    [Throttle]
  v    v       bonus       PENDENTE     |
NADA  MENU                    |         v
      UPGRADE                 v      Ja notificou?
                          PROCESSA     / \
                          (status    Sim  Nao
                          pendente)   |    |
                                     v    v
                                   NADA  MENU
                                         UPGRADE
```

---

## Apendice B: Fluxo de Pagamento PIX

```
Usuario seleciona plano
         |
         v
Seleciona metodo PIX
         |
         v
Sistema gera codigo PIX
         |
         v
Envia botao "Copiar Codigo"
         |
         v
Usuario paga no banco
         |
         v
Usuario clica "Ja Paguei"
         |
         v
Status: pending → confirmed
         |
         v
Job agendado (5 min delay)
         |
         v
    Ativacao?
      /   \
   Sim    Nao (nao confirmou)
    |        |
    v        v
 ATIVA    Retry?
 PLANO      /  \
    |     Sim  Nao (3 tentativas)
    v      |     |
MENSAGEM   v     v
SUCESSO  RETRY  ERRO
           |   "Nao confirmado"
           v
        +backoff
```

---

## Apendice C: Fluxo de Onboarding

```
Novo Usuario
     |
     v
Welcome Message
     |
     v
Envia 1a imagem
     |
     v
Step 1: "Sua primeira figurinha!"
     |
     v
Envia 2a imagem
     |
     v
Step 2: "Voce esta arrasando!"
     |
     v
Envia 3a imagem
     |
     v
Step 3: Figurinha enviada
     |
     +---> Apresenta Twitter Feature (1x)
              |
              v
         [Quero conhecer!] ou [Agora nao]
              |                    |
              v                    v
         Instrucoes           Mensagem OK
         Twitter              (pode ver depois)
```

---

## Historico de Alteracoes

| Data | Regra | Mudanca |
|------|-------|---------|
| 2026-01-07 | BR-403 | Corrigido bug: mensagem "sticker salvo" nao enviada para grupo control |
| 2026-01-07 | BR-302 | Implementado: bonus disponivel sempre mostra menu (sem throttle) |
| 2026-01-07 | BR-1104-1107 | Adicionadas regras de conversao Twitter→Sticker |
| 2026-01-07 | BR-1108-1109 | Adicionadas regras de limites de download Twitter (16MB, 90s, 60s timeout) |
| 2026-01-07 | BR-1300-1302 | Adicionadas regras de UX (stickers silenciosos, debounce) |
| 2026-01-07 | BR-1500-1503 | Adicionadas regras de operacoes atomicas (race conditions) |
| 2026-01-07 | BR-1900-1904 | Adicionadas regras de filas/workers (concurrency, retry, retention) |
| 2026-01-07 | * | Documento criado com 85+ regras em 19 categorias |

---

## Referencias de Codigo

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/types/subscription.ts` | Definicao de planos e limites |
| `src/services/userService.ts` | Logica de usuarios e limites |
| `src/services/subscriptionService.ts` | Logica de assinaturas |
| `src/services/menuService.ts` | Menus interativos e mensagens |
| `src/services/messageService.ts` | Mensagens de sistema |
| `src/services/pixPaymentService.ts` | Logica de pagamento PIX |
| `src/services/stripeWebhook.ts` | Webhooks Stripe |
| `src/services/onboardingService.ts` | Fluxo de onboarding |
| `src/services/stickerProcessor.ts` | Processamento de stickers estaticos |
| `src/services/gifProcessor.ts` | Processamento de GIFs/animados |
| `src/services/supabaseStorage.ts` | Upload para Supabase Storage |
| `src/services/atomicLimitService.ts` | Operacoes atomicas de limite |
| `src/services/twitterService.ts` | Download e validacao de videos Twitter |
| `src/config/queue.ts` | Configuracao de filas BullMQ |
| `src/utils/messageValidator.ts` | Validacao de mensagens |
| `src/routes/webhook.ts` | Handler principal de mensagens |
| `src/worker.ts` | Processamento de jobs |
| `src/jobs/activatePendingPixSubscription.ts` | Ativacao de assinatura PIX |
