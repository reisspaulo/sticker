import { Job } from 'bullmq';
import logger from '../config/logger';
import { activatePixSubscription, ActivationResult } from '../services/pixPaymentService';
import { sendText } from '../services/evolutionApi';
import { sendButtons } from '../services/avisaApi';
import { getSubscriptionActivatedMessage } from '../services/menuService';
import { PlanType } from '../types/subscription';

export interface ActivatePixJobData {
  userNumber: string;
  userName: string;
  userId: string;
  plan: PlanType;
}

/**
 * Error messages by failure reason (text part only)
 */
const ERROR_MESSAGES = {
  not_confirmed: (attempts: number) =>
    `❌ *Pagamento não confirmado*\n\nNão detectamos a confirmação do seu pagamento PIX após ${attempts} tentativas.\n\n💡 *Possíveis motivos:*\n• Você não clicou em "Já Paguei"\n• O pagamento não foi concluído\n• O PIX expirou (30 minutos)`,

  no_payment_found: () =>
    `❌ *Pagamento não encontrado*\n\nNão encontramos um pagamento PIX pendente para você.\n\n💡 *O que pode ter acontecido:*\n• O PIX expirou (validade de 30 min)\n• Erro ao processar o pagamento`,

  database_error: () =>
    `😔 *Erro técnico ao ativar assinatura*\n\nSeu pagamento foi recebido, mas ocorreu um erro ao ativar seu plano.\n\n⚠️ *Não se preocupe!*\nNossa equipe já foi notificada e vai resolver isso rapidamente.`,

  unknown_error: () =>
    `😔 *Erro ao processar pagamento*\n\nOcorreu um erro inesperado ao processar seu pagamento PIX.\n\n⚠️ *Não se preocupe!*\nNossa equipe já foi notificada e vai resolver isso.`,
};

/**
 * Determine if failure is retryable
 */
function isRetryable(reason: ActivationResult['reason']): boolean {
  // Only retry database errors and unknown errors (might be temporary)
  return reason === 'database_error' || reason === 'unknown_error';
}

/**
 * Send error message with appropriate buttons based on failure reason
 */
async function sendErrorWithButtons(
  userNumber: string,
  reason: ActivationResult['reason'],
  errorMessage: string,
  plan: PlanType
): Promise<void> {
  // First send the error message text
  await sendText(userNumber, errorMessage);

  // Small delay to ensure message order
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Then send buttons based on the error type
  try {
    if (reason === 'not_confirmed' || reason === 'no_payment_found') {
      // User needs to try again or get help
      await sendButtons({
        number: userNumber,
        title: '🔄 *O que deseja fazer?*',
        desc: 'Escolha uma opção:',
        footer: 'Estamos aqui para ajudar',
        buttons: [
          {
            id: `retry_pix_${plan}`,
            text: '🔄 Gerar Novo PIX',
          },
          {
            id: 'contact_support',
            text: '📞 Falar com Suporte',
          },
        ],
      });
    } else {
      // Database or unknown error - payment was received, needs support
      await sendButtons({
        number: userNumber,
        title: '📞 *Precisa de ajuda?*',
        desc: 'Nossa equipe pode resolver isso rapidamente:',
        footer: 'Seu pagamento está seguro',
        buttons: [
          {
            id: 'contact_support_urgent',
            text: '📞 Falar com Suporte',
          },
        ],
      });
    }
  } catch (buttonError) {
    // If buttons fail, log but don't fail the job
    logger.error({
      msg: '[PIX JOB] Failed to send error buttons, falling back to text only',
      userNumber,
      error: buttonError instanceof Error ? buttonError.message : 'Unknown error',
    });

    // Fallback: send text with instructions
    await sendText(
      userNumber,
      reason === 'not_confirmed' || reason === 'no_payment_found'
        ? '💡 Para tentar novamente, digite *planos*. Para suporte, digite *ajuda*.'
        : '💡 Para falar com suporte, digite *ajuda*.'
    );
  }
}

/**
 * Job to activate PIX subscription after 5-minute delay
 * This allows time for PIX payment to be processed by the bank
 * Includes automatic retry logic with exponential backoff
 */
