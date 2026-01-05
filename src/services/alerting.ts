/**
 * Alerting Service
 * Monitors system health and triggers alerts
 */

import { supabase } from '../config/supabase';
import logger from '../config/logger';

export interface Alert {
  type: 'error' | 'warning' | 'info';
  category: 'downloads' | 'storage' | 'performance' | 'limits';
  message: string;
  details?: any;
  timestamp: Date;
}

const ALERT_THRESHOLDS = {
  DOWNLOAD_FAILURE_RATE: 0.3, // 30% failure rate
  DOWNLOAD_FAILURE_COUNT: 10, // 10 failures in short period
  RATE_LIMIT_429_COUNT: 5, // 5 rate limit errors
  STORAGE_USAGE: 80, // 80% storage used
  USERS_AT_LIMIT: 10, // 10 users at limit
  HIGH_ERROR_RATE: 0.2, // 20% error rate
};

/**
 * Check for download failures and trigger alerts
 */
export async function checkDownloadFailures(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get recent downloads and failures
    const { count: totalDownloads } = await supabase
      .from('twitter_downloads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());

    const { count: failedDownloads } = await supabase
      .from('twitter_downloads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneHourAgo.toISOString());

    // Check failure rate
    if (
      totalDownloads &&
      totalDownloads > 0 &&
      failedDownloads &&
      failedDownloads > ALERT_THRESHOLDS.DOWNLOAD_FAILURE_COUNT
    ) {
      const failureRate = failedDownloads / totalDownloads;

      if (failureRate > ALERT_THRESHOLDS.DOWNLOAD_FAILURE_RATE) {
        alerts.push({
          type: 'error',
          category: 'downloads',
          message: `High download failure rate: ${(failureRate * 100).toFixed(1)}%`,
          details: {
            totalDownloads,
            failedDownloads,
            failureRate: `${(failureRate * 100).toFixed(1)}%`,
            threshold: `${ALERT_THRESHOLDS.DOWNLOAD_FAILURE_RATE * 100}%`,
          },
          timestamp: now,
        });

        logger.error(
          {
            totalDownloads,
            failedDownloads,
            failureRate,
          },
          'ALERT: High download failure rate'
        );
      }
    }
  } catch (error) {
    logger.error({ error }, 'Error checking download failures');
  }

  return alerts;
}

/**
 * Check for Twitter API rate limits (429 errors)
 */
export async function checkRateLimits(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const { data: errorLogs } = await supabase
      .from('usage_logs')
      .select('details')
      .eq('action', 'twitter_download_failed')
      .gte('created_at', fifteenMinutesAgo.toISOString());

    if (!errorLogs) return alerts;

    // Count 429 errors
    const rateLimitErrors = errorLogs.filter(
      (log) =>
        log.details?.error_message?.includes('429') ||
        log.details?.error_message?.includes('rate limit') ||
        log.details?.error_message?.includes('Limite de requisições')
    );

    if (rateLimitErrors.length >= ALERT_THRESHOLDS.RATE_LIMIT_429_COUNT) {
      alerts.push({
        type: 'warning',
        category: 'downloads',
        message: `Multiple rate limit errors detected (${rateLimitErrors.length} in 15min)`,
        details: {
          count: rateLimitErrors.length,
          threshold: ALERT_THRESHOLDS.RATE_LIMIT_429_COUNT,
          period: '15 minutes',
        },
        timestamp: now,
      });

      logger.warn(
        {
          rateLimitErrors: rateLimitErrors.length,
        },
        'ALERT: Multiple rate limit errors from Twitter API'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Error checking rate limits');
  }

  return alerts;
}

/**
 * Check storage usage and alert if near limit
 */
export async function checkStorageUsage(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    // Get total file sizes from twitter_downloads
    const { data: downloads } = await supabase
      .from('twitter_downloads')
      .select('video_size_bytes')
      .not('video_size_bytes', 'is', null);

    if (!downloads) return alerts;

    const totalSize = downloads.reduce((sum, d) => sum + (d.video_size_bytes || 0), 0);
    const totalSizeMB = totalSize / 1024 / 1024;
    const totalSizeGB = totalSizeMB / 1024;

    // Supabase free tier: 1GB
    // Adjust based on your plan
    const storageLimitGB = 1;
    const usagePercentage = (totalSizeGB / storageLimitGB) * 100;

    if (usagePercentage >= ALERT_THRESHOLDS.STORAGE_USAGE) {
      alerts.push({
        type: usagePercentage >= 95 ? 'error' : 'warning',
        category: 'storage',
        message: `Storage usage is at ${usagePercentage.toFixed(1)}%`,
        details: {
          usedGB: totalSizeGB.toFixed(2),
          limitGB: storageLimitGB,
          percentage: `${usagePercentage.toFixed(1)}%`,
          threshold: `${ALERT_THRESHOLDS.STORAGE_USAGE}%`,
        },
        timestamp: new Date(),
      });

      logger.warn(
        {
          totalSizeGB: totalSizeGB.toFixed(2),
          storageLimitGB,
          usagePercentage: usagePercentage.toFixed(1),
        },
        'ALERT: Storage usage high'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Error checking storage usage');
  }

  return alerts;
}

/**
 * Check users approaching or at download limit
 */
export async function checkUserLimits(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const { count: usersAtLimit } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('twitter_download_count', 10);

    if (usersAtLimit && usersAtLimit >= ALERT_THRESHOLDS.USERS_AT_LIMIT) {
      alerts.push({
        type: 'info',
        category: 'limits',
        message: `${usersAtLimit} users have reached daily Twitter download limit`,
        details: {
          count: usersAtLimit,
          limit: 10,
          threshold: ALERT_THRESHOLDS.USERS_AT_LIMIT,
        },
        timestamp: new Date(),
      });

      logger.info(
        {
          usersAtLimit,
        },
        'ALERT: Many users at Twitter download limit'
      );
    }
  } catch (error) {
    logger.error({ error }, 'Error checking user limits');
  }

  return alerts;
}

/**
 * Check overall system performance
 */
export async function checkPerformance(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get download times (calculate from created_at and downloaded_at)
    const { data: downloads } = await supabase
      .from('twitter_downloads')
      .select('created_at, downloaded_at')
      .eq('status', 'completed')
      .gte('created_at', oneHourAgo.toISOString())
      .not('downloaded_at', 'is', null);

    if (downloads && downloads.length > 10) {
      const avgTime =
        downloads.reduce((sum, d) => {
          const start = new Date(d.created_at).getTime();
          const end = new Date(d.downloaded_at).getTime();
          return sum + (end - start);
        }, 0) / downloads.length;

      // Alert if average download time > 30 seconds
      if (avgTime > 30000) {
        alerts.push({
          type: 'warning',
          category: 'performance',
          message: `Slow download performance detected (avg: ${(avgTime / 1000).toFixed(1)}s)`,
          details: {
            avgTimeMs: Math.round(avgTime),
            avgTimeSec: (avgTime / 1000).toFixed(1),
            sampleSize: downloads.length,
          },
          timestamp: now,
        });

        logger.warn(
          {
            avgDownloadTime: avgTime,
            sampleSize: downloads.length,
          },
          'ALERT: Slow download performance'
        );
      }
    }
  } catch (error) {
    logger.error({ error }, 'Error checking performance');
  }

  return alerts;
}

/**
 * Run all alert checks and return combined results
 */
export async function runAllAlertChecks(): Promise<Alert[]> {
  const startTime = Date.now();

  logger.info('Running all alert checks');

  const [
    downloadFailureAlerts,
    rateLimitAlerts,
    storageAlerts,
    userLimitAlerts,
    performanceAlerts,
  ] = await Promise.all([
    checkDownloadFailures(),
    checkRateLimits(),
    checkStorageUsage(),
    checkUserLimits(),
    checkPerformance(),
  ]);

  const allAlerts = [
    ...downloadFailureAlerts,
    ...rateLimitAlerts,
    ...storageAlerts,
    ...userLimitAlerts,
    ...performanceAlerts,
  ];

  const duration = Date.now() - startTime;

  logger.info(
    {
      duration,
      alertCount: allAlerts.length,
      errors: allAlerts.filter((a) => a.type === 'error').length,
      warnings: allAlerts.filter((a) => a.type === 'warning').length,
    },
    'Alert checks completed'
  );

  return allAlerts;
}
