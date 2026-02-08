
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
const pdfParse = require('pdf-parse');
import { parse as csvParse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

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

    // 2. Extract text
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    let text = '';
    
    // Check file extension from path
    const lowerPath = storagePath.toLowerCase();

    if (lowerPath.endsWith('.pdf')) {
      try {
        const pdfData = await pdfParse(buffer);
        text = pdfData.text;
      } catch (e) {
        console.error('PDF Parse Error:', e);
        return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 500 });
      }
    } else if (lowerPath.endsWith('.xlsx') || lowerPath.endsWith('.xls')) {
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        // Convert all sheets to CSV text
        text = workbook.SheetNames.map(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          return `Sheet: ${sheetName}\n` + XLSX.utils.sheet_to_csv(sheet);
        }).join('\n\n');
      } catch (e) {
        console.error('Excel Parse Error:', e);
        return NextResponse.json({ error: 'Failed to parse Excel file' }, { status: 500 });
      }
    } else if (lowerPath.endsWith('.csv')) {
      try {
        const rawText = new TextDecoder().decode(buffer);
        // Clean CSV parsing to ensure valid text structure
        const records = csvParse(rawText, {
          columns: true,
          skip_empty_lines: true
        });
        // Convert back to structured JSON-string or simplified text
        text = JSON.stringify(records, null, 2);
      } catch (e) {
        console.error('CSV Parse Error:', e);
        // Fallback to raw text if strict parsing fails
        text = new TextDecoder().decode(buffer);
      }
    } else {
      // Assume text/md
      text = new TextDecoder().decode(buffer);
    }
    
    // Clean text
    text = text.replace(/\s+/g, ' ').trim();

    if (!text) {
      return NextResponse.json({ error: 'No text extracted' }, { status: 400 });
    }

    // 3. Chunk text (simple sliding window or paragraph spliter)
    // Let's use 1000 char chunks with 200 overlap
    const chunkSize = 1000;
    const overlap = 200;
    const chunks: string[] = [];
    
    for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
      chunks.push(text.substring(i, i + chunkSize));
    }

    console.log(`Generated ${chunks.length} chunks.`);

    // 4. Embed and store chunks
    const insertPromises = chunks.map(async (chunk, index) => {
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk,
        });
        const embedding = embeddingResponse.data[0].embedding;

        return supabase.from('document_chunks').insert({
          document_id: documentId,
          content: chunk,
          embedding
        });
      } catch (e) {
        console.error(`Error embedding chunk ${index}:`, e);
        return null;
      }
    });

    await Promise.all(insertPromises);

    return NextResponse.json({ success: true, chunks: chunks.length });

  } catch (err: any) {
    console.error('Ingest API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
