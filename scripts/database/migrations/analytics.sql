-- ========================================
-- ANALYTICS QUERIES AND VIEWS
-- Twitter Feature Analytics
-- ========================================

-- ========================================
-- 1. ANALYTICS VIEWS
-- ========================================

-- View: Twitter downloads per day
CREATE OR REPLACE VIEW twitter_downloads_daily AS
SELECT
  DATE(created_at) as download_date,
  COUNT(*) as total_downloads,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_downloads,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_downloads,
  COUNT(CASE WHEN converted_to_sticker = true THEN 1 END) as converted_to_stickers,
  ROUND(AVG(download_time_ms)) as avg_download_time_ms,
  ROUND(AVG(file_size) / 1024.0 / 1024.0, 2) as avg_file_size_mb
FROM twitter_downloads
GROUP BY DATE(created_at)
ORDER BY download_date DESC;

-- View: Top Twitter authors
CREATE OR REPLACE VIEW top_twitter_authors AS
SELECT
  tweet_author,
  COUNT(*) as download_count,
  COUNT(CASE WHEN converted_to_sticker = true THEN 1 END) as converted_count,
  ROUND(
    COUNT(CASE WHEN converted_to_sticker = true THEN 1 END)::numeric /
    COUNT(*)::numeric * 100,
    2
  ) as conversion_rate
FROM twitter_downloads
WHERE status = 'completed' AND tweet_author IS NOT NULL
GROUP BY tweet_author
ORDER BY download_count DESC
LIMIT 50;

-- View: User Twitter activity
CREATE OR REPLACE VIEW user_twitter_activity AS
SELECT
  u.name,
  u.whatsapp_number,
  u.twitter_download_count as daily_count,
  COUNT(td.id) as total_downloads,
  COUNT(CASE WHEN td.converted_to_sticker = true THEN 1 END) as total_conversions,
  MAX(td.created_at) as last_download,
  ROUND(
    COUNT(CASE WHEN td.converted_to_sticker = true THEN 1 END)::numeric /
    NULLIF(COUNT(td.id), 0)::numeric * 100,
    2
  ) as conversion_rate
FROM users u
LEFT JOIN twitter_downloads td ON u.whatsapp_number = td.user_number
WHERE td.status = 'completed' OR td.status IS NULL
GROUP BY u.id, u.name, u.whatsapp_number, u.twitter_download_count
ORDER BY total_downloads DESC;

-- View: Twitter errors by type
CREATE OR REPLACE VIEW twitter_errors_by_type AS
SELECT
  error_message,
  COUNT(*) as error_count,
  DATE(created_at) as error_date
FROM twitter_downloads
WHERE status = 'failed' AND error_message IS NOT NULL
GROUP BY error_message, DATE(created_at)
ORDER BY error_date DESC, error_count DESC;

-- ========================================
-- 2. USEFUL ANALYTICS QUERIES
-- ========================================

-- Query: Downloads by hour of day (to identify peak usage)
-- SELECT
--   EXTRACT(HOUR FROM created_at) as hour_of_day,
--   COUNT(*) as download_count
-- FROM twitter_downloads
-- WHERE status = 'completed'
-- GROUP BY EXTRACT(HOUR FROM created_at)
-- ORDER BY hour_of_day;

-- Query: Weekly download trends
-- SELECT
--   DATE_TRUNC('week', created_at) as week_start,
--   COUNT(*) as downloads,
--   COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
--   COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
--   ROUND(
--     COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric /
--     COUNT(*)::numeric * 100,
--     2
--   ) as success_rate
-- FROM twitter_downloads
-- GROUP BY DATE_TRUNC('week', created_at)
-- ORDER BY week_start DESC;

-- Query: Conversion funnel (downloads -> stickers)
-- SELECT
--   COUNT(*) as total_downloads,
--   COUNT(CASE WHEN converted_to_sticker = true THEN 1 END) as converted,
--   COUNT(CASE WHEN converted_to_sticker = false THEN 1 END) as not_converted,
--   ROUND(
--     COUNT(CASE WHEN converted_to_sticker = true THEN 1 END)::numeric /
--     COUNT(*)::numeric * 100,
--     2
--   ) as conversion_rate
-- FROM twitter_downloads
-- WHERE status = 'completed';

