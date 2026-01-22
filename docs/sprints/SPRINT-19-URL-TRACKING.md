# Sprint 19: Sistema de URL Tracking e Encurtador

## PRD - Product Requirements Document

**Data:** 2026-01-15
**Status:** Planejado
**Prioridade:** Alta

---

## 1. Visao Geral

### 1.1 Contexto

O bot de figurinhas precisa de um sistema proprio de tracking de URLs para:
- Medir efetividade das campanhas de WhatsApp
- Entender comportamento dos usuarios (cliques, dispositivos, localizacao)
- Criar links curtos e memoraveis para compartilhar
- Nao depender de servicos pagos de terceiros

### 1.2 Solucao Proposta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SISTEMA DE URL TRACKING                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  your-shortener.com/abc123  ──────────────────────────────────────────────┐    │
│         │                                                               │    │
│         ▼                                                               │    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐ │    │
│  │   Fastify   │───▶│  Registra   │───▶│      Redireciona para       │ │    │
│  │   Backend   │    │   Clique    │    │       URL Original          │ │    │
│  └─────────────┘    └──────┬──────┘    └─────────────────────────────┘ │    │
│                            │                                            │    │
│                            ▼                                            │    │
│                    ┌───────────────┐                                    │    │
│                    │   Supabase    │                                    │    │
│                    │  url_links    │                                    │    │
│                    │  url_clicks   │                                    │    │
│                    └───────────────┘                                    │    │
│                            │                                            │    │
│                            ▼                                            │    │
│                    ┌───────────────┐                                    │    │
│                    │ Admin Panel   │                                    │    │
│                    │  Dashboard    │                                    │    │
│                    └───────────────┘                                    │    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Decisoes Tecnicas

| Item | Decisao | Motivo |
|------|---------|--------|
| **Dominio** | `your-shortener.com` | Subdominio gratuito, ja temos your-domain.com |
| **Uso** | Interno (admin panel) | Por enquanto so admins criam links |
| **Geolocalizacao** | MaxMind GeoLite2 | Gratuito, sem delay (banco local) |
| **Links personalizados** | Sim | Editavel no admin panel |
| **Expiracao** | Nao expira | Links permanentes |
| **Limite cliques** | Sem limite | Ilimitado |
| **QR Code** | Nao (por enquanto) | Pode ser adicionado depois |
| **Integracao campanhas** | Automatico | Gera link trackado ao criar botao |
| **DNS** | Cloudflare | Chave ja no Doppler |

---

## 2. Fases de Implementacao

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SPRINT 19 - ENTREGAS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FASE 1: Infraestrutura (Critico)                                           │
│  ├── Configurar DNS your-shortener.com no Cloudflare                           │
│  ├── Configurar Traefik para novo subdominio                                │
│  ├── Criar tabelas no Supabase (url_links, url_clicks)                      │
│  └── Configurar MaxMind GeoLite2                                            │
│                                                                              │
│  FASE 2: Backend - API de Links (Critico)                                   │
│  ├── POST /links - Criar link                                               │
│  ├── GET /links - Listar links                                              │
│  ├── GET /links/:id - Detalhes do link                                      │
│  ├── PATCH /links/:id - Editar link                                         │
│  ├── DELETE /links/:id - Desativar link                                     │
│  └── GET /l/:code - Redirect com tracking                                   │
│                                                                              │
│  FASE 3: Admin Panel - CRUD de Links (Alto)                                 │
│  ├── Pagina /dashboard/links - Listagem                                     │
│  ├── Modal de criacao de link                                               │
│  ├── Modal de edicao de link                                                │
│  └── Confirmacao de exclusao                                                │
│                                                                              │
│  FASE 4: Admin Panel - Dashboard Analytics (Medio)                          │
│  ├── Pagina /dashboard/links/:id - Detalhes                                 │
│  ├── Total de cliques                                                       │
│  ├── Grafico de cliques por dia                                             │
│  ├── Distribuicao por dispositivo                                           │
│  ├── Distribuicao por pais                                                  │
│  └── Lista de ultimos cliques                                               │
│                                                                              │
│  FASE 5: Integracao com Campanhas (Medio)                                   │
│  ├── Gerar link trackado automatico ao criar botao                          │
│  ├── Vincular link a campanha (campaign_id)                                 │
│  └── Metricas de clique por campanha no dashboard                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. User Stories

