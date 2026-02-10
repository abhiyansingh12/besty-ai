#!/usr/bin/env node

/**
 * Apply Global Workspace Migration to Supabase
 * This script applies the migration using the Supabase Management API
 */

const https = require('https');
const fs = require('fs');

// Read environment variables from .env file
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

console.log('🚀 Applying Global Workspace Migration...\n');
console.log('📍 Supabase URL:', SUPABASE_URL);
console.log('');

// The SQL migration
const migrationSQL = `
-- Step 1: Drop old function
DROP FUNCTION IF EXISTS match_documents;

-- Step 2: Create new function with source attribution
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

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Step 4: Create project stats view
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

console.log('📝 Migration SQL to apply:');
console.log('='.repeat(80));
console.log(migrationSQL);
console.log('='.repeat(80));
console.log('');

console.log('⚠️  IMPORTANT: You need to run this SQL manually in Supabase SQL Editor');
console.log('');
console.log('📋 Steps:');
console.log('1. Go to: https://supabase.com/dashboard/project/' + SUPABASE_URL.split('//')[1].split('.')[0] + '/sql/new');
console.log('2. Copy the SQL above');
console.log('3. Paste into the SQL Editor');
console.log('4. Click "Run"');
console.log('');
console.log('✅ After running the SQL, refresh your browser and test again!');
console.log('');
