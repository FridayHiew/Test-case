import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Helper function to generate content with exponential backoff and high-availability model fallbacks
async function generateContentWithRetry(ai: any, params: {
  contents: any;
  config?: any;
  preferredModel?: string;
}) {
  const models = [
    params.preferredModel || 'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite'
  ];

  let lastError: any = null;

  for (const model of models) {
    let delay = 1000;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Gemini API] Attempting generation with model "${model}" (attempt ${attempt}/${maxRetries})...`);
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        console.log(`[Gemini API] Generation succeeded with model "${model}" on attempt ${attempt}.`);
        return response;
      } catch (error: any) {
        lastError = error;
        const errMsg = error.message || String(error);
        const statusCode = error.status || error.statusCode || (error.error && error.error.code);
        
        const isTransient = statusCode === 503 || 
                            statusCode === 429 || 
                            errMsg.includes('503') || 
                            errMsg.includes('429') || 
                            errMsg.toLowerCase().includes('high demand') || 
                            errMsg.toLowerCase().includes('temporary') ||
                            errMsg.toLowerCase().includes('unavailable') ||
                            errMsg.toLowerCase().includes('rate limit');

        if (isTransient && attempt < maxRetries) {
          console.warn(`[Gemini API] Transient error on model "${model}" (attempt ${attempt}/${maxRetries}): ${errMsg}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          console.warn(`[Gemini API] Error on model "${model}" (attempt ${attempt}/${maxRetries}): ${errMsg}. Proceeding to fallback options...`);
          break; // Break current retry loop to switch model
        }
      }
    }
  }

  throw lastError || new Error('All Gemini model generation attempts failed.');
}

