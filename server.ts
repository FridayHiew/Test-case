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

// API: Test Connection
app.get('/api/test-connection', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
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
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
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
