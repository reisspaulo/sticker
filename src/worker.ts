// Load environment variables FIRST
import { config } from 'dotenv';
config();

import { Worker, Job } from 'bullmq';
import logger from './config/logger';
import { processStaticSticker } from './services/stickerProcessor';
import { processAnimatedSticker, processAnimatedStickerFromBuffer } from './services/gifProcessor';
import { uploadSticker } from './services/supabaseStorage';
import { sendSticker, sendVideo, sendText } from './services/evolutionApi';
import { supabase } from './config/supabase';
import { ProcessStickerJobData, EditButtonsJobData } from './types/evolution';
import { TwitterDownloadJobData } from './types/twitter';
import { sendErrorMessage, sendVideoSelectionMessage } from './services/messageService';
import {
  logProcessingStarted,
  logStickerCreated,
  logProcessingFailed,
  logError,
} from './services/usageLogs';
import { getUserLimits } from './services/subscriptionService';
import { downloadTwitterVideo, getVideoMetadata } from './services/twitterService';
import { uploadTwitterVideo } from './services/twitterStorage';
import {
  incrementTwitterDownloadCount,
  getRemainingTwitterDownloads,
} from './services/twitterLimits';
import { saveVideoSelectionContext } from './utils/videoSelectionContext';
import { activatePendingPixSubscriptionJob } from './jobs/activatePendingPixSubscription';
import type { ActivatePixJobData } from './jobs/activatePendingPixSubscription';

interface ScheduledJob {
  type: 'reset-counters' | 'send-pending' | 'process-campaigns';
}

