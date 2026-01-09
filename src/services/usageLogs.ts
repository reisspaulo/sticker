import { supabase } from '../config/supabase';
import logger from '../config/logger';

export type UsageAction =
  | 'sticker_created'
  | 'sticker_sent'
  | 'limit_reached'
  | 'error'
  | 'message_received'
  | 'text_message_received'
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
  | 'twitter_limit_reached'
  | 'button_clicked'
  | 'message_sent'
  | 'menu_sent'
  | 'pix_button_sent';

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
  dailyLimit: number;
  abTestGroup?: string;
  messageType?: string;
  wasNotified?: boolean;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'limit_reached',
    details: {
      user_name: params.userName,
      daily_count: params.dailyCount,
      daily_limit: params.dailyLimit,
      ab_test_group: params.abTestGroup,
      message_type: params.messageType,
      was_notified: params.wasNotified,
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

// ========================================
// TEXT MESSAGE LOGGING
// ========================================

/**
 * Log text messages received from users
 * Saves the content for analysis and debugging
 */
export async function logTextMessageReceived(params: {
  userNumber: string;
  userName?: string;
  messageId: string;
  textContent: string;
  isCommand?: boolean;
  commandType?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'text_message_received',
    details: {
      user_name: params.userName,
      message_id: params.messageId,
      text_content: params.textContent,
      is_command: params.isCommand || false,
      command_type: params.commandType,
    },
  });
}

// ========================================
// BUTTON & INTERACTION LOGGING
// ========================================

/**
 * Log when user clicks a button (interactive buttons, quick replies, etc.)
 */
export async function logButtonClicked(params: {
  userNumber: string;
  userName?: string;
  buttonId: string;
  buttonText: string;
  menuType?: string;
  context?: Record<string, any>;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'button_clicked',
    details: {
      user_name: params.userName,
      button_id: params.buttonId,
      button_text: params.buttonText,
      menu_type: params.menuType,
      context: params.context,
    },
  });
}

/**
 * Log when a sticker is successfully sent to user
 */
export async function logStickerSent(params: {
  userNumber: string;
  stickerPath: string;
  tipo: 'estatico' | 'animado';
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'sticker_sent',
    details: {
      sticker_path: params.stickerPath,
      tipo: params.tipo,
      success: params.success,
      error_message: params.errorMessage,
    },
  });
}

/**
 * Log when a text message is sent to user
 */
export async function logMessageSent(params: {
  userNumber: string;
  messageType: 'text' | 'welcome' | 'limit' | 'error' | 'help' | 'plans' | 'status' | 'other';
  messagePreview?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'message_sent',
    details: {
      message_type: params.messageType,
      message_preview: params.messagePreview?.substring(0, 100),
      success: params.success,
      error_message: params.errorMessage,
    },
  });
}

/**
 * Log when a menu (interactive buttons/list) is sent to user
 */
export async function logMenuSent(params: {
  userNumber: string;
  menuType: 'upgrade' | 'plans' | 'welcome' | 'limit_reached' | 'pix_options' | 'other';
  buttonCount: number;
  title?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'menu_sent',
    details: {
      menu_type: params.menuType,
      button_count: params.buttonCount,
      title: params.title,
      success: params.success,
      error_message: params.errorMessage,
    },
  });
}

/**
 * Log when PIX payment button is sent to user
 */
export async function logPixButtonSent(params: {
  userNumber: string;
  plan: 'premium' | 'ultra';
  amount: number;
  pixCode?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'pix_button_sent',
    details: {
      plan: params.plan,
      amount: params.amount,
      pix_code_preview: params.pixCode?.substring(0, 20),
      success: params.success,
      error_message: params.errorMessage,
    },
  });
}

// ========================================
// LIMIT MENU LOGGING
// ========================================

/**
 * Log when limit reached menu is sent to user
 */
export async function logLimitMenuSent(params: {
  userNumber: string;
  userName?: string;
  currentPlan: string;
  abTestGroup: string;
  bonusCreditsUsed: number;
  buttonsShown: string[];
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  await logUsage({
    userNumber: params.userNumber,
    action: 'menu_sent',
    details: {
      user_name: params.userName,
      menu_type: 'limit_reached',
      current_plan: params.currentPlan,
      ab_test_group: params.abTestGroup,
      bonus_credits_used: params.bonusCreditsUsed,
      buttons_shown: params.buttonsShown,
      success: params.success,
      error_message: params.errorMessage,
    },
  });
}