### US1: Admin cria link trackado
> Como admin, quero criar links curtos e trackados para usar nas campanhas de WhatsApp.

**Criterios de aceite:**
- [ ] Formulario com campo URL original (obrigatorio)
- [ ] Campo titulo (opcional)
- [ ] Campo codigo personalizado (opcional, gera automatico se vazio)
- [ ] Validacao de URL valida
- [ ] Validacao de codigo unico
- [ ] Exibe link criado para copiar

### US2: Admin ve lista de links
> Como admin, quero ver todos os links criados com suas metricas basicas.

**Criterios de aceite:**
- [ ] Tabela com: titulo, codigo, URL original, cliques, data criacao
- [ ] Ordenacao por cliques ou data
- [ ] Busca por titulo ou codigo
- [ ] Paginacao
- [ ] Botao copiar link
- [ ] Botoes editar/excluir

### US3: Admin ve analytics de um link
> Como admin, quero ver estatisticas detalhadas de cada link.

**Criterios de aceite:**
- [ ] Total de cliques
- [ ] Grafico de cliques por dia (ultimos 30 dias)
- [ ] Pizza de dispositivos (mobile/desktop/tablet)
- [ ] Pizza de paises (top 5)
- [ ] Lista dos ultimos 50 cliques com timestamp e device

### US4: Usuario clica em link trackado
> Como usuario, quero clicar no link e ser redirecionado instantaneamente.

**Criterios de aceite:**
- [ ] Redirect HTTP 302 para URL original
- [ ] Latencia < 100ms
- [ ] Registra clique em background (nao bloqueia redirect)
- [ ] Captura: IP, user-agent, referer, timestamp
- [ ] Geolocalizacao processada async

### US5: Campanha gera links automaticamente
> Como admin, quero que ao criar um botao com URL na campanha, o sistema gere automaticamente um link trackado.

**Criterios de aceite:**
- [ ] Ao salvar botao com URL, cria entrada em url_links
- [ ] Link vinculado a campanha (campaign_id)
- [ ] URL do botao substituida pelo link curto
- [ ] Dashboard de campanha mostra cliques por botao

---

## 4. Especificacao Tecnica

### 4.1 Schema do Banco de Dados

```sql
-- Tabela de links
CREATE TABLE url_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code VARCHAR(12) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  title VARCHAR(255),

  -- Vinculo com campanha (opcional)
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  step_id UUID REFERENCES campaign_steps(id) ON DELETE SET NULL,

  -- UTM parameters (opcional)
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_content VARCHAR(100),

  -- Metricas (cache para performance)
  clicks_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_url_links_short_code ON url_links(short_code);
CREATE INDEX idx_url_links_campaign_id ON url_links(campaign_id);
CREATE INDEX idx_url_links_created_at ON url_links(created_at DESC);

-- Tabela de cliques (analytics)
CREATE TABLE url_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES url_links(id) ON DELETE CASCADE,

  -- Timestamp
  clicked_at TIMESTAMPTZ DEFAULT NOW(),

  -- Request info
  ip_address INET,
  user_agent TEXT,
  referer TEXT,

  -- Geolocalizacao (preenchido async)
  country_code VARCHAR(2),
  country_name VARCHAR(100),
  city VARCHAR(100),

  -- Device info (parseado do user-agent)
  device_type VARCHAR(20),  -- mobile, desktop, tablet
  browser VARCHAR(50),
  os VARCHAR(50)
);

-- Indices para analytics
CREATE INDEX idx_url_clicks_link_id ON url_clicks(link_id);
CREATE INDEX idx_url_clicks_clicked_at ON url_clicks(clicked_at DESC);
CREATE INDEX idx_url_clicks_country ON url_clicks(country_code);
CREATE INDEX idx_url_clicks_device ON url_clicks(device_type);

-- Trigger para atualizar clicks_count
CREATE OR REPLACE FUNCTION update_link_clicks_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE url_links
  SET clicks_count = clicks_count + 1,
      updated_at = NOW()
  WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_clicks_count
AFTER INSERT ON url_clicks
FOR EACH ROW
EXECUTE FUNCTION update_link_clicks_count();
```

