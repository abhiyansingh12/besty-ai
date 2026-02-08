
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import { parse as csvParse } from 'csv-parse/sync';
const pdfParse = require('pdf-parse');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { message, documentId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Create authenticated Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Get the access token from Authorization header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      console.error('❌ No authorization token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Supabase client with the user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ User authenticated:', user.email);
    console.log('🔍 Query:', message);
    console.log('📄 Document filter:', documentId || 'All documents');

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        answer: "Please add your OPENAI_API_KEY to .env to enable semantic search." 
      });
    }

    // 1. Generate embedding for query (always needed for fallback or relevance)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
    });
    const embedding = embeddingResponse.data[0].embedding;
    console.log('✅ Generated query embedding');

    // 2. Context Retrieval (Hybrid: Full Text for selected doc OR Vector Search)
    let context = '';

    if (documentId) {
      const { data: doc } = await supabase.from('documents').select('*').eq('id', documentId).single();

      if (doc) {
        console.log(`📂 Fetching full content for document: ${documentId}`);

        try {
          // Determine storage path: prefer explicit column, fallback to parsing URL
          let storagePath = doc.storage_path;
          if (!storagePath && doc.file_url) {
            const urlParts = doc.file_url.split('/documents/');
            if (urlParts.length > 1) {
              storagePath = decodeURIComponent(urlParts[urlParts.length - 1]);
            }
          }

          if (storagePath) {
            // Download using authenticated client (respects RLS)
            const { data: fileBlob, error: downloadError } = await supabase.storage
              .from('documents')
              .download(storagePath);

            if (downloadError) {
              console.error('❌ Storage download error:', downloadError);
              throw new Error(`Failed to download file: ${downloadError.message}`);
            }

            if (fileBlob) {
              const buffer = Buffer.from(await fileBlob.arrayBuffer());
              let fullText = '';
              const lowerExt = (doc.file_type || '').toLowerCase();

              if (lowerExt === 'pdf') {
                try {
                  const pdfData = await pdfParse(buffer);
                  fullText = pdfData.text;
                } catch (e) {
                  console.error('PDF Parse fail:', e);
                  fullText = "Error extracting text from PDF.";
                }
              } else if (['xlsx', 'xls'].includes(lowerExt)) {
                try {
                  const workbook = XLSX.read(buffer, { type: 'buffer' });
                  fullText = workbook.SheetNames.map(name => {
                    const sheet = workbook.Sheets[name];
                    return `Sheet: ${name}\n` + XLSX.utils.sheet_to_csv(sheet);
                  }).join('\n\n');
                } catch (e) {
                  console.error('Excel Parse fail:', e);
                  fullText = "Error extracting text from Excel.";
                }
              } else if (lowerExt === 'csv') {
                fullText = new TextDecoder().decode(buffer);
              } else {
                fullText = new TextDecoder().decode(buffer);
              }

              // Clean text
              fullText = fullText.replace(/\s+/g, ' ').trim();

              if (fullText.length < 200000) { // < 50k tokens
                context = `Full Document Content (Verified Source):\n${fullText}`;
                console.log(`✅ Using full document text (${fullText.length} chars)`);
              } else {
                console.warn('⚠️ Document too large for full context, falling back to vectors.');
              }
            }
          } else {
            console.warn('⚠️ No storage path found for document, skipping full text download.');
          }

        } catch (err) {
          console.error('❌ Failed to fetch/parse full document:', err);
        }
      }
    }

    let chunks: any[] = [];

    // Fallback to Vector Search if no context yet
    if (!context) {
      console.log('🔍 Performing vector search...');
      const { data: searchResults, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.1,
        match_count: 5,
        filter_document_id: documentId,
      });

      if (error) {
        console.error('❌ Supabase search error:', error);
        // Don't fail hard, try answering without context potentially? No, return error.
      } else {
        chunks = searchResults || [];
        context = chunks.map((c: any) => c.content).join('\n\n');
      }
    }

    if (chunks.length > 0) {
      console.log(`📊 Found ${chunks.length} chunks.`);
      console.log('🎯 Top match:', chunks[0].similarity?.toFixed(3));
    } else if (!context) {
      console.warn('⚠️ No context found (neither full text nor vector matches).');
    }

    // 3. Generate answer using retrieved context
    console.log(`💬 Final Context length: ${context.length} characters`);

    // Updated System Prompt for Definitions & Calculations
    const systemPrompt = `You are an expert AI Data Analyst. Your goal is to help the user understand their documents.

INSTRUCTIONS:
1. **Definitions**: If the user asks for a definition (e.g., "What is YTD?"), prioritize definitions found in the document. If not found, use your general business knowledge to define it, but clearly state "General Definition:" vs "Document Definition:".
2. **Calculations**: If the user asks for calculations (e.g., "Total sales", "Average price"), USE THE PROVIDED CONTEXT DATA. Truncated data identifiers are usually irrelevant. 
   - If the context contains the raw rows (CSV/Excel data), perform the calculation precisely.
   - If the context is partial (chunks), explain that the calculation is based on the visible data only or cite the specific values you see.
3. **Citations**: Always explicitly cite the document name or section if possible.

CONTEXT:
${context}`;

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });
    console.log('✅ Generated AI response');

    const answer = chatResponse.choices[0].message.content;

    return NextResponse.json({ answer, chunks }); // Return chunks for debug/citation

  } catch (err: any) {
    console.error('Error in chat API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
