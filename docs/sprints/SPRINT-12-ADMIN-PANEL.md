# Sprint 12 - Admin Panel Expansion

**Status:** EM ANDAMENTO
**Data Inicio:** 08/01/2026

---

## Objetivo

Expandir o Admin Panel para incluir dashboard completo, gestao de usuarios, analytics, logs e configuracoes. Implementar navegacao via sidebar e estrutura modular.

---

## Visao Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│  Sticker Admin Panel                                            │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                   │
│  SIDEBAR     │  CONTEUDO PRINCIPAL                              │
│              │                                                   │
│  Dashboard   │  - Cards de metricas                             │
│  Usuarios    │  - Graficos                                      │
│  Stickers    │  - Tabelas com filtros                           │
│  Analytics   │  - Detalhes e acoes                              │
│  Logs        │                                                   │
│  Config      │                                                   │
│              │                                                   │
└──────────────┴──────────────────────────────────────────────────┘
```

---

## Estrutura de Navegacao

### Sidebar

| Secao | Rota | Descricao |
|-------|------|-----------|
| Dashboard | `/` | Overview com metricas e atividade recente |
| Usuarios | `/users` | Lista de usuarios |
| Usuarios > Detalhe | `/users/[id]` | Timeline e stickers do usuario |
| Usuarios > Fluxo | `/users/flow` | Funil de conversao |
| Stickers | `/stickers` | Todos os stickers |
| Stickers > Emocoes | `/stickers/emotions` | Classificacao de emocoes |
| Stickers > Celebridades | `/stickers/celebrities` | Stickers por celebridade |
| Analytics | `/analytics` | Metricas e graficos |
| Analytics > Funil | `/analytics/funnel` | Funil de conversao detalhado |
| Logs | `/logs` | Logs do sistema |
| Logs > Erros | `/logs/errors` | Erros agrupados |
| Config | `/settings` | Configuracoes |

---

## Fases de Implementacao

### Fase 1 - Estrutura Base (Atual)

**Objetivo:** Layout com sidebar responsivo e navegacao basica.

**Arquivos a criar/modificar:**

```
admin-panel/src/
├── app/
│   ├── (dashboard)/              # Route group com layout
│   │   ├── layout.tsx            # Layout com sidebar
│   │   ├── page.tsx              # Dashboard
│   │   ├── users/
│   │   │   └── page.tsx
│   │   ├── stickers/
│   │   │   ├── page.tsx
│   │   │   └── emotions/page.tsx # Migrar pagina atual
│   │   ├── analytics/
│   │   │   └── page.tsx
│   │   ├── logs/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── login/page.tsx            # Mantem fora do layout
│   └── layout.tsx                # Root layout
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx           # Navegacao lateral
│   │   ├── header.tsx            # Header com user info
│   │   └── nav-item.tsx          # Item de navegacao
│   └── ui/                       # shadcn components
```

**Componentes:**

1. **Sidebar** (`components/layout/sidebar.tsx`)
   - Logo/titulo
   - Navegacao principal
   - Subitens colapsaveis
   - Indicador de pagina ativa
   - Responsivo (drawer em mobile)

2. **Header** (`components/layout/header.tsx`)
   - Breadcrumb
   - Usuario logado
   - Botao de logout

3. **Dashboard Layout** (`app/(dashboard)/layout.tsx`)
   - Grid com sidebar + conteudo
   - Auth check
   - Loading state

---

### Fase 2 - Dashboard

**Objetivo:** Pagina inicial com metricas e atividade.

**Componentes:**

1. **Stat Cards**
   - Usuarios hoje
   - Stickers hoje
   - Taxa de conversao
   - Erros 24h

2. **Charts**
   - Usuarios ultimos 30 dias (linha)
   - Stickers por tipo (pizza)
   - Atividade por hora (heatmap)

3. **Activity Feed**
   - Ultimas acoes do sistema
   - Links para detalhes

**Bibliotecas:**
- `recharts` - Graficos

---

### Fase 3 - Usuarios

**Objetivo:** Gestao completa de usuarios.

**Paginas:**

1. **Lista** (`/users`)
   - Tabela com paginacao
   - Filtros: plano, status, periodo
   - Busca por numero
   - Acoes: ver, bloquear

2. **Detalhe** (`/users/[id]`)
   - Info do usuario
   - Timeline de interacoes
   - Stickers recentes
   - Estatisticas

3. **Fluxo** (`/users/flow`)
   - Funil de conversao visual
   - Cohorts por periodo
   - Metricas de retencao

**Bibliotecas:**
- `@tanstack/react-table` - Tabelas
- `@tanstack/react-query` - Data fetching

---

### Fase 4 - Analytics

**Objetivo:** Graficos e metricas avancadas.

**Componentes:**

1. **Periodo Selector**
   - Ultimos 7/30/90 dias
   - Periodo customizado
   - Comparacao com periodo anterior

2. **Charts**
   - Novos usuarios (linha com comparacao)
   - Stickers por dia (barras)
   - Horarios de pico (heatmap)
   - Receita/MRR (linha)

3. **Funil de Conversao**
   - Visualizacao de funil
   - Taxas por etapa
   - Drill-down por cohort

---

### Fase 5 - Logs

**Objetivo:** Visualizacao de logs do sistema.

**Fontes de dados:**
- `usage_logs` (Supabase)
- Docker logs (via API)
- Supabase logs (via API)

**Funcionalidades:**

1. **Lista de Logs**
   - Filtros: nivel, servico, periodo
   - Busca por texto
   - Auto-refresh opcional

2. **Agrupamento de Erros**
   - Erros similares agrupados
   - Contagem de ocorrencias
   - Stack trace

3. **Logs em Tempo Real** (opcional)
   - WebSocket para updates
   - Highlight de novos logs

---

## Stack Tecnica

### Dependencias Atuais
- Next.js 16 (App Router)
- Supabase (Auth + Database + Storage)
- shadcn/ui (Components)
- Tailwind CSS
- TypeScript

### Novas Dependencias (a instalar)

```bash
npm install recharts @tanstack/react-table @tanstack/react-query date-fns
```

| Pacote | Versao | Uso |
|--------|--------|-----|
| `recharts` | ^2.x | Graficos (linha, barra, pizza) |
| `@tanstack/react-table` | ^8.x | Tabelas com sort/filter/pagination |
| `@tanstack/react-query` | ^5.x | Cache e fetching de dados |
| `date-fns` | ^3.x | Manipulacao de datas |

---

## Database Views/Functions Necessarias

### View: `daily_metrics`

```sql
CREATE OR REPLACE VIEW daily_metrics AS
SELECT
  date_trunc('day', created_at)::date as day,
  COUNT(DISTINCT user_number) as unique_users,
  COUNT(*) as total_stickers,
  COUNT(*) FILTER (WHERE tipo = 'animado') as animated,
  COUNT(*) FILTER (WHERE tipo = 'estatico') as static
