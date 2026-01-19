import { supabase } from '../config/supabase';
import { sendSticker } from '../services/whatsappApi';
import { logJobStart, logJobComplete, logJobFailed } from '../services/jobLogger';
import logger from '../config/logger';

/**
 * Send pending stickers to users with comprehensive database logging
 * Scheduled to run at 8:00 AM every day (and also every 5 minutes for real-time processing)
 *
 * This function now includes:
 * - Full traceability via pending_sticker_sends table
 * - Retry tracking with attempt numbers
 * - Processing time metrics
 * - Individual error logging per sticker
 * - Worker identification for distributed systems
 */
export async function sendPendingStickersJob(): Promise<{
  totalProcessed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ stickerId: string; error: string }>;
}> {
  const startTime = Date.now();
  const workerId = process.env.HOSTNAME || process.env.CONTAINER_ID || 'scheduler';
  const jobName = 'send-pending-stickers' as const;

  // Log job start to database
  const logId = await logJobStart(jobName);

  logger.info({
    msg: '[SEND-PENDING-JOB] Starting send pending stickers job',
    workerId,
  });

  let totalProcessed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ stickerId: string; error: string }> = [];

  try {
    // Step 1: Query all pending stickers
    const { data: pendingStickers, error: queryError } = await supabase
      .from('stickers')
      .select('id, user_number, processed_url, tipo, created_at')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true }); // Send oldest first (FIFO)

    if (queryError) {
      logger.error({
        msg: '[SEND-PENDING-JOB] Error querying pending stickers',
        error: queryError,
      });
      throw queryError;
    }

    if (!pendingStickers || pendingStickers.length === 0) {
      logger.info({
        msg: '[SEND-PENDING-JOB] No pending stickers to send',
        workerId,
      });
      return { totalProcessed: 0, sent: 0, failed: 0, skipped: 0, errors: [] };
    }

    logger.info({
      msg: '[SEND-PENDING-JOB] Found pending stickers',
      count: pendingStickers.length,
      workerId,
    });

    // Step 2: Process each pending sticker with comprehensive logging
    for (const sticker of pendingStickers) {
      totalProcessed++;
      const stickerStartTime = Date.now();

      try {
        // ATOMIC LOCK: Try to claim this sticker by updating status to 'sending'
        // This prevents race conditions when multiple workers run simultaneously
        const { data: claimedSticker, error: claimError } = await supabase
          .from('stickers')
          .update({ status: 'sending' })
          .eq('id', sticker.id)
          .eq('status', 'pendente') // Only update if still pending
          .select()
          .single();

        if (claimError || !claimedSticker) {
          // Another worker already claimed this sticker
          logger.debug({
            msg: '[SEND-PENDING-JOB] Sticker already claimed by another worker, skipping',
            stickerId: sticker.id,
            workerId,
          });
          skipped++;
          continue;
        }

        logger.info({
          msg: '[SEND-PENDING-JOB] Processing pending sticker (claimed)',
          stickerId: sticker.id,
          userNumber: sticker.user_number,
          createdAt: sticker.created_at,
          position: `${totalProcessed}/${pendingStickers.length}`,
          workerId,
        });

        // Get user_id from users table
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('whatsapp_number', sticker.user_number)
          .single();

        const userId = userData?.id || null;

        // Get attempt number (check if we've tried this sticker before)
        const { data: previousAttempts } = await supabase
          .from('pending_sticker_sends')
          .select('attempt_number')
          .eq('sticker_id', sticker.id)
          .order('attempt_number', { ascending: false })
          .limit(1);

        const attemptNumber =
          previousAttempts && previousAttempts.length > 0
            ? (previousAttempts[0].attempt_number || 0) + 1
            : 1;

        // Create log entry BEFORE sending (status: 'attempting')
        const { data: logEntry, error: logError } = await supabase
          .from('pending_sticker_sends')
          .insert({
            sticker_id: sticker.id,
            user_id: userId,
            user_number: sticker.user_number,
            attempt_number: attemptNumber,
            status: 'attempting',
            worker_id: workerId,
          })
          .select()
          .single();

        if (logError) {
          logger.error({
            msg: '[SEND-PENDING-JOB] Error creating log entry',
            stickerId: sticker.id,
            error: logError,
          });
          // Continue anyway - logging failure shouldn't block sending
        }

        // Attempt to send sticker (silently - no extra messages)
        await sendSticker(sticker.user_number, sticker.processed_url);

        const processingTimeMs = Date.now() - stickerStartTime;

        // Success! Update sticker status to 'enviado'
        const { error: updateStickerError } = await supabase
          .from('stickers')
          .update({ status: 'enviado', sent_at: new Date().toISOString() })
          .eq('id', sticker.id);

        if (updateStickerError) {
          logger.error({
            msg: '[SEND-PENDING-JOB] Error updating sticker status',
            stickerId: sticker.id,
            error: updateStickerError,
          });
        }

        // Update log entry to 'sent'
        if (logEntry) {
          await supabase
            .from('pending_sticker_sends')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              processing_time_ms: processingTimeMs,
            })
            .eq('id', logEntry.id);
        }

        sent++;

        logger.info({
          msg: '[SEND-PENDING-JOB] Sticker sent successfully',
          stickerId: sticker.id,
          userNumber: sticker.user_number,
          attemptNumber,
          processingTimeMs,
        });
      } catch (error) {
        const processingTimeMs = Date.now() - stickerStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as any)?.code || 'UNKNOWN';

        failed++;
        errors.push({
          stickerId: sticker.id,
          error: errorMessage,
        });

        logger.error({
          msg: '[SEND-PENDING-JOB] Failed to send sticker',
          stickerId: sticker.id,
          userNumber: sticker.user_number,
          error: errorMessage,
          errorCode,
        });

        // Revert sticker status back to 'pendente' for retry
        await supabase
          .from('stickers')
          .update({ status: 'pendente' })
          .eq('id', sticker.id)
          .eq('status', 'sending'); // Only revert if still in 'sending' state

        // Update log entry to 'failed'
        const { data: failedLogEntry } = await supabase
          .from('pending_sticker_sends')
          .select('id')
          .eq('sticker_id', sticker.id)
          .eq('status', 'attempting')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (failedLogEntry) {
          await supabase
            .from('pending_sticker_sends')
            .update({
              status: 'failed',
              error_message: errorMessage,
              error_code: errorCode,
              processing_time_ms: processingTimeMs,
            })
            .eq('id', failedLogEntry.id);
        }

        // Don't throw - continue with other stickers
      }

      // Small delay between sends to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const totalTimeMs = Date.now() - startTime;

    // Log success to database
    await logJobComplete(
      logId,
      jobName,
      {
        total_processed: totalProcessed,
        sent,
        failed,
        skipped,
        success_rate: totalProcessed > 0 ? `${((sent / totalProcessed) * 100).toFixed(1)}%` : '0%',
      },
      totalTimeMs
    );

    logger.info({
      msg: '[SEND-PENDING-JOB] Send pending stickers job completed',
      workerId,
      totalProcessed,
      sent,
      failed,
      skipped,
      totalTimeMs,
      successRate: totalProcessed > 0 ? `${((sent / totalProcessed) * 100).toFixed(1)}%` : '0%',
    });

    return { totalProcessed, sent, failed, skipped, errors };
  } catch (error) {
    const totalTimeMs = Date.now() - startTime;

    // Log failure to database
    await logJobFailed(logId, jobName, error, totalTimeMs);

    logger.error({
      msg: '[SEND-PENDING-JOB] Fatal error in send pending stickers job',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      workerId,
      totalTimeMs,
    });

    // Alert on critical failure
    try {
      const { alertWorkerFailure } = await import('../services/alertService');
      await alertWorkerFailure({
        service: 'send-pending-stickers',
        errorType: 'job_failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        additionalInfo: {
          totalProcessed,
          sent,
          failed,
        },
      });
    } catch (alertError) {
      logger.error({
        msg: '[SEND-PENDING-JOB] Failed to send alert',
        error: alertError instanceof Error ? alertError.message : 'Unknown error',
      });
    }

    throw error;
  }
}
