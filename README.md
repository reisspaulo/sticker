# Sticker Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

> Bot de WhatsApp para criacao de figurinhas a partir de imagens, videos e links do Twitter/TikTok

## Aviso Importante

Este projeto usa APIs **nao oficiais** do WhatsApp (Evolution API, Z-API).

O uso dessas APIs pode resultar em:
- Ban permanente do numero
- Violacao dos Termos de Servico do WhatsApp
- Problemas legais em algumas jurisdicoes

**Use por sua conta e risco. Este projeto e para fins educacionais.**

Para uso comercial, considere a [WhatsApp Business API oficial](https://business.whatsapp.com/products/business-platform).

---

## Features

- Converter imagens em stickers WebP
- Converter GIFs e videos em stickers animados
- Download de videos do Twitter/X
- Download de videos do TikTok
- Sistema de limites diarios por usuario
- Planos de assinatura (Stripe + PIX)
- Painel administrativo (Next.js)
- Filas de processamento assincrono (BullMQ)
- Rate limiting inteligente

---

## Quick Start

### Requisitos

- Node.js 20+
- Redis
- Supabase (ou PostgreSQL)
- FFmpeg
- Evolution API ou Z-API

### Instalacao

```bash
# 1. Clonar repositorio
git clone https://github.com/YOUR_USERNAME/sticker.git
cd sticker

# 2. Instalar dependencias
npm install

# 3. Configurar ambiente
cp .env.example .env
# Editar .env com suas credenciais

# 4. Rodar localmente
npm run dev
```

### Com Docker

```bash
# Subir ambiente completo
docker-compose up -d

# Ver logs
docker-compose logs -f backend
```

---

## Configuracao

### Variaveis de Ambiente

```env
# Server
NODE_ENV=development
PORT=3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Redis
REDIS_URL=redis://localhost:6379

# WhatsApp Provider (escolha um)
WHATSAPP_PROVIDER=evolution

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your-api-key
EVOLUTION_INSTANCE=your-instance

# Stripe (opcional)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Providers de WhatsApp

#### Evolution API (Recomendado - Open Source)

```bash
docker run -d --name evolution \
  -p 8080:8080 \
  atendai/evolution-api:latest
```

#### Z-API (SaaS)

```env
WHATSAPP_PROVIDER=zapi
ZAPI_INSTANCE_ID=xxx
ZAPI_TOKEN=xxx
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Swarm Stack                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │   Backend    │  │    Worker    │  │  Evolution API  │   │
│  │   (Fastify)  │  │   (BullMQ)   │  │   (WhatsApp)    │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘   │
│         │                  │                   │             │
│         └──────────┬───────┴───────────────────┘             │
│                    │                                         │
│         ┌──────────▼────────────┐                           │
│         │        Redis          │                           │
│         └───────────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Supabase (Cloud)      │
              │  - PostgreSQL          │
              │  - Storage (S3)        │
              └────────────────────────┘
```

---

## Documentacao

| Documento | Descricao |
|-----------|-----------|
| [Setup Completo](docs/setup/PRODUCTION-SETUP.md) | Configuracao de producao |
| [Arquitetura](docs/architecture/ARCHITECTURE.md) | Visao geral do sistema |
| [Stickers](docs/features/STICKERS.md) | Como funcionam os stickers |
| [Troubleshooting](docs/operations/TROUBLESHOOTING.md) | Solucao de problemas |

---

## Tech Stack

| Tecnologia | Uso |
|------------|-----|
| **TypeScript** | Linguagem principal |
| **Fastify** | API REST |
| **BullMQ** | Filas de processamento |
| **Sharp** | Processamento de imagens |
| **FFmpeg** | Processamento de videos |
| **Supabase** | Banco de dados + Storage |
| **Redis** | Cache + Filas |
| **Docker Swarm** | Orquestracao |
| **Next.js** | Admin Panel |

---

## Contribuindo

1. Fork o repositorio
2. Crie uma branch: `git checkout -b feat/minha-feature`
3. Faca commits: `git commit -m "feat: minha feature"`
4. Push: `git push origin feat/minha-feature`
5. Abra um Pull Request

### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nova feature
- `fix:` Bug fix
- `docs:` Documentacao
- `refactor:` Refatoracao
- `test:` Testes

---

## Licenca

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## Disclaimer

Este software e fornecido "como esta", sem garantia de qualquer tipo. Os autores nao se responsabilizam por qualquer dano ou ban de conta resultante do uso deste software.

**NAO use este projeto para spam ou qualquer atividade que viole os Termos de Servico do WhatsApp.**
