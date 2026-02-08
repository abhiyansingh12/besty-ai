#!/bin/bash

# Betsy AI - Database Function Update Script
# This script helps you update the match_documents function in Supabase

echo "🔧 Betsy AI Database Update Helper"
echo "===================================="
echo ""
echo "This will show you the SQL to update your match_documents function."
echo "You need to run this in your Supabase SQL Editor."
echo ""

cat << 'EOF'
-- Copy everything below this line --

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

-- Verify the function was updated
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'match_documents';

EOF

echo ""
echo "===================================="
echo ""
echo "📋 Next Steps:"
echo "1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql"
echo "2. Copy the SQL above (everything between the dashes)"
echo "3. Paste into the SQL Editor"
echo "4. Click 'Run' to execute"
echo "5. You should see a success message"
echo ""
echo "✅ Once complete, restart your dev server: npm run dev"
echo ""
