const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Read .env file manually since dotenv is missing
const envPath = path.resolve(__dirname, '.env');
const envConfig = fs.readFileSync(envPath, 'utf8');
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        process.env[key.trim()] = value.trim();
    }
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
    console.log("🤖 Setting up Betsy AI Assistant...");

    try {
        const assistant = await openai.beta.assistants.create({
            name: "Betsy Data Analyst",
            instructions: `You are a Data Analyst. For every user query involving files, you must first list the files in the current thread. 
If the query involves numbers or data comparison, you MUST write and run Python code to read the files and perform the analysis. 
Never guess values.
When analyzing data:
1. List the files available.
2. Inspect the file structure (headers, sheet names) using Python before assuming any schema.
3. PRIORITIZE sheets named "Summary" or "Dashboard" for total calculations.
4. **COLUMN SELECTION**: Never add "Sales" and "Payments" together. Report them separately.
5. **CALCULATION ACCURACY & CIRCULAR SUM PREVENTION**:
   - **THE "EITHER/OR" RULE**: EITHER sum the monthly columns OR read the Total column. NEVER BOTH.
   - If a "Total" column exists, use it directly. Do not re-sum.
   - **SILENT CORRECTION**: If you see a Total column, use it. Do not calculate or report the sum of [Months + Total].
6. **FILTERING & CONTEXT DRIFT PREVENTION**:
   - **STRICT STRING MATCHING**: If the user asks for "Atlanta", filter for **Exact Match == "Atlanta"**.
   - DO NOT use partial matches or "Contains".
7. **NO REDUNDANT TOTALS**: Do not provide a "Total Sum of Figures" if you have already provided the specific metric.
8. If the user asks for analysis, write Python code to load the file and perform calculations.
9. **USER-FRIENDLY FORMATTING**:
   - **NO LaTeX**: Do not use [ ] or \\( \\) for math. Use plain text: "$100 + $200 = $300".
   - **Simple Language**: Avoid "Let's clarify..." or "Based on rows...". Just give the answer clearly.
If the user asks about a PDF, read its text content or compare it with other data.
`,
            tools: [{ type: "code_interpreter" }, { type: "file_search" }],
            model: "gpt-4o",
        });

        console.log(`✅ Assistant Created! ID: ${assistant.id}`);
        console.log(`\n👉 Please add this to your .env.local file:\nNEXT_PUBLIC_OPENAI_ASSISTANT_ID=${assistant.id}\n`);

        // Optional: Update .env automatically if possible, but safer to ask user or just use it in this session if I could.
        // For now, I'll just print it.

    } catch (error) {
        console.error("Error creating assistant:", error);
    }
}

main();
