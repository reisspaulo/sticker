import { Job } from 'bullmq';
import logger from '../config/logger';
import { activatePixSubscription } from '../services/pixPaymentService';
import { sendText } from '../services/evolutionApi';
import { getSubscriptionActivatedMessage } from '../services/menuService';
import { PlanType } from '../types/subscription';

export interface ActivatePixJobData {
  userNumber: string;
  userName: string;
  userId: string;
  plan: PlanType;
}

/**
 * Job to activate PIX subscription after 5-minute delay
 * This allows time for PIX payment to be processed by the bank
 * Includes automatic retry logic with exponential backoff
 */
export async function activatePendingPixSubscriptionJob(
  job: Job<ActivatePixJobData>
): Promise<void> {
  const { userNumber, userId, plan } = job.data;
  const attemptNumber = job.attemptsMade;
  const maxAttempts = 3;

  logger.info({
    msg: '[PIX JOB] Starting PIX subscription activation job',
    jobId: job.id,
    userNumber,
    userId,
    plan,
    attemptNumber,
    maxAttempts,
  });

  try {
    // Activate subscription
    const success = await activatePixSubscription(userNumber);

    if (!success) {
      logger.warn({
        msg: '[PIX JOB] PIX subscription activation failed',
        jobId: job.id,
        userNumber,
        attemptNumber,
        reason: 'User did not confirm payment or payment expired',
      });

      // Only send "not confirmed" message on final attempt
      if (attemptNumber >= maxAttempts - 1) {
        await sendText(
          userNumber,
          `❌ *Pagamento não confirmado*\n\nNão detectamos a confirmação do seu pagamento PIX após ${maxAttempts} tentativas.\n\n💡 *Possíveis motivos:*\n• Você não clicou em "Já Paguei"\n• O pagamento não foi concluído\n• Ocorreu um erro temporário\n\n📞 *Já pagou?*\nEntre em contato conosco que resolveremos!\n\nPara tentar novamente, digite *planos*.`
        );
      } else {
        logger.info({
          msg: '[PIX JOB] Will retry activation',
          jobId: job.id,
          userNumber,
          attemptNumber,
          nextAttempt: attemptNumber + 1,
        });
        // Throw to trigger retry
        throw new Error('Payment not confirmed, will retry');
      }

      return;
    }

    // Send activation confirmation
    await sendText(userNumber, getSubscriptionActivatedMessage(plan));

    logger.info({
      msg: '[PIX JOB] PIX subscription activated successfully',
      jobId: job.id,
      userNumber,
      userId,
      plan,
      attemptNumber,
    });
  } catch (error) {
    logger.error({
      msg: '[PIX JOB] Error in PIX subscription activation job',
      jobId: job.id,
      userNumber,
      attemptNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Only send error message on final attempt
    if (attemptNumber >= maxAttempts - 1) {
      await sendText(
        userNumber,
        `😔 *Erro ao ativar assinatura*\n\nOcorreu um erro ao processar seu pagamento PIX após ${maxAttempts} tentativas.\n\n📞 *Precisa de ajuda?*\nEntre em contato conosco que resolveremos imediatamente!\n\nDigite *ajuda* para mais informações.`
      );
    }

    // Re-throw to trigger retry (BullMQ will handle exponential backoff)
    throw error;
  }
}
