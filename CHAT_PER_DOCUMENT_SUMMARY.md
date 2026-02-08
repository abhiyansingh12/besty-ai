# Chat-Per-Document Implementation Summary

## Overview
Implemented logic to separate chat history based on the selected document. Now, each document has its own dedicated conversation context.

## Logic Flow

### 1. Document Selection (`handleDocumentClick`)
When you click a document in the sidebar:
1.  **Check History**: The system queries `chat_messages` to find the most recent conversation that referenced this document (by `document_id`).
2.  **Existing Chat**: If found, it loads that specific conversation history.
3.  **New Context**: If not found (first time chatting about this doc), it clears the chat view and prepares to start a fresh conversation.

### 2. Sending a Message (`handleSendMessage`)
When you send a message:
1.  **Check Context**: If `currentConversationId` is null (meaning we are starting a fresh chat for a document), it triggers creation of a new conversation.
2.  **Smart Titling**: The new conversation is automatically titled `Chat about [Filename]` instead of "New Conversation".
3.  **Linking**: The message is saved with both `conversation_id` (the new chat) and `document_id` (the selected file).
    *   This establishes the link for future history lookups.

### 3. Creating/Loading Conversations (`createOrLoadConversation`)
Updated to accept an optional `title` argument:
*   **If Title Provided**: Forces creation of a NEW conversation with that title (used for document chats).
*   **No Title**: Attempts to load the most recent conversation (default behavior for general chat).

## Benefits
*   **Context Isolation**: Chatting about "Budget.xlsx" won't mix with "Report.pdf".
*   **Automatic Organization**: Conversations are named after the files.
*   **No Schema Changes**: Uses existing relationships in `chat_messages` table without needing complex database migrations.
