-- ========================================
-- TWITTER FEATURE - DATABASE MIGRATION
-- Sprint 11: Twitter Download Limits and Tracking
-- ========================================

-- ========================================
-- 1. ADD TWITTER_DOWNLOAD_COUNT COLUMN
-- ========================================

-- Add twitter_download_count column to users table
-- This tracks daily Twitter video downloads separately from sticker creation
ALTER TABLE users
ADD COLUMN IF NOT EXISTS twitter_download_count INT DEFAULT 0;

-- Add comment to document the column
COMMENT ON COLUMN users.twitter_download_count IS 'Daily count of Twitter video downloads (limit: 10/day, separate from sticker limit)';

-- ========================================
-- 2. CREATE TWITTER DOWNLOAD INCREMENT FUNCTION
-- ========================================

-- Function to increment Twitter download count
CREATE OR REPLACE FUNCTION increment_twitter_download_count(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE users
  SET twitter_download_count = twitter_download_count + 1,
      last_interaction = NOW()
  WHERE id = p_user_id
  RETURNING twitter_download_count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION increment_twitter_download_count(UUID) IS 'Increments user Twitter download count and returns new value';

-- ========================================
-- 3. UPDATE RESET COUNTERS FUNCTION
-- ========================================

-- Update the reset_all_daily_counters function to also reset Twitter counter
CREATE OR REPLACE FUNCTION reset_all_daily_counters()
RETURNS INT AS $$
DECLARE
  reset_count INT;
BEGIN
  UPDATE users
  SET daily_count = 0,
      twitter_download_count = 0,
      last_reset_at = NOW();

  GET DIAGNOSTICS reset_count = ROW_COUNT;

  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the updated function
COMMENT ON FUNCTION reset_all_daily_counters() IS 'Resets both sticker daily_count and twitter_download_count for all users (runs at midnight)';

-- ========================================
-- 4. CREATE TWITTER DOWNLOADS TABLE (OPTIONAL)
-- ========================================

-- Optional: Create a separate table to track individual Twitter downloads
-- This is useful for analytics and debugging
CREATE TABLE IF NOT EXISTS twitter_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_number VARCHAR(20) NOT NULL,
  tweet_id VARCHAR(50) NOT NULL,
  tweet_author VARCHAR(255),
  twitter_url TEXT NOT NULL,
  video_url TEXT,
  file_size INT,
  download_time_ms INT,
  converted_to_sticker BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'pending')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_twitter_downloads_user_number ON twitter_downloads(user_number);
CREATE INDEX IF NOT EXISTS idx_twitter_downloads_tweet_id ON twitter_downloads(tweet_id);
CREATE INDEX IF NOT EXISTS idx_twitter_downloads_created_at ON twitter_downloads(created_at);
CREATE INDEX IF NOT EXISTS idx_twitter_downloads_status ON twitter_downloads(status);

-- Add comments
COMMENT ON TABLE twitter_downloads IS 'Tracks individual Twitter video downloads for analytics and debugging';
COMMENT ON COLUMN twitter_downloads.tweet_id IS 'Twitter/X tweet ID (status ID)';
COMMENT ON COLUMN twitter_downloads.converted_to_sticker IS 'Whether the video was converted to a sticker';
COMMENT ON COLUMN twitter_downloads.download_time_ms IS 'Time taken to download the video in milliseconds';

-- ========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on twitter_downloads table
ALTER TABLE twitter_downloads ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can do everything on twitter_downloads"
ON twitter_downloads
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Allow anon to read (for stats)
CREATE POLICY "Anon can read twitter_downloads"
ON twitter_downloads
FOR SELECT
TO anon
USING (true);

-- ========================================
-- 6. HELPER FUNCTIONS
-- ========================================

-- Function to get Twitter downloads today for a user
CREATE OR REPLACE FUNCTION get_user_twitter_downloads_today(p_user_number VARCHAR)
RETURNS INT AS $$
DECLARE
  download_count INT;
BEGIN
  SELECT COUNT(*)
  INTO download_count
  FROM twitter_downloads
  WHERE user_number = p_user_number
    AND status = 'completed'
    AND DATE(created_at) = CURRENT_DATE;

  RETURN COALESCE(download_count, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_twitter_downloads_today(VARCHAR) IS 'Returns count of completed Twitter downloads today for a user';

-- Function to get Twitter conversion rate
CREATE OR REPLACE FUNCTION get_twitter_conversion_rate()
RETURNS NUMERIC AS $$
DECLARE
  total_downloads INT;
  total_conversions INT;
  conversion_rate NUMERIC;
BEGIN
  SELECT COUNT(*) INTO total_downloads
  FROM twitter_downloads
  WHERE status = 'completed';

  SELECT COUNT(*) INTO total_conversions
  FROM twitter_downloads
  WHERE status = 'completed'
    AND converted_to_sticker = true;

  IF total_downloads > 0 THEN
    conversion_rate := (total_conversions::NUMERIC / total_downloads::NUMERIC) * 100;
  ELSE
    conversion_rate := 0;
  END IF;

  RETURN ROUND(conversion_rate, 2);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_twitter_conversion_rate() IS 'Returns percentage of Twitter downloads converted to stickers';

-- ========================================
-- 7. CLEANUP FUNCTIONS
-- ========================================

-- Function to delete old Twitter downloads (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_twitter_downloads()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM twitter_downloads
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_twitter_downloads() IS 'Deletes Twitter download records older than 30 days';

-- ========================================
-- 8. USEFUL QUERIES FOR TESTING
-- ========================================

-- Get total Twitter downloads
-- SELECT COUNT(*) FROM twitter_downloads WHERE status = 'completed';

-- Get Twitter downloads today
-- SELECT COUNT(*) FROM twitter_downloads
-- WHERE status = 'completed' AND DATE(created_at) = CURRENT_DATE;

-- Get conversion rate
-- SELECT get_twitter_conversion_rate();

-- Get top Twitter authors downloaded
-- SELECT
--   tweet_author,
--   COUNT(*) as download_count
-- FROM twitter_downloads
-- WHERE status = 'completed'
-- GROUP BY tweet_author
-- ORDER BY download_count DESC
-- LIMIT 10;

-- Get users with most Twitter downloads
-- SELECT
--   u.name,
--   u.whatsapp_number,
--   u.twitter_download_count,
--   COUNT(td.id) as total_downloads
-- FROM users u
-- LEFT JOIN twitter_downloads td ON u.whatsapp_number = td.user_number
-- WHERE td.status = 'completed' OR td.status IS NULL
-- GROUP BY u.id, u.name, u.whatsapp_number, u.twitter_download_count
-- ORDER BY total_downloads DESC
-- LIMIT 10;

-- Get failed downloads
-- SELECT
--   user_number,
--   twitter_url,
--   error_message,
--   created_at
-- FROM twitter_downloads
-- WHERE status = 'failed'
-- ORDER BY created_at DESC
-- LIMIT 20;

-- ========================================
-- END OF MIGRATION
-- ========================================

-- To apply this migration:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Verify all tables and functions were created
-- 3. Test with sample data
-- 4. Deploy your application code

-- Verification queries:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'twitter_download_count';

-- SELECT routine_name
-- FROM information_schema.routines
-- WHERE routine_name LIKE '%twitter%';
