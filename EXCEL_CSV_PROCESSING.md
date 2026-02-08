# Excel/CSV Processing with Pandas - ChatGPT-like Pattern

## Overview

This implementation follows the **exact pattern** for making AI feel like GPT on Excel/CSV:

```
Excel/CSV → Pandas/DataFrame (source of truth)
PDF rules → Vector DB (optional)
LLM → reasoning + explanation
Python → calculations
```

## Architecture

### Components

1. **Python Pandas Service** (`python_service/`)
   - Acts as the "Calculator"
   - Loads Excel/CSV into Pandas DataFrames (source of truth)
   - Executes Python/Pandas code for accurate calculations
   - Runs on port 5001

2. **TypeScript Chat API** (`app/api/chat/route.ts`)
   - Acts as the "Interpreter"
   - Uses LLM (GPT-4o) to:
     - Generate Python/Pandas code based on user questions
     - Explain results in natural language (ChatGPT-like)
   - Orchestrates the flow between user, LLM, and Python service

3. **Vector Database** (Supabase)
   - Stores PDF documents (optional rules/context)
   - Used for unstructured data (PDFs, text files)

## How It Works

### For Excel/CSV Files:

1. **Upload & Load**
   - User uploads Excel/CSV file
   - File is sent to Python service
   - Loaded into Pandas DataFrame (source of truth)

2. **Question Processing**
   - User asks: "What are the total sales by state?"
   - LLM generates Python/Pandas code:
     ```python
     result = df.groupby('State')['Sales'].sum()
     ```

3. **Calculation Execution**
   - Python service executes the code (accurate calculations)
   - Returns structured results

4. **Natural Language Explanation**
   - LLM explains results in ChatGPT-like manner:
     > "Based on your uploaded file, here's what I found:
     > - **California**: $1,234,567
     > - **Texas**: $987,654
     > ..."

### For PDFs/Text Files:

- Uses Vector DB (embeddings)
- Standard RAG (Retrieval Augmented Generation)

## Setup

### 1. Install Python Service Dependencies

```bash
cd python_service
chmod +x start.sh
./start.sh
```

Or manually:
```bash
cd python_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### 2. Configure Environment Variables

Add to `.env`:
```bash
# Python Pandas Service URL
PANDAS_SERVICE_URL=http://localhost:5001

# Existing OpenAI & Supabase keys
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Start the Application

Terminal 1 - Python Service:
```bash
cd python_service
./start.sh
```

Terminal 2 - Next.js App:
```bash
npm run dev
```

## API Endpoints

### Python Service (Port 5001)

#### `POST /load-dataframe`
Load Excel/CSV into Pandas DataFrame

**Request:**
```json
{
  "document_id": "uuid",
  "file_content": "base64-encoded-file",
  "file_type": "csv" | "xlsx" | "xls"
}
```

**Response:**
```json
{
  "success": true,
  "rows": 1000,
  "columns": ["Name", "Age", "City"],
  "schema": [...],
  "sample_data": [...]
}
```

#### `POST /query-natural`
Execute Pandas code for natural language queries

**Request:**
```json
{
  "document_id": "uuid",
  "pandas_code": "result = df.groupby('State')['Sales'].sum()"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "type": "series",
    "data": {"CA": 1234, "TX": 9876}
  }
}
```

#### `POST /describe-dataframe`
Get statistical description

#### `GET /health`
Health check

## Benefits of This Pattern

### 1. **Accuracy**
- Python/Pandas handles all calculations (no LLM hallucinations on math)
- DataFrame is source of truth

### 2. **ChatGPT-like Experience**
- Natural language input: "Show me total sales by region"
- Natural language output: "Based on your file, here's what I found..."
- Code execution happens behind the scenes

### 3. **Flexibility**
- Handles complex queries (groupby, filtering, aggregations)
- Works with any Excel/CSV structure
- Extensible to other data sources

### 4. **Separation of Concerns**
- **Database** → Memory (Pandas DataFrame)
- **Python** → Calculator (accurate computations)
- **LLM** → Interpreter (understanding + explanation)

## Example Flow

**User Question:** "What are the total expenses for Tennessee?"

**Step 1 - LLM generates code:**
```python
result = df[df['State'] == 'Tennessee']['Expenses'].sum()
```

**Step 2 - Python executes:**
```json
{
  "type": "number",
  "value": 45678.90
}
```

**Step 3 - LLM explains:**
> "Based on your uploaded file, the **total expenses for Tennessee** are **$45,678.90**. 
> This includes all expense entries where the State column equals 'Tennessee'."

## Deployment

### Docker (Recommended for Production)

```bash
cd python_service
docker build -t pandas-calculator .
docker run -p 5001:5001 pandas-calculator
```

### Update Environment Variable
In production, set:
```bash
PANDAS_SERVICE_URL=https://your-pandas-service-url.com
```

## Security

1. **Code Execution Safety**
   - Forbidden operations: `import os`, `exec()`, `eval()`, file operations
   - Only Pandas operations allowed
   - Safe execution context

2. **Input Validation**
   - File type validation
   - Size limits
   - Encoding validation

## Troubleshooting

### Python service not starting
```bash
# Check if port 5001 is in use
lsof -i :5001

# Kill process if needed
kill -9 <PID>
```

### Connection refused errors
- Ensure Python service is running
- Check `PANDAS_SERVICE_URL` in `.env`
- Verify firewall settings

### DataFrame not loading
- Check file encoding
- Verify file type (csv, xlsx, xls)
- Check Python service logs

## Future Enhancements

1. **Caching** - Store DataFrames in Redis for faster access
2. **Advanced Analytics** - Support for matplotlib/plotly visualizations
3. **Multi-sheet Excel** - Handle multiple sheets
4. **Data Validation** - Schema validation before loading
5. **Query History** - Store and reuse generated code

## Credits

This pattern implements the best practice for AI-powered spreadsheet analysis:
- Uses Pandas as the source of truth (not embeddings)
- Separates calculation (Python) from interpretation (LLM)
- Provides ChatGPT-like natural language interaction
- Ensures accuracy for numerical operations
