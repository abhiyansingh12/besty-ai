# Chat Persistence Setup Guide

## What Was Added

Your chat messages will now persist across page refreshes! Messages are saved to the database automatically.

## Database Changes

### New Tables Created:
1. **`conversations`** - Stores conversation sessions
   - `id`: Unique conversation identifier
   - `user_id`: Owner of the conversation
   - `title`: Conversation title (default: "New Conversation")
   - `created_at`, `updated_at`: Timestamps

2. **`chat_messages`** - Stores individual messages
   - `id`: Unique message identifier
   - `conversation_id`: Which conversation this belongs to
   - `role`: Either 'user' or 'ai'
   - `content`: The message text
   - `document_id`: Optional link to a document
   - `created_at`: When the message was sent

### Row Level Security (RLS)
All tables have full RLS enabled with policies for:
- ✅ SELECT (view your own data)
- ✅ INSERT (create new records)
- ✅ UPDATE (modify conversations)
- ✅ DELETE (remove conversations/messages)

## How to Apply

### Step 1: Run the SQL Script
1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy the contents of `add-chat-persistence.sql`
4. Paste and **Run** the SQL

### Step 2: Verify Tables
After running the SQL, verify the tables were created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'chat_messages');
```

You should see both tables listed.

### Step 3: Refresh Your App
Since you already have the updated code:
1. Refresh your browser (the dev server is already running)
2. Send a test message
3. Refresh the page - your messages should still be there!

## How It Works

### On Login:
1. App loads the most recent conversation
2. All messages from that conversation are displayed
3. If no conversation exists, a new one is created

### When Sending Messages:
1. User message is saved to database immediately
2. API call is made to get AI response
3. AI response is saved to database
4. Conversation's `updated_at` is updated

### On Refresh:
1. App loads the conversation again
2. All messages are fetched from database
3. Chat history is restored exactly as it was

## Features

✅ **Auto-save**: Every message is saved automatically
✅ **Persistent**: Messages survive page refreshes
✅ **Conversation tracking**: Each chat session is tracked
✅ **Document linking**: Messages are linked to documents if selected
✅ **Timestamps**: All messages have creation times
✅ **Privacy**: RLS ensures users only see their own messages

## Future Enhancements (Not Yet Implemented)

You could add:
- Multiple conversations (conversation switcher in sidebar)
- Conversation titles based on first message
- Delete conversation functionality
- Search through past conversations
- Export conversation history

## Troubleshooting

### Messages not saving?
- Check browser console for errors
- Verify SQL script ran successfully
- Check Supabase logs in the Dashboard

### Messages not loading?
- Clear browser cache
- Check that RLS policies are applied
- Verify you're logged in

### Database errors?
- Make sure you ran `add-missing-policies.sql` first
- Check that all tables have proper RLS policies
