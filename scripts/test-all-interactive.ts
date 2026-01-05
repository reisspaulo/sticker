import { sendButtons, sendList, sendPixButton } from '../src/services/avisaApi';
import chalk from 'chalk';
import * as readline from 'readline';

/**
 * Test all interactive message types to understand webhook responses
 */

const TEST_NUMBER = '5511946304133';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function testButtons() {
  console.log(chalk.blue.bold('\n🔘 TESTE 1: BUTTONS (Botões)\n'));

  const result = await sendButtons({
    number: TEST_NUMBER,
    title: '🧪 Teste Botões - Escolha uma opção',
    desc: 'Clique em um dos botões abaixo:',
    footer: 'StickerBot - Teste',
    buttons: [
      { id: 'button_test_a', text: 'Opção A 🅰️' },
      { id: 'button_test_b', text: 'Opção B 🅱️' }
    ]
  });

  console.log(chalk.green('✅ Botões enviados!'));
  console.log(chalk.gray('Message ID:'), result.data?.response?.data?.Id);

  console.log(chalk.yellow('\n👆 Clique em uma das opções no WhatsApp\n'));
  await prompt(chalk.cyan('Pressione ENTER depois de clicar... '));
}

async function testList() {
  console.log(chalk.blue.bold('\n📋 TESTE 2: LIST (Lista Interativa)\n'));

  const result = await sendList({
    number: TEST_NUMBER,
    buttontext: '📋 Ver Opções',
    desc: 'Escolha uma opção da lista:',
    toptext: '🧪 Teste de Lista',
    list: [
      {
        title: 'Opção Lista 1',
        desc: 'Primeira opção',
        RowId: 'list_test_1'
      },
      {
        title: 'Opção Lista 2',
        desc: 'Segunda opção',
        RowId: 'list_test_2'
      },
      {
        title: 'Opção Lista 3',
        desc: 'Terceira opção',
        RowId: 'list_test_3'
      }
    ]
  });

  console.log(chalk.green('✅ Lista enviada!'));
  console.log(chalk.gray('Message ID:'), result.data?.response?.data?.id);

  console.log(chalk.yellow('\n👆 Abra a lista e selecione uma opção no WhatsApp\n'));
  await prompt(chalk.cyan('Pressione ENTER depois de selecionar... '));
}

async function testPixButton() {
  console.log(chalk.blue.bold('\n💳 TESTE 3: PIX BUTTON (Botão PIX)\n'));

  const mockPixCode = '00020126580014br.gov.bcb.pix013662da7c8d-8f46-44e9-aed3-dc1c8762bd3e5204000053039865802BR5913StickerBot6009SAO PAULO62410503***50300017br.gov.bcb.brcode01051.0.06304A8F3';

  const result = await sendPixButton({
    number: TEST_NUMBER,
    pix: mockPixCode
  });

  console.log(chalk.green('✅ PIX enviado!'));
  console.log(chalk.gray('Message ID:'), result.data?.response?.data?.Id);

  console.log(chalk.yellow('\n📌 NOTA: PIX Button provavelmente NÃO gera resposta no webhook'));
  console.log(chalk.gray('É apenas uma mensagem de texto com código copiável.\n'));

  await prompt(chalk.cyan('Pressione ENTER para continuar... '));
}

async function showInstructions() {
  console.log(chalk.blue.bold('\n🧪 TESTE COMPLETO DE MENSAGENS INTERATIVAS\n'));
  console.log(chalk.white('Objetivo: Descobrir como cada tipo de mensagem chega no webhook\n'));

  console.log(chalk.yellow('📋 Vamos testar:\n'));
  console.log(chalk.gray('  1. 🔘 Botões (buttons)'));
  console.log(chalk.gray('  2. 📋 Lista (list)'));
  console.log(chalk.gray('  3. 💳 PIX Button\n'));

  console.log(chalk.cyan('🔍 Como verificar os logs:\n'));
  console.log(chalk.white('Em outro terminal, rode:'));
  console.log(chalk.gray('  vps-ssh "docker logs -f sticker_backend.1.1x6h5biwjl9kdf5kiq8xo7l81 2>&1 | grep -A 20 \'Webhook received\'"\n'));

  await prompt(chalk.cyan('Pressione ENTER para começar os testes... '));
}

async function showResults() {
  console.log(chalk.blue.bold('\n📊 RESULTADOS ESPERADOS:\n'));

  console.log(chalk.yellow('1️⃣ BUTTONS (Botões):'));
  console.log(chalk.gray('   messageType: "buttonsResponseMessage"'));
  console.log(chalk.gray('   message.buttonsResponseMessage.selectedButtonId: "button_test_a"'));
  console.log(chalk.gray('   message.buttonsResponseMessage.selectedDisplayText: "Opção A 🅰️"\n'));

  console.log(chalk.yellow('2️⃣ LIST (Lista):'));
  console.log(chalk.gray('   messageType: "listResponseMessage"'));
  console.log(chalk.gray('   message.listResponseMessage.singleSelectReply.selectedRowId: "list_test_1"'));
  console.log(chalk.gray('   message.listResponseMessage.title: "Opção Lista 1"\n'));

  console.log(chalk.yellow('3️⃣ PIX:'));
  console.log(chalk.gray('   Provavelmente não gera webhook (apenas mensagem de texto)\n'));

  console.log(chalk.green.bold('✅ TESTES CONCLUÍDOS!\n'));
  console.log(chalk.white('Agora você pode verificar os logs e anotar as estruturas que chegaram.\n'));
  console.log(chalk.cyan('📝 Vou criar um resumo com base nos testes anteriores...\n'));
}

async function runAllTests() {
  try {
    await showInstructions();

    console.log(chalk.gray('\n' + '═'.repeat(80) + '\n'));

    // Test 1: Buttons
    await testButtons();

    console.log(chalk.gray('\n' + '═'.repeat(80) + '\n'));

    // Test 2: List
    await testList();

    console.log(chalk.gray('\n' + '═'.repeat(80) + '\n'));

    // Test 3: PIX
    await testPixButton();

    console.log(chalk.gray('\n' + '═'.repeat(80) + '\n'));

    // Show results
    await showResults();

    rl.close();
    process.exit(0);

  } catch (error) {
    console.error(chalk.red('\n💥 ERRO:'), error);
    rl.close();
    process.exit(1);
  }
}

// Run tests
runAllTests();
