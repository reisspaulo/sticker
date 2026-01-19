import { supabase } from '../config/supabase';
import { rpc } from '../rpc';
import { sendText } from '../services/whatsappApi';
import { sendButtons } from '../services/whatsappApi';
import { logJobStart, logJobComplete, logJobFailed } from '../services/jobLogger';
import logger from '../config/logger';

/**
 * Process pending sequence steps
 * Runs every 5 minutes to check for steps that need to be sent
 *
 * This job:
 * 1. Checks cancel conditions and cancels sequences that met their goal
 * 2. Queries steps where next_scheduled_at <= NOW() and status in (pending, active)
 * 3. Fetches message template from sequence_messages
 * 4. Sends message to user
 * 5. Advances to next step or completes sequence
 */
export async function processSequenceStepsJob(): Promise<{
  totalProcessed: number;
  sent: number;
  failed: number;
  cancelled: number;
}> {
  const startTime = Date.now();
  const workerId = process.env.HOSTNAME || process.env.CONTAINER_ID || 'scheduler';
  const jobName = 'process-sequence-steps' as const;

  // Log job start
  const logId = await logJobStart(jobName);

  logger.info({
    msg: '[SEQUENCES-JOB] Starting process sequence steps job',
    workerId,
  });

  let totalProcessed = 0;
  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  try {
    // Step 1: Check and cancel sequences that met their cancel condition
    const cancelledCount = await rpc('check_sequence_cancel_conditions', {});
    cancelled = cancelledCount;

    if (cancelledCount > 0) {
      logger.info({
        msg: '[SEQUENCES-JOB] Cancelled sequences due to conditions met',
        cancelledCount,
        workerId,
      });
    }

    // Step 2: Get pending steps (returnFirst: false to get array)
    const pendingSteps = await rpc(
      'get_pending_sequence_steps',
      { p_limit: 50 },
      { returnFirst: false }
    );

    if (!pendingSteps || pendingSteps.length === 0) {
      logger.debug({
        msg: '[SEQUENCES-JOB] No pending sequence steps to process',
        workerId,
      });

      await logJobComplete(
        logId,
        jobName,
        { totalProcessed: 0, sent: 0, failed: 0, cancelled },
        Date.now() - startTime
      );

      return { totalProcessed: 0, sent: 0, failed: 0, cancelled };
    }

    logger.info({
      msg: '[SEQUENCES-JOB] Found pending sequence steps',
      count: pendingSteps.length,
      workerId,
    });

    // Step 3: Process each step
    for (const step of pendingSteps) {
      totalProcessed++;
      const stepStartTime = Date.now();

      try {
        logger.info({
          msg: '[SEQUENCES-JOB] Processing sequence step',
          userSequenceId: step.user_sequence_id,
          userNumber: step.user_number,
          sequenceName: step.sequence_name,
          currentStep: step.current_step,
          messageKey: step.message_key,
          position: `${totalProcessed}/${pendingSteps.length}`,
          workerId,
        });

        // Fetch message template
        const { data: messageTemplate, error: msgError } = await supabase
          .from('sequence_messages')
          .select('*')
          .eq('message_key', step.message_key)
          .single();

        if (msgError || !messageTemplate) {
          logger.error({
            msg: '[SEQUENCES-JOB] Message template not found',
            messageKey: step.message_key,
            error: msgError,
          });

          // Mark step as failed
          await rpc('advance_sequence_step', {
            p_user_sequence_id: step.user_sequence_id,
            p_success: false,
            p_metadata: { error: 'Message template not found' },
          });

          failed++;
          continue;
        }

        // Replace placeholders in message
        const userName = step.user_name || 'amigo(a)';
        const body = messageTemplate.body
          .replace(/{name}/g, userName)
          .replace(/{user_name}/g, userName);

        const title = messageTemplate.title
          ? messageTemplate.title.replace(/{name}/g, userName).replace(/{user_name}/g, userName)
          : undefined;

        // Send message based on type
        if (messageTemplate.message_type === 'buttons' && messageTemplate.buttons) {
          await sendButtons({
            number: step.user_number,
            title: title || '',
            desc: body,
            footer: messageTemplate.footer || undefined,
            buttons: messageTemplate.buttons,
          });
        } else {
          // Plain text message
          const fullMessage = title ? `${title}\n\n${body}` : body;
          await sendText(step.user_number, fullMessage);
        }

        // Advance to next step
        const advanceResult = await rpc('advance_sequence_step', {
          p_user_sequence_id: step.user_sequence_id,
          p_success: true,
          p_metadata: {
            processing_time_ms: Date.now() - stepStartTime,
            message_type: messageTemplate.message_type,
          },
        });

        sent++;

        logger.info({
          msg: '[SEQUENCES-JOB] Sequence step processed successfully',
          userSequenceId: step.user_sequence_id,
          action: advanceResult.action,
          nextStep: advanceResult.next_step,
          processingTime: Date.now() - stepStartTime,
        });

        // Rate limit - wait 200ms between messages
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        logger.error({
          msg: '[SEQUENCES-JOB] Error processing sequence step',
          userSequenceId: step.user_sequence_id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });

        // Mark step as failed
        try {
          await rpc('advance_sequence_step', {
            p_user_sequence_id: step.user_sequence_id,
            p_success: false,
            p_metadata: { error: err instanceof Error ? err.message : 'Unknown error' },
          });
        } catch (advanceErr) {
          logger.error({
            msg: '[SEQUENCES-JOB] Error marking step as failed',
            error: advanceErr,
          });
        }

        failed++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info({
      msg: '[SEQUENCES-JOB] Job completed',
      totalProcessed,
      sent,
      failed,
      cancelled,
      duration,
      workerId,
    });

    await logJobComplete(logId, jobName, { totalProcessed, sent, failed, cancelled }, duration);

    return { totalProcessed, sent, failed, cancelled };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({
      msg: '[SEQUENCES-JOB] Job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      totalProcessed,
      sent,
      failed,
      cancelled,
      duration,
      workerId,
    });

    await logJobFailed(logId, jobName, error, duration);

    throw error;
  }
}