FROM stickers
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1 DESC;
```

### View: `user_stats`

```sql
CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id,
  u.whatsapp_number,
  u.name,
  u.plan,
  u.test_group,
  u.created_at,
  u.last_interaction,
  COUNT(s.id) as total_stickers,
  COUNT(s.id) FILTER (WHERE s.created_at > NOW() - INTERVAL '30 days') as stickers_30d,
  MAX(s.created_at) as last_sticker_at
FROM users u
LEFT JOIN stickers s ON s.user_number = u.whatsapp_number
GROUP BY u.id;
```

### Function: `get_conversion_funnel`

```sql
CREATE OR REPLACE FUNCTION get_conversion_funnel(p_days int DEFAULT 30)
RETURNS TABLE(
  step text,
  count bigint,
  percentage numeric
) AS $$
DECLARE
  total_users bigint;
BEGIN
  SELECT COUNT(*) INTO total_users
  FROM users
  WHERE created_at > NOW() - (p_days || ' days')::interval;

  RETURN QUERY
  SELECT 'Primeiro contato'::text, total_users, 100.0::numeric
  UNION ALL
  SELECT 'Primeiro sticker',
    COUNT(DISTINCT user_number),
    ROUND(COUNT(DISTINCT user_number)::numeric / NULLIF(total_users, 0) * 100, 1)
  FROM stickers
  WHERE created_at > NOW() - (p_days || ' days')::interval
  UNION ALL
  -- ... mais steps
  ;
