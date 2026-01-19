# 🎯 Resumo da Migração: Evolution+Avisa → Z-API

**Data**: 2026-01-19
**Status**: ✅ Fase 1 COMPLETA - Pronto para deploy em staging

---

## 📊 O Que Foi Feito

### Arquivos Criados (4 novos)
1. ✅ **src/services/zapiApi.ts** (713 linhas)
   - Cliente completo da Z-API
   - 9 funções implementadas: sendSticker, sendText, sendVideo, sendButtons, sendList, sendPixButton, checkConnection, setWebhook, getWebhook
   - Rate limiting integrado
   - Fallback para não-brasileiros

2. ✅ **src/services/whatsappApi.ts** (312 linhas)
   - **Adapter pattern** que abstrai qual API usar
   - Permite trocar provider com 1 variável de ambiente
   - Interface unificada para todo código

3. ✅ **src/routes/webhookZapi.ts** (198 linhas)
   - Handler de webhook Z-API
   - Transforma payload Z-API → formato Evolution
   - Reutiliza toda lógica de negócio existente

4. ✅ **src/config/features.ts** (58 linhas)
   - Sistema de feature flags
   - 2 flags: USE_ZAPI, ZAPI_WEBHOOK_ENABLED

### Arquivos Modificados (15 arquivos)
- ✅ src/worker.ts
- ✅ src/server.ts
- ✅ src/routes/webhook.ts
- ✅ src/services/messageService.ts
- ✅ src/services/menuService.ts
- ✅ src/services/onboardingService.ts
- ✅ src/services/stripeWebhook.ts
- ✅ src/services/sequenceService.ts
- ✅ src/services/campaignService.ts
- ✅ src/services/gifProcessor.ts
- ✅ src/services/stickerProcessor.ts
- ✅ src/jobs/sendPendingStickers.ts
- ✅ src/jobs/sendScheduledReminders.ts
- ✅ src/jobs/processSequenceSteps.ts
- ✅ src/jobs/activatePendingPixSubscription.ts

**Total**: 19 arquivos alterados

---

## 🚀 Como Funciona

### Modo Atual (Evolution + Avisa)
```bash
USE_ZAPI=false
ZAPI_WEBHOOK_ENABLED=false
```
- Usa Evolution API para stickers/textos/vídeos
- Usa Avisa API para botões/listas/PIX
- Webhook: /webhook (Evolution)

### Modo Novo (Z-API)
```bash
USE_ZAPI=true
ZAPI_WEBHOOK_ENABLED=true
```
- Usa Z-API para TUDO
- Webhook: /webhook/zapi (Z-API)

### Troca Transparente
O adapter `whatsappApi.ts` decide automaticamente qual API chamar baseado na flag `USE_ZAPI`. Todo o código usa apenas:

```typescript
import { sendSticker, sendText, sendButtons } from './services/whatsappApi';
```

Não importa qual API está por trás - a interface é a mesma!

---

## 📝 Variáveis de Ambiente Novas

Adicionar no Doppler (projeto `sticker`):
```bash
# Z-API (obter credenciais em https://admin.z-api.io/)
Z_API_INSTANCE=<ver_painel_z-api>
Z_API_TOKEN=<ver_painel_z-api>
Z_API_CLIENT_TOKEN=<ver_painel_z-api_configuracoes>
Z_API_BASE_URL=https://api.z-api.io

# Feature Flags
USE_ZAPI=false              # false = Evolution+Avisa, true = Z-API
ZAPI_WEBHOOK_ENABLED=false  # false = webhook desabilitado
```

**⚠️ IMPORTANTE - Credenciais no Doppler:**
1. As credenciais Z-API devem estar APENAS no Doppler
2. Assim como Evolution API e Avisa API já estão
3. NUNCA commitar credenciais no git!

---

## 🎯 Próximos Passos (em ordem)

### 1. Configurar Doppler (5 min)
```bash
# Adicionar variáveis no Doppler (stg e prd)
doppler secrets set \
  Z_API_INSTANCE=3ECBB8EF0D54F1DC47CCEA71E5C779FD \
  Z_API_TOKEN=C510A0F9C0E015918EF628F0 \
  Z_API_CLIENT_TOKEN=<obter> \
  Z_API_BASE_URL=https://api.z-api.io \
  USE_ZAPI=false \
  ZAPI_WEBHOOK_ENABLED=false \
  --project sticker --config stg
```

### 2. Deploy Staging com Flags Desabilitadas (30 min)
```bash
# Deploy normal - deve funcionar exatamente como antes
doppler run --project sticker --config stg -- ./deploy/deploy-sticker.sh

# Verificar logs - deve mostrar:
# 🚩 Feature Flags:
#   USE_ZAPI: ❌ DISABLED
#   ℹ️  Evolution API mode is ACTIVE

# Testar: enviar imagem, /planos, /pagar
```

