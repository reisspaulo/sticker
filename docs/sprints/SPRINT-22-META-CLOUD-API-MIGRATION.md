# Sprint 22: Migração para Meta Cloud API (WhatsApp Oficial)

**Data início:** 2026-03-12
**Status:** Em andamento
**Prioridade:** Crítica
**Motivo:** WhatsApp baniu número por uso de APIs não oficiais. Migração para API oficial da Meta.

---

## Contexto e Motivação

O projeto StickerBot utilizava APIs de WhatsApp não oficiais (Evolution API → Avisa API → Z-API) que dependem do Baileys (lib não oficial). O número do WhatsApp foi banido por essa razão (Sprint 21 documenta o ocorrido).

**Decisão:** Migrar 100% para a **Meta Cloud API** — a API oficial do WhatsApp Business Platform. Isso elimina risco de banimento e dá acesso a recursos oficiais (templates, botões, mídia verificada).

### O que muda fundamentalmente

| Aspecto | Antes (Z-API/Evolution/Avisa) | Agora (Meta Cloud API) |
|---------|-------------------------------|------------------------|
| **Conexão** | Baileys (não oficial, risco de ban) | API oficial Meta (autorizada) |
| **Custo** | Pagamento ao provider terceiro | Gratuito dentro de 24h, templates pagos |
| **Janela de conversa** | Sem restrição | 24h após última mensagem do usuário |
| **Templates** | Não existiam | Obrigatórios fora da janela 24h |
| **Stickers fora 24h** | Enviava direto | Impossível — precisa template → botão → janela abre → envia |
| **Números internacionais** | Avisa só suportava BR (+55), fallback Evolution | Meta suporta todos sem restrição |
| **Botões/Listas** | Via Avisa API (terceiro) | Nativo na Meta Cloud API |
| **Verificação do número** | Escanear QR code | Registrar via Meta Business Manager |

---

## O Que Foi Feito

### Fase 1: Provider Meta Cloud API (código base)

**Commits:** `8cb51d3` → `8e13ff0`

#### Arquivos criados
| Arquivo | Descrição |
|---------|-----------|
| `src/services/metaCloudApi.ts` | Provider completo — sendText, sendSticker, sendImage, sendVideo, sendButtons, sendList, sendTemplate |
| `src/routes/webhookMeta.ts` | Webhook receiver — transforma payload Meta → formato interno do bot |
| `src/routes/legal.ts` | Páginas de Política de Privacidade e Termos de Serviço (obrigatórias pela Meta) |
| `src/services/conversationWindow.ts` | Controle da janela de conversa 24h (verifica `last_interaction` no banco) |
| `src/services/templateService.ts` | Smart send — escolhe entre mensagem normal ou template baseado na janela 24h |
| `docs/MIGRACAO-META-CLOUD-API.md` | Guia técnico completo da migração |
| `docs/META-SETUP-CHECKLIST.md` | Checklist de onboarding na plataforma Meta |
| `docs/META-TEMPLATES.md` | 7 templates definidos para Meta Business Manager |
| `docs/README-MIGRACAO.md` | Status da migração em tempo real |
| `docs/ENDPOINT-MAPPING.md` | Mapeamento de endpoints Z-API → Meta |
| `docs/REAPROVEITAMENTO-BANCO-E-MENSAGENS.md` | O que foi reusado do projeto original |

#### Arquivos modificados
| Arquivo | O que mudou |
|---------|-------------|
| `src/services/whatsappApi.ts` | Adapter atualizado — `sendTemplate()` adicionado, todas funções roteiam para Meta quando `USE_META=true` |
| `src/config/features.ts` | Feature flags `USE_META` e `META_WEBHOOK_ENABLED` |
| `src/server.ts` | Registrado rotas `/webhook/meta`, `/privacy`, `/terms` |
| `src/services/alertService.ts` | Tipo `'meta'` adicionado em `alertWhatsAppDisconnected` / `alertWhatsAppReconnected` |
| `deploy/deploy-sticker.sh` | Env vars da Meta adicionadas ao deploy script |
| `src/services/evolutionApi.ts` | Guard para não crashar quando `USE_META=true` |
| `src/services/zapiApi.ts` | Guard para não crashar quando `USE_META=true` |
| `src/services/avisaApi.ts` | Guard para não crashar quando `USE_META=true` |

