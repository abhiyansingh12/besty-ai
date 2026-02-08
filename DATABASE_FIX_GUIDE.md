# Database Policy Update Guide

## Problem
The delete and rename features weren't working because the database was missing UPDATE and DELETE policies for Row Level Security (RLS).

## Solution
Run the SQL script to add the missing policies.

## How to Apply the Fix

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Open the file: `add-missing-policies.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** button
7. Verify the policies were created (you should see a list of policies at the end)

### Option 2: Using Supabase CLI
```bash
# If you have supabase CLI installed
supabase db reset
# OR apply migrations manually
```

### Option 3: Using PostgreSQL Client
```bash
# Connect to your database and run:
psql -h your-db-host -U postgres -d postgres -f add-missing-policies.sql
```

## What This Fixes

### Before:
- ❌ Users couldn't delete documents (no DELETE policy)
- ❌ Users couldn't rename documents (no UPDATE policy)
- ❌ Documents appeared to delete on frontend but remained in database

### After:
- ✅ Users can permanently delete their own documents
- ✅ Users can rename their own documents
- ✅ Document chunks are automatically deleted with documents (CASCADE)
- ✅ Full RLS protection maintained

## Policies Added

1. **Users can update their own documents** - Allows renaming
2. **Users can delete their own documents** - Allows deletion
3. **Users can delete their own document chunks** - Ensures chunks can be cleaned up

## Code Changes Made

Also fixed in `components/betsy-dashboard.tsx`:
- Corrected table name from `chunks` to `document_chunks`
- Delete function now properly removes documents from storage
- Better error handling and user feedback

## Testing

After applying the SQL:
1. Upload a test document
2. Try renaming it - should work now
3. Try deleting it - should work now
4. Verify in Supabase Storage that the file is actually deleted
