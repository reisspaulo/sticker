# Migração para Meta Cloud API - Status

**Atualizado:** 2026-03-12
**Status:** Em andamento - código implementado, aguardando registro de número real

---

## O que já foi feito

### Código (100% implementado)
- [x] `src/services/metaCloudApi.ts` - Provider completo da Meta Cloud API
- [x] `src/routes/webhookMeta.ts` - Webhook receiver com transformação Meta → formato interno
- [x] `src/services/whatsappApi.ts` - Adapter atualizado com flag `USE_META`
- [x] `src/config/features.ts` - Feature flags `USE_META` e `META_WEBHOOK_ENABLED`
- [x] `src/jobs/checkWhatsAppConnections.ts` - Connection check para Meta
- [x] `src/services/alertService.ts` - Suporte a alertas para provider Meta
- [x] `src/routes/legal.ts` - Páginas de Política de Privacidade e Termos de Serviço
- [x] Guards nos providers legados (evolutionApi, zapiApi, avisaApi) para não crashar com `USE_META=true`
- [x] Deploy script atualizado com env vars da Meta

### Infraestrutura
- [x] Webhook verificado pela Meta (`https://stickers.ytem.com.br/webhook/meta`)
- [x] App Meta criado (ID: 938295891922859)
- [x] App em modo **Live**
- [x] Política de privacidade em `https://stickers.ytem.com.br/privacy`
- [x] Termos de serviço em `https://stickers.ytem.com.br/terms`
- [x] Env vars configuradas no VPS (`USE_META=true`, `META_WEBHOOK_ENABLED=true`)
- [x] DNS configurado (stickers.ytem.com.br → 69.62.100.250)
- [x] SSL via Let's Encrypt (Traefik)

### Testado e funcionando
- [x] Webhook recebe mensagens da Meta (testado com mensagem real "oiii")
- [x] Payload transformado corretamente para formato interno
- [x] Usuário encontrado no banco de dados
- [x] Connection check da Meta funcionando

---

## O que falta

### Bloqueante: Registrar número real
- [ ] Desconectar WhatsApp do número +55 11 98870-9202
- [ ] Registrar número no Meta Developer Portal como Phone Number do Business
- [ ] Verificar número via SMS
- [ ] Atualizar `WHATSAPP_PHONE_NUMBER_ID` no VPS (vai mudar ao registrar número real)

### Pós-registro
- [ ] Gerar token permanente (System User token) - tokens temporários expiram em ~1h
- [ ] Adicionar método de pagamento no Meta Business
- [ ] Testar envio de mensagem com número real (não mais erro 130497)
- [ ] Testar fluxo completo: receber imagem → criar figurinha → enviar sticker
- [ ] Atualizar token no Doppler (permanente)

### Melhorias futuras
- [ ] Criar templates de mensagem para campanhas fora da janela de 24h
- [ ] Remover código dos providers legados (Evolution, Z-API, Avisa)
- [ ] Verificação do negócio no Meta Business Manager (para maior throughput)

---

## Problema resolvido: erro 130497

O número de teste da Meta (+1 555 636 8303) não pode enviar mensagens para o Brasil.
Solução: registrar número brasileiro real (+55 11 98870-9202) como número do Business.

---

## Variáveis de ambiente (VPS)

```
USE_META=true
META_WEBHOOK_ENABLED=true
WHATSAPP_ACCESS_TOKEN=<token temporário - trocar por permanente>
WHATSAPP_PHONE_NUMBER_ID=1026927390503855  # vai mudar com número real
WHATSAPP_BUSINESS_ACCOUNT_ID=1254785652711371
WHATSAPP_WEBHOOK_TOKEN=sticker-meta-webhook-2026-secret
```

---

## Documentos de referência

| Documento | Descrição |
|-----------|-----------|
| [MIGRACAO-META-CLOUD-API.md](./MIGRACAO-META-CLOUD-API.md) | Guia técnico completo da migração |
| [META-SETUP-CHECKLIST.md](./META-SETUP-CHECKLIST.md) | Checklist de configuração da conta Meta |
| [ENDPOINT-MAPPING.md](./ENDPOINT-MAPPING.md) | Mapeamento Z-API → Meta Cloud API |
| [REAPROVEITAMENTO-BANCO-E-MENSAGENS.md](./REAPROVEITAMENTO-BANCO-E-MENSAGENS.md) | O que foi reusado do projeto original |

---

## Commits da migração

| Commit | Descrição |
|--------|-----------|
| `8cb51d3` | feat: add Meta Cloud API provider |
| `9dc0011` | chore: add Meta env vars to deploy script |
| `6acc73f` | fix: guard legacy provider imports |
| `75090bf` | fix: update Stripe API version |
| `8e13ff0` | feat: add root route |
| `582e125` | fix: skip legacy connection checks when USE_META |
| `945ec9a` | fix: resolve prettier formatting errors |
| `edaa3b4` | fix: prevent double reply in Meta webhook |
| `3515009` | feat: add privacy policy and terms pages |
