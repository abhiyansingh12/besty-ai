# Betsy AI Document Chat - Debugging Guide

## 🔧 Recent Fixes Applied

### Issue
The AI was always responding with "I don't know based on the provided document" even though documents were uploaded.

### Root Causes
1. **Missing User Filter**: The `match_documents` SQL function didn't filter by `auth.uid()`, causing RLS to block access
2. **Wrong Auth Context**: The chat API used service role key instead of user session, making `auth.uid()` undefined

### Solutions Applied
✅ Updated `supabase_setup.sql` to add `WHERE documents.user_id = auth.uid()`  
✅ Modified `app/api/chat/route.ts` to use authenticated user session  
✅ Added comprehensive debugging logs throughout the pipeline

---

## 📝 Step-by-Step Testing

### 1. Update Database Function

**Run this SQL in your Supabase SQL Editor:**

```sql
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_document_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  JOIN documents ON documents.id = document_chunks.document_id
  WHERE documents.user_id = auth.uid()
  AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  AND (filter_document_id IS NULL OR document_chunks.document_id = filter_document_id)
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 2. Verify Environment Variables

Make sure your `.env` file has:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_openai_key
```

### 3. Restart Development Server

```bash
npm run dev
```

### 4. Test Document Upload

**Watch console logs for:**

```
✅ Extracted XXX characters from document
📦 Generated XX chunks from document
   Processed 10/XX chunks...
✅ Successfully stored XX/XX chunks in database
```

**Expected output:**
- All chunks should be successfully stored
- If chunks fail, check your OpenAI API key and Supabase connection

### 5. Test Document Chat

**Upload a document and ask a question. Watch console for:**

```
✅ User authenticated: your@email.com
🔍 Query: your question here
📄 Document filter: All documents (or specific document ID)
✅ Generated query embedding
📊 Found X chunks for query: "your question"
🎯 Top match similarity: 0.XXX
📝 Chunk preview: ...
💬 Context length: XXX characters
✅ Generated AI response
```

---

## 🐛 Common Issues & Solutions

### ❌ No Chunks Found

**Symptoms:**
```
📊 Found 0 chunks for query
⚠️  No chunks found! This might indicate...
```

**Solutions:**
1. **Check if document was ingested**: Look for the ingestion logs when you uploaded
2. **Verify user ownership**: Make sure document belongs to authenticated user
3. **Check similarity threshold**: Try lowering from 0.1 to 0.0 in `app/api/chat/route.ts`
4. **Inspect database**: Run this SQL in Supabase:
   ```sql
   SELECT COUNT(*) FROM document_chunks;
   SELECT d.filename, COUNT(dc.id) as chunk_count 
   FROM documents d 
   LEFT JOIN document_chunks dc ON d.id = dc.document_id 
   GROUP BY d.filename;
   ```

### ❌ Unauthorized Error

**Symptoms:**
```
❌ No authenticated session found
```

**Solutions:**
1. Make sure you're logged in
2. Clear cookies and log in again
3. Check that `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct in `.env`

### ❌ OpenAI API Errors

**Symptoms:**
- Errors during embedding generation
- Rate limit errors

**Solutions:**
1. Verify `OPENAI_API_KEY` is valid
2. Check OpenAI billing and usage limits
3. Reduce chunk size if hitting rate limits

### ❌ PDF/CSV Not Parsing

**Symptoms:**
```
❌ No text extracted from document
```

**Solutions:**
1. **For PDFs**: Make sure `pdf-parse` is installed: `npm install pdf-parse`
2. **For Excel**: Make sure `xlsx` is installed: `npm install xlsx`
3. **For CSV**: Make sure `csv-parse` is installed: `npm install csv-parse`
4. Check file isn't corrupted

---

## 🔍 Manual Database Inspection

### Check Documents Table
```sql
SELECT id, filename, file_type, user_id, created_at 
FROM documents 
ORDER BY created_at DESC;
```

### Check Document Chunks
```sql
SELECT dc.id, d.filename, LENGTH(dc.content) as content_length, dc.created_at
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
ORDER BY dc.created_at DESC
LIMIT 20;
```

### Test Match Function Manually
```sql
-- Get a sample embedding from an existing chunk
SELECT embedding FROM document_chunks LIMIT 1;

-- Then test the match function with that embedding
SELECT * FROM match_documents(
  (SELECT embedding FROM document_chunks LIMIT 1)::vector(1536),
  0.1,
  5,
  NULL
);
```

### Check User's Documents
```sql
-- Replace with your user ID
SELECT d.filename, COUNT(dc.id) as chunks 
FROM documents d 
LEFT JOIN document_chunks dc ON d.id = dc.document_id 
WHERE d.user_id = 'your-user-id-here'
GROUP BY d.filename;
```

---

## ✅ Success Indicators

When everything is working, you should see:

1. **During Upload:**
   - Document appears in left sidebar
   - Console shows "✅ Successfully stored X/X chunks"

2. **During Chat:**
   - Console shows "📊 Found X chunks" (where X > 0)
   - AI responds with actual content from document
   - Similarity scores are reasonable (> 0.1 for related content)

3. **In Database:**
   - Documents table has your uploaded files
   - `document_chunks` has rows with embeddings
   - `user_id` matches authenticated user

---

## 📞 Need More Help?

If issues persist:

1. **Check all logs**: Browser console AND terminal running `npm run dev`
2. **Verify SQL function**: Make sure the update was applied in Supabase
3. **Test step by step**: Upload → Ingest → Chat
4. **Clear cache**: Sometimes Next.js caching can cause issues - restart dev server
5. **Check database**: Manually query tables to verify data exists
