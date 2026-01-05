import { supabase } from '../config/supabase';
import logger from '../config/logger';

export interface User {
  id: string;
  whatsapp_number: string;
  name: string;
  daily_count: number;
  twitter_download_count?: number;
  last_reset_at: string;
  created_at: string;
  last_interaction: string;
}

/**
 * Get user by WhatsApp number or create if doesn't exist
 * @param phoneNumber WhatsApp number (without @s.whatsapp.net)
 * @param name User's name
 * @returns User object
 */
export async function getUserOrCreate(phoneNumber: string, name: string): Promise<User> {
  try {
    const sanitizedNumber = phoneNumber.replace('@s.whatsapp.net', '');

    logger.info({
      msg: 'Getting or creating user',
      phoneNumber: sanitizedNumber,
      name,
    });

    // Use upsert to handle both create and update (minimal fields to avoid schema cache issues)
    const { data: user, error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          whatsapp_number: sanitizedNumber,
          name,
        },
        {
          onConflict: 'whatsapp_number',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (upsertError) {
      logger.error({
        msg: 'Failed to upsert user',
        error: upsertError,
        code: upsertError.code,
        message: upsertError.message,
        details: upsertError.details,
        hint: upsertError.hint,
        phoneNumber: sanitizedNumber,
      });
      throw upsertError;
    }

    if (!user) {
      logger.error({
        msg: 'Upsert succeeded but no user returned',
        phoneNumber: sanitizedNumber,
      });
      throw new Error('Failed to get/create user: no data returned');
    }

    logger.info({
      msg: 'User retrieved/created',
      userId: user.id,
      phoneNumber: sanitizedNumber,
      dailyCount: user.daily_count,
    });

    return user;
  } catch (error: any) {
    logger.error({
      msg: 'Error in getUserOrCreate',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: typeof error,
      errorKeys: error ? Object.keys(error) : [],
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      stack: error?.stack,
      fullError: JSON.stringify(error),
      phoneNumber,
    });
    throw error;
  }
}

/**
 * Check if user needs daily counter reset (called before limit checks)
 * @param userId User ID
 * @returns true if reset was performed
 */
export async function checkAndResetIfNeeded(userId: string): Promise<boolean> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('last_reset_at')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    // Check if last reset was before today (midnight)
    const lastReset = new Date(user.last_reset_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (lastReset < today) {
      // Need to reset counters
      const { error: updateError } = await supabase
        .from('users')
        .update({
          daily_count: 0,
          twitter_download_count: 0,
          last_reset_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      logger.info({
        msg: 'User counters auto-reset',
        userId,
        lastReset: user.last_reset_at,
      });

      return true;
    }

    return false;
  } catch (error) {
    logger.error({
      msg: 'Error checking/resetting user counters',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    // Don't throw - continue with normal flow
    return false;
  }
}

/**
 * Check if user has reached daily limit
 * @param userId User ID
 * @returns true if user has reached or exceeded limit
 */
export async function checkDailyLimit(userId: string): Promise<boolean> {
  try {
    logger.debug({ msg: 'Checking daily limit', userId });

    // Auto-reset if needed
    await checkAndResetIfNeeded(userId);

    const { data: user, error } = await supabase
      .from('users')
      .select('daily_count')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    // Get user's subscription limits
    const { getUserLimits } = await import('./subscriptionService');
    const userLimits = await getUserLimits(userId);
    const actualLimit = userLimits.daily_sticker_limit;

    const hasReachedLimit = user.daily_count >= actualLimit;

    logger.info({
      msg: 'Daily limit check',
      userId,
      dailyCount: user.daily_count,
      limit: actualLimit,
      hasReachedLimit,
    });

    return hasReachedLimit;
  } catch (error) {
    logger.error({
      msg: 'Error checking daily limit',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Get user's current daily count
 * @param userId User ID
 * @returns Current daily count
 */
export async function getDailyCount(userId: string): Promise<number> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('daily_count')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    return user.daily_count;
  } catch (error) {
    logger.error({
      msg: 'Error getting daily count',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Increment user's daily count
 * @param userId User ID
 * @returns New daily count
 */
export async function incrementDailyCount(userId: string): Promise<number> {
  try {
    logger.debug({ msg: 'Incrementing daily count', userId });

    const { data, error } = await supabase.rpc('increment_daily_count', {
      p_user_id: userId,
    });

    if (error) {
      throw error;
    }

    const newCount = data as number;

    logger.info({
      msg: 'Daily count incremented',
      userId,
      newCount,
    });

    return newCount;
  } catch (error) {
    logger.error({
      msg: 'Error incrementing daily count',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Reset daily counters for all users
 * This should be called at midnight every day
 * @returns Number of users reset
 */
export async function resetAllDailyCounters(): Promise<number> {
  try {
    logger.info({ msg: 'Resetting all daily counters' });

    const { data, error } = await supabase.rpc('reset_all_daily_counters');

    if (error) {
      throw error;
    }

    const resetCount = data as number;

    logger.info({
      msg: 'All daily counters reset',
      usersReset: resetCount,
    });

    return resetCount;
  } catch (error) {
    logger.error({
      msg: 'Error resetting daily counters',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get user by ID
 * @param userId User ID
 * @returns User object
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return user;
  } catch (error) {
    logger.error({
      msg: 'Error getting user by ID',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    throw error;
  }
}

/**
 * Get user by WhatsApp number
 * @param phoneNumber WhatsApp number
 * @returns User object or null
 */
export async function getUserByNumber(phoneNumber: string): Promise<User | null> {
  try {
    const sanitizedNumber = phoneNumber.replace('@s.whatsapp.net', '');

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('whatsapp_number', sanitizedNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return user;
  } catch (error) {
    logger.error({
      msg: 'Error getting user by number',
      error: error instanceof Error ? error.message : 'Unknown error',
      phoneNumber,
    });
    throw error;
  }
}

/**
 * Get count of pending stickers for a user
 * @param userNumber WhatsApp number
 * @returns Count of pending stickers
 */
export async function getPendingStickerCount(userNumber: string): Promise<number> {
  try {
    const sanitizedNumber = userNumber.replace('@s.whatsapp.net', '');

    const { count, error } = await supabase
      .from('stickers')
      .select('*', { count: 'exact', head: true })
      .eq('user_number', sanitizedNumber)
      .eq('status', 'pendente');

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    logger.error({
      msg: 'Error getting pending sticker count',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
    });
    throw error;
  }
}

// ========================================
// TWITTER-SPECIFIC FUNCTIONS
// ========================================

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

    const { data, error } = await supabase.rpc('increment_twitter_download_count', {
      p_user_id: userId,
    });

    if (error) {
      throw error;
    }

    const newCount = data as number;

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
