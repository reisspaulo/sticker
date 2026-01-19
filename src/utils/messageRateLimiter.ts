import logger from '../config/logger';

/**
 * Priority levels for message sending
 */
export enum MessagePriority {
  HIGH = 'high', // Stickers - user is actively waiting
  NORMAL = 'normal', // Welcome messages, notifications, etc.
}

/**
 * Global Message Rate Limiter
 *
 * Ensures message sending rate never exceeds safe limits to prevent WhatsApp bans.
 *
 * Limits:
 * - 60 messages per minute (1 msg/second average)
 * - Queues messages when rate limit is reached
 * - HIGH priority messages (stickers) are processed before NORMAL priority
 * - Provides volume monitoring and alerts
 *
 * Usage:
 *   // High priority (stickers)
 *   await messageRateLimiter.send(async () => {
 *     await sendSticker(number, url);
 *   }, MessagePriority.HIGH);
 *
 *   // Normal priority (welcome messages)
 *   await messageRateLimiter.send(async () => {
 *     await sendText(number, message);
 *   });
 */
class MessageRateLimiter {
  private queue: Array<{
    fn: () => Promise<void>;
    resolve: () => void;
    reject: (error: Error) => void;
    enqueuedAt: number;
    priority: MessagePriority;
  }> = [];
  private processing = false;
  private messageCount = 0;
  private lastResetTime = Date.now();
  private readonly messagesPerMinute = 60;
  private readonly delayBetweenMessages = 1000; // 1 second between messages
  private lastAlertTime = 0;
  private readonly alertCooldown = 60000; // 1 minute between alerts

  /**
   * Send a message with rate limiting
   * @param sendFn - Async function that sends the message
   * @param priority - Message priority (HIGH for stickers, NORMAL for others)
   */
  async send(
    sendFn: () => Promise<void>,
    priority: MessagePriority = MessagePriority.NORMAL
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const item = {
        fn: sendFn,
        resolve,
        reject,
        enqueuedAt: Date.now(),
        priority,
      };

      // HIGH priority goes to the front of the queue (after other HIGH priority items)
      // NORMAL priority goes to the back of the queue
      if (priority === MessagePriority.HIGH) {
        // Find the last HIGH priority item (iterate backwards for efficiency)
        let lastHighIndex = -1;
        for (let i = this.queue.length - 1; i >= 0; i--) {
          if (this.queue[i].priority === MessagePriority.HIGH) {
            lastHighIndex = i;
            break;
          }
        }

        if (lastHighIndex === -1) {
          // No HIGH priority items, add to front
          this.queue.unshift(item);
        } else {
          // Add after the last HIGH priority item
          this.queue.splice(lastHighIndex + 1, 0, item);
        }

        logger.debug({
          msg: '[RATE LIMITER] HIGH priority message added',
          queueSize: this.queue.length,
          highPriorityCount: this.queue.filter((q) => q.priority === MessagePriority.HIGH).length,
        });
      } else {
        // NORMAL priority goes to the end
        this.queue.push(item);
      }

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the message queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Reset counter every minute
      const now = Date.now();
      if (now - this.lastResetTime >= 60000) {
        this.messageCount = 0;
        this.lastResetTime = now;
      }

      // Check if we've hit rate limit
      if (this.messageCount >= this.messagesPerMinute) {
        const timeUntilReset = 60000 - (now - this.lastResetTime);

        logger.warn({
          msg: '[RATE LIMITER] Message rate limit reached, pausing',
          queueSize: this.queue.length,
          timeUntilReset: `${Math.ceil(timeUntilReset / 1000)}s`,
          messagesPerMinute: this.messagesPerMinute,
        });

        // Alert if queue is building up
        if (this.queue.length > 50 && now - this.lastAlertTime > this.alertCooldown) {
          logger.error({
            msg: '🚨 [CRITICAL] Message queue building up - possible burst attack',
            queueSize: this.queue.length,
            messagesInLastMinute: this.messageCount,
            avgWaitTime: this.getAverageWaitTime(),
          });
          this.lastAlertTime = now;
        }

        // Wait until rate limit resets
        await new Promise((resolve) => setTimeout(resolve, timeUntilReset));
        this.messageCount = 0;
        this.lastResetTime = Date.now();
      }

      // Get next message from queue
      const item = this.queue.shift();
      if (!item) break;

      try {
        // Execute the send function WITH TIMEOUT PROTECTION
        // Timeout set to 90 seconds (3x the Evolution API timeout of 30s)
        // This prevents the entire queue from hanging if one message gets stuck
        const timeoutMs = 90000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Message send timeout after ${timeoutMs / 1000}s`));
          }, timeoutMs);
        });

        await Promise.race([item.fn(), timeoutPromise]);

        this.messageCount++;
        item.resolve();

        // Log queue status if there are many waiting
        if (this.queue.length > 10) {
          logger.info({
            msg: '[RATE LIMITER] Processing queued messages',
            queueSize: this.queue.length,
            messagesInLastMinute: this.messageCount,
            avgWaitTime: this.getAverageWaitTime(),
          });
        }
      } catch (error) {
        logger.error({
          msg: '[RATE LIMITER] Failed to send message',
          error: error instanceof Error ? error.message : 'Unknown error',
          queueSize: this.queue.length,
        });
        item.reject(error instanceof Error ? error : new Error('Unknown error'));
      }

      // Wait before processing next message (1 second delay)
      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delayBetweenMessages));
      }
    }

    this.processing = false;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get messages sent in current minute
   */
  getMessageCount(): number {
    return this.messageCount;
  }

  /**
   * Get average wait time for queued messages
   */
  private getAverageWaitTime(): string {
    if (this.queue.length === 0) return '0s';

    const now = Date.now();
    const totalWait = this.queue.reduce((sum, item) => sum + (now - item.enqueuedAt), 0);
    const avgWait = totalWait / this.queue.length;

    return `${Math.ceil(avgWait / 1000)}s`;
  }

  /**
   * Get current rate limiter stats for monitoring
   */
  getStats(): {
    queueSize: number;
    messagesInLastMinute: number;
    processing: boolean;
    avgWaitTime: string;
  } {
    return {
      queueSize: this.queue.length,
      messagesInLastMinute: this.messageCount,
      processing: this.processing,
      avgWaitTime: this.getAverageWaitTime(),
    };
  }
}

// Export singleton instance
export const messageRateLimiter = new MessageRateLimiter();
