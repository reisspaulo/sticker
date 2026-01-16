# Sprint 20: Proteção Anti-Spam (Ban WhatsApp Recovery)

## PRD - Product Requirements Document

**Data:** 2026-01-16
**Status:** ✅ Implementado
**Prioridade:** 🚨 CRÍTICA (Ban temporário do WhatsApp)

---

## 1. Visão Geral

### 1.1 Contexto

**PROBLEMA CRÍTICO:** Em 16/01/2026, o WhatsApp baniu temporariamente nossa conta por suspeita de disparo em massa.

#### Causa Raiz Identificada:
1. **Loop infinito de retentativas**: 26,388 `step_failed` events em 24h para apenas 38 usuários (~700 tentativas/usuário)
2. **Rate limiting muito agressivo**: 200ms entre mensagens = 5 msgs/segundo
3. **Sem cooling-off**: Usuários recém-criados recebiam campanhas imediatamente
4. **Sem backoff exponencial**: Sistema tentava reenviar a cada 30-60 segundos após falha

### 1.2 Solução Implementada

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     PROTEÇÃO ANTI-SPAM (4 CAMADAS)                        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  CAMADA 1: BACKOFF EXPONENCIAL + LIMITE DE RETENTATIVAS                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  Retry 0: Imediato                                                 │  │
│  │  Retry 1: Aguarda  5 minutos                                       │  │
│  │  Retry 2: Aguarda 15 minutos                                       │  │
│  │  Retry 3: Aguarda  1 hora                                          │  │
│  │  Retry 4: Aguarda  4 horas                                         │  │
│  │  Retry 5: FAILED_PERMANENT (não tenta mais)                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  CAMADA 2: RATE LIMITING CONSERVADOR                                      │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  • Delay entre mensagens: 3000ms (era 200ms)                       │  │
│  │  • Batch size: 15 mensagens (era 50)                               │  │
│  │  • Randomização: 90 minutos (reduz padrões)                        │  │
│  │  • Resultado: ~5 msgs/minuto (era ~300 msgs/minuto)                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  CAMADA 3: COOLING-OFF PERIOD                                             │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  • Usuários novos (< 24h): NÃO recebem campanhas                   │  │
│  │  • Exceção: Campanhas marcadas como is_instant=true                │  │
│  │  • Previne: Envio massivo para usuários recém-criados              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  CAMADA 4: AUTO-PAUSE DE CAMPANHAS                                        │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  • Monitor: Taxa de falha das últimas 24h                          │  │
│  │  • Threshold: >50% de falha                                        │  │
│  │  • Ação: Pausa campanha automaticamente                            │  │
│  │  • Notificação: Log de warn + alerta no admin panel                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Diagnóstico do Problema

### 2.1 Análise dos Logs

#### Eventos de Campanha (Últimas 24h antes do ban)
```sql
SELECT
    event_type,
    COUNT(*) as total
FROM campaign_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY total DESC;
```

**Resultado:**
| Event Type | Total |
|------------|-------|
| step_failed | 26,388 |
| step_sent | 2,412 |
| enrolled | 38 |

**Análise:**
- **26,388 falhas** para apenas **38 usuários** = ~700 tentativas por usuário
- Sistema ficou em loop de retry sem backoff
- WhatsApp identificou como comportamento de bot/spam

#### Timeline do Problema
```
2026-01-15 00:00 - Campanhas ativas começam a enviar
2026-01-15 02:30 - Primeiras falhas (números inválidos)
2026-01-15 02:31 - Sistema tenta reenviar (30s depois)
2026-01-15 02:32 - Sistema tenta reenviar (30s depois)
                   ... [loop infinito] ...
2026-01-16 14:30 - WhatsApp aplica ban temporário
```

### 2.2 Configurações Problemáticas (ANTES)

```typescript
// worker.ts (ANTES)
const result = await processPendingCampaignMessages(20, 1000);
// 20 msgs/batch × 1s delay = ~1200 msgs/hora

// campaign.settings (ANTES)
{
  "rate_limit_ms": 200,     // 5 msgs/segundo
  "batch_size": 50,         // 50 msgs por lote
  "randomize_minutes": 30   // pouca randomização
}
```

