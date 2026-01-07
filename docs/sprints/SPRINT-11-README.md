# Sprint 11 - Twitter Download: Limites, Logging e Testes

## Objetivo
Adicionar limites diários, logging completo e testes para a funcionalidade de download de vídeos do Twitter.

## Status: CONCLUÍDO

## Arquivos Criados

### 1. `/src/services/twitterLimits.ts`
Serviço de gerenciamento de limites diários do Twitter.

**Funcionalidades:**
- `checkTwitterDailyLimit(userId)` - Verifica se usuário atingiu limite
- `getTwitterDownloadCount(userId)` - Obtém contagem atual
- `incrementTwitterDownloadCount(userId)` - Incrementa contador
- `getRemainingTwitterDownloads(userId)` - Retorna downloads restantes
- `getTwitterDailyLimit()` - Retorna constante de limite (10)

**Características:**
- Limite separado do limite de stickers
- 10 downloads por dia por usuário
- Logging estruturado com Pino
- Tratamento de erros robusto

### 2. `/tests/twitter.test.ts`
Testes unitários para módulos do Twitter.

**Cobertura:**
- `urlDetector`: Detecção e validação de URLs do Twitter
- `extractTweetInfo`: Extração de username e tweet ID
- `isTwitterUrl`: Validação de URLs
- Placeholders para testes de integração (aguardando Sprints 8-10)

**Casos de teste:**
- URLs twitter.com e x.com
- Protocolos http/https
- Subdomínio www
- Usernames com underscore
- Validação de entrada inválida
- Múltiplas URLs no texto

### 3. `/tests/integration/twitter-flow.test.ts`
Teste de integração do fluxo completo (estrutura preparada).

**Fluxo testado:**
1. Webhook recebe URL do Twitter
2. URL é detectada e validada
3. Contexto de usuário é criado
4. Bot pergunta sobre conversão
5. Resposta do usuário é detectada
6. Vídeo é baixado
7. Conversão (se solicitada)
8. Arquivo é enviado
9. Logs são criados
10. Contador é incrementado

**Testes preparados:**
- Detecção de URL
- Criação de contexto
- Pergunta de conversão
- Detecção de respostas (sim/não)
- Download sem conversão
- Download com conversão
- Limite diário
- Separação de contadores
- Logs apropriados
- Tratamento de erros
- Timeout de contexto
- Requisições concorrentes
- Edge cases (URL inválida, tweet deletado, sem vídeo, vídeo grande)
- Reset de contadores
- Estatísticas

### 4. `/scripts/test-twitter-full-flow.ts`
Script manual para testar todo o fluxo.

**Funcionalidades:**
- Testa envio de URL do Twitter via webhook
- Simula resposta do usuário
- Verifica estatísticas
- Testa limite diário
- Verifica separação de contadores
- Resumo de testes executados

**Uso:**
```bash
npm run tsx scripts/test-twitter-full-flow.ts
```

