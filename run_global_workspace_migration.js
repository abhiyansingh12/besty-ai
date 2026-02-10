#!/usr/bin/env node

/**
 * Global Workspace Migration
 * Provides SQL statements to enable cross-document synthesis
 */

console.log('🚀 Global Workspace Migration\n');
console.log('This migration enables cross-document synthesis and analysis.\n');
console.log('Please run the following SQL in your Supabase SQL Editor:\n');
console.log('='.repeat(80));
console.log('\n-- STEP 1: Update match_documents function for global workspace mode\n');

const matchDocumentsSQL = `
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
    1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    AND documents.user_id = auth.uid()
    AND (filter_document_id IS NULL OR document_chunks.document_id = filter_document_id)
    AND (filter_project_id IS NULL OR documents.project_id = filter_project_id)
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`;

console.log(matchDocumentsSQL);

console.log('\n-- STEP 2: Create performance indexes\n');

const indexSQL = `
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
`;

console.log(indexSQL);

console.log('\n-- STEP 3: Create project statistics view\n');

const viewSQL = `
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

GRANT SELECT ON project_stats TO authenticated;
`;

console.log(viewSQL);

console.log('='.repeat(80));
console.log('\n✅ Copy and paste the SQL above into your Supabase SQL Editor\n');
console.log('🎯 After running the SQL, your system will support:');
console.log('   ✓ Global project-wide semantic search');
console.log('   ✓ Cross-document synthesis and comparison');
console.log('   ✓ Conflict detection between documents');
console.log('   ✓ Source attribution in AI responses\n');
