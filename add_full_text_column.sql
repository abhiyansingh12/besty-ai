-- Add full_text column to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS full_text TEXT;

-- Update RLS policies to allow reading/writing this column (implicit in table policies usually, but good to check)
-- Existing policies cover "all columns" usually if not specified.
