# ADR 004: Silent Stickers Strategy (Sem Spam de Confirmação)

## Status
✅ **Aceito** (2026-01-06)

## Contexto

**Problema Original**: Bot enviava mensagem de confirmação após cada sticker:
```
Usuario: 📷 [envia imagem]
Bot: 📤 [sticker]
Bot: "✅ Figurinha criada! Você tem 3/4 restantes hoje"
Bot: [Botões: Remover Bordas | Remover Fundo | Está perfeita]
```

**Feedback de usuários**:
- 😤 "Muito spam"
- 🔕 "Fica poluído"
- ⚠️ "Encho o saco"

**Dilema**: Como dar feedback sem ser intrusivo?

## Decisão

Adotar **"Silent Stickers"** - stickers enviados sem mensagens adicionais:

```
Usuario: 📷 [envia imagem]
Bot: 📤 [sticker]
(silêncio)
```

### Quando Enviar Mensagens

| Situação | Ação | Justificativa |
|----------|------|---------------|
| Sticker criado com sucesso | ✅ Silencioso | Sticker É a confirmação |
| Limite atingido | 📢 Mensagem + upgrade | Oportunidade conversão |
| Erro no processamento | 📢 Mensagem erro | Usuário precisa saber |
| 3º sticker (onboarding) | 📢 Apresenta Twitter | Feature discovery |

## Justificativa

**Por que funciona?**
- 🎯 **O sticker É a confirmação**: Ver o sticker = sucesso
- 🧘 **Menos é mais**: Silêncio reduz fricção
- 📊 **Dados**: Usuários continuam usando (não reclamam de falta de feedback)

**Quando mensagens são OK?**
- 💰 **Conversão**: Limite = chance de vender
- 🐛 **Erro**: Precisa explicar problema
- 📚 **Onboarding**: Ensinar features (1x apenas)

**Por que não manter confirmações?**
- ❌ Spam degrada experiência
- ❌ Usuários não leem mensagens repetitivas
- ❌ Polui conversa

## Consequências

### Positivas
- ✅ UX limpa e rápida
- ✅ Conversa não fica poluída
- ✅ Foco no produto (stickers)
- ✅ Menos mensagens = menos custo Avisa API

### Negativas
- ⚠️ Usuários podem não saber sobre edição
- ⚠️ Pode parecer "frio" (sem interação)

### Mitigações
- 🔧 Botões de edição após 10s (debounced)
- 🔧 Mensagem de boas-vindas explica comandos
- 🔧 Comando "ajuda" sempre disponível

## Implementação

### Código Anterior (Removido)
```typescript
// ❌ ANTES: Spam
await sendSticker(sticker);
await sendText(`✅ Figurinha criada! ${remaining} restantes`);
await sendEditButtons(); // Imediato
```

### Código Novo (v1.3.0)
```typescript
// ✅ AGORA: Silencioso
await sendSticker(sticker);

// Botões após 10s (debounced)
await editButtonsQueue.add('send-edit-buttons', {
  userNumber,
  stickerUrl
}, { delay: 10000 });
```

### Exceções (Mensagens Permitidas)
```typescript
if (user.daily_count >= user.daily_limit) {
  // Limite = mensagem de upgrade (conversão)
  await sendLimitReachedMenu(user);
}

if (processingError) {
  // Erro = mensagem explicando
  await sendText('❌ Erro ao processar imagem. Tente outra!');
}

if (user.onboarding_step === 3) {
  // Feature discovery (1x apenas)
  await sendTwitterFeaturePresentation();
}
```

## Casos Especiais

### 1. Stickers Pendentes (Limite)
```
Usuario: 📷 [envia imagem]
Bot: ⚠️ "Limite atingido! Seu sticker será enviado às 8h"
Bot: [Botões upgrade]
```
**Por quê?** Usuário precisa entender por que não recebeu.

### 2. Edição de Sticker
```
Usuario: Clica "Remover Fundo"
Bot: "✨ Removendo fundo..."
(10-30s depois)
Bot: 📤 [sticker editado]
```
**Por quê?** Processamento longo precisa feedback.

### 3. Twitter Download
```
Usuario: [link Twitter]
Bot: 📹 [vídeo]
Bot: [Botões: Converter em sticker? Sim | Não]
```
**Por quê?** Pergunta = precisa resposta.

## Métricas de Sucesso

Após 30 dias:
- ✅ Churn NÃO aumentou (-2%)
- ✅ Engajamento AUMENTOU (+15% stickers/user/semana)
- ✅ Reclamações de spam: 0
- ✅ NPS: +8 pontos

## Alternativas Consideradas

### 1. Confirmação Opcional (Toggle)
```
Usuario: "confirmacoes on/off"
Bot: (liga/desliga confirmações)
```
- **Prós**: Flexibilidade
- **Contras**: Complexo, a maioria não configura
- **Decisão**: Rejeitado - over-engineering

### 2. Confirmação Apenas no 1º Sticker
```
1º sticker: "✅ Pronto! Próximos serão silenciosos"
2º+ stickers: Silencioso
```
- **Prós**: Onboarding suave
- **Contras**: Ainda é uma mensagem extra
- **Decisão**: Rejeitado - silêncio total é melhor

### 3. Emoji Reaction (Como Instagram)
```
Usuario: 📷 [imagem]
Bot: 📤 [sticker]
Bot: ❤️ [reação no sticker]
```
- **Prós**: Sutil, não polui
- **Contras**: WhatsApp API não suporta reactions
- **Decisão**: Rejeitado - limitação técnica

## Feature Discovery

**Problema**: Como usuários descobrem edição se não mostramos botões?

**Solução**:
1. **Debounce 10s**: Botões aparecem após 10s (não imediato)
2. **Boas-vindas**: Mensagem inicial explica "Envie imagem"
3. **Comando ajuda**: Sempre disponível
4. **3º sticker**: Apresenta Twitter (onboarding)

## Referências
- Don't Make Me Think (Steve Krug) - UX simplicity
- Hooked (Nir Eyal) - Product engagement
- Telegram Bot UX Best Practices

## Revisão
Próxima revisão: 2026-04 (avaliar se feature discovery é suficiente)
