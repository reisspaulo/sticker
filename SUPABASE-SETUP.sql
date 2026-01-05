-- ========================================
-- SUPABASE DATABASE SETUP
-- Sticker Bot - Sprints 4-7
-- ========================================

-- ========================================
-- 1. ENABLE UUID EXTENSION
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 2. CREATE TABLES
-- ========================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  daily_count INT DEFAULT 0,
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on whatsapp_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_number ON users(whatsapp_number);

-- Stickers table
CREATE TABLE IF NOT EXISTS stickers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_number VARCHAR(20) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('estatico', 'animado')),
  original_url TEXT NOT NULL,
  processed_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INT,
  processing_time_ms INT,
  status VARCHAR(10) DEFAULT 'enviado' CHECK (status IN ('enviado', 'pendente')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stickers_user_number ON stickers(user_number);
CREATE INDEX IF NOT EXISTS idx_stickers_status ON stickers(status);
CREATE INDEX IF NOT EXISTS idx_stickers_created_at ON stickers(created_at);

-- ========================================
-- 3. CREATE FUNCTIONS
-- ========================================

-- Function to increment daily count
CREATE OR REPLACE FUNCTION increment_daily_count(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE users
  SET daily_count = daily_count + 1,
      last_interaction = NOW()
  WHERE id = p_user_id
  RETURNING daily_count INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Function to reset all daily counters
CREATE OR REPLACE FUNCTION reset_all_daily_counters()
RETURNS INT AS $$
DECLARE
  reset_count INT;
BEGIN
  UPDATE users
  SET daily_count = 0,
      last_reset_at = NOW();

  GET DIAGNOSTICS reset_count = ROW_COUNT;

  RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. CREATE STORAGE BUCKETS
-- ========================================

-- Note: These commands should be run in Supabase Dashboard
-- Storage > Create Bucket

-- Bucket: stickers-estaticos
-- Public: true
-- File size limit: 500KB
-- Allowed MIME types: image/webp

-- Bucket: stickers-animados
-- Public: true
-- File size limit: 500KB
-- Allowed MIME types: image/webp

-- ========================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can do everything on users"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Allow anon to read users (for stats)
CREATE POLICY "Anon can read users"
ON users
FOR SELECT
TO anon
USING (true);

-- Enable RLS on stickers table
ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role can do everything on stickers"
ON stickers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Allow anon to read stickers (for stats)
CREATE POLICY "Anon can read stickers"
ON stickers
FOR SELECT
TO anon
USING (true);

-- ========================================
-- 6. STORAGE POLICIES
-- ========================================

-- Note: These should be configured in Supabase Dashboard
-- Storage > Buckets > Policies

-- Bucket: stickers-estaticos
-- Policy Name: Public read access
-- Policy: SELECT
-- Target roles: public
-- USING expression: true

-- Policy Name: Service role full access
-- Policy: ALL
-- Target roles: service_role
-- USING expression: true

-- Bucket: stickers-animados
-- Policy Name: Public read access
-- Policy: SELECT
-- Target roles: public
-- USING expression: true

-- Policy Name: Service role full access
-- Policy: ALL
-- Target roles: service_role
-- USING expression: true

-- ========================================
-- 7. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ========================================

-- Insert a test user
INSERT INTO users (whatsapp_number, name, daily_count)
VALUES ('5511999999999', 'Usuario Teste', 0)
ON CONFLICT (whatsapp_number) DO NOTHING;

-- ========================================
-- 8. CLEANUP FUNCTIONS (OPTIONAL)
-- ========================================

-- Function to delete old stickers (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_stickers()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM stickers
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 9. USEFUL QUERIES
-- ========================================

-- Get total users
-- SELECT COUNT(*) FROM users;

-- Get total stickers by type
-- SELECT tipo, COUNT(*) FROM stickers GROUP BY tipo;

-- Get pending stickers count
-- SELECT COUNT(*) FROM stickers WHERE status = 'pendente';

-- Get users with most stickers
-- SELECT
--   u.name,
--   u.whatsapp_number,
--   COUNT(s.id) as sticker_count
-- FROM users u
-- LEFT JOIN stickers s ON u.whatsapp_number = s.user_number
-- GROUP BY u.id, u.name, u.whatsapp_number
-- ORDER BY sticker_count DESC
-- LIMIT 10;

-- Get stickers created today
-- SELECT COUNT(*) FROM stickers
-- WHERE DATE(created_at) = CURRENT_DATE;

-- Get average processing time
-- SELECT
--   tipo,
--   AVG(processing_time_ms) as avg_time_ms,
--   MAX(processing_time_ms) as max_time_ms,
--   MIN(processing_time_ms) as min_time_ms
-- FROM stickers
-- WHERE processing_time_ms IS NOT NULL
-- GROUP BY tipo;

-- ========================================
-- END OF SETUP
-- ========================================