// API: Test Connection
app.get('/api/test-connection', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const response = await generateContentWithRetry(ai, {
      preferredModel: 'gemini-3.6-flash',
      contents: 'Ping',
    });
    if (response.text) {
      res.json({ success: true, message: 'Built-in Gemini API connected successfully!' });
    } else {
      res.json({ success: false, error: 'Empty response received from Gemini.' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// API: Generate Test Cases
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, temperature } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const ai = getGeminiClient();
    const response = await generateContentWithRetry(ai, {
      preferredModel: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || 'You are an expert QA and test engineer.',
        temperature: temperature || 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['test_cases', 'coverage'],
          properties: {
            test_cases: {
              type: Type.ARRAY,
              description: 'List of generated test cases',
              items: {
                type: Type.OBJECT,
                required: ['id', 'title', 'type', 'preconditions', 'steps', 'expected'],
                properties: {
                  id: { type: Type.STRING, description: 'Test Case ID (e.g. TC-001, TC-002)' },
                  title: { type: Type.STRING, description: 'Title or short description of the test case' },
                  type: { 
                    type: Type.STRING, 
                    description: 'Type of test case: positive, negative, boundary, security, performance' 
                  },
                  preconditions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Preconditions needed before starting the test steps'
                  },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Precise, ordered list of test steps'
                  },
                  expected: { type: Type.STRING, description: 'Expected result' }
                }
              }
            },
            coverage: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Summary of test coverage or requirements addressed'
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('No output text generated from Gemini.');
    }

    // Try parsing the JSON to verify it
    const jsonResult = JSON.parse(resultText);
    res.json({ success: true, data: jsonResult });
  } catch (error: any) {
    console.error('Gemini generation error:', error);
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// API: Generate E2E Test Cases from Mermaid Flowchart
app.post('/api/generate-e2e', async (req, res) => {
  try {
    const { name, description, mermaidFlowchart, features, temperature } = req.body;
    if (!mermaidFlowchart) {
      return res.status(400).json({ error: 'Mermaid flowchart is required.' });
    }

    const ai = getGeminiClient();
    const prompt = `
You are a Staff QA Engineer specializing in End-to-End (E2E) Journey Validation.
The user is testing an E2E system flow called "${name}".
Journey Description: "${description}"

Here is the Mermaid flowchart representing the operational states and execution branches of this journey:
\`\`\`mermaid
${mermaidFlowchart}
\`\`\`

Available Specs/Features metadata context (use these to resolve field names, preconditions, and outputs if referenced in the flowchart):
${JSON.stringify(features || [], null, 2)}

TASK:
1. Parse the Mermaid flowchart text. Trace and identify the major unique flow paths/execution sequences from start to finish.
2. Generate EXACTLY one highly detailed, granular, fully descriptive E2E test case for EACH distinct flow path.
3. Every E2E test case MUST be written like a professional, concrete test case:
   - NO VAGUE GENERALIZATIONS: Do not say "Perform login at LOGIN-001" or "carry forward token".
   - CONCRETE TEST DATA: Provide exact, realistic mock values for every single input field mentioned in the features. E.g., user_id='usr-9021', username='e2e_auditor', order_id='f47ac10b-58cc-4372-a567-0e02b2c3d479', amount=149.99, currency='USD', risk_fingerprint='7bc56c12d2bf40d348a28e9cfb3e10ab', safety_buffer_units=5, etc.
   - DETAILED TEST STEPS: Break down each transition step-by-step. For each step, explicitly mention:
     * The target feature ID (e.g., [LOGIN-001] or [PAYMENT-001])
     * The specific input fields being filled and their exact test values
     * The action triggered (e.g. "Post JSON payload to authentication router")
     * The exact output parameters captured for the next transition
   - EXPLICIT EXPECTATIONS: For each step and the final outcome, describe the precise output contract keys and expected values (e.g., "Expected output status='updated', charge_status='completed', escrow_release_epoch=1700000000").
4. For each E2E test case, provide:
   - id: Unique path ID (e.g. "E2E-TC-001", "E2E-TC-002")
   - name: A descriptive name of the specific branch path (e.g. "Happy-path Standard Checkout", "Escrow Hold Trigger and Fraud Intercept")
   - flowPath: Synthesized transition sequence representation (e.g., "LOGIN-001 -> CART-001 -> PAYMENT-001")
   - preconditions: Unified setups, mock variables, and state requirements needed before starting the sequence.
   - steps: Highly concrete, sequential action-by-action steps detailing inputs, mock values, API endpoints, payload properties, and handoffs.
   - expected: Comprehensive final system state, exact output schemas, database assertions, and UI confirmations.

Ensure that each flow path represents exactly 1 coherent, high-quality, professional-grade test case.
`;

    const response = await generateContentWithRetry(ai, {
      preferredModel: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction: `You are an elite E2E systems architect. Trace the Mermaid flowchart, identify all main and alternative paths, and generate exactly 1 logical E2E test case per path in the requested JSON structure.`,
        temperature: temperature || 0.3,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['test_cases'],
          properties: {
            test_cases: {
              type: Type.ARRAY,
              description: 'Generated smart E2E test cases, exactly one per flow path',
              items: {
                type: Type.OBJECT,
                required: ['id', 'name', 'flowPath', 'preconditions', 'steps', 'expected'],
                properties: {
                  id: { type: Type.STRING, description: 'Test Case ID (e.g. E2E-TC-001)' },
                  name: { type: Type.STRING, description: 'Descriptive path name' },
                  flowPath: { type: Type.STRING, description: 'Chained features flow representation' },
                  preconditions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Setup and prerequisite state variables'
                  },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Sequential execution steps tracing the flowchart nodes'
                  },
                  expected: { type: Type.STRING, description: 'Unified final state validation result' }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error('No output text generated from Gemini.');
    }

    const jsonResult = JSON.parse(resultText);
    res.json({ success: true, data: jsonResult });
  } catch (error: any) {
    console.error('Gemini E2E generation error:', error);
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

// Setup Vite Dev server / production server assets serving
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Running in Development mode with Vite Middleware');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Running in Production mode serving built assets');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
