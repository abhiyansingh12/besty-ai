# Strict Chat Separation Implementation

I have updated the system to strictly separate chat histories for each document.

## The Fix
Previously, the system would find *any* conversation that referenced a document, which often led to loading a shared "global" chat history containing mixed topics.

Now, the system enforces strict separation by using **dedicated conversation titles**.

### How It Works
1.  **Unique Chat Contexts**:
    *   When you click "Budget.xlsx", the system looks specifically for a conversation titled **"Chat about Budget.xlsx"**.
    *   It **ignores** any old or shared conversations (like "New Conversation").
    *   If a dedicated chat doesn't exist, it starts a fresh one.

2.  **Renaming Support**:
    *   If you rename a document (e.g., "Budget.xlsx" -> "2024-Budget.xlsx"), the system automatically updates the conversation title to **"Chat about 2024-Budget.xlsx"**.
    *   This ensures you never lose your history when organizing files.

### Result
*   Clicking **Document A** opens ONLY Document A's chat.
*   Clicking **Document B** opens ONLY Document B's chat.
*   The generic "mixing" issue is resolved.

### Testing
1.  Click 'Upload Document' and add two files (e.g., `A.pdf` and `B.pdf`).
2.  Click `A.pdf` -> Chat is empty (or loads A's specific history). Type "This is A".
3.  Click `B.pdf` -> Chat updates to empty (or B's history). Type "This is B".
4.  Switch back to `A.pdf` -> You should see "This is A" and **NOT** "This is B".
