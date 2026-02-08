# Debugging Guide - Betsy AI

## 🚨 Common Issues

### 1. "429 Request Too Large" Error
**Symptoms:**
- Chat returns "Error: 429 Request too large for gpt-4o..."
- Request size is huge (e.g., 40k+ tokens)

**Cause:**
- The Python Pandas Service is **DOWN** or **UNREACHABLE**.
- The system fell back to the "Text Processing" route.
- It tried to send the **entire CSV/Excel file** to GPT-4o as text.
- This explodes the token limit.

**Solution:**
1. Check if Python service is running:
   ```bash
   curl http://localhost:5001/health
   ```
2. If it fails (connection refused), restart it:
   ```bash
   cd python_service
   ./start.sh
   ```
3. Verify `.env` has the correct URL:
   ```bash
   PANDAS_SERVICE_URL=http://localhost:5001
   ```

### 2. "Pandas service error"
**Symptoms:**
- Chat logs show "Failed to load into Pandas"
- System falls back to text

**Solution:**
- Check Python logs in the `python_service` terminal
- Ensure file is valid CSV/Excel
- Check for encoding issues

## 🔍 How to Verify Pandas is Being Used

When you upload a file and ask a question:

1. Look for this log in your Next.js terminal:
   ```
   🚀 Using Pandas Calculator (Source of Truth)
   ```

2. Look for this log in your Python Service terminal:
   ```
   snake Starting Pandas Calculator Service...
   stats Request to load dataframe...
   ```
