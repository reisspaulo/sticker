# Quick Start - Sprints 4-7

**Status:** COMPLETO
**Data:** 26/12/2024

---

## Pre-requisitos

Antes de iniciar, certifique-se que voce tem:

- ✅ Node.js 20+
- ✅ Docker e Docker Compose
- ✅ Evolution API rodando (localhost:8080)
- ✅ Redis rodando (localhost:6379)
- ✅ Supabase configurado

---

## 1. Instalacao

```bash
# Clonar repositorio (se ainda nao fez)
cd /Users/paulohenrique/sticker

# Instalar dependencias
npm install

# Build do projeto
npm run build
```

---

## 2. Variaveis de Ambiente

Crie/edite o arquivo `.env`:

```env
# Server
PORT=3000
HOST=0.0.0.0

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-api-key
EVOLUTION_INSTANCE=sua-instancia

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua-chave-anon

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## 3. Iniciar Servicos

### Desenvolvimento (modo watch)

```bash
# Terminal 1: Servidor API
npm run dev

# Terminal 2: Worker (processar stickers)
npm run dev:worker
```

### Producao

```bash
# Terminal 1: Servidor API
npm start

# Terminal 2: Worker
npm run start:worker
```

---

## 4. Testar Funcionalidades

### 4.1. Health Check

```bash
curl http://localhost:3000/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-26T..."
}
```

### 4.2. Estatisticas

```bash
curl http://localhost:3000/stats
```

**Resposta esperada:**
```json
{
  "users": {
    "total": 0,
    "active": 0,
    "conversionRate": "0%"
  },
  "stickers": {
    "total": 0,
    "today": 0,
    "thisMonth": 0,
    "pending": 0,
    "static": 0,
    "animated": 0
  },
  "performance": {
    "avgProcessingTimeMs": 0
  },
  "topUsers": [],
  "meta": {
    "timestamp": "2024-12-26T...",
    "queryTimeMs": 123
  }
}
```

### 4.3. Enviar Sticker (Imagem Estatica)

1. Envie uma imagem para o WhatsApp conectado
2. Aguarde ~5 segundos
3. Receba o sticker processado de volta

### 4.4. Enviar Sticker (GIF Animado)

1. Envie um GIF para o WhatsApp conectado
2. Aguarde ~10 segundos (processamento mais demorado)
3. Receba o sticker animado de volta

### 4.5. Testar Limite Diario

1. Envie 10 imagens/GIFs
2. Na 11a imagem, voce recebera mensagem de limite atingido
3. O sticker sera processado mas NAO enviado
4. Sera enviado no dia seguinte as 8h

---

## 5. Jobs Agendados

Os jobs rodam automaticamente:

| Job | Horario | Funcao |
|-----|---------|--------|
| `reset-daily-counters` | 00:00 (meia-noite) | Reseta contadores diarios |
| `send-pending-stickers` | 08:00 (manha) | Envia stickers pendentes |

### Executar Jobs Manualmente

Para testar os jobs sem esperar o horario agendado:

```typescript
// No codigo ou console do Node.js
import { runJobManually } from './src/jobs';

// Reset contadores
await runJobManually('reset-counters');

// Enviar pendentes
await runJobManually('send-pending');
```

---

## 6. Monitoramento

### Logs

Os logs sao estruturados e aparecem no terminal:

```bash
# Servidor
npm run dev

# Worker
npm run dev:worker
```

### Metricas

Acesse as estatisticas em tempo real:

```bash
curl http://localhost:3000/stats | jq
```

---

## 7. Testes

```bash
# Executar todos os testes
npm test

# Modo watch (desenvolvimento)
npm run test:watch

# Interface visual
npm run test:ui

