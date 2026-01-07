-- ========================================
-- CORRIGIR VIEW: twitter_downloads_daily
-- Baseado na estrutura real da tabela
-- ========================================

-- View 1: Downloads por dia (corrigida)
CREATE OR REPLACE VIEW twitter_downloads_daily AS
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

-- Verificar se a view foi criada
SELECT 'twitter_downloads_daily criada com sucesso!' as status;

-- Testar a view
SELECT * FROM twitter_downloads_daily LIMIT 5;