END;
$$ LANGUAGE plpgsql;
```

---

## Estrutura de Arquivos Final

```
admin-panel/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── users/
│   │   │   │   ├── page.tsx          # Lista
│   │   │   │   ├── [id]/page.tsx     # Detalhe
│   │   │   │   └── flow/page.tsx     # Funil
│   │   │   ├── stickers/
│   │   │   │   ├── page.tsx          # Todos
│   │   │   │   ├── emotions/page.tsx # Emocoes
│   │   │   │   └── celebrities/page.tsx
│   │   │   ├── analytics/
│   │   │   │   ├── page.tsx          # Metricas
│   │   │   │   └── funnel/page.tsx   # Funil
│   │   │   ├── logs/
│   │   │   │   ├── page.tsx          # Sistema
│   │   │   │   └── errors/page.tsx   # Erros
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   ├── login/page.tsx
│   │   ├── layout.tsx
│   │   ├── providers.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   ├── nav-item.tsx
│   │   │   └── mobile-nav.tsx
│   │   ├── charts/
│   │   │   ├── line-chart.tsx
│   │   │   ├── bar-chart.tsx
│   │   │   ├── pie-chart.tsx
│   │   │   └── stat-card.tsx
│   │   ├── data-table/
│   │   │   ├── data-table.tsx
│   │   │   ├── columns.tsx
│   │   │   └── toolbar.tsx
│   │   └── ui/
│   │       └── ... (shadcn)
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── auth.tsx
│   │   ├── utils.ts
│   │   └── queries/
│   │       ├── use-users.ts
│   │       ├── use-stickers.ts
│   │       ├── use-analytics.ts
│   │       └── use-logs.ts
│   └── types/
│       ├── user.ts
│       ├── sticker.ts
│       └── analytics.ts
```

---

## Checklist de Implementacao

### Fase 1 - Estrutura Base
- [ ] Instalar dependencias (recharts, react-table, react-query, date-fns)
- [ ] Criar componente Sidebar
- [ ] Criar componente Header
- [ ] Criar layout (dashboard) com sidebar
- [ ] Migrar pagina de emocoes para nova estrutura
- [ ] Criar paginas placeholder para cada secao
- [ ] Testar navegacao e responsividade

### Fase 2 - Dashboard
- [ ] Criar componente StatCard
- [ ] Criar view `daily_metrics` no Supabase
- [ ] Implementar cards de metricas
- [ ] Implementar grafico de usuarios (30 dias)
- [ ] Implementar grafico de stickers por tipo
- [ ] Implementar feed de atividade recente

### Fase 3 - Usuarios
- [ ] Instalar e configurar react-table
- [ ] Criar view `user_stats` no Supabase
- [ ] Implementar lista de usuarios com filtros
- [ ] Implementar pagina de detalhe do usuario
- [ ] Implementar timeline de interacoes
- [ ] Implementar funil de usuarios

### Fase 4 - Analytics
- [ ] Criar function `get_conversion_funnel`
- [ ] Implementar seletor de periodo
- [ ] Implementar graficos comparativos
- [ ] Implementar funil de conversao visual
- [ ] Implementar metricas de retencao

### Fase 5 - Logs
- [ ] Implementar lista de logs com filtros
- [ ] Implementar agrupamento de erros
- [ ] Implementar busca em logs
- [ ] (Opcional) Implementar logs em tempo real

---

## Observacoes

1. **Reutilizar codigo existente**: A pagina de emocoes ja funciona, migrar para nova estrutura
2. **Design consistente**: Usar mesmo tema escuro e componentes shadcn
3. **Performance**: Usar react-query para cache e deduplicacao de requests
4. **Responsividade**: Sidebar vira drawer em mobile
5. **Autenticacao**: Todas as rotas protegidas via AuthProvider

---

## Referencias

- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar)
- [Recharts](https://recharts.org/)
- [TanStack Table](https://tanstack.com/table)
- [TanStack Query](https://tanstack.com/query)

---

**Ultima atualizacao:** 08/01/2026
