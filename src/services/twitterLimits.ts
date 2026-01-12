/**
 * Twitter Download Limits Service
 * Manages daily download limits for Twitter videos
 * Separate from sticker limits
 */

import { supabase } from '../config/supabase';
import logger from '../config/logger';
import { checkAndResetIfNeeded } from './userService';
import { getUserLimits } from './subscriptionService';
import { rpc } from '../rpc';

/**
 * Check if user has reached Twitter daily download limit
 * @param userId User ID
 * @returns true if user has reached or exceeded limit
 */
export async function checkTwitterDailyLimit(userId: string): Promise<boolean> {
  try {
    logger.debug({ msg: 'Checking Twitter daily limit', userId });

    // Auto-reset if needed
    await checkAndResetIfNeeded(userId);

    const { data: user, error } = await supabase
      .from('users')
      .select('twitter_download_count')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    // Get user's subscription limits
    const userLimits = await getUserLimits(userId);
    const actualLimit = userLimits.daily_twitter_limit;

    const twitterCount = user.twitter_download_count || 0;
    const hasReachedLimit = twitterCount >= actualLimit;

    logger.info({
      msg: 'Twitter daily limit check',
      userId,
      twitterDownloadCount: twitterCount,
      limit: actualLimit,
      hasReachedLimit,
    });

    return hasReachedLimit;
  } catch (error) {
    logger.error({
      msg: 'Error checking Twitter daily limit',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Get user's current Twitter download count
 * @param userId User ID
 * @returns Current Twitter download count
 */
export async function getTwitterDownloadCount(userId: string): Promise<number> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('twitter_download_count')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    return user.twitter_download_count || 0;
  } catch (error) {
    logger.error({
      msg: 'Error getting Twitter download count',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Increment user's Twitter download count
 * @param userId User ID
 * @returns New Twitter download count
 */
export async function incrementTwitterDownloadCount(userId: string): Promise<number> {
  try {
    logger.debug({ msg: 'Incrementing Twitter download count', userId });

    // ✅ Type-safe RPC call
    const newCount = await rpc('increment_twitter_download_count', { p_user_id: userId });

    logger.info({
      msg: 'Twitter download count incremented',
      userId,
      newCount,
    });

    return newCount;
  } catch (error) {
    logger.error({
      msg: 'Error incrementing Twitter download count',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Get remaining Twitter downloads for user
 * @param userId User ID
 * @returns Number of remaining downloads
 */
export async function getRemainingTwitterDownloads(userId: string): Promise<number> {
  const currentCount = await getTwitterDownloadCount(userId);

  // Get user's subscription limits
  const userLimits = await getUserLimits(userId);
  const actualLimit = userLimits.daily_twitter_limit;

  const remaining = Math.max(0, actualLimit - currentCount);
  return remaining;
}
