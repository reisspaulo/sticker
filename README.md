# Sticker Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

Bot de WhatsApp que transforma imagens, vídeos e links do Twitter/TikTok em figurinhas.

## Antes de usar

Esse projeto usa APIs **não oficiais** do WhatsApp (Evolution API, Z-API, etc).

Isso significa que:
- Seu número pode ser **banido permanentemente**
- Viola os Termos de Serviço do WhatsApp
- Pode dar problema legal dependendo do país

Foi exatamente isso que aconteceu com a gente - o WhatsApp baniu nosso número depois que o bot viralizou. Por isso estamos disponibilizando o código.

Se quiser usar em produção de verdade, considere a [API oficial do WhatsApp Business](https://business.whatsapp.com/products/business-platform).

---

## O que faz

- Transforma imagens em stickers
- Converte GIFs e vídeos em stickers animados
- Baixa vídeos do Twitter/X e transforma em sticker
- Baixa vídeos do TikTok
- Limite diário por usuário (configurável)
- Planos pagos via Stripe ou PIX
- Painel admin em Next.js
- Fila de processamento com BullMQ

---

## Como rodar

### Requisitos

- Node.js 20+
- Redis
- Supabase (ou Postgres)
- FFmpeg instalado
- Evolution API ou Z-API rodando

### Instalação

```bash
git clone https://github.com/SEU_USUARIO/sticker.git
cd sticker
npm install

cp .env.example .env
# preenche o .env

npm run dev
```

### Com Docker

```bash
docker-compose up -d
docker-compose logs -f backend
```

---

## Configuração

### Variáveis de ambiente

```env
# Servidor
NODE_ENV=development
PORT=3000

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key

# Redis
REDIS_URL=redis://localhost:6379

# WhatsApp (escolhe um)
WHATSAPP_PROVIDER=evolution

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-api-key
EVOLUTION_INSTANCE=nome-da-instancia

# Stripe (opcional)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Providers de WhatsApp

**Evolution API** (open source, roda local):

```bash
docker run -d --name evolution \
  -p 8080:8080 \
  atendai/evolution-api:latest
```

**Z-API** (pago, mais estável):

```env
WHATSAPP_PROVIDER=zapi
ZAPI_INSTANCE_ID=xxx
ZAPI_TOKEN=xxx
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Swarm                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Backend    │  │    Worker    │  │  Evolution API  │   │
│  │   (Fastify)  │  │   (BullMQ)   │  │   (WhatsApp)    │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘   │
│         │                 │                   │            │
│         └─────────┬───────┴───────────────────┘            │
│                   │                                        │
│         ┌─────────▼─────────┐                              │
│         │       Redis       │                              │
│         └───────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
             ┌────────────────────────┐
             │       Supabase         │
             │  - PostgreSQL          │
             │  - Storage             │
             └────────────────────────┘
```

---

## Documentação

| Doc | O que é |
|-----|---------|
| [Setup de Produção](docs/setup/PRODUCTION-SETUP.md) | Como colocar no ar |
| [Arquitetura](docs/architecture/ARCHITECTURE.md) | Como funciona por dentro |
| [Stickers](docs/features/STICKERS.md) | Como o processamento funciona |
| [Troubleshooting](docs/operations/TROUBLESHOOTING.md) | Quando dá ruim |

---

## Stack

| Tech | Pra quê |
|------|---------|
| TypeScript | Linguagem |
| Fastify | API |
| BullMQ | Filas |
| Sharp | Processar imagens |
| FFmpeg | Processar vídeos |
| Supabase | Banco + Storage |
| Redis | Cache + Filas |
| Docker Swarm | Orquestração |
| Next.js | Admin |

---

## Contribuindo

1. Faz um fork
2. Cria uma branch: `git checkout -b minha-feature`
3. Commita: `git commit -m "feat: minha feature"`
4. Push: `git push origin minha-feature`
5. Abre um PR

Commits seguem o padrão [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` feature nova
- `fix:` correção de bug
- `docs:` documentação
- `refactor:` refatoração

---

## Licença

MIT - faz o que quiser, só não me culpa se der merda.

---

## Aviso final

Esse código é disponibilizado "como está". Não me responsabilizo se seu número for banido, se o WhatsApp te processar, ou qualquer outra coisa.

**Não use pra spam.** Sério.
