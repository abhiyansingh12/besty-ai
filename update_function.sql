-- Update the match_documents function to filter by authenticated user
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_document_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  JOIN documents ON documents.id = document_chunks.document_id
  WHERE documents.user_id = auth.uid()
  AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  AND (filter_document_id IS NULL OR document_chunks.document_id = filter_document_id)
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
