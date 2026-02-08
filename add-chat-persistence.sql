-- Create table for storing chat conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  title TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for storing chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content TEXT NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own conversations') THEN
    CREATE POLICY "Users can view their own conversations"
    ON public.conversations FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own conversations') THEN
    CREATE POLICY "Users can insert their own conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own conversations') THEN
    CREATE POLICY "Users can update their own conversations"
    ON public.conversations FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own conversations') THEN
    CREATE POLICY "Users can delete their own conversations"
    ON public.conversations FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Enable RLS for chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for chat_messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view messages in their conversations') THEN
    CREATE POLICY "Users can view messages in their conversations"
    ON public.chat_messages FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.conversations
      WHERE public.conversations.id = public.chat_messages.conversation_id
      AND public.conversations.user_id = auth.uid()
    ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert messages in their conversations') THEN
    CREATE POLICY "Users can insert messages in their conversations"
    ON public.chat_messages FOR INSERT
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.conversations
      WHERE public.conversations.id = public.chat_messages.conversation_id
      AND public.conversations.user_id = auth.uid()
    ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete messages in their conversations') THEN
    CREATE POLICY "Users can delete messages in their conversations"
    ON public.chat_messages FOR DELETE
    USING (EXISTS (
      SELECT 1 FROM public.conversations
      WHERE public.conversations.id = public.chat_messages.conversation_id
      AND public.conversations.user_id = auth.uid()
    ));
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);

-- Verify tables were created
SELECT 
  table_name, 
  (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'chat_messages')
ORDER BY table_name;
