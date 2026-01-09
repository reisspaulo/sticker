# ADR 001: Escolha de APIs WhatsApp (Evolution + Avisa)

## Status
✅ **Aceito** (2025-12)

## Contexto

Precisávamos de uma forma de enviar e receber mensagens do WhatsApp para o bot de stickers. As opções avaliadas foram:

1. **API oficial WhatsApp Business** - Requer aprovação Meta, processo lento, custoso
2. **Evolution API** - Open source, auto-hospedável, suporta todas mensagens
3. **Baileys** - Biblioteca Node.js, requer manutenção constante
4. **Venom-bot** - Alternativa brasileira, menos documentada
5. **Avisa API** - Comercial, especializada em mensagens interativas

## Decisão

Usaremos **Evolution API + Avisa API em conjunto**:

- **Evolution API** como provedor principal:
  - Envio de stickers, vídeos, imagens
  - Recebimento de webhooks (todas mensagens)
  - Download de mídia
  - Mensagens de texto simples

- **Avisa API** como provedor secundário:
  - Listas interativas (planos, métodos pagamento)
  - Botões interativos (upgrade, confirmação PIX)
  - Mensagem PIX com botão copiar
  - Melhor UX para escolhas

## Justificativa

**Por que Evolution API?**
- ✅ Open source e gratuito
- ✅ Auto-hospedável (controle total)
- ✅ Webhook robusto
- ✅ Suporta todos tipos de mensagem
- ✅ Boa documentação

**Por que adicionar Avisa API?**
- ✅ Mensagens interativas nativas WhatsApp
- ✅ Listas e botões melhoram conversão
- ✅ Botão PIX facilita copiar chave
- ✅ Custo baixo (apenas mensagens interativas)

**Por que não apenas Evolution?**
- ❌ Mensagens interativas complexas de implementar
- ❌ Botões texto simples têm UX inferior

**Por que não API oficial?**
- ❌ Aprovação demorada (semanas/meses)
- ❌ Custo por mensagem
- ❌ Processo burocrático

## Consequências

### Positivas
- ✅ Melhor UX com mensagens interativas
- ✅ Controle total sobre Evolution (self-hosted)
- ✅ Fallback: Se Avisa falhar, Evolution funciona
- ✅ Custos previsíveis

### Negativas
- ⚠️ Dependência de 2 provedores
- ⚠️ Complexidade: Código precisa lidar com 2 APIs
- ⚠️ Avisa API é pago (mas barato)

### Neutras
- 🔄 Fallback internacional: Avisa só funciona no Brasil, números internacionais usam Evolution (texto)

## Implementação

### Estrutura
```
src/services/
├── evolutionApi.ts   # sendText, sendSticker, sendVideo
└── avisaApi.ts       # sendList, sendButtons, sendPixButton
```

### Critérios de escolha (runtime)
```typescript
if (needsInteractive && isBrazilianNumber) {
  // Use Avisa API
  await sendList() or sendButtons()
} else {
  // Use Evolution API
  await sendText()
}
```

## Alternativas Consideradas

### 1. Apenas Evolution API
- **Prós**: Simples, 1 dependência
- **Contras**: UX inferior (sem listas/botões nativos)
- **Decisão**: Rejeitado pela UX

### 2. Apenas Avisa API
- **Prós**: UX excelente
- **Contras**: Não suporta envio de stickers, vendor lock-in
- **Decisão**: Rejeitado por limitações técnicas

### 3. API Oficial WhatsApp
- **Prós**: Oficial, confiável
- **Contras**: Aprovação demorada, custo alto, burocracia
- **Decisão**: Rejeitado por tempo e custo

## Referências
- Evolution API: https://doc.evolution-api.com
- Avisa API: https://www.avisaapi.com.br/docs
- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp

## Revisão
Próxima revisão: 2026-06 (após 6 meses de uso)
