import { sendButtons, getWebhook } from '../src/services/avisaApi';
import chalk from 'chalk';

/**
 * Test script to understand how button responses work
 *
 * Flow:
 * 1. Show current Avisa API webhook
 * 2. Send a test button to user
 * 3. User clicks the button
 * 4. Check Evolution API webhook logs to see what arrives
 */

const TEST_NUMBER = '5511946304133';

async function runButtonTest() {
  console.log(chalk.blue.bold('\n🧪 TESTE DE RESPOSTAS DE BOTÕES\n'));
  console.log(chalk.gray('Objetivo: Descobrir como chegam as respostas dos botões da Avisa API\n'));

  try {
    // Step 1: Check current webhook configuration
    console.log(chalk.yellow('📡 Step 1: Verificando webhook atual da Avisa API...\n'));

    try {
      const webhookConfig = await getWebhook();
      console.log(chalk.green('✅ Webhook atual:'), webhookConfig.webhook || 'Não configurado');
    } catch (error) {
      console.log(chalk.red('❌ Erro ao buscar webhook:'), error instanceof Error ? error.message : error);
    }

    console.log(chalk.gray('\n' + '─'.repeat(80) + '\n'));

    // Step 2: Send test button
    console.log(chalk.yellow('🔘 Step 2: Enviando botão de teste...\n'));

    const result = await sendButtons({
      number: TEST_NUMBER,
      title: '🧪 TESTE DE BOTÕES - Clique em uma opção',
      desc: 'Estamos testando como as respostas chegam no webhook',
      footer: 'StickerBot - Teste Técnico',
      buttons: [
        {
          id: 'test_option_1',
          text: 'Opção 1 🟢'
        },
        {
          id: 'test_option_2',
          text: 'Opção 2 🔵'
        }
      ]
    });

    console.log(chalk.green('✅ Botão enviado com sucesso!'));
    console.log(chalk.gray('Message ID:'), result.data?.response?.data?.Id);

    console.log(chalk.gray('\n' + '─'.repeat(80) + '\n'));

    // Step 3: Instructions
    console.log(chalk.yellow.bold('👆 Step 3: CLIQUE EM UM DOS BOTÕES NO WHATSAPP\n'));
    console.log(chalk.white('Depois de clicar, verifique os logs do webhook:\n'));

    console.log(chalk.cyan('# Em outro terminal, rode:'));
    console.log(chalk.white('docker logs -f sticker-api --tail 50\n'));

    console.log(chalk.cyan('# Ou veja os logs do Doppler:'));
    console.log(chalk.white('tail -f /var/log/sticker-api.log\n'));

    console.log(chalk.gray('─'.repeat(80) + '\n'));

    // Step 4: What to look for
    console.log(chalk.yellow.bold('🔍 Step 4: O QUE PROCURAR NOS LOGS\n'));

    console.log(chalk.white('Quando você clicar no botão, procure por:'));
    console.log(chalk.gray('  1. Event type: "messages.upsert"'));
    console.log(chalk.gray('  2. Campo "message" na payload'));
    console.log(chalk.gray('  3. Possíveis estruturas:\n'));

    console.log(chalk.cyan('     Opção A (texto simples):'));
    console.log(chalk.gray('       message.conversation = "test_option_1" ou "Opção 1 🟢"\n'));

    console.log(chalk.cyan('     Opção B (buttonsResponseMessage):'));
    console.log(chalk.gray('       message.buttonsResponseMessage = {'));
    console.log(chalk.gray('         selectedButtonId: "test_option_1",'));
    console.log(chalk.gray('         selectedDisplayText: "Opção 1 🟢"'));
    console.log(chalk.gray('       }\n'));

    console.log(chalk.cyan('     Opção C (extendedTextMessage):'));
    console.log(chalk.gray('       message.extendedTextMessage.text = "test_option_1"\n'));

    console.log(chalk.gray('─'.repeat(80) + '\n'));

    // Step 5: Wait for user input
    console.log(chalk.yellow.bold('⏸️  AGUARDANDO...\n'));
    console.log(chalk.white('Pressione CTRL+C quando terminar de verificar os logs.\n'));
    console.log(chalk.gray('Este script vai ficar rodando para você poder analisar.\n'));

    // Keep running
    await new Promise(() => {}); // Infinite wait

  } catch (error) {
    console.error(chalk.red('\n💥 ERRO NO TESTE:\n'));
    console.error(error instanceof Error ? error.message : error);
    console.error('\n');
    process.exit(1);
  }
}

// Run test
runButtonTest();
