#!/bin/bash

# Betsy AI - Database Schema Update Script
# This script adds the full_text column to your documents table for the direct OpenAI flow.

echo "🔧 Betsy AI Database Schema Update"
echo "===================================="
echo ""
echo "This will show you the SQL to add the 'full_text' column."
echo "You need to run this in your Supabase SQL Editor."
echo ""

cat << 'EOF'
-- Copy everything below this line --

-- Add full_text column to documents table for storing extracted text
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS full_text TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'documents' AND column_name = 'full_text';

EOF

echo ""
echo "===================================="
echo ""
echo "📋 Next Steps:"
echo "1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql"
2. Copy the SQL above (between the dashes)"
3. Paste into the SQL Editor"
4. Click 'Run' to execute"
5. Documents uploaded AFTER this change will automatically use the new direct search flow."
echo ""