### Fase 2: Infraestrutura e correções

**Commits:** `582e125` → `3515009`

| Commit | Problema | Solução |
|--------|----------|---------|
| `582e125` | Connection check tentando Evolution API a cada 5min | Skip providers legados quando `USE_META=true` |
| `945ec9a` | Prettier falhando no CI | `npx prettier --write` em todos os arquivos afetados |
| `edaa3b4` | Double reply no webhook Meta (processWebhookRequest responde + handler tenta responder) | Adicionado `return` após `processWebhookRequest`, check `reply.sent` no catch |
| `3515009` | Meta exige Política de Privacidade e Termos | Criadas páginas HTML em `/privacy` e `/terms` |

### Fase 3: Janela 24h, templates e botões

**Commit:** `241d5aa` + mudanças pendentes (não commitadas ainda)

#### Sistema de janela de conversa 24h
- `conversationWindow.ts` — verifica se última mensagem do usuário foi há menos de 24h
- `webhookMeta.ts` — chama `updateLastInteraction()` em cada mensagem recebida
- Usa campo `last_interaction` da tabela `users` (já existia no banco)

#### Template Service (envio inteligente)
- `sendTextOrTemplate(userNumber, text, templateName, params)` — se dentro de 24h envia texto normal (grátis), se fora envia template (pago)
- `sendButtonsOrTemplate(request, templateName, params)` — mesma lógica para botões
- Lazy import do `metaCloudApi` para evitar dependência circular

#### 7 Templates definidos para Meta Business Manager

| Template | Nome | Categoria | Custo estimado | Tem botão? |
|----------|------|-----------|----------------|------------|
| Sticker pronto | `sticker_pronto` | UTILITY | ~R$ 0,15 | Sim — "Receber figurinhas" |
| Limite atingido | `limite_atingido` | MARKETING | ~R$ 0,35 | Não |
| Pagamento confirmado | `pagamento_confirmado` | UTILITY | ~R$ 0,15 | Não |
| Reengajamento | `reengajamento` | MARKETING | ~R$ 0,35 | Não |
| PIX pendente | `pix_pendente` | UTILITY | ~R$ 0,15 | Não |
| Campanha genérica | `mensagem_campanha` | MARKETING | ~R$ 0,35 | Não |
| Entrega de figurinha | `entrega_figurinha` | UTILITY | ~R$ 0,15 | Sim — "Receber figurinha" |

#### Fluxo de stickers pendentes com botão (fora da janela 24h)

```
Job sendPendingStickers (8h ou a cada 5min)
    │
    ├─ Dentro de 24h? → Envia sticker direto (grátis)
    │
    └─ Fora de 24h? → Envia template `sticker_pronto`
                       com botão "Receber figurinhas"
                           │
                           └─ Usuário toca botão
                              → Abre janela 24h
                              → Webhook recebe interactive button
                              → Chama sendPendingStickersForUser()
                              → Envia todos os stickers pendentes
```

#### Função `sendPendingStickersForUser(userNumber)`
Criada em `src/jobs/sendPendingStickers.ts`:
- Busca stickers `status='pendente'` do usuário específico
- Lock atômico (status → `sending`) para evitar race conditions
- Envia cada sticker via `sendSticker()`
- Atualiza status → `enviado`
- Se falha, reverte para `pendente`
- Delay de 200ms entre envios (rate limit)

