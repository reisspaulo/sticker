import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabase } from '../config/supabase';
import logger from '../config/logger';
import { getTwitterStats, getDownloadTrends } from '../services/twitterStats';

export default async function statsRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    try {
      logger.info({ msg: 'Fetching stats' });

      // Get total users
      const { count: totalUsers, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (usersError) {
        throw usersError;
      }

      // Get total stickers (all time)
      const { count: totalStickers, error: stickersError } = await supabase
        .from('stickers')
        .select('*', { count: 'exact', head: true });

      if (stickersError) {
        throw stickersError;
      }

      // Get stickers today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: stickersToday, error: todayError } = await supabase
        .from('stickers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      if (todayError) {
        throw todayError;
      }

      // Get stickers this month
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const { count: stickersThisMonth, error: monthError } = await supabase
        .from('stickers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstDayOfMonth.toISOString());

      if (monthError) {
        throw monthError;
      }

      // Get pending stickers
      const { count: stickersPending, error: pendingError } = await supabase
        .from('stickers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente');

      if (pendingError) {
        throw pendingError;
      }

      // Get static vs animated stickers
      const { count: staticStickers, error: staticError } = await supabase
        .from('stickers')
        .select('*', { count: 'exact', head: true })
        .eq('tipo', 'estatico');

      if (staticError) {
        throw staticError;
      }

      const { count: animatedStickers, error: animatedError } = await supabase
        .from('stickers')
        .select('*', { count: 'exact', head: true })
        .eq('tipo', 'animado');

      if (animatedError) {
        throw animatedError;
      }

      // Calculate average processing time
      const { data: avgProcessingData, error: avgError } = await supabase
        .from('stickers')
        .select('processing_time_ms')
        .not('processing_time_ms', 'is', null);

      if (avgError) {
        throw avgError;
      }

      let avgProcessingTime = 0;
      if (avgProcessingData && avgProcessingData.length > 0) {
        const sum = avgProcessingData.reduce((acc, row) => acc + (row.processing_time_ms || 0), 0);
        avgProcessingTime = Math.round(sum / avgProcessingData.length);
      }

      // Get top users by sticker count
      const { data: topUsers, error: topUsersError } = await supabase
        .from('users')
        .select('name, whatsapp_number')
        .order('daily_count', { ascending: false })
        .limit(5);

      if (topUsersError) {
        throw topUsersError;
      }

      // Calculate conversion rate (users who sent at least 1 sticker)
      const { data: activeUsers, error: activeError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gt('daily_count', 0);

      if (activeError) {
        throw activeError;
      }

      const activeUserCount = (activeUsers as any) || 0;
      const conversionRate =
        totalUsers && totalUsers > 0 ? Math.round((Number(activeUserCount) / totalUsers) * 100) : 0;

      // ========================================
      // TWITTER STATISTICS
      // ========================================

      // Get total Twitter downloads from usage_logs
      const { count: totalTwitterDownloads, error: twitterTotalError } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'twitter_download_completed');

      if (twitterTotalError) {
        logger.warn({ error: twitterTotalError }, 'Failed to fetch total Twitter downloads');
      }

      // Get Twitter downloads today
      const { count: twitterDownloadsToday, error: twitterTodayError } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'twitter_download_completed')
        .gte('created_at', today.toISOString());

      if (twitterTodayError) {
        logger.warn({ error: twitterTodayError }, 'Failed to fetch Twitter downloads today');
      }

      // Get Twitter conversions (downloads converted to stickers)
      const { count: twitterConversions, error: twitterConversionError } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'twitter_conversion_completed');

      if (twitterConversionError) {
        logger.warn({ error: twitterConversionError }, 'Failed to fetch Twitter conversions');
      }

      // Calculate Twitter conversion rate (downloads -> stickers)
      const twitterConversionRate =
        totalTwitterDownloads && totalTwitterDownloads > 0
          ? Math.round(((twitterConversions || 0) / totalTwitterDownloads) * 100)
          : 0;

      // Get top Twitter authors (from download logs)
      const { data: twitterLogs, error: twitterLogsError } = await supabase
        .from('usage_logs')
        .select('details')
        .eq('action', 'twitter_download_completed')
        .limit(100);

      let topTwitterAuthors: { author: string; downloads: number }[] = [];
      if (!twitterLogsError && twitterLogs) {
        const authorCounts: Record<string, number> = {};
        twitterLogs.forEach((log) => {
          const author = log.details?.tweet_author;
          if (author) {
            authorCounts[author] = (authorCounts[author] || 0) + 1;
          }
        });

        topTwitterAuthors = Object.entries(authorCounts)
          .map(([author, downloads]) => ({ author, downloads }))
          .sort((a, b) => b.downloads - a.downloads)
          .slice(0, 5);
      }

      // Get failed downloads count
      const { count: twitterFailedDownloads, error: twitterFailedError } = await supabase
        .from('usage_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'twitter_download_failed');

      if (twitterFailedError) {
        logger.warn({ error: twitterFailedError }, 'Failed to fetch Twitter failed downloads');
      }

      // Calculate average Twitter download time
      const { data: twitterDownloadTimes, error: twitterTimesError } = await supabase
        .from('usage_logs')
        .select('details')
        .eq('action', 'twitter_download_completed')
        .limit(100);

      let avgTwitterDownloadTime = 0;
      if (!twitterTimesError && twitterDownloadTimes && twitterDownloadTimes.length > 0) {
        const times = twitterDownloadTimes
          .map((log) => log.details?.download_time_ms)
          .filter((time): time is number => typeof time === 'number');

        if (times.length > 0) {
          const sum = times.reduce((acc, time) => acc + time, 0);
          avgTwitterDownloadTime = Math.round(sum / times.length);
        }
      }

      // Get enhanced Twitter statistics
      let enhancedTwitterStats = null;
      let twitterTrends = null;
      try {
        enhancedTwitterStats = await getTwitterStats();
        twitterTrends = await getDownloadTrends(7); // Last 7 days
      } catch (error) {
        logger.warn({ error }, 'Failed to fetch enhanced Twitter stats');
      }

      const processingTime = Date.now() - startTime;

      const stats = {
        users: {
          total: totalUsers || 0,
          active: activeUserCount,
          conversionRate: `${conversionRate}%`,
        },
        stickers: {
          total: totalStickers || 0,
          today: stickersToday || 0,
          thisMonth: stickersThisMonth || 0,
          pending: stickersPending || 0,
          static: staticStickers || 0,
          animated: animatedStickers || 0,
        },
        twitter: {
          totalDownloads: totalTwitterDownloads || 0,
          downloadsToday: twitterDownloadsToday || 0,
          conversions: twitterConversions || 0,
          conversionRate: `${twitterConversionRate}%`,
          failedDownloads: twitterFailedDownloads || 0,
          successRate:
            totalTwitterDownloads && totalTwitterDownloads > 0
              ? `${Math.round((1 - (twitterFailedDownloads || 0) / totalTwitterDownloads) * 100)}%`
              : '0%',
          topAuthors: topTwitterAuthors,
          avgDownloadTimeMs: avgTwitterDownloadTime,
        },
        twitterEnhanced: enhancedTwitterStats,
        twitterTrends,
        performance: {
          avgProcessingTimeMs: avgProcessingTime,
          avgTwitterDownloadTimeMs: avgTwitterDownloadTime,
        },
        topUsers: topUsers || [],
        meta: {
          timestamp: new Date().toISOString(),
          queryTimeMs: processingTime,
        },
      };

      logger.info({
        msg: 'Stats fetched successfully',
        processingTime,
      });

      return reply.status(200).send(stats);
    } catch (error) {
      const processingTime = Date.now() - startTime;

      logger.error({
        msg: 'Error fetching stats',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime,
      });

      return reply.status(500).send({
        error: 'Failed to fetch statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
