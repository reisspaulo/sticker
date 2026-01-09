# 📋 Architecture Decision Records (ADRs)

Este diretório contém as **decisões de arquitetura** do StickerBot.

## O que são ADRs?

ADRs (Architecture Decision Records) documentam decisões importantes de arquitetura:
- **Por que** escolhemos essa solução?
- **Quais alternativas** foram consideradas?
- **Quais são as consequências** dessa decisão?

## Quando Criar um ADR?

Crie um ADR quando tomar decisões que:
- 🏗️ Afetam a arquitetura do sistema
- 💰 Têm impacto significativo (custo, tempo, complexidade)
- 🔄 São difíceis de reverter depois
- 🤔 Geram debate na equipe

## Estrutura de um ADR

```markdown
# ADR XXX: Título da Decisão

## Status
✅ Aceito | 🔄 Em discussão | ❌ Rejeitado | 📝 Deprecated

## Contexto
Qual problema estamos resolvendo?

## Decisão
O que decidimos fazer?

## Justificativa
Por que essa é a melhor opção?

## Consequências
- Positivas: O que ganhamos?
- Negativas: O que perdemos?
- Mitigações: Como reduzir riscos?

## Alternativas Consideradas
O que mais avaliamos e por que não escolhemos?

## Referências
Links úteis, papers, docs

## Revisão
Quando reavaliar essa decisão?
```

## ADRs Existentes

| # | Título | Status | Data |
|---|--------|--------|------|
| [001](./001-escolha-evolution-avisa-apis.md) | Escolha de APIs WhatsApp | ✅ Aceito | 2025-12 |
| [002](./002-bullmq-processamento-assincrono.md) | BullMQ para Processamento | ✅ Aceito | 2025-12 |
| [003](./003-ab-test-bonus-credits.md) | Teste A/B Bonus Credits | ✅ Aceito | 2026-01 |
| [004](./004-silent-stickers-strategy.md) | Silent Stickers Strategy | ✅ Aceito | 2026-01 |

## Como Criar um Novo ADR?

1. **Copie o template**:
   ```bash
   cp docs/decisions/TEMPLATE.md docs/decisions/005-titulo-decisao.md
   ```

2. **Preencha as seções**:
   - Explique o contexto
   - Documente a decisão
   - Liste alternativas
   - Justifique a escolha

3. **Discuta com a equipe**:
   - Status: 🔄 Em discussão
   - Colete feedback
   - Itere se necessário

4. **Finalize**:
   - Status: ✅ Aceito
   - Commit e merge
   - Implemente a decisão

## Template

Use este template para novos ADRs:

```markdown
# ADR XXX: [Título Curto]

## Status
🔄 Em discussão

## Contexto
[Descreva o problema ou necessidade]

## Decisão
[O que foi decidido]

## Justificativa
[Por que essa decisão foi tomada]

**Por que essa opção?**
- ✅ Razão 1
- ✅ Razão 2

**Por que não outras opções?**
- ❌ Alternativa X: Motivo

## Consequências

### Positivas
- ✅ Benefício 1
- ✅ Benefício 2

### Negativas
- ⚠️ Trade-off 1
- ⚠️ Trade-off 2

### Mitigações
- 🔧 Como reduzir riscos

## Alternativas Consideradas

### 1. [Nome da Alternativa]
- **Prós**: ...
- **Contras**: ...
- **Decisão**: Rejeitado porque...

## Referências
- Link 1
- Link 2

## Revisão
Próxima revisão: [Data]
```

## Boas Práticas

### ✅ Faça
- Documente decisões importantes
- Explique o "por quê"
- Liste alternativas avaliadas
- Seja objetivo e conciso
- Atualize status quando mudar

### ❌ Não Faça
- Documentar decisões triviais
- Escrever romances (seja breve)
- Omitir alternativas
- Deixar sem data de revisão
- Criar ADR depois de implementar (idealmente, antes!)

## Quando Revisar ADRs?

- 📅 **Periodicidade**: Cada ADR tem data de revisão
- 🔄 **Mudança de contexto**: Tecnologia evoluiu, requisitos mudaram
- 📊 **Métricas**: Consequências previstas não se confirmaram
- 🐛 **Problemas**: Decisão causou problemas inesperados

## Fluxo de Vida de um ADR

```
📝 Proposto
    ↓
🔄 Em discussão
    ↓
✅ Aceito → Implementado → 📅 Revisão periódica
    ↓                              ↓
    ↓                          🔄 Reavaliação
    ↓                              ↓
    └────────────────────> 📝 Deprecated (se necessário)
```

## Ferramentas

- **Editor**: Qualquer editor Markdown
- **Visualização**: GitHub renderiza automaticamente
- **Versionamento**: Git (track de mudanças)

## Referências

- [ADR GitHub Org](https://adr.github.io/)
- [Documenting Architecture Decisions (Michael Nygard)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR Tools](https://github.com/npryce/adr-tools)

---

**Última atualização**: 2026-01-08