#### Handler no webhook
Adicionado em `src/routes/webhook.ts`:
- Detecta clique nos botões `receive_pending_stickers` e `receive_sticker`
- Chama `sendPendingStickersForUser(userNumber)`
- Retorna resultado ao usuário

#### Jobs atualizados para usar templates
| Job/Service | Antes | Depois |
|-------------|-------|--------|
| `sendScheduledReminders.ts` | `sendText()` direto | `sendTextOrTemplate()` com fallback para `TEMPLATES.LIMIT_REACHED` |
| `campaignService.ts` | `sendButtons()` / `sendText()` | `sendButtonsOrTemplate()` / `sendTextOrTemplate()` com templates |
| `sendPendingStickers.ts` | `sendSticker()` direto | Verifica janela 24h → template com botão se fora |

### Fase 4: Atualização de documentação

#### Documentos atualizados
| Documento | O que mudou |
|-----------|-------------|
| `docs/INDEX.md` | Nova seção "Meta Cloud API" com links, providers legados marcados ⚠️, status atualizado |
| `docs/README.md` | Requisitos, env vars, webhook, troubleshooting — tudo para Meta Cloud API |
| `docs/architecture/ARCHITECTURE.md` | "Visão Geral das APIs" reescrita (Meta principal, legados descontinuados), fluxo principal com janela 24h |
| `docs/features/PENDING_STICKERS.md` | Adicionado fluxo com botão template + janela 24h, próximos passos atualizados |
| `docs/META-TEMPLATES.md` | Botões quick_reply nos templates `sticker_pronto` e `entrega_figurinha` |
| `docs/architecture/FLOWCHARTS.md` | Diagramas mermaid da janela 24h e fluxo de templates |

#### Documentos movidos para `docs/archive/`
| Documento | Motivo |
|-----------|--------|
| `Z-API-READY-TO-DEPLOY.md` | Z-API descontinuada, substituída por Meta Cloud API |
| `MIGRATION-COMPLETE-SUMMARY.md` | Referente à migração Evolution→Z-API (obsoleta) |
| `FIXES-MISSING-STICKERS.md` | Fixes antigos já incorporados |

---

## Descobertas e Problemas Encontrados

### 1. Erro 130497 — "Business account restricted from messaging users in this country"
**Causa:** O número de teste da Meta (+1 555 636 8303) não pode enviar mensagens para o Brasil.
**Solução:** Registrar número brasileiro real (+55 11 98870-9202) como número do Business.
**Status:** Pendente — número ainda está conectado ao WhatsApp pessoal.

### 2. Token temporário expira em ~1 hora
**Causa:** Token gerado no Meta Developer Portal é temporário.
**Solução:** Gerar token permanente via System User no Meta Business Manager.
**Status:** Pendente.

### 3. Double reply no webhook Meta
**Causa:** `processWebhookRequest` enviava resposta, e depois o handler do webhook tentava enviar outra.
**Solução:** Adicionado `return` após `processWebhookRequest` e check `reply.sent` no catch.
**Commit:** `edaa3b4`

### 4. Connection check falhando a cada 5 minutos
**Causa:** Job tentava checar Evolution API que não está mais rodando.
**Solução:** Quando `USE_META=true`, skip check de providers legados, faz check direto na Meta Graph API.
**Commit:** `582e125`

### 5. Stickers não podem ser enviados como template
**Descoberta crítica:** A Meta Cloud API não suporta stickers em template messages. Templates só suportam texto, imagens e vídeos.
**Solução:** Template com botão quick_reply → usuário toca → abre janela 24h → aí sim envia o sticker.

### 6. Meta exige Política de Privacidade para modo Live
**Causa:** App não pode sair do modo Development sem URLs de privacidade e termos.
**Solução:** Criadas páginas HTML servidas pelo próprio Fastify em `/privacy` e `/terms`.
**Commit:** `3515009`

