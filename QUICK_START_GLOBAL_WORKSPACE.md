# 🚀 Quick Start: Global Workspace Mode

## What Just Changed?

Your Betsy AI now works like **ChatGPT with file uploads** - it can see and analyze ALL documents in a project simultaneously!

---

## ⚡ 3-Step Setup

### 1️⃣ Run Database Migration

```bash
node run_global_workspace_migration.js
```

This will output SQL statements. Copy them and:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **SQL Editor** (left sidebar)
3. Paste the SQL and click **Run**

### 2️⃣ Restart Your Dev Server

Your dev server is already running, but refresh the browser to see the new UI:

```
http://localhost:3000/dashboard
```

### 3️⃣ Test It Out!

1. Create a new project (or use existing)
2. Upload 2+ documents (e.g., a CSV + a PDF)
3. Ask cross-document questions:
   - "What is the total sales across all files?"
   - "Compare the data in the CSV to the PDF"
   - "Are there any conflicts between the documents?"

---

## 🎨 New UI Features

### Before
```
📄 Document 1 [CLICK TO SELECT]
📄 Document 2
📄 Document 3

Chat only sees Document 1 ❌
```

### After
```
🌐 Global Workspace Active
AI can analyze all 3 documents simultaneously

📄 Document 1 (CSV • 2/8/2026)  [⋮ Preview | Rename | Delete]
📄 Document 2 (PDF • 2/7/2026)  [⋮ Preview | Rename | Delete]
📄 Document 3 (TXT • 2/6/2026)  [⋮ Preview | Rename | Delete]

Chat sees ALL documents ✅
```

---

## 🧪 Example Queries

### Cross-Document Totals
**Upload:**
- `sales_Q1.csv` - Tennessee: $50k
- `sales_Q2.csv` - Tennessee: $75k

**Ask:** "What is the total Tennessee sales?"

**AI Response:**
> Total Tennessee sales: **$125,000**
> - sales_Q1.csv: $50,000
> - sales_Q2.csv: $75,000

---

### Conflict Detection
**Upload:**
- `draft_report.pdf` - Goal: $200k
- `final_report.pdf` - Goal: $250k

**Ask:** "What is the sales goal?"

**AI Response:**
> ⚠️ **Discrepancy detected:**
> - draft_report.pdf states $200,000
> - final_report.pdf states $250,000
> 
> Please clarify which is correct.

---

### Multi-Document Analysis
**Upload:**
- `expenses.csv` - Tennessee: $100k
- `revenue.csv` - Tennessee: $174k

**Ask:** "What is the Tennessee profit margin?"

**AI Response:**
> Tennessee profit margin: **42.6%**
> 
> Calculation:
> - Revenue: $174,138 (revenue.csv)
> - Expenses: $100,000 (expenses.csv)
> - Profit: $74,138
> - Margin: 42.6%

---

## 🔧 Troubleshooting

### "Could not find the function match_documents"
**Solution:** Run the database migration (Step 1 above)

### "AI still only sees one document"
**Solution:** 
1. Make sure you're in a **project** (not just uploaded files)
2. Refresh the browser
3. Check that `projectId` is being sent in the API call

### "Documents are still clickable"
**Solution:** Hard refresh the browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

---

## 📚 Learn More

- **Full Documentation:** `GLOBAL_WORKSPACE_IMPLEMENTATION.md`
- **Database Schema:** `global_workspace_migration.sql`
- **API Changes:** `app/api/chat/route.ts`
- **UI Changes:** `components/betsy-dashboard.tsx`

---

## 🎯 What This Enables

✅ **Synthesis** - "What is the total sales across all files?"
✅ **Comparison** - "Compare the CSV data to the PDF forecast"
✅ **Conflict Detection** - "Are there discrepancies between documents?"
✅ **Source Attribution** - AI tells you which file each fact came from
✅ **Multi-Document Analysis** - Combine data from multiple sources

---

## 🎉 You're All Set!

Your Betsy AI is now a **Global Workspace Intelligence Tool**. Upload multiple documents and ask questions that span across all of them!

**Next Steps:**
1. Run the migration SQL (if you haven't already)
2. Refresh your browser
3. Upload 2+ documents to a project
4. Ask a cross-document question
5. Watch the magic happen! ✨
