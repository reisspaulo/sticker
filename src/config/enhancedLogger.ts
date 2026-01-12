/**
 * Enhanced Logger with Trace IDs and Structured Context
 * Extends the base logger with tracing capabilities
 */

import pino from 'pino';
import { randomUUID } from 'crypto';

const isDev = process.env.NODE_ENV !== 'production';

// Create base logger
const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          messageFormat: '[{traceId}] {msg}',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Generate a unique trace ID
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * Create a child logger with trace ID
 */
export function createTracedLogger(context: {
  traceId?: string;
  userNumber?: string;
  tweetId?: string;
  jobId?: string;
  [key: string]: any;
}) {
  return baseLogger.child({
    traceId: context.traceId || generateTraceId(),
    ...context,
  });
}

/**
 * Log with structured context
 */
export function logWithContext(
  level: 'info' | 'warn' | 'error' | 'debug',
  context: Record<string, any>,
  message: string
) {
  const logger = createTracedLogger(context);
  logger[level](message);
}

/**
 * Log Twitter download started
 */
export function logTwitterDownloadStarted(params: {
  traceId: string;
  userNumber: string;
  tweetId: string;
  tweetAuthor: string;
  url: string;
}) {
  const logger = createTracedLogger(params);
  logger.info(
    {
      event: 'twitter_download_started',
      url: params.url,
      tweetAuthor: params.tweetAuthor,
    },
    'Starting Twitter video download'
  );
}

/**
 * Log Twitter download completed
 */
export function logTwitterDownloadCompleted(params: {
  traceId: string;
  userNumber: string;
  tweetId: string;
  fileSize: number;
  downloadTimeMs: number;
}) {
  const logger = createTracedLogger(params);
  logger.info(
    {
      event: 'twitter_download_completed',
      fileSize: params.fileSize,
      downloadTimeMs: params.downloadTimeMs,
      fileSizeMB: (params.fileSize / 1024 / 1024).toFixed(2),
    },
    `Twitter video downloaded successfully in ${params.downloadTimeMs}ms`
  );
}

/**
 * Log Twitter download failed
 */
export function logTwitterDownloadFailed(params: {
  traceId: string;
  userNumber: string;
  tweetId?: string;
  error: Error;
  errorType: string;
}) {
  const logger = createTracedLogger(params);
  logger.error(
    {
      event: 'twitter_download_failed',
      errorType: params.errorType,
      errorMessage: params.error.message,
      errorStack: params.error.stack,
    },
    `Twitter video download failed: ${params.error.message}`
  );
}

/**
 * Log Twitter conversion started
 */
export function logTwitterConversionStarted(params: {
  traceId: string;
  userNumber: string;
  tweetId: string;
  videoSize: number;
}) {
  const logger = createTracedLogger(params);
  logger.info(
    {
      event: 'twitter_conversion_started',
      videoSize: params.videoSize,
    },
    'Starting Twitter video to sticker conversion'
  );
}

/**
 * Log Twitter conversion completed
 */
export function logTwitterConversionCompleted(params: {
  traceId: string;
  userNumber: string;
  tweetId: string;
  conversionTimeMs: number;
  originalSize: number;
  stickerSize: number;
}) {
  const logger = createTracedLogger(params);
  const compressionRatio = ((1 - params.stickerSize / params.originalSize) * 100).toFixed(1);

  logger.info(
    {
      event: 'twitter_conversion_completed',
      conversionTimeMs: params.conversionTimeMs,
      originalSize: params.originalSize,
      stickerSize: params.stickerSize,
      compressionRatio: `${compressionRatio}%`,
    },
    `Conversion completed in ${params.conversionTimeMs}ms (${compressionRatio}% compression)`
  );
}

/**
 * Log Twitter limit reached
 */
export function logTwitterLimitReached(params: {
  traceId: string;
  userNumber: string;
  userName?: string;
  currentCount: number;
  limit: number;
}) {
  const logger = createTracedLogger(params);
  logger.warn(
    {
      event: 'twitter_limit_reached',
      currentCount: params.currentCount,
      limit: params.limit,
      userName: params.userName,
    },
    `User reached Twitter download limit (${params.currentCount}/${params.limit})`
  );
}

export default baseLogger;
