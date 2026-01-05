# 📋 PRD - Bot de Stickers WhatsApp

**Versão:** 1.1
**Data:** 27/12/2025 (Atualizado)
**Autor:** Paulo Henrique
**Status:** Testes Locais Completos ✅ → Preparando Deploy VPS

---

## 📑 Índice

1. [Resumo Executivo](#resumo-executivo)
2. [Problema e Solução](#problema-e-solução)
3. [Personas](#personas)
4. [Requisitos Funcionais](#requisitos-funcionais)
5. [Requisitos Não Funcionais](#requisitos-não-funcionais)
6. [Arquitetura Técnica](#arquitetura-técnica)
7. [Modelo de Dados](#modelo-de-dados)
8. [Fluxos de Usuário](#fluxos-de-usuário)
9. [Mensagens do Bot](#mensagens-do-bot)
10. [Roadmap de Sprints](#roadmap-de-sprints)
11. [Lições Aprendidas e Requisitos Técnicos Críticos](#lições-aprendidas-e-requisitos-técnicos-críticos)
12. [Métricas de Sucesso](#métricas-de-sucesso)
13. [Riscos e Mitigações](#riscos-e-mitigações)
14. [Critérios de Aceitação](#critérios-de-aceitação)

---

## 1. Resumo Executivo {#resumo-executivo}

### O Que É?

Bot de WhatsApp que **transforma imagens e GIFs em stickers** (figurinhas) automaticamente. O usuário envia uma foto, o bot processa e devolve como sticker pronto para usar.

### Por Quê?

- ✅ Criar stickers manualmente é complicado (precisa app, redimensionar, converter)
- ✅ Usuários querem transformar fotos em figurinhas rapidamente
- ✅ Oportunidade de validar produto antes de monetizar

### MVP (v1.0)

- ✅ Stickers **estáticos** (imagens) e **animados** (GIFs)
- ✅ Limite de **10 stickers/dia grátis** por usuário
- ✅ **CRM de retenção**: processa além do limite, envia no dia seguinte
- ✅ Processamento assíncrono (filas)
- ✅ Deploy em VPS própria (custo zero)

### Fora do MVP

- ❌ Pagamentos (Stripe) → v2
- ❌ Dashboard web → v2
- ❌ Stickers com texto/marca d'água → v2
- ❌ Packs de stickers → v2

---

## 2. Problema e Solução {#problema-e-solução}

### 🔴 Problema

**Criar stickers no WhatsApp é complicado:**
1. Precisa baixar app de terceiros (Sticker Maker, etc)
2. Precisa redimensionar imagem manualmente (512x512)
3. Precisa converter para formato correto (WebP)
4. Apps têm muitos ads e são invasivos

**Resultado:** Usuários desistem ou não sabem como fazer.

### 🟢 Solução

**Bot automático no próprio WhatsApp:**
1. Usuário envia imagem/GIF
2. Bot processa automaticamente (resize + convert)
3. Usuário recebe sticker pronto em segundos
4. Zero apps externos, zero fricção

### 💡 Diferencial

- ✅ **Retenção automática**: Se atingir limite, guarda stickers e envia no dia seguinte
- ✅ **CRM passivo**: Usuário volta todo dia para buscar stickers pendentes
- ✅ **Experiência perfeita**: Tudo dentro do WhatsApp

---

## 3. Personas {#personas}

### Persona 1: "João - O Memeiro"

**Demografia:**
- Idade: 18-25 anos
- Ocupação: Estudante universitário
- Uso de WhatsApp: Pesado (grupos de amigos, memes)

**Comportamento:**
- Envia memes o dia todo
- Quer transformar fotos/memes em stickers rapidamente
- Não quer instalar apps extras

**Objetivo:**
- Criar stickers de memes para grupos de amigos
- Ter stickers personalizados

**Dor:**
- Apps de sticker são cheios de ads
- Processo manual é demorado

---

### Persona 2: "Maria - A Empreendedora"

**Demografia:**
- Idade: 28-40 anos
- Ocupação: Dona de negócio local
- Uso de WhatsApp: Profissional (atendimento a clientes)

**Comportamento:**
- Usa WhatsApp Business
- Quer stickers da marca para atendimento
- Quer algo rápido e fácil

**Objetivo:**
- Criar stickers com logo da empresa
- Personalizar atendimento

**Dor:**
- Não sabe usar apps de edição
- Precisa de algo profissional

---

### Persona 3: "Pedro - O Entusiasta de GIFs"

**Demografia:**
- Idade: 20-35 anos
- Ocupação: Trabalhador CLT
- Uso de WhatsApp: Moderado (família, amigos)

**Comportamento:**
- Adora GIFs animados
- Quer transformar GIFs em stickers animados
- Tecnicamente capaz, mas quer praticidade

**Objetivo:**
- Criar stickers animados de séries/filmes
- Impressionar amigos com stickers únicos

**Dor:**
- Difícil encontrar ferramenta que faça GIF → sticker
- Apps existentes não preservam animação

---

## 4. Requisitos Funcionais {#requisitos-funcionais}

### RF01: Receber Imagens

**Descrição:** Sistema deve receber imagens enviadas via WhatsApp

**Critérios:**
- ✅ Formatos aceitos: JPG, PNG, WebP
- ✅ Tamanho mínimo: 100x100px
- ✅ Tamanho máximo: 5MB
- ✅ Responder erro se formato/tamanho inválido

**Mensagem de erro:**
```
Formato inválido → "Só aceito imagens JPG, PNG ou WEBP! 📸"
Muito pequeno → "Essa imagem é muito pequena! Manda uma com pelo menos 100x100px."
Muito grande → "Arquivo muito grande! Máximo 5MB."
```

---

### RF02: Receber GIFs Animados

**Descrição:** Sistema deve receber GIFs/vídeos animados

**Critérios:**
- ✅ Formato: MP4 com `gifPlayback=true` (WhatsApp envia assim)
- ✅ Duração máxima: 10 segundos
- ✅ Tamanho máximo: 5MB

**Mensagem de erro:**
```
Muito longo → "GIF muito longo! Máximo 10 segundos."
Muito grande → "Arquivo muito grande! Máximo 5MB."
```

---

### RF03: Processar Sticker Estático

**Descrição:** Converter imagem em sticker WebP 512x512

**Critérios:**
- ✅ Redimensionar para 512x512 (manter aspect ratio, padding transparente)
- ✅ Converter para WebP (qualidade 90%)
- ✅ Tamanho final: <500KB
- ✅ Tempo de processamento: <5 segundos

**Tecnologia:** Sharp (Node.js)

---

### RF04: Processar Sticker Animado

**Descrição:** Converter GIF em sticker WebP animado 512x512

**Critérios:**
- ✅ Redimensionar para 512x512 (aspect ratio + padding)
- ✅ Converter para WebP animado (15 FPS, qualidade 75%)
- ✅ Tamanho final: <500KB
- ✅ Tempo de processamento: <10 segundos

**Tecnologia:** FFmpeg

---

### RF05: Sistema de Limite Diário

**Descrição:** Cada usuário tem 10 stickers grátis por dia

**Critérios:**
- ✅ Contador resetado à meia-noite (00:00)
- ✅ Imagens 1-10: processa e envia imediatamente
- ✅ Imagens 11+: processa mas salva como 'pendente'
- ✅ Mostrar mensagem de aviso no 11º sticker

**Mensagem de aviso:**
```
Opa, [Nome]! Você já usou suas 10 figurinhas grátis de hoje! 🎉

Mas relaxa, vou guardar essas próximas aqui pra você.
Amanhã de manhã te mando elas prontinho! 😊

(Você tem [X] figurinhas guardadas)
```

---

### RF06: CRM de Retenção (Stickers Pendentes)

**Descrição:** Enviar stickers pendentes no dia seguinte (8h da manhã)

**Critérios:**
- ✅ Job roda às 8h da manhã
- ✅ Busca stickers com `status='pendente'`
- ✅ Envia mensagem personalizada de bom dia
- ✅ Envia todos os stickers pendentes do usuário
- ✅ Atualiza status para 'enviado'

**Mensagem de envio:**
```
Bom dia, [Nome]! 🌞

Aqui estão suas figurinhas de ontem:
```
(envia os stickers)

---

### RF07: Capturar Dados do Usuário

**Descrição:** Salvar informações do usuário na primeira interação

**Critérios:**
- ✅ Número de telefone (do webhook)
- ✅ Nome (campo `pushName` do webhook)
- ✅ Salvar na tabela `users`
- ✅ Não duplicar (unique constraint no telefone)

---

### RF08: Rate Limiting

**Descrição:** Prevenir spam (máximo 5 stickers por minuto)

**Critérios:**
- ✅ Se usuário enviar >5 imagens em 1 minuto, bloquear temporariamente
- ✅ Enviar mensagem de aviso
- ✅ Liberar após 1 minuto

**Mensagem:**
```
Calma! Espera uns segundos antes de mandar outra. ⏰
```

---

### RF09: Armazenamento de Stickers

**Descrição:** Salvar stickers no Supabase Storage

**Critérios:**
- ✅ Bucket `stickers-estaticos` para imagens
- ✅ Bucket `stickers-animados` para GIFs
- ✅ Estrutura: `bucket/user_[numero]/[timestamp]_[id].webp`
- ✅ URLs públicas (CDN do Supabase)

**Exemplo de path:**
```
stickers-estaticos/user_5511999999999/1735252800_abc123.webp
```

---

### RF10: Mensagem de Boas-Vindas

**Descrição:** Enviar mensagem explicativa na primeira vez

**Critérios:**
- ✅ Detectar se é primeira mensagem do usuário
- ✅ Enviar explicação de como usar
- ✅ Mencionar limite de 10/dia

**Mensagem:**
```
Olá, [Nome]! 👋
Eu transformo suas fotos em figurinhas do WhatsApp!

📸 Manda uma imagem ou GIF
🎨 Eu converto e devolvo como sticker
🆓 10 figurinhas grátis por dia

Bora testar? Manda uma foto aí!
```

---

## 5. Requisitos Não Funcionais {#requisitos-não-funcionais}

### RNF01: Performance

| Métrica | Meta | Como medir |
|---------|------|------------|
| Tempo de processamento (estático) | <5s | Logs de jobs BullMQ |
| Tempo de processamento (animado) | <10s | Logs de jobs BullMQ |
| Throughput | 100 stickers/minuto | Métricas de fila |
| Uptime | >99% | Monitoramento de containers |

---

### RNF02: Escalabilidade

- ✅ Arquitetura baseada em filas (horizontal scaling)
- ✅ Workers BullMQ podem escalar (múltiplas instâncias)
- ✅ Supabase Storage escala automaticamente
- ✅ Redis pode escalar (cluster)

**Limite inicial:** 1.000 stickers/dia (MVP)

---

### RNF03: Segurança

| Requisito | Implementação |
|-----------|---------------|
| Credenciais | Doppler (nunca no código) |
| Webhook | Validar API key da Evolution API |
| SQL Injection | Query parametrizadas (Postgres) |
| Rate Limiting | Redis + middleware Fastify |
| HTTPS | SSL via Let's Encrypt (stickers.ytem.com.br) |

---

### RNF04: Observabilidade

**Logs estruturados (Pino):**
```json
{
  "level": "info",
  "time": 1735252800,
  "user_number": "5511999999999",
  "action": "sticker_processed",
  "tipo": "estatico",
  "duration_ms": 3200,
  "file_size_bytes": 87654
}
```

**Logs de erro:**
```json
{
  "level": "error",
  "time": 1735252800,
  "user_number": "5511999999999",
  "action": "sticker_failed",
  "error": "Sharp processing failed",
  "stack": "..."
}
```

---

### RNF05: Disponibilidade

- ✅ Deploy via Docker Compose
- ✅ Restart automático (restart: always)
- ✅ Health checks (HTTP /health endpoint)
- ✅ Backup automático do Supabase (diário)

---

### RNF06: Custo

**MVP (50 usuários, 10 stickers/dia):**

| Recurso | Custo |
|---------|-------|
| VPS (já tem) | $0 |
| Supabase Free (até 1GB) | $0 |
| Redis (local) | $0 |
| Evolution API (local) | $0 |
| Domínio (ytem.com.br) | $0 (já tem) |
| SSL (Let's Encrypt) | $0 |

**Total:** $0/mês 🎉

**Quando escalar (>1GB storage):**
- Supabase Pro: $25/mês

---

## 6. Arquitetura Técnica {#arquitetura-técnica}

### Stack Completa

```
┌─────────────────────────────────────────────────────┐
│                    USUÁRIO                          │
│                   WhatsApp                          │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌────────────────────────────────────────────────────┐
│            Evolution API (v2.3.1+)                 │
│         http://localhost:8080                      │
│  - Recebe mensagens                                │
│  - Envia webhooks                                  │
│  - Envia stickers                                  │
└────────────────┬───────────────────────────────────┘
                 │
                 ↓ (webhook)
┌────────────────────────────────────────────────────┐
│         Backend Fastify (TypeScript)               │
│         https://stickers.ytem.com.br                  │
│                                                    │
│  Endpoints:                                        │
│  - POST /webhook     (recebe mensagens)            │
│  - GET  /health      (health check)                │
│  - GET  /stats       (estatísticas básicas)        │
└──┬──────────────────────────────┬──────────────────┘
   │                              │
   ↓                              ↓
┌──────────────────┐     ┌──────────────────────────┐
│  Redis (Fila)    │     │   Supabase (Cloud)       │
│  BullMQ          │     │                          │
│                  │     │  - PostgreSQL            │
│  Queues:         │     │  - Storage (CDN)         │
│  - process-image │     │                          │
│  - process-gif   │     │  Tables:                 │
│  - send-pending  │     │  - users                 │
└──┬───────────────┘     │  - stickers              │
   │                     │  - usage_logs            │
   ↓                     │                          │
┌──────────────────┐     │  Buckets:                │
│  Worker BullMQ   │     │  - stickers-estaticos    │
│                  │     │  - stickers-animados     │
│  Processamento:  │     └──────────────────────────┘
│  - Sharp (img)   │              ↑
│  - FFmpeg (gif)  │              │
│  - Upload        │──────────────┘
└──────────────────┘     (upload files)
```

---

### Tecnologias

| Componente | Tecnologia | Versão | Por quê? |
|------------|------------|--------|----------|
| **Backend** | Fastify | ^4.0 | Rápido, leve, TypeScript nativo |
| **Runtime** | Node.js | 20 LTS | Estável, largo suporte |
| **Linguagem** | TypeScript | ^5.0 | Type safety, produtividade |
| **Banco** | PostgreSQL (Supabase) | 15 | Managed, backup automático |
| **Storage** | Supabase Storage | - | CDN global, 1GB grátis |
| **Fila** | Redis + BullMQ | ^4.0 | Processamento assíncrono |
| **Imagens** | Sharp | ^0.33 | Rápido, moderno |
| **GIFs** | FFmpeg | 6.0 | Padrão da indústria |
| **WhatsApp** | Evolution API | 2.3.1+ | Stickers animados |
| **Logs** | Pino | ^8.0 | Estruturado, performance |
| **Deploy** | Docker Compose | - | Fácil deploy, isolamento |
| **Secrets** | Doppler | - | Já usa no projeto Brazyl |

---

### Fluxo de Dados

#### 1. Recebimento de Mensagem

```
WhatsApp (usuário envia imagem)
    ↓
Evolution API detecta nova mensagem
    ↓
Evolution API → POST https://stickers.ytem.com.br/webhook
    ↓
Backend Fastify valida webhook (API key)
    ↓
Backend extrai dados:
  - user_number: "5511999999999"
  - user_name: "Paulo"
  - messageType: "imageMessage"
  - imageUrl: "https://mmg.whatsapp.net/..."
    ↓
Backend verifica limite diário (query PostgreSQL)
    ↓
Backend adiciona job na fila Redis
    ↓
Backend retorna 200 OK (webhook processado)
```

#### 2. Processamento Assíncrono

```
Worker BullMQ pega job da fila
    ↓
Worker baixa imagem (fetch imageUrl)
    ↓
Worker processa com Sharp:
  - Resize 512x512 (aspect ratio + padding)
  - Convert WebP (quality 90%)
  - Output: Buffer
    ↓
Worker faz upload para Supabase Storage:
  - Bucket: stickers-estaticos
  - Path: user_5511999999999/1735252800_abc123.webp
    ↓
Worker obtém URL pública:
  - https://[project].supabase.co/storage/v1/object/public/stickers-estaticos/user_5511999999999/1735252800_abc123.webp
    ↓
Worker salva metadados no PostgreSQL:
  - user_number, file_path, file_url, tipo, status
    ↓
Worker envia sticker via Evolution API:
  - POST /message/sendSticker/meu-zap
  - Body: { number, sticker: url }
    ↓
Worker atualiza status='enviado' (se enviou)
    ↓
Worker incrementa daily_count do usuário
    ↓
Job concluído ✅
```

---

### Deploy (VPS Brazyl)

**Estrutura de diretórios:**

```
/root/
├── brazyl/              ← Projeto existente
│   ├── backend/
│   ├── web/
│   └── ...
│
└── sticker-bot/         ← NOVO! Projeto do bot
    ├── docker-compose.yml
    ├── .env              ← Ignorado (usa Doppler)
    ├── src/
    │   ├── server.ts
    │   ├── webhook.ts
    │   ├── worker.ts
    │   └── ...
    ├── Dockerfile
    └── package.json
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  backend:
    build: .
    container_name: sticker_bot_backend
    restart: always
    ports:
      - "3100:3000"  # Porta diferente do Brazyl
    environment:
      - NODE_ENV=production
      - DOPPLER_TOKEN=${DOPPLER_TOKEN}
    command: doppler run -- node dist/server.js
    depends_on:
      - redis
    networks:
      - sticker_network

  worker:
    build: .
    container_name: sticker_bot_worker
    restart: always
    environment:
      - NODE_ENV=production
      - DOPPLER_TOKEN=${DOPPLER_TOKEN}
    command: doppler run -- node dist/worker.js
    depends_on:
      - redis
    networks:
      - sticker_network

  redis:
    image: redis:7-alpine
    container_name: sticker_bot_redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - sticker_network

networks:
  sticker_network:
    driver: bridge

volumes:
  redis_data:
```

**Nginx config (stickers.ytem.com.br):**

```nginx
server {
    listen 80;
    server_name stickers.ytem.com.br;

    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name stickers.ytem.com.br;

    # SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/stickers.ytem.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stickers.ytem.com.br/privkey.pem;

    # Proxy para backend
    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Logs
    access_log /var/log/nginx/stickers-access.log;
    error_log /var/log/nginx/stickers-error.log;
}
```

---

## 7. Modelo de Dados {#modelo-de-dados}

### Tabela: `users`

**Descrição:** Informações e limites dos usuários

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT,
  daily_count INTEGER DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_daily_count ON users(daily_count DESC);

-- Comentários
COMMENT ON TABLE users IS 'Usuários do bot de stickers';
COMMENT ON COLUMN users.phone_number IS 'Número no formato 5511999999999';
COMMENT ON COLUMN users.name IS 'Nome capturado do pushName (WhatsApp)';
COMMENT ON COLUMN users.daily_count IS 'Contador de stickers usados hoje (reseta à meia-noite)';
COMMENT ON COLUMN users.last_reset_at IS 'Último reset do contador diário';
```

**Exemplo de registro:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "phone_number": "5511999999999",
  "name": "Paulo",
  "daily_count": 7,
  "last_reset_at": "2025-12-26T00:00:00Z",
  "created_at": "2025-12-20T14:30:00Z",
  "updated_at": "2025-12-26T10:45:00Z"
}
```

---

### Tabela: `stickers`

**Descrição:** Metadados dos stickers processados

```sql
CREATE TABLE stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_number TEXT NOT NULL,
  user_name TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('estatico', 'animado')),
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'pendente')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_stickers_user_number ON stickers(user_number);
CREATE INDEX idx_stickers_status ON stickers(status) WHERE status = 'pendente';
CREATE INDEX idx_stickers_created_at ON stickers(created_at DESC);
CREATE INDEX idx_stickers_tipo ON stickers(tipo);

-- Comentários
COMMENT ON TABLE stickers IS 'Metadados dos stickers processados';
COMMENT ON COLUMN stickers.file_path IS 'Caminho no Storage: bucket/user_xxx/timestamp_id.webp';
COMMENT ON COLUMN stickers.file_url IS 'URL pública do CDN do Supabase';
COMMENT ON COLUMN stickers.status IS 'enviado: já foi pro usuário | pendente: guardado para amanhã';
COMMENT ON COLUMN stickers.sent_at IS 'Quando o sticker foi enviado ao usuário (null se pendente)';
```

**Exemplo de registro (enviado):**

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "user_number": "5511999999999",
  "user_name": "Paulo",
  "file_path": "stickers-estaticos/user_5511999999999/1735252800_abc123.webp",
  "file_url": "https://ludlztjdvwsrwlsczoje.supabase.co/storage/v1/object/public/stickers-estaticos/user_5511999999999/1735252800_abc123.webp",
  "file_size_bytes": 87654,
  "tipo": "estatico",
  "status": "enviado",
  "sent_at": "2025-12-26T10:45:23Z",
  "created_at": "2025-12-26T10:45:20Z"
}
```

**Exemplo de registro (pendente):**

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "user_number": "5511999999999",
  "user_name": "Paulo",
  "file_path": "stickers-estaticos/user_5511999999999/1735260000_def456.webp",
  "file_url": "https://ludlztjdvwsrwlsczoje.supabase.co/storage/v1/object/public/stickers-estaticos/user_5511999999999/1735260000_def456.webp",
  "file_size_bytes": 92341,
  "tipo": "estatico",
  "status": "pendente",
  "sent_at": null,
  "created_at": "2025-12-26T12:53:20Z"
}
```

---

### Tabela: `usage_logs` (Opcional - Analytics)

**Descrição:** Log de ações para analytics

```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_number TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice
CREATE INDEX idx_usage_logs_created_at ON usage_logs(created_at DESC);
CREATE INDEX idx_usage_logs_action ON usage_logs(action);

-- Comentários
COMMENT ON TABLE usage_logs IS 'Log de ações para analytics';
COMMENT ON COLUMN usage_logs.action IS 'sticker_created, limit_reached, error, etc';
```

**Exemplo de registro:**

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "user_number": "5511999999999",
  "action": "sticker_created",
  "details": {
    "tipo": "estatico",
    "processing_time_ms": 3200,
    "file_size_bytes": 87654
  },
  "created_at": "2025-12-26T10:45:20Z"
}
```

---

### Buckets do Supabase Storage

#### Bucket: `stickers-estaticos`

**Configuração:**
- **Público:** Sim (URLs públicas)
- **Tamanho máximo por arquivo:** 5MB
- **MIME types permitidos:** `image/webp`, `image/png`, `image/jpeg`

**Estrutura de pastas:**
```
stickers-estaticos/
├── user_5511999999999/
│   ├── 1735252800_abc123.webp
│   ├── 1735253000_def456.webp
│   └── 1735254000_ghi789.webp
├── user_5511888888888/
│   └── 1735255000_jkl012.webp
└── ...
```

---

#### Bucket: `stickers-animados`

**Configuração:**
- **Público:** Sim (URLs públicas)
- **Tamanho máximo por arquivo:** 5MB
- **MIME types permitidos:** `image/webp` (WebP animado)

**Estrutura de pastas:**
```
stickers-animados/
├── user_5511999999999/
│   ├── 1735256000_mno345.webp
│   └── 1735257000_pqr678.webp
└── ...
```

---

### Políticas RLS (Row Level Security)

**Storage Policy: Leitura Pública**

```sql
-- Qualquer um pode LER (baixar) stickers
CREATE POLICY "Público pode ler stickers"
ON storage.objects FOR SELECT
USING (bucket_id IN ('stickers-estaticos', 'stickers-animados'));
```

**Storage Policy: Upload Restrito**

```sql
-- Apenas backend pode fazer UPLOAD
CREATE POLICY "Backend pode fazer upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('stickers-estaticos', 'stickers-animados')
  AND auth.role() = 'service_role'
);
```

---

## 8. Fluxos de Usuário {#fluxos-de-usuário}

### Fluxo 1: Primeiro Uso (Boas-Vindas)

```
┌──────────────────────────────────────────────┐
│ USUÁRIO: Envia primeira mensagem (imagem)   │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Detecta que usuário não existe     │
│ - Cria registro na tabela users              │
│ - Captura phone_number e name (pushName)    │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ BOT: Envia mensagem de boas-vindas          │
│                                              │
│ "Olá, Paulo! 👋                              │
│  Eu transformo suas fotos em figurinhas!    │
│                                              │
│  📸 Manda uma imagem ou GIF                  │
│  🎨 Eu converto e devolvo como sticker      │
│  🆓 10 figurinhas grátis por dia            │
│                                              │
│  Bora testar? Manda uma foto aí!"           │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Processa a imagem normalmente      │
│ - Adiciona job na fila                      │
│ - Worker processa com Sharp                 │
│ - Upload para Supabase                      │
│ - Envia sticker                             │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ USUÁRIO: Recebe sticker em ~3-5s ✅         │
└──────────────────────────────────────────────┘
```

---

### Fluxo 2: Uso Normal (Dentro do Limite)

```
┌──────────────────────────────────────────────┐
│ USUÁRIO: Envia imagem (3ª do dia)           │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Verifica limite                    │
│ - Query: SELECT daily_count FROM users      │
│ - Resultado: daily_count = 2 (OK!)          │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Valida imagem                      │
│ - Formato: JPG ✅                            │
│ - Tamanho: 2.3MB ✅                          │
│ - Dimensões: 1920x1080 ✅                    │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ WORKER: Processa assincronamente            │
│ 1. Baixa imagem da Evolution API            │
│ 2. Sharp: resize 512x512 + WebP             │
│ 3. Upload: Supabase Storage                 │
│ 4. Salva metadados: PostgreSQL              │
│ 5. Envia: Evolution API                     │
│ 6. Incrementa: daily_count = 3              │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ USUÁRIO: Recebe sticker ✅                  │
│ Tempo total: ~4 segundos                    │
└──────────────────────────────────────────────┘
```

---

### Fluxo 3: Limite Atingido (CRM de Retenção)

```
┌──────────────────────────────────────────────┐
│ USUÁRIO: Envia 11ª imagem do dia            │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Verifica limite                    │
│ - daily_count = 10                          │
│ - LIMITE ATINGIDO!                          │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ BOT: Envia mensagem de aviso                │
│                                              │
│ "Opa, Paulo! Você já usou suas 10           │
│  figurinhas grátis de hoje! 🎉              │
│                                              │
│  Mas relaxa, vou guardar essas próximas     │
│  aqui pra você.                             │
│  Amanhã de manhã te mando elas prontinho!   │
│                                              │
│  (Você tem 1 figurinha guardada)"           │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ WORKER: Processa MESMO ASSIM                │
│ 1. Baixa imagem                             │
│ 2. Processa com Sharp                       │
│ 3. Upload para Supabase                     │
│ 4. Salva com status='pendente' ⚠️           │
│ 5. NÃO envia agora                          │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ USUÁRIO: Envia 12ª e 13ª imagens            │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Processa e guarda (status=pendente)│
│ - Atualiza mensagem:                        │
│   "(Você tem 3 figurinhas guardadas)"       │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ MEIA-NOITE (00:00): Job reset-counters      │
│ - UPDATE users SET daily_count = 0          │
│ - UPDATE users SET last_reset_at = NOW()    │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ MANHÃ (08:00): Job send-pending             │
│ 1. Query: stickers WHERE status='pendente'  │
│ 2. Agrupa por user_number                  │
│ 3. Envia mensagem de bom dia                │
│ 4. Envia os 3 stickers pendentes            │
│ 5. UPDATE status='enviado', sent_at=NOW()   │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ USUÁRIO: Recebe às 8h da manhã              │
│                                              │
│ "Bom dia, Paulo! 🌞                          │
│  Aqui estão suas figurinhas de ontem:"      │
│                                              │
│ [sticker 1] [sticker 2] [sticker 3]         │
│                                              │
│ ✅ RETENÇÃO GARANTIDA!                      │
└──────────────────────────────────────────────┘
```

---

### Fluxo 4: Erro de Validação

```
┌──────────────────────────────────────────────┐
│ USUÁRIO: Envia arquivo PDF                  │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Detecta messageType = "document"   │
│ - MIME type: application/pdf                │
│ - NÃO é imagem nem GIF                      │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ BOT: Envia mensagem de erro                 │
│                                              │
│ "Só aceito imagens JPG, PNG ou WEBP! 📸"    │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: NÃO processa                       │
│ - Não adiciona job na fila                  │
│ - Não incrementa contador                   │
└──────────────────────────────────────────────┘
```

---

### Fluxo 5: Sticker Animado (GIF)

```
┌──────────────────────────────────────────────┐
│ USUÁRIO: Envia GIF (via WhatsApp)           │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ EVOLUTION API: Detecta videoMessage          │
│ - gifPlayback: true                         │
│ - mimetype: video/mp4                       │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Valida GIF                         │
│ - Duração: 5 segundos ✅ (<10s)             │
│ - Tamanho: 3.2MB ✅ (<5MB)                  │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ WORKER: Processa com FFmpeg                 │
│ 1. Baixa GIF (MP4)                          │
│ 2. FFmpeg: convert WebP animado             │
│    - fps=15, scale=512:512, quality=75%     │
│ 3. Upload: bucket stickers-animados         │
│ 4. Salva metadados (tipo='animado')         │
│ 5. Envia sticker via Evolution API          │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ USUÁRIO: Recebe sticker ANIMADO ✅          │
│ Tempo total: ~8 segundos                    │
│ Figurinha se MOVE! 🎬                       │
└──────────────────────────────────────────────┘
```

---

### Fluxo 6: Rate Limiting (Spam)

```
┌──────────────────────────────────────────────┐
│ USUÁRIO: Envia 6 imagens em 30 segundos     │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Detecta spam (Redis counter)       │
│ - Key: rate_limit:5511999999999             │
│ - Count: 6 (limite = 5/minuto)              │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ BOT: Envia mensagem de aviso                │
│                                              │
│ "Calma! Espera uns segundos antes de        │
│  mandar outra. ⏰"                           │
└───────────────────┬──────────────────────────┘
                    ↓
┌──────────────────────────────────────────────┐
│ SISTEMA: Bloqueia temporariamente (60s)     │
│ - Ignora novas mensagens por 1 minuto       │
│ - Após 60s, libera automaticamente          │
└──────────────────────────────────────────────┘
```

---

## 9. Mensagens do Bot {#mensagens-do-bot}

### Mensagens de Sucesso

#### Boas-Vindas (Primeira Vez)

```
Olá, [Nome]! 👋
Eu transformo suas fotos em figurinhas do WhatsApp!

📸 Manda uma imagem ou GIF
🎨 Eu converto e devolvo como sticker
🆓 10 figurinhas grátis por dia

Bora testar? Manda uma foto aí!
```

**Variáveis:**
- `[Nome]`: Capturado do campo `pushName` do webhook

---

#### Limite Atingido (Aviso)

```
Opa, [Nome]! Você já usou suas 10 figurinhas grátis de hoje! 🎉

Mas relaxa, vou guardar essas próximas aqui pra você.
Amanhã de manhã te mando elas prontinho! 😊

(Você tem [X] figurinhas guardadas)
```

**Variáveis:**
- `[Nome]`: Nome do usuário
- `[X]`: Número de stickers pendentes (query no banco)

---

#### Envio de Pendentes (Manhã)

```
Bom dia, [Nome]! 🌞

Aqui estão suas figurinhas de ontem:
```

(Seguido dos stickers)

---

### Mensagens de Erro

#### Formato Inválido

```
Só aceito imagens JPG, PNG ou WEBP! 📸
```

**Quando:** messageType não é imageMessage nem videoMessage

---

#### Imagem Muito Pequena

```
Essa imagem é muito pequena! Manda uma com pelo menos 100x100px.
```

**Quando:** Dimensões < 100x100px

---

#### Arquivo Muito Grande

```
Arquivo muito grande! Máximo 5MB.
```

**Quando:** fileLength > 5MB

---

#### GIF Muito Longo

```
GIF muito longo! Máximo 10 segundos.
```

**Quando:** videoMessage.seconds > 10

---

#### Rate Limiting

```
Calma! Espera uns segundos antes de mandar outra. ⏰
```

**Quando:** Usuário envia >5 imagens em 1 minuto

---

#### Erro Genérico

```
Algo deu errado, tenta de novo? 🤔
```

**Quando:** Erro inesperado no processamento

---

## 10. Roadmap de Sprints {#roadmap-de-sprints}

### **Sprint 1: Infraestrutura Base** ✅ COMPLETA

**Status:** ✅ Concluída em 26/12/2025
**Objetivo:** Configurar ambiente de desenvolvimento e produção

**Tarefas:**

1. **Setup Projeto**
   - [x] Criar repositório Git
   - [x] Inicializar projeto Node.js + TypeScript
   - [x] Configurar ESLint + Prettier (opcional)
   - [x] Setup Fastify com TypeScript

2. **Supabase**
   - [x] Criar projeto no Supabase (usando projeto existente: ludlztjdvwsrwlsczoje)
   - [x] Criar tabela `users` (migration aplicada)
   - [x] Criar tabela `stickers` (migration aplicada com campos adicionais)
   - [x] Criar tabela `usage_logs` (auditoria)
   - [x] Criar buckets `stickers-estaticos` e `stickers-animados`
   - [x] Configurar políticas RLS (Storage: public read, service_role write)

3. **Redis + BullMQ**
   - [x] Configurar Redis (usa Redis da Evolution API via network)
   - [x] Instalar BullMQ
   - [x] Criar queue `process-sticker`
   - [x] Criar queue `scheduled-jobs`

4. **Doppler (Secrets)** ✅ COMPLETO
   - [x] Criar projeto `sticker` no Doppler
   - [x] Criar configs: dev, dev_personal, stg, prd (4 configs auto-criados)
   - [x] Adicionar credenciais (7/7 secrets configurados):
     - SUPABASE_URL ✅
     - SUPABASE_SERVICE_KEY ✅
     - EVOLUTION_API_KEY ✅
     - EVOLUTION_API_URL ✅
     - EVOLUTION_INSTANCE ✅
     - REDIS_URL ✅
     - LOG_LEVEL ✅
   - [x] Documentação criada: `deploy/DOPPLER-SETUP.md`, `DOPPLER-SUCCESS.md`

5. **Docker & Deploy**
   - [x] Criar Dockerfile (multi-stage: builder + production)
   - [x] Configurar FFmpeg no Docker (para stickers animados)
   - [x] Criar docker-compose.bot.yml (dev local)
   - [x] Criar stack file para produção: `deploy/stack-sticker.yml`
   - [x] Criar script de deploy: `deploy/deploy-sticker.sh`
   - [x] Documentar deployment: `deploy/DEPLOYMENT-GUIDE.md`
   - [x] Testar build local: ✅ Compilação TypeScript OK

6. **Cloudflare DNS** ✅ COMPLETO
   - [x] Identificar domínio correto (ytem.com.br, não .com)
   - [x] Criar registro DNS A: stickers.ytem.com.br → 157.230.50.63
   - [x] Ativar Cloudflare Proxy (☁️ DDoS protection)
   - [x] Verificar propagação DNS (resolving para IPs Cloudflare)
   - [x] SSL Mode: Full (strict) configurado
   - [x] Atualizar 9 arquivos de documentação com domínio correto
   - [x] Documentação criada: `CLOUDFLARE-DNS-SUCCESS.md`, `CLOUDFLARE-SUMMARY.md`

7. **Estrutura do Código**
   - [x] `src/config/`: logger, redis, supabase, queue
   - [x] `src/routes/`: webhook, health
   - [x] `src/server.ts`: Fastify backend
   - [x] `src/worker.ts`: BullMQ worker (estrutura base)
   - [x] TypeScript configurado (ES2022, strict mode)

**Critério de Aceitação:**
- ✅ Projeto roda localmente com `npm run dev` e `npm run dev:worker`
- ✅ Conexão com Supabase funcionando (health check OK)
- ✅ Redis funcionando (conectado ao Redis da Evolution API)
- ✅ Build TypeScript funciona sem erros
- ✅ Estrutura de deployment criada e documentada
- ✅ Doppler configurado (7/7 secrets em dev e prd)
- ✅ DNS Cloudflare configurado e propagado (stickers.ytem.com.br)

**Arquivos Criados:**
- `src/` - 13 arquivos TypeScript
- `deploy/stack-sticker.yml` - Stack file para Docker Swarm
- `deploy/deploy-sticker.sh` - Script de deploy automatizado
- `deploy/DOPPLER-SETUP.md` - Guia de configuração Doppler
- `deploy/DEPLOYMENT-GUIDE.md` - Guia completo de deployment
- `README-SETUP.md` - Atualizado com seção de deploy
- `Dockerfile` - Multi-stage build com FFmpeg
- `docker-compose.bot.yml` - Ambiente de desenvolvimento

**Sprints Completas:**

**Sprint 2-7:** ✅ **COMPLETO** (27/12/2024)
- ✅ Sprint 2: Webhook & Detecção (endpoint /webhook, validações)
- ✅ Sprint 3: Stickers Estáticos (Sharp, upload Supabase)
- ✅ Sprint 4: Stickers Animados (FFmpeg, WebP animado)
- ✅ Sprint 5: Limite Diário + CRM (userService, messageService)
- ✅ Sprint 6: Jobs Agendados (reset meia-noite, envio 8h)
- ✅ Sprint 7: Monitoramento (/stats, logs estruturados)

**Correções Aplicadas:**
- ✅ Schema Supabase corrigido (phone_number → whatsapp_number)
- ✅ Colunas tabela stickers renomeadas (file_path → storage_path, etc)
- ✅ Funções SQL criadas (increment_daily_count, reset_all_daily_counters)
- ✅ Coluna last_interaction adicionada em users
- ✅ Build TypeScript: 21 arquivos compilados sem erros
- ✅ Linter: 0 erros críticos

**Status Atual:**
- ✅ Backend rodando (porta 3000)
- ✅ Worker BullMQ rodando (concorrência: 5)
- ✅ Evolution API conectada (WhatsApp state: open)
- ✅ Supabase conectado (1 usuário criado nos testes)
- ✅ Health check: OK
- ✅ Stats endpoint: OK
- ⏳ **Falta:** Configurar webhook Evolution API → Backend

**Próximos Passos:**
1. ✅ ~~Sprints 2-7~~ COMPLETO
2. **AGORA: Teste WhatsApp Real**
   - Configurar webhook Evolution API
   - Enviar imagem via WhatsApp
   - Validar fluxo completo
3. **Sprint 8: Deploy Completo para Produção** (futuro)
   - Mover Evolution API para VPS
   - Mover Sticker Bot para VPS
   - Produção 24/7 independente do Mac

**Estratégia:**
- 🧪 **Sprints 2-7:** Desenvolvimento e testes LOCAIS (Evolution + Sticker Bot no Mac)
- 🚀 **Sprint 8:** Deploy COMPLETO para VPS (produção real)

---

### **Sprint 2: Webhook & Detecção** (3 dias)

**Objetivo:** Receber e validar mensagens da Evolution API

**Tarefas:**

1. **Endpoint Webhook**
   - [ ] Criar `POST /webhook`
   - [ ] Validar API key (header `apikey`)
   - [ ] Parsear payload da Evolution API
   - [ ] Extrair dados:
     - user_number (remoteJid)
     - user_name (pushName)
     - messageType
     - imageMessage / videoMessage

2. **Detecção de Tipo**
   - [ ] Detectar `imageMessage`
   - [ ] Detectar `videoMessage` com `gifPlayback=true`
   - [ ] Ignorar outros tipos (textMessage, audioMessage, etc)

3. **Validação Básica**
   - [ ] Validar formato (JPG, PNG, WebP)
   - [ ] Validar tamanho (<5MB)
   - [ ] Validar duração de GIF (<10s)
   - [ ] Retornar erros personalizados

4. **Download de Arquivos**
   - [ ] Implementar função para baixar imagem da Evolution API
   - [ ] Implementar função para baixar GIF

5. **Logs**
   - [ ] Configurar Pino (logs estruturados)
   - [ ] Logar todas as requisições
   - [ ] Logar erros com stack trace

**Critério de Aceitação:**
- ✅ Webhook recebe mensagens da Evolution API
- ✅ Detecta corretamente imageMessage vs videoMessage
- ✅ Valida formato e tamanho
- ✅ Retorna erros corretos para usuário
- ✅ Logs estruturados funcionando

---

### **Sprint 3: Processamento de Stickers Estáticos** (4 dias)

**Objetivo:** Processar imagens e enviar como stickers

**Tarefas:**

1. **Sharp (Processamento)**
   - [ ] Instalar Sharp
   - [ ] Implementar resize (512x512, aspect ratio + padding)
   - [ ] Implementar conversão WebP (quality 90%)
   - [ ] Validar tamanho final (<500KB)

2. **Upload Supabase Storage**
   - [ ] Implementar função de upload
   - [ ] Gerar nome único (timestamp_randomId)
   - [ ] Fazer upload para bucket `stickers-estaticos`
   - [ ] Obter URL pública

3. **Salvar Metadados**
   - [ ] Implementar insert na tabela `stickers`
   - [ ] Salvar: user_number, file_path, file_url, tipo, status

4. **Enviar Sticker**
   - [ ] Implementar função para enviar via Evolution API
   - [ ] Endpoint: `/message/sendSticker`
   - [ ] Usar URL pública do Supabase

5. **Worker BullMQ**
   - [ ] Criar worker para processar jobs
   - [ ] Implementar processamento assíncrono
   - [ ] Retry automático (3 tentativas)

**Critério de Aceitação:**
- ✅ Imagem é processada corretamente (512x512, WebP)
- ✅ Upload para Supabase funciona
- ✅ Metadados salvos no banco
- ✅ Sticker enviado ao usuário
- ✅ Tempo de processamento <5s

---

### **Sprint 4: Processamento de Stickers Animados** (4 dias)

**Objetivo:** Processar GIFs e enviar como stickers animados

**Tarefas:**

1. **FFmpeg (Processamento)**
   - [ ] Instalar FFmpeg no Docker
   - [ ] Implementar conversão GIF → WebP animado
   - [ ] Comando FFmpeg:
     ```bash
     ffmpeg -i input.mp4 -vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" -vcodec libwebp -q:v 75 -loop 0 output.webp
     ```
   - [ ] Validar tamanho final (<500KB)

2. **Upload Supabase Storage**
   - [ ] Upload para bucket `stickers-animados`
   - [ ] Obter URL pública

3. **Salvar Metadados**
   - [ ] Insert com tipo='animado'

4. **Enviar Sticker Animado**
   - [ ] Testar com Evolution API v2.3.1+
   - [ ] Garantir que animação funciona

5. **Worker BullMQ**
   - [ ] Adicionar processamento de GIFs na fila
   - [ ] Implementar limpeza de arquivos temporários

**Critério de Aceitação:**
- ✅ GIF é processado corretamente (WebP animado)
- ✅ Upload para Supabase funciona
- ✅ Sticker animado enviado e funcionando
- ✅ Tempo de processamento <10s

---

### **Sprint 5: Sistema de Controle de Uso + CRM** (5 dias)

**Objetivo:** Implementar limite diário e CRM de retenção

**Tarefas:**

1. **Gestão de Usuários**
   - [ ] Implementar criação automática de usuário
   - [ ] Capturar `pushName` do webhook
   - [ ] Salvar phone_number + name na tabela `users`

2. **Limite Diário**
   - [ ] Implementar verificação de `daily_count`
   - [ ] Incrementar contador após processar
   - [ ] Bloquear se daily_count >= 10

3. **CRM de Retenção**
   - [ ] Se daily_count >= 10: processar mas NÃO enviar
   - [ ] Salvar com `status='pendente'`
   - [ ] Enviar mensagem de aviso

4. **Mensagens Personalizadas**
   - [ ] Boas-vindas (primeira vez)
   - [ ] Limite atingido (com contador de pendentes)
   - [ ] Todas as mensagens com nome do usuário

5. **Rate Limiting**
   - [ ] Implementar contador no Redis (key: `rate_limit:{phone}`)
   - [ ] Limitar a 5 stickers/minuto
   - [ ] Enviar mensagem de erro se ultrapassar

**Critério de Aceitação:**
- ✅ Usuários são criados automaticamente
- ✅ Limite de 10/dia funciona
- ✅ Stickers além do limite são salvos como pendente
- ✅ Mensagens personalizadas com nome
- ✅ Rate limiting funciona (5/min)

---

### **Sprint 6: Filas + Jobs de Retenção** (5 dias)

**Objetivo:** Automatizar reset de contadores e envio de pendentes

**Tarefas:**

1. **Job: Reset Daily Counters**
   - [ ] Criar job agendado (meia-noite, 00:00)
   - [ ] SQL: `UPDATE users SET daily_count = 0, last_reset_at = NOW()`
   - [ ] Logar execução

2. **Job: Send Pending Stickers**
   - [ ] Criar job agendado (8h da manhã)
   - [ ] Query: `SELECT * FROM stickers WHERE status='pendente'`
   - [ ] Agrupar por user_number
   - [ ] Enviar mensagem de bom dia
   - [ ] Enviar todos os stickers pendentes
   - [ ] Atualizar: `status='enviado', sent_at=NOW()`

3. **Bull Board (Dashboard de Filas)**
   - [ ] Instalar Bull Board
   - [ ] Configurar em `/admin/queues`
   - [ ] Proteger com senha (Basic Auth)

4. **Retry & Error Handling**
   - [ ] Implementar retry automático (3 tentativas)
   - [ ] Salvar jobs que falharam
   - [ ] Logar erros no banco (usage_logs)

5. **Monitoramento**
   - [ ] Endpoint `/health` (status do sistema)
   - [ ] Endpoint `/stats` (estatísticas básicas)

**Critério de Aceitação:**
- ✅ Job de reset roda à meia-noite
- ✅ Job de envio roda às 8h
- ✅ Stickers pendentes são enviados corretamente
- ✅ Bull Board acessível e funcionando
- ✅ Retry funciona em caso de falha

---

### **Sprint 7: Testes, Monitoramento & Deploy Local** (4 dias)

**Objetivo:** Garantir qualidade e validar funcionalidades localmente

**Estratégia de Desenvolvimento:**
- ✅ **Evolution API:** Mantida LOCAL (Mac) durante desenvolvimento/testes
- ✅ **Sticker Bot:** Deploy na VPS para testar infraestrutura
- ⚠️ **Produção Real:** Requer mover Evolution para VPS (Sprint 8)

**Tarefas:**

1. **Testes Unitários**
   - [ ] Testar função de processamento Sharp
   - [ ] Testar função de processamento FFmpeg
   - [ ] Testar validação de formato/tamanho
   - [ ] Testar lógica de limite diário

2. **Testes de Integração (Local)**
   - [ ] Testar fluxo completo (webhook → sticker)
   - [ ] Testar CRM de retenção (limite + pendente)
   - [ ] Testar jobs agendados
   - [ ] Evolution API local → Sticker Bot local

3. **Deploy VPS (Infraestrutura)**
   - [ ] Configurar DNS (stickers.ytem.com.br) ✅ JÁ FEITO
   - [ ] Configurar SSL (Let's Encrypt via Traefik)
   - [ ] Fazer deploy via Docker Swarm
   - [ ] Configurar restart automático
   - [ ] Testar health checks

4. **Configurar Evolution API (Local)**
   - [ ] Atualizar webhook URL: `http://localhost:3000/webhook` (dev local)
   - [ ] Testar recebimento de mensagens localmente

5. **Documentação**
   - [ ] README.md com instruções de setup
   - [ ] Documentar API (endpoints, payloads)
   - [ ] Documentar fluxos de usuário
   - [ ] Criar guia de troubleshooting

6. **Monitoramento**
   - [ ] Configurar logs persistentes
   - [ ] Configurar alertas (Discord webhook?)
   - [ ] Criar queries de analytics no Supabase

**Critério de Aceitação:**
- ✅ Testes passam (coverage >70%)
- ✅ Deploy infraestrutura VPS funciona
- ✅ SSL ativado (HTTPS)
- ✅ Webhook da Evolution API local funcionando
- ✅ Bot funcionando 100% em **ambiente de desenvolvimento**
- ✅ Documentação completa

**Limitação:**
- ⚠️ Evolution API ainda está LOCAL (não é produção real)
- ⚠️ WhatsApp desconecta se Mac desligar
- ⚠️ Precisa Sprint 8 para produção completa

---

### **Sprint 8: Deploy Evolution API para Produção** (3 dias)

**Objetivo:** Mover Evolution API para VPS e estabelecer produção completa

**Contexto:**
Após validar todas as funcionalidades do Sticker Bot localmente (Sprints 2-7), agora vamos mover a Evolution API para a VPS para ter um ambiente de produção real e confiável.

**Por quê agora?**
- ✅ Sticker Bot já foi testado e validado localmente
- ✅ Sabemos que todas as funcionalidades funcionam
- ✅ Infraestrutura da VPS já está pronta (Traefik, DNS)
- ✅ Menor risco de problemas (já testamos tudo antes)

**Tarefas:**

1. **Preparar Evolution API para VPS**
   - [ ] Criar stack file: `deploy/stack-evolution.yml`
   - [ ] Configurar volumes persistentes (WhatsApp sessions)
   - [ ] Configurar rede compartilhada (evolution-network)
   - [ ] Adicionar labels Traefik para SSL automático

2. **Configurar DNS para Evolution API**
   - [ ] Criar registro DNS: `wa.ytem.com.br` → 157.230.50.63
   - [ ] Ativar Cloudflare Proxy
   - [ ] Aguardar propagação DNS

3. **Secrets no Doppler**
   - [ ] Adicionar secrets da Evolution no Doppler (config prd):
     - AUTHENTICATION_API_KEY
     - DATABASE_CONNECTION_URI
     - CACHE_REDIS_URI
   - [ ] Criar script de deploy: `deploy/deploy-evolution.sh`

4. **Deploy Evolution para VPS**
   - [ ] Fazer backup das instâncias WhatsApp locais
   - [ ] Deploy Evolution API via Docker Swarm
   - [ ] Migrar dados do PostgreSQL (dump/restore)
   - [ ] Migrar sessões WhatsApp (volume sync)
   - [ ] Verificar se instâncias reconectam

5. **Integração Sticker Bot ↔ Evolution API**
   - [ ] Atualizar `EVOLUTION_API_URL` no Doppler (prd):
     - De: `http://localhost:8080`
     - Para: `http://evolution_api:8080` (Docker network)
   - [ ] Re-deploy Sticker Bot com nova config
   - [ ] Configurar webhook: `https://stickers.ytem.com.br/webhook`

6. **Testes End-to-End em Produção**
   - [ ] Testar conexão WhatsApp na VPS
   - [ ] Enviar imagem via WhatsApp → receber sticker
   - [ ] Testar limite diário (10 stickers)
   - [ ] Testar envio de pendentes (job 8h)
   - [ ] Monitorar logs por 24h

7. **Documentação**
   - [ ] Atualizar README com arquitetura de produção
   - [ ] Documentar processo de backup/restore
   - [ ] Criar runbook de troubleshooting

**Critério de Aceitação:**
- ✅ Evolution API rodando 100% na VPS
- ✅ WhatsApp conectado e estável (sem desconexões)
- ✅ Sticker Bot + Evolution API comunicando via Docker network
- ✅ Webhooks funcionando (Evolution → Sticker Bot)
- ✅ SSL ativado em ambos (wa.ytem.com.br e stickers.ytem.com.br)
- ✅ Nenhuma dependência do Mac local
- ✅ Sistema funcionando 24/7 sem interrupções

**Arquitetura Final (Produção):**

```
┌─────────────────────────────────────────────────┐
│              VPS (157.230.50.63)                │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │         Traefik (Reverse Proxy)          │  │
│  │  - SSL Automático (Let's Encrypt)        │  │
│  │  - wa.ytem.com.br → evolution_api        │  │
│  │  - stickers.ytem.com.br → sticker_backend│  │
│  └──────────────┬───────────────────────────┘  │
│                 │                               │
│  ┌──────────────┴───────────────────────────┐  │
│  │        Docker Swarm Network              │  │
│  │                                          │  │
│  │  ┌─────────────────┐  ┌───────────────┐ │  │
│  │  │ evolution_api   │  │sticker_backend│ │  │
│  │  │ (WhatsApp)      │──│ (Fastify API) │ │  │
│  │  └─────────────────┘  └───────────────┘ │  │
│  │                                          │  │
│  │  ┌─────────────────┐  ┌───────────────┐ │  │
│  │  │evolution_postgres│ │sticker_worker │ │  │
│  │  │ (Dados WhatsApp)│  │  (BullMQ)     │ │  │
│  │  └─────────────────┘  └───────────────┘ │  │
│  │                                          │  │
│  │  ┌─────────────────┐                    │  │
│  │  │ evolution_redis │                    │  │
│  │  │ (Cache + Filas) │                    │  │
│  │  └─────────────────┘                    │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
           ↑                    ↑
           │                    │
    WhatsApp Web          Supabase Cloud
    (conexão WSS)        (PostgreSQL + Storage)
```

**Benefícios:**
- ✅ **Alta disponibilidade:** Sistema roda 24/7
- ✅ **Independente:** Não depende do Mac ligado
- ✅ **Escalável:** Pode adicionar mais workers
- ✅ **Seguro:** SSL em tudo, secrets no Doppler
- ✅ **Monitorável:** Logs centralizados

---

## 11. Lições Aprendidas e Requisitos Técnicos Críticos {#lições-aprendidas-e-requisitos-técnicos-críticos}

### 🎯 Contexto

Esta seção documenta conhecimentos críticos adquiridos durante o desenvolvimento e testes locais (Sprints 2-7), especialmente relacionados a versões de software, compatibilidade e problemas de produção. **Estas lições são essenciais para evitar problemas futuros e garantir a estabilidade do sistema.**

---

### 1. Evolution API - Requisitos de Versão ⚠️ CRÍTICO

#### ❌ Problema Identificado

Durante os testes em 27/12/2025, descobrimos que versões desatualizadas da Evolution API causam falhas silenciosas:

**Versão inicial:** v2.3.1 (5 meses desatualizada)
**Sintomas:**
- Webhooks não enviados consistentemente
- Erro: "Message not found" ao processar mídia
- Processamento de vídeos/GIFs falhando sem erro claro

#### ✅ Solução Implementada

**Atualização para v2.3.7 (latest):**
```yaml
# docker-compose.yml - ANTES (❌ ERRADO)
evolution-api:
  image: evoapicloud/evolution-api:v2.3.1

# docker-compose.yml - DEPOIS (✅ CORRETO)
evolution-api:
  image: evoapicloud/evolution-api:latest
```

**Resultado:** Após atualização, todos os problemas foram resolvidos imediatamente.

#### 📋 Regra Crítica de Versão

> **NUNCA fixar versão específica da Evolution API em produção.**
>
> - ✅ **Use:** `image: evoapicloud/evolution-api:latest`
> - ❌ **Não use:** `image: evoapicloud/evolution-api:v2.3.1`

**Justificativa:**
1. Evolution API é atualizada frequentemente para compatibilidade com WhatsApp
2. WhatsApp Business muda protocolo regularmente
3. Versões antigas perdem compatibilidade rapidamente (semanas, não meses)
4. Community feedback: "SEMPRE verifique versão Evo e versão WhatsApp Business, precisam estar SEMPRE atualizadas"

#### 🔄 Processo de Atualização

**Desenvolvimento Local:**
```bash
# Parar containers
docker compose down

# Atualizar imagem
docker compose pull

# Reiniciar
docker compose up -d

# Verificar versão
curl http://localhost:8080/health
```

**Produção VPS (Sprint 8):**
```bash
# Via Docker Swarm
docker service update --image evoapicloud/evolution-api:latest evolution_api

# Monitorar rollout
docker service ps evolution_api
```

#### 📊 Versionamento Verificado (27/12/2025)

| Componente | Versão Atual | Status |
|------------|--------------|--------|
| Evolution API | v2.3.7 | ✅ Funcionando |
| WhatsApp Web | 2.3000.1031492564 | ✅ Compatível |
| Node.js | 20 LTS | ✅ Estável |
| FFmpeg | 6.0 | ✅ Funcionando |
| Sharp | ^0.33 | ✅ Funcionando |

---

### 2. Sessões WhatsApp - Persistência e Recuperação ⚠️ CRÍTICO

#### ❌ Problema Identificado

Após restart do Docker (27/12/2025), as sessões WhatsApp apresentaram erro crítico:

```json
{
  "type": "SessionError",
  "message": "No matching sessions found for message",
  "msg": "failed to decrypt message"
}
```

**Causa Raiz:**
- WhatsApp usa criptografia E2E (End-to-End Encryption)
- Chaves de sessão são armazenadas em memória e no volume Docker
- Restart do Docker pode corromper estado da sessão
- WhatsApp não consegue descriptografar mensagens com chaves antigas

#### ✅ Solução Implementada

**Passo 1: Logout da instância**
```bash
curl -X POST http://localhost:8080/instance/logout/[INSTANCE_NAME] \
  -H "apikey: [API_KEY]"
```

**Passo 2: Gerar novo QR Code**
```bash
curl -X POST http://localhost:8080/instance/connect/[INSTANCE_NAME] \
  -H "apikey: [API_KEY]"
```

**Passo 3: Re-escanear com WhatsApp**
- Abrir WhatsApp no celular
- Ir em Configurações → Aparelhos conectados
- Escanear novo QR Code

**Resultado:** Conexão restabelecida, mensagens sendo recebidas corretamente.

#### 📋 Checklist de Recuperação de Sessão

Use este checklist sempre que houver problemas de conexão:

1. **Verificar estado da conexão:**
   ```bash
   curl http://localhost:8080/instance/connectionState/[INSTANCE_NAME] \
     -H "apikey: [API_KEY]"
   ```

2. **Se estado = "close" ou "refused":**
   - Fazer logout (API call)
   - Gerar novo QR Code
   - Re-escanear

3. **Se estado = "open" mas mensagens não chegam:**
   - Verificar logs da Evolution API
   - Verificar se webhook está configurado
   - Testar envio de mensagem de teste

4. **Último recurso - Recriar instância:**
   ```bash
   # Deletar instância
   curl -X DELETE http://localhost:8080/instance/delete/[INSTANCE_NAME]

   # Criar nova instância
   curl -X POST http://localhost:8080/instance/create \
     -H "apikey: [API_KEY]" \
     -d '{"instanceName": "[INSTANCE_NAME]", "webhook": "..."}'
   ```

#### 🔒 Boas Práticas de Persistência

**Volume Docker (Produção):**
```yaml
volumes:
  evolution_instances:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /var/lib/evolution/instances  # Path absoluto na VPS
```

**Backup Regular:**
```bash
# Backup diário das instâncias (cron job)
0 3 * * * tar -czf /backup/evolution_instances_$(date +\%Y\%m\%d).tar.gz /var/lib/evolution/instances
```

---

### 3. Processamento de Vídeos - Aspect Ratio e Qualidade

#### ❌ Problema Identificado

Usuário reportou (27/12/2025) que vídeos verticais tinham bordas pretas laterais ao serem convertidos em stickers animados.

**Comando FFmpeg Original:**
```bash
ffmpeg -i input.mp4 \
  -vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0" \
  -vcodec libwebp -q:v 75 -loop 0 output.webp
```

**Problema:**
- Parâmetro `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0` forçava formato quadrado
- Vídeos verticais (9:16) ou horizontais (16:9) ficavam com padding preto
- Visualmente desagradável para stickers

#### ✅ Solução Implementada - Opção A (Escolhida)

**Remover padding, manter aspect ratio original:**

```typescript
// src/services/gifProcessor.ts
.outputOptions([
  '-vf',
  'fps=15,scale=512:512:force_original_aspect_ratio=decrease',  // ✅ SEM pad
  '-vcodec',
  'libwebp',
  '-q:v',
  '75',
  '-loop',
  '0',
  '-preset',
  'default',
  '-an',
  '-vsync',
  '0',
])
```

**Características:**
- ✅ Mantém proporção original do vídeo
- ✅ Redimensiona para caber em 512x512
- ✅ Sem bordas pretas ou transparentes
- ✅ Sticker com dimensões variáveis (ex: 512x288 para vídeo 16:9)
- ✅ WhatsApp aceita stickers não-quadrados

**Resultado:**
- Vídeos verticais: ~288x512 (sem bordas laterais)
- Vídeos horizontais: 512x288 (sem bordas superior/inferior)
- Vídeos quadrados: 512x512

#### 📊 Opções Avaliadas (Não Implementadas)

| Opção | Descrição | Por que não escolhemos |
|-------|-----------|------------------------|
| B - Padding Transparente | `pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0.0` → `color=white@0.0` | WhatsApp não renderiza transparência corretamente |
| C - Crop (Cortar) | `crop=512:512` | Perde parte do conteúdo do vídeo |
| D - Forçar Quadrado | `scale=512:512` | Distorce a imagem |

#### 📋 Requisitos de Stickers Animados

**Validações implementadas:**
```typescript
const metadata = await getVideoMetadata(inputPath);

// Duração máxima: 10 segundos
if (metadata.duration > 10) {
  throw new Error('GIF muito longo! Máximo 10 segundos.');
}

// Tamanho máximo do arquivo: 5MB
if (fileSize > 5 * 1024 * 1024) {
  throw new Error('Arquivo muito grande! Máximo 5MB.');
}
```

**Tamanho final após conversão:**
```typescript
const fileSize = buffer.length;
const maxSize = 500 * 1024;  // 500KB

if (fileSize > maxSize) {
  logger.warn({ fileSize, maxSize },
    'Animated sticker exceeds max size - may need quality reduction');
}
```

**Performance observada (27/12/2025):**
- Vídeo 1: 2.7s duração → 521KB WebP → 12.3s processamento ✅
- Vídeo 2: 2.4s duração → 599KB WebP → 12.0s processamento ✅

---

### 4. Docker e Infraestrutura - Gestão de Containers

#### ❌ Problema Identificado

Durante os testes (27/12/2025), o Docker Desktop não estava rodando após restart do Mac.

**Sintomas:**
```
Cannot connect to the Docker daemon at unix:///Users/paulohenrique/.docker/run/docker.sock
Is the docker daemon running?
```

#### ✅ Solução

**Desenvolvimento Local:**
1. Abrir Docker Desktop manualmente
2. Aguardar inicialização completa
3. Verificar: `docker ps`
4. Reiniciar containers: `docker compose up -d`

**Produção VPS (Sprint 8):**
- Docker inicia automaticamente no boot da VPS
- Systemd gerencia serviço Docker
- Containers com `restart: always` sobem automaticamente

#### 📋 Checklist de Troubleshooting Docker

**1. Verificar se Docker está rodando:**
```bash
docker info
# Se retornar erro → Docker não está rodando
```

**2. Verificar containers ativos:**
```bash
docker ps
# Deve mostrar: evolution_api, evolution_postgres, evolution_redis, evolution_manager
```

**3. Ver logs de containers:**
```bash
# Logs da Evolution API
docker logs evolution_api --tail 100 -f

# Logs do backend
docker logs sticker_bot_backend --tail 100 -f

# Logs do worker
docker logs sticker_bot_worker --tail 100 -f
```

**4. Restart completo:**
```bash
# Parar tudo
docker compose down

# Limpar volumes órfãos (cuidado!)
docker system prune -a --volumes

# Subir novamente
docker compose up -d
```

**5. Verificar uso de recursos:**
```bash
# CPU e memória por container
docker stats

# Espaço em disco
docker system df
```

---

### 5. Monitoramento e Observabilidade

#### 📊 Logs Estruturados

**Formato Pino (JSON):**
```json
{
  "level": "info",
  "time": 1735334184000,
  "jobId": "5511946304133-1766859072195",
  "tipo": "animado",
  "fileSize": 521576,
  "processingTimeMs": 12298,
  "width": 512,
  "height": 512,
  "msg": "Sticker processed successfully"
}
```

**Níveis de Log:**
- `debug`: Detalhes técnicos (FFmpeg commands, SQL queries)
- `info`: Eventos importantes (sticker processado, mensagem enviada)
- `warn`: Alertas não-críticos (arquivo grande, processamento lento)
- `error`: Erros que impedem funcionamento (falha ao processar, API down)

#### 📁 Localização de Logs

**Desenvolvimento Local:**
```
/tmp/sticker-backend.log  - Logs do servidor Fastify
/tmp/sticker-worker.log   - Logs do worker BullMQ
```

**Produção VPS (Sprint 8):**
```
/var/log/sticker-bot/backend.log
/var/log/sticker-bot/worker.log

# Rotação automática (logrotate)
/var/log/sticker-bot/backend-2025-12-26.log.gz
```

#### 🔍 Como Debugar Problemas

**1. Webhook não está chegando:**
```bash
# Verificar configuração do webhook na Evolution API
curl http://localhost:8080/instance/fetchInstances/[INSTANCE_NAME] \
  -H "apikey: [API_KEY]"

# Verificar logs do backend
tail -f /tmp/sticker-backend.log | grep "POST /webhook"
```

**2. Sticker não está sendo enviado:**
```bash
# Verificar logs do worker
tail -f /tmp/sticker-worker.log | grep "sendSticker"

# Verificar fila do Redis
redis-cli
> LLEN bull:process-sticker:wait
> LLEN bull:process-sticker:failed
```

**3. Processamento está lento:**
```bash
# Ver duração dos jobs
tail -f /tmp/sticker-worker.log | grep "processingTimeMs"

# Ver recursos do Docker
docker stats sticker_bot_worker
```

---

### 6. Preparação para Deploy VPS (Sprint 8)

#### 📋 Checklist Pré-Deploy

**Infraestrutura:**
- [ ] DNS configurado (stickers.ytem.com.br → 157.230.50.63) ✅ JÁ FEITO
- [ ] SSL/HTTPS via Traefik (Let's Encrypt)
- [ ] Doppler configurado com secrets de produção ✅ JÁ FEITO
- [ ] Docker Swarm inicializado na VPS
- [ ] Volumes persistentes criados

**Evolution API:**
- [ ] Mover Evolution API para VPS
- [ ] DNS: wa.ytem.com.br → 157.230.50.63
- [ ] Backup das sessões WhatsApp (volume sync)
- [ ] Reconfigurar webhook: `https://stickers.ytem.com.br/webhook`

**Sticker Bot:**
- [ ] Build da imagem Docker
- [ ] Deploy via stack file
- [ ] Variáveis de ambiente via Doppler
- [ ] Health checks configurados
- [ ] Logs persistentes configurados

**Testes End-to-End:**
- [ ] Enviar imagem → receber sticker (<5s)
- [ ] Enviar vídeo → receber sticker animado (<10s)
- [ ] Testar limite diário (10 stickers)
- [ ] Testar envio de pendentes (job 8h)
- [ ] Monitorar por 24h sem erros

#### 🔐 Secrets de Produção (Doppler)

**Config: prd (Produção)**
```bash
SUPABASE_URL=https://ludlztjdvwsrwlsczoje.supabase.co
SUPABASE_SERVICE_KEY=[REDACTED]
EVOLUTION_API_URL=http://evolution_api:8080  # ← Docker network
EVOLUTION_API_KEY=[REDACTED]
EVOLUTION_INSTANCE=meu-zap
REDIS_URL=redis://redis:6379  # ← Docker network
LOG_LEVEL=info  # ← Produção usa "info", não "debug"
```

#### 🚀 Comando de Deploy

```bash
# Na VPS, via SSH
cd /root/sticker-bot

# Atualizar código
git pull origin main

# Deploy via Docker Swarm
doppler run --config prd -- docker stack deploy -c deploy/stack-sticker.yml sticker

# Monitorar deploy
docker service ls | grep sticker
docker service logs -f sticker_backend
```

---

### 7. Versões de Software - Matriz de Compatibilidade

#### 📊 Stack Completa Verificada (27/12/2025)

| Componente | Versão Atual | Última Atualização | Compatibilidade |
|------------|--------------|-------------------|-----------------|
| **Evolution API** | v2.3.7 (latest) | 27/12/2025 | ✅ WhatsApp Web 2.3000.x |
| **WhatsApp Business** | 2.3000.1031492564 | Auto-update | ✅ Compatível |
| **Node.js** | 20.11.0 LTS | Estável | ✅ Até abril/2026 |
| **TypeScript** | ^5.3 | Estável | ✅ Compatível |
| **Fastify** | ^4.25 | Estável | ✅ Node 20 |
| **BullMQ** | ^5.1 | Estável | ✅ Redis 6+ |
| **Redis** | 7.2 Alpine | Estável | ✅ Produção |
| **PostgreSQL** | 15 (Supabase) | Managed | ✅ Auto-update |
| **Sharp** | ^0.33 | Estável | ✅ Node 20 |
| **FFmpeg** | 6.0 (Docker) | Estável | ✅ libwebp |
| **Docker** | 24.0+ | Estável | ✅ Compose v2 |
| **Doppler CLI** | 3.67.1+ | Estável | ✅ Produção |

#### ⚠️ Dependências Críticas para Monitorar

**1. Evolution API + WhatsApp:**
- Atualizar Evolution API sempre que WhatsApp Business atualizar
- Verificação semanal: https://github.com/EvolutionAPI/evolution-api/releases
- Community Discord: https://evolution-api.com/discord

**2. Node.js LTS:**
- Manter na v20 LTS (suporte até abril/2026)
- Não atualizar para v21+ (odd versions são unstable)

**3. FFmpeg + libwebp:**
- FFmpeg 6.0+ garante suporte a WebP animado
- Validar no Dockerfile: `RUN ffmpeg -version | grep libwebp`

---

### 8. Community Feedback e Boas Práticas

#### 💬 Feedback da Comunidade Evolution API

> "Não utilize community nodes, tudo que for realizar com a Evo, faça através de http request. SEMPRE verifique versão Evo e versão WhatsApp Business, precisam estar SEMPRE atualizadas."

**Interpretação:**
- ✅ Usar API REST diretamente (não SDKs de terceiros)
- ✅ Manter Evolution API atualizada semanalmente
- ✅ Monitorar compatibilidade com WhatsApp Business
- ✅ Evitar "community packages" não-oficiais

#### 📋 Boas Práticas Adotadas

**1. Versionamento:**
- Evolution API: `latest` (não fixar versão)
- Node.js: LTS (fixar major version)
- Dependências npm: `^` (minor updates automáticos)

**2. Secrets:**
- Doppler para TODOS os secrets (zero hardcoding)
- `.env` nunca commitado (`.gitignore`)
- Secrets diferentes entre dev e prd

**3. Logs:**
- Estruturados (JSON)
- Níveis adequados (debug em dev, info em prd)
- Rotação automática (evitar disco cheio)

**4. Monitoramento:**
- Health checks a cada 30s
- Alertas se processamento >15s
- Métricas de sucesso/falha por hora

**5. Recovery:**
- Restart automático (Docker `restart: always`)
- Retry de jobs (BullMQ 3 tentativas)
- Fallback para stickers pendentes se falhar

---

### 9. Roadmap de Melhorias Técnicas (Futuro)

#### 🔮 Próximas Otimizações

**Curto Prazo (Sprint 8-9):**
- [ ] Implementar circuit breaker para Evolution API
- [ ] Adicionar health check endpoint (`/health`)
- [ ] Configurar alertas Discord (webhook)
- [ ] Implementar backup automático de sessões WhatsApp

**Médio Prazo (v2.0):**
- [ ] Migrar para Redis Cluster (alta disponibilidade)
- [ ] Implementar CDN para stickers (Cloudflare R2)
- [ ] Adicionar métricas Prometheus/Grafana
- [ ] Implementar auto-scaling de workers (Kubernetes)

**Longo Prazo (v3.0):**
- [ ] Multi-região (latência global)
- [ ] Disaster recovery automatizado
- [ ] A/B testing de parâmetros FFmpeg
- [ ] Machine learning para otimizar compressão

---

## 12. Métricas de Sucesso {#métricas-de-sucesso}

### Métricas de Performance

| Métrica | Meta MVP | Como Medir |
|---------|----------|------------|
| **Tempo de processamento (estático)** | <5s | Logs de jobs (created_at → sent_at) |
| **Tempo de processamento (animado)** | <10s | Logs de jobs |
| **Taxa de sucesso** | >95% | (stickers enviados / total) × 100 |
| **Uptime do backend** | >99% | Monitoramento de health checks |
| **Tamanho final (estático)** | <100KB | Média de file_size_bytes |
| **Tamanho final (animado)** | <500KB | Média de file_size_bytes |

---

### Métricas de Produto

| Métrica | Meta MVP (30 dias) | Como Medir |
|---------|-------------------|------------|
| **Usuários únicos** | 50+ | `SELECT COUNT(DISTINCT phone_number) FROM users` |
| **Stickers criados** | 500+ | `SELECT COUNT(*) FROM stickers` |
| **Taxa de retenção D1** | >30% | Usuários que voltam no dia seguinte |
| **Taxa de conversão (pendentes)** | >80% | Usuários que voltam buscar pendentes |
| **Stickers/usuário** | >10 | `SELECT AVG(sticker_count) FROM (SELECT COUNT(*) as sticker_count FROM stickers GROUP BY user_number)` |
| **% de stickers animados** | 10-20% | `SELECT COUNT(*) FROM stickers WHERE tipo='animado' / COUNT(*)` |

---

### Métricas de Negócio

| Métrica | Meta MVP | Como Medir |
|---------|----------|------------|
| **Custo/sticker** | $0 | (Custo total / total stickers) |
| **Armazenamento usado** | <1GB | Dashboard Supabase |
| **Transferência mensal** | <2GB | Dashboard Supabase |
| **Erros/dia** | <5% | Logs de erro / total de requisições |

---

### Queries de Analytics (Supabase)

#### 1. Usuários Ativos por Dia

```sql
SELECT
  DATE(created_at) as dia,
  COUNT(DISTINCT user_number) as usuarios_unicos,
  COUNT(*) as total_stickers
FROM stickers
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY dia DESC;
```

#### 2. Distribuição de Tipos (Estático vs Animado)

```sql
SELECT
  tipo,
  COUNT(*) as quantidade,
  ROUND(AVG(file_size_bytes) / 1024, 2) as tamanho_medio_kb
FROM stickers
GROUP BY tipo;
```

#### 3. Top 10 Usuários

```sql
SELECT
  user_number,
  user_name,
  COUNT(*) as total_stickers,
  MAX(created_at) as ultimo_uso
FROM stickers
GROUP BY user_number, user_name
ORDER BY total_stickers DESC
LIMIT 10;
```

#### 4. Taxa de Retenção (Stickers Pendentes)

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'pendente') as pendentes,
  COUNT(*) FILTER (WHERE status = 'enviado') as enviados,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'enviado' AND sent_at > created_at + INTERVAL '1 day')::numeric
    /
    COUNT(*) FILTER (WHERE status = 'pendente')::numeric
    * 100,
    2
  ) as taxa_conversao_pendentes
FROM stickers;
```

#### 5. Performance de Processamento

```sql
SELECT
  tipo,
  COUNT(*) as quantidade,
  ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - created_at))), 2) as tempo_medio_segundos,
  MIN(EXTRACT(EPOCH FROM (sent_at - created_at))) as tempo_minimo,
  MAX(EXTRACT(EPOCH FROM (sent_at - created_at))) as tempo_maximo
FROM stickers
WHERE sent_at IS NOT NULL
GROUP BY tipo;
```

---

## 12. Riscos e Mitigações {#riscos-e-mitigações}

### Risco 1: Processamento Lento

**Descrição:** Stickers demoram >10s para processar

**Impacto:** Alto (usuário abandona)

**Probabilidade:** Média

**Mitigação:**
- ✅ Usar filas assíncronas (BullMQ)
- ✅ Otimizar configuração do Sharp (qualidade vs velocidade)
- ✅ Limitar tamanho de arquivos (<5MB)
- ✅ Escalar workers se necessário

**Plano B:**
- Adicionar mensagem: "Processando, aguarda uns segundinhos..."

---

### Risco 2: Supabase Storage Caro

**Descrição:** Ultrapassar 1GB grátis e custo ficar alto

**Impacto:** Médio (custo mensal)

**Probabilidade:** Baixa (MVP)

**Mitigação:**
- ✅ Monitorar uso diário (dashboard Supabase)
- ✅ Implementar auto-delete de stickers >30 dias (futuro)
- ✅ Compressão agressiva (qualidade menor se necessário)

**Plano B:**
- Migrar para S3 + CloudFront (mais barato em escala)

---

### Risco 3: Spam / Abuso

**Descrição:** Usuários enviam centenas de imagens para "farmar" stickers

**Impacto:** Alto (custo, performance)

**Probabilidade:** Média

**Mitigação:**
- ✅ Rate limiting (5/minuto)
- ✅ Limite diário (10 grátis)
- ✅ Validação de formato/tamanho
- ✅ Bloquear IPs/números suspeitos (manual)

**Plano B:**
- Implementar CAPTCHA via WhatsApp (mandar código)
- Banir usuários abusivos

---

### Risco 4: Evolution API Instável

**Descrição:** Evolution API cai ou tem bugs

**Impacto:** Crítico (bot para de funcionar)

**Probabilidade:** Baixa

**Mitigação:**
- ✅ Usar versão estável (v2.3.1+)
- ✅ Retry automático (BullMQ)
- ✅ Health check da Evolution API
- ✅ Logs detalhados de erros

**Plano B:**
- Migrar para outra lib (Baileys, WAHA)

---

### Risco 5: Limite de Usuários Atingido

**Descrição:** >1000 usuários ativos/dia, infraestrutura não aguenta

**Impacto:** Alto (performance degrada)

**Probabilidade:** Baixa (MVP)

**Mitigação:**
- ✅ Arquitetura escalável (workers horizontais)
- ✅ Redis pode escalar (cluster)
- ✅ Supabase escala automaticamente

**Plano B:**
- Migrar para Kubernetes (escala automática)
- Usar CDN (Cloudflare) na frente

---

### Risco 6: Custo de VPS

**Descrição:** VPS não aguenta múltiplos projetos

**Impacto:** Médio (custo adicional)

**Probabilidade:** Baixa

**Mitigação:**
- ✅ Usar mesma VPS do Brazyl (já paga)
- ✅ Docker Compose isola recursos
- ✅ Monitorar CPU/RAM

**Plano B:**
- Deploy em Railway/Render (serverless)

---

## 13. Critérios de Aceitação {#critérios-de-aceitação}

### MVP Pronto quando...

#### Funcionalidades Core

- [x] Usuário envia imagem → recebe sticker estático (<5s)
- [x] Usuário envia GIF → recebe sticker animado (<10s)
- [x] Sistema valida formato e tamanho
- [x] Limite de 10 stickers/dia funciona
- [x] Stickers além do limite são salvos como pendente
- [x] Usuário recebe stickers pendentes no dia seguinte (8h)
- [x] Rate limiting funciona (5/minuto)
- [x] Mensagens personalizadas com nome do usuário

#### Infraestrutura

- [x] Backend rodando em produção (VPS)
- [x] HTTPS configurado (stickers.ytem.com.br)
- [x] Webhook da Evolution API conectado
- [x] Supabase PostgreSQL + Storage funcionando
- [x] Redis + BullMQ funcionando
- [x] Jobs agendados rodando (reset + send-pending)

#### Qualidade

- [x] Taxa de sucesso >95%
- [x] Tempo de processamento dentro do esperado
- [x] Logs estruturados funcionando
- [x] Sem erros críticos em 24h de produção

#### Documentação

- [x] README.md completo
- [x] PRD documentado
- [x] Endpoints documentados
- [x] Guia de troubleshooting

---

## 🎯 Próximas Versões (Roadmap Futuro)

### v2.0 - Monetização (3-4 meses)

- 💰 Integração com Stripe
- 💳 Plano Premium (ilimitado)
- 🎨 Stickers com marca d'água/texto
- 📊 Dashboard web de analytics
- 🎁 Sistema de referral (indique e ganhe)

### v3.0 - Features Avançadas (6 meses)

- 📦 Packs de stickers
- 🖼️ Edição de imagens (filtros, texto)
- 🤖 IA para remover fundo (rembg)
- 📱 App mobile (React Native)
- 🌐 Multi-idioma

---

**Documento criado por:** Claude Code + Paulo Henrique
**Data de Criação:** 26/12/2025
**Última Atualização:** 27/12/2025
**Versão:** 1.1
**Status:** ✅ Testes Locais Completos → Preparando Deploy VPS
