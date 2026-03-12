# Templates Meta Cloud API - StickerBot

Templates que precisam ser criados no Meta Business Manager.
Esses templates são usados quando o bot precisa enviar mensagem fora da janela de 24h.

**Portal:** Meta Business Manager → WhatsApp Manager → Message Templates

---

## Templates para criar

### 1. `sticker_pronto` (UTILITY)
**Quando:** Stickers pendentes prontos para envio (job das 8h)
```
Categoria: UTILITY
Idioma: pt_BR

Corpo:
Suas figurinhas estão prontas! 🎉 Enviamos {{1}} figurinha(s) que estavam pendentes. Mande uma imagem para criar mais!

Rodapé: StickerBot

Parâmetros: {{1}} = número de figurinhas
```

### 2. `limite_atingido` (MARKETING)
**Quando:** Reminder de upgrade (fora da janela de 24h)
```
Categoria: MARKETING
Idioma: pt_BR

Corpo:
Você atingiu o limite diário de figurinhas gratuitas. 😊 Conheça nossos planos a partir de R$ 5/mês e crie até 20 figurinhas por dia! Responda "planos" para saber mais.

Rodapé: StickerBot

Parâmetros: nenhum
```

### 3. `pagamento_confirmado` (UTILITY)
**Quando:** Confirmação de pagamento (pode estar fora da janela)
```
Categoria: UTILITY
Idioma: pt_BR

Corpo:
Pagamento confirmado! ✅ Seu plano {{1}} está ativo. Agora você pode criar até {{2}} figurinhas por dia. Mande uma imagem para começar!

Rodapé: StickerBot

Parâmetros: {{1}} = nome do plano, {{2}} = limite diário
```

### 4. `reengajamento` (MARKETING)
**Quando:** Usuário inativo há 30+ dias
```
Categoria: MARKETING
Idioma: pt_BR

Corpo:
Sentimos sua falta! 👋 Faz tempo que você não cria figurinhas. Mande uma imagem e transforme em sticker em segundos!

Rodapé: StickerBot

Parâmetros: nenhum
```

### 5. `pix_pendente` (UTILITY)
**Quando:** PIX não pago / expirado
```
Categoria: UTILITY
Idioma: pt_BR

Corpo:
Seu pagamento via PIX ainda está pendente. O código expira em breve! Responda "pix" para gerar um novo código ou "planos" para ver outras opções.

Rodapé: StickerBot

Parâmetros: nenhum
```

### 6. `mensagem_campanha` (MARKETING)
**Quando:** Mensagens de campanha genéricas
```
Categoria: MARKETING
Idioma: pt_BR

Corpo:
{{1}}

Rodapé: StickerBot

Parâmetros: {{1}} = corpo da mensagem
```

### 7. `entrega_figurinha` (UTILITY)
**Quando:** Sticker pronto mas usuário não está na janela de 24h
```
Categoria: UTILITY
Idioma: pt_BR

Corpo:
Sua figurinha está pronta! 🎨 Responda qualquer mensagem para recebê-la.

Rodapé: StickerBot

Parâmetros: nenhum
```

---

## Custos por template

| Categoria | Custo estimado (Brasil) |
|-----------|------------------------|
| UTILITY | ~R$ 0,15 por mensagem |
| MARKETING | ~R$ 0,35 por mensagem |

## Tempo de aprovação

- Templates simples: 1-24 horas
- Templates com variáveis: até 48 horas
- Rejeição comum: linguagem que parece spam, falta de opt-out

## Dicas para aprovação

1. Manter tom profissional e informativo
2. Incluir contexto claro (por que o usuário está recebendo)
3. Oferecer opção de resposta (engajamento)
4. Não usar linguagem de urgência excessiva
5. Templates UTILITY tem aprovação mais rápida que MARKETING
