
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY; // Using Service Key!
const PANDAS_URL = envConfig.PANDAS_SERVICE_URL || 'http://localhost:5001';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugPandas() {
  console.log("🔍 Debugging Pandas Integration...");

  // 1. Find the CSV file record
  const { data: docs, error: dbError } = await supabase
    .from('documents')
    .select('*')
    .ilike('filename', '%tennessee%') // Target the specific file
    .limit(1);

  if (dbError || !docs || docs.length === 0) {
    console.error("❌ Could not find 'tennessee' file in DB:", dbError || "No results");
    return;
  }

  const doc = docs[0];
  console.log(`✅ Found Document: ${doc.filename} (ID: ${doc.id})`);

  // 2. Download File (Using Service Key)
  console.log(`⬇️ Downloading ${doc.storage_path}...`);
  const { data: fileBlob, error: downloadError } = await supabase
    .storage
    .from('documents')
    .download(doc.storage_path);

  if (downloadError) {
    console.error("❌ Download Failed:", downloadError);
    return;
  }
  console.log(`✅ Download Successful. Size: ${fileBlob.size} bytes`);

  // 3. Prepare for Python Service
  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const base64Content = buffer.toString('base64');
  console.log(`📦 Prepared Base64 Payload (Length: ${base64Content.length})`);

  // 4. Send to /load-dataframe
  console.log(`🚀 Sending to Python Service (${PANDAS_URL}/load-dataframe)...`);
  try {
    const loadRes = await fetch(`${PANDAS_URL}/load-dataframe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: doc.id,
        file_content: base64Content,
        file_type: 'csv'
      })
    });

    const loadRef = await loadRes.json();
    console.log("Load Response:", loadRef);

    if (!loadRes.ok || !loadRef.success) {
      console.error("❌ Python Load Failed:", loadRef);
      return;
    }
    console.log("✅ Python Service Loaded DataFrame!");

    // 5. Send Test Query
    const testQuery = "What is the total sales?";
    console.log(`❓ Sending Query: "${testQuery}"`);

    const queryRes = await fetch(`${PANDAS_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: doc.id,
        query: testQuery
      })
    });

    const queryData = await queryRes.json();
    console.log("Query Response:", queryData);
    
    if (queryData.success) {
      console.log(`✅ ANALYSIS SUCCESSFUL: ${queryData.answer}`);
    } else {
      console.error(`❌ ANALYSIS FAILED: ${queryData.error}`);
    }

  } catch (err) {
    console.error("❌ Network/Service Error:", err);
  }
}

debugPandas();
