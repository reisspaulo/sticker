# 📚 Guia de Documentação - StickerBot

Este guia explica como manter a documentação sincronizada com o código.

---

## 🗂️ Estrutura da Documentação

```
docs/
├── architecture/
│   ├── ARCHITECTURE.md      # Arquitetura detalhada
│   ├── FLOWCHARTS.md        # Diagramas visuais (Mermaid)
│   └── PENDING_STICKERS.md  # Doc específica
│
├── business/
│   └── BUSINESS_RULES.md    # Regras de negócio
│
├── decisions/                # ADRs (Architecture Decision Records)
│   ├── README.md            # Guia de ADRs
│   ├── 001-*.md             # Decisões documentadas
│   └── ...
│
└── DOCUMENTATION_GUIDE.md   # Este arquivo

tests/
└── flows/                    # Testes como documentação
    ├── upgrade-flow.test.ts
    ├── sticker-creation-flow.test.ts
    └── ...

scripts/
├── validate-docs.ts          # Valida docs vs código
└── setup-hooks.sh            # Instala git hooks

.git-hooks/
└── pre-commit                # Hook de validação
```

---

## 🎯 Filosofia: Documentação Viva

**Problema**: Documentação fica desatualizada rapidamente.

**Solução**: Múltiplas camadas de proteção.

