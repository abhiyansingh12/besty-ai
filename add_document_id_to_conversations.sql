
-- Add document_id column to conversations table to support chat-per-document
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_document_id ON public.conversations(document_id);
