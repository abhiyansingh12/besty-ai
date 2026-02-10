# Fix: Deterministic Excel Summary Parsing

## Overview

This fix addresses the issue where Betsy AI misinterprets the structure of "SUMMARY" sheets in Excel files (e.g., treating them as dataframes when they are formatted reports). We have implemented a deterministic parsing logic in the Python Pandas Service and integrated it into the application flow.

## Changes Made

### 1. Python Service (`python_service/app.py`)

- **Updated `load_dataframe`**:
  - Added logic to detect if an Excel file contains a "SUMMARY" sheet.
  - Implemented deterministic extraction based on the rules:
    - Treat column index 1 as "Region".
    - Treat the last column as "TTL SALES".
    - Extract valid rows (excluding headers/footers) into a structured dictionary.
  - Returns the extracted summary in the response.
  - Caches the summary in memory for fast retrieval.

- **Added `/get-summary` Endpoint**:
  - GET endpoint to retrieve the cached summary for a document ID.

### 2. Ingestion API (`app/api/ingest/route.ts`)

- **Updated Ingestion Flow**:
  - Detects if an uploaded file is Excel/CSV.
  - If so, it immediately sends the file to the Python Service (`/load-dataframe`).
  - This ensures the specialized parsing logic runs *before* the user even asks a question, pre-loading the summary into the cache.

### 3. Chat API (`app/api/chat/route.ts`)

- **Updated Chat Logic**:
  - When a user sends a message, existing Excel files in the project are checked.
  - The API calls the Python Service (`/get-summary`) to retrieve the pre-calculated, deterministic summary.
  - If a summary is found, it is injected into the **System Prompt** (Additional Instructions) as an "AUTHORITATIVE SOURCE".
  - This forces the LLM to use the exact figures we extracted, rather than guessing via Code Interpreter.

## Usage

1. Ensure the Python Service is running:
   ```bash
   cd python_service
   ./start.sh
   # or
   python3 app.py
   ```

2. Run the Next.js app:
   ```bash
   npm run dev
   ```

3. Upload an Excel file with a "SUMMARY" sheet.
   - The server logs will show: `📊 Pre-loading data to Pandas Service...` and `✅ Pandas Service Loaded...`

4. Ask a question: "What are the total sales for Atlanta?"
   - The LLM will now have the exact figure in its context provided by our deterministic parser.
