-- ========================================
-- ANALYTICS - VERSÃO SEGURA
-- Execute este SQL no Supabase SQL Editor
-- ========================================

-- PASSO 1: Verificar estrutura da tabela
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'twitter_downloads'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- PASSO 2: Adicionar colunas que faltam (se necessário)

-- Adicionar download_time_ms se não existir
ALTER TABLE twitter_downloads
ADD COLUMN IF NOT EXISTS download_time_ms INT;

-- Adicionar tweet_author se não existir
ALTER TABLE twitter_downloads
ADD COLUMN IF NOT EXISTS tweet_author VARCHAR(255);

-- PASSO 3: Criar views básicas (sem colunas opcionais)

-- View 1: Downloads por dia (básica)
CREATE OR REPLACE VIEW twitter_downloads_daily AS
SELECT
  DATE(created_at) as download_date,
  COUNT(*) as total_downloads,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_downloads,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_downloads,
  COUNT(CASE WHEN converted_to_sticker = true THEN 1 END) as converted_to_stickers,
  ROUND(AVG(COALESCE(download_time_ms, 0))) as avg_download_time_ms,
  ROUND(AVG(COALESCE(file_size, 0)) / 1024.0 / 1024.0, 2) as avg_file_size_mb
FROM twitter_downloads
GROUP BY DATE(created_at)
ORDER BY download_date DESC;

-- View 2: Top autores
CREATE OR REPLACE VIEW top_twitter_authors AS
SELECT
  COALESCE(tweet_author, 'unknown') as tweet_author,
  COUNT(*) as download_count,
  COUNT(CASE WHEN converted_to_sticker = true THEN 1 END) as converted_count,
  ROUND(
    COUNT(CASE WHEN converted_to_sticker = true THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100,
    2
  ) as conversion_rate
FROM twitter_downloads
WHERE status = 'completed'
GROUP BY tweet_author
ORDER BY download_count DESC
LIMIT 50;

-- View 3: Atividade de usuários
CREATE OR REPLACE VIEW user_twitter_activity AS
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

-- View 4: Erros por tipo
CREATE OR REPLACE VIEW twitter_errors_by_type AS
SELECT
  COALESCE(error_message, 'unknown') as error_message,
  COUNT(*) as error_count,
  DATE(created_at) as error_date
FROM twitter_downloads
WHERE status = 'failed'
GROUP BY error_message, DATE(created_at)
ORDER BY error_date DESC, error_count DESC;

-- PASSO 4: Criar índices de performance
CREATE INDEX IF NOT EXISTS idx_twitter_downloads_created_at_status
  ON twitter_downloads(created_at, status);

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_user_created
  ON twitter_downloads(user_number, created_at);

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_author_status
  ON twitter_downloads(tweet_author, status);

CREATE INDEX IF NOT EXISTS idx_twitter_downloads_converted
  ON twitter_downloads(converted_to_sticker)
  WHERE status = 'completed';

-- PASSO 5: Verificar views criadas
SELECT
  table_name,
  'OK' as status
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE '%twitter%'
ORDER BY table_name;
