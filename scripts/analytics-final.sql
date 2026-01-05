-- ========================================
-- ANALYTICS VIEWS - VERSÃO FINAL CORRIGIDA
-- Baseado na estrutura real da tabela twitter_downloads
-- ========================================

-- ========================================
-- 0. LIMPAR VIEWS E FUNÇÕES ANTIGAS
-- ========================================

-- Dropar views que podem ter estrutura diferente
DROP VIEW IF EXISTS top_twitter_authors CASCADE;
DROP VIEW IF EXISTS twitter_downloads_daily CASCADE;
DROP VIEW IF EXISTS user_twitter_activity CASCADE;
DROP VIEW IF EXISTS twitter_errors_by_type CASCADE;

-- Dropar função que pode ter assinatura diferente
DROP FUNCTION IF EXISTS get_old_twitter_downloads_for_cleanup();

-- ========================================
-- 1. VIEW: Downloads por dia
-- ========================================
CREATE VIEW twitter_downloads_daily AS
SELECT
  DATE(created_at) as download_date,
  COUNT(*) as total_downloads,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_downloads,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_downloads,
  COUNT(CASE WHEN converted_to_sticker = true THEN 1 END) as converted_to_stickers,
  -- Usar video_size_bytes em vez de file_size
  ROUND(AVG(COALESCE(video_size_bytes, 0)) / 1024.0 / 1024.0, 2) as avg_file_size_mb,
  -- Calcular tempo baseado em downloaded_at e created_at
  ROUND(AVG(
    CASE
      WHEN downloaded_at IS NOT NULL AND created_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (downloaded_at - created_at)) * 1000
      ELSE NULL
    END
  )) as avg_download_time_ms
FROM twitter_downloads
GROUP BY DATE(created_at)
ORDER BY download_date DESC;

-- ========================================
-- 2. VIEW: Top autores
-- ========================================
CREATE VIEW top_twitter_authors AS
SELECT
  COALESCE(author_username, author_name, 'unknown') as author,
  COUNT(*) as download_count,
  COUNT(CASE WHEN converted_to_sticker = true THEN 1 END) as converted_count,
  ROUND(
    COUNT(CASE WHEN converted_to_sticker = true THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100,
    2
  ) as conversion_rate
FROM twitter_downloads
WHERE status = 'completed'
GROUP BY COALESCE(author_username, author_name, 'unknown')
ORDER BY download_count DESC
LIMIT 50;

-- ========================================
-- 3. VIEW: Atividade de usuários
-- ========================================
CREATE VIEW user_twitter_activity AS
SELECT
  u.name,
  u.whatsapp_number,
  COALESCE(u.twitter_download_count, 0) as daily_count,
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
WHERE td.status = 'completed' OR td.id IS NULL
GROUP BY u.id, u.name, u.whatsapp_number, u.twitter_download_count
ORDER BY total_downloads DESC;

-- ========================================
-- 4. VIEW: Erros por tipo
-- ========================================
CREATE VIEW twitter_errors_by_type AS
SELECT
  COALESCE(error_message, 'unknown') as error_message,
  COUNT(*) as error_count,
  DATE(created_at) as error_date
FROM twitter_downloads
WHERE status = 'failed'
GROUP BY error_message, DATE(created_at)
ORDER BY error_date DESC, error_count DESC;

-- ========================================
-- 5. PERFORMANCE INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_created_at_status
  ON twitter_downloads(created_at, status);

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_user_created
  ON twitter_downloads(user_number, created_at);

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_author_status
  ON twitter_downloads(author_username, status);

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_converted
  ON twitter_downloads(converted_to_sticker)
  WHERE status = 'completed';

-- ========================================
-- 6. CLEANUP FUNCTION
-- ========================================

-- Function: Get old downloads for cleanup (older than 30 days)
CREATE FUNCTION get_old_twitter_downloads_for_cleanup()
RETURNS TABLE (
  id UUID,
  user_number TEXT,
  tweet_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  video_size_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    td.id,
    td.user_number,
    td.tweet_id,
    td.created_at,
    td.video_size_bytes
  FROM twitter_downloads td
  WHERE td.created_at < NOW() - INTERVAL '30 days'
  ORDER BY td.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. VERIFICAR VIEWS CRIADAS
-- ========================================

SELECT
  table_name,
  'OK' as status
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE '%twitter%'
ORDER BY table_name;

-- ========================================
-- 8. TESTAR VIEWS
-- ========================================

-- Testar twitter_downloads_daily
SELECT * FROM twitter_downloads_daily LIMIT 5;

-- Testar top_twitter_authors
SELECT * FROM top_twitter_authors LIMIT 10;

-- Testar user_twitter_activity
SELECT * FROM user_twitter_activity LIMIT 10;

-- Testar twitter_errors_by_type
SELECT * FROM twitter_errors_by_type LIMIT 10;

-- ========================================
-- FIM
-- ========================================