### 4.2 Endpoints da API

#### POST /links
Cria um novo link trackado.

**Request:**
```json
{
  "original_url": "https://exemplo.com/pagina-longa",
  "title": "Promocao Black Friday",
  "short_code": "blackfriday",  // opcional
  "campaign_id": "uuid",         // opcional
  "utm_source": "whatsapp",      // opcional
  "utm_medium": "bot",           // opcional
  "utm_campaign": "black-friday" // opcional
}
```

**Response:**
```json
{
  "id": "uuid",
  "short_code": "blackfriday",
  "short_url": "https://your-shortener.com/blackfriday",
  "original_url": "https://exemplo.com/pagina-longa",
  "title": "Promocao Black Friday",
  "clicks_count": 0,
  "created_at": "2026-01-15T10:00:00Z"
}
```

#### GET /links
Lista links com filtros e paginacao.

**Query params:**
- `page` (default: 1)
- `limit` (default: 20)
- `search` (busca em titulo e codigo)
- `campaign_id` (filtra por campanha)
- `sort` (clicks_count, created_at)
- `order` (asc, desc)

#### GET /links/:id
Detalhes de um link com estatisticas.

**Response:**
```json
{
  "link": {
    "id": "uuid",
    "short_code": "blackfriday",
    "short_url": "https://your-shortener.com/blackfriday",
    "original_url": "https://exemplo.com/pagina-longa",
    "title": "Promocao Black Friday",
    "clicks_count": 1523,
    "campaign": {
      "id": "uuid",
      "name": "Black Friday 2026"
    },
    "created_at": "2026-01-15T10:00:00Z"
  },
  "stats": {
    "total_clicks": 1523,
    "clicks_by_day": [
      { "date": "2026-01-14", "clicks": 234 },
      { "date": "2026-01-15", "clicks": 456 }
    ],
    "devices": {
      "mobile": 1200,
      "desktop": 300,
      "tablet": 23
    },
    "countries": {
      "BR": 1400,
      "US": 50,
      "PT": 30,
      "other": 43
    },
    "recent_clicks": [
      {
        "clicked_at": "2026-01-15T14:32:00Z",
        "device_type": "mobile",
        "country_code": "BR",
        "city": "Sao Paulo"
      }
    ]
  }
}
```

#### PATCH /links/:id
Atualiza um link.

**Request:**
```json
{
  "title": "Novo titulo",
  "short_code": "novo-codigo",
  "is_active": true
}
```

#### DELETE /links/:id
Desativa um link (soft delete).

#### GET /l/:code
Endpoint de redirect (acesso publico).

**Comportamento:**
1. Busca link pelo short_code
2. Se nao encontrar ou inativo: retorna 404
3. Registra clique em background (nao bloqueia)
4. Retorna HTTP 302 redirect para original_url

**Headers capturados:**
- `X-Forwarded-For` ou `X-Real-IP` para IP
- `User-Agent` para device/browser/os
- `Referer` para origem

### 4.3 Estrutura de Arquivos