export async function activatePendingPixSubscriptionJob(
  job: Job<ActivatePixJobData>
): Promise<void> {
  const { userNumber, userName, userId, plan } = job.data;
  const attemptNumber = job.attemptsMade;
  const maxAttempts = 3;
  const isFinalAttempt = attemptNumber >= maxAttempts - 1;

  logger.info({
    msg: '[PIX JOB] Starting PIX subscription activation job',
    jobId: job.id,
    userNumber,
    userName,
    userId,
    plan,
    attemptNumber,
    maxAttempts,
    isFinalAttempt,
  });

  // Activate subscription
  const result = await activatePixSubscription(userNumber);

  // Handle successful activation
  if (result.success) {
    await sendText(userNumber, getSubscriptionActivatedMessage(plan));

    // Log experiment event for converted
    try {
      const { logExperimentEvent, getUpgradeDismissVariant } = await import(
        '../services/experimentService'
      );
      const experimentResult = await getUpgradeDismissVariant(userId, userNumber);
      if (experimentResult) {
        await logExperimentEvent(
          userId,
          experimentResult.experiment_id,
          experimentResult.variant,
          'converted',
          { plan, payment_method: 'pix', source: 'pix_activation' }
        );
        logger.info({
          msg: '[PIX JOB] Experiment conversion logged',
          userId,
          variant: experimentResult.variant,
          plan,
        });
      }
    } catch (experimentError) {
      logger.warn({
        msg: '[PIX JOB] Failed to log experiment conversion event',
        error: experimentError instanceof Error ? experimentError.message : 'Unknown error',
        userId,
      });
      // Don't fail job - subscription was activated successfully
    }

    logger.info({
      msg: '[PIX JOB] PIX subscription activated successfully',
      jobId: job.id,
      userNumber,
      userId,
      plan,
      attemptNumber,
    });

    return;
  }

  // Handle failure
  logger.warn({
    msg: '[PIX JOB] PIX subscription activation failed',
    jobId: job.id,
    userNumber,
    attemptNumber,
    reason: result.reason,
    error: result.error,
    isFinalAttempt,
  });

  // For retryable errors, retry if not final attempt
  if (isRetryable(result.reason) && !isFinalAttempt) {
    logger.info({
      msg: '[PIX JOB] Will retry activation (retryable error)',
      jobId: job.id,
      userNumber,
      attemptNumber,
      nextAttempt: attemptNumber + 1,
      reason: result.reason,
    });

    // Throw to trigger retry
    throw new Error(`Activation failed (${result.reason}), will retry: ${result.error || 'unknown'}`);
  }

  // Get appropriate error message based on failure reason
  let errorMessage: string;

  switch (result.reason) {
    case 'not_confirmed':
      errorMessage = ERROR_MESSAGES.not_confirmed(maxAttempts);
      break;

    case 'no_payment_found':
      errorMessage = ERROR_MESSAGES.no_payment_found();
      break;

    case 'database_error':
      errorMessage = ERROR_MESSAGES.database_error();
      // Log critical error for monitoring
      logger.error({
        msg: '[PIX JOB] CRITICAL: Database error on PIX activation - requires manual intervention',
        jobId: job.id,
        userNumber,
        userName,
        userId,
        plan,
        error: result.error,
        alertType: 'pix_activation_database_error',
      });
      break;

    case 'unknown_error':
    default:
      errorMessage = ERROR_MESSAGES.unknown_error();
      // Log critical error for monitoring
      logger.error({
        msg: '[PIX JOB] CRITICAL: Unknown error on PIX activation - requires manual intervention',
        jobId: job.id,
        userNumber,
        userName,
        userId,
        plan,
        error: result.error,
        alertType: 'pix_activation_unknown_error',
      });
      break;
  }

  // Send error message with appropriate buttons
  await sendErrorWithButtons(userNumber, result.reason, errorMessage, plan);

  logger.info({
    msg: '[PIX JOB] Error message with buttons sent to user',
    jobId: job.id,
    userNumber,
    reason: result.reason,
  });

  // For non-retryable errors (not_confirmed, no_payment_found), don't throw
  // For retryable errors on final attempt, also don't throw (already sent message)
  if (isRetryable(result.reason)) {
    // Final attempt for retryable error - throw to mark job as failed
    throw new Error(`Activation failed after ${maxAttempts} attempts: ${result.reason}`);
  }

  // Non-retryable errors complete without throwing
  return;
}
