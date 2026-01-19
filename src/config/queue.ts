import { Queue, QueueOptions } from 'bullmq';
import type { ActivatePixJobData } from '../jobs/activatePendingPixSubscription';

// Queue connection configuration
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const queueOptions: QueueOptions = {
  connection: {
    host: redisUrl.includes('://') ? new URL(redisUrl).hostname : redisUrl.split(':')[0],
    port: redisUrl.includes('://')
      ? parseInt(new URL(redisUrl).port || '6379')
      : parseInt(redisUrl.split(':')[1] || '6379'),
    password: redisUrl.includes('://') ? new URL(redisUrl).password || undefined : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
  defaultJobOptions: {
    attempts: 2, // Reduzido de 3 para 2 para evitar muitos retries
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24 hours
      count: 1000, // keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days
    },
  },
};

// Process Sticker Queue (for image/GIF processing)
// CRITICAL: Increased attempts for better reliability
// Note: timeout is configured in worker.ts, not here
export const processStickerQueue = new Queue('process-sticker', {
  ...queueOptions,
  defaultJobOptions: {
    ...queueOptions.defaultJobOptions,
    attempts: 3, // Increased from 2 to 3 for better reliability
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 25s, 125s between retries
    },
  },
});

// Scheduled Jobs Queue (for daily reset and send pending)
export const scheduledJobsQueue = new Queue('scheduled-jobs', queueOptions);

// Download Twitter Video Queue (for downloading videos from Twitter/X)
export const downloadTwitterVideoQueue = new Queue('download-twitter-video', queueOptions);

// Activate PIX Subscription Queue (delayed activation after PIX payment)
// Uses higher retry count and longer backoff for reliability
export const activatePixSubscriptionQueue = new Queue<ActivatePixJobData>(
  'activate-pix-subscription',
  {
    ...queueOptions,
    defaultJobOptions: {
      ...queueOptions.defaultJobOptions,
      attempts: 3, // 3 attempts for PIX activation (more critical)
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 25s, 125s between retries
      },
    },
  }
);

// Convert Twitter Video to Sticker Queue (for converting downloaded Twitter videos to stickers)
export const convertTwitterStickerQueue = new Queue('convert-twitter-sticker', queueOptions);

// Cleanup Sticker Queue (for removing borders and backgrounds from stickers)
export const cleanupStickerQueue = new Queue('cleanup-sticker', queueOptions);

// Edit Buttons Queue (debounced sending of edit buttons after sticker creation)
export const editButtonsQueue = new Queue('edit-buttons', queueOptions);

// Welcome Messages Queue (ANTI-SPAM: queued with randomized delays to prevent burst)
export const welcomeMessagesQueue = new Queue('welcome-messages', {
  ...queueOptions,
  defaultJobOptions: {
    ...queueOptions.defaultJobOptions,
    attempts: 2, // Lower retry count for welcome messages
    backoff: {
      type: 'exponential',
      delay: 3000, // 3s, 9s between retries
    },
  },
});

export default {
  processStickerQueue,
  scheduledJobsQueue,
  downloadTwitterVideoQueue,
  activatePixSubscriptionQueue,
  convertTwitterStickerQueue,
  cleanupStickerQueue,
  editButtonsQueue,
  welcomeMessagesQueue,
};