```
src/
├── routes/
│   ├── links.ts              # CRUD de links (autenticado)
│   └── redirect.ts           # GET /l/:code (publico)
├── services/
│   ├── linkService.ts        # Logica de negocios
│   ├── clickService.ts       # Registro e analytics de cliques
│   └── geoService.ts         # MaxMind GeoLite2
├── utils/
│   └── shortCodeGenerator.ts # Gera codigos unicos
└── types/
    └── links.ts              # Interfaces TypeScript

admin-panel/
├── src/app/
│   ├── (dashboard)/
│   │   └── links/
│   │       ├── page.tsx           # Listagem de links
│   │       └── [id]/
│   │           └── page.tsx       # Detalhes + analytics
│   └── api/
│       └── links/
│           ├── route.ts           # GET, POST
│           └── [id]/
│               └── route.ts       # GET, PATCH, DELETE
└── src/components/
    └── links/
        ├── LinkTable.tsx
        ├── CreateLinkModal.tsx
        ├── EditLinkModal.tsx
        ├── LinkStats.tsx
        └── ClicksChart.tsx
```

### 4.4 Configuracao MaxMind GeoLite2

```typescript
// src/services/geoService.ts
import maxmind, { CityResponse } from 'maxmind';
import path from 'path';

let lookup: maxmind.Reader<CityResponse> | null = null;

export async function initGeoService(): Promise<void> {
  const dbPath = path.join(__dirname, '../../data/GeoLite2-City.mmdb');
  lookup = await maxmind.open<CityResponse>(dbPath);
}

export function getGeoFromIP(ip: string): GeoInfo | null {
  if (!lookup) return null;

  const result = lookup.get(ip);
  if (!result) return null;

  return {
    country_code: result.country?.iso_code || null,
    country_name: result.country?.names?.en || null,
    city: result.city?.names?.en || null,
  };
}
```

**Download do banco:**
```bash
# Registrar em https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
# Baixar GeoLite2-City.mmdb e colocar em data/
```

### 4.5 Configuracao DNS (Cloudflare)

```bash
# Adicionar registro A para your-shortener.com
# Via Cloudflare API (chave no Doppler)

curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records" \
  -H "Authorization: Bearer {CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "fig",
    "content": "YOUR_VPS_IP",
    "ttl": 3600,
    "proxied": true
  }'
```

### 4.6 Configuracao Traefik

Adicionar labels no `deploy/stack-sticker.yml`:

```yaml
services:
  backend:
    deploy:
      labels:
        # ... labels existentes ...

        # Novo router para your-shortener.com
        - "traefik.http.routers.sticker-links.rule=Host(`your-shortener.com`)"
        - "traefik.http.routers.sticker-links.entrypoints=websecure"
        - "traefik.http.routers.sticker-links.tls=true"
        - "traefik.http.routers.sticker-links.tls.certresolver=letsencrypt"
        - "traefik.http.routers.sticker-links.service=sticker-api"
```

---

## 5. Metricas do Dashboard

### 5.1 Visao Geral (pagina /dashboard/links)

| Metrica | Descricao |
|---------|-----------|
| Total de links | COUNT de url_links |
| Total de cliques | SUM de clicks_count |
| Cliques hoje | COUNT de url_clicks WHERE clicked_at >= hoje |
| Link mais clicado | TOP 1 ORDER BY clicks_count |

### 5.2 Detalhes do Link (pagina /dashboard/links/:id)

| Componente | Dados |
|------------|-------|
| **Card resumo** | Total cliques, criado em, ultima atualizacao |
| **Grafico linha** | Cliques por dia (ultimos 30 dias) |
| **Pizza devices** | Mobile / Desktop / Tablet |
| **Pizza paises** | Top 5 paises + "outros" |
| **Tabela cliques** | Ultimos 50: timestamp, device, pais, cidade |

---

## 6. Integracao com Campanhas

### 6.1 Fluxo Automatico

```
Admin cria campanha com botao
         │
         ▼
┌─────────────────────┐
│ Botao tem URL?      │
└─────────┬───────────┘
          │ Sim
          ▼
┌─────────────────────┐
│ Cria url_links      │
│ - campaign_id       │
│ - step_id           │
│ - utm_campaign      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Substitui URL do    │
│ botao pelo link     │
│ your-shortener.com/xxx │
└─────────────────────┘
```

