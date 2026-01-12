/**
 * Twitter Statistics Service
 * Provides comprehensive statistics and analytics for Twitter download feature
 */

import { supabase } from '../config/supabase';
import logger from '../config/logger';

export interface TwitterStats {
  downloads: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    failed: number;
    pending: number;
  };
  conversions: {
    total: number;
    rate: number;
    today: number;
  };
  performance: {
    avgDownloadTimeMs: number;
    avgConversionTimeMs: number;
    avgFileSizeMB: number;
    successRate: number;
  };
  topContent: {
    authors: Array<{ author: string; downloads: number }>;
    tweets: Array<{ tweetId: string; author: string; downloads: number }>;
  };
  users: {
    totalUsers: number;
    activeToday: number;
    topUsers: Array<{ name: string; number: string; downloads: number }>;
  };
  limits: {
    usersNearLimit: number;
    usersAtLimit: number;
    avgUsageRate: number;
  };
  errors: {
    total: number;
    today: number;
    byType: Array<{ type: string; count: number }>;
  };
}

export interface UserTwitterStats {
  userNumber: string;
  downloadsToday: number;
  downloadsTotal: number;
  conversionsTotal: number;
  conversionRate: number;
  lastDownload?: Date;
  limitReached: boolean;
  limit: number;
}

/**
 * Get comprehensive Twitter statistics
 */