# Coverage
npm run test:coverage
```

---

## 8. Estrutura de Dados

### Tabela `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  daily_count INT DEFAULT 0,
  last_reset_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  last_interaction TIMESTAMP DEFAULT NOW()
);
```

### Tabela `stickers`

```sql
CREATE TABLE stickers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_number VARCHAR(20) NOT NULL,
  tipo VARCHAR(10) NOT NULL, -- 'estatico' ou 'animado'
  original_url TEXT NOT NULL,
  processed_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INT,
  processing_time_ms INT,
  status VARCHAR(10) DEFAULT 'enviado', -- 'enviado' ou 'pendente'
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (user_number) REFERENCES users(whatsapp_number)
);
```

### Funcoes SQL Necessarias

```sql
-- Incrementar contador diario
CREATE OR REPLACE FUNCTION increment_daily_count(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE users
  SET daily_count = daily_count + 1,
      last_interaction = NOW()
  WHERE id = p_user_id
  RETURNING daily_count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Resetar todos os contadores
CREATE OR REPLACE FUNCTION reset_all_daily_counters()
RETURNS INT AS $$
DECLARE
  reset_count INT;
BEGIN
  UPDATE users
  SET daily_count = 0,
      last_reset_at = NOW();

  GET DIAGNOSTICS reset_count = ROW_COUNT;

  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;
```

### Buckets Supabase Storage

Criar os seguintes buckets no Supabase Storage:

1. `stickers-estaticos` (publico)
2. `stickers-animados` (publico)

---

## 9. Fluxo Completo

### Envio de Sticker

```
Usuario envia imagem
    ↓
Webhook recebe (/webhook)
    ↓
Valida mensagem
    ↓
Cria/busca usuario
    ↓
Verifica limite diario
    ↓
Adiciona job na fila (Redis)
    ↓
Worker processa job
    ↓
├─ Baixa imagem/GIF
├─ Processa (Sharp/FFmpeg)
├─ Upload Supabase Storage
├─ Envia sticker OU salva como pendente
└─ Atualiza contador diario
    ↓
Usuario recebe sticker
```

### Limite Atingido

```
Usuario envia 11a imagem
    ↓
Webhook detecta limite atingido
    ↓
Job criado com status='pendente'
    ↓
Worker processa mas NAO envia
    ↓
Salva no banco com status='pendente'
    ↓
Usuario recebe mensagem de limite atingido
    ↓
Dia seguinte as 8h
    ↓
Job send-pending-stickers executa
    ↓
Envia todos os stickers pendentes
    ↓
Atualiza status para 'enviado'
```

---

## 10. Troubleshooting

### Sticker nao processado

```bash
# Verificar se worker esta rodando
ps aux | grep worker

# Verificar logs do worker
npm run dev:worker

# Verificar fila Redis
redis-cli
> LLEN bull:process-sticker:wait
```

### Jobs nao executam

```bash
# Verificar se servidor esta rodando
curl http://localhost:3000/health

# Verificar logs do servidor
npm run dev

# Executar job manualmente (para testar)
# Ver secao 5
```

### Erro de conexao Supabase

```bash
# Verificar variaveis de ambiente
cat .env | grep SUPABASE

# Testar conexao
curl https://seu-projeto.supabase.co
```

### Erro de conexao Redis

```bash
# Verificar se Redis esta rodando
redis-cli ping

# Iniciar Redis (se necessario)
redis-server
```

---

## 11. Proximos Passos

Depois de testar localmente:

1. **Deploy**
   - Railway, Render ou Vercel
   - Configurar variaveis de ambiente
   - Configurar webhook da Evolution API

2. **Monitoramento**
   - Sentry para error tracking
   - Grafana para metricas
   - Uptime monitoring

3. **Melhorias**
   - Bull Board dashboard
   - Rate limiting avancado
   - Cache de stickers

---

## Comandos Rapidos

```bash
# Desenvolvimento
npm run dev              # Servidor
npm run dev:worker       # Worker

# Producao
npm run build           # Build
npm start               # Servidor
npm run start:worker    # Worker

# Testes
npm test               # Executar testes
npm run test:watch     # Modo watch
npm run test:ui        # Interface visual

# Utilitarios
npm run lint           # ESLint
npm run format         # Prettier
```

---

**Pronto! Todas as 4 sprints estao completas e funcionando!**

Para mais detalhes, veja: [SPRINTS-4-7-SUMMARY.md](SPRINTS-4-7-SUMMARY.md)