### 6.2 Dashboard de Campanha

Adicionar na pagina de detalhes da campanha:

- **Cliques por step**: Quantos cliques cada etapa gerou
- **CTR por botao**: Click-through rate de cada botao
- **Top links**: Links mais clicados da campanha

---

## 7. Checklist de Implementacao

### Fase 1: Infraestrutura
- [ ] Criar registro DNS your-shortener.com no Cloudflare
- [ ] Adicionar labels Traefik para novo subdominio
- [ ] Criar migration: tabela url_links
- [ ] Criar migration: tabela url_clicks
- [ ] Criar migration: trigger update_clicks_count
- [ ] Download e configurar MaxMind GeoLite2
- [ ] Criar geoService.ts

### Fase 2: Backend - API
- [ ] Criar src/routes/links.ts (CRUD)
- [ ] Criar src/routes/redirect.ts (GET /l/:code)
- [ ] Criar src/services/linkService.ts
- [ ] Criar src/services/clickService.ts
- [ ] Criar src/utils/shortCodeGenerator.ts
- [ ] Criar src/types/links.ts
- [ ] Registrar rotas no server.ts
- [ ] Testar endpoints com curl

### Fase 3: Admin Panel - CRUD
- [ ] Criar pagina /dashboard/links
- [ ] Criar componente LinkTable
- [ ] Criar componente CreateLinkModal
- [ ] Criar componente EditLinkModal
- [ ] Criar API routes /api/links
- [ ] Adicionar link no menu lateral

### Fase 4: Admin Panel - Analytics
- [ ] Criar pagina /dashboard/links/[id]
- [ ] Criar componente LinkStats (cards)
- [ ] Criar componente ClicksChart (grafico linha)
- [ ] Criar componente DevicesPie (pizza)
- [ ] Criar componente CountriesPie (pizza)
- [ ] Criar componente RecentClicks (tabela)

### Fase 5: Integracao Campanhas
- [ ] Modificar criacao de botao para gerar link
- [ ] Adicionar campaign_id ao criar link
- [ ] Exibir cliques por step no dashboard campanha
- [ ] Calcular e exibir CTR por botao

---

## 8. Estimativa de Arquivos

| Fase | Arquivos Novos | Arquivos Modificados |
|------|----------------|----------------------|
| 1 | 2 (geoService, migration) | 1 (stack-sticker.yml) |
| 2 | 5 (routes, services, types) | 1 (server.ts) |
| 3 | 5 (pages, components, api) | 1 (menu lateral) |
| 4 | 5 (page detalhes, charts) | 0 |
| 5 | 0 | 2 (campaignService, campaign page) |

**Total:** ~17 arquivos novos, ~5 modificados

---

## 9. Dependencias NPM

```json
{
  "maxmind": "^4.3.0",
  "ua-parser-js": "^1.0.0"
}
```

- `maxmind`: Leitura do banco GeoLite2
- `ua-parser-js`: Parse de user-agent para device/browser/os

---

## 10. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| MaxMind requer registro | Baixa | Medio | Registrar conta gratuita antecipadamente |
| Alto volume de cliques | Baixa | Alto | Usar trigger para cache, indices otimizados |
| DNS nao propaga | Baixa | Alto | Usar Cloudflare proxy (propagacao rapida) |

---

## 11. Proximos Passos (Pos-Sprint)

Funcionalidades para sprints futuras:

- [ ] QR Code automatico para cada link
- [ ] Expiracao opcional de links
- [ ] Limite de cliques opcional
- [ ] Integracao com Google Analytics
- [ ] Webhook de notificacao por clique
- [ ] A/B testing de URLs de destino
- [ ] Criacao de links via bot WhatsApp

---

**Ultima atualizacao:** 2026-01-15
**Autor:** Paulo Henrique + Claude
**Versao:** 1.0
