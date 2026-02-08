#!/bin/bash

# Betsy AI - OpenAI Assistants Update Script
# This script adds the openai_thread_id and openai_file_id columns.

echo "🔧 Betsy AI Database Schema Update (Assistants API)"
echo "=================================================="
echo ""
echo "This will show you the SQL to add the new columns."
echo "You need to run this in your Supabase SQL Editor."
echo ""

cat << 'EOF'
-- Copy everything below this line --

-- Add OpenAI Thread ID to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS openai_thread_id TEXT;

-- Add OpenAI File ID to documents
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS openai_file_id TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_openai_thread_id ON public.conversations(openai_thread_id);

-- Verify the columns were added
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE (table_name = 'conversations' AND column_name = 'openai_thread_id')
   OR (table_name = 'documents' AND column_name = 'openai_file_id');

EOF

echo ""
echo "=================================================="
echo ""
echo "📋 Next Steps:"
echo "1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql"
echo "2. Copy the SQL above (between the dashes)"
echo "3. Paste into the SQL Editor and Run"
echo ""
