-- Add OpenAI Thread ID to projects (One thread per workspace)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS openai_thread_id TEXT;

-- Add OpenAI File ID to documents
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS openai_file_id TEXT;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_projects_thread_id ON public.projects(openai_thread_id);
