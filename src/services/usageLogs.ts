import { supabase } from '../config/supabase';
import logger from '../config/logger';

export type UsageAction =
  | 'sticker_created'
  | 'sticker_sent'
  | 'limit_reached'
  | 'error'
  | 'message_received'
  | 'webhook_received'
  | 'processing_started'
  | 'processing_completed'
  | 'processing_failed'
  | 'twitter_download_started'
  | 'twitter_download_completed'
  | 'twitter_download_failed'
  | 'twitter_conversion_started'
  | 'twitter_conversion_completed'
  | 'twitter_conversion_failed'
  | 'twitter_limit_reached';

interface LogUsageParams {
  userNumber: string;
  action: UsageAction;
  details?: Record<string, any>;
}

export async function logUsage({ userNumber, action, details = {} }: LogUsageParams): Promise<void> {
  try {
    const { error } = await supabase.from('usage_logs').insert({
      user_number: userNumber,
      action,
      details,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error({ error, userNumber, action }, 'Failed to save usage log');
    } else {
      logger.debug({ userNumber, action }, 'Usage log saved');
    }
  } catch (err) {
    logger.error({ err, userNumber, action }, 'Error saving usage log');
  }
}

export async function logStickerCreated(params: {
  userNumber: string;
  userName?: string;
  messageType: string;
  fileSize: number;
  processingTimeMs: number;
  tipo: 'estatico' | 'animado';
  status: string;
  storagePath: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'sticker_created',
    details: {
      user_name: params.userName,
      message_type: params.messageType,
      file_size: params.fileSize,
      processing_time_ms: params.processingTimeMs,
      tipo: params.tipo,
      status: params.status,
      storage_path: params.storagePath,
    },
  });
}

export async function logLimitReached(params: {
  userNumber: string;
  userName?: string;
  dailyCount: number;
  limit: number;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'limit_reached',
    details: {
      user_name: params.userName,
      daily_count: params.dailyCount,
      limit: params.limit,
    },
  });
}

export async function logError(params: {
  userNumber: string;
  errorMessage: string;
  errorStack?: string;
  context?: Record<string, any>;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'error',
    details: {
      error_message: params.errorMessage,
      error_stack: params.errorStack,
      context: params.context,
    },
  });
}

export async function logMessageReceived(params: {
  userNumber: string;
  userName?: string;
  messageType: string;
  messageId: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'message_received',
    details: {
      user_name: params.userName,
      message_type: params.messageType,
      message_id: params.messageId,
    },
  });
}

export async function logWebhookReceived(params: {
  instance: string;
  event: string;
  messageType?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.instance,
    action: 'webhook_received',
    details: {
      event: params.event,
      message_type: params.messageType,
    },
  });
}

export async function logProcessingStarted(params: {
  userNumber: string;
  userName?: string;
  messageType: string;
  jobId: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'processing_started',
    details: {
      user_name: params.userName,
      message_type: params.messageType,
      job_id: params.jobId,
    },
  });
}

export async function logProcessingCompleted(params: {
  userNumber: string;
  jobId: string;
  processingTimeMs: number;
  success: boolean;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'processing_completed',
    details: {
      job_id: params.jobId,
      processing_time_ms: params.processingTimeMs,
      success: params.success,
    },
  });
}

export async function logProcessingFailed(params: {
  userNumber: string;
  jobId: string;
  errorMessage: string;
  errorStack?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'processing_failed',
    details: {
      job_id: params.jobId,
      error_message: params.errorMessage,
      error_stack: params.errorStack,
    },
  });
}

// ========================================
// TWITTER-SPECIFIC LOGGING FUNCTIONS
// ========================================

/**
 * Log when Twitter download starts
 */
export async function logTwitterDownloadStarted(params: {
  userNumber: string;
  userName?: string;
  twitterUrl: string;
  tweetId: string;
  tweetAuthor: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'twitter_download_started',
    details: {
      user_name: params.userName,
      twitter_url: params.twitterUrl,
      tweet_id: params.tweetId,
      tweet_author: params.tweetAuthor,
    },
  });
}

/**
 * Log when Twitter download completes successfully
 */
export async function logTwitterDownloadCompleted(params: {
  userNumber: string;
  tweetId: string;
  tweetAuthor: string;
  fileSize: number;
  downloadTimeMs: number;
  videoFormat: string;
  videoQuality?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'twitter_download_completed',
    details: {
      tweet_id: params.tweetId,
      tweet_author: params.tweetAuthor,
      file_size: params.fileSize,
      download_time_ms: params.downloadTimeMs,
      video_format: params.videoFormat,
      video_quality: params.videoQuality,
    },
  });
}

/**
 * Log when Twitter download fails
 */
export async function logTwitterDownloadFailed(params: {
  userNumber: string;
  twitterUrl: string;
  tweetId?: string;
  errorMessage: string;
  errorStack?: string;
  errorType?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'twitter_download_failed',
    details: {
      twitter_url: params.twitterUrl,
      tweet_id: params.tweetId,
      error_message: params.errorMessage,
      error_stack: params.errorStack,
      error_type: params.errorType,
    },
  });
}

/**
 * Log when Twitter video conversion to sticker starts
 */
export async function logTwitterConversionStarted(params: {
  userNumber: string;
  tweetId: string;
  videoPath: string;
  videoSize: number;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'twitter_conversion_started',
    details: {
      tweet_id: params.tweetId,
      video_path: params.videoPath,
      video_size: params.videoSize,
    },
  });
}

/**
 * Log when Twitter video conversion completes successfully
 */
export async function logTwitterConversionCompleted(params: {
  userNumber: string;
  tweetId: string;
  conversionTimeMs: number;
  originalSize: number;
  stickerSize: number;
  compressionRatio: number;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'twitter_conversion_completed',
    details: {
      tweet_id: params.tweetId,
      conversion_time_ms: params.conversionTimeMs,
      original_size: params.originalSize,
      sticker_size: params.stickerSize,
      compression_ratio: params.compressionRatio,
    },
  });
}

/**
 * Log when Twitter video conversion fails
 */
export async function logTwitterConversionFailed(params: {
  userNumber: string;
  tweetId: string;
  errorMessage: string;
  errorStack?: string;
  videoPath?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'twitter_conversion_failed',
    details: {
      tweet_id: params.tweetId,
      error_message: params.errorMessage,
      error_stack: params.errorStack,
      video_path: params.videoPath,
    },
  });
}

/**
 * Log when user reaches Twitter download limit
 */
export async function logTwitterLimitReached(params: {
  userNumber: string;
  userName?: string;
  twitterDownloadCount: number;
  limit: number;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'twitter_limit_reached',
    details: {
      user_name: params.userName,
      twitter_download_count: params.twitterDownloadCount,
      limit: params.limit,
    },
  });
}
