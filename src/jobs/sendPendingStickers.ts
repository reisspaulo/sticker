import { supabase } from '../config/supabase';
import { sendSticker } from '../services/evolutionApi';
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
  errors: Array<{ stickerId: string; error: string }>;
}> {
  const startTime = Date.now();
  const workerId = process.env.HOSTNAME || process.env.CONTAINER_ID || 'scheduler';

  logger.info({
    msg: '[SEND-PENDING-JOB] Starting send pending stickers job',
    workerId,
  });

  let totalProcessed = 0;
  let sent = 0;
  let failed = 0;
  const errors: Array<{ stickerId: string; error: string }> = [];

  try {
    // Step 1: Query all pending stickers
    const { data: pendingStickers, error: queryError } = await supabase
      .from('stickers')
      .select('id, user_id, user_number, url, tipo, created_at')
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
      return { totalProcessed: 0, sent: 0, failed: 0, errors: [] };
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

      logger.info({
        msg: '[SEND-PENDING-JOB] Processing pending sticker',
        stickerId: sticker.id,
        userNumber: sticker.user_number,
        createdAt: sticker.created_at,
        position: `${totalProcessed}/${pendingStickers.length}`,
      });

      try {
        // Get attempt number (check if we've tried this sticker before)
        const { data: previousAttempts } = await supabase
          .from('pending_sticker_sends')
          .select('attempt_number')
          .eq('sticker_id', sticker.id)
          .order('attempt_number', { ascending: false })
          .limit(1);

        const attemptNumber = previousAttempts && previousAttempts.length > 0
          ? (previousAttempts[0].attempt_number || 0) + 1
          : 1;

        // Create log entry BEFORE sending (status: 'attempting')
        const { data: logEntry, error: logError } = await supabase
          .from('pending_sticker_sends')
          .insert({
            sticker_id: sticker.id,
            user_id: sticker.user_id,
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
        await sendSticker(sticker.user_number, sticker.url);

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
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const totalTimeMs = Date.now() - startTime;

    logger.info({
      msg: '[SEND-PENDING-JOB] Send pending stickers job completed',
      workerId,
      totalProcessed,
      sent,
      failed,
      totalTimeMs,
      successRate: totalProcessed > 0 ? `${((sent / totalProcessed) * 100).toFixed(1)}%` : '0%',
    });

    return { totalProcessed, sent, failed, errors };

  } catch (error) {
    const totalTimeMs = Date.now() - startTime;

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
