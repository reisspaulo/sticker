# Feature: [Nome da Feature]

**Data:** YYYY-MM-DD
**Status:** 🚧 Em Desenvolvimento / ✅ Concluído / 🚀 Em Produção
**Componente:** Backend / Admin Panel / Ambos

---

## 📋 Resumo

[Descrição breve da feature em 2-3 frases]

---

## 🎯 Objetivo

### Problema que Resolve
[Descrever o problema ou necessidade]

### Valor para o Usuário
[Benefício direto para o usuário final]

---

## 🏗️ Implementação

### Arquitetura

```
[Diagrama ou descrição da arquitetura]
```

### Arquivos Principais

**Criados:**
- `caminho/arquivo1.ts` - Descrição
- `caminho/arquivo2.ts` - Descrição

**Modificados:**
- `caminho/arquivo3.ts` - O que mudou
- `caminho/arquivo4.ts` - O que mudou

### Dependências Adicionadas

```json
{
  "biblioteca-x": "^1.0.0",
  "biblioteca-y": "^2.0.0"
}
```

**Por que essas dependências?**
[Justificativa]

---

## 🔧 Configuração

### Variáveis de Ambiente

```bash
# Doppler (produção)
NOVA_VARIAVEL=valor_exemplo

# .env.local (desenvolvimento)
NOVA_VARIAVEL=valor_local
```

### Migrações do Supabase

```sql
-- Se houver mudanças no banco
CREATE TABLE ...
ALTER TABLE ...
```

### Deploy Steps

1. [ ] Adicionar variáveis no Doppler
2. [ ] Rodar migrações no Supabase
3. [ ] Deploy do código
4. [ ] Verificar logs

---

## 🧪 Testes

### Testes Automatizados

```typescript
// tests/features/nova-feature.test.ts
describe('Nova Feature', () => {
  it('deve fazer X', () => {
    expect(...).toBe(...)
  })
})
```

### Testes Manuais

**Cenário 1: [Nome do cenário]**
1. Passo 1
2. Passo 2
3. Resultado esperado: ...

**Cenário 2: [Nome do cenário]**
1. Passo 1
2. Passo 2
3. Resultado esperado: ...

### Resultados dos Testes

```
✅ Teste 1: PASSOU
✅ Teste 2: PASSOU
❌ Teste 3: FALHOU (corrigido em commit abc123)
```

---

## 📊 Métricas

### Performance

- Tempo de resposta: Xms
- Queries executadas: Y
- Uso de memória: Z MB

### Uso

- Feature será usada em: [contexto]
- Frequência esperada: [diária/semanal/etc]

---

## 🚀 Deploy

### Checklist Pré-Deploy

- [ ] Testes locais passando
- [ ] Build de produção OK
- [ ] Documentação atualizada
- [ ] Variáveis de ambiente configuradas
- [ ] Migrações testadas

### Deploy Realizado

**Data:** YYYY-MM-DD HH:MM
**Commit:** abc123
**Deploy por:** Nome
**URL:** https://...

### Verificação Pós-Deploy

- [ ] Feature funciona em produção
- [ ] Sem erros nos logs
- [ ] Performance OK
- [ ] Métricas normais

---

## 🐛 Troubleshooting

### Problema Comum 1

**Sintomas:** [descrição]

**Causa:** [causa raiz]

**Solução:**
```bash
# Comandos ou passos para resolver
```

### Problema Comum 2

**Sintomas:** [descrição]

**Causa:** [causa raiz]

**Solução:**
```bash
# Comandos ou passos para resolver
```

---

## 📚 Documentação Relacionada

- [Link para ADR (se houver)](./decisions/xxx.md)
- [Link para documentação externa]
- [Link para issue/PR]

---

## 🔄 Próximos Passos

### Melhorias Futuras

- [ ] Melhoria 1
- [ ] Melhoria 2
- [ ] Melhoria 3

### Issues Conhecidas

- Issue 1: [descrição] - Ticket #123
- Issue 2: [descrição] - Ticket #456

---

## 📝 Notas de Desenvolvimento

[Anotações úteis sobre decisões tomadas durante o desenvolvimento]

### Por que escolhemos X ao invés de Y?

[Explicação]

### Alternativas Consideradas

1. **Opção A:** [prós e contras]
2. **Opção B:** [prós e contras]
3. **Opção escolhida:** [por quê]

---

**Autor:** [Nome]
**Revisado por:** [Nome]
**Última Atualização:** YYYY-MM-DD
