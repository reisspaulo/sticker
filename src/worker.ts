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
import { ProcessStickerJobData } from './types/evolution';
import { TwitterDownloadJobData } from './types/twitter';
import { incrementDailyCount, getPendingStickerCount } from './services/userService';
import { getUserLimits } from './services/subscriptionService';
import {
  sendLimitReachedMessage,
  sendErrorMessage,
  sendVideoSelectionMessage,
} from './services/messageService';
import {
  logProcessingStarted,
  logStickerCreated,
  logProcessingFailed,
  logLimitReached,
  logError,
} from './services/usageLogs';
import { downloadTwitterVideo, getVideoMetadata } from './services/twitterService';
import { uploadTwitterVideo } from './services/twitterStorage';
import { incrementTwitterDownloadCount, getRemainingTwitterDownloads } from './services/twitterLimits';
import { saveVideoSelectionContext } from './utils/videoSelectionContext';
import { activatePendingPixSubscriptionJob } from './jobs/activatePendingPixSubscription';
import type { ActivatePixJobData } from './jobs/activatePendingPixSubscription';

interface ScheduledJob {
  type: 'reset-counters' | 'send-pending';
}

// Redis connection configuration for Workers
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisConnection = {
  host: redisUrl.includes('://') ? new URL(redisUrl).hostname : redisUrl.split(':')[0],
  port: redisUrl.includes('://') ? parseInt(new URL(redisUrl).port || '6379') : parseInt(redisUrl.split(':')[1] || '6379'),
  password: redisUrl.includes('://') ? new URL(redisUrl).password || undefined : undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

// Process Sticker Worker
const processStickerWorker = new Worker<ProcessStickerJobData>(
  'process-sticker',
  async (job: Job<ProcessStickerJobData>) => {
    const { userNumber, userName, messageType, messageKey, status = 'enviado', userId } = job.data;
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
        logger.info({ msg: 'Step 3: Sending sticker to user', jobId: job.id });
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

      // Step 5: Update user's daily count (only if sent)
      if (status === 'enviado' && userId) {
        logger.info({ msg: 'Step 5: Incrementing daily count', jobId: job.id });
        const newCount = await incrementDailyCount(userId);

        // Get user's actual limits based on subscription
        const userLimits = await getUserLimits(userId);
        const actualLimit = userLimits.daily_sticker_limit;
        const remainingToday = Math.max(0, actualLimit - newCount);

        // Onboarding: Update step and send personalized confirmation
        const {
          updateOnboardingStep,
          getOnboardingStatus,
          sendStickerConfirmation,
          checkTwitterFeaturePresentation,
        } = await import('./services/onboardingService');

        const onboardingStatus = await getOnboardingStatus(userNumber);
        let currentStep = onboardingStatus?.step || 0;

        // Update step based on daily count (only for first 3 stickers)
        if (currentStep < 3) {
          currentStep = Math.min(newCount, 3);
          await updateOnboardingStep(userNumber, currentStep);
        }

        // Send personalized confirmation message
        await sendStickerConfirmation(userNumber, userName, remainingToday, currentStep);

        // Check if should present Twitter feature (after 3rd sticker)
        if (currentStep === 3) {
          await checkTwitterFeaturePresentation(userNumber, userName, currentStep);
        }
      } else if (status === 'pendente') {
        // User hit limit - send limit reached message
        const pendingCount = await getPendingStickerCount(userNumber);
        await sendLimitReachedMessage(userNumber, userName, pendingCount);

        // Log limit reached (get actual limit)
        if (userId) {
          const userLimits = await getUserLimits(userId);
          await logLimitReached({
            userNumber,
            userName,
            dailyCount: userLimits.daily_sticker_limit, // They hit the limit
            limit: userLimits.daily_sticker_limit,
          });
        }
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
        const { path, url } = await uploadSticker(
          result.buffer,
          userNumber,
          'animado'
        );

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
        await sendVideoSelectionMessage(userNumber, userName, metadata.allVideos, remainingDownloads);

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

      // Step 4: Send video to user via Evolution API
      logger.info({ msg: 'Step 4: Sending video to user', jobId: job.id });

      const caption = `🐦 Vídeo do Twitter baixado com sucesso!\n\n📊 Informações:\n• Autor: @${downloadedMetadata.username} (${downloadedMetadata.author})\n• Duração: ${downloadedMetadata.durationSec?.toFixed(1)}s\n• Tamanho: ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n• Curtidas: ${downloadedMetadata.likes}`;

      await sendVideo(userNumber, url, caption);

      logger.info({
        msg: 'Video sent to user successfully',
        jobId: job.id,
        userNumber,
      });

      // Step 5: Save metadata to database
      logger.info({ msg: 'Step 5: Saving metadata to database', jobId: job.id });

      const { error: dbError } = await supabase.from('twitter_downloads').insert({
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
      });

      if (dbError) {
        logger.error({
          msg: 'Error saving Twitter download metadata',
          error: dbError.message,
          userNumber,
          tweetId,
        });
        // Don't throw - video was already sent
      }

      // Step 6: Update user's Twitter download count
      if (userId) {
        logger.info({ msg: 'Step 6: Incrementing Twitter download count', jobId: job.id });
        await incrementTwitterDownloadCount(userId);

        // Mark Twitter feature as used (first time)
        const { markTwitterFeatureAsUsed } = await import('./services/onboardingService');
        await markTwitterFeatureAsUsed(userNumber);
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
  }
);

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

    // TODO: Sprint 6 - Implement scheduled jobs
    switch (type) {
      case 'reset-counters':
        // Reset daily_count for all users
        logger.info('Reset daily counters (TODO - Sprint 6)');
        break;
      case 'send-pending':
        // Send pending stickers
        logger.info('Send pending stickers (TODO - Sprint 6)');
        break;
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing workers...');
  await processStickerWorker.close();
  await scheduledJobsWorker.close();
  await downloadTwitterVideoWorker.close();
  await activatePixSubscriptionWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing workers...');
  await processStickerWorker.close();
  await scheduledJobsWorker.close();
  await downloadTwitterVideoWorker.close();
  await activatePixSubscriptionWorker.close();
  process.exit(0);
});

logger.info('🔧 Workers started and waiting for jobs...');
logger.info('  - process-sticker (concurrency: 5)');
logger.info('  - scheduled-jobs (concurrency: 1)');
logger.info('  - download-twitter-video (concurrency: 3)');
logger.info('  - activate-pix-subscription (concurrency: 2)');
