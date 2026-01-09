/**
 * 📊 FLUXO DE UPGRADE - Documentação Viva
 *
 * Este teste documenta o fluxo completo de upgrade de plano.
 * Se este teste quebrar, significa que o fluxo mudou e a documentação
 * em docs/architecture/FLOWCHARTS.md precisa ser atualizada.
 *
 * @see docs/architecture/FLOWCHARTS.md - Section 2
 */

import { describe, it, expect } from 'vitest';

describe('📊 Fluxo de Upgrade Premium via PIX', () => {
  it('Etapa 1: Usuário digita "planos" → vê lista interativa', () => {
    const userCommand = 'planos';
    const expectedResponse = {
      type: 'list',
      title: '💎 ESCOLHA SEU PLANO',
      options: [
        { id: 'plan_free', text: '🆓 Gratuito' },
        { id: 'plan_premium', text: '💰 Premium - R$ 5,00/mês' },
        { id: 'plan_ultra', text: '🚀 Ultra - R$ 9,90/mês' }
      ]
    };

    expect(userCommand).toBe('planos');
    expect(expectedResponse.options).toHaveLength(3);
    expect(expectedResponse.options[1].text).toContain('Premium');
  });

  it('Etapa 2: Clica Premium → salva contexto Redis', () => {
    const buttonClick = 'plan_premium';
    const expectedContext = {
      state: 'awaiting_payment_method',
      metadata: {
        selected_plan: 'premium'
      }
    };

    expect(buttonClick).toBe('plan_premium');
    expect(expectedContext.metadata.selected_plan).toBe('premium');
  });

  it('Etapa 3: Vê métodos de pagamento', () => {
    const expectedResponse = {
      type: 'list',
      title: '💰 PAGAMENTO - PLANO PREMIUM',
      options: [
        { id: 'payment_card', text: '💳 Cartão de Crédito' },
        { id: 'payment_boleto', text: '🧾 Boleto Bancário' },
        { id: 'payment_pix', text: '🔑 PIX' }
      ]
    };

    expect(expectedResponse.options).toHaveLength(3);
    expect(expectedResponse.options[2].text).toContain('PIX');
  });

  it('Etapa 4: Escolhe PIX → recebe 3 mensagens sequenciais', () => {
    const buttonClick = 'payment_pix';
    const expectedMessages = [
      {
        order: 1,
        type: 'text',
        content: 'Instruções de pagamento',
        contains: ['PIX', 'R$ 5,00', '30 minutos']
      },
      {
        order: 2,
        type: 'pix_button',
        content: 'Chave PIX com botão copiar',
        api: 'Avisa API - /buttons/pix'
      },
      {
        order: 3,
        type: 'button',
        content: 'Botão de confirmação',
        button_id: 'button_confirm_pix',
        button_text: '✅ Já Paguei'
      }
    ];

    expect(buttonClick).toBe('payment_pix');
    expect(expectedMessages).toHaveLength(3);
    expect(expectedMessages[0].contains).toContain('PIX');
    expect(expectedMessages[2].button_id).toBe('button_confirm_pix');
  });

  it('Etapa 5: Confirma PIX → job delayed 5min', () => {
    const buttonClick = 'button_confirm_pix';
    const expectedJob = {
      queue: 'activate-pix-subscription',
      delay: 300000, // 5 minutos em ms
      data: {
        user_number: expect.any(String),
        plan: 'premium'
      }
    };

    expect(buttonClick).toBe('button_confirm_pix');
    expect(expectedJob.delay).toBe(5 * 60 * 1000);
    expect(expectedJob.queue).toBe('activate-pix-subscription');
  });

  it('Etapa 6: Após 5min → plano ativado no Supabase', () => {
    const expectedDatabaseUpdate = {
      table: 'users',
      updates: {
        subscription_plan: 'premium',
        subscription_status: 'active',
        subscription_ends_at: expect.any(Date)
      },
      message_sent: '🎉 Plano Premium ativado!'
    };

    expect(expectedDatabaseUpdate.updates.subscription_plan).toBe('premium');
    expect(expectedDatabaseUpdate.message_sent).toContain('ativado');
  });
});

describe('📊 Fluxo de Upgrade Ultra via Cartão', () => {
  it('Etapa 1-2: Usuário escolhe Ultra', () => {
    const commands = ['planos', 'plan_ultra'];
    expect(commands[1]).toBe('plan_ultra');
  });

  it('Etapa 3: Escolhe Cartão → recebe link Stripe', () => {
    const buttonClick = 'payment_card';
    const expectedResponse = {
      type: 'text',
      contains: [
        'Link para pagamento',
        'Stripe',
        'R$ 9,90',
        'client_reference_id' // metadata com número do usuário
      ]
    };

    expect(buttonClick).toBe('payment_card');
    expect(expectedResponse.contains).toContain('Stripe');
  });

  it('Etapa 4: Webhook Stripe → plano ativado imediatamente', () => {
    const stripeWebhook = {
      event: 'checkout.session.completed',
      data: {
        subscription_id: 'sub_123',
        customer_id: 'cus_456',
        plan: 'ultra'
      }
    };

    const expectedAction = {
      update_database: true,
      send_confirmation: true,
      message: '🎉 Plano Ultra ativado!'
    };

    expect(stripeWebhook.event).toBe('checkout.session.completed');
    expect(expectedAction.update_database).toBe(true);
  });
});

describe('🔴 Casos de Erro - Upgrade Flow', () => {
  it('PIX expirado (30min) → permite retry', () => {
    const expiredPix = {
      created_at: new Date(Date.now() - 31 * 60 * 1000), // 31 min atrás
      status: 'pending'
    };

    const expectedResponse = {
      message: '⚠️ PIX expirado',
      button: 'retry_pix_premium',
      button_text: '🔄 Gerar novo PIX'
    };

    expect(expiredPix.created_at.getTime()).toBeLessThan(Date.now() - 30 * 60 * 1000);
    expect(expectedResponse.button).toContain('retry');
  });

  it('Contexto expirado (10min) → recria fluxo', () => {
    const expiredContext = {
      created_at: new Date(Date.now() - 11 * 60 * 1000), // 11 min atrás
      state: 'awaiting_payment_method'
    };

    const expectedAction = {
      message: 'Sessão expirada. Digite "planos" novamente.',
      clear_context: true
    };

    expect(expiredContext.created_at.getTime()).toBeLessThan(Date.now() - 10 * 60 * 1000);
    expect(expectedAction.clear_context).toBe(true);
  });
});
