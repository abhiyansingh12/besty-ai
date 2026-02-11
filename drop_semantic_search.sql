-- Drop the function and table related to semantic search
drop function if exists match_documents;
drop table if exists public.document_chunks;

-- Optionally disable the vector extension if no other table uses it
-- drop extension if exists vector;
