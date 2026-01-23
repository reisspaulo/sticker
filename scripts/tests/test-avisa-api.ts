import { sendButtons, sendPixButton, sendList } from '../src/services/avisaApi';

/**
 * Test script for Avisa API endpoints
 */

const TEST_NUMBER = '5511999999999';

async function testSendButtons() {
  console.log('\n🔘 Testando Send Buttons...\n');

  try {
    const result = await sendButtons({
      number: TEST_NUMBER,
      title: '💎 Escolha seu plano - StickerBot',
      desc: 'Selecione uma das opções abaixo para fazer upgrade:',
      footer: '🤖 Powered by StickerBot',
      buttons: [
        {
          id: 'premium',
          text: '💰 Premium R$ 5'
        },
        {
          id: 'ultra',
          text: '🚀 Ultra R$ 9,90'
        }
      ]
    });

    console.log('✅ Send Buttons - SUCESSO!');
    console.log('📊 Resposta:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Send Buttons - ERRO:');
    console.error(error instanceof Error ? error.message : error);
  }
}

async function testPixButton() {
  console.log('\n💳 Testando PIX Button...\n');

  try {
    // Mock PIX code (você pode substituir por um real)
    const mockPixCode = '00020126580014br.gov.bcb.pix013662da7c8d-8f46-44e9-aed3-dc1c8762bd3e5204000053039865802BR5913StickerBot6009SAO PAULO62410503***50300017br.gov.bcb.brcode01051.0.06304A8F3';

    const result = await sendPixButton({
      number: TEST_NUMBER,
      pix: mockPixCode
    });

    console.log('✅ PIX Button - SUCESSO!');
    console.log('📊 Resposta:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ PIX Button - ERRO:');
    console.error(error instanceof Error ? error.message : error);
  }
}

async function testSendList() {
  console.log('\n📋 Testando Send List...\n');

  try {
    const result = await sendList({
      number: TEST_NUMBER,
      buttontext: '📋 Ver Planos Disponíveis',
      desc: 'Escolha o plano ideal para você:',
      toptext: '💎 StickerBot - Planos',
      list: [
        {
          title: '🆓 Plano Gratuito',
          desc: '4 figurinhas/dia',
          RowId: 'free'
        },
        {
          title: '💰 Premium - R$ 5,00',
          desc: '20 figurinhas/dia, sem marca d\'água',
          RowId: 'premium'
        },
        {
          title: '🚀 Ultra - R$ 9,90',
          desc: 'ILIMITADO + Prioritário',
          RowId: 'ultra'
        }
      ]
    });

    console.log('✅ Send List - SUCESSO!');
    console.log('📊 Resposta:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Send List - ERRO:');
    console.error(error instanceof Error ? error.message : error);
  }
}

async function runTests() {
  console.log('🚀 Iniciando testes da Avisa API...');
  console.log(`📱 Número de teste: ${TEST_NUMBER}\n`);

  // Test 1: Send Buttons
  await testSendButtons();

  // Wait 3 seconds between tests
  console.log('\n⏳ Aguardando 3 segundos...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 2: PIX Button
  await testPixButton();

  // Wait 3 seconds between tests
  console.log('\n⏳ Aguardando 3 segundos...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test 3: Send List
  await testSendList();

  console.log('\n✨ Testes concluídos!\n');
}

// Run tests
runTests()
  .then(() => {
    console.log('🎉 Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
