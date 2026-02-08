-- Add OpenAI Thread ID to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS openai_thread_id TEXT;

-- Add OpenAI File ID to documents
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS openai_file_id TEXT;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversations_openai_thread_id ON public.conversations(openai_thread_id);
