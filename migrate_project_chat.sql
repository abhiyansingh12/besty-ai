-- Migration: Convert chat from document-scoped to project-scoped
-- This removes the document_id column from chat_messages since conversations
-- are now at the project level, allowing AI to answer across all documents

-- 1. Drop the document_id column from chat_messages
ALTER TABLE chat_messages DROP COLUMN IF EXISTS document_id;

-- 2. Ensure all conversations have a project_id
-- (This should already be the case from implement_project_isolation.sql)
-- But we'll add it here for safety
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Optional: Clean up orphaned conversations without a project_id
-- (Uncomment if you want to remove old conversations that aren't linked to projects)
-- DELETE FROM conversations WHERE project_id IS NULL;

-- 4. Force schema cache reload
NOTIFY pgrst, 'reload config';
