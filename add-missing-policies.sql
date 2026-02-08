-- Add missing UPDATE and DELETE policies for documents table
DO $$
BEGIN
  -- Allow users to update their own documents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own documents') THEN
    CREATE POLICY "Users can update their own documents" 
    ON public.documents 
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Allow users to delete their own documents
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own documents') THEN
    CREATE POLICY "Users can delete their own documents" 
    ON public.documents 
    FOR DELETE 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add missing DELETE policy for document_chunks table
-- (Note: chunks should be automatically deleted via CASCADE, but we need this for explicit deletes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own document chunks') THEN
    CREATE POLICY "Users can delete their own document chunks" 
    ON public.document_chunks 
    FOR DELETE 
    USING (EXISTS (
      SELECT 1 FROM public.documents
      WHERE public.documents.id = public.document_chunks.document_id
      AND public.documents.user_id = auth.uid()
    ));
  END IF;
END $$;

-- Verify policies were created
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('documents', 'document_chunks')
ORDER BY tablename, cmd;