export async function getTwitterStats(): Promise<TwitterStats> {
  const startTime = Date.now();

  try {
    logger.info('Fetching comprehensive Twitter statistics');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Parallel queries for better performance
    const [
      totalDownloads,
      downloadsToday,
      downloadsThisWeek,
      downloadsThisMonth,
      failedDownloads,
      pendingDownloads,
      totalConversions,
      conversionsToday,
      downloadLogs,
      conversionLogs,
      errorLogs,
      activeUsers,
      topUserStats,
      usersNearLimit,
    ] = await Promise.all([
      // Total downloads
      supabase
        .from('twitter_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),

      // Downloads today
      supabase
        .from('twitter_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', today.toISOString()),

      // Downloads this week
      supabase
        .from('twitter_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', weekAgo.toISOString()),

      // Downloads this month
      supabase
        .from('twitter_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', monthAgo.toISOString()),

      // Failed downloads
      supabase
        .from('twitter_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed'),

      // Pending downloads
      supabase
        .from('twitter_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),

      // Total conversions
      supabase
        .from('twitter_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .eq('converted_to_sticker', true),

      // Conversions today
      supabase
        .from('twitter_downloads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .eq('converted_to_sticker', true)
        .gte('created_at', today.toISOString()),

      // Download performance data
      supabase
        .from('twitter_downloads')
        .select('created_at, downloaded_at, video_size_bytes')
        .eq('status', 'completed')
        .not('downloaded_at', 'is', null)
        .limit(1000),

      // Conversion performance data
      supabase
        .from('usage_logs')
        .select('details')
        .eq('action', 'twitter_conversion_completed')
        .limit(1000),

      // Error logs
      supabase
        .from('usage_logs')
        .select('details, created_at')
        .eq('action', 'twitter_download_failed')
        .limit(1000),

      // Active users today
      supabase
        .from('twitter_downloads')
        .select('user_number', { count: 'exact' })
        .eq('status', 'completed')
        .gte('created_at', today.toISOString()),

      // Top users
      supabase
        .from('users')
        .select('name, whatsapp_number, twitter_download_count')
        .order('twitter_download_count', { ascending: false })
        .limit(10),

      // Users near limit (3-4 downloads today)
      supabase
        .from('users')
        .select('twitter_download_count', { count: 'exact', head: true })
        .gte('twitter_download_count', 3)
        .lte('twitter_download_count', 4),
    ]);

    // Calculate performance metrics
    let avgDownloadTime = 0;
    let avgFileSize = 0;

    if (downloadLogs.data && downloadLogs.data.length > 0) {
      const validDownloads = downloadLogs.data.filter(
        (d) => d.created_at && d.downloaded_at && d.video_size_bytes
      );

      if (validDownloads.length > 0) {
        // Calculate download time from timestamps (in milliseconds)
        avgDownloadTime = Math.round(
          validDownloads.reduce((sum, d) => {
            const start = new Date(d.created_at).getTime();
            const end = new Date(d.downloaded_at).getTime();
            return sum + (end - start);
          }, 0) / validDownloads.length
        );

        // Calculate average file size in MB
        avgFileSize =
          validDownloads.reduce((sum, d) => sum + d.video_size_bytes, 0) /
          validDownloads.length /
          1024 /
          1024;
      }
    }

    // Calculate average conversion time
    let avgConversionTime = 0;
    if (conversionLogs.data && conversionLogs.data.length > 0) {
      const times = conversionLogs.data
        .map((log) => log.details?.conversion_time_ms)
        .filter((time): time is number => typeof time === 'number');

      if (times.length > 0) {
        avgConversionTime = Math.round(times.reduce((sum, time) => sum + time, 0) / times.length);
      }
    }

    // Calculate success rate
    const totalAttempts = (totalDownloads.count || 0) + (failedDownloads.count || 0);
    const successRate =
      totalAttempts > 0 ? ((totalDownloads.count || 0) / totalAttempts) * 100 : 100;

    // Calculate conversion rate
    const conversionRate =
      totalDownloads.count && totalDownloads.count > 0
        ? ((totalConversions.count || 0) / totalDownloads.count) * 100
        : 0;

    // Get top authors
    const topAuthors = await getTopAuthors(10);

    // Get top tweets
    const topTweets = await getTopTweets(10);

    // Get active users count
    const activeUsersSet = new Set((activeUsers.data || []).map((u: any) => u.user_number));
    const activeUsersCount = activeUsersSet.size;

    // Get total users who have used Twitter feature
    const { count: totalTwitterUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gt('twitter_download_count', 0);

    // Get users at limit (4 downloads)
    const { count: usersAtLimit } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('twitter_download_count', 4);

    // Calculate average usage rate
    const avgUsageRate =
      totalTwitterUsers && totalTwitterUsers > 0
        ? ((totalDownloads.count || 0) / totalTwitterUsers) * 100
        : 0;

    // Error analysis
    const errorsByType = analyzeErrors(errorLogs.data || []);
    const errorsToday = (errorLogs.data || []).filter(
      (log) => new Date(log.created_at) >= today
    ).length;

    const stats: TwitterStats = {
      downloads: {
        total: totalDownloads.count || 0,
        today: downloadsToday.count || 0,
        thisWeek: downloadsThisWeek.count || 0,
        thisMonth: downloadsThisMonth.count || 0,
        failed: failedDownloads.count || 0,
        pending: pendingDownloads.count || 0,
      },
      conversions: {
        total: totalConversions.count || 0,
        rate: Math.round(conversionRate * 100) / 100,
        today: conversionsToday.count || 0,
      },
      performance: {
        avgDownloadTimeMs: avgDownloadTime,
        avgConversionTimeMs: avgConversionTime,
        avgFileSizeMB: Math.round(avgFileSize * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
      },
      topContent: {
        authors: topAuthors,
        tweets: topTweets,
      },
      users: {
        totalUsers: totalTwitterUsers || 0,
        activeToday: activeUsersCount,
        topUsers: (topUserStats.data || []).map((u) => ({
          name: u.name,
          number: u.whatsapp_number,
          downloads: u.twitter_download_count,
        })),
      },
      limits: {
        usersNearLimit: usersNearLimit.count || 0,
        usersAtLimit: usersAtLimit || 0,
        avgUsageRate: Math.round(avgUsageRate * 100) / 100,
      },
      errors: {
        total: errorLogs.count || 0,
        today: errorsToday,
        byType: errorsByType,
      },
    };

    const queryTime = Date.now() - startTime;
    logger.info({ queryTime }, 'Twitter statistics fetched successfully');

    return stats;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch Twitter statistics');
    throw error;
  }
}

/**
 * Get top Twitter authors by download count
 */
async function getTopAuthors(limit: number = 10) {
  try {
    const { data, error } = await supabase
      .from('twitter_downloads')
      .select('author_username, author_name')
      .eq('status', 'completed')
      .not('author_username', 'is', null);

    if (error) throw error;

    const authorCounts: Record<string, number> = {};
    (data || []).forEach((row) => {
      const author = row.author_username || row.author_name || 'unknown';
      if (author) {
        authorCounts[author] = (authorCounts[author] || 0) + 1;
      }
    });

    return Object.entries(authorCounts)
      .map(([author, downloads]) => ({ author, downloads }))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch top authors');
    return [];
  }
}

/**
 * Get top tweets by download count
 */
async function getTopTweets(limit: number = 10) {
  try {
    const { data, error } = await supabase
      .from('twitter_downloads')
      .select('tweet_id, author_username, author_name')
      .eq('status', 'completed')
      .not('tweet_id', 'is', null);

    if (error) throw error;

    const tweetCounts: Record<string, { author: string; count: number }> = {};
    (data || []).forEach((row) => {
      if (row.tweet_id) {
        const author = row.author_username || row.author_name || 'unknown';
        if (!tweetCounts[row.tweet_id]) {
          tweetCounts[row.tweet_id] = { author, count: 0 };
        }
        tweetCounts[row.tweet_id].count += 1;
      }
    });

    return Object.entries(tweetCounts)
      .map(([tweetId, info]) => ({
        tweetId,
        author: info.author,
        downloads: info.count,
      }))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch top tweets');
    return [];
  }
}

/**
 * Analyze error logs by type
 */
function analyzeErrors(errorLogs: any[]): Array<{ type: string; count: number }> {
  const errorTypes: Record<string, number> = {};

  errorLogs.forEach((log) => {
    const errorType = log.details?.error_type || 'unknown';
    errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
  });

  return Object.entries(errorTypes)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get Twitter statistics for a specific user
 */
export async function getUserTwitterStats(
  userNumber: string,
  limit: number = 10
): Promise<UserTwitterStats> {
  try {
    logger.info({ userNumber }, 'Fetching user Twitter statistics');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('twitter_download_count')
      .eq('whatsapp_number', userNumber)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }

    // Get total downloads
    const { count: totalDownloads } = await supabase
      .from('twitter_downloads')
      .select('*', { count: 'exact', head: true })
      .eq('user_number', userNumber)
      .eq('status', 'completed');

    // Get downloads today
    const { count: downloadsToday } = await supabase
      .from('twitter_downloads')
      .select('*', { count: 'exact', head: true })
      .eq('user_number', userNumber)
      .eq('status', 'completed')
      .gte('created_at', today.toISOString());

    // Get conversions
    const { count: conversions } = await supabase
      .from('twitter_downloads')
      .select('*', { count: 'exact', head: true })
      .eq('user_number', userNumber)
      .eq('status', 'completed')
      .eq('converted_to_sticker', true);

    // Get last download
    const { data: lastDownloadData } = await supabase
      .from('twitter_downloads')
      .select('created_at')
      .eq('user_number', userNumber)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    const conversionRate =
      totalDownloads && totalDownloads > 0 ? ((conversions || 0) / totalDownloads) * 100 : 0;

    return {
      userNumber,
      downloadsToday: downloadsToday || 0,
      downloadsTotal: totalDownloads || 0,
      conversionsTotal: conversions || 0,
      conversionRate: Math.round(conversionRate * 100) / 100,
      lastDownload: lastDownloadData?.[0] ? new Date(lastDownloadData[0].created_at) : undefined,
      limitReached: (userData?.twitter_download_count || 0) >= limit,
      limit,
    };
  } catch (error) {
    logger.error({ error, userNumber }, 'Failed to fetch user Twitter statistics');
    throw error;
  }
}

/**
 * Get recent Twitter downloads with details
 */
export async function getRecentDownloads(limit: number = 50) {
  try {
    const { data, error } = await supabase
      .from('twitter_downloads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data;
  } catch (error) {
    logger.error({ error }, 'Failed to fetch recent downloads');
    return [];
  }
}

/**
 * Get Twitter download trends (daily counts for last N days)
 */
export async function getDownloadTrends(days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('twitter_downloads')
      .select('created_at')
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    // Group by date
    const dailyCounts: Record<string, number> = {};
    (data || []).forEach((download) => {
      const date = new Date(download.created_at).toISOString().split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    return Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch download trends');
    return [];
  }
}
