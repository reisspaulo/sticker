# Sprint 17: Monitoramento e Analytics no Admin Panel

## PRD - Product Requirements Document

**Data:** 2026-01-15
**Status:** Em andamento
**Prioridade:** Alta

---

## 0. Pré-requisitos (Concluídos)

### 0.1 Configuração de Alertas
- [x] Adicionar `ADMIN_WHATSAPP` no Doppler (`5511946304133`)
- [x] Criar `alertWhatsAppDisconnected()` no `alertService.ts`
- [x] Criar `alertWhatsAppReconnected()` no `alertService.ts`

### 0.2 Cron Job de Health Check
- [x] Criar `src/jobs/checkWhatsAppConnections.ts`
- [x] Registrar job no `src/jobs/index.ts` (a cada 5 min)
- [x] Implementar detecção de mudança de estado (conectou/desconectou)

### Arquivos criados/modificados:
```
src/services/alertService.ts     # +100 linhas (alertas de desconexão)
src/jobs/checkWhatsAppConnections.ts  # NOVO (health check job)
src/jobs/index.ts                # +20 linhas (registro do job)
```

---

## 1. Visão Geral

### 1.1 Problema Atual

O Admin Panel não possui:
- Visibilidade do status das conexões WhatsApp (Evolution API + Avisa API)
- Forma de reconectar quando uma conexão cai
- Analytics de emoções e celebridades classificadas
- Forma de editar dados de usuários manualmente

**Riscos atuais:**
- Conexão WhatsApp pode cair e ninguém percebe
- Para reconectar, precisa usar terminal com curl
- Não há visão de quais emoções/celebridades são mais comuns
- Para ajustar plano de usuário, precisa acessar banco direto

### 1.2 Solução Proposta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SPRINT 17 - ENTREGAS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FASE 1: Dashboard de Conexões (Crítico)                                    │
│  ├── Card de status Evolution API                                           │
│  ├── Card de status Avisa API                                               │
│  ├── Polling automático a cada 30s                                          │
│  └── Indicadores visuais (verde/amarelo/vermelho)                          │
│                                                                              │
│  FASE 2: Reconexão via QR Code (Crítico)                                    │
│  ├── API routes proxy (segurança)                                           │
│  ├── Modal com QR Code                                                      │
│  ├── Polling de status durante reconexão                                    │
│  └── Toast de confirmação                                                   │
│                                                                              │
│  FASE 3: Analytics de Classificação (Médio)                                 │
│  ├── Gráfico Top Emoções                                                    │
│  ├── Gráfico Top Celebridades                                               │
│  └── KPIs de classificação                                                  │
│                                                                              │
│  FASE 4: Edição de Usuário (Baixo)                                          │
│  ├── Modal de edição na página de detalhes                                  │
│  ├── Ações rápidas (dar bônus, mudar plano)                                │
│  └── Histórico de alterações                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Stories

### US1: Admin vê status das conexões
> Como admin, quero ver em tempo real se as APIs do WhatsApp estão conectadas, para saber se o bot está funcionando.

**Criterios de aceite:**
- [x] Card mostrando status da Evolution API
- [x] Card mostrando status da Avisa API
- [x] Atualizacao automatica a cada 30 segundos
- [x] Indicador visual: verde (conectado) | vermelho (desconectado) com animacao pulse

### US2: Admin reconecta WhatsApp via QR
> Como admin, quero poder reconectar o WhatsApp pelo navegador quando a conexão cair, sem precisar usar terminal.

**Critérios de aceite:**
- [ ] Botão "Reconectar" aparece quando desconectado
- [ ] Modal exibe QR Code grande e legível
- [ ] Instruções claras de como escanear
- [ ] Polling verifica conexão a cada 3s
- [ ] Modal fecha automaticamente ao conectar
- [ ] Toast confirma reconexão

### US3: Admin vê top emoções
> Como admin, quero ver quais emoções são mais comuns nos stickers classificados, para entender o conteúdo.

**Critérios de aceite:**
- [ ] Gráfico de barras horizontal com top 10 emoções
- [ ] Mostra contagem de cada emoção
- [ ] Filtro por período (7d, 30d, all time)

### US4: Admin vê top celebridades
> Como admin, quero ver quais celebridades aparecem mais nos stickers, para priorizar treinamentos.

**Critérios de aceite:**
- [ ] Gráfico de barras com top 10 celebridades
- [ ] Mostra foto/avatar da celebridade
- [ ] Contagem de stickers identificados

### US5: Admin edita dados de usuário
> Como admin, quero poder ajustar o plano, limites e bônus de um usuário manualmente, para resolver casos especiais.

