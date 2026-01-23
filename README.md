# Sticker Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

Bot de WhatsApp que transforma imagens, vídeos e links do Twitter/TikTok em figurinhas.

## Aviso importante

Esse projeto usa APIs **não oficiais** do WhatsApp (Evolution API, Z-API).

Isso significa que:
- Seu número pode ser banido permanentemente
- Viola os Termos de Serviço do WhatsApp
- Pode ter implicações legais dependendo da região

Foi isso que aconteceu conosco - o WhatsApp baniu nosso número depois que o bot cresceu. Por isso decidimos disponibilizar o código.

Para uso comercial, considere a [API oficial do WhatsApp Business](https://business.whatsapp.com/products/business-platform).

---

## Funcionalidades

- Transforma imagens em stickers
- Converte GIFs e vídeos em stickers animados
- Baixa vídeos do Twitter/X e transforma em sticker
- Baixa vídeos do TikTok
- Limite diário por usuário (configurável)
- Planos pagos via Stripe ou PIX
- Painel administrativo em Next.js
- Fila de processamento com BullMQ

---

## Como rodar

### Requisitos

- Node.js 20+
- Redis
- Supabase (ou PostgreSQL)
- FFmpeg instalado
- Evolution API ou Z-API

### Instalação

```bash
git clone https://github.com/SEU_USUARIO/sticker.git
cd sticker
npm install

cp .env.example .env
# Configure o .env com suas credenciais

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

# WhatsApp (escolha um provider)
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

**Evolution API** (open source):

```bash
docker run -d --name evolution \
  -p 8080:8080 \
  atendai/evolution-api:latest
```

**Z-API** (serviço pago):

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

| Documento | Descrição |
|-----------|-----------|
| [Setup de Produção](docs/setup/PRODUCTION-SETUP.md) | Como fazer deploy |
| [Arquitetura](docs/architecture/ARCHITECTURE.md) | Visão geral do sistema |
| [Stickers](docs/features/STICKERS.md) | Como o processamento funciona |
| [Troubleshooting](docs/operations/TROUBLESHOOTING.md) | Resolução de problemas |

---

## Stack

| Tecnologia | Uso |
|------------|-----|
| TypeScript | Linguagem principal |
| Fastify | API REST |
| BullMQ | Filas de processamento |
| Sharp | Processamento de imagens |
| FFmpeg | Processamento de vídeos |
| Supabase | Banco de dados e Storage |
| Redis | Cache e filas |
| Docker Swarm | Orquestração |
| Next.js | Painel administrativo |

---

## Contribuindo

1. Faça um fork do repositório
2. Crie uma branch: `git checkout -b minha-feature`
3. Faça commit: `git commit -m "feat: minha feature"`
4. Faça push: `git push origin minha-feature`
5. Abra um Pull Request

Commits seguem o padrão [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` documentação
- `refactor:` refatoração

---

## Licença

MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## Disclaimer

Este software é disponibilizado "como está", sem garantias. Os autores não se responsabilizam por banimentos, problemas legais ou outras consequências do uso.

Não utilize este projeto para spam ou atividades que violem os Termos de Serviço do WhatsApp.
