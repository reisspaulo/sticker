-- ============================================
-- UPDATE EXPERIMENT: upgrade_dismiss_v1 -> upgrade_message_v1
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================

-- Atualiza o experimento existente com as novas variantes de mensagem
UPDATE experiments
SET
  name = 'upgrade_message_v1',
  description = 'Teste de diferentes mensagens e tons no menu de limite atingido',
  variants = '{
    "control": {
      "weight": 25,
      "config": {
        "message_title": "⚠️ *Limite Atingido!* {emoji}",
        "message_body": "Você já usou *{count}/{limit} {feature}* hoje.\n\nSeu limite será renovado às *00:00* (horário de Brasília).\n\n💎 *FAÇA UPGRADE E TENHA MAIS!*\n\n💰 *Premium (R$ 5/mês)*\n• 20 figurinhas/dia\n\n🚀 *Ultra (R$ 9,90/mês)*\n• Figurinhas *ILIMITADAS*",
        "button_dismiss_text": "❌ Agora Não",
        "button_dismiss_id": "button_dismiss_upgrade",
        "button_premium_text": "💰 Premium - R$ 5/mês",
        "button_ultra_text": "🚀 Ultra - R$ 9,90/mês",
        "show_dismiss_button": true
      }
    },
    "social_proof": {
      "weight": 25,
      "config": {
        "message_title": "*Suas figurinhas de hoje acabaram* 😊",
        "message_body": "Você usou {count}/{limit}.\n\nMais de 150 pessoas fizeram upgrade este mês para criar sem esperar.\n\nPremium: 20/dia por R$ 5\nUltra: Sem limite por R$ 9,90",
        "button_dismiss_text": "Depois",
        "button_dismiss_id": "button_dismiss_upgrade",
        "button_premium_text": "Quero Premium",
        "button_ultra_text": "Quero Ultra",
        "show_dismiss_button": true
      }
    },
    "benefit": {
      "weight": 25,
      "config": {
        "message_title": "*{count}/{limit} figurinhas usadas* ✨",
        "message_body": "Com Premium você teria +16 hoje.\nCom Ultra, sem limite nenhum.\n\nPremium: R$ 5/mês\nUltra: R$ 9,90/mês",
        "button_dismiss_text": "Esperar",
        "button_dismiss_id": "button_dismiss_upgrade",
        "button_premium_text": "Premium +16/dia",
        "button_ultra_text": "Ultra Ilimitado",
        "show_dismiss_button": true
      }
    },
    "hybrid": {
      "weight": 25,
      "config": {
        "message_title": "*Fim das figurinhas de hoje* 🎨",
        "message_body": "Usuários Premium criam em média 12 figurinhas por dia.\nUsuários Ultra criam sem limite.\n\nQual combina mais com você?",
        "button_dismiss_text": "Nenhum",
        "button_dismiss_id": "button_dismiss_upgrade",
        "button_premium_text": "Premium R$5",
        "button_ultra_text": "Ultra R$9,90",
        "show_dismiss_button": true
      }
    }
  }'::jsonb,
  notes = 'Atualizado em 09/01/2026 para testar mensagens diferentes (social proof, benefit, hybrid)'
WHERE name = 'upgrade_dismiss_v1';

-- Verificar se a atualização funcionou
SELECT id, name, status, variants FROM experiments WHERE name = 'upgrade_message_v1';
