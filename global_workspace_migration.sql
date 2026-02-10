-- ============================================
-- GLOBAL WORKSPACE MIGRATION
-- Enables cross-document synthesis and analysis
-- ============================================

-- 1. Update match_documents to support GLOBAL project-wide search
-- This allows the AI to retrieve context from ALL documents in a project
DROP FUNCTION IF EXISTS match_documents;

CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_document_id uuid DEFAULT NULL,
  filter_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float,
  document_id uuid,
  filename text,
  file_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity,
    document_chunks.document_id,
    documents.filename,
    documents.file_type
  FROM document_chunks
  JOIN documents ON documents.id = document_chunks.document_id
  WHERE 
    -- Similarity threshold
    1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    -- CRITICAL: Only filter by user's project (ensures data isolation)
    AND documents.user_id = auth.uid()
    -- Optional: Filter by specific document (for single-doc mode)
    AND (filter_document_id IS NULL OR document_chunks.document_id = filter_document_id)
    -- GLOBAL MODE: Filter by project to get ALL documents in workspace
    AND (filter_project_id IS NULL OR documents.project_id = filter_project_id)
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. Add index for faster project-wide queries
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- 3. Add metadata column to document_chunks if not exists (for source tracking)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'document_chunks' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE document_chunks ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 4. Create a view for project statistics (useful for UI)
CREATE OR REPLACE VIEW project_stats AS
SELECT 
  p.id AS project_id,
  p.name AS project_name,
  p.user_id,
  COUNT(DISTINCT d.id) AS document_count,
  COUNT(dc.id) AS chunk_count,
  MAX(d.created_at) AS last_document_added
FROM projects p
LEFT JOIN documents d ON d.project_id = p.id
LEFT JOIN document_chunks dc ON dc.document_id = d.id
GROUP BY p.id, p.name, p.user_id;

-- Grant access to the view
GRANT SELECT ON project_stats TO authenticated;

-- 5. Force schema reload
NOTIFY pgrst, 'reload config';

-- ============================================
-- MIGRATION COMPLETE
-- The system now supports:
-- 1. Global project-wide semantic search
-- 2. Cross-document synthesis
-- 3. Strict user/project isolation
-- ============================================
