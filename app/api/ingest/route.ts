

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Note: Excel/CSV processing is now handled by the Python Pandas service
// PDF parsing still uses pdf-parse for unstructured data route
const pdfParse = require('pdf-parse');

// Helper to check key
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing in environment variables!"); 
}

// Use Service Role Key to modify data/storage
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

    console.log(`Ingesting document: ${documentId}, path: ${storagePath}`);

    // 1. Download file from Storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (downloadError || !fileBlob) {
      console.error('Storage 404/Error:', downloadError);
      return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 404 });
    }

    // 2. Upload to OpenAI (Assistants API)
    console.log('📤 Uploading file to OpenAI...');

    // Convert Blob to File-like object for OpenAI
    const file = new File([fileBlob], storagePath.split('/').pop() || 'document', { type: fileBlob.type });

    const openaiFile = await openai.files.create({
      file: file,
      purpose: "assistants",
    });

    console.log(`✅ OpenAI File ID: ${openaiFile.id}`);

    // 3. Update document with OpenAI File ID
    const { error: updateError } = await supabase
      .from('documents')
      .update({ openai_file_id: openaiFile.id } as any)
      .eq('id', documentId);

    if (updateError) {
      console.error('❌ Failed to save openai_file_id:', updateError);
      return NextResponse.json({ error: 'Failed to update document record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, openai_file_id: openaiFile.id });

  } catch (err: any) {
    console.error('Ingest API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
