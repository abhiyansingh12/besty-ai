
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching conversations:", error);
    // Maybe try creating a dummy conversation to see columns
    // Or check if table exists
    return;
  }

  if (data && data.length > 0) {
    console.log("Existing columns:", Object.keys(data[0]));
  } else {
    console.log("Table empty but exists. Attempting insert to check schema.");
    // Try inserting with a dummy document_id to see if it allows it
    const { error: insertError } = await supabase
      .from('conversations')
      .insert({ title: 'Test Schema Check', user_id: 'dummy-user-id' }); // Dummy insert just to check columns if needed
    
    if (insertError) {
        console.log("Insert error (might allow checking schema):", insertError);
    }
  }
}

checkSchema();
