import { supabase } from '../config/supabase';
import { sendSticker } from '../services/evolutionApi';
import { sendPendingStickersMessage } from '../services/messageService';
import logger from '../config/logger';

interface PendingSticker {
  id: string;
  user_number: string;
  processed_url: string;
  created_at: string;
}

/**
 * Send pending stickers to users
 * Scheduled to run at 8:00 AM every day
 */
export async function sendPendingStickersJob(): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info({ msg: 'Starting send pending stickers job' });

    // Get all pending stickers with user info
    const { data: pendingStickers, error: fetchError } = await supabase
      .from('stickers')
      .select('id, user_number, processed_url, created_at')
      .eq('status', 'pendente')
      .order('user_number')
      .order('created_at');

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingStickers || pendingStickers.length === 0) {
      logger.info({ msg: 'No pending stickers to send' });
      return;
    }

    logger.info({
      msg: 'Found pending stickers',
      count: pendingStickers.length,
    });

    // Group stickers by user
    const stickersByUser = new Map<string, PendingSticker[]>();

    for (const sticker of pendingStickers) {
      const existing = stickersByUser.get(sticker.user_number) || [];
      existing.push(sticker);
      stickersByUser.set(sticker.user_number, existing);
    }

    logger.info({
      msg: 'Grouped stickers by user',
      uniqueUsers: stickersByUser.size,
    });

    // Get user names
    const userNumbers = Array.from(stickersByUser.keys());
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('whatsapp_number, name')
      .in('whatsapp_number', userNumbers);

    if (usersError) {
      logger.error({
        msg: 'Error fetching user names',
        error: usersError.message,
      });
    }

    const userNameMap = new Map<string, string>();
    if (users) {
      for (const user of users) {
        userNameMap.set(user.whatsapp_number, user.name);
      }
    }

    // Send stickers to each user
    let successCount = 0;
    let failureCount = 0;
    const stickerIds: string[] = [];

    for (const [userNumber, stickers] of stickersByUser.entries()) {
      try {
        const userName = userNameMap.get(userNumber) || 'Usuário';

        logger.info({
          msg: 'Sending pending stickers to user',
          userNumber,
          userName,
          stickerCount: stickers.length,
        });

        // Send good morning message
        await sendPendingStickersMessage(userNumber, userName, stickers.length);

        // Send each sticker
        for (const sticker of stickers) {
          try {
            await sendSticker(userNumber, sticker.processed_url);
            stickerIds.push(sticker.id);

            logger.debug({
              msg: 'Pending sticker sent',
              stickerId: sticker.id,
              userNumber,
            });

            // Small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (stickerError) {
            logger.error({
              msg: 'Error sending individual sticker',
              stickerId: sticker.id,
              userNumber,
              error: stickerError instanceof Error ? stickerError.message : 'Unknown error',
            });
            failureCount++;
          }
        }

        successCount += stickers.length;

        logger.info({
          msg: 'Finished sending stickers to user',
          userNumber,
          userName,
          stickersSent: stickers.length,
        });
      } catch (userError) {
        logger.error({
          msg: 'Error processing user pending stickers',
          userNumber,
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
        failureCount += stickers.length;
      }
    }

    // Update sent stickers status
    if (stickerIds.length > 0) {
      const { error: updateError } = await supabase
        .from('stickers')
        .update({
          status: 'enviado',
          sent_at: new Date().toISOString(),
        })
        .in('id', stickerIds);

      if (updateError) {
        logger.error({
          msg: 'Error updating sticker status',
          error: updateError.message,
          stickerIds: stickerIds.length,
        });
      } else {
        logger.info({
          msg: 'Updated sticker status',
          updated: stickerIds.length,
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info({
      msg: 'Send pending stickers job completed',
      totalStickers: pendingStickers.length,
      successCount,
      failureCount,
      uniqueUsers: stickersByUser.size,
      durationMs: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error({
      msg: 'Send pending stickers job failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    throw error;
  }
}