**Problemas:**
1. Rate limit permitia 300+ msgs/minuto em picos
2. Sem backoff após falhas
3. Sem cooling-off para novos usuários
4. Sem limite de retentativas

---

## 3. Implementação

### 3.1 Migrações do Banco de Dados

#### Migration 1: Adicionar Colunas de Retry
```sql
-- deploy/migrations/20260116_campaign_anti_spam_protection.sql
ALTER TABLE user_campaigns
ADD COLUMN retry_count INT DEFAULT 0,
ADD COLUMN last_retry_at TIMESTAMPTZ,
ADD COLUMN last_error TEXT;

CREATE INDEX idx_user_campaigns_retry
ON user_campaigns(retry_count, last_retry_at)
WHERE status IN ('pending', 'active');
```

#### Migration 2: Update get_pending_campaign_messages (v2)
```sql
-- Implementa backoff exponencial e cooling-off
CREATE OR REPLACE FUNCTION get_pending_campaign_messages(p_limit INT DEFAULT 15)
RETURNS TABLE (...)
AS $$
DECLARE
    v_max_retries INT := 5;
    v_cooling_off_hours INT := 24;
BEGIN
    -- Filtra por:
    -- 1. Retry count < 5
    -- 2. User created_at > 24h (ou is_instant=true)
    -- 3. Backoff exponencial baseado em retry_count
    ...
END;
$$;
```

#### Migration 3: Update advance_campaign_step
```sql
-- Incrementa retry_count e registra last_error
CREATE OR REPLACE FUNCTION advance_campaign_step(...)
AS $$
BEGIN
    IF p_success THEN
        -- Reset retry count on success
        UPDATE user_campaigns SET retry_count = 0 ...
    ELSE
        -- Increment retry count
        UPDATE user_campaigns
        SET retry_count = COALESCE(retry_count, 0) + 1,
            last_retry_at = NOW(),
            last_error = (p_metadata->>'error')::TEXT
        ...
    END IF;
END;
$$;
```

#### Migration 4: Update Campaign Settings
```sql
UPDATE campaigns
SET settings = jsonb_set(
    jsonb_set(
        jsonb_set(settings, '{rate_limit_ms}', '3000'),
        '{batch_size}', '15'
    ),
    '{randomize_minutes}', '90'
)
WHERE settings IS NOT NULL;
```

#### Migration 5: Update enroll_user_in_campaign
```sql
-- Adiciona verificação de cooling-off
CREATE OR REPLACE FUNCTION enroll_user_in_campaign(...)
AS $$
DECLARE
    v_cooling_off_hours INT := 24;
    v_user_created_at TIMESTAMPTZ;
    v_is_instant BOOLEAN;
BEGIN
    -- Check if user is in cooling-off period
    SELECT created_at INTO v_user_created_at
    FROM users WHERE id = p_user_id;

    SELECT (settings->>'is_instant')::BOOLEAN INTO v_is_instant
    FROM campaigns WHERE name = p_campaign_name;

    IF v_user_created_at > NOW() - (v_cooling_off_hours || ' hours')::INTERVAL
       AND NOT COALESCE(v_is_instant, false) THEN
        RETURN NULL; -- Skip enrollment
    END IF;
    ...
END;
$$;
```