### 3. Conectar Z-API (10 min)
1. Acessar https://admin.z-api.io/
2. Conectar WhatsApp (QR code)
3. Configurar webhook:
```bash
curl -X PUT \
  "https://api.z-api.io/instances/${Z_API_INSTANCE}/token/${Z_API_TOKEN}/update-every-webhooks" \
  -H "Client-Token: ${Z_API_CLIENT_TOKEN}" \
  -d '{"value": "https://staging.seu-dominio.com/webhook/zapi"}'
```

### 4. Ativar Z-API em Staging (1 hora)
```bash
# Ativar flags
doppler secrets set USE_ZAPI=true ZAPI_WEBHOOK_ENABLED=true \
  --project sticker --config stg

# Restart
vps-ssh "docker service update --force sticker_worker sticker_server"

# Verificar logs:
# 🚩 Feature Flags:
#   USE_ZAPI: ✅ ENABLED
#   ⚠️  Z-API mode is ACTIVE
#   📝 Z-API Webhook: http://0.0.0.0:3000/webhook/zapi

# Testar TUDO:
# - Enviar imagem → sticker
# - /planos → lista
# - /pagar → botão PIX
# - Twitter URL → vídeo
# - Verificar logs: "[Z-API]"
# - Verificar banco: stickers salvos

# Monitorar 1 hora:
# - Taxa erro < 1%
# - Latência < 5s
# - Jobs OK
```

### 5. Se Staging OK: Produção (1 dia)
Repetir passos 2-4 em produção, mas:
- Deploy em horário baixa demanda
- Monitorar 24 horas
- Manter Evolution API 7 dias como backup

### 6. Limpeza (após 7 dias estável)
- Remover evolutionApi.ts, avisaApi.ts
- Remover variáveis antigas do Doppler
- Desligar containers Evolution
- Cancelar Avisa API
- Remover feature flags (Z-API vira padrão)

---

## 🔄 Rollback (se necessário)

Se algo der errado:
```bash
# 1. Desativar Z-API
doppler secrets set USE_ZAPI=false ZAPI_WEBHOOK_ENABLED=false

# 2. Restart
vps-ssh "docker service update --force sticker_worker sticker_server"

# 3. Verificar logs - deve voltar para Evolution mode
```

Rollback é instantâneo (< 1 minuto) porque o código antigo ainda está lá!

---

## ✅ Checklist de Deploy

### Staging
- [ ] Variáveis Z-API no Doppler (stg)
- [ ] Deploy com USE_ZAPI=false
- [ ] Testes funcionam (modo Evolution)
- [ ] WhatsApp conectado na Z-API
- [ ] Webhook Z-API configurado
- [ ] Ativar USE_ZAPI=true
- [ ] Testes funcionam (modo Z-API)
- [ ] Monitorar 1 hora
- [ ] Taxa erro < 1%

### Produção
- [ ] Variáveis Z-API no Doppler (prd)
- [ ] Deploy horário baixa demanda
- [ ] Deploy com USE_ZAPI=false
- [ ] Testes funcionam
- [ ] WhatsApp conectado na Z-API (produção)
- [ ] Webhook Z-API configurado
- [ ] Ativar USE_ZAPI=true
- [ ] Testes funcionam
- [ ] Monitorar 24 horas
- [ ] Taxa erro < 1%
- [ ] Manter Evolution API 7 dias

### Limpeza (7 dias depois)
- [ ] Remover código antigo
- [ ] Remover env vars antigas
- [ ] Desligar Evolution API
- [ ] Cancelar Avisa API
- [ ] Remover feature flags
- [ ] Atualizar docs

---

## 📚 Documentação Relacionada

- **Mapeamento Completo**: `docs/integrations/EVOLUTION-AVISA-DEPENDENCY-MAP.md`
- **Z-API Docs**: `docs/integrations/Z-API_MIGRATION.md`
- **Quick Changes**: `docs/operations/QUICK-CHANGES-GUIDE.md`

---

## 🔍 Troubleshooting

### Problema: "Z_API_CLIENT_TOKEN must be defined"
**Solução**: Obter token no painel Z-API e adicionar no Doppler

### Problema: "Webhook not receiving messages"
**Solução**: Verificar:
1. Webhook configurado corretamente na Z-API
2. URL é HTTPS (Z-API não aceita HTTP)
3. ZAPI_WEBHOOK_ENABLED=true
4. Endpoint /webhook/zapi está registrado (ver logs)

### Problema: "Message send timeout after 90s"
**Solução**: Normal se Z-API estiver lenta. Mensagem vai para retry automaticamente.

### Problema: Jobs não estão processando
**Solução**: Verificar worker logs. Se vazio, provavelmente Redis não está conectado.

---

**Última atualização**: 2026-01-19
**Autor**: Claude Code
**Status**: ✅ Fase 1 COMPLETA
