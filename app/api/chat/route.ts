
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ASSISTANT_ID = process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID;

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

CRITICAL DATA ANALYSIS PROTOCOL:

1. **USE CODE INTERPRETER (PYTHON) FIRST**:
   - For any Excel (.xlsx, .xls) or CSV file analysis, you **MUST** use the Code Interpreter tool.
   - **DO NOT** rely on text extraction or guessing.
   - Write and execute Python code to load the data.

2. **SHEET SELECTION & DATA INTEGRITY (CRITICAL)**:
   - **Step 1: Check Sheet Names**:
     - Run \`pd.ExcelFile(path).sheet_names\`.
     - If the user asks for "Total Sales" or "Summary", **PRIORITIZE** sheets named "Summary", "Dashboard", "Totals", or similar.
     - **AVOID** using "Detail" sheets for high-level totals unless no summary exists, as they may contain unaggregated data or duplicates.
   - **Step 2: Inspect Structure**:
     - Load the first 10 rows of the chosen sheet: \`df = pd.read_excel(path, sheet_name="SheetName", header=None, nrows=10)\`.
     - Identify the correct header row (it might be row 2 or 3). Reload with \`header=N\`.

3. **COLUMN SELECTION & METRIC ISOLATION (CRITICAL)**:
   - **Identify the Right Column**: If the user asks for "Sales", look specifically for columns named "Sales", "Amount", "Total Sales", or "TTL_SALES".
   - **DO NOT SUM ACROSS COLUMNS**: Never add "Sales" and "Payments" (or "Credits") together unless explicitly asked. These are distinct financial metrics.
   - **Report Separately**: If the data contains both Sales and Payments, report them as separate line items (e.g., "Total Sales: $1.9M, Total Payments: $149k").
   - **Check for "YTD" vs "MTD"**: If both Year-to-Date (YTD) and Month-to-Date (MTD) columns exist, use YTD for "total" queries unless specified otherwise.

4. **CALCULATION ACCURACY & CIRCULAR SUM PREVENTION (CRITICAL)**:
   - **THE "EITHER/OR" RULE**:
     - **EITHER** sum the monthly columns (typically indices 2-13),
     - **OR** read the Total column (typically index 14).
     - **NEVER** add the Total column to the monthly columns.
   - **Total Column Logic**: If a "Total" or "TTL" column exists, **read that value directly**. Do not re-sum. **Use this value as the final answer.**
   - **"Sum Everything" Bug**: If you add [Jan..Dec] + [Total], you create a Circular Sum error (doubling the value). **STOP THIS.**
   - **Correct Formula**: \`Grand Total = Total Column\` OR \`Grand Total = Sum(Jan..Dec)\`. **NOT BOTH.**
   - **Exclude Totals from Sums**: If you MUST calculate a sum manually, exclude any existing "Total", "Subtotal", or "Grand Total" rows.
     - Example: \`df = df[~df['Region'].astype(str).str.contains('Total|TTL|Grand', case=False, na=False)]\`.
   - **Verify Data Types**: Ensure numbers are floats, not strings. Strip '$' and ',' characters.
   - **Output Restriction**: **DO NOT** output or calculate 'Grand Total Sum of All Figures' if it is just 2x the Total Sales. **DO NOT** mention the "wrong" total or the fact that it would be double counting. Just report the correct number.
   - **REDUNDANCY CHECK**: If 'Grand Total' and 'Total Sales' are the same value, **ONLY REPORT 'Total Sales'**. Do not list 'Grand Total' separately.

5. **FILTERING & CONTEXT DRIFT PREVENTION**:
   - **STRICT STRING MATCHING**: If the user asks for "Atlanta", you must filter for **Exact Match == "Atlanta"**.
     - **DO NOT** use partial matches or "Contains".
     - **DO NOT** include "Outside Atlanta", "Atlanta Region", or "Grand Totals".
   - **Code Pattern**: Use \`df[df['Column'].str.strip().str.lower() == 'atlanta']\` instead of \`.str.contains()\`.
   - **Verification**: Print the unique values of the filtered column to ensure no "Outside..." or "Total..." rows leaked in.
   - **PRINT MATCHED ROWS**: In your Python output, print the unique values of the column you filtered on to verify you caught the right rows.

6. **REPORTING**:
   - State clearly: "I analyzed the sheet '[Sheet Name]' from file '[Filename]'."
   - **SHOW YOUR WORK**: Explicitly list the rows/categories AND columns you included.
   - **NO REDUNDANT TOTALS**: Do not provide a "Total Sum of Figures" if you have already provided the specific metric (like "Total Sales"). Only provide one final number per metric.
   - **SILENCE ON ERRORS**: Do not explain "I am avoiding double counting by...". Just do it correctly. Do not mention the incorrect sum at all.
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
