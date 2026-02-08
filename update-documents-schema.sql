-- Add storage_path to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Attempt to populate storage_path from file_url for existing rows
-- Assuming file_url format ends with the filename which is the storage path
UPDATE public.documents
SET storage_path = REGEXP_REPLACE(file_url, '.*/documents/', '')
WHERE storage_path IS NULL AND file_url IS NOT NULL;
