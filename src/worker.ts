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
        logger.info({ msg: 'Sending video to user', jobId: job.id });

        const caption = `🐦 Vídeo do Twitter baixado com sucesso!`;

        await sendVideo(userNumber, url, caption);

        logger.info({
          msg: 'Video sent to user successfully',
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

      // Step 6: Get user ID and increment sticker count (not Twitter count!)
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('whatsapp_number', userNumber)
        .single();

      if (user?.id) {
        logger.info({ msg: 'Step 6: Incrementing daily sticker count', jobId: job.id });
        await incrementDailyCount(user.id);
      }

      // Step 7: Update download record
      logger.info({ msg: 'Step 7: Updating download record', jobId: job.id });

      await supabase
        .from('twitter_downloads')
        .update({
          converted_to_sticker: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', downloadId);

      // Step 8: Send success message
      await sendText(
        userNumber,
        `✅ *Figurinha criada com sucesso!*\n\nSua figurinha animada do Twitter está pronta! 🎨`
      );

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
  await convertTwitterStickerWorker.close();
  await activatePixSubscriptionWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing workers...');
  await processStickerWorker.close();
  await scheduledJobsWorker.close();
  await downloadTwitterVideoWorker.close();
  await convertTwitterStickerWorker.close();
  await activatePixSubscriptionWorker.close();
  process.exit(0);
});

logger.info('🔧 Workers started and waiting for jobs...');
logger.info('  - process-sticker (concurrency: 5)');
logger.info('  - scheduled-jobs (concurrency: 1)');
logger.info('  - download-twitter-video (concurrency: 3)');
logger.info('  - convert-twitter-sticker (concurrency: 2)');
logger.info('  - activate-pix-subscription (concurrency: 2)');
