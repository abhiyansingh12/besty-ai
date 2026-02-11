# Betsy AI

Betsy AI is an advanced "ChatGPT for your Knowledge Base" application.

## Key Features

-   **Project-Based Isolation**: Secure workspaces for different projects.
-   **Excel/CSV Analysis**: Uses **OpenAI Code Interpreter** to execute Python code on your data for 100% accuracy (no hallucinations).
-   **Document Chat**: Chat with your files naturally.

## Architecture

-   **Frontend**: Next.js 14 (App Router)
-   **Backend**: Next.js API Routes + Supabase
-   **AI**: OpenAI Assistants API (Code Interpreter)
-   **Database**: Supabase (PostgreSQL)
-   **Local Service**: A lightweight Python service is used for *previewing* data files in the UI, but all analysis happens securely in OpenAI's sandbox.

## Quick Start

1.  **Start the Python Service** (for UI previews):
    ```bash
    cd python_service
    ./start.sh
    ```

2.  **Start the Web App**:
    ```bash
    # Open a new terminal
    npm run dev
    ```

3.  Open [http://localhost:3000](http://localhost:3000) and upload a file!

## Documentation

-   [Code Interpreter Architecture](./CODE_INTERPRETER_ARCHITECTURE.md)