// Redis connection configuration for Workers
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = {
  host: redisUrl.includes('://') ? new URL(redisUrl).hostname : redisUrl.split(':')[0],
  port: redisUrl.includes('://')
    ? parseInt(new URL(redisUrl).port || '6379')
    : parseInt(redisUrl.split(':')[1] || '6379'),
  password: redisUrl.includes('://') ? new URL(redisUrl).password || undefined : undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// Process Sticker Worker
const processStickerWorker = new Worker<ProcessStickerJobData>(
  'process-sticker',
  async (job: Job<ProcessStickerJobData>) => {
    const { userNumber, userName, messageType, messageKey, status = 'enviado' } = job.data;
    const startTime = Date.now();

    logger.info({
      msg: 'Processing sticker job',
      jobId: job.id,
      userNumber,
      userName,
      messageType,
      status,
    });

    // Log processing started
    await logProcessingStarted({
      userNumber,
      userName,
      messageType,
      jobId: job.id as string,
    });

    try {
      let processedBuffer: Buffer;
      let tipo: 'estatico' | 'animado';

      // Step 1: Download and process based on type
      if (messageType === 'gif') {
        logger.info({ msg: 'Step 1: Processing animated GIF', jobId: job.id });
        const result = await processAnimatedSticker(messageKey);
        processedBuffer = result.buffer;
        tipo = 'animado';

        logger.info(
          {
            jobId: job.id,
            fileSize: result.fileSize,
            duration: result.duration,
            width: result.width,
            height: result.height,
          },
          'Animated sticker processed successfully'
        );
      } else {
        logger.info({ msg: 'Step 1: Processing static image', jobId: job.id });
        processedBuffer = await processStaticSticker(messageKey);
        tipo = 'estatico';

        logger.info(
          {
            jobId: job.id,
            fileSize: processedBuffer.length,
          },
          'Static sticker processed successfully'
        );
      }

      // Step 2: Upload to Supabase Storage
      logger.info({ msg: 'Step 2: Uploading to Supabase', jobId: job.id });
      const { path, url } = await uploadSticker(processedBuffer, userNumber, tipo);

      // Step 3: Send sticker to user OR save as pending
      if (status === 'enviado') {
        logger.info({ msg: 'Step 3: Sending sticker to user (silently)', jobId: job.id });
        await sendSticker(userNumber, url);
      } else {
        logger.info({
          msg: 'Step 3: Sticker marked as pending (daily limit reached)',
          jobId: job.id,
        });
      }

      // Step 4: Save metadata to database
      logger.info({ msg: 'Step 4: Saving metadata to database', jobId: job.id });

      const { error: stickerError } = await supabase.from('stickers').insert({
        user_number: userNumber,
        tipo,
        original_url: `whatsapp:${messageKey.id}`, // Store message ID instead of encrypted URL
        processed_url: url,
        storage_path: path,
        file_size: processedBuffer.length,
        processing_time_ms: Date.now() - startTime,
        status, // 'enviado' or 'pendente'
      });

      if (stickerError) {
        logger.error({
          msg: 'Error saving sticker metadata',
          error: stickerError.message,
          userNumber,
        });
        // Don't throw - sticker was already processed
      }

      // Set first_sticker_at if this is the user's first sticker
      const { error: firstStickerError } = await supabase
        .from('users')
        .update({ first_sticker_at: new Date().toISOString() })
        .eq('whatsapp_number', userNumber)
        .is('first_sticker_at', null);

      if (firstStickerError) {
        logger.warn({
          msg: 'Error updating first_sticker_at (non-critical)',
          error: firstStickerError.message,
          userNumber,
        });
      } else {
        logger.debug({
          msg: 'Checked/updated first_sticker_at',
          userNumber,
        });
      }

      // Step 5: REMOVED - daily count is now incremented atomically in webhook
      // This prevents race conditions when multiple images are sent simultaneously
      logger.info({
        msg: 'Step 5: Daily count already incremented atomically in webhook',
        jobId: job.id,
      });

      // Step 6: Handle status-specific actions and Twitter feature presentation
      // NOTE: Onboarding step is now updated ATOMICALLY in webhook (not here!)
      // This prevents race conditions and ensures consistency
      if (status === 'enviado') {
        // Sticker sent silently - no confirmation message
        logger.info({
          msg: 'Sticker sent silently (no confirmation)',
          jobId: job.id,
          userNumber,
        });

        // NOTE: Twitter feature presentation handled by unified campaigns system
        // Users are enrolled in twitter_discovery_v2 campaign when they hit their daily limit
        // See: webhook.ts enrollInTwitterDiscoveryV2() and processCampaignMessages job
      } else if (status === 'pendente') {
        // User hit limit - notification already handled atomically in webhook
        // Onboarding step was still incremented (user created sticker, even if pending)
        logger.info({
          msg: 'Sticker saved as pending (limit notification already sent in webhook)',
          jobId: job.id,
          userNumber,
          note: 'Onboarding step was incremented atomically in webhook',
        });
      }

      const totalTime = Date.now() - startTime;
      logger.info({
        msg: 'Sticker processed successfully',
        jobId: job.id,
        userNumber,
        tipo,
        status,
        fileSize: processedBuffer.length,
        processingTimeMs: totalTime,
        storagePath: path,
      });

      // Log sticker created
      await logStickerCreated({
        userNumber,
        userName,
        messageType,
        fileSize: processedBuffer.length,
        processingTimeMs: totalTime,
        tipo,
        status,
        storagePath: path,
      });

      return {
        success: true,
        userNumber,
        tipo,
        status,
        fileSize: processedBuffer.length,
        processingTimeMs: totalTime,
        storageUrl: url,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error({
        msg: 'Error processing sticker',
        jobId: job.id,
        userNumber,
        messageType,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: totalTime,
      });

      // Log processing failed
      await logProcessingFailed({
        userNumber,
        jobId: job.id as string,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      // Log error
      await logError({
        userNumber,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        context: {
          jobId: job.id,
          messageType,
          processingTimeMs: totalTime,
        },
      });

      // Send error message to user
      try {
        await sendErrorMessage(userNumber, 'processing');
      } catch (sendError) {
        logger.error({
          msg: 'Error sending error message to user',
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
        });
      }

      throw error; // Let BullMQ handle retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 jobs simultaneously
  }
);

// Download Twitter Video Worker
const downloadTwitterVideoWorker = new Worker<TwitterDownloadJobData>(
  'download-twitter-video',
  async (job: Job<TwitterDownloadJobData>) => {
    const { userNumber, userName, tweetUrl, tweetId, username, userId } = job.data;
    const startTime = Date.now();

    logger.info({
      msg: 'Processing Twitter video download job',
      jobId: job.id,
      userNumber,
      userName,
      tweetUrl,
      tweetId,
    });

    try {
      // Step 1: Get video metadata to check for multiple videos
      logger.info({ msg: 'Step 1: Getting video metadata from Twitter', jobId: job.id, tweetUrl });

      const metadata = await getVideoMetadata(username, tweetId);

      if (!metadata) {
        throw new Error('Vídeo não encontrado no tweet');
      }

      // Check if it's a GIF - process as animated sticker instead
      if (metadata.type === 'gif') {
        logger.info({
          msg: 'Detected Twitter GIF - processing as animated sticker',
          jobId: job.id,
          resolution: metadata.resolution,
        });

        // Download the GIF (it's an MP4 file)
        const downloadResult = await downloadTwitterVideo(username, tweetId);

        if (!downloadResult.success || !downloadResult.buffer) {
          throw new Error('Failed to download GIF');
        }

        const gifBuffer = downloadResult.buffer;

        logger.info({
          msg: 'GIF downloaded, converting to sticker',
          jobId: job.id,
          fileSize: gifBuffer.length,
        });

        // Process as animated GIF sticker
        const result = await processAnimatedStickerFromBuffer(gifBuffer);

        logger.info({
          msg: 'GIF processed to animated sticker',
          jobId: job.id,
          fileSize: result.fileSize,
          width: result.width,
          height: result.height,
          duration: result.duration,
        });

        // Upload to Supabase (stickers bucket, not twitter-videos)
        const { path, url } = await uploadSticker(result.buffer, userNumber, 'animado');

        logger.info({
          msg: 'Twitter GIF sticker uploaded',
          jobId: job.id,
          path,
          url,
        });

        // Send as sticker
        await sendSticker(userNumber, url);

        logger.info({
          msg: 'Twitter GIF sticker sent successfully',
          jobId: job.id,
          userNumber,
        });

        // Increment Twitter download count
        if (userId) {
          await incrementTwitterDownloadCount(userId);

          // Mark Twitter feature as used (first time)
          const { markTwitterFeatureAsUsed } = await import('./services/onboardingService');
          await markTwitterFeatureAsUsed(userNumber);
        }

        const totalTime = Date.now() - startTime;

        return {
          success: true,
          userNumber,
          tweetId,
          fileSize: result.fileSize,
          processingTimeMs: totalTime,
          type: 'gif_sticker',
        };
      }

      // Check if tweet has multiple videos
      if (metadata.hasMultipleVideos && metadata.allVideos && metadata.allVideos.length > 1) {
        logger.info({
          msg: 'Tweet has multiple videos, requesting user selection',
          jobId: job.id,
          videoCount: metadata.allVideos.length,
        });

        // Get remaining downloads for the message
        const remainingDownloads = await getRemainingTwitterDownloads(userId || '');

        // Save video selection context
        await saveVideoSelectionContext(userNumber, {
          state: 'awaiting_video_selection',
          tweetId,
          username,
          metadata,
          userNumber,
          userName,
        });

        // Send selection message
        await sendVideoSelectionMessage(
          userNumber,
          userName,
          metadata.allVideos,
          remainingDownloads
        );

        logger.info({
          msg: 'Video selection context saved and message sent',
          jobId: job.id,
          userNumber,
          videoCount: metadata.allVideos.length,
        });

        // Job completed - user needs to select video
        return {
          success: true,
          userNumber,
          tweetId,
          action: 'awaiting_selection',
          videoCount: metadata.allVideos.length,
        };
      }

      // Single video - proceed with download
      logger.info({ msg: 'Step 2: Downloading video from Twitter', jobId: job.id });

      const downloadResult = await downloadTwitterVideo(username, tweetId);

      if (!downloadResult.success || !downloadResult.buffer || !downloadResult.metadata) {
        throw new Error(downloadResult.error || 'Failed to download video');
      }

      const { buffer, metadata: downloadedMetadata } = downloadResult;

      logger.info({
        msg: 'Video downloaded successfully',
        jobId: job.id,
        fileSize: buffer.length,
        sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
        duration: downloadedMetadata.durationSec,
        author: downloadedMetadata.username,
      });

      // Step 3: Upload to Supabase Storage
      logger.info({ msg: 'Step 3: Uploading video to Supabase Storage', jobId: job.id });

      const { path, url } = await uploadTwitterVideo(buffer, userNumber, tweetId);

      logger.info({
        msg: 'Video uploaded to Supabase',
        jobId: job.id,
        storagePath: path,
        publicUrl: url,
      });

      // Step 4: Send video to user via Evolution API (with idempotency check)
      logger.info({ msg: 'Step 4: Checking if video already sent', jobId: job.id, tweetId });

      // Check if this video was already sent to prevent duplicates on retry
      const { data: existingDownload } = await supabase
        .from('twitter_downloads')
        .select('sent_at, id')
        .eq('tweet_id', tweetId)
        .eq('user_number', userNumber)
        .not('sent_at', 'is', null)
        .maybeSingle();

      let videoAlreadySent = false;
      let existingDownloadId: string | null = null;

      if (existingDownload?.sent_at) {
        logger.info({
          msg: 'Video already sent to user (skipping send to prevent duplicates)',
          jobId: job.id,
          tweetId,
          userNumber,
          existingDownloadId: existingDownload.id,
        });
        videoAlreadySent = true;
        existingDownloadId = existingDownload.id;
      } else {
        logger.info({ msg: 'Sending video to user (silently)', jobId: job.id });

        await sendVideo(userNumber, url);

        logger.info({
          msg: 'Video sent to user successfully (silent)',
          jobId: job.id,
          userNumber,
        });
      }

      // Step 5: Save metadata to database (or use existing record if video was already sent)
      logger.info({ msg: 'Step 5: Saving metadata to database', jobId: job.id });

      let downloadId: string | null = null;

      if (videoAlreadySent && existingDownloadId) {
        // Use existing download record
        downloadId = existingDownloadId;
        logger.info({
          msg: 'Using existing download record',
          jobId: job.id,
          downloadId,
        });
      } else {
        // Create new download record
        const { data: downloadRecord, error: dbError } = await supabase
          .from('twitter_downloads')
          .insert({
            user_number: userNumber,
            tweet_id: tweetId,
            tweet_url: tweetUrl,
            video_url: downloadedMetadata.videoUrl,
            author_username: downloadedMetadata.username,
            author_name: downloadedMetadata.author,
            tweet_text: downloadedMetadata.text,
            video_duration_ms: downloadedMetadata.duration,
            video_size_bytes: buffer.length,
            video_resolution: downloadedMetadata.resolution,
            likes: downloadedMetadata.likes,
            retweets: downloadedMetadata.retweets,
            storage_path: path,
            processed_url: url,
            downloaded_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
            converted_to_sticker: false,
          })
          .select('id')
          .single();

        if (dbError) {
          logger.error({
            msg: 'Error saving Twitter download metadata',
            error: dbError.message,
            userNumber,
            tweetId,
          });
          // Don't throw - video was already sent
        }

        downloadId = downloadRecord?.id || null;
      }

      // Step 6: Update user's Twitter download count
      if (userId) {
        logger.info({ msg: 'Step 6: Incrementing Twitter download count', jobId: job.id });
        await incrementTwitterDownloadCount(userId);

        // Mark Twitter feature as used (first time)
        const { markTwitterFeatureAsUsed } = await import('./services/onboardingService');
        await markTwitterFeatureAsUsed(userNumber);
      }

      // Step 7: Send conversion buttons (if download was saved successfully)
      // Wrapped in try/catch - buttons are optional, job should succeed even if they fail
      if (downloadId) {
        logger.info({ msg: 'Step 7: Sending conversion buttons', jobId: job.id, downloadId });

        try {
          const { sendButtons } = await import('./services/avisaApi');

          await sendButtons({
            number: userNumber,
            title: '🎨 *Quer transformar em figurinha?*',
            desc: 'Converter em figurinha animada', // Texto real para passar validação da API
            buttons: [
              {
                id: `button_convert_sticker_${downloadId}`,
                text: '✅ Sim, quero!',
              },
              {
                id: 'button_video_only',
                text: '⏭️ Só o vídeo',
              },
            ],
          });

          logger.info({
            msg: 'Conversion buttons sent',
            jobId: job.id,
            userNumber,
            downloadId,
          });
        } catch (buttonError) {
          // Don't fail the entire job if buttons fail - video was already delivered
          logger.error({
            msg: 'Failed to send conversion buttons, but video was delivered successfully',
            jobId: job.id,
            downloadId,
            error: buttonError instanceof Error ? buttonError.message : 'Unknown error',
          });
        }
      }

      const totalTime = Date.now() - startTime;

      logger.info({
        msg: 'Twitter video download completed successfully',
        jobId: job.id,
        userNumber,
        tweetId,
        author: downloadedMetadata.username,
        fileSize: buffer.length,
        duration: downloadedMetadata.durationSec,
        processingTimeMs: totalTime,
      });

      return {
        success: true,
        userNumber,
        tweetId,
        fileSize: buffer.length,
        processingTimeMs: totalTime,
        storageUrl: url,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;

      logger.error({
        msg: 'Error processing Twitter video download',
        jobId: job.id,
        userNumber,
        tweetUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: totalTime,
      });

      // Log error to database
      await logError({
        userNumber,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        context: {
          jobId: job.id,
          tweetUrl,
          processingTimeMs: totalTime,
        },
      });

      // Send error message to user
      try {
        await sendText(
          userNumber,
          `❌ Erro ao baixar vídeo do Twitter.\n\n${error instanceof Error ? error.message : 'Erro desconhecido'}\n\n💡 Tente novamente com outro link.`
        );
      } catch (sendError) {
        logger.error({
          msg: 'Error sending error message to user',
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
        });
      }

      throw error; // Let BullMQ handle retry
    }
  },
  {
    connection: redisConnection,
    concurrency: 3, // Process 3 downloads simultaneously
    // Retry config is in queue.ts defaultJobOptions
  }
);

// Convert Twitter Video to Sticker Worker
interface ConvertTwitterToStickerJobData {
  downloadId: string;
  userNumber: string;
  userName: string;
}

const convertTwitterStickerWorker = new Worker<ConvertTwitterToStickerJobData>(
  'convert-twitter-sticker',
  async (job: Job<ConvertTwitterToStickerJobData>) => {
    const { downloadId, userNumber, userName } = job.data;
    const startTime = Date.now();

    logger.info({
      msg: 'Processing Twitter video to sticker conversion',
      jobId: job.id,
      downloadId,
      userNumber,
      userName,
    });

    try {
      // Step 1: Get download record from database
      logger.info({ msg: 'Step 1: Fetching download record', jobId: job.id, downloadId });

      const { data: download, error: downloadError } = await supabase
        .from('twitter_downloads')
        .select('*')
        .eq('id', downloadId)
        .single();

      if (downloadError || !download) {
        throw new Error(`Download record not found: ${downloadId}`);
      }

      if (download.converted_to_sticker) {
        throw new Error('Video already converted to sticker');
      }

      logger.info({
        msg: 'Download record found',
        jobId: job.id,
        downloadId,
        storagePath: download.storage_path,
        durationSec: download.duration_sec,
      });

      // Step 2: Download video from Supabase Storage
      logger.info({ msg: 'Step 2: Downloading video from storage', jobId: job.id });

      const { data: videoData, error: storageError } = await supabase.storage
        .from('twitter-videos')
        .download(download.storage_path);

      if (storageError || !videoData) {
        throw new Error(`Failed to download video from storage: ${storageError?.message}`);
      }

      const videoBuffer = Buffer.from(await videoData.arrayBuffer());

      logger.info({
        msg: 'Video downloaded from storage',
        jobId: job.id,
        size: videoBuffer.length,
        sizeMB: (videoBuffer.length / 1024 / 1024).toFixed(2),
      });

      // Step 3: Process video to animated sticker (with auto-trim if needed)
      logger.info({ msg: 'Step 3: Converting to animated sticker', jobId: job.id });

      const { processAnimatedStickerFromBuffer } = await import('./services/gifProcessor');

      const result = await processAnimatedStickerFromBuffer(videoBuffer);

      logger.info({
        msg: 'Video converted to sticker',
        jobId: job.id,
        stickerSize: result.fileSize,
        width: result.width,
        height: result.height,
        duration: result.duration,
      });

      // Step 4: Upload sticker to Supabase
      logger.info({ msg: 'Step 4: Uploading sticker', jobId: job.id });

      const { uploadSticker } = await import('./services/supabaseStorage');
      const { path: stickerPath, url: stickerUrl } = await uploadSticker(
        result.buffer,
        userNumber,
        'animado'
      );

      logger.info({
        msg: 'Sticker uploaded',
        jobId: job.id,
        storagePath: stickerPath,
        publicUrl: stickerUrl,
      });

      // Step 5: Send sticker to user
      logger.info({ msg: 'Step 5: Sending sticker to user', jobId: job.id });

      const { sendSticker } = await import('./services/evolutionApi');
      await sendSticker(userNumber, stickerUrl);

      logger.info({
        msg: 'Sticker sent successfully',
        jobId: job.id,
        userNumber,
      });

      // Step 6: REMOVED - daily count is now incremented atomically in webhook
      // when user clicks "Convert to Sticker" button
      logger.info({
        msg: 'Step 6: Daily count already incremented atomically in webhook',
        jobId: job.id,
      });

      // Step 7: Update download record
      logger.info({ msg: 'Step 7: Updating download record', jobId: job.id });

      await supabase
        .from('twitter_downloads')
        .update({
          converted_to_sticker: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', downloadId);

      const totalTime = Date.now() - startTime;

      logger.info({
        msg: 'Twitter video conversion completed',
        jobId: job.id,
        downloadId,
        userNumber,
        processingTimeMs: totalTime,
        stickerSize: result.fileSize,
      });

      return {
        success: true,
        downloadId,
        userNumber,
        stickerUrl,
        processingTimeMs: totalTime,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;

      logger.error({
        msg: 'Error converting Twitter video to sticker',
        jobId: job.id,
        downloadId,
        userNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: totalTime,
      });

      // Send error message to user
      try {
        await sendText(
          userNumber,
          `❌ *Erro ao converter vídeo*\n\n${error instanceof Error ? error.message : 'Erro desconhecido'}\n\n💡 Tente novamente ou envie outro vídeo.`
        );
      } catch (sendError) {
        logger.error({
          msg: 'Error sending error message to user',
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
        });
      }

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2, // Process 2 conversions simultaneously
  }
);

/**
 * Send all pending stickers (those marked as 'pendente' due to daily limit)
 * Includes comprehensive logging to pending_sticker_sends table for full traceability
 *
 * @returns Object with statistics about sent, failed, and total stickers processed
 */
async function sendPendingStickerWorker(): Promise<{
  totalProcessed: number;
  sent: number;
  failed: number;
  errors: Array<{ stickerId: string; error: string }>;
}> {
  const startTime = Date.now();
  const workerId = process.env.HOSTNAME || process.env.CONTAINER_ID || 'local';

  logger.info({
    msg: '[PENDING-WORKER] Starting pending sticker worker',
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
      .select('id, user_number, processed_url, tipo, created_at')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true }); // Send oldest first (FIFO)

    if (queryError) {
      logger.error({
        msg: '[PENDING-WORKER] Error querying pending stickers',
        error: queryError,
      });
      throw queryError;
    }

    if (!pendingStickers || pendingStickers.length === 0) {
      logger.info({
        msg: '[PENDING-WORKER] No pending stickers to send',
        workerId,
      });
      return { totalProcessed: 0, sent: 0, failed: 0, errors: [] };
    }

    logger.info({
      msg: '[PENDING-WORKER] Found pending stickers',
      count: pendingStickers.length,
      workerId,
    });

    // Step 2: Process each pending sticker
    for (const sticker of pendingStickers) {
      totalProcessed++;
      const stickerStartTime = Date.now();

      logger.info({
        msg: '[PENDING-WORKER] Processing pending sticker',
        stickerId: sticker.id,
        userNumber: sticker.user_number,
        createdAt: sticker.created_at,
        position: `${totalProcessed}/${pendingStickers.length}`,
      });

      try {
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
            msg: '[PENDING-WORKER] Error creating log entry',
            stickerId: sticker.id,
            error: logError,
          });
          // Continue anyway - logging failure shouldn't block sending
        }

        // Attempt to send sticker
        await sendSticker(sticker.user_number, sticker.processed_url);

        const processingTimeMs = Date.now() - stickerStartTime;

        // Success! Update sticker status to 'enviado'
        const { error: updateStickerError } = await supabase
          .from('stickers')
          .update({ status: 'enviado' })
          .eq('id', sticker.id);

        if (updateStickerError) {
          logger.error({
            msg: '[PENDING-WORKER] Error updating sticker status',
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
          msg: '[PENDING-WORKER] Sticker sent successfully',
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
          msg: '[PENDING-WORKER] Failed to send sticker',
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
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const totalTimeMs = Date.now() - startTime;

    logger.info({
      msg: '[PENDING-WORKER] Pending sticker worker completed',
      workerId,
      totalProcessed,
      sent,
      failed,
      totalTimeMs,
      successRate: totalProcessed > 0 ? `${((sent / totalProcessed) * 100).toFixed(1)}%` : '0%',
    });

    return { totalProcessed, sent, failed, errors };
  } catch (error) {
    logger.error({
      msg: '[PENDING-WORKER] Fatal error in pending sticker worker',
      error: error instanceof Error ? error.message : 'Unknown error',
      workerId,
    });

    throw error;
  }
}

// Scheduled Jobs Worker
const scheduledJobsWorker = new Worker<ScheduledJob>(
  'scheduled-jobs',
  async (job: Job<ScheduledJob>) => {
    const { type } = job.data;

    logger.info({
      msg: 'Processing scheduled job',
      jobId: job.id,
      type,
    });

    switch (type) {
      case 'reset-counters':
        // Reset daily_count for all users
        logger.info('Reset daily counters (TODO - Sprint 6)');
        break;

      case 'send-pending':
        // Send pending stickers with comprehensive logging
        try {
          const result = await sendPendingStickerWorker();

          logger.info({
            msg: '[SCHEDULED-JOB] send-pending completed',
            jobId: job.id,
            result,
          });

          return {
            success: true,
            type,
            stats: result,
          };
        } catch (error) {
          logger.error({
            msg: '[SCHEDULED-JOB] send-pending failed',
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          // Alert on failure
          const { alertWorkerFailure } = await import('./services/alertService');
          await alertWorkerFailure({
            service: 'scheduled-jobs',
            errorType: 'send-pending',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            additionalInfo: {
              jobId: job.id,
            },
          });

          throw error;
        }

      case 'process-campaigns':
        // Process pending campaign messages
        try {
          const {
            processPendingCampaignMessages,
            checkCancelConditions,
            revertStuckProcessing,
          } = await import('./services/campaignService');

          // 1. Revert stuck campaigns (recovery from crashes)
          const reverted = await revertStuckProcessing(10);
          if (reverted > 0) {
            logger.warn({
              msg: '[CAMPAIGN-JOB] Reverted stuck campaigns',
              count: reverted,
            });
          }

          // 2. Check and cancel campaigns that met cancel conditions
          const cancelled = await checkCancelConditions();
          if (cancelled > 0) {
            logger.info({
              msg: '[CAMPAIGN-JOB] Cancelled campaigns by condition',
              count: cancelled,
            });
          }

          // 3. Process pending messages (conservative rate limiting to avoid WhatsApp ban)
          // batch: 20 msgs max, delay: 1000ms between each = ~20 msgs/min
          const result = await processPendingCampaignMessages(20, 1000);

          logger.info({
            msg: '[SCHEDULED-JOB] process-campaigns completed',
            jobId: job.id,
            reverted,
            cancelled,
            ...result,
          });

          return {
            success: true,
            type,
            stats: { reverted, cancelled, ...result },
          };
        } catch (error) {
          logger.error({
            msg: '[SCHEDULED-JOB] process-campaigns failed',
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          // Alert on failure
          const { alertWorkerFailure } = await import('./services/alertService');
          await alertWorkerFailure({
            service: 'scheduled-jobs',
            errorType: 'process-campaigns',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            additionalInfo: {
              jobId: job.id,
            },
          });

          throw error;
        }
    }

    return { success: true, type };
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process scheduled jobs one at a time
  }
);

// Worker event handlers
processStickerWorker.on('completed', (job) => {
  logger.info({
    msg: 'Job completed',
    queue: 'process-sticker',
    jobId: job.id,
  });
});

processStickerWorker.on('failed', (job, err) => {
  logger.error({
    msg: 'Job failed',
    queue: 'process-sticker',
    jobId: job?.id,
    error: err.message,
  });
});

scheduledJobsWorker.on('completed', (job) => {
  logger.info({
    msg: 'Scheduled job completed',
    jobId: job.id,
  });
});

scheduledJobsWorker.on('failed', (job, err) => {
  logger.error({
    msg: 'Scheduled job failed',
    jobId: job?.id,
    error: err.message,
  });
});

downloadTwitterVideoWorker.on('completed', (job) => {
  logger.info({
    msg: 'Twitter video download job completed',
    queue: 'download-twitter-video',
    jobId: job.id,
  });
});

downloadTwitterVideoWorker.on('failed', (job, err) => {
  logger.error({
    msg: 'Twitter video download job failed',
    queue: 'download-twitter-video',
    jobId: job?.id,
    error: err.message,
  });
});

// Activate PIX Subscription Worker
const activatePixSubscriptionWorker = new Worker<ActivatePixJobData>(
  'activate-pix-subscription',
  activatePendingPixSubscriptionJob,
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

activatePixSubscriptionWorker.on('completed', (job) => {
  logger.info({
    msg: 'PIX subscription activation job completed',
    queue: 'activate-pix-subscription',
    jobId: job.id,
  });
});

activatePixSubscriptionWorker.on('failed', (job, err) => {
  logger.error({
    msg: 'PIX subscription activation job failed',
    queue: 'activate-pix-subscription',
    jobId: job?.id,
    error: err.message,
  });
});

// Cleanup Sticker Worker (Remove Borders/Background)
const cleanupStickerWorker = new Worker<any>(
  'cleanup-sticker',
  async (job: Job<any>) => {
    const { userNumber, userName, messageKey, isAnimated, userId, messageType } = job.data;
    const startTime = Date.now();

    // Detect job type:
    // - If messageType exists → remove background from original image (reprocess)
    // - If messageType doesn't exist → cleanup sticker (remove borders)
    const isBackgroundRemoval = !!messageType;

    logger.info({
      msg: isBackgroundRemoval
        ? 'Processing remove background job'
        : 'Processing cleanup sticker job',
      jobId: job.id,
      jobName: job.name,
      userNumber,
      userName,
      isBackgroundRemoval,
    });

    try {
      // Step 1: Download media from Evolution API
      logger.info({
        msg: `Step 1: Downloading ${isBackgroundRemoval ? 'original image' : 'sticker'}`,
        jobId: job.id,
      });

      const { downloadMedia } = await import('./services/evolutionApi');
      const mediaBuffer = await downloadMedia(messageKey);

      logger.info({
        msg: isBackgroundRemoval ? 'Original image downloaded' : 'Sticker downloaded',
        jobId: job.id,
        bufferSize: mediaBuffer.length,
      });

      let finalBuffer: Buffer;
      let tipo: 'estatico' | 'animado';
      let rembgTime = 0;

      // Import modules for rembg execution
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const fs = await import('fs');
      const path = await import('path');
      const { tmpdir } = await import('os');

      if (isBackgroundRemoval) {
        // PATH A: Remove background from ORIGINAL image, then create sticker
        logger.info({ msg: 'Step 2: Removing background from original image', jobId: job.id });

        const tempDir = tmpdir();
        const inputExt = messageType === 'gif' ? '.mp4' : '.jpg';
        const inputPath = path.join(tempDir, `bg-input-${job.id}${inputExt}`);
        const outputPath = path.join(tempDir, `bg-output-${job.id}.png`);

        fs.writeFileSync(inputPath, mediaBuffer);

        // Run rembg with stderr capture
        const rembgStartTime = Date.now();
        try {
          const { stdout, stderr } = await execAsync(`rembg i "${inputPath}" "${outputPath}"`);
          rembgTime = Date.now() - rembgStartTime;

          if (stderr) {
            logger.warn({ msg: 'rembg stderr output', jobId: job.id, stderr });
          }
          if (stdout) {
            logger.debug({ msg: 'rembg stdout output', jobId: job.id, stdout });
          }
        } catch (error: any) {
          logger.error({
            msg: 'rembg command failed',
            jobId: job.id,
            error: error.message,
            stdout: error.stdout,
            stderr: error.stderr,
            code: error.code,
          });
          throw new Error(`rembg failed: ${error.stderr || error.message}`);
        }

        logger.info({
          msg: 'Background removed successfully',
          jobId: job.id,
          rembgTime,
        });

        const cleanedBuffer = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        logger.info({ msg: 'Step 3: Converting to sticker format', jobId: job.id });

        if (messageType === 'gif') {
          const result = await processAnimatedStickerFromBuffer(cleanedBuffer);
          finalBuffer = result.buffer;
          tipo = 'animado';
        } else {
          const sharp = (await import('sharp')).default;
          finalBuffer = await sharp(cleanedBuffer)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 95 })
            .toBuffer();
          tipo = 'estatico';
        }
      } else {
        // PATH B: Remove borders from existing STICKER
        logger.info({ msg: 'Step 2: Removing borders from sticker', jobId: job.id });

        const tempDir = tmpdir();
        const inputPath = path.join(tempDir, `cleanup-input-${job.id}.webp`);
        const outputPath = path.join(tempDir, `cleanup-output-${job.id}.png`);

        fs.writeFileSync(inputPath, mediaBuffer);

        // Run rembg with stderr capture
        const rembgStartTime = Date.now();
        try {
          const { stdout, stderr } = await execAsync(`rembg i "${inputPath}" "${outputPath}"`);
          rembgTime = Date.now() - rembgStartTime;

          if (stderr) {
            logger.warn({ msg: 'rembg stderr output', jobId: job.id, stderr });
          }
          if (stdout) {
            logger.debug({ msg: 'rembg stdout output', jobId: job.id, stdout });
          }
        } catch (error: any) {
          logger.error({
            msg: 'rembg command failed',
            jobId: job.id,
            error: error.message,
            stdout: error.stdout,
            stderr: error.stderr,
            code: error.code,
          });
          throw new Error(`rembg failed: ${error.stderr || error.message}`);
        }

        logger.info({
          msg: 'Borders removed successfully',
          jobId: job.id,
          rembgTime,
        });

        const cleanedBuffer = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);

        logger.info({ msg: 'Step 3: Converting to sticker format', jobId: job.id });

        if (isAnimated) {
          const result = await processAnimatedStickerFromBuffer(cleanedBuffer);
          finalBuffer = result.buffer;
          tipo = 'animado';
        } else {
          const cleanedPath = path.join(tempDir, `cleaned-${job.id}.png`);
          fs.writeFileSync(cleanedPath, cleanedBuffer);

          const sharp = (await import('sharp')).default;
          finalBuffer = await sharp(cleanedPath)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 95 })
            .toBuffer();

          fs.unlinkSync(cleanedPath);
          tipo = 'estatico';
        }
      }

      // Step 4: Send sticker back to user
      logger.info({ msg: 'Step 4: Sending cleaned sticker', jobId: job.id });

      const uploadResult = await uploadSticker(finalBuffer, userNumber, tipo);
      await sendSticker(userNumber, uploadResult.url);

      // Step 5: Get remaining count (DON'T increment - editing doesn't count)
      const userLimits = await getUserLimits(userId!);
      const { data: userData } = await supabase
        .from('users')
        .select('daily_count')
        .eq('id', userId)
        .single();

      const remaining = Math.max(0, userLimits.daily_sticker_limit - (userData?.daily_count || 0));

      const processingTime = Date.now() - startTime;

      // Send success message
      const successMessage = isBackgroundRemoval
        ? `✅ *Pronto, ${userName}!*\n\n✨ Sua figurinha sem fundo está pronta!\n\nFundo 100% transparente! 🎨\n\n🎁 *${remaining} figurinha${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}* hoje.\n\n💡 *Essa edição não contou no seu limite!*`
        : `✅ *Pronto, ${userName}!*\n\n🧹 Sua figurinha está limpinha!\n\nSem bordas brancas! 🎨\n\n🎁 *${remaining} figurinha${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}* hoje.\n\n💡 *Essa edição não contou no seu limite!*`;

      await sendText(userNumber, successMessage);

      logger.info({
        msg: isBackgroundRemoval
          ? 'Remove background job completed'
          : 'Cleanup sticker job completed',
        jobId: job.id,
        userNumber,
        processingTime,
        rembgTime,
        fileSize: finalBuffer.length,
      });

      return { success: true, tipo, fileSize: finalBuffer.length, processingTime, rembgTime };
    } catch (error: any) {
      logger.error({
        msg: isBackgroundRemoval ? 'Remove background job failed' : 'Cleanup sticker job failed',
        jobId: job.id,
        userNumber,
        error: error.message,
        stack: error.stack,
      });

      // Send error message to user
      const errorMessage = isBackgroundRemoval
        ? `❌ *Erro ao remover fundo*\n\n😔 Ocorreu um erro ao processar sua imagem.\n\nPor favor, tente novamente ou digite *ajuda* para suporte.`
        : `❌ *Erro ao remover bordas*\n\n😔 Ocorreu um erro ao processar sua figurinha.\n\nPor favor, tente novamente ou digite *ajuda* para suporte.`;

      await sendText(userNumber, errorMessage);

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

cleanupStickerWorker.on('completed', (job) => {
  logger.info({
    msg: 'Cleanup sticker job completed',
    queue: 'cleanup-sticker',
    jobId: job.id,
  });
});

cleanupStickerWorker.on('failed', (job, err) => {
  logger.error({
    msg: 'Cleanup sticker job failed',
    queue: 'cleanup-sticker',
    jobId: job?.id,
    error: err.message,
  });
});

// ============================================
// EDIT BUTTONS WORKER (Debounced)
// ============================================
const editButtonsWorker = new Worker<EditButtonsJobData>(
  'edit-buttons',
  async (job) => {
    const { userNumber, stickerUrl, stickerPath, messageKey, messageType, tipo } = job.data;

    logger.info({
      msg: 'Processing edit buttons job',
      jobId: job.id,
      userNumber,
    });

    try {
      // Import functions
      const { sendStickerEditButtons } = await import('./services/menuService');
      const { saveConversationContext } = await import('./utils/conversationContext');

      // Save context with sticker URL and original messageKey for editing
      await saveConversationContext(userNumber, 'awaiting_sticker_edit', {
        sticker_url: stickerUrl,
        sticker_path: stickerPath,
        message_key: messageKey,
        message_type: messageType,
        tipo,
      });

      // Send edit buttons
      await sendStickerEditButtons(userNumber);

      logger.info({
        msg: 'Edit buttons sent successfully',
        jobId: job.id,
        userNumber,
      });

      return { success: true };
    } catch (error: any) {
      logger.error({
        msg: 'Failed to send edit buttons',
        jobId: job.id,
        userNumber,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // High concurrency since it's just sending messages
  }
);

editButtonsWorker.on('completed', (job) => {
  logger.info({
    msg: 'Edit buttons job completed',
    queue: 'edit-buttons',
    jobId: job.id,
  });
});

editButtonsWorker.on('failed', (job, err) => {
  logger.error({
    msg: 'Edit buttons job failed',
    queue: 'edit-buttons',
    jobId: job?.id,
    error: err.message,
  });
});

// ============================================
// CAMPAIGN MESSAGE SCHEDULER
// Runs every 60 seconds to process pending campaign messages
// ============================================
import { scheduledJobsQueue } from './config/queue';

let campaignSchedulerInterval: NodeJS.Timeout | null = null;

async function startCampaignScheduler() {
  logger.info({
    msg: '[CAMPAIGN-SCHEDULER] Starting campaign message scheduler',
    intervalMs: 60000,
  });

  // Run immediately on startup
  try {
    await scheduledJobsQueue.add(
      'process-campaigns',
      { type: 'process-campaigns' as const },
      {
        jobId: `campaign-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: { age: 3600 }, // Keep failed for 1 hour
      }
    );
  } catch (error) {
    logger.error({
      msg: '[CAMPAIGN-SCHEDULER] Error scheduling initial campaign job',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Then schedule every 60 seconds
  campaignSchedulerInterval = setInterval(async () => {
    try {
      await scheduledJobsQueue.add(
        'process-campaigns',
        { type: 'process-campaigns' as const },
        {
          jobId: `campaign-${Date.now()}`,
          removeOnComplete: true,
          removeOnFail: { age: 3600 },
        }
      );

      logger.debug({
        msg: '[CAMPAIGN-SCHEDULER] Campaign job scheduled',
      });
    } catch (error) {
      logger.error({
        msg: '[CAMPAIGN-SCHEDULER] Error scheduling campaign job',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, 60000); // Every 60 seconds
}

// Start the campaign scheduler
startCampaignScheduler();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing workers...');
  if (campaignSchedulerInterval) {
    clearInterval(campaignSchedulerInterval);
  }
  await processStickerWorker.close();
  await scheduledJobsWorker.close();
  await downloadTwitterVideoWorker.close();
  await convertTwitterStickerWorker.close();
  await activatePixSubscriptionWorker.close();
  await cleanupStickerWorker.close();
  await editButtonsWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing workers...');
  if (campaignSchedulerInterval) {
    clearInterval(campaignSchedulerInterval);
  }
  await processStickerWorker.close();
  await scheduledJobsWorker.close();
  await downloadTwitterVideoWorker.close();
  await convertTwitterStickerWorker.close();
  await activatePixSubscriptionWorker.close();
  await cleanupStickerWorker.close();
  await editButtonsWorker.close();
  process.exit(0);
});

logger.info('🔧 Workers started and waiting for jobs...');
logger.info('  - process-sticker (concurrency: 5)');
logger.info('  - scheduled-jobs (concurrency: 1)');
logger.info('  - download-twitter-video (concurrency: 3)');
logger.info('  - convert-twitter-sticker (concurrency: 2)');
logger.info('  - activate-pix-subscription (concurrency: 2)');
logger.info('  - cleanup-sticker (concurrency: 2)');
logger.info('  - edit-buttons (concurrency: 5, debounced 10s)');
logger.info('  - campaign-scheduler (interval: 60s)');
