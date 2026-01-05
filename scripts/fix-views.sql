-- ========================================
-- CORRIGIR VIEWS E FUNÇÕES EXISTENTES
-- ========================================

-- 1. Dropar e recriar view top_twitter_authors
DROP VIEW IF EXISTS top_twitter_authors;

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

-- 2. Dropar e recriar função de cleanup
DROP FUNCTION IF EXISTS get_old_twitter_downloads_for_cleanup();

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

-- 3. Verificar que tudo foi criado
SELECT 'Views criadas com sucesso!' as status;

SELECT
  table_name,
  'OK' as status
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE '%twitter%'
ORDER BY table_name;

-- 4. Testar a view corrigida
SELECT * FROM top_twitter_authors LIMIT 5;

-- 5. Testar a função corrigida
SELECT * FROM get_old_twitter_downloads_for_cleanup() LIMIT 5;
