
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';



// Helper to check key
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing in environment variables!"); 
}

// User Service Role Key to modify data/storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { documentId, storagePath } = await req.json();

    if (!documentId || !storagePath) {
      return NextResponse.json({ error: 'Missing documentId or storagePath' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: "Please add your OPENAI_API_KEY to .env to enable ingestion." 
      }, { status: 500 });
    }

    console.log(`📄 Ingesting document: ${documentId}, path: ${storagePath}`);

    // Fetch original filename from DB to ensure OpenAI sees the correct name
    const { data: docMeta } = await supabase
      .from('documents')
      .select('filename')
      .eq('id', documentId)
      .single();
    
    const originalName = docMeta?.filename || path.basename(storagePath);

    // 1. Download file from Storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (downloadError || !fileBlob) {
      console.error('Storage 404/Error:', downloadError);
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 404 });
    }

    // 2. Upload to OpenAI Files
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    
    // Create a unique temp directory to preserve the original filename
    const uniqueDir = path.join(tmpdir(), `ingest_${documentId}_${Date.now()}`);
    if (!fs.existsSync(uniqueDir)) {
      fs.mkdirSync(uniqueDir);
    }
    
    const tempFilePath = path.join(uniqueDir, originalName);
    fs.writeFileSync(tempFilePath, buffer);

    console.log(`📤 Uploading to OpenAI: ${originalName}`);

    const openAIFile = await openai.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: 'assistants',
    });

    console.log(`✅ OpenAI File ID: ${openAIFile.id}`);

    // Cleanup temp file and directory
    try {
      fs.unlinkSync(tempFilePath);
      fs.rmdirSync(uniqueDir);
    } catch (cleanupError) {
      console.warn("Failed to cleanup temp files:", cleanupError);
    }

    // NEW LOGIC: Pre-load into Python Service if Excel/CSV
    // This allows deterministic extraction of summaries and faster querying
    const ext = path.extname(storagePath).toLowerCase();
    if (['.csv', '.xls', '.xlsx'].includes(ext)) {
      try {
        const pandasUrl = process.env.PANDAS_SERVICE_URL || 'http://localhost:5001';
        console.log(`📊 Pre-loading data to Pandas Service: ${pandasUrl}`);

        // We re-read the buffer (or use the one we have). 
        // Note: 'buffer' variable from line 53 is still available here.

        const response = await fetch(`${pandasUrl}/load-dataframe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: documentId,
            file_content: buffer.toString('base64'),
            file_type: ext.replace('.', '')
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Pandas Service Loaded: ${data.rows} rows.`);

          // We no longer extract summaries here to avoid "Excel -> Text" errors.
          // The Chat API will now use Code Interpreter to analyze the raw file directly.
        } else {
          console.error(`⚠️ Pandas Service Error: ${await response.text()}`);
        }
      } catch (e) {
        console.error(`⚠️ Failed to contact Pandas Service: ${e}`);
      }
    }

    // 3. Update Document with OpenAI File ID (and keep metadata if we just updated it?)
    // Actually, consecutive updates might race or overwrite if we aren't careful.
    // Let's do a single update if possible, or just update openai_file_id separately.
    // The previous block awaits the update, so it's sequential.

    const { error: updateError } = await supabase
      .from('documents')
      .update({ openai_file_id: openAIFile.id })
      .eq('id', documentId);

    if (updateError) {
      console.error('Error updating document with file ID:', updateError);
    }

    // 4. Attach to Project Thread (if exists)
    // First, get the project ID for this document
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('project_id')
      .eq('id', documentId)
      .single();

    if (docData && docData.project_id) {
      // Get Project's Thread ID
      const { data: projectData, error: projectFetchError } = await supabase
        .from('projects')
        .select('openai_thread_id, name')
        .eq('id', docData.project_id)
        .single();

      if (projectFetchError) {
        // Check for specific "column does not exist" error (Postgres code 42703)
        if (projectFetchError.code === '42703') {
          console.error("CRITICAL: Database schema outdated. Missing 'openai_thread_id'.");
          return NextResponse.json({
            error: "Database Schema Error: The 'projects' table is missing the 'openai_thread_id' column. Please run the migration script 'update_schema_openai_assistants.sql' in your Supabase SQL Editor."
          }, { status: 500 });
        }
      }

      if (projectData) {
        let threadId = projectData.openai_thread_id;

        // If no thread exists, we create one now (lazy creation)
        if (!threadId) {
          console.log("🧵 Creating new Thread for Project...");
          try {
            const thread = await openai.beta.threads.create({
              metadata: { projectId: docData.project_id }
            });
            threadId = thread.id;

            // Save Thread ID
            const { error: updateError } = await supabase
              .from('projects')
              .update({ openai_thread_id: threadId })
              .eq('id', docData.project_id);

            if (updateError) {
              console.error("Failed to save thread ID:", updateError);
              if (updateError.code === '42703') {
                return NextResponse.json({
                  error: "Database Schema Error: Missing 'openai_thread_id' column in 'projects' table. Please run the migration."
                }, { status: 500 });
              }
            }
          } catch (threadError: any) {
            console.error("Thread creation failed:", threadError);
            return NextResponse.json({ error: "Failed to create OpenAI Thread: " + threadError.message }, { status: 500 });
          }
        }

        if (threadId) {
          console.log(`🔗 Attaching file ${openAIFile.id} to Thread ${threadId}`);

          // Determine which tools to enable based on file extension
          const ext = path.extname(storagePath).toLowerCase();
          const isDataFile = ['.csv', '.xls', '.xlsx', '.json'].includes(ext);

          // CSVs/Excel are NOT supported by file_search (retrieval), only code_interpreter
          const fileTools: any[] = [{ type: "code_interpreter" }];
          if (!isDataFile) {
            fileTools.push({ type: "file_search" });
          }

          // Send a message to the thread to make the file available
          await openai.beta.threads.messages.create(
            threadId,
            {
              role: "user",
              content: `System: File '${originalName}' has been uploaded to the workspace.`,
              attachments: [
                { file_id: openAIFile.id, tools: fileTools }
              ]
            }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      openai_file_id: openAIFile.id
    });

  } catch (err: any) {
    console.error('❌ Ingest API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
