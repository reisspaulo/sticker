# Memory Investigation Guide - 94.2% Usage Analysis

**Data:** 2026-01-16
**VPS:** 69.62.100.250 (Contabo - srv1007351)
**Problema:** Memory usage at 94.2% após deploy Phase 1

---

## 🚀 Quick Start - Executar Investigação

```bash
# Na sua máquina local:
ssh root@69.62.100.250 'bash -s' < scripts/investigate-memory.sh
```

**Ou copiar e colar comandos manualmente:**
```bash
ssh root@69.62.100.250
# Depois copie comandos do script
```

---

## 📊 O Que Investigar

### 1. Total Memory Available
**Comando:** `free -h`

**O que verificar:**
- `total`: Quanto RAM a VPS tem (provavelmente 24GB)
- `used`: Quanto está sendo usado (~23GB = 94.2%)
- `available`: Quanto está disponível para novos processos
- `buff/cache`: Quanto está em cache (pode ser liberado)

**Exemplo de análise:**
```
              total        used        free      shared  buff/cache   available
Mem:            24G         23G        500M        100M        800M        1.2G
```
- Se `available` > 1GB → OK (sistema pode liberar cache)
- Se `available` < 500MB → CRÍTICO (risco de OOM)

---

### 2. Docker Containers Memory

**Comando:** `docker stats --no-stream`

**O que verificar:**
```
NAME                 MEM USAGE / LIMIT     MEM %
stickerbot-backend   5GB / 24GB           20.8%
stickerbot-worker    8GB / 24GB           33.3%  ⚠️ ALTO
redis                2GB / 24GB            8.3%
traefik              500MB / 24GB          2.1%
```

**Alertas:**
- Backend > 6GB → Investigar memory leaks
- Worker > 10GB → Investigar BullMQ workers/queues
- Redis > 4GB → Investigar keys acumulados

---

### 3. Node.js Processes

**Comando:** `ps aux | grep node`

**O que verificar:**
- Quantos processos Node.js estão rodando
- RSS (Resident Set Size) de cada processo
- CPU usage de cada processo

**Interpretação:**
```
USER  PID  %CPU  %MEM    VSZ   RSS TTY   STAT START   TIME COMMAND
root  1234  2.0  25.0  8000000 6000000 ? Sl  20:05  0:30 node dist/server.js
root  5678  5.0  35.0 10000000 8000000 ? Sl  20:05  1:15 node dist/worker.js
```
- RSS > 6GB por processo → ALTO
- %MEM > 40% por processo → CRÍTICO

---

### 4. BullMQ Queue Sizes

**Comando:** `docker exec redis redis-cli info memory`

**O que verificar:**
```
used_memory_human: 2.5G
used_memory_peak_human: 3.2G
maxmemory_human: 4.0G
```

**Queue counts:**
```bash
# Ver tamanho de cada fila:
redis-cli llen "bull:process-sticker:wait"
redis-cli llen "bull:welcome-messages:wait"
redis-cli llen "bull:download-twitter-video:wait"
```

**Alertas:**
- Fila > 1000 jobs → Backlog acumulado
- Fila > 5000 jobs → CRÍTICO (pode estar causando memory issue)

---

### 5. Recent Logs - Memory Warnings

**O que procurar nos logs:**
- `JavaScript heap out of memory` → CRÍTICO
- `FATAL ERROR: Reached heap limit` → CRÍTICO
- `Memory usage high` → WARNING
- `GC overhead limit exceeded` → WARNING

---

## 🔍 Possíveis Causas e Soluções

### Causa 1: Node.js Heap Limit Baixo

**Sintomas:**
- Processo Node.js usando ~1-2GB e crashando
- Logs: "JavaScript heap out of memory"

**Solução:**
```bash
# Adicionar ao docker-compose.yml ou deploy script:
NODE_OPTIONS="--max-old-space-size=4096"  # 4GB heap
```

---

### Causa 2: BullMQ Workers com Concurrency Alta

**Sintomas:**
- Worker usando >8GB
- Múltiplos jobs processando simultaneamente

**Workers atuais:**
```typescript
// src/worker.ts
processStickerWorker: concurrency 5
downloadTwitterVideoWorker: concurrency 3
convertTwitterStickerWorker: concurrency 2
welcomeMessagesWorker: concurrency 2  // NOVO - Phase 1
```

**Solução:**
- Reduzir concurrency se worker > 8GB
- Considerar separar workers em containers diferentes

---

### Causa 3: Redis Memory Acumulado

**Sintomas:**
- Redis usando >4GB
- Muitos keys com padrão `bull:*`
- Jobs completados não estão sendo removidos

