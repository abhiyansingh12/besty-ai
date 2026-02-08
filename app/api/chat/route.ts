
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Use require for pdf-parse to avoid type issues if not fully typed
const pdfParse = require('pdf-parse');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Pandas Calculator Service URL (can be overridden via env)
const PANDAS_SERVICE_URL = process.env.PANDAS_SERVICE_URL || 'http://localhost:5001';

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
      auth: {
        persistSession: false
      }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ User authenticated:', user.email);
    console.log('🔍 Query:', message);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        answer: "Please add your OPENAI_API_KEY to .env to enable semantic search."
      });
    }

    // --- 1. DATA PREPARATION ---
    let isStructuredData = false;
    let pandasLoaded = false;
    let dataframeStats: any = null;
    let fileContext = '';

    // Check if we have a specific document to work with
    if (documentId) {
      const { data: doc } = await supabase.from('documents').select('*').eq('id', documentId).single();

      if (doc) {
        console.log(`📂 Processing Document: ${doc.filename} (${doc.file_type})`);

        let storagePath = doc.storage_path;
        if (!storagePath && doc.file_url) {
          const urlParts = doc.file_url.split('/documents/');
          if (urlParts.length > 1) {
            storagePath = decodeURIComponent(urlParts[urlParts.length - 1]);
          }
        }

        if (storagePath) {
          // Download file
          const { data: fileBlob, error: downloadError } = await supabase.storage
            .from('documents')
            .download(storagePath);

          if (!downloadError && fileBlob) {
            const buffer = Buffer.from(await fileBlob.arrayBuffer());
            const lowerExt = (doc.file_type || '').toLowerCase();

            // ===== STRUCTURED DATA HANDLING (Excel / CSV) → PANDAS =====
            if (['xlsx', 'xls', 'csv'].includes(lowerExt)) {
              console.log('📊 Loading into Pandas DataFrame (Source of Truth)...');
              try {
                // Convert buffer to base64 for Python service
                const base64Content = buffer.toString('base64');

                // Send to Pandas service
                const loadResponse = await fetch(`${PANDAS_SERVICE_URL}/load-dataframe`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    document_id: documentId,
                    file_content: base64Content,
                    file_type: lowerExt
                  })
                });

                if (!loadResponse.ok) {
                  throw new Error(`Pandas service error: ${loadResponse.statusText}`);
                }

                const loadResult = await loadResponse.json();

                if (loadResult.success) {
                  isStructuredData = true;
                  pandasLoaded = true;
                  dataframeStats = {
                    rows: loadResult.rows,
                    columns: loadResult.columns,
                    schema: loadResult.schema,
                    sample_data: loadResult.sample_data
                  };
                  console.log(`✅ DataFrame loaded: ${loadResult.rows} rows, ${loadResult.columns.length} columns`);
                }
              } catch (e) {
                console.error('Failed to load into Pandas, falling back to text:', e);
              }
            }

            // ===== UNSTRUCTURED FALLBACK (PDF / Text) → VECTOR DB =====
            if (!isStructuredData) {
              if (lowerExt === 'pdf') {
                try {
                  const pdfData = await pdfParse(buffer);
                  fileContext = pdfData.text;
                } catch (e) { console.error(e); }
              } else {
                // Try to read as text
                try {
                  fileContext = new TextDecoder().decode(buffer);
                } catch (e) { console.error(e); }
              }
              // Truncate if too huge - REDUCED to prevent 429 errors
              // 100k chars is too much (~25k tokens). Reduced to 25k chars (~6k tokens)
              if (fileContext.length > 25000) {
                console.warn(`⚠️ File too large (${fileContext.length} chars), truncating to 25k chars to prevent 429 errors.`);
                fileContext = fileContext.substring(0, 25000) + '...[TRUNCATED]';
              }
            }
          }
        }
      }
    }

    // --- 2. ROUTE A: PANDAS DATAFRAME ENGINE (ChatGPT-like Excel/CSV) ---
    if (isStructuredData && pandasLoaded && dataframeStats) {
      console.log('🚀 Using Pandas Calculator (Source of Truth)');

      const { rows: totalRows, columns, schema, sample_data } = dataframeStats;

      // Build column information for LLM
      const columnInfo = schema.map((col: any) =>
        `  - **${col.column}**: ${col.dtype} (${col.unique_count} unique values, ${col.null_count} nulls)`
      ).join('\n');

      // Sample data preview for LLM context
      const sampleRows = sample_data.slice(0, 10)
        .map((row: any, idx: number) => `Row ${idx + 1}: ${JSON.stringify(row)}`)
        .join('\n');

      // STEP 1: Ask GPT-4o to generate Pandas code with STRICT instructions

      // Identify likely "total" or "sales" columns
      const totalColumns = columns.filter((col: string) =>
        /total|sales|amount|price|sum|revenue/i.test(col)
      );

      const codeGenPrompt = `You are a Python/Pandas code generator. Generate EXACT, DETERMINISTIC code.

## DATASET SCHEMA:
Total Rows: ${totalRows}
${schema.map((col: any) => `Column "${col.column}": ${col.dtype} | ${col.unique_count} unique values | Sample: ${JSON.stringify(col.sample_values)}`).join('\n')}

${totalColumns.length > 0 ? `## IMPORTANT - LIKELY COLUMNS FOR TOTALS/SUMS:
${totalColumns.map((c: string) => `- "${c}"`).join('\n')}
⚠️ When user asks for "total sales", use ONE of these columns above, NOT all numeric columns!\n` : ''}
## SAMPLE DATA (First 10 rows):
${JSON.stringify(sample_data.slice(0, 10), null, 2)}

## USER QUERY:
"${message}"

## CODE GENERATION RULES (FOLLOW EXACTLY):
1. DataFrame variable is: \`df\`
2. Final result MUST be stored in variable: \`result\`
3. Available columns ONLY: ${columns.map((c: string) => `"${c}"`).join(', ')}
4. For text filtering, use CASE-INSENSITIVE matching:
   - Use: df[df['ColumnName'].str.contains('value', case=False, na=False)]
   - For exact: df[df['ColumnName'].str.upper() == 'VALUE']
5. For counting rows: len(df) or df.shape[0]
6. For summing: df['ColumnName'].sum()
7. For grouping: df.groupby('Col')['ValueCol'].sum()
8. NO print statements, NO comments, NO explanations
9. Output ONLY valid Python code

## CRITICAL - COLUMN SELECTION FOR TOTALS/SUMS:
⚠️ When asked for "total sales" or similar:
- ONLY sum ONE specific column (usually the column with "total", "sales", "amount", or "price" in its name)
- DO NOT sum across multiple columns (JAN, FEB, MAR, etc.)
- DO NOT use .sum().sum() (this sums everything twice)
- Pattern: filtered_df['SPECIFIC_COLUMN_NAME'].sum()

## EXAMPLES:
Query: "How many rows for Tennessee?"
Code: result = len(df[df['State'].str.contains('Tennessee', case=False, na=False)])

Query: "Total sales for Tennessee"
Code: result = df[df['State'].str.contains('Tennessee', case=False, na=False)]['Total Price'].sum()

Query: "Tennessee total sales"
Code: result = df[df['SALES REP'].str.contains('Tennessee', case=False, na=False)]['TTL SALES'].sum()

Query: "Count rows and sum sales for Tennessee"
Code: filtered = df[df['State'].str.contains('Tennessee', case=False, na=False)]
result = {'row_count': len(filtered), 'total_sales': filtered['Total Price'].sum()}

Query: "Find Tennessee columns and total"
Code: result = df[df['SALES REP'].str.contains('Tennessee', case=False, na=False)]['TTL SALES'].sum()

NOW GENERATE CODE FOR THE USER QUERY (CODE ONLY, NO MARKDOWN):`;

      console.log('🎯 Generating deterministic Pandas code...');

      const codeResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: codeGenPrompt }],
        temperature: 0,
        seed: 12345, // Fixed seed for deterministic results
      });

      let pandasCode = codeResponse.choices[0].message.content?.trim() || '';

      // Clean up code (remove markdown blocks)
      pandasCode = pandasCode.replace(/```python\n?/g, '').replace(/```\n?/g, '').trim();

      console.log('� Generated Pandas Code:\n', pandasCode);

      try {
        // Security check
        const forbiddenKeywords = /import os|import sys|import subprocess|exec\(|eval\(|__import__|open\(/i;
        if (forbiddenKeywords.test(pandasCode)) {
          throw new Error("Security Alert: Forbidden operations detected in generated code.");
        }

        // STEP 2: Execute Pandas code via Python service (THE CALCULATOR)
        const executeResponse = await fetch(`${PANDAS_SERVICE_URL}/query-natural`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id: documentId,
            pandas_code: pandasCode
          })
        });

        if (!executeResponse.ok) {
          throw new Error(`Pandas execution failed: ${executeResponse.statusText}`);
        }

        const executionResult = await executeResponse.json();

        if (!executionResult.success) {
          throw new Error(executionResult.error || 'Unknown execution error');
        }

        console.log('✅ Pandas Result:', JSON.stringify(executionResult.result));

        // STEP 3: Ask GPT-4o to explain results (THE INTERPRETER - NOT Calculator)
        const explanationPrompt = `You are explaining PRE-COMPUTED results from a Pandas analysis.

## USER'S ORIGINAL QUESTION:
"${message}"

## PANDAS CODE THAT WAS EXECUTED:
\`\`\`python
${pandasCode}
\`\`\`

## COMPUTED RESULT (SOURCE OF TRUTH):
\`\`\`json
${JSON.stringify(executionResult.result, null, 2)}
\`\`\`

## Dataset Context:
- Total rows in dataset: ${totalRows}
- Available columns: ${columns.join(', ')}

## YOUR TASK:
Present these EXACT results in a clear, professional, and user-friendly manner. 

**CRITICAL RULES**:
1. **Filter Noise**: Ignore 'nan', 'None', or 'null' values unless explicitly asked for.
2. **Format Lists**: If the result is a list/dictionary, present it as a neat bulleted list or a Markdown table. Do not dump raw text.
3. **Limit Output**: If a list has >10 items, show the top 10 and say "...and [X] more".
4. **Numbers**: Format large numbers with commas (e.g., 1,000) and currency with symbols ($) if the context implies money.
5. **Direct Answer**: Start with the answer immediately. Avoid "Based on your data...". Just state the finding.

**FORMAT**:
- Use **bold keys** for metrics.
- Use Markdown tables for multi-column data.
- Keep it conversational but concise.`;

        const explanationResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: explanationPrompt }],
          temperature: 0.1,
          seed: 12345, // Consistency
        });

        return NextResponse.json({
          answer: explanationResponse.choices[0].message.content,
          chunks: [{
            content: `Python Code:\n${pandasCode}\n\nResult:\n${JSON.stringify(executionResult.result, null, 2)}`
          }],
          metadata: {
            execution_method: 'pandas',
            code_executed: pandasCode
          }
        });

      } catch (error: any) {
        console.error('❌ Pandas Execution Error:', error);

        // Fallback: Ask GPT-4o to analyze manually
        const fallbackPrompt = `The automated analysis failed. Please analyze this dataset manually:

**Dataset**: ${totalRows} rows with columns: ${columns.join(', ')}

**Column Details**:
${columnInfo}

**Sample data (first 10 rows)**:
${sampleRows}

**Question**: ${message}

Provide your best analysis based on the information available.`;

        const fallbackResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: fallbackPrompt }],
          temperature: 0.1,
        });

        return NextResponse.json({
          answer: fallbackResponse.choices[0].message.content,
          metadata: {
            execution_method: 'fallback',
            error: error.message
          }
        });
      }
    }

    // --- 3. ROUTE B: UNSTRUCTURED / RAG (Default) ---
    console.log('📚 Using Semantic Search Route');

    let context = fileContext || '';
    let chunks: any[] = [];

    // If we don't have full file context in memory, fetch chunks via Vector Search
    if (!context) {
      console.log('🔍 Vector Searching...');
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message,
      });
      const embedding = embeddingResponse.data[0].embedding;

      const { data: searchResults, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: 0.1,
        match_count: 5,
        filter_document_id: documentId,
      });

      if (searchResults) {
        chunks = searchResults;
        context = chunks.map((c: any) => c.content).join('\n\n');
      }
    }

    const systemPrompt = `You are a helpful AI Assistant.
    Use the provided context to answer the user's question clearly.
    If the answer is not in the context, say so.
    
    CONTEXT:
    ${context}`;

    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    return NextResponse.json({
      answer: chatResponse.choices[0].message.content,
      chunks
    });

  } catch (err: any) {
    console.error('Error in chat API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
