/**
 * Video Selection Context Manager
 * Manages user context for selecting videos from tweets with multiple videos
 */

import { redis } from '../config/redis';
import logger from '../config/logger';
import { TwitterVideoMetadata } from '../types/twitter';

const CONTEXT_TTL = 300; // 5 minutes
const CONTEXT_PREFIX = 'video_selection:';

export interface VideoSelectionContext {
  state: 'awaiting_video_selection';
  tweetId: string;
  username: string;
  metadata: TwitterVideoMetadata;
  userNumber: string;
  userName: string;
  expiresAt: number;
}

/**
 * Save video selection context to Redis
 */
export async function saveVideoSelectionContext(
  userNumber: string,
  context: Omit<VideoSelectionContext, 'expiresAt'>
): Promise<void> {
  try {
    const key = `${CONTEXT_PREFIX}${userNumber}`;
    const expiresAt = Date.now() + CONTEXT_TTL * 1000;

    const fullContext: VideoSelectionContext = {
      ...context,
      expiresAt,
    };

    await redis.setex(key, CONTEXT_TTL, JSON.stringify(fullContext));

    logger.info(
      {
        userNumber,
        tweetId: context.tweetId,
        videoCount: context.metadata.allVideos?.length,
      },
      'Video selection context saved'
    );
  } catch (error) {
    logger.error({ error, userNumber }, 'Failed to save video selection context');
    throw error;
  }
}

/**
 * Get video selection context from Redis
 */
export async function getVideoSelectionContext(
  userNumber: string
): Promise<VideoSelectionContext | null> {
  try {
    const key = `${CONTEXT_PREFIX}${userNumber}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    const context: VideoSelectionContext = JSON.parse(data);

    // Check if expired
    if (context.expiresAt < Date.now()) {
      await clearVideoSelectionContext(userNumber);
      return null;
    }

    return context;
  } catch (error) {
    logger.error({ error, userNumber }, 'Failed to get video selection context');
    return null;
  }
}

/**
 * Clear video selection context from Redis
 */
export async function clearVideoSelectionContext(userNumber: string): Promise<void> {
  try {
    const key = `${CONTEXT_PREFIX}${userNumber}`;
    await redis.del(key);

    logger.info({ userNumber }, 'Video selection context cleared');
  } catch (error) {
    logger.error({ error, userNumber }, 'Failed to clear video selection context');
  }
}

/**
 * Process video selection response from user
 * Accepts: 1, 2, 3, etc.
 */
export function processVideoSelectionResponse(
  response: string,
  videoCount: number
): number | 'invalid' | 'cancel' {
  const normalized = response.trim().toLowerCase();

  // Check for cancel
  const cancelWords = ['cancelar', 'cancel', 'não', 'nao', 'n'];
  if (cancelWords.includes(normalized)) {
    return 'cancel';
  }

  // Try to parse as number
  const num = parseInt(normalized, 10);

  // Validate number
  if (isNaN(num) || num < 1 || num > videoCount) {
    return 'invalid';
  }

  return num;
}

/**
 * Check if user has pending video selection
 */
export async function hasPendingVideoSelection(userNumber: string): Promise<boolean> {
  const context = await getVideoSelectionContext(userNumber);
  return context !== null;
}