### 7. Número já conectado ao WhatsApp
**Descoberta:** Para registrar um número na Meta Cloud API, ele não pode estar conectado a nenhuma conta WhatsApp (pessoal ou business). É preciso desconectar/deletar a conta primeiro.
**Status:** Pendente — usuário precisa desconectar WhatsApp do número +55 11 98870-9202.

### 8. Custos da Meta Cloud API
**Análise de custos:**
- Mensagens dentro da janela 24h: **gratuitas**
- Templates UTILITY: ~R$ 0,15 por mensagem
- Templates MARKETING: ~R$ 0,35 por mensagem
- Stickers (dentro da janela): **gratuitos** (são mensagens normais)
- Para sticker pendente fora da janela: R$ 0,15 (1 template UTILITY) + sticker grátis

---

## Infraestrutura Configurada

### Meta Business Platform
- **App ID:** 938295891922859
- **Business Account ID:** 1254785652711371
- **Phone Number ID (teste):** 1026927390503855 (vai mudar ao registrar número real)
- **Webhook URL:** `https://stickers.ytem.com.br/webhook/meta`
- **Webhook Verify Token:** `sticker-meta-webhook-2026-secret`
- **Status do App:** Live (modo produção)
- **API Version:** v22.0

### Variáveis de ambiente (VPS)
```
USE_META=true
META_WEBHOOK_ENABLED=true
WHATSAPP_ACCESS_TOKEN=<token temporário>
WHATSAPP_PHONE_NUMBER_ID=1026927390503855
WHATSAPP_BUSINESS_ACCOUNT_ID=1254785652711371
WHATSAPP_WEBHOOK_TOKEN=sticker-meta-webhook-2026-secret
```

### VPS
- **IP:** 69.62.100.250
- **SSH:** `ssh -i ~/.ssh/ytem_deploy root@69.62.100.250`
- **Stack:** Docker Swarm + Traefik (reverse proxy + SSL)
- **RAM:** 16GB (container limit 512MB — heap 90%+ é comportamento normal do Node.js)
- **Domínio:** stickers.ytem.com.br

### Números
- **Número do bot:** +55 11 98870-9202 (a ser registrado na Meta)
- **Número pessoal do Paulo:** +55 11 94630-4133

---

## Testes Realizados

| Teste | Resultado | Observação |
|-------|-----------|------------|
| Webhook receber mensagem | ✅ Funciona | Mensagem "oiii" recebida, processada |
| Payload Meta → formato interno | ✅ Funciona | Transformação correta no webhookMeta.ts |
| Usuário encontrado no banco | ✅ Funciona | getUserOrCreate funcionou |
| Envio de mensagem (texto) | ❌ Erro 130497 | Número de teste não envia para Brasil |
| Envio de sticker | ❌ Erro 130497 | Mesmo motivo |
| Compilação TypeScript | ✅ Sem erros | Todos os tipos corretos |
| Connection check Meta | ✅ Funciona | Graph API responde com dados do número |
| Privacy/Terms pages | ✅ Funciona | HTML servido corretamente |
| App em modo Live | ✅ Funcionando | Saiu de Development para Live |

---

## Commits da Sprint

| # | Commit | Tipo | Descrição |
|---|--------|------|-----------|
| 1 | `8cb51d3` | feat | Meta Cloud API provider (metaCloudApi.ts, webhookMeta.ts) |
| 2 | `9dc0011` | chore | Env vars da Meta no deploy script |
| 3 | `6acc73f` | fix | Guard imports legados para não crashar com USE_META |
| 4 | `75090bf` | fix | Stripe API version update |
| 5 | `8e13ff0` | feat | Root route (/) para evitar 404 |
| 6 | `582e125` | fix | Skip connection checks de providers legados |
| 7 | `945ec9a` | fix | Prettier formatting em todos os arquivos |
| 8 | `edaa3b4` | fix | Double reply no webhook Meta |
| 9 | `3515009` | feat | Privacy policy e Terms of Service |
| 10 | `241d5aa` | feat | Janela 24h, templates, conversation window |
| 11 | *pendente* | feat | sendPendingStickersForUser, botões nos templates, docs |

