import { sendButtons, sendList, sendPixButton } from '../src/services/avisaApi';

/**
 * Automated test - sends all messages at once
 */

const TEST_NUMBER = '5511999999999';

async function runTests() {
  console.log('🚀 Enviando todas as mensagens interativas...\n');

  try {
    // Test 1: Buttons
    console.log('🔘 1. Enviando BOTÕES...');
    const buttonsResult = await sendButtons({
      number: TEST_NUMBER,
      title: '🧪 TESTE 1 - BOTÕES',
      desc: 'Clique em uma das opções abaixo:',
      footer: 'StickerBot - Teste Botões',
      buttons: [
        { id: 'button_test_a', text: 'Opção A 🅰️' },
        { id: 'button_test_b', text: 'Opção B 🅱️' }
      ]
    });
    console.log('   ✅ Enviado! ID:', buttonsResult.data?.response?.data?.Id);

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: List
    console.log('\n📋 2. Enviando LISTA...');
    const listResult = await sendList({
      number: TEST_NUMBER,
      buttontext: '📋 Ver Opções',
      desc: 'Escolha uma opção da lista:',
      toptext: '🧪 TESTE 2 - LISTA',
      list: [
        {
          title: 'Opção Lista 1 ①',
          desc: 'Primeira opção da lista',
          RowId: 'list_test_1'
        },
        {
          title: 'Opção Lista 2 ②',
          desc: 'Segunda opção da lista',
          RowId: 'list_test_2'
        },
        {
          title: 'Opção Lista 3 ③',
          desc: 'Terceira opção da lista',
          RowId: 'list_test_3'
        }
      ]
    });
    console.log('   ✅ Enviado! ID:', listResult.data?.response?.data?.id);

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: PIX
    console.log('\n💳 3. Enviando PIX BUTTON...');
    const mockPixCode = '00020126580014br.gov.bcb.pix013662da7c8d-8f46-44e9-aed3-dc1c8762bd3e5204000053039865802BR5913StickerBot6009SAO PAULO62410503***50300017br.gov.bcb.brcode01051.0.06304A8F3';

    const pixResult = await sendPixButton({
      number: TEST_NUMBER,
      pix: mockPixCode
    });
    console.log('   ✅ Enviado! ID:', pixResult.data?.response?.data?.Id);

    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ TODAS AS MENSAGENS ENVIADAS!\n');

    console.log('📱 AGORA FAÇA NO WHATSAPP:\n');
    console.log('   1. 🔘 Clique em um dos BOTÕES (A ou B)');
    console.log('   2. 📋 Abra a LISTA e selecione uma opção (1, 2 ou 3)');
    console.log('   3. 💳 PIX é só para verificar (não precisa interagir)\n');

    console.log('⏳ Aguardando 30 segundos para você interagir...\n');

    // Wait 30 seconds for user to interact
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log('🔍 Agora vou verificar os logs...\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

runTests();