#### Migration 6: Health Monitoring
```sql
-- View para monitorar saúde das campanhas
CREATE VIEW campaign_health_stats AS
SELECT
    c.name as campaign_name,
    COUNT(*) FILTER (WHERE ce.event_type = 'step_sent') as sent_count,
    COUNT(*) FILTER (WHERE ce.event_type = 'step_failed') as failed_count,
    ROUND(
        COUNT(*) FILTER (WHERE ce.event_type = 'step_failed')::NUMERIC /
        NULLIF(COUNT(*), 0) * 100,
        2
    ) as failure_rate
FROM campaigns c
LEFT JOIN campaign_events ce ON ce.campaign_name = c.name
    AND ce.created_at > NOW() - INTERVAL '24 hours'
GROUP BY c.id, c.name;

-- Função que pausa automaticamente campanhas com >50% falha
CREATE OR REPLACE FUNCTION check_campaign_health_and_auto_pause()
RETURNS TABLE (
    campaign_name VARCHAR(100),
    was_paused BOOLEAN,
    failure_rate NUMERIC,
    reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH unhealthy AS (
        SELECT
            chs.campaign_name,
            chs.failure_rate,
            'High failure rate: ' || chs.failure_rate || '% in last 24h' as reason
        FROM campaign_health_stats chs
        JOIN campaigns c ON c.name = chs.campaign_name
        WHERE c.status = 'active'
          AND chs.sent_count + chs.failed_count >= 10  -- Mínimo de eventos
          AND chs.failure_rate > 50  -- >50% de falha
    )
    UPDATE campaigns c
    SET status = 'paused',
        updated_at = NOW()
    FROM unhealthy u
    WHERE c.name = u.campaign_name
    RETURNING u.campaign_name, true as was_paused, u.failure_rate, u.reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.2 Código TypeScript

#### campaignService.ts
```typescript
/**
 * Busca e processa mensagens pendentes de campanha
 *
 * ANTI-SPAM PROTECTION (16/01/2026):
 * - Rate limit aumentado para 3s entre mensagens
 * - Batch size reduzido para 15
 * - Backoff exponencial implementado no banco
 * - Limite de 5 retentativas antes de failed_permanent
 * - Cooling-off de 24h para usuários novos
 */
export async function processPendingCampaignMessages(
  limit: number = 15,        // Era 50
  rateLimitMs: number = 3000 // Era 200
): Promise<{ sent: number; failed: number; total: number }> {
  // ... implementação
}

/**
 * Verifica saúde das campanhas e pausa automaticamente
 * ANTI-SPAM: Implementado após ban do WhatsApp
 */
