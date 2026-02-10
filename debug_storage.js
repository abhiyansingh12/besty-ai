
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Manually verify .env contains keys
let envConfig = {};
try {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, ''); // Remove quotes
            envConfig[key] = value;
        }
    });
} catch (e) {
    console.error("Could not read .env file:", e);
    process.exit(1);
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in .env");
    console.log("Found keys:", Object.keys(envConfig));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStorage() {
    console.log("🔍 Checking Storage vs Database Consistency...");

    // 1. Get all documents from DB
    const { data: dbDocs, error: dbError } = await supabase
        .from('documents')
        .select('id, filename, storage_path, project_id, created_at');

    if (dbError) {
        console.error("❌ DB Error:", dbError);
        return;
    }

    console.log(`\n📂 Found ${dbDocs.length} documents in Database:`);
    dbDocs.forEach(d => console.log(` - [${d.id}] ${d.filename} (Path: '${d.storage_path}')`));

    // 2. Get all files from Storage Bucket
    const { data: storageFiles, error: storageError } = await supabase
        .storage
        .from('documents')
        .list(); // List root

    if (storageError) {
        console.error("❌ Storage Error:", storageError);
        return;
    }

    console.log(`\n📦 Found ${storageFiles.length} files in Storage Bucket (Root):`);
    storageFiles.forEach(f => console.log(` - '${f.name}' (Size: ${f.metadata?.size} bytes)`));

    // Recursively list if folders exist (not fully implemented but handles flat structure)
    // Our upload logic suggests flat structure due to Math.random() filename

    // 3. Consistency Check
    console.log("\n⚠️ Consistency Check:");

    let issuesFound = false;

    dbDocs.forEach(doc => {
        const foundInStorage = storageFiles.find(f => f.name === doc.storage_path);
        if (!foundInStorage) {
            console.error(`❌ MISSING FILE: Record '${doc.filename}' points to '${doc.storage_path}', but file NOT found in storage!`);
            issuesFound = true;
        } else {
            console.log(`✅ Verified: '${doc.filename}' exists.`);
        }
    });

    if (!issuesFound) {
        console.log("\n✅ All database records have matching files in storage.");
    }
}

checkStorage();
