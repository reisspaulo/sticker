import { supabase } from '../config/supabase';
import { sendText } from '../services/evolutionApi';
import { logExperimentEvent } from '../services/experimentService';
import { logJobStart, logJobComplete, logJobFailed } from '../services/jobLogger';
import logger from '../config/logger';

// Plan limits for reference
const PLAN_LIMITS = {
  free: 4,
  premium: 20,
  ultra: 999,
};

/**
 * Send scheduled reminders to users
 * Runs every 5 minutes to check for pending reminders
 *
 * This job:
 * - Queries reminders where scheduled_for <= NOW() and status = 'pending'
 * - Checks if user is still at limit or if limit has reset
 * - Sends appropriate message based on user state
 * - Logs experiment events for tracking
 */
export async function sendScheduledRemindersJob(): Promise<{
  totalProcessed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const startTime = Date.now();
  const workerId = process.env.HOSTNAME || process.env.CONTAINER_ID || 'scheduler';
  const jobName = 'send-scheduled-reminders' as const;

  // Log job start to database
  const logId = await logJobStart(jobName);

  logger.info({
    msg: '[REMINDERS-JOB] Starting send scheduled reminders job',
    workerId,
  });

  let totalProcessed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Step 1: Query pending reminders that are due
    const { data: reminders, error: queryError } = await supabase
      .from('scheduled_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50); // Process in batches

    if (queryError) {
      logger.error({
        msg: '[REMINDERS-JOB] Error querying reminders',
        error: queryError,
      });
      throw queryError;
    }

    if (!reminders || reminders.length === 0) {
      logger.debug({
        msg: '[REMINDERS-JOB] No pending reminders to send',
        workerId,
      });

      await logJobComplete(logId, jobName, {
        totalProcessed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      }, 0);

      return { totalProcessed: 0, sent: 0, failed: 0, skipped: 0 };
    }

    logger.info({
      msg: '[REMINDERS-JOB] Found pending reminders',
      count: reminders.length,
      workerId,
    });

    // Step 2: Process each reminder
    for (const reminder of reminders) {
      totalProcessed++;
      const reminderStartTime = Date.now();

      try {
        logger.info({
          msg: '[REMINDERS-JOB] Processing reminder',
          reminderId: reminder.id,
          userNumber: reminder.user_number,
          scheduledFor: reminder.scheduled_for,
          position: `${totalProcessed}/${reminders.length}`,
        });

        // Get user's current state
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('daily_count, subscription_plan, name')
          .eq('id', reminder.user_id)
          .single();

        if (userError || !user) {
          logger.warn({
            msg: '[REMINDERS-JOB] User not found, skipping',
            reminderId: reminder.id,
            userId: reminder.user_id,
          });

          // Mark as failed (user deleted?)
          await supabase
            .from('scheduled_reminders')
            .update({
              status: 'failed',
              error_message: 'User not found',
              updated_at: new Date().toISOString(),
            })
            .eq('id', reminder.id);

          skipped++;
          continue;
        }

        // Determine daily limit based on plan
        const dailyLimit =
          PLAN_LIMITS[user.subscription_plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

        // Build appropriate message
        let message: string;
        const userName = user.name || 'amigo(a)';

        if (user.daily_count >= dailyLimit) {
          // User is still at limit - upsell message
          message = `⏰ *Lembrete, ${userName}!*

Você pediu pra te lembrar do upgrade.

Seu limite de hoje ainda está esgotado, mas com o *Premium* você tem *20 figurinhas por dia*! 🚀

💎 Digite *planos* para ver as opções.`;
        } else {
          // Limit has reset - softer upsell
          message = `⏰ *Seu limite voltou, ${userName}!*

Você já pode criar mais figurinhas hoje! 🎨

💡 *Dica:* Com o *Premium* você nunca mais fica sem.

Digite *planos* se quiser saber mais.`;
        }

        // Send message
        await sendText(reminder.user_number, message);

        // Update reminder status
        const processingTime = Date.now() - reminderStartTime;
        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        // Log experiment event
        if (reminder.experiment_id) {
          await logExperimentEvent(
            reminder.user_id,
            reminder.experiment_id,
            reminder.variant || 'unknown',
            'remind_sent',
            {
              daily_count: user.daily_count,
              daily_limit: dailyLimit,
              was_at_limit: user.daily_count >= dailyLimit,
              processing_time_ms: processingTime,
            }
          );
        }

        sent++;

        logger.info({
          msg: '[REMINDERS-JOB] Reminder sent successfully',
          reminderId: reminder.id,
          userNumber: reminder.user_number,
          wasAtLimit: user.daily_count >= dailyLimit,
          processingTime,
        });

        // Rate limit - wait 200ms between messages
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        logger.error({
          msg: '[REMINDERS-JOB] Error processing reminder',
          reminderId: reminder.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });

        // Update reminder as failed
        await supabase
          .from('scheduled_reminders')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Unknown error',
            retry_count: reminder.retry_count + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        failed++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info({
      msg: '[REMINDERS-JOB] Job completed',
      totalProcessed,
      sent,
      failed,
      skipped,
      duration,
      workerId,
    });

    // Log job completion
    await logJobComplete(logId, jobName, {
      totalProcessed,
      sent,
      failed,
      skipped,
    }, duration);

    return { totalProcessed, sent, failed, skipped };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({
      msg: '[REMINDERS-JOB] Job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      totalProcessed,
      sent,
      failed,
      skipped,
      duration,
      workerId,
    });

    // Log job failure
    await logJobFailed(logId, jobName, error, duration);

    throw error;
  }
}
