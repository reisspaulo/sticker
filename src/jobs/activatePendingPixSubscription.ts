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
 */
export async function activatePendingPixSubscriptionJob(
  job: Job<ActivatePixJobData>
): Promise<void> {
  const { userNumber, userId, plan } = job.data;

  logger.info({
    msg: 'Starting PIX subscription activation job',
    jobId: job.id,
    userNumber,
    plan,
  });

  try {
    // Activate subscription
    const success = await activatePixSubscription(userNumber);

    if (!success) {
      logger.warn({
        msg: 'PIX subscription activation failed',
        jobId: job.id,
        userNumber,
        reason: 'User did not confirm payment or payment expired',
      });

      // Send message to user
      await sendText(
        userNumber,
        `❌ *Pagamento não confirmado*\n\nNão detectamos a confirmação do seu pagamento PIX.\n\nSe você já pagou, entre em contato conosco.\n\nPara tentar novamente, digite *planos*.`
      );

      return;
    }

    // Send activation confirmation
    await sendText(userNumber, getSubscriptionActivatedMessage(plan));

    logger.info({
      msg: 'PIX subscription activated successfully',
      jobId: job.id,
      userNumber,
      userId,
      plan,
    });
  } catch (error) {
    logger.error({
      msg: 'Error in PIX subscription activation job',
      jobId: job.id,
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Send error message to user
    await sendText(
      userNumber,
      `😔 *Erro ao ativar assinatura*\n\nOcorreu um erro ao processar seu pagamento PIX.\n\nPor favor, entre em contato conosco.\n\nDigite *ajuda* para mais informações.`
    );

    throw error;
  }
}
