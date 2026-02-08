
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { message, documentId, conversationId } = await req.json();

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

    // -------------------------------------------------------------------------
    // ASSISTANTS API FLOW
    // -------------------------------------------------------------------------

    // 1. Get or Create Assistant
    let assistantId = process.env.OPENAI_ASSISTANT_ID;

    if (!assistantId) {
      // Create a temporary one if environment variable is missing
      // NOTE: This will create a new assistant every restart if not saved in .env
      console.log('⚠️ No OPENAI_ASSISTANT_ID found. Creating a transient assistant...');
      const assistant = await openai.beta.assistants.create({
        name: "Betsy Data Analyst",
        instructions: "You are an expert Data Analyst. You answer questions based on the attached files. Use the file_search tool to find information.",
        model: "gpt-4o",
        tools: [{ type: "file_search" }],
      });
      assistantId = assistant.id;
      console.log(`✅ Created Assistant: ${assistantId}`);
    }

    // 2. Handle Conversation / Thread
    let threadId = '';

    // If we have a conversationId, try to find the thread
    if (conversationId) {
      const { data: conv } = await supabase.from('conversations')
        .select('openai_thread_id')
        .eq('id', conversationId)
        .single();

      if (conv?.openai_thread_id) {
        threadId = conv.openai_thread_id;
        console.log(`🧵 Resuming Thread: ${threadId}`);
      }
    }

    if (!threadId) {
      // Create new Thread
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      console.log(`🧵 Created New Thread: ${threadId}`);

      // If conversationId exists, update it. If not, the frontend might create one later.
      if (conversationId) {
        await supabase.from('conversations')
          .update({ openai_thread_id: threadId } as any)
          .eq('id', conversationId);
      }
    }

    // 3. Prepare Message Attachments
    const attachments: any[] = [];

    if (documentId) {
      // Fetch OpenAI File ID
      const { data: doc } = await supabase.from('documents')
        .select('openai_file_id')
        .eq('id', documentId)
        .single();

      if (doc?.openai_file_id) {
        console.log(`📎 Attaching File: ${doc.openai_file_id}`);
        attachments.push({
          file_id: doc.openai_file_id,
          tools: [{ type: "file_search" }]
        });
      } else {
        console.warn(`⚠️ Document ${documentId} selected but has no openai_file_id. Was it ingested with the new flow?`);
      }
    }

    // 4. Add Message to Thread
    await openai.beta.threads.messages.create(
      threadId,
      {
        role: "user",
        content: message,
        attachments: attachments.length > 0 ? attachments : undefined
      }
    );

    // 5. Run Assistant
    console.log('🏃‍♂️ Running Assistant...');

    const run = await openai.beta.threads.runs.createAndPoll(
      threadId,
      {
        assistant_id: assistantId,
      }
    );

    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(
        run.thread_id
      );

      // Get the last message which (should be) from the assistant
      const lastMessage = messages.data.find(m => m.role === 'assistant');

      let answer = "No response generated.";
      if (lastMessage && lastMessage.content[0].type === 'text') {
        answer = lastMessage.content[0].text.value;
      }

      console.log('✅ Assistant responded.');
      return NextResponse.json({ answer, threadId });

    } else {
      console.error('❌ Run status:', run.status);
      return NextResponse.json({ error: `Assistant run failed with status: ${run.status}` }, { status: 500 });
    }

  } catch (err: any) {
    console.error('Error in chat API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
