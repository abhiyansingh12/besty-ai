
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { message, documentId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        answer: "Please add your OPENAI_API_KEY to .env to enable semantic search." 
      });
    }

    // 1. Generate embedding for query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message,
    });
    const embedding = embeddingResponse.data[0].embedding;

    // 2. Search for relevant chunks
    const { data: chunks, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.1, // Lower threshold to ensure matches
      match_count: 5,
      filter_document_id: documentId,
    });

    if (error) {
      console.error('Supabase search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    console.log(`Found ${chunks?.length || 0} chunks for query: "${message}"`);
    if (chunks && chunks.length > 0) {
      console.log('Top match similarity:', chunks[0].similarity);
    }


    // 3. Generate answer using retrieved context
    const context = chunks?.map((chunk: any) => chunk.content).join('\n\n') || '';
    
    const systemPrompt = `You are a helpful AI assistant. Answer the user's question based ONLY on the following context. If the answer is not in the context, say "I don't know based on the provided document."\n\nContext:\n${context}`;

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    const answer = chatResponse.choices[0].message.content;

    return NextResponse.json({ answer, chunks }); // Return chunks for debug/citation

  } catch (err: any) {
    console.error('Error in chat API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
