-- Create a table for the original uploaded files
CREATE TABLE IF NOT EXISTS files_raw (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,          -- The public URL from Supabase Storage
  file_type TEXT,                  -- e.g., 'text/csv' or 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  user_id UUID REFERENCES auth.users(id),
  storage_path TEXT NOT NULL       -- The path within the bucket to help with deletions
);

-- Enable RLS
ALTER TABLE files_raw ENABLE ROW LEVEL SECURITY;

-- Policies for files_raw
CREATE POLICY "Users can insert their own raw files"
ON files_raw FOR INSERT
WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can view their own raw files"
ON files_raw FOR SELECT
USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete their own raw files"
ON files_raw FOR DELETE
USING ( auth.uid() = user_id );
