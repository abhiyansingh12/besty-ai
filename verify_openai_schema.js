const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.resolve(__dirname, '.env');
let envConfig = '';
try {
  envConfig = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.error("Could not read .env file");
  process.exit(1);
}

envConfig.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  console.log("🔍 Verifying Schema for OpenAI Assistants Integration...");
  
  // 1. Check Projects table
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('openai_thread_id')
    .limit(1);

  if (projectError) {
    if (projectError.code === '42703') { // Undefined column
       console.log("❌ 'openai_thread_id' column is MISSING in 'projects' table.");
    } else {
       console.log("❌ Error checking 'projects' table:", projectError.message);
    }
  } else {
    console.log("✅ 'openai_thread_id' column exists in 'projects' table.");
  }

  // 2. Check Documents table
  const { data: docData, error: docError } = await supabase
    .from('documents')
    .select('openai_file_id')
    .limit(1);

  if (docError) {
    if (docError.code === '42703') { // Undefined column
       console.log("❌ 'openai_file_id' column is MISSING in 'documents' table.");
    } else {
       console.log("❌ Error checking 'documents' table:", docError.message);
    }
  } else {
    console.log("✅ 'openai_file_id' column exists in 'documents' table.");
  }

  if (projectError?.code === '42703' || docError?.code === '42703') {
      console.log("\n⚠️  ACTION REQUIRED: You need to run the SQL migration script in Supabase SQL Editor.");
      console.log("I have created 'update_schema_openai_assistants.sql' for you to copy-paste.");
  } else {
      console.log("\n✨ Database schema is up to date!");
  }
}

verifySchema();
