-- Fix the conversations table to automatically set user_id
ALTER TABLE public.conversations
ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Just in case, grant permissions if missing (though RLS handles access)
GRANT ALL ON public.conversations TO authenticated;
GRANT ALL ON public.chat_messages TO authenticated;