---

## Arquivos Criados/Modificados nesta Sprint

### Novos (14 arquivos)
```
src/services/metaCloudApi.ts          # Provider Meta Cloud API
src/routes/webhookMeta.ts             # Webhook receiver Meta
src/routes/legal.ts                   # /privacy e /terms
src/services/conversationWindow.ts    # Controle janela 24h
src/services/templateService.ts       # Smart send com templates

docs/MIGRACAO-META-CLOUD-API.md       # Guia técnico completo
docs/META-SETUP-CHECKLIST.md          # Checklist onboarding
docs/META-TEMPLATES.md                # 7 templates definidos
docs/README-MIGRACAO.md               # Status da migração
docs/ENDPOINT-MAPPING.md              # Z-API → Meta endpoints
docs/REAPROVEITAMENTO-BANCO-E-MENSAGENS.md  # Reuso banco/msgs

docs/sprints/SPRINT-22-META-CLOUD-API-MIGRATION.md  # Este documento
```

### Modificados (12 arquivos)
```
src/services/whatsappApi.ts           # sendTemplate(), adapter Meta
src/config/features.ts                # USE_META, META_WEBHOOK_ENABLED
src/server.ts                         # Registro rotas Meta + legal
src/services/alertService.ts          # Tipo 'meta'
src/jobs/checkWhatsAppConnections.ts   # checkMetaConnection()
src/jobs/sendPendingStickers.ts       # sendPendingStickersForUser(), template c/ botão
src/jobs/sendScheduledReminders.ts    # sendTextOrTemplate()
src/services/campaignService.ts       # sendTextOrTemplate(), sendButtonsOrTemplate()
src/routes/webhook.ts                 # Handler botões template
deploy/deploy-sticker.sh              # Env vars Meta

docs/INDEX.md                         # Seção Meta, legados marcados
docs/README.md                        # Setup atualizado para Meta
docs/architecture/ARCHITECTURE.md     # Fluxo principal atualizado
docs/architecture/FLOWCHARTS.md       # Diagramas janela 24h
docs/features/PENDING_STICKERS.md     # Fluxo com botão template
```

### Arquivados (3 arquivos → `docs/archive/`)
```
Z-API-READY-TO-DEPLOY.md             # Obsoleto
MIGRATION-COMPLETE-SUMMARY.md        # Obsoleto (era Evolution→Z-API)
FIXES-MISSING-STICKERS.md            # Fixes antigos incorporados
```

---

## O Que Falta (Pendente)

### Bloqueante — Sem isso, bot não funciona

- [ ] **Desconectar WhatsApp** do número +55 11 98870-9202
  - Configurações → Conta → Apagar conta (ou transferir para outro número)
  - Aguardar confirmação de exclusão
- [ ] **Registrar número na Meta** Developer Portal
  - WhatsApp → Getting Started → Add Phone Number
  - Verificar via SMS
  - Anotar novo `PHONE_NUMBER_ID`
- [ ] **Atualizar env var** `WHATSAPP_PHONE_NUMBER_ID` no VPS com novo ID
- [ ] **Testar envio** de mensagem/sticker para número real brasileiro

### Importante — Pós-registro

- [ ] **Token permanente** — gerar System User token no Meta Business Manager (tokens temporários expiram em ~1h)
- [ ] **Atualizar Doppler** com token permanente
- [ ] **Método de pagamento** no Meta Business (necessário para enviar templates)
- [ ] **Criar os 7 templates** no Meta Business Manager (portal web, não via API)
  - Guia: `docs/META-TEMPLATES.md`
  - Tempo de aprovação: 1-48h dependendo da complexidade
