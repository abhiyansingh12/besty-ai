# Fixes for Deterministic Excel/CSV Analysis

## Problem
The AI was giving different answers each time for the same query (e.g., "how many rows does Tennessee have?"):
- Run 1: 91 rows, $178,647.41
- Run 2: 97 rows, different total
- Inconsistent with GPT and Gemini results

## Root Cause
The LLM (GPT-4o) was generating slightly different Pandas code each time, even with temperature=0:
- Different filtering logic (exact match vs. contains)
- Different case handling (case-sensitive vs. case-insensitive)
- Non-deterministic code generation

## Solution Implemented

### 1. **Stricter Code Generation Prompt** (Lines 176-215)
- **Before**: Vague instructions like "filter text using df[df['Column'] == 'value']"
- **After**: EXPLICIT examples with exact syntax:
  ```python
  # For Tennessee filtering:
  result = df[df['State'].str.contains('Tennessee', case=False, na=False)]
  ```
- Added concrete examples for common queries
- Enforced case-insensitive matching by default
- Removed ambiguity in instructions

### 2. **Deterministic Model Parameters** (Lines 217-220)
- Added `seed: 12345` parameter to GPT-4o API calls
- Temperature already set to 0
- This ensures the same input prompt generates the same code every time

### 3. **Better Result Explanation** (Lines 255-293)
- The explanation LLM is now explicitly told:
  - "Use ONLY the numbers from COMPUTED RESULT"
  - "DO NOT recalculate or estimate"
  - "These are the SOURCE OF TRUTH"
- Lower temperature (0.1 instead of 0.3)
- Added seed for consistency
- This prevents the explainer from doing its own math

### 4. **Code Validation**
- Added explicit column name validation in the prompt
- Schema with data types shown upfront
- Sample data provided in JSON format (easier for LLM to understand)

## Architecture Reminder
```
┌─────────────────────────────────────────────────────────┐
│                    USER QUERY                           │
│        "How many rows for Tennessee?"                   │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 1: GPT-4o Code Generator (THE "TRANSLATOR")      │
│  - Converts natural language → Pandas code             │
│  - Temperature: 0, Seed: 12345                          │
│  - Output: result = df[df['State'].str.contains(...)'] │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Python/Pandas Service (THE "CALCULATOR")       │
│  - Executes code on real DataFrame                      │
│  - Source of Truth for all numbers                      │
│  - Output: {"row_count": 98, "total_sales": 174138.97} │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: GPT-4o Explainer (THE "INTERPRETER")          │
│  - Formats results for end user                         │
│  - Temperature: 0.1, Seed: 12345                        │
│  - CRITICAL: Does NOT recalculate, only reformats       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
                  USER ANSWER
```

## Why This Works

1. **Deterministic Code Generation**: Same query → Same Pandas code
2. **Pandas is the Calculator**: Not the LLM
3. **LLM is Only the Interpreter**: It explains pre-computed results

## Testing
1. Start both services:
   ```bash
   # Terminal 1: Python service
   cd python_service
   source venv/bin/activate
   python app.py
   
   # Terminal 2: Next.js
   npm run dev
   ```

2. Upload your Excel/CSV file
3. Ask the same question multiple times:
   - "How many rows does Tennessee have and calculate the total sales"
4. Verify you get the EXACT same answer every time

## Expected Behavior Now
- **Consistent Filtering**: Always uses case-insensitive `.str.contains('Tennessee', case=False, na=False)`
- **Consistent Results**: Same row count and total every time
- **Matches Reality**: The numbers should match what GPT/Gemini calculate

## Files Changed
1. `/app/api/chat/route.ts` (Lines 176-293)
   - Improved prompt engineering
   - Added seed parameters
   - Better validation

## Notes
- The Python service MUST be running on port 5001
- The seed value (12345) can be any number, but must be consistent
- If you still see variations, check the Python service logs for execution errors
