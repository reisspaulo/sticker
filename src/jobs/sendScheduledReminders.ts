import { supabase } from '../config/supabase';
import { sendText } from '../services/evolutionApi';
import { sendList } from '../services/avisaApi';
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
 * Helper function to process payment reminder based on experiment variant
 */
async function processPaymentReminder(
  reminder: any
): Promise<{ message?: string; list?: any; eventType: string }> {
  const metadata = JSON.parse(reminder.message_template || '{}');
  const selectedPlan = metadata.selected_plan as 'premium' | 'ultra';
  const wave = metadata.wave as 1 | 2 | 3;

  // Get experiment configuration
  const { data: experiment } = await supabase
    .from('experiments')
    .select('variants')
    .eq('id', reminder.experiment_id)
    .single();

  if (!experiment) {
    throw new Error('Experiment not found');
  }

  const variantConfig = experiment.variants[reminder.variant];
  if (!variantConfig) {
    throw new Error(`Variant ${reminder.variant} not found`);
  }

  // Get wave-specific config
  const config = variantConfig.config;
  const waveKey = `wave_${wave}`;
  const title = config[`${waveKey}_title`];
  const body = config[`${waveKey}_body`];
  const buttons = config[`${waveKey}_buttons`];
  const buttonTexts = config[`${waveKey}_button_texts`];

  // Replace placeholders
  const planName = selectedPlan === 'premium' ? 'Premium' : 'Ultra';
  const planBenefit =
    selectedPlan === 'premium' ? '20 figurinhas por dia' : 'figurinhas ilimitadas';
  const benefitToday = selectedPlan === 'premium' ? '+16 figurinhas hoje' : 'figurinhas ilimitadas';
  const benefitWeek = selectedPlan === 'premium' ? '83 figurinhas' : 'centenas de figurinhas';
  const totalWeek = '347';

  const finalTitle = title
    .replace('{plan_name}', planName)
    .replace('{benefit_today}', benefitToday)
    .replace('{benefit_week}', benefitWeek)
    .replace('{total_week}', totalWeek);

  const finalBody = body
    .replace('{plan_name}', planName)
    .replace('{plan_benefit}', planBenefit)
    .replace('{benefit_today}', benefitToday)
    .replace('{benefit_week}', benefitWeek)
    .replace('{total_week}', totalWeek);

  // Build button list for Avisa API
  const listItems = buttons.map((btnType: string) => {
    const text = buttonTexts[btnType];
    let rowId = '';

    if (btnType === 'pix') rowId = 'payment_pix';
    else if (btnType === 'card') rowId = 'payment_card';
    else if (btnType === 'plans') rowId = 'show_plans';
    else if (btnType === 'dismiss') rowId = 'dismiss_payment_reminder';

    return {
      RowId: rowId,
      title: text,
      desc: '',
    };
  });

  await sendList({
    number: reminder.user_number,
    buttontext: '💳 Escolher',
    toptext: finalTitle,
    desc: finalBody,
    list: listItems,
  });

  return {
    eventType: `payment_reminder_wave${wave}_sent`,
  };
}

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

      await logJobComplete(
        logId,
        jobName,
        {
          totalProcessed: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
        },
        0
      );

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
        // ATOMIC LOCK: Try to claim this reminder by updating status to 'processing'
        // This prevents race conditions when multiple workers run simultaneously
        const { data: claimedReminder, error: claimError } = await supabase
          .from('scheduled_reminders')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', reminder.id)
          .eq('status', 'pending') // Only update if still pending
          .select()
          .single();

        if (claimError || !claimedReminder) {
          // Another worker already claimed this reminder
          logger.debug({
            msg: '[REMINDERS-JOB] Reminder already claimed by another worker, skipping',
            reminderId: reminder.id,
            workerId,
          });
          skipped++;
          continue;
        }

        logger.info({
          msg: '[REMINDERS-JOB] Processing reminder (claimed)',
          reminderId: reminder.id,
          userNumber: reminder.user_number,
          scheduledFor: reminder.scheduled_for,
          position: `${totalProcessed}/${reminders.length}`,
          workerId,
        });

        // Get user's current state
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('daily_count, subscription_plan, name, daily_limit')
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
        // For free users, use their daily_limit from experiment (if set)
        let dailyLimit: number;
        if (user.subscription_plan === 'free' || !user.subscription_plan) {
          dailyLimit = user.daily_limit ?? PLAN_LIMITS.free;
        } else {
          dailyLimit =
            PLAN_LIMITS[user.subscription_plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
        }

        // Check if this is a payment reminder
        const isPaymentReminder = reminder.reminder_type?.startsWith('payment_reminder');
        let eventType = 'remind_sent';

        if (isPaymentReminder) {
          // Process payment reminder with experiment variant
          logger.info({
            msg: '[REMINDERS-JOB] Processing payment reminder',
            reminderId: reminder.id,
            reminderType: reminder.reminder_type,
            variant: reminder.variant,
          });

          const result = await processPaymentReminder(reminder);
          eventType = result.eventType;
        } else {
          // Original upgrade reminder logic

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
        }

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
            eventType,
            {
              daily_count: user.daily_count,
              daily_limit: dailyLimit,
              was_at_limit: user.daily_count >= dailyLimit,
              processing_time_ms: processingTime,
              reminder_type: reminder.reminder_type,
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
    await logJobComplete(
      logId,
      jobName,
      {
        totalProcessed,
        sent,
        failed,
        skipped,
      },
      duration
    );

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
