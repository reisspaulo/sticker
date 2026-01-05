# Monitoring, Logs e Observabilidade

Sistema completo de monitoramento e observabilidade para a feature de download de vídeos do Twitter.

## Visão Geral

Este sistema fornece:
- Estatísticas detalhadas de downloads do Twitter
- Health checks abrangentes
- Sistema de alertas automáticos
- Logs estruturados com trace IDs
- Queries analíticas SQL

## Componentes

### 1. Twitter Statistics (`twitterStats.ts`)

Fornece estatísticas completas sobre downloads do Twitter:

**Métricas Disponíveis:**
- Downloads: total, hoje, semana, mês, falhas, pendentes
- Conversões: total, taxa, hoje
- Performance: tempo médio, tamanho médio, taxa de sucesso
- Top Content: autores e tweets mais baixados
- Usuários: total, ativos, top usuários
- Limites: usuários próximos/no limite
- Erros: total, por tipo

**Uso:**
```typescript
import { getTwitterStats } from './services/twitterStats';

const stats = await getTwitterStats();
console.log(stats.downloads.today); // Downloads hoje
console.log(stats.performance.successRate); // Taxa de sucesso
```

### 2. Health Check (`healthCheck.ts`)

Verifica a saúde de todos os serviços:

**Serviços Monitorados:**
- Database (Supabase)
- Redis
- Storage (Supabase Storage)
- VxTwitter API

**Métricas de Sistema:**
- Uptime
- Uso de memória
- Uso de storage
- Espaço disponível

**Status Possíveis:**
- `healthy`: Todos os serviços funcionando
- `degraded`: Serviços lentos ou com alertas
- `unhealthy`: Serviços fora do ar

**Uso:**
```typescript
import { performHealthCheck } from './services/healthCheck';

const health = await performHealthCheck();
console.log(health.status); // healthy | degraded | unhealthy
console.log(health.alerts); // Array de alertas
```

### 3. Alerting (`alerting.ts`)

Sistema de alertas automáticos:

**Tipos de Alertas:**
- `error`: Problemas críticos
- `warning`: Problemas que requerem atenção
- `info`: Informações importantes

**Categorias:**
- `downloads`: Problemas com downloads
- `storage`: Problemas de armazenamento
- `performance`: Problemas de desempenho
- `limits`: Limites atingidos

**Thresholds Configurados:**
- Taxa de falha de downloads: 30%
- Contagem de falhas: 10 em 1 hora
- Rate limit (429): 5 em 15 minutos
- Uso de storage: 80%
- Usuários no limite: 10

**Uso:**
```typescript
import { runAllAlertChecks } from './services/alerting';

const alerts = await runAllAlertChecks();
alerts.forEach(alert => {
  console.log(`[${alert.type}] ${alert.message}`);
});
```

### 4. Enhanced Logger (`enhancedLogger.ts`)

Logger melhorado com trace IDs e contexto estruturado:

**Recursos:**
- Trace IDs únicos para cada operação
- Contexto estruturado (userNumber, tweetId, jobId)
- Níveis de log: info, warn, error, debug
- Formatação pretty em desenvolvimento
- JSON estruturado em produção

**Uso:**
```typescript
import { createTracedLogger, generateTraceId } from './config/enhancedLogger';

const traceId = generateTraceId();
const logger = createTracedLogger({
  traceId,
  userNumber: '5511999999999',
  tweetId: '1234567890',
});

logger.info('Download started');
logger.error({ error }, 'Download failed');
```

## Endpoints da API

### GET /stats
Retorna estatísticas completas do sistema, incluindo Twitter stats.

**Resposta:**
```json
{
  "users": { ... },
  "stickers": { ... },
  "twitter": { ... },
  "twitterEnhanced": {
    "downloads": {
      "total": 1234,
      "today": 56,
      "failed": 12
    },
    "conversions": {
      "total": 890,
      "rate": 72.15
    },
    "performance": {
      "avgDownloadTimeMs": 3500,
      "successRate": 95.5
    }
  }
}
```

### GET /health
Health check completo do sistema.

