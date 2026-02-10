
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// 1. Manually Load Env Vars
let envConfig = {};
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      envConfig[key] = value;
    }
  });
} catch (e) {
  console.error("Could not read .env file:", e);
  process.exit(1);
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;
const PANDAS_URL = envConfig.PANDAS_SERVICE_URL || 'http://localhost:5001';
const OPENAI_API_KEY = envConfig.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !OPENAI_API_KEY) {
  console.error("Missing credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function debugPandasChain() {
  console.log("🔍 Debugging Analysis Chain (Node -> Python)...");

  // 1. Find the CSV file
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .ilike('filename', '%tennessee%')
    .limit(1);

  if (!docs || docs.length === 0) { console.error("❌ No file found"); return; }
  const doc = docs[0];
  console.log(`✅ File: ${doc.filename}`);

  // 2. Download File
  const { data: fileBlob } = await supabase.storage.from('documents').download(doc.storage_path);
  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const base64Content = buffer.toString('base64');

  // 3. Load DataFrame (Python)
  console.log(`🚀 Loading DataFrame...`);
  const loadRes = await fetch(`${PANDAS_URL}/load-dataframe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: doc.id,
      file_content: base64Content,
      file_type: 'csv'
    })
  });
  const loadResult = await loadRes.json();
  if (!loadResult.success) { console.error("❌ Load Failed:", loadResult); return; }
  console.log("✅ DataFrame Loaded. Columns:", loadResult.columns);

  // 4. Generate Code (OpenAI)
  const columns = loadResult.columns.join(', ');
  const sample = JSON.stringify(loadResult.sample_data);
  const userQuery = "what is the total number of rows in tennessee sales"; // User query

  console.log(`🤖 Asking GPT-4o to write code for: "${userQuery}"...`);

  const codeGenRunner = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `You are a Python Pandas expert.
Given a dataframe 'df' with columns: [${columns}]
And sample data: ${sample}

Write Python code to answer the user's query: "${userQuery}"

Rules:
1. Assign the final answer to a variable named 'result'.
2. The answer 'result' must be a number, string, list, or dictionary (JSON serializable).
3. Handle dirty data robustly:
   - Strip whitespace from column names if needed: df.columns = df.columns.str.strip()
   - Convert currency strings (e.g. "$1,234.56") to numeric if doing math: 
     df['Col'] = df['Col'].replace(r'[$,]', '', regex=True).apply(pd.to_numeric, errors='coerce')
4. Do NOT use print().
5. Output ONLY the python code, no markdown backticks.
` }
    ],
    temperature: 0
  });

  const generatedCode = codeGenRunner.choices[0].message.content?.replace(/```python/g, '').replace(/```/g, '').trim();
  console.log(`🐍 Generated Code:\n---\n${generatedCode}\n---`);

  // 5. Execute Code (Python)
  console.log(`🚀 Executing Code...`);
  const execResponse = await fetch(`${PANDAS_URL}/execute-pandas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: doc.id,
      operation: generatedCode
    })
  });

  const execResult = await execResponse.json();
  console.log("📝 Execution Result:", JSON.stringify(execResult, null, 2));
}

debugPandasChain();
