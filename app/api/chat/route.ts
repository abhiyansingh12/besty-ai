import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID || 'asst_WIpxa5DuIKPTkBtKk0QC61gZ';

export async function POST(req: NextRequest) {
  try {
    const { message, projectId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!ASSISTANT_ID) {
      return NextResponse.json({ error: 'OpenAI Assistant ID not configured' }, { status: 500 });
    }

    // 1. Authenticate & Setup Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🤖 Agent Request: "${message}" (Project: ${projectId})`);

    // 2. Get/Create Thread ID
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('openai_thread_id, name')
      .eq('id', projectId)
      .single();

    if (projectError) {
      if (projectError.code === '42703') {
        return NextResponse.json({ 
          error: "Database Schema Error: Missing 'openai_thread_id' column in 'projects' table. Run migration 'update_schema_openai_assistants.sql'."
        }, { status: 500 });
      }
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    let threadId = project.openai_thread_id;

    if (!threadId) {
      console.log("🧵 Creating new Thread...");
      try {
        const thread = await openai.beta.threads.create({
          metadata: { projectId }
        });
        threadId = thread.id;

        // Save it
        const { error: updateError } = await supabase
          .from('projects')
          .update({ openai_thread_id: thread.id })
          .eq('id', projectId);

        if (updateError) {
          console.error("Failed to save thread ID:", updateError);
          if (updateError.code === '42703') {
            return NextResponse.json({
              error: "Database Schema Error: Missing 'openai_thread_id' column. Run migration 'update_schema_openai_assistants.sql'."
            }, { status: 500 });
          }
        }
      } catch (e: any) {
        return NextResponse.json({ error: "Failed to create thread: " + e.message }, { status: 500 });
      }
    }

    // 3. Add User Message
    await openai.beta.threads.messages.create(
      threadId,
      {
        role: "user",
        content: message
      }
    );

    // 4. Run Assistant
    // We use createAndPoll for simplicity in this non-streaming endpoint
    console.log(`🏃 Running Assistant ${ASSISTANT_ID} on Thread ${threadId}...`);

    // Check if we have files in the project to mention in instructions?
    // The prompt says: "For every user query involving files, you must first list the files in the current thread."
    // We can pass additional instructions to the run to enforce this context if needed,
    // but we put it in the System Prompt of the Assistant.
    // However, the Assistant doesn't know the file NAMES unless we tell it or it lists them.
    // Code Interpreter can list files using `os.listdir()`.
    // But let's give it a hint about what files are supposedly there from DB.

    // Check if we have files in the project to mention in instructions?
    const { data: files } = await supabase
      .from('documents')
      .select('id, filename, openai_file_id, metadata')
      .eq('project_id', projectId);

    const fileList = files?.map(f => `- ${f.filename} (ID: ${f.openai_file_id || 'pending'})`).join('\n') || "No files.";

    const run = await openai.beta.threads.runs.createAndPoll(
      threadId,
      {
        assistant_id: ASSISTANT_ID,
        additional_instructions: `
Documents available in this project:
${fileList}

IMPORTANT INSTRUCTIONS:
1. The user views these files as "${files?.map(f => f.filename).join('", "')}".
2. When analyzing, ALWAYS map the uploaded file (which may have a random system name) back to one of these original filenames in your final answer.
3. If the user asks about a specific file by name, look for it in the list above.

LOGIC CORRECTION & DATA GOVERNANCE PROTOCOL:
You are an expert Financial Analyst. When processing the 2025 Sales Summary and WIT Contract data (or any similar financial data), you must apply the following logical constraints to ensure zero-error reporting:

1. **Define Data Blocks**: Recognize that the data likely contains two distinct sections. The first section typically represents **Gross Sales Volume** and the second section represents **Payments/Commissions**.

2. **Anti-Double Counting Rule**: **Do NOT** sum the 'Gross Sales' and 'Payments/Commissions' together. They represent different financial categories.

3. **Calculation Logic**:
   - **Total Sales** = Sum of values from the 'SALES SUMMARY' (or Gross Sales) section only.
   - **Total Payout/Income** = Sum of values from the 'PAYMENT' (or Commission) section only.

4. **Validation**: If a user asks for 'Total Sales' for a region (e.g., Atlanta), only return the value from the top Gross Sales section. **Do not** include values from the Payments section.

5. **Processing Method (CRITICAL)**:
   - **USE CODE INTERPRETER**: You **MUST** use the Python Code Interpreter to isolate the row indices for 'SALES' and 'PAYMENT' sections before performing any addition.
   - **Isolate Indices**: Write Python code to find the start and end rows of each section.
   - **Prevent Merging**: Ensure the categories are never merged in your calculations.

ADDITIONAL REPORTING GUIDELINES:
1. **Show Your Work**: Explicitly list the rows/categories AND columns you included. State clearly: "I analyzed the sheet '[Sheet Name]' from file '[Filename]'."
2. **No Redundant Totals**: Do not provide a "Total Sum of Figures" if you have already provided the specific metric (like "Total Sales"). Only provide one final number per metric.
3. **Silence on Errors**: Do not explain "I am avoiding double counting by...". Just do it correctly.
4. **User-Friendly Formatting**:
   - No LaTeX or Math Notation.
   - Plain Text Only: Write calculations simply.
   - Currency Formatting: Always format money as \`$1,234.56\`.
   - Clean Lists: Use standard Markdown bullets or numbered lists.
   - Direct & Simple: Speak directly to the user.
`.trim()
      }
    );

    if (run.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(
        run.thread_id
      );

      // Get the last message from the assistant
      const assistantMessages = messages.data.filter(m => m.role === 'assistant');
      const lastMessage = assistantMessages[0];

      let responseText = "";
      if (lastMessage) {
        for (const content of lastMessage.content) {
          if (content.type === 'text') {
            responseText += content.text.value + "\n";
          } else if (content.type === 'image_file') {
            // responseText += `[Image Generated: ${content.image_file.file_id}]\n(Images not yet supported in UI)\n`;
          }
        }
      }

      // Remove OpenAI citations (e.g. 【28:0†source】)
      responseText = responseText.replace(/【.*?†source】/g, '').trim();

      console.log(`✅ Assistant Response: ${responseText.substring(0, 50)}...`);
      return NextResponse.json({ answer: responseText || "No response generated." });
    } else {
      console.log(`❌ Run status: ${run.status}`);
      if (run.last_error) {
        console.error(`❌ Run error details:`, run.last_error);
      }
      return NextResponse.json({ 
        error: `Assistant run failed with status: ${run.status}`,
        details: run.last_error
      }, { status: 500 });
    }

  } catch (err: any) {
    console.error('❌ Chat API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
