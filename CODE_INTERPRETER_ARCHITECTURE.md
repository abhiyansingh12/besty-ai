# Excel & CSV Handling Architecture with Code Interpreter

> **Status**: Implemented
> **Date**: 2026-02-10

## Overview

Betsy AI now uses OpenAI's **Code Interpreter** (via the Assistants API) to handle Excel (`.xlsx`, `.xls`) and CSV files. This replaces the previous method of extracting text summaries using a local Python script, which was prone to calculation errors and "alasql issues".

## New Flow

1.  **Ingest (`app/api/ingest/route.ts`)**:
    *   File is downloaded from Supabase Storage.
    *   File is uploaded to OpenAI Files API with `purpose: "assistants"`.
    *   File is attached to the OpenAI Thread (via a user message) with `tools: [{ "type": "code_interpreter" }]` enabled.
    *   (Optional) File is also pre-loaded into the local Python Service for UI previews (e.g., table view), but **no summary extraction happens here**.

2.  **Chat (`app/api/chat/route.ts`)**:
    *   The Assistant is instructed to **ALWAYS use Code Interpreter** for data analysis tasks involving Excel/CSV.
    *   The prompt explicitly forbids making assumptions about column names or using "pre-calculated" summaries.
    *   The model writes Python code (`import pandas as pd`, `pd.read_excel(...)`) to load and analyze the file directly within the OpenAI sandbox.

## Key Benefits

*   **Accuracy**: The model runs actual Python code on the raw data, eliminating parsing errors.
*   **Flexibility**: Can handle complex queries (filtering, aggregation, charts) without pre-defined rules.
*   **Reliability**: Avoids "hallucinated" headers or totals found in text-based summaries.

## How to Verify

1.  Upload an Excel file (e.g., `sales.xlsx`) to a project.
2.  Ask a question: "What are the total sales for the 'East' region?"
3.  Observe the Assistant's response. It should indicate it is "analyzing" (using Code Interpreter) rather than just stating a number from memory.
4.  You can verify the code executed by checking the run steps (if exposed in UI) or trusting the accurate result.

## Deprecated Components

*   `python_service`: No longer performs "deterministic summary extraction". It is now purely a dataframe loader for UI purposes.
*   `metadata.summary`: The `summary` field in `documents` table metadata is no longer populated or used.