export async function checkCampaignHealthAndAutoPause(): Promise<CampaignHealthResult[]> {
  try {
    const results = await rpcAll('check_campaign_health_and_auto_pause', {});

    if (results && results.length > 0) {
      for (const result of results) {
        logger.warn({
          msg: '[CAMPAIGN] Campaign auto-paused due to high failure rate',
          campaignName: result.campaign_name,
          failureRate: result.failure_rate,
          reason: result.reason,
        });
      }
    }

    return results || [];
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN] Error checking campaign health',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}
```

#### worker.ts
```typescript
// Job: process-campaigns
{
  // 1. Revert stuck campaigns
  const reverted = await revertStuckProcessing(10);

  // 2. Check cancel conditions
  const cancelled = await checkCancelConditions();

  // 2.5. ANTI-SPAM: Auto-pause unhealthy campaigns
  const autoPaused = await checkCampaignHealthAndAutoPause();
  if (autoPaused.length > 0) {
    logger.warn({
      msg: '[CAMPAIGN-JOB] Auto-paused campaigns due to high failure rate',
      campaigns: autoPaused,
    });
  }

  // 3. Process pending messages (ANTI-SPAM: conservative rate limiting)
  // batch: 15 msgs max, delay: 3000ms between each = ~5 msgs/min
  // + backoff exponencial no banco (5min, 15min, 1h, 4h)
  // + cooling-off de 24h para usuários novos
  // + limite de 5 retentativas antes de failed_permanent
  const result = await processPendingCampaignMessages(15, 3000);

  logger.info({
    msg: '[SCHEDULED-JOB] process-campaigns completed',
    jobId: job.id,
    reverted,
    cancelled,
    sent: result.sent,
    failed: result.failed,
    total: result.total,
  });
}
```

#### rpc/types.ts
```typescript
export interface CampaignHealthResult {
  campaign_name: string;
  was_paused: boolean;
  failure_rate: number;
  reason: string;
}
```

#### rpc/registry.ts
```typescript
/**
 * Verifica saúde das campanhas e pausa automaticamente as com >50% de falha
 * ANTI-SPAM: Implementado em 16/01/2026 após ban do WhatsApp
 * @returns Array de campanhas que foram pausadas
 */
check_campaign_health_and_auto_pause: {
  type: 'table' as const,
  params: {} as Record<string, never>,
  returns: {} as CampaignHealthResult,
},
```

---

## 4. Comparação: Antes vs Depois

### 4.1 Rate Limiting

| Métrica | ANTES | DEPOIS | Melhoria |
|---------|-------|--------|----------|
| Delay entre msgs | 200ms | 3000ms | **15x mais lento** |
| Batch size | 50 | 15 | **3.3x menor** |
| Msgs/minuto (teórico) | 300 | 5 | **60x mais conservador** |
| Msgs/hora (teórico) | 18,000 | 300 | **60x mais conservador** |
| Randomização | 30min | 90min | **3x mais variação** |

### 4.2 Retry Logic

| Comportamento | ANTES | DEPOIS |
|---------------|-------|--------|
| Retry imediato | ✅ Sim | ✅ Sim (1ª vez) |
| Backoff após falha | ❌ Não | ✅ Sim (exponencial) |
| Limite de retries | ❌ Infinito | ✅ 5 tentativas |
| Estado final | ❌ Loop infinito | ✅ failed_permanent |
| Tempo total de retry | ∞ | ~5h 20min |

**Timeline de Retry (DEPOIS):**
```
Tentativa 0: Imediato
Tentativa 1: +5min     = 00:05
Tentativa 2: +15min    = 00:20
Tentativa 3: +1h       = 01:20
Tentativa 4: +4h       = 05:20
Status: failed_permanent
```

### 4.3 Proteção para Novos Usuários

| Cenário | ANTES | DEPOIS |
|---------|-------|--------|
| Usuário criado há 1h | ✅ Recebe campanha | ❌ Aguarda 24h |
| Usuário criado há 6h | ✅ Recebe campanha | ❌ Aguarda 24h |
| Usuário criado há 25h | ✅ Recebe campanha | ✅ Recebe campanha |
| Campanha instant (limit_reached) | ✅ Recebe | ✅ Recebe (exceção) |

### 4.4 Auto-Pause de Campanhas

| Métrica | ANTES | DEPOIS |
|---------|-------|--------|
| Monitor de saúde | ❌ Não | ✅ Sim |
| Threshold | - | >50% falha em 24h |
| Ação automática | ❌ Não | ✅ Pausa campanha |
| Notificação | ❌ Não | ✅ Log + Admin |
| Mínimo de eventos | - | 10 eventos |

---

## 5. Impacto Esperado

### 5.1 Volume de Mensagens (Estimativa)

**Cenário: 100 usuários ativos**

| Período | ANTES | DEPOIS | Redução |
|---------|-------|--------|---------|
| Primeira hora | 300 msgs | 60 msgs | **80%** |
| Primeiras 24h | 7,200 msgs | 300 msgs | **96%** |
| Com retries (falhas) | ∞ msgs | Máx 500 msgs | **Cap aplicado** |

### 5.2 Comportamento com Falhas

**Cenário: 20% de números inválidos em 100 usuários**

| Métrica | ANTES | DEPOIS |
|---------|-------|--------|
| Usuários com número válido | 80 | 80 |
| Usuários com número inválido | 20 | 20 |
| Tentativas totais (válidos) | 80 | 80 |
| Tentativas totais (inválidos) | ∞ (loop) | 100 (5 × 20) |
| **Total de mensagens** | **∞** | **180** |

### 5.3 Redução de Carga no WhatsApp

```
┌─────────────────────────────────────────────────────────────┐
│               VOLUME DE MENSAGENS (24h)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ANTES (com retry infinito):                                │
│  ████████████████████████████████████████████ 26,388 msgs   │
│                                                              │
│  DEPOIS (com proteção):                                     │
│  ██ 300 msgs (estimativa conservadora)                      │
│                                                              │
│  Redução: ~99% no volume de mensagens                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Próximos Passos e TODOs

### 6.1 Monitoramento (CRÍTICO) 🚨

- [ ] **Criar dashboard no Admin Panel para Campaign Health**
  - Exibir taxa de falha em tempo real
  - Alertas visuais para campanhas em risco (>30% falha)
  - Histórico de auto-pauses
  - Gráfico de volume de envios por hora

- [ ] **Alertas proativos**
  - Email/Slack quando campanha for auto-pausada
  - Notificação quando taxa de falha > 30%
  - Daily report com métricas de saúde

- [ ] **Logs estruturados para análise**
  - Registrar todos os eventos de retry
  - Logs de cooling-off (usuários bloqueados)
  - Logs de rate limiting (delays aplicados)

### 6.2 Validação de Números (ALTA PRIORIDADE) 🔴

**PROBLEMA:** 20%+ dos números na base são inválidos, causando falhas recorrentes

- [ ] **Implementar validação de número no cadastro**
  ```typescript
  // Validar formato antes de salvar
  function isValidBrazilianPhone(number: string): boolean {
    // DDI 55 + DDD (2 dígitos) + Número (8-9 dígitos)
    const regex = /^55\d{10,11}$/;
    return regex.test(number);
  }
  ```

- [ ] **Marcar números inválidos permanentemente**
  ```sql
  ALTER TABLE users ADD COLUMN phone_status VARCHAR(20) DEFAULT 'active';
  -- Valores: 'active', 'invalid', 'blocked', 'unsubscribed'

  -- Após 3 falhas consecutivas, marcar como invalid
  UPDATE users SET phone_status = 'invalid'
  WHERE whatsapp_number IN (
    SELECT user_number FROM campaign_events
    WHERE event_type = 'step_failed'
      AND metadata->>'error' ILIKE '%could not validate%'
    GROUP BY user_number
    HAVING COUNT(*) >= 3
  );
  ```

- [ ] **Filtrar números inválidos nas campanhas**
  ```sql
  -- Atualizar get_pending_campaign_messages
  WHERE u.phone_status = 'active'  -- Adicionar este filtro
  ```

### 6.3 Whitelist de Números de Teste (MÉDIA PRIORIDADE) 🟡

- [ ] **Criar tabela de números de teste**
  ```sql
  CREATE TABLE test_phone_numbers (
    phone_number TEXT PRIMARY KEY,
    description TEXT,
    bypass_rate_limit BOOLEAN DEFAULT false,
    bypass_cooling_off BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Adicionar números do time
  INSERT INTO test_phone_numbers (phone_number, description, bypass_rate_limit)
  VALUES
    ('5511999999999', 'Paulo - Desenvolvedor', true),
    ('5511888888888', 'Teste 1', false);
  ```

- [ ] **Modificar lógica de envio para bypassar limites em teste**
  ```typescript
  const isTestNumber = await isTestPhoneNumber(userNumber);
  if (isTestNumber) {
    // Bypass cooling-off e rate limiting
    await sendImmediately(userNumber, message);
  }
  ```

### 6.4 Melhorias de UX (BAIXA PRIORIDADE) 🟢

- [ ] **Feedback visual de envio para admins**
  - Barra de progresso no Admin Panel
  - "Enviando mensagem X de Y (aguardando 3s...)"
  - ETA de conclusão da campanha

- [ ] **Simulador de campanha (dry-run)**
  - Calcular quantas mensagens serão enviadas
  - Mostrar tempo estimado de conclusão
  - Identificar números potencialmente inválidos antes de enviar

- [ ] **Histórico de retries no Admin**
  - Ver tentativas de envio por usuário
  - Timeline de retries com timestamps
  - Motivo de cada falha

### 6.5 Otimizações Futuras (BACKLOG) 📋

- [ ] **Queue prioritization**
  - Priorizar usuários com maior engajamento
  - Enviar primeiro para usuários "quentes" (última interação < 7d)

- [ ] **Smart retry timing**
  - Backoff inteligente baseado no tipo de erro
  - Erro de número inválido: não retry (marcar como invalid)
  - Erro de rate limit do WhatsApp: retry após 1h
  - Erro temporário de rede: retry após 5min

- [ ] **A/B testing de timings**
  - Testar diferentes configurações de rate limiting
  - Medir taxa de entrega vs tempo de envio
  - Encontrar sweet spot entre velocidade e segurança

- [ ] **Integração com WhatsApp Business API oficial**
  - Avaliar migração para API oficial (se viável)
  - Maior confiabilidade e menos risco de ban
  - Custo-benefício vs Evolution API

---

## 7. Métricas de Sucesso

### 7.1 KPIs Principais

| Métrica | Meta | Como Medir |
|---------|------|------------|
| Taxa de ban | 0% | Nenhum ban em 30 dias |
| Taxa de falha | <10% | `campaign_health_stats.failure_rate` |
| Tempo médio de retry | <6h | Média de `last_retry_at - created_at` |
| Números inválidos | <5% | % de `phone_status = 'invalid'` |
| Campanhas auto-pausadas | <1/semana | Count de pausas automáticas |

### 7.2 Queries de Monitoramento

```sql
-- 1. Taxa de falha das últimas 24h
SELECT
    campaign_name,
    failure_rate,
    sent_count,
    failed_count
FROM campaign_health_stats
ORDER BY failure_rate DESC;

-- 2. Distribuição de retry counts
SELECT
    retry_count,
    COUNT(*) as user_campaigns,
    ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - last_retry_at))/3600), 2) as avg_hours_since_last_retry
FROM user_campaigns
WHERE retry_count > 0
GROUP BY retry_count
ORDER BY retry_count;

-- 3. Usuários em cooling-off period
SELECT
    COUNT(*) as users_in_cooling_off
FROM users
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 4. Top erros de envio
SELECT
    last_error,
    COUNT(*) as occurrences
FROM user_campaigns
WHERE last_error IS NOT NULL
GROUP BY last_error
ORDER BY occurrences DESC
LIMIT 10;

-- 5. Volume de envios por hora (últimas 24h)
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as messages_sent
FROM campaign_events
WHERE event_type = 'step_sent'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

---

## 8. Lições Aprendidas

### 8.1 O Que Deu Errado ❌

1. **Falta de backoff exponencial**
   - Retry imediato após falha causa loop infinito
   - WhatsApp identifica padrão de bot

2. **Rate limiting muito agressivo**
   - 200ms entre mensagens = 5 msgs/segundo
   - Picos de 300+ msgs/minuto
   - Parece spam mesmo com delay

3. **Sem validação de números**
   - 20%+ de números inválidos na base
   - Causa tentativas desnecessárias
   - Aumenta artificialmente o volume

4. **Falta de monitoramento proativo**
   - Não percebemos o loop de retries
   - Descobrimos apenas após o ban
   - Logs não estavam sendo analisados

### 8.2 O Que Fizemos Certo ✅

1. **Diagnóstico rápido**
   - Identificamos causa raiz em <2h
   - Análise completa do banco de dados
   - Timeline clara do problema

2. **Fix abrangente em 1 sprint**
   - 4 camadas de proteção implementadas
   - Todas as migrações aplicadas
   - Código deployado em produção

3. **Documentação detalhada**
   - Este documento para referência futura
   - Comparação antes/depois
   - TODOs priorizados

4. **Ação imediata**
   - Pausamos todas as campanhas
   - Cancelamos user_campaigns travados
   - Evitamos piorar a situação

### 8.3 Recomendações para Futuro 📚

1. **SEMPRE implemente backoff exponencial** em sistemas de retry
2. **SEMPRE valide inputs** antes de processar (números de telefone, emails, etc)
3. **SEMPRE monitore taxas de falha** e configure alertas
4. **SEMPRE teste com números reais** antes de enviar para base completa
5. **SEMPRE tenha um kill switch** para pausar tudo rapidamente
6. **SEMPRE documente incidents** para aprendizado do time

---

## 9. Referências

### 9.1 Documentos Relacionados
- [QUICK-CHANGES-GUIDE.md](../operations/QUICK-CHANGES-GUIDE.md) - Como acessar VPS e verificar logs
- [CI-CD-WORKFLOW.md](../setup/CI-CD-WORKFLOW.md) - Deploy automático via GitHub Actions
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) - Arquitetura do sistema de campanhas

### 9.2 Commits Relevantes
- `040b9ef` - feat: implement anti-spam protection for campaigns (HOTFIX)
- Migrations aplicadas via Supabase MCP em 16/01/2026

### 9.3 Recursos Externos
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy) - Políticas de uso do WhatsApp
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques) - Estratégias de rate limiting
- [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) - AWS sobre backoff

---

**Status:** ✅ Implementado e em produção
**Deploy:** 2026-01-16 18:18 UTC (via CI/CD)
**Próxima revisão:** 2026-01-23 (7 dias após implementação)