**Critérios de aceite:**
- [ ] Botão "Editar" na página de detalhes do usuário
- [ ] Modal com campos editáveis
- [ ] Ações rápidas: "Dar 5 bônus", "Upgrade Premium 30d"
- [ ] Confirmação antes de salvar
- [ ] Log da alteração

---

## 3. Arquitetura

### 3.1 API Routes (Proxy para Evolution/Avisa)

```
admin-panel/src/app/api/whatsapp/
├── evolution/
│   ├── status/route.ts      GET  → Status da conexão
│   ├── qr/route.ts          GET  → QR Code para reconexão
│   └── instances/route.ts   GET  → Lista instâncias
└── avisa/
    ├── status/route.ts      GET  → Status da conexão
    ├── qr/route.ts          GET  → QR Code para reconexão
    └── webhook/route.ts     GET  → Webhook configurado
```

**Por que proxy?**
- API keys ficam no servidor (não expostas no browser)
- Admin Panel roda na mesma VPS → pode usar localhost:8080
- Centraliza logs e controle de acesso

### 3.2 Fluxo de Reconexão

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  API Route   │────▶│ Evolution/   │
│  (Admin)     │     │  (Proxy)     │     │ Avisa API    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │  1. GET /status    │                    │
       │───────────────────▶│  2. GET localhost  │
       │                    │───────────────────▶│
       │                    │  3. {state:"close"}│
       │  4. {connected:    │◀───────────────────│
       │      false}        │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │  5. GET /qr        │                    │
       │───────────────────▶│  6. GET /connect   │
       │                    │───────────────────▶│
       │                    │  7. {base64:"..."}  │
       │  8. {qrCode:"..."}│◀───────────────────│
       │◀───────────────────│                    │
       │                    │                    │
       │  [Mostra QR]       │                    │
       │  [Usuário escaneia]│                    │
       │                    │                    │
       │  9. Polling /status│                    │
       │───────────────────▶│                    │
       │  ...               │                    │
       │  10. {connected:   │                    │
       │       true}        │                    │
       │◀───────────────────│                    │
       │                    │                    │
       │  [Fecha modal]     │                    │
       │  [Toast sucesso]   │                    │
```

### 3.3 Estrutura de Componentes

```
admin-panel/src/
├── app/
│   ├── api/whatsapp/          # API Routes (proxy)
│   │   ├── evolution/
│   │   └── avisa/
│   └── (dashboard)/
│       ├── page.tsx           # Dashboard (adicionar cards)
│       └── settings/
│           └── connections/
│               └── page.tsx   # Página dedicada de conexões
├── components/
│   └── whatsapp/
│       ├── ConnectionCard.tsx      # Card de status
│       ├── ConnectionStatus.tsx    # Indicador visual
│       ├── QRCodeModal.tsx         # Modal de reconexão
│       └── ConnectionDashboard.tsx # Container principal
└── hooks/
    └── useWhatsAppStatus.ts   # Hook de polling