**Solução:**
```typescript
// Configuração BullMQ para auto-cleanup:
defaultJobOptions: {
  removeOnComplete: true,  // Remove jobs completados
  removeOnFail: { age: 3600 }  // Remove jobs falhados após 1h
}
```

---

### Causa 4: Memory Leak no Código

**Sintomas:**
- Memory usage crescendo continuamente
- Não estabiliza mesmo após garbage collection
- Heap snapshots mostram objetos acumulando

**Como investigar:**
```bash
# Gerar heap snapshot:
docker exec stickerbot-worker kill -USR2 1

# Analisar com Chrome DevTools:
# 1. Download heap snapshot do container
# 2. Abrir Chrome DevTools → Memory → Load snapshot
# 3. Procurar por objetos acumulados
```

---

### Causa 5: Cache de Buffers Grande

**Sintomas:**
- `buff/cache` muito alto (>10GB)
- `available` memory ainda OK (>2GB)

**Interpretação:**
- **NORMAL** - Linux usa memória livre para cache
- Não precisa de ação - sistema libera automaticamente quando necessário

---

## 🎯 Ações Recomendadas por Cenário

### Cenário A: Memory usage alto MAS `available` > 2GB
✅ **NORMAL** - Sistema está usando cache
- Ação: Monitorar por 24h
- Se estabilizar: OK
- Se crescer: Investigar leak

---

### Cenário B: Worker usando >10GB
⚠️ **ATENÇÃO** - Possível issue com concurrency
- Ação imediata:
  1. Reduzir concurrency de workers
  2. Restart worker container
  3. Monitorar memory

```bash
# Restart worker:
docker service update --force stickerbot-worker
```

---

### Cenário C: `available` < 500MB
🚨 **CRÍTICO** - Risco de OOM
- Ação imediata:
  1. Identificar processo que mais consome
  2. Restart containers
  3. Considerar upgrade de RAM

```bash
# Restart all services:
docker service update --force stickerbot-backend
docker service update --force stickerbot-worker
```

---

### Cenário D: Redis >4GB
⚠️ **ATENÇÃO** - Keys acumulados
- Ação:
  1. Verificar quantos keys: `redis-cli dbsize`
  2. Ver padrões: `redis-cli --scan --pattern "bull:*" | head -50`
  3. Limpar jobs antigos

```bash
# Ver keys por padrão:
redis-cli --scan --pattern "bull:*:completed:*" | wc -l
redis-cli --scan --pattern "bull:*:failed:*" | wc -l

# Limpar (CUIDADO):
redis-cli --scan --pattern "bull:*:completed:*" | xargs redis-cli del
```

---

## 📊 Métricas Normais vs Anormais

### ✅ NORMAL (VPS com 24GB RAM):

| Componente | Memory Usage | Status |
|------------|--------------|--------|
| Backend | 2-4GB | ✅ Normal |
| Worker | 4-8GB | ✅ Normal |
| Redis | 1-3GB | ✅ Normal |
| Sistema (cache) | 5-10GB | ✅ Normal |
| **Total usado** | 15-20GB (63-83%) | ✅ Normal |

---

### ⚠️ ATENÇÃO:

| Componente | Memory Usage | Status |
|------------|--------------|--------|
| Backend | 5-6GB | ⚠️ Alto |
| Worker | 8-12GB | ⚠️ Alto |
| Redis | 3-4GB | ⚠️ Alto |
| **Total usado** | 20-23GB (83-95%) | ⚠️ Alto |

---

### 🚨 CRÍTICO:

| Componente | Memory Usage | Status |
|------------|--------------|--------|
| Backend | >6GB | 🚨 Crítico |
| Worker | >12GB | 🚨 Crítico |
| Redis | >4GB | 🚨 Crítico |
| Available | <500MB | 🚨 Crítico |

---

## 🔄 Next Steps

**Depois de executar o script:**
1. Analise os resultados usando este guia
2. Identifique qual cenário (A, B, C ou D)
3. Aplique ação recomendada
4. Monitore por 2-4 horas
5. Se persistir, considerar:
   - Upgrade de RAM (24GB → 32GB ou 48GB)
   - Separar workers em VPS dedicada
   - Otimizar código para reduzir memory footprint

---

## 📞 Suporte

Se após investigação o problema persistir:
1. Compartilhe output do script de investigação
2. Monitore logs por 24h
3. Considere profiling detalhado com heap snapshots
4. Avaliar migração para VPS com mais RAM

---

**Status:** 🔍 Investigação em andamento
**Última atualização:** 2026-01-16 20:10 UTC