-- Query: User retention (users who downloaded multiple times)
-- SELECT
--   download_count_bucket,
--   COUNT(*) as user_count
-- FROM (
--   SELECT
--     user_number,
--     CASE
--       WHEN COUNT(*) = 1 THEN '1 download'
--       WHEN COUNT(*) BETWEEN 2 AND 5 THEN '2-5 downloads'
--       WHEN COUNT(*) BETWEEN 6 AND 10 THEN '6-10 downloads'
--       ELSE '10+ downloads'
--     END as download_count_bucket
--   FROM twitter_downloads
--   WHERE status = 'completed'
--   GROUP BY user_number
-- ) as user_downloads
-- GROUP BY download_count_bucket
-- ORDER BY
--   CASE download_count_bucket
--     WHEN '1 download' THEN 1
--     WHEN '2-5 downloads' THEN 2
--     WHEN '6-10 downloads' THEN 3
--     ELSE 4
--   END;

-- Query: Average download size by author
-- SELECT
--   tweet_author,
--   COUNT(*) as downloads,
--   ROUND(AVG(file_size) / 1024.0 / 1024.0, 2) as avg_size_mb,
--   ROUND(MIN(file_size) / 1024.0 / 1024.0, 2) as min_size_mb,
--   ROUND(MAX(file_size) / 1024.0 / 1024.0, 2) as max_size_mb
-- FROM twitter_downloads
-- WHERE status = 'completed'
--   AND tweet_author IS NOT NULL
--   AND file_size IS NOT NULL
-- GROUP BY tweet_author
-- HAVING COUNT(*) >= 5
-- ORDER BY downloads DESC
-- LIMIT 20;

-- Query: Performance metrics over time
-- SELECT
--   DATE(created_at) as date,
--   COUNT(*) as total_downloads,
--   ROUND(AVG(download_time_ms)) as avg_download_ms,
--   ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY download_time_ms)) as median_download_ms,
--   ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY download_time_ms)) as p95_download_ms
-- FROM twitter_downloads
-- WHERE status = 'completed' AND download_time_ms IS NOT NULL
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC
-- LIMIT 30;

-- ========================================
-- 3. ADMIN DASHBOARD QUERIES
-- ========================================

-- Query: Real-time stats (last 24 hours)
-- SELECT
--   COUNT(*) as total_downloads_24h,
--   COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_24h,
--   COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_24h,
--   COUNT(CASE WHEN converted_to_sticker = true THEN 1 END) as conversions_24h,
--   COUNT(DISTINCT user_number) as unique_users_24h,
--   ROUND(AVG(download_time_ms)) as avg_time_ms_24h
-- FROM twitter_downloads
-- WHERE created_at >= NOW() - INTERVAL '24 hours';

-- Query: System health metrics
-- SELECT
--   COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_downloads,
--   COUNT(CASE WHEN status = 'failed' AND created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as failures_last_hour,
--   COUNT(CASE WHEN download_time_ms > 30000 AND created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as slow_downloads_last_hour
-- FROM twitter_downloads;

-- Query: Top users today
-- SELECT
--   u.name,
--   u.whatsapp_number,
--   COUNT(td.id) as downloads_today,
--   u.twitter_download_count as daily_counter
-- FROM users u
-- JOIN twitter_downloads td ON u.whatsapp_number = td.user_number
-- WHERE td.created_at >= CURRENT_DATE
--   AND td.status = 'completed'
-- GROUP BY u.id, u.name, u.whatsapp_number, u.twitter_download_count
-- ORDER BY downloads_today DESC
-- LIMIT 10;

-- ========================================
-- 4. CLEANUP AND MAINTENANCE
-- ========================================

-- Function: Get old downloads for cleanup (older than 30 days)
CREATE OR REPLACE FUNCTION get_old_twitter_downloads_for_cleanup()
RETURNS TABLE (
  id UUID,
  user_number VARCHAR,
  tweet_id VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  file_size INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    td.id,
    td.user_number,
    td.tweet_id,
    td.created_at,
    td.file_size
  FROM twitter_downloads td
  WHERE td.created_at < NOW() - INTERVAL '30 days'
  ORDER BY td.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. PERFORMANCE INDEXES
-- ========================================

-- Ensure we have proper indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_twitter_downloads_created_at_status
  ON twitter_downloads(created_at, status);

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_user_created
  ON twitter_downloads(user_number, created_at);

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_author_status
  ON twitter_downloads(tweet_author, status);

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_converted
  ON twitter_downloads(converted_to_sticker)
  WHERE status = 'completed';

-- ========================================
-- END OF ANALYTICS QUERIES
-- ========================================