- [ ] **Testar fluxo completo end-to-end:**
  1. Usuário envia imagem → sticker criado e enviado de volta
  2. Usuário atinge limite → mensagem de limite com upgrade
  3. Sticker pendente fora de 24h → template com botão → toque → entrega
  4. Comando de texto (planos, ajuda, status)
  5. Link Twitter → download de vídeo

### Limpeza — Depois de confirmar que tudo funciona

- [ ] **Remover providers legados** do código:
  - `src/services/evolutionApi.ts`
  - `src/services/zapiApi.ts`
  - `src/services/avisaApi.ts`
  - `src/routes/webhookZapi.ts`
  - `src/types/evolution.ts` (renomear para types genéricos)
- [ ] **Remover feature flags** USE_META e META_WEBHOOK_ENABLED (serão sempre true)
- [ ] **Atualizar ADR** — criar `docs/decisions/006-meta-cloud-api.md`
- [ ] **Verificação de negócio** no Meta Business Manager (maior throughput de mensagens)

### Melhorias futuras

- [ ] Receber e processar **vídeos** enviados pelo usuário (transformar em sticker animado)
- [ ] **Dashboard de custos** de templates no admin panel
- [ ] **Webhook de status** de mensagem (delivered, read, failed) para analytics
- [ ] **Métricas de janela 24h** (% de mensagens dentro vs fora)
- [ ] **Retry inteligente** para templates que falharam

---

## Decisões Tomadas

### 1. Meta Cloud API como único provider
**Decisão:** Remover todos os providers terceiros (Evolution, Avisa, Z-API) e usar exclusivamente a Meta Cloud API.
**Motivo:** Providers não oficiais causaram banimento do número. Meta é a única API oficial e autorizada.

### 2. Adapter pattern mantido
**Decisão:** Manter o `whatsappApi.ts` como camada de abstração entre o bot e o provider.
**Motivo:** Permite trocar de provider facilmente no futuro se necessário. Feature flags controlam qual provider está ativo.

### 3. Template com botão para stickers fora da janela 24h
**Decisão:** Enviar template UTILITY com quick_reply button em vez de pedir ao usuário para "responder qualquer coisa".
**Motivo:** UX melhor — um toque no botão é mais intuitivo que pedir texto. Também permite rastrear engajamento.

### 4. Janela 24h via campo `last_interaction` no banco
**Decisão:** Usar campo existente na tabela `users` em vez de criar tabela nova.
**Motivo:** Campo já existia, só precisou ser atualizado em cada mensagem recebida. Zero migração necessária.

### 5. Lazy import do metaCloudApi no templateService
**Decisão:** Usar `require('./metaCloudApi')` em vez de import estático.
**Motivo:** Evita dependência circular (metaCloudApi → whatsappApi → templateService → metaCloudApi).

---

## Métricas da Sprint

| Métrica | Valor |
|---------|-------|
| Arquivos novos | 14 |
| Arquivos modificados | 12+ |
| Arquivos arquivados | 3 |
| Commits | 10 (+ 1 pendente) |
| Docs novos | 7 |
| Docs atualizados | 5 |
| Templates definidos | 7 |
| Bugs corrigidos | 4 (double reply, connection check, prettier, guards) |
| Linhas adicionadas | ~2.500+ |
| Linhas removidas | ~1.300+ |

---

## Referências

| Recurso | URL/Local |
|---------|-----------|
| Meta for Developers | https://developers.facebook.com/ |
| Meta Cloud API Docs | https://developers.facebook.com/docs/whatsapp/cloud-api |
| Guia de migração | `docs/MIGRACAO-META-CLOUD-API.md` |
| Checklist setup | `docs/META-SETUP-CHECKLIST.md` |
| Templates | `docs/META-TEMPLATES.md` |
| Status migração | `docs/README-MIGRACAO.md` |
| Sprint anterior (open source) | `docs/sprints/SPRINT-21-OPEN-SOURCE-PREPARATION.md` |

---

**Última atualização:** 2026-03-12