**Variáveis de ambiente necessárias:**
- `BASE_URL` - URL do servidor (padrão: http://localhost:3000)
- `TEST_USER_NUMBER` - Número para teste
- `EVOLUTION_INSTANCE` - Nome da instância

## Arquivos Modificados

### 5. `/src/services/usageLogs.ts`
Adicionado logging específico do Twitter.

**Novos tipos de ação:**
- `twitter_download_started`
- `twitter_download_completed`
- `twitter_download_failed`
- `twitter_conversion_started`
- `twitter_conversion_completed`
- `twitter_conversion_failed`
- `twitter_limit_reached`

**Novas funções:**
- `logTwitterDownloadStarted()` - Log início do download
- `logTwitterDownloadCompleted()` - Log download bem-sucedido
- `logTwitterDownloadFailed()` - Log falha no download
- `logTwitterConversionStarted()` - Log início da conversão
- `logTwitterConversionCompleted()` - Log conversão bem-sucedida
- `logTwitterConversionFailed()` - Log falha na conversão
- `logTwitterLimitReached()` - Log limite atingido

**Informações logadas:**
- URL do Twitter
- Tweet ID e autor
- Tamanho do arquivo
- Tempo de download/conversão
- Formato e qualidade do vídeo
- Taxa de compressão
- Mensagens de erro detalhadas

### 6. `/src/routes/stats.ts`
Adicionado estatísticas do Twitter ao endpoint.

**Novas métricas:**
- Total de downloads do Twitter
- Downloads hoje
- Conversões para sticker
- Taxa de conversão (downloads → stickers)
- Downloads falhados
- Taxa de sucesso
- Top 5 autores do Twitter mais baixados
- Tempo médio de download

**Formato de resposta:**
```json
{
  "twitter": {
    "totalDownloads": 150,
    "downloadsToday": 12,
    "conversions": 89,
    "conversionRate": "59%",
    "failedDownloads": 5,
    "successRate": "97%",
    "topAuthors": [
      { "author": "elonmusk", "downloads": 25 },
      { "author": "twitter", "downloads": 18 }
    ],
    "avgDownloadTimeMs": 3500
  }
}
```

### 7. `/src/services/userService.ts`
Adicionado funções específicas do Twitter.

**Interface atualizada:**
```typescript
interface User {
  id: string;
  whatsapp_number: string;
  name: string;
  daily_count: number;
  twitter_download_count?: number; // NOVO
  last_reset_at: string;
  created_at: string;
  last_interaction: string;
}
```

**Novas funções:**
- `getTwitterDownloadCount(userId)` - Obtém contagem de downloads
- `incrementTwitterDownloadCount(userId)` - Incrementa contador

**Observações:**
- Funções duplicadas em `twitterLimits.ts` para melhor organização
- Ambos os módulos podem ser usados

### 8. `/src/services/messageService.ts`
Adicionado mensagens específicas do Twitter.

**Novas funções:**
- `sendTwitterLimitReachedMessage()` - Mensagem de limite atingido
- `sendTwitterConversionQuestion()` - Pergunta sobre conversão
- `sendTwitterDownloadStartedMessage()` - Confirmação de início
- `sendTwitterErrorMessage()` - Mensagens de erro específicas

**Tipos de erro:**
- `invalid_url` - URL do Twitter inválida
- `no_video` - Tweet sem vídeo
- `download_failed` - Falha no download
- `conversion_failed` - Falha na conversão
- `general` - Erro genérico

**Características:**
- Mensagens em português
- Explicações detalhadas
- Sugestões de solução
- Informações sobre limites

## Database

### 9. Criado `/SUPABASE-TWITTER-MIGRATION.sql`
Script SQL completo para migration.

**Alterações:**
1. Adicionado campo `twitter_download_count INT DEFAULT 0` na tabela `users`
2. Criada função `increment_twitter_download_count(p_user_id UUID)`
3. Atualizada função `reset_all_daily_counters()` para incluir Twitter counter
4. Criada tabela `twitter_downloads` (opcional, para analytics)
5. Criadas políticas RLS para `twitter_downloads`
6. Criadas funções auxiliares:
   - `get_user_twitter_downloads_today()`
   - `get_twitter_conversion_rate()`
   - `cleanup_old_twitter_downloads()`

**Tabela twitter_downloads (opcional):**
```sql
CREATE TABLE twitter_downloads (
  id UUID PRIMARY KEY,
  user_number VARCHAR(20),
  tweet_id VARCHAR(50),
  tweet_author VARCHAR(255),
  twitter_url TEXT,
  video_url TEXT,
  file_size INT,
  download_time_ms INT,
  converted_to_sticker BOOLEAN,
  status VARCHAR(20),
  error_message TEXT,
  created_at TIMESTAMP
);
```

**Índices criados:**
- `idx_twitter_downloads_user_number`
- `idx_twitter_downloads_tweet_id`
- `idx_twitter_downloads_created_at`
- `idx_twitter_downloads_status`

## Como Aplicar

### 1. Database Migration
```bash
# Copie o conteúdo de SUPABASE-TWITTER-MIGRATION.sql
# Cole no SQL Editor do Supabase Dashboard
# Execute o script
```

### 2. Verificar Migration
```sql
-- Verificar coluna criada
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'twitter_download_count';

-- Verificar funções criadas
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE '%twitter%';
```

### 3. Executar Testes
```bash
# Testes unitários
npm run test

# Testes com watch mode
npm run test:watch

# Testes com UI
npm run test:ui

# Coverage
npm run test:coverage

# Teste manual do fluxo completo
npm run tsx scripts/test-twitter-full-flow.ts
```

### 4. Iniciar Servidor
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Validação

### Checklist de Validação

- [x] Arquivo `twitterLimits.ts` criado com todas as funções
- [x] Testes unitários criados em `twitter.test.ts`
- [x] Teste de integração estruturado em `twitter-flow.test.ts`
- [x] Script de teste manual criado
- [x] Logs do Twitter adicionados ao `usageLogs.ts`
- [x] Estatísticas do Twitter adicionadas ao `stats.ts`
- [x] Funções do Twitter adicionadas ao `userService.ts`
- [x] Mensagens do Twitter adicionadas ao `messageService.ts`
- [x] Migration SQL criada com todas as alterações
- [x] Documentação completa no README

### Testes a Executar

1. **Testes Unitários:**
   - URL detection (detectTwitterUrl)
   - Tweet info extraction (extractTweetInfo)
   - URL validation (isTwitterUrl)

2. **Testes de Integração:** (após Sprints 8-10)
   - Fluxo completo de download
   - Conversão para sticker
   - Limite diário
   - Reset de contadores
   - Estatísticas

3. **Testes Manuais:**
   - Enviar URL do Twitter via WhatsApp
   - Verificar pergunta de conversão
   - Testar resposta "sim"
   - Testar resposta "não"
   - Atingir limite de 10 downloads
   - Verificar reset à meia-noite
   - Verificar estatísticas no endpoint

## Dependências

### Sprints Anteriores
Este Sprint 11 depende dos Sprints 8, 9 e 10:
- **Sprint 8:** `twitterService.ts` - Download de vídeos
- **Sprint 9:** `userContext.ts` - Gerenciamento de contexto
- **Sprint 10:** `responseDetector.ts` - Detecção de respostas

### Pacotes NPM
Todos já instalados:
- `vitest` - Framework de testes
- `@vitest/ui` - Interface de testes
- `pino` - Logging estruturado
- `twitter-downloader` - Download de vídeos do Twitter

## Observações Importantes

1. **Limites Separados:**
   - Stickers: 10 por dia (campo `daily_count`)
   - Twitter: 10 por dia (campo `twitter_download_count`)
   - Os limites são independentes

2. **Reset à Meia-Noite:**
   - Ambos os contadores são resetados juntos
   - Função `reset_all_daily_counters()` atualizada

3. **Logging Estruturado:**
   - Todos os logs usam Pino
   - Formato JSON para análise
   - Níveis apropriados (info, error, debug)

4. **Testes Preparados:**
   - Estrutura completa criada
   - Placeholders para implementação futura
   - Aguardando Sprints 8-10

5. **Estatísticas Detalhadas:**
   - Endpoint `/stats` incluindo métricas do Twitter
   - Top autores mais baixados
   - Taxa de conversão
   - Taxa de sucesso

## Próximos Passos

1. **Implementar Sprints 8-10:**
   - Sprint 8: twitterService.ts
   - Sprint 9: userContext.ts
   - Sprint 10: responseDetector.ts

2. **Completar Testes de Integração:**
   - Implementar testes em `twitter-flow.test.ts`
   - Adicionar mocks do Evolution API
   - Testar fluxo completo

3. **Deploy:**
   - Aplicar migration no Supabase
   - Deploy do código
   - Testes em produção

4. **Monitoramento:**
   - Acompanhar logs do Twitter
   - Verificar estatísticas
   - Ajustar limites se necessário

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs com `docker logs <container>`
2. Consulte estatísticas em `/stats`
3. Execute teste manual com `test-twitter-full-flow.ts`
4. Verifique migration do banco de dados

## Conclusão

Sprint 11 concluído com sucesso! Todos os arquivos de limites, logging e testes foram criados. A implementação está preparada para integração com os Sprints 8-10.
