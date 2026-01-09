# ADR 003: Teste A/B - Bonus Credits vs Direct Blocking

## Status
✅ **Aceito** (2026-01-08)

## Contexto

O plano gratuito tem limite de 4 figurinhas/dia. Quando usuários atingem o limite, há 2 estratégias possíveis:

1. **Bloquear imediatamente** e mostrar upgrade (conversão direta)
2. **Oferecer bônus grátis** antes do upgrade (goodwill → conversão)

**Hipótese**: Usuários que recebem bônus convertem mais (por reciprocidade) do que bloqueio direto (por frustração).

## Decisão

Implementar **teste A/B com 2 grupos**:

### Grupo Control (50%)
- Atinge limite → bloqueio imediato
- Vê apenas botões de upgrade
- Stickers ficam pendentes (envio 8h)

### Grupo Bonus (50%)
- Atinge limite → ganha **+2 créditos extras**
- Botão "🎁 Usar Bônus" aparece primeiro
- Após usar bônus → vê upgrade
- Máximo 2 bônus/dia

## Justificativa

**Por que testar?**
- 📊 Dados > Opinião: Testar antes de decidir
- 💰 Conversão é métrica crítica
- 🧪 A/B test é padrão da indústria

**Por que bônus pode funcionar?**
- 🎁 **Reciprocidade**: "Ganhei algo, devo retribuir"
- 😊 **Goodwill**: Experiência positiva aumenta trust
- 🔄 **Engajamento**: Mais uso = mais attachment

**Por que bloquear pode funcionar?**
- 🚨 **Urgência**: "Preciso agora"
- 💎 **Scarcity**: "Acabou, preciso pagar"
- 🎯 **Direct CTA**: Menos steps até conversão

## Consequências

### Positivas
- ✅ Decisão baseada em dados
- ✅ Testa hipótese de goodwill
- ✅ Não queima relação com usuários (50% ganham bônus)
- ✅ Logs detalhados para análise

### Negativas
- ⚠️ Complexidade: 2 fluxos diferentes
- ⚠️ Precisa tracking robusto
- ⚠️ Risco: Bônus pode cannibalizar conversão

### Métricas Rastreadas
```typescript
// Eventos A/B
- ab_test_bonus_offered     // Bonus group vê botão
- ab_test_bonus_used        // Usuário clica "Usar Bônus"
- ab_test_upgrade_click     // Qualquer grupo clica upgrade
- ab_test_upgrade_dismissed // Usuário dispensa upgrade
- ab_test_conversion_paid   // Completou pagamento
```

## Implementação

### Atribuição de Grupo (Cadastro)
```typescript
const ab_test_group = Math.random() < 0.5 ? 'control' : 'bonus';

await supabase.users.insert({
  whatsapp_number,
  ab_test_group,
  bonus_credits_today: 0
});
```

### Fluxo no Limite
```typescript
if (user.daily_count >= user.daily_limit) {
  if (user.ab_test_group === 'bonus' && user.bonus_credits_today < 2) {
    // Mostra botão "🎁 Usar Bônus (+2)"
    await sendLimitReachedMenu({ showBonus: true });
  } else {
    // Bloqueia e mostra upgrade
    await sendLimitReachedMenu({ showBonus: false });
  }
}
```

### Reset Diário
```typescript
// Meia-noite: reseta daily_count E bonus_credits_today
UPDATE users SET
  daily_count = 0,
  bonus_credits_today = 0
```

## Critérios de Sucesso (30 dias)

### Métricas Primárias
- **Conversão Premium**: % que pagou em 7 dias
- **Conversão Ultra**: % que pagou em 7 dias

### Métricas Secundárias
- **Engajamento**: Média stickers/usuário/semana
- **Retenção D7**: % que voltou após 7 dias
- **NPS**: Satisfação (survey)

### Thresholds de Decisão
- Se Bonus converter **+20%** → adota permanentemente
- Se Bonus converter **-10%** → remove bônus
- Se diferença <10% → mantém control (mais simples)

## Análise Esperada

### Hipótese 1: Bonus > Control
```
Resultado: Bonus converte 25% vs Control 18%
Decisão: Adota bonus para todos usuários
```

### Hipótese 2: Control > Bonus
```
Resultado: Control converte 22% vs Bonus 15%
Decisão: Remove bonus, bloqueia todos
```

### Hipótese 3: Empate
```
Resultado: Ambos convertem ~20%
Decisão: Mantém control (código mais simples)
```

## Alternativas Consideradas

### 1. Sem teste (bloquear todos)
- **Prós**: Simples
- **Contras**: Pode frustrar usuários, menor conversão
- **Decisão**: Rejeitado - queremos dados

### 2. Bonus para todos
- **Prós**: Boa experiência
- **Contras**: Pode cannibalizar conversão, sem controle
- **Decisão**: Rejeitado - precisa validar hipótese

### 3. Teste com 3+ grupos
- **Prós**: Mais granularidade (ex: +1, +2, +3 bônus)
- **Contras**: Precisa mais amostra, mais complexo
- **Decisão**: Rejeitado - começar simples (2 grupos)

## Próximos Passos

1. **Dia 1-7**: Coletar dados, validar tracking
2. **Dia 8-30**: Acumular amostra significativa (min 200 users/grupo)
3. **Dia 31**: Análise estatística (t-test)
4. **Dia 32**: Decisão final + implementação

## Referências
- Influence by Cialdini (Reciprocidade)
- A/B Testing Best Practices: https://www.optimizely.com/optimization-glossary/ab-testing/
- Statistical Significance Calculator: https://www.surveymonkey.com/mp/ab-testing-significance-calculator/

## Revisão
Próxima revisão: 2026-02-08 (após 30 dias de teste)
