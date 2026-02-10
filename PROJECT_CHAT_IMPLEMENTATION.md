# Project-Level Chat Implementation

## Overview
Refactored the chat system from **document-scoped** to **project-scoped**, enabling the AI to answer questions across all documents within a project and compare them.

## Key Changes

### 1. **Frontend Changes** (`components/betsy-dashboard.tsx`)

#### State Management
- **Before**: `conversations` was a Record keyed by document ID
- **After**: `messages` is a simple array for the active project's conversation

```typescript
// Old
const [conversations, setConversations] = useState<Record<string, Message[]>>({});

// New
const [messages, setMessages] = useState<Message[]>([]);
```

#### Conversation Management
- **Before**: Each document had its own conversation
- **After**: Each project has ONE conversation that persists across all documents

```typescript
// Conversations are now loaded per project
const createOrLoadConversation = async () => {
  if (!activeProject) return null;
  
  // Find or create conversation for this project
  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('project_id', activeProject.id)
    .limit(1);
  
  // ... load messages for this conversation
}
```

#### Document Selection
- **Before**: Clicking a document would switch to that document's chat
- **After**: Clicking a document only selects it for context; chat remains at project level

```typescript
const handleDocumentClick = async (doc: Doc) => {
  // Simply select the document - chat remains at project level
  setActiveDoc(doc);
};
```

#### API Integration
- The API call now sends `projectId` (required) and `documentId` (optional)
- If `documentId` is provided, it can focus the search on that specific document
- If not, the AI searches across ALL documents in the project

### 2. **Database Schema Changes**

#### Updated `chat_messages` Table
```sql
-- BEFORE
create table chat_messages (
  id uuid primary key,
  conversation_id uuid references conversations(id),
  role text,
  content text,
  document_id uuid references documents(id),  -- ❌ Removed
  created_at timestamp
);

-- AFTER
create table chat_messages (
  id uuid primary key,
  conversation_id uuid references conversations(id),
  role text,
  content text,
  -- No document_id - messages are project-scoped
  created_at timestamp
);
```

#### Conversations Table
- Already has `project_id` foreign key from `implement_project_isolation.sql`
- Each project can have one active conversation

### 3. **Backend API** (`app/api/chat/route.ts`)

The API already supports project-level search via the `match_documents` function:

```typescript
const { data: searchResults } = await supabase.rpc('match_documents', {
  query_embedding: embedding,
  match_threshold: 0.1,
  match_count: 5,
  filter_document_id: documentId || null,  // Optional: focus on one doc
  filter_project_id: projectId || null,     // Required: search within project
});
```

## User Experience

### Before (Document-Scoped Chat)
1. User selects Project A
2. User uploads Document 1 and Document 2
3. User clicks Document 1 → Chat shows only Document 1's conversation
4. User clicks Document 2 → Chat switches to Document 2's conversation
5. **Problem**: Cannot ask questions that span multiple documents

### After (Project-Scoped Chat)
1. User selects Project A
2. User uploads Document 1 and Document 2
3. Chat is available immediately for the entire project
4. User can ask: "Compare the sales data in Document 1 and Document 2"
5. User can ask: "What are the total sales across all documents?"
6. **Benefit**: AI can search and answer across ALL documents in the project

## Migration Steps

### For New Installations
1. Run `implement_project_isolation.sql` in Supabase SQL Editor
2. The schema will be created correctly from the start

### For Existing Installations
1. **First**, run `implement_project_isolation.sql` if you haven't already
2. **Then**, run `migrate_project_chat.sql` to remove `document_id` from existing `chat_messages`

```sql
-- Run this in Supabase SQL Editor
ALTER TABLE chat_messages DROP COLUMN IF EXISTS document_id;
NOTIFY pgrst, 'reload config';
```

## Benefits

✅ **Cross-Document Analysis**: Ask questions that span multiple documents
✅ **Document Comparison**: "Compare X in doc1 vs doc2"
✅ **Aggregate Queries**: "What's the total across all documents?"
✅ **Simpler UX**: One persistent chat per project
✅ **Better Context**: AI has access to all project documents simultaneously

## Technical Notes

- Messages are saved with `document_id: null` in the database
- The `activeDoc` state is still used to provide visual context (which doc is selected)
- The API can optionally filter by `documentId` if provided, but defaults to searching all project docs
- Conversations are automatically created when a user selects a project
- Switching projects loads that project's conversation history
