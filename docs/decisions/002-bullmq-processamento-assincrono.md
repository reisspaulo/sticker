# ADR 002: BullMQ para Processamento Assíncrono

## Status
✅ **Aceito** (2025-12)

## Contexto

O bot precisa processar tarefas pesadas que não podem bloquear o webhook:
- Conversão imagem → sticker (Sharp: 1-3s)
- Conversão GIF → sticker animado (FFmpeg: 3-10s)
- Download vídeos Twitter (5-30s)
- Remoção de fundo com IA (rembg: 10-30s)
- Envio de stickers pendentes (batch às 8h)

Responder webhook em <3s é crítico para não perder mensagens do WhatsApp.

## Decisão

Usaremos **BullMQ** como sistema de filas para processamento assíncrono, com **Redis** como broker.

### Arquitetura
```
Webhook (Fastify)
    ↓ <3s
Responde 200 OK
    ↓
Adiciona job na fila
    ↓
Worker processa
    ↓
Envia resultado ao usuário
```

### Filas Criadas
1. **process-sticker** (concurrency: 5) - Criação de stickers
2. **download-twitter-video** (concurrency: 3) - Download Twitter
3. **convert-twitter-sticker** (concurrency: 2) - Conversão Twitter
4. **cleanup-sticker** (concurrency: 2) - Edição (rembg)
5. **edit-buttons** (concurrency: 5, debounce: 10s) - Envio de botões
6. **activate-pix-subscription** (concurrency: 2, delay: 5min) - Ativação PIX
7. **scheduled-jobs** (concurrency: 1) - Jobs agendados (8h)

## Justificativa

**Por que BullMQ?**
- ✅ Performance: Baseado em Redis (rápido)
- ✅ Confiabilidade: Retry automático com backoff
- ✅ Observabilidade: Integra com Bull Board
- ✅ Priorização: Filas prioritárias
- ✅ Delayed jobs: PIX ativa em 5min, stickers às 8h
- ✅ Concurrency: Processa múltiplos jobs simultaneamente
- ✅ TypeScript nativo

**Por que não alternativas?**

| Alternativa | Por que não? |
|-------------|--------------|
| **Bee-Queue** | Menos features, sem delayed jobs |
| **Bull (v3)** | Deprecated, migrado para BullMQ |
| **Agenda** | Baseado em MongoDB (mais lento) |
| **AWS SQS** | Vendor lock-in, custo, latência |
| **RabbitMQ** | Overhead de infra, complexo |
| **Síncrono** | Timeout no webhook, perda de msgs |

## Consequências

### Positivas
- ✅ Webhook responde rápido (<3s)
- ✅ Processamento paralelo (múltiplos workers)
- ✅ Retry automático em falhas
- ✅ Jobs agendados (8h, 5min)
- ✅ Não perde jobs (persistidos no Redis)
- ✅ Escalável (adiciona mais workers)

### Negativas
- ⚠️ Dependência do Redis (single point of failure)
- ⚠️ Complexidade: Código split entre webhook e workers
- ⚠️ Debug mais difícil (assíncrono)

### Mitigações
- 🔧 Redis com AOF persistence (não perde jobs)
- 🔧 Logging detalhado em cada etapa
- 🔧 Bull Board para observabilidade

## Implementação

### Estrutura de Arquivos
```
src/
├── config/
│   ├── queue.ts          # Definição das 7 filas
│   └── redis.ts          # Conexão Redis
├── server.ts             # API (adiciona jobs)
└── worker.ts             # Processa jobs (separado!)
```

### Configuração Padrão
```typescript
{
  attempts: 2,              // Tenta 2x
  backoff: {
    type: 'exponential',    // 1s, 2s, 4s...
    delay: 5000
  },
  removeOnComplete: 100,    // Keep last 100
  removeOnFail: 500         // Keep last 500 failures
}
```

### Deployment
- **Produção**: 2 processos separados
  - `npm run start` (server - webhook)
  - `npm run start:worker` (worker - processa jobs)

## Métricas de Sucesso

Após 1 mês de uso:
- ✅ Webhook responde em <1s (média)
- ✅ 99.5% dos stickers processados com sucesso
- ✅ 0 mensagens perdidas por timeout
- ✅ Workers processam 1000+ jobs/dia

## Alternativas Consideradas

### 1. Processamento Síncrono
- **Prós**: Simples
- **Contras**: Timeout webhook, perde mensagens
- **Decisão**: Rejeitado - inviável

### 2. AWS Lambda + SQS
- **Prós**: Serverless, escalável
- **Contras**: Vendor lock-in, custo, latência
- **Decisão**: Rejeitado - overhead desnecessário

### 3. RabbitMQ
- **Prós**: Robusto, enterprise-grade
- **Contras**: Complexo, overhead de infra
- **Decisão**: Rejeitado - overkill para o caso

### 4. Agenda (MongoDB)
- **Prós**: Jobs agendados nativos
- **Contras**: Mais lento que Redis
- **Decisão**: Rejeitado - performance

## Referências
- BullMQ Docs: https://docs.bullmq.io
- Bull Board: https://github.com/felixmosh/bull-board
- Redis AOF: https://redis.io/docs/management/persistence/

## Revisão
Próxima revisão: 2026-06 (avaliar migração para Bull v5 se lançado)