```

---

## 4. Implementação

### FASE 1: Dashboard de Conexões

#### 4.1.1 API Routes

```typescript
// app/api/whatsapp/evolution/status/route.ts
import { NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'meu-zap';

export async function GET() {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE}`,
      {
        headers: { apikey: EVOLUTION_API_KEY! },
        cache: 'no-store',
      }
    );

    const data = await response.json();

    return NextResponse.json({
      connected: data.instance?.state === 'open',
      state: data.instance?.state,
      instance: EVOLUTION_INSTANCE,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      state: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
```

```typescript
// app/api/whatsapp/avisa/status/route.ts
import { NextResponse } from 'next/server';

const AVISA_API_URL = process.env.AVISA_API_URL || 'https://www.avisaapi.com.br/api';
const AVISA_API_TOKEN = process.env.AVISA_API_TOKEN;

export async function GET() {
  try {
    const response = await fetch(`${AVISA_API_URL}/instance/status`, {
      headers: { Authorization: `Bearer ${AVISA_API_TOKEN}` },
      cache: 'no-store',
    });

    const data = await response.json();

    return NextResponse.json({
      connected: data.data?.data?.Connected === true,
      loggedIn: data.data?.data?.LoggedIn,
      jid: data.data?.data?.Jid,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
```

#### 4.1.2 Hook de Polling

```typescript
// hooks/useWhatsAppStatus.ts
import { useState, useEffect, useCallback } from 'react';

interface ConnectionStatus {
  evolution: {
    connected: boolean;
    state: string;
    instance: string;
    loading: boolean;
    error?: string;
  };
  avisa: {
    connected: boolean;
    loggedIn: boolean;
    jid: string;
    loading: boolean;
    error?: string;
  };
  lastCheck: Date | null;
}

export function useWhatsAppStatus(pollingInterval = 30000) {
  const [status, setStatus] = useState<ConnectionStatus>({...});

  const checkStatus = useCallback(async () => {
    // Fetch both APIs in parallel
    const [evolutionRes, avisaRes] = await Promise.all([
      fetch('/api/whatsapp/evolution/status'),
      fetch('/api/whatsapp/avisa/status'),
    ]);

    // Update state...
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, pollingInterval);
    return () => clearInterval(interval);
  }, [checkStatus, pollingInterval]);

  return { status, refresh: checkStatus };
}
```

#### 4.1.3 Componente Card

```typescript
// components/whatsapp/ConnectionCard.tsx
interface ConnectionCardProps {
  title: string;
  subtitle: string;
  connected: boolean;
  loading: boolean;
  details: { label: string; value: string }[];
  onReconnect?: () => void;
}

export function ConnectionCard({ ... }: ConnectionCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <StatusIndicator connected={connected} loading={loading} />
        </div>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {details.map(d => (
          <div key={d.label} className="flex justify-between">
            <span className="text-muted-foreground">{d.label}</span>
            <span>{d.value}</span>
          </div>
        ))}
        {!connected && onReconnect && (
          <Button onClick={onReconnect} className="mt-4 w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reconectar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### FASE 2: Reconexão via QR Code

#### 4.2.1 API Route para QR

```typescript
// app/api/whatsapp/evolution/qr/route.ts
export async function GET() {
  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE}`,
      { headers: { apikey: EVOLUTION_API_KEY! } }
    );

    const data = await response.json();

    return NextResponse.json({
      qrCode: data.base64,
      pairingCode: data.pairingCode,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: '...' }, { status: 500 });
  }
}
```

#### 4.2.2 Modal de QR Code

```typescript
// components/whatsapp/QRCodeModal.tsx
interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  api: 'evolution' | 'avisa';
}

export function QRCodeModal({ open, onClose, api }: QRCodeModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Fetch QR on open
  useEffect(() => {
    if (open) fetchQR();
  }, [open]);

  // Poll for connection status
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, [open]);

  const checkConnection = async () => {
    const res = await fetch(`/api/whatsapp/${api}/status`);
    const data = await res.json();
    if (data.connected) {
      toast.success('WhatsApp conectado!');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reconectar WhatsApp</DialogTitle>
          <DialogDescription>
            Escaneie o QR Code com seu WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          {qrCode ? (
            <img src={qrCode} alt="QR Code" className="w-64 h-64" />
          ) : (
            <Skeleton className="w-64 h-64" />
          )}

          <div className="mt-4 text-sm text-muted-foreground text-center">
            <p>1. Abra o WhatsApp no celular</p>
            <p>2. Vá em Configurações → Aparelhos conectados</p>
            <p>3. Toque em "Conectar aparelho"</p>
            <p>4. Escaneie o código acima</p>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Aguardando conexão...
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### FASE 3: Analytics de Classificação

#### 4.3.1 Query Top Emoções

```sql
-- Top 10 emoções mais usadas
SELECT
  unnest(emotion_tags) as emotion,
  COUNT(*) as count
FROM stickers
WHERE emotion_tags IS NOT NULL
  AND array_length(emotion_tags, 1) > 0
GROUP BY emotion
ORDER BY count DESC
LIMIT 10;
```

#### 4.3.2 Query Top Celebridades

```sql
-- Top 10 celebridades mais identificadas
SELECT
  c.name,
  c.slug,
  COUNT(s.id) as sticker_count
FROM celebrities c
LEFT JOIN stickers s ON s.celebrity_id = c.id
GROUP BY c.id, c.name, c.slug
ORDER BY sticker_count DESC
LIMIT 10;
```

#### 4.3.3 Componente de Gráficos

```typescript
// Adicionar na página de analytics ou dashboard
<Card>
  <CardHeader>
    <CardTitle>Top Emoções</CardTitle>
    <CardDescription>Emoções mais classificadas</CardDescription>
  </CardHeader>
  <CardContent>
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={emotionData} layout="vertical">
        <XAxis type="number" />
        <YAxis type="category" dataKey="emotion" width={100} />
        <Tooltip />
        <Bar dataKey="count" fill="#8884d8" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </CardContent>
</Card>
```

---

### FASE 4: Edição de Usuário

#### 4.4.1 Campos Editáveis

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `subscription_plan` | select | free, premium, ultra |
| `subscription_status` | select | active, canceled, expired |
| `subscription_ends_at` | datetime | Data de expiração |
| `daily_limit` | number | Limite diário customizado |
| `daily_count` | number | Contador atual (pode resetar) |
| `bonus_credits_today` | number | Créditos bônus |

#### 4.4.2 Ações Rápidas

```typescript
const quickActions = [
  { label: 'Dar 5 Bônus', action: () => updateUser({ bonus_credits_today: user.bonus_credits_today + 5 }) },
  { label: 'Resetar Contador', action: () => updateUser({ daily_count: 0 }) },
  { label: 'Premium 30 dias', action: () => upgradeToPremium(30) },
  { label: 'Ultra 30 dias', action: () => upgradeToUltra(30) },
];
```

---

## 5. Checklist de Implementação

### FASE 1: Dashboard de Conexões ✅ CONCLUÍDO
- [x] Criar `/api/connections/status/route.ts` (unificado Evolution + Avisa)
- [x] Criar componente `ConnectionStatusCard.tsx`
- [x] Adicionar card no Dashboard (home)
- [x] Polling automático a cada 30s
- [x] Indicadores visuais (verde/vermelho)
- [x] Alerta visual quando desconectado

**Arquivos criados:**
```
admin-panel/src/app/api/connections/status/route.ts
admin-panel/src/components/dashboard/connection-status-card.tsx
```

### FASE 2: Reconexão via QR Code
- [ ] Criar `/api/whatsapp/evolution/qr/route.ts`
- [ ] Criar `/api/whatsapp/avisa/qr/route.ts`
- [ ] Criar componente `QRCodeModal.tsx`
- [ ] Integrar modal com cards
- [ ] Testar fluxo de reconexão
- [ ] Adicionar toast de confirmação

### FASE 3: Analytics de Classificação
- [ ] Criar queries SQL para top emoções
- [ ] Criar queries SQL para top celebridades
- [ ] Adicionar gráficos na página de analytics
- [ ] Ou criar seção no dashboard

### FASE 4: Edição de Usuário
- [ ] Criar componente `UserEditModal.tsx`
- [ ] Criar API route `/api/users/[id]/route.ts` (PATCH)
- [ ] Adicionar ações rápidas
- [ ] Integrar na página de detalhes do usuário
- [ ] Adicionar log de alterações

---

## 6. Variáveis de Ambiente Necessárias

```bash
# Já existentes no Doppler
EVOLUTION_API_URL=http://localhost:8080  # Interno na VPS
EVOLUTION_API_KEY=I1hKpe...
EVOLUTION_INSTANCE=meu-zap

AVISA_API_URL=https://www.avisaapi.com.br/api
AVISA_API_TOKEN=ROm8VZ...
```

**Nota:** Não é necessário criar novas variáveis. O admin panel usará as existentes via API routes (proxy).

---

## 7. Endpoints Testados

### Evolution API (https://your-evolution-api.com)

| Endpoint | Testado | Resposta |
|----------|---------|----------|
| `GET /instance/connectionState/{instance}` | ✅ | `{instance:{state:"open"}}` |
| `GET /instance/fetchInstances` | ✅ | `[{connectionStatus:"open", profileName:"Figurinhas"}]` |
| `GET /webhook/find/{instance}` | ✅ | `{url:"https://your-domain.com/webhook", enabled:true}` |
| `GET /instance/connect/{instance}` | ⏳ | Retorna QR Code (não testado - só quando desconectado) |

### Avisa API (https://www.avisaapi.com.br/api)

| Endpoint | Testado | Resposta |
|----------|---------|----------|
| `GET /instance/status` | ✅ | `{Connected:true, LoggedIn:true, Jid:"5511..."}` |
| `GET /webhook` | ✅ | `{webhook:""}` |
| `GET /instance/qr` | ⚠️ | Server Error (normal quando já conectado) |

---

## 8. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| QR Code expira rápido | Média | Baixo | Botão "Atualizar QR" no modal |
| API key exposta | Baixa | Alto | Usar proxy via API routes |
| Polling sobrecarrega API | Baixa | Médio | Intervalo de 30s, cache |
| Usuário edita dados errado | Média | Médio | Confirmação + log de alterações |

---

## 9. Cronograma Estimado

| Fase | Descrição | Estimativa |
|------|-----------|------------|
| **FASE 1** | Dashboard de Conexões | 2-3h |
| **FASE 2** | Reconexão via QR | 2h |
| **FASE 3** | Analytics de Classificação | 2h |
| **FASE 4** | Edição de Usuário | 3h |
| **Total** | | **9-10h** |

---

## 10. Referências

- [Evolution API Docs](https://doc.evolution-api.com)
- [Avisa API Docs](docs/integrations/AVISA_API_DOCS.md)
- [QUICK-CHANGES-GUIDE](docs/operations/QUICK-CHANGES-GUIDE.md) - Seção QR Code
- [Sprint 16 - Celebrity Training](docs/sprints/SPRINT-16-CELEBRITY-TRAINING.md) - Referência de formato

---

**Última atualização:** 2026-01-15
**Autor:** Claude + Paulo
