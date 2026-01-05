import { Queue, QueueOptions } from 'bullmq';
import { redis } from './redis';
import type { ActivatePixJobData } from '../jobs/activatePendingPixSubscription';

// Queue connection configuration
const connection = redis;

const queueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
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
export const processStickerQueue = new Queue('process-sticker', queueOptions);

// Scheduled Jobs Queue (for daily reset and send pending)
export const scheduledJobsQueue = new Queue('scheduled-jobs', queueOptions);

// Download Twitter Video Queue (for downloading videos from Twitter/X)
export const downloadTwitterVideoQueue = new Queue('download-twitter-video', queueOptions);

// Activate PIX Subscription Queue (delayed activation after PIX payment)
export const activatePixSubscriptionQueue = new Queue<ActivatePixJobData>(
  'activate-pix-subscription',
  queueOptions
);

export default {
  processStickerQueue,
  scheduledJobsQueue,
  downloadTwitterVideoQueue,
  activatePixSubscriptionQueue,
};