### 1️⃣ Testes como Documentação ⭐⭐⭐⭐⭐
**tests/flows/***

```typescript
// Teste documenta o fluxo E valida que funciona
describe('Fluxo de Upgrade Premium', () => {
  it('Usuário digita "planos" → vê lista', () => {
    expect(response.options).toContain('Premium');
  });
});
```

**Como usar:**
```bash
npm run test:flows         # Roda testes de fluxo
npm run test:flows:watch   # Watch mode
```

**Por que funciona:**
- ✅ Se teste quebrar, documentação está errada
- ✅ Força sincronização código ↔ docs
- ✅ Executável (não é texto morto)

---

### 2️⃣ CI Validation ⭐⭐⭐⭐
**scripts/validate-docs.ts**

Valida automaticamente:
- Todos os botões estão documentados?
- Todas as filas estão documentadas?
- Docs foram atualizados recentemente?

**Como usar:**
```bash
npm run validate:docs      # Roda validação
```

**Integração CI** (GitHub Actions):
```yaml
# .github/workflows/docs.yml
- name: Validate Documentation
  run: npm run validate:docs
```

---

### 3️⃣ Pre-commit Hook ⭐⭐⭐
**.git-hooks/pre-commit**

Antes de cada commit:
- Detecta mudanças em arquivos de fluxo
- Pergunta se você atualizou a documentação
- Bloqueia commit se você disser "não"

**Como instalar:**
```bash
npm run setup:hooks
```

**Arquivos monitorados:**
- `src/routes/webhook.ts`
- `src/services/menuService.ts`
- `src/worker.ts`
- `src/config/queue.ts`

---

### 4️⃣ ADRs (Decisões) ⭐⭐⭐⭐
**docs/decisions/***

Documenta **por que** tomamos decisões:
- Por que escolhemos BullMQ?
- Por que Evolution + Avisa API?
- Por que silent stickers?

**Como criar:**
```bash
cp docs/decisions/TEMPLATE.md docs/decisions/005-nova-decisao.md
# Edite o arquivo
git add docs/decisions/005-nova-decisao.md
git commit -m "docs: add ADR 005 - Nova Decisão"
```

---

## 📖 Workflow: Mudando um Fluxo

### Cenário: Você adicionou um novo botão

```typescript
// src/routes/webhook.ts
case 'button_retry_payment':
  await retryPayment(userNumber);
  break;
```

### Passo 1: Atualize o Teste
```typescript
// tests/flows/upgrade-flow.test.ts
it('Botão retry payment → reprocessa pagamento', () => {
  const buttonClick = 'button_retry_payment';
  expect(buttonClick).toBe('button_retry_payment');
});
```

### Passo 2: Atualize o Diagrama
```markdown
<!-- docs/architecture/FLOWCHARTS.md -->
BTN -->|retry_payment| RETRY[🔄 Reprocessa pagamento]
RETRY --> END_OK
```

### Passo 3: Commit
```bash
git add src/routes/webhook.ts \
        tests/flows/upgrade-flow.test.ts \
        docs/architecture/FLOWCHARTS.md

git commit -m "feat: add retry payment button"
```

**Pre-commit hook vai:**
- ✅ Ver que webhook.ts mudou
- ✅ Ver que FLOWCHARTS.md mudou também
- ✅ Permitir commit

---

## 🔍 Comandos Úteis

### Testes
```bash
npm run test:flows              # Roda testes de fluxo
npm run test:flows:watch        # Watch mode
npm run test:coverage           # Cobertura
```

### Validação
```bash
npm run validate:docs           # Valida docs vs código
```

### Git Hooks
```bash
npm run setup:hooks             # Instala pre-commit hook
```

### Documentação
```bash
# Ver diagramas localmente
code docs/architecture/FLOWCHARTS.md
# Instale: Markdown Preview Mermaid Support (VS Code)
```

---

## 🚨 Checklist: Mudei o Código

Sempre que você modificar fluxos:

- [ ] Atualizei `tests/flows/*.test.ts`?
- [ ] Atualizei `docs/architecture/FLOWCHARTS.md`?
- [ ] Rodei `npm run validate:docs`?
- [ ] Se decisão arquitetural, criei ADR?
- [ ] Commit inclui código + docs juntos?

---

## 📊 Métricas de Qualidade

### Bom Estado 🟢
- ✅ `npm run validate:docs` passa
- ✅ Testes de fluxo passam
- ✅ FLOWCHARTS.md atualizado <30 dias
- ✅ ADRs para decisões importantes

### Estado de Alerta 🟡
- ⚠️ Alguns botões não documentados
- ⚠️ FLOWCHARTS.md >30 dias desatualizado
- ⚠️ Warnings no validate-docs

### Estado Crítico 🔴
- ❌ `npm run validate:docs` quebra build
- ❌ Testes de fluxo falhando
- ❌ >10 botões não documentados
- ❌ FLOWCHARTS.md >90 dias desatualizado

---

## 🎓 Treinamento da Equipe

### Para Novos Devs
1. Leia `docs/architecture/ARCHITECTURE.md`
2. Veja `docs/architecture/FLOWCHARTS.md`
3. Rode `npm run test:flows` para entender fluxos
4. Leia ADRs para entender decisões
5. Instale hooks: `npm run setup:hooks`

### Para Code Review
- ✅ Código tem teste?
- ✅ Fluxo está documentado?
- ✅ Se decisão importante, tem ADR?
- ✅ Pre-commit hook passou?

---

## 🔧 Manutenção

### Mensalmente
- [ ] Rodar `npm run validate:docs`
- [ ] Revisar ADRs com data de revisão
- [ ] Atualizar FLOWCHARTS.md se necessário

### A cada Sprint
- [ ] Verificar warnings do validate-docs
- [ ] Atualizar docs obsoletas
- [ ] Criar ADRs para decisões tomadas

### A cada Release
- [ ] Atualizar versão no ARCHITECTURE.md
- [ ] Adicionar changelog
- [ ] Verificar links externos

---

## 📚 Referências

- [ADR Guidelines](./decisions/README.md)
- [Mermaid Docs](https://mermaid.js.org/)
- [Tests as Documentation](https://www.martinfowler.com/bliki/TestPyramid.html)
- [Living Documentation](https://www.infoq.com/articles/book-review-living-documentation/)

---

## ❓ FAQ

### P: Por que testes em tests/flows/?
**R**: Testes documentam comportamento esperado. Se teste quebra, doc está errada.

### P: Pre-commit hook é obrigatório?
**R**: Não, mas altamente recomendado. Instale com `npm run setup:hooks`.

### P: Como ver diagramas Mermaid?
**R**: GitHub renderiza automaticamente. Local: VS Code + extensão Mermaid.

### P: Toda mudança precisa ADR?
**R**: Não. Apenas decisões arquiteturais importantes e difíceis de reverter.

### P: E se validate-docs quebrar no CI?
**R**: Atualize FLOWCHARTS.md com os botões/filas faltantes e faça novo commit.

---

**Última atualização**: 2026-01-08
**Versão**: 1.0
