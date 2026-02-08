# 🚀 Quick Start Guide - Excel/CSV ChatGPT-like Processing

## 🚨 START HERE: Check Service Health! (Critical)

Before uploading any files, verify the Pandas service is running to avoid "429 Request Too Large" errors:

```bash
curl http://localhost:5001/health
```

**Must return:** `{"status": "healthy", "service": "pandas-calculator"}`

If it fails or hangs:
```bash
cd python_service
./start.sh
```

## ✅ What's Running

Your **Pandas Calculator Service** is now running at:
- **URL**: http://localhost:5001
- **Status**: ✅ Healthy
- **Purpose**: Source of truth for Excel/CSV data

## 🎯 Next Steps

### 1. Start the Next.js Application

In a **new terminal**, run:

```bash
npm run dev
```

This will start your web application on http://localhost:3000

### 2. Test the System

1. **Open** http://localhost:3000 in your browser
2. **Login** to your account
3. **Upload** the test CSV file: `test-expenses.csv`
4. **Ask questions** like:

   - "What are the total expenses by state?"
   - "Show me all sales for Tennessee"
   - "What's the average marketing spend?"
   - "Which state has the highest operations cost?"
   - "Give me a breakdown by category"

### 3. Watch the Magic Happen

Behind the scenes, your system will:

1. ✅ Load CSV into Pandas DataFrame (source of truth)
2. ✅ LLM generates Python code based on your question
3. ✅ Python service executes the code (accurate calculations)
4. ✅ LLM explains results in natural language

## 📊 Architecture

```
YOU ASK          →  "What are total sales by state?"
                    ↓
BETSY AI (LLM)   →  Generates Python code
                    ↓
PYTHON SERVICE   →  Executes calculation (100% accurate)
                    ↓
BETSY AI (LLM)   →  Explains results naturally
                    ↓
YOU RECEIVE      →  "Here are total sales by state:
                     • California: $257,000
                     • Texas: $180,000..."
```

## 🛠️ Running Services

### Terminal 1: Python Pandas Service (Start This First)
```bash
cd python_service
./start.sh
```
**Status**: Running on http://localhost:5001

### Terminal 2: Next.js App
```bash
npm run dev
```
**Will run on**: http://localhost:3000

## 🧪 Test Files Available

- **test-expenses.csv** - Sample expense data by state
- **test-document.txt** - Sample text document

## 📚 Documentation

- **IMPLEMENTATION_SUMMARY.md** - Complete overview
- **EXCEL_CSV_PROCESSING.md** - Detailed architecture
- **python_service/README.md** - Python service docs

## 🔧 Troubleshooting

### Python service stopped?
```bash
cd python_service
./start.sh
```

### Check if service is running:
`curl http://localhost:5001/health`

### Port already in use:
`lsof -i :5001` then `kill -9 <PID>`

## 🎨 Key Features

✅ **ChatGPT-like interaction** - Natural language Q&A
✅ **100% accurate calculations** - Python/Pandas handles math
✅ **DataFrame as source of truth** - Not embeddings
✅ **Complex queries supported** - groupby, filters, aggregations
✅ **Secure code execution** - Sandboxed Python environment
✅ **Natural language explanations** - Easy to understand results

## 🚀 You're Ready!

Your Excel/CSV processing system is **fully operational** and follows the exact pattern:

- **Database = Memory** (Pandas DataFrame)
- **Python = Calculator** (Accurate computations)
- **LLM = Interpreter** (Natural language understanding)

Just like ChatGPT handles spreadsheets! 🎉