**Resposta:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "services": {
    "database": {
      "status": "up",
      "responseTime": 45
    },
    "redis": {
      "status": "up",
      "responseTime": 12
    },
    "storage": {
      "status": "up",
      "responseTime": 230
    },
    "vxtwitter": {
      "status": "up",
      "responseTime": 850
    }
  },
  "system": {
    "uptime": 86400,
    "memory": {
      "used": 52428800,
      "total": 134217728,
      "percentage": 39.06
    },
    "storage": {
      "used": 524288000,
      "limit": 1073741824,
      "percentage": 48.83,
      "nearLimit": false
    }
  },
  "alerts": []
}
```

### GET /ping
Health check rápido.

**Resposta:**
```json
{
  "pong": true,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### GET /alerts
Lista todos os alertas ativos.

**Resposta:**
```json
{
  "alerts": [
    {
      "type": "warning",
      "category": "storage",
      "message": "Storage usage is at 85.2%",
      "details": {
        "usedGB": "0.85",
        "limitGB": 1,
        "percentage": "85.2%"
      },
      "timestamp": "2025-01-15T10:30:00.000Z"
    }
  ],
  "count": 1,
  "errors": 0,
  "warnings": 1
}
```

## Script de Health Check

Execute o health check standalone:

```bash
# Instalar tsx se ainda não tiver
npm install -D tsx

# Executar health check
npm run health-check
# ou
tsx scripts/health-check.ts

# Via cron (adicionar ao crontab)
*/5 * * * * cd /path/to/project && tsx scripts/health-check.ts >> /var/log/health-check.log 2>&1
```

**Exit codes:**
- `0`: Sistema saudável
- `1`: Sistema não saudável ou erro
- `2`: Sistema degradado ou alertas de erro

## Queries Analytics

### Views Disponíveis

**`twitter_downloads_daily`**
Downloads agregados por dia.

```sql
SELECT * FROM twitter_downloads_daily
ORDER BY download_date DESC
LIMIT 30;
```

**`top_twitter_authors`**
Autores mais baixados com taxa de conversão.

```sql
SELECT * FROM top_twitter_authors
LIMIT 20;
```

**`user_twitter_activity`**
Atividade de download por usuário.

```sql
SELECT * FROM user_twitter_activity
WHERE total_downloads > 0
ORDER BY total_downloads DESC;
```

**`twitter_errors_by_type`**
Erros agrupados por tipo e data.

```sql
SELECT * FROM twitter_errors_by_type
WHERE error_date >= CURRENT_DATE - INTERVAL '7 days';
```

### Queries Úteis

Ver arquivo `scripts/analytics.sql` para queries completas de:
- Downloads por hora do dia
- Tendências semanais
- Funil de conversão
- Retenção de usuários
- Performance ao longo do tempo

## Logs Estruturados

Todos os logs incluem contexto estruturado:

```json
{
  "level": "INFO",
  "time": "2025-01-15T10:30:00.000Z",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "userNumber": "5511999999999",
  "tweetId": "1234567890",
  "msg": "Twitter video downloaded successfully in 3500ms",
  "event": "twitter_download_completed",
  "fileSize": 5242880,
  "downloadTimeMs": 3500,
  "fileSizeMB": "5.00"
}
```

**Campos Comuns:**
- `traceId`: ID único para rastreamento
- `userNumber`: Número do WhatsApp do usuário
- `tweetId`: ID do tweet
- `jobId`: ID do job (BullMQ)
- `event`: Tipo de evento
- `msg`: Mensagem legível

## Métricas Monitoradas

### Downloads
- Total de downloads (all-time, hoje, semana, mês)
- Taxa de sucesso
- Taxa de falha
- Tempo médio de download
- Tamanho médio de arquivo
- Downloads pendentes

### Conversões
- Total de conversões para sticker
- Taxa de conversão (downloads → stickers)
- Conversões hoje
- Tempo médio de conversão

### Performance
- Tempo médio de download (ms)
- Tempo médio de conversão (ms)
- P95 tempo de download
- Taxa de sucesso geral

### Usuários
- Total de usuários que usaram feature
- Usuários ativos hoje
- Usuários próximos do limite (8-10 downloads)
- Usuários no limite (10 downloads)
- Top usuários por downloads

### Erros
- Total de erros
- Erros hoje
- Erros por tipo
- Rate limits (429) detectados
- Downloads lentos (>30s)

### Storage
- Espaço usado
- Espaço disponível
- Percentual de uso
- Alertas de limite próximo (>80%)

## Alertas Automáticos

### Configuração de Thresholds

Edite `src/services/alerting.ts` para ajustar:

```typescript
const ALERT_THRESHOLDS = {
  DOWNLOAD_FAILURE_RATE: 0.3,      // 30%
  DOWNLOAD_FAILURE_COUNT: 10,      // 10 falhas
  RATE_LIMIT_429_COUNT: 5,         // 5 rate limits
  STORAGE_USAGE: 80,               // 80%
  USERS_AT_LIMIT: 10,              // 10 usuários
  HIGH_ERROR_RATE: 0.2,            // 20%
};
```

### Integração com Cron

Adicione ao crontab para verificações periódicas:

```bash
# Verificar alertas a cada 15 minutos
*/15 * * * * curl -s http://localhost:3000/alerts | jq '.alerts[] | select(.type=="error")'

# Health check a cada 5 minutos
*/5 * * * * tsx /path/to/scripts/health-check.ts
```

## Boas Práticas

### 1. Logs
- Sempre use trace IDs para operações relacionadas
- Inclua contexto relevante (userNumber, tweetId, jobId)
- Use níveis apropriados (info, warn, error, debug)
- Evite logs excessivos em produção

### 2. Métricas
- Monitore tendências, não apenas valores absolutos
- Configure alertas baseados em thresholds razoáveis
- Revise thresholds periodicamente

### 3. Alertas
- Evite "alert fatigue" - configure thresholds realistas
- Priorize alertas críticos (errors) sobre warnings
- Documente ações para cada tipo de alerta

### 4. Performance
- Use queries paralelas quando possível
- Cache estatísticas quando apropriado
- Limite tamanho de dados retornados

## Troubleshooting

### High Download Failure Rate
1. Verificar logs de erro: `twitter_errors_by_type`
2. Verificar status VxTwitter API
3. Verificar rate limits (429)
4. Verificar conectividade de rede

### Storage Near Limit
1. Executar cleanup de downloads antigos
2. Verificar arquivos órfãos
3. Considerar upgrade de plano Supabase

### Slow Performance
1. Verificar logs de performance
2. Verificar carga do sistema (CPU, memória)
3. Verificar latência de rede
4. Verificar VxTwitter API response time

### High Error Rate
1. Verificar logs estruturados
2. Identificar padrão de erros (por tipo, usuário, tempo)
3. Verificar health checks
4. Revisar alertas ativos

## Roadmap

Melhorias futuras:
- [ ] Dashboard web para visualização de métricas
- [ ] Integração com Grafana/Prometheus
- [ ] Alertas via Slack/Discord/Email
- [ ] Métricas de business intelligence
- [ ] Machine learning para detecção de anomalias
- [ ] Auto-scaling baseado em métricas

## Suporte

Para questões ou problemas:
1. Verifique os logs estruturados
2. Execute health check
3. Verifique alertas ativos
4. Consulte queries analytics para insights
