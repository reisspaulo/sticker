-- =============================================================================
-- SPRINT 16: Sistema de Treinamento de Celebridades
-- Migration: Fase 1 - Infraestrutura
-- Data: 2026-01-12
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CRIAR TABELA celebrity_photos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS celebrity_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  celebrity_id UUID NOT NULL REFERENCES celebrities(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_photo_per_celebrity UNIQUE (celebrity_id, storage_path)
);

-- Index para busca por celebridade
CREATE INDEX IF NOT EXISTS idx_celebrity_photos_celebrity ON celebrity_photos(celebrity_id);

-- Comentários
COMMENT ON TABLE celebrity_photos IS 'Fotos de referência para treinamento de reconhecimento facial';
COMMENT ON COLUMN celebrity_photos.storage_path IS 'Caminho no bucket celebrity-training';
COMMENT ON COLUMN celebrity_photos.file_name IS 'Nome original do arquivo';

-- -----------------------------------------------------------------------------
-- 2. ADICIONAR CAMPOS EM celebrities
-- -----------------------------------------------------------------------------
-- Campo de status de treinamento
ALTER TABLE celebrities
ADD COLUMN IF NOT EXISTS training_status TEXT DEFAULT 'pending'
CHECK (training_status IN ('pending', 'training', 'trained', 'failed'));

-- Campo de última tentativa de treinamento
ALTER TABLE celebrities
ADD COLUMN IF NOT EXISTS last_trained_at TIMESTAMPTZ;

-- Campo de erro (se falhou)
ALTER TABLE celebrities
ADD COLUMN IF NOT EXISTS training_error TEXT;

-- Atualizar celebridades existentes com embeddings como 'trained'
UPDATE celebrities
SET training_status = 'trained',
    last_trained_at = now()
WHERE embeddings_count > 0
  AND training_status = 'pending';

-- -----------------------------------------------------------------------------
-- 3. RLS POLICIES para celebrity_photos
-- -----------------------------------------------------------------------------
ALTER TABLE celebrity_photos ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total
CREATE POLICY "Service role full access to celebrity_photos"
  ON celebrity_photos FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users podem ver (para o admin panel)
CREATE POLICY "Authenticated users can view celebrity_photos"
  ON celebrity_photos FOR SELECT TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 4. CRIAR BUCKET celebrity-training (via SQL - pode não funcionar, usar Dashboard)
-- -----------------------------------------------------------------------------
-- NOTA: Buckets geralmente são criados via Dashboard ou API, não via SQL
-- Este comando é apenas para referência

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'celebrity-training',
--   'celebrity-training',
--   false,
--   5242880,
--   ARRAY['image/jpeg', 'image/png', 'image/webp']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. VERIFICAÇÃO
-- -----------------------------------------------------------------------------
-- Verifica se tudo foi criado corretamente
DO $$
BEGIN
  -- Verifica tabela
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'celebrity_photos') THEN
    RAISE EXCEPTION 'Tabela celebrity_photos não foi criada';
  END IF;

  -- Verifica colunas em celebrities
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'celebrities' AND column_name = 'training_status') THEN
    RAISE EXCEPTION 'Coluna training_status não foi criada';
  END IF;

  RAISE NOTICE 'Migration executada com sucesso!';
END $$;
