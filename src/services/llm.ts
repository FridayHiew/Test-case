import { AIConfig, Feature, TestResult } from '../types';

// Helper to safely verify WebGPU hardware adapter
export async function checkWebGPUAvailability(): Promise<{ supported: boolean; reason?: string }> {
  if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
    return {
      supported: false,
      reason: 'Your browser does not support the WebGPU API. WebLLM browser execution requires modern Chrome, Edge, or Safari with hardware acceleration enabled.'
    };
  }

  try {
    const gpu = (navigator as any).gpu;
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        reason: 'WebGPU interface detected, but no suitable hardware adapter was found (GPU drivers disabled or running inside a sandboxed iframe). You can switch to Cloud Gemini or local Ollama mode.'
      };
    }

    return { supported: true };
  } catch (err: any) {
    return {
      supported: false,
      reason: `WebGPU hardware check error: ${err?.message || 'GPU driver not supported or device initialization failed.'}`
    };
  }
}

export class LLMClient {
  private config: AIConfig;
  private webLlmEngine: any = null;
  private onProgress: ((text: string, progress: number) => void) | null = null;

  constructor(config: AIConfig) {
    this.config = config;
  }

  // Set progress callback for WebLLM model loading progress
  setProgressCallback(callback: (text: string, progress: number) => void) {
    this.onProgress = callback;
  }

  // Update configuration dynamically
  updateConfig(config: AIConfig) {
    this.config = config;
    // Reset engine if config model changes
    this.webLlmEngine = null;
  }

  // Get or initialize the browser WebLLM engine
  private async getWebLlmEngine(): Promise<any> {
    if (this.webLlmEngine) {
      return this.webLlmEngine;
    }

    const check = await checkWebGPUAvailability();
    if (!check.supported) {
      throw new Error(check.reason || 'Current browser or system does not support WebGPU.');
    }

    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    
    this.webLlmEngine = await CreateMLCEngine(this.config.webllmModel, {
      initProgressCallback: (report: any) => {
        const text = report.text || '';
        let percent = 0;
        
        // Match percentage format from MLC report
        const percentMatch = text.match(/(\d+)%/);
        const ratioMatch = text.match(/\[(\d+)\/(\d+)\]/);
        
        if (percentMatch) {
          percent = parseInt(percentMatch[1], 10);
        } else if (ratioMatch) {
          percent = Math.round((parseInt(ratioMatch[1], 10) / parseInt(ratioMatch[2], 10)) * 100);
        } else if (text.includes('Loading model')) {
          percent = 95;
        } else if (text.includes('Finish loading')) {
          percent = 100;
        }
        
        if (this.onProgress) {
          this.onProgress(text, percent);
        }
      }
    });

    return this.webLlmEngine;
  }

  // Test connection to the selected LLM backend
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (this.config.aiMode === 'webllm') {
      try {
        const check = await checkWebGPUAvailability();
        if (!check.supported) {
          return {
            success: false,
            message: check.reason || 'No available WebGPU hardware adapter detected.'
          };
        }
        if (this.onProgress) this.onProgress('Fetching WebAssembly runtime and loading Wasm core...', 5);
        const engine = await this.getWebLlmEngine();
        if (this.onProgress) this.onProgress('Local WebLLM engine ready!', 100);
        return {
          success: true,
          message: `Browser WebLLM engine ready! Loaded model: [${this.config.webllmModel}]`
        };
      } catch (err: any) {
        const errMsg = err.message || '';
        const isShaderError = errMsg.includes('ShaderModule') || 
                              errMsg.includes('index_kernel') || 
                              errMsg.includes('compute stage') || 
                              errMsg.includes('pipeline');
        
        if (isShaderError) {
          return {
            success: false,
            message: `Failed to initialize local WebLLM engine: WebGPU Shader Compilation Error (index_kernel validation failure).

This is a known driver/platform compatibility issue with compiling WebAssembly model shaders on specific GPUs.

💡 RECOMMENDATION:
Switch to "Built-in Gemini Cloud" or "Local Ollama" in the "Engine Settings" tab at the top. They are completely unaffected by WebGPU driver bugs.`
          };
        }
        return {
          success: false,
          message: `Failed to initialize local WebLLM engine: ${err.message || 'Network error or insufficient GPU memory.'}`
        };
      }
    } else if (this.config.aiMode === 'offline') {
      try {
        const response = await fetch(`${this.config.ollamaUrl}/api/tags`, {
          method: 'GET',
        });
        if (response.ok) {
          const data = await response.json();
          const models = data.models || [];
          const modelNames = models.map((m: any) => m.name).join(', ');
          return {
            success: true,
            message: `Successfully connected to local Ollama! Detected models: [${modelNames || 'No models installed'}]`
          };
        }
        return {
          success: false,
          message: 'Failed to connect to local Ollama. Please ensure service is running via "ollama serve".'
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Ollama connection failed: ${err.message || 'Connection refused. Ensure Ollama is running and allows CORS requests.'}`
        };
      }
    } else {
      // Online mode: Built-in Gemini or custom OpenAI
      const isBuiltIn = !this.config.openaiApiKey || this.config.openaiApiKey.trim() === '';
      if (isBuiltIn) {
        try {
          const response = await fetch('/api/test-connection');
          const data = await response.json();
          if (response.ok && data.success) {
            return { success: true, message: data.message };
          }
          return {
            success: false,
            message: `Built-in Gemini connection error: ${data.error || 'Server error'}`
          };
        } catch (err: any) {
          return {
            success: false,
            message: `Network error connecting to built-in cloud API: ${err.message}`
          };
        }
      } else {
        // Custom OpenAI / DeepSeek API
        try {
          const response = await fetch(`${this.config.openaiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.openaiApiKey}`
            },
            body: JSON.stringify({
              model: this.config.openaiModel,
              messages: [{ role: 'user', content: 'Ping' }],
              max_tokens: 10
            })
          });

          if (response.ok) {
            return {
              success: true,
              message: `Successfully connected to custom API (${this.config.openaiModel})!`
            };
          }
          const errData = await response.json().catch(() => ({}));
          return {
            success: false,
            message: `Cloud API connection error (${response.status}): ${errData.error?.message || response.statusText}`
          };
        } catch (err: any) {
          return {
            success: false,
            message: `Network error connecting to cloud API: ${err.message}`
          };
        }
      }
    }
  }

  // Generate test cases based on feature metadata and user natural language input
  async generate(feature: Feature, userInput: string): Promise<TestResult> {
    const prompt = this.buildPrompt(feature, userInput);
    const systemInstruction = this.buildSystemInstruction();

    if (this.config.aiMode === 'webllm') {
      return this.generateWebLlm(prompt, systemInstruction);
    } else if (this.config.aiMode === 'offline') {
      return this.generateOffline(prompt, systemInstruction);
    } else {
      const isBuiltIn = !this.config.openaiApiKey || this.config.openaiApiKey.trim() === '';
      if (isBuiltIn) {
        return this.generateBuiltIn(prompt, systemInstruction);
      } else {
        return this.generateOnlineCustom(prompt, systemInstruction);
      }
    }
  }

  // Generate prompt for the model
  private buildPrompt(feature: Feature, userInput: string): string {
    return `
Please generate structured test cases for the following software feature specification:

### Feature ID: ${feature.id}
### Feature Name: ${feature.name} (v${feature.version})
### Description: ${feature.description}

### Input Fields:
${JSON.stringify(feature.input_fields, null, 2)}

### Business Rules:
${feature.business_rules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n')}

### Expected Outputs & Contract:
${JSON.stringify(feature.output, null, 2)}

${feature.dependencies && feature.dependencies.length > 0 ? `### Dependent Feature IDs: ${feature.dependencies.join(', ')}` : ''}

### Additional Custom Test Scope (User Request):
"${userInput || 'Generate comprehensive positive tests, negative exception tests, and boundary value tests'}"

Ensure the generated test cases thoroughly cover all input field constraints and business rules above, especially the custom test scope.
You MUST respond strictly in valid JSON format without any surrounding commentary.
`;
  }

  // Build the strict system instruction
  private buildSystemInstruction(): string {
    return `
You are a senior Lead QA & Test Automation Engineer. Your task is to design a comprehensive, logically rigorous test suite based on the provided feature metadata and user requirements.

You MUST reply strictly in JSON format with two top-level fields:
1. "test_cases": Array of test case objects. Each object must contain:
   - "id": String unique identifier, e.g., "TC-001", "TC-002"
   - "title": String concise test title indicating the test point
   - "type": String, must be one of: "positive", "negative", "boundary", "security", "performance"
   - "preconditions": Array of strings listing preconditions
   - "steps": Array of strings listing detailed, sequential execution steps
   - "expected": String describing the clear expected outcome
2. "coverage": Array of strings summarizing the business rules, boundary conditions, and security aspects covered.

Rules:
- Ensure valid JSON syntax with double quotes for strings and keys.
- Do NOT wrap response in extra markdown or commentary outside the JSON.
- Test cases must be actionable, clear, and unambiguous.
`;
  }

  // Local Browser WebLLM generation
  private async generateWebLlm(prompt: string, systemInstruction: string): Promise<TestResult> {
    try {
      if (this.onProgress) this.onProgress('Loading local model inside browser (First download takes ~30s)...', 5);
      const engine = await this.getWebLlmEngine();
      
      if (this.onProgress) this.onProgress('Model ready! Inferring using GPU hardware acceleration...', 100);
      
      const response = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const rawText = response.choices[0].message.content || '';
      return this.parseAndCleanJson(rawText);
    } catch (err: any) {
      const errMsg = err.message || '';
      const isShaderError = errMsg.includes('ShaderModule') || 
                            errMsg.includes('index_kernel') || 
                            errMsg.includes('compute stage') || 
                            errMsg.includes('pipeline');
      
      if (isShaderError) {
        throw new Error(`Browser WebLLM generation failed: WebGPU Shader Compilation Error (index_kernel validation failure). 
        
This is a known compatibility issue between certain GPU/graphics driver configurations and local model shader execution.

💡 QUICK REMEDIES:
1. Switch to "Built-in Gemini Cloud" mode (Highly recommended! Free, zero setup, fast, and completely bypasses local hardware issues).
2. Go to the "Engine Settings" tab and select an alternative model size (e.g., Qwen2.5-0.5B is highly lightweight and compatible).
3. Try running the app in a different WebGPU-enabled browser or updating your GPU drivers.`);
      }
      throw new Error(`Browser WebLLM generation failed: ${err.message || 'WebGPU timeout or insufficient VRAM memory.'}`);
    }
  }

  // Local Ollama generation
  private async generateOffline(prompt: string, systemInstruction: string): Promise<TestResult> {
    try {
      const response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.ollamaModel,
          prompt: prompt,
          system: systemInstruction,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          },
          format: 'json'
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama response error (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.response;
      return this.parseAndCleanJson(rawText);
    } catch (err: any) {
      throw new Error(`Local Ollama generation failed. Ensure Ollama service is running with model [${this.config.ollamaModel}]. Error: ${err.message}`);
    }
  }

  // Built-in Gemini generation
  private async generateBuiltIn(prompt: string, systemInstruction: string): Promise<TestResult> {
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          systemInstruction: systemInstruction,
          temperature: this.config.temperature
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server request failed');
      }

      return data.data;
    } catch (err: any) {
      throw new Error(`Cloud Gemini generation failed: ${err.message}`);
    }
  }

  // Custom OpenAI/DeepSeek generation
  private async generateOnlineCustom(prompt: string, systemInstruction: string): Promise<TestResult> {
    try {
      const response = await fetch(`${this.config.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.openaiApiKey}`
        },
        body: JSON.stringify({
          model: this.config.openaiModel,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          response_format: { type: 'json_object' }
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || response.statusText);
      }

      const data = await response.json();
      const rawText = data.choices[0].message.content;
      return this.parseAndCleanJson(rawText);
    } catch (err: any) {
      throw new Error(`Cloud API (${this.config.openaiModel}) generation failed: ${err.message}`);
    }
  }

  // Helper to parse and clean response JSON string
  private parseAndCleanJson(rawText: string): TestResult {
    try {
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```')) {
        const lines = cleaned.split('\n');
        cleaned = lines.filter(line => !line.trim().startsWith('```')).join('\n');
      }
      cleaned = cleaned.trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.test_cases || !Array.isArray(parsed.test_cases)) {
        throw new Error('Returned JSON missing "test_cases" array.');
      }

      return parsed as TestResult;
    } catch (err: any) {
      console.error('Failed to parse LLM Response:', rawText, err);
      throw new Error(`Unable to parse JSON returned by model: ${err.message || 'Formatting error'}.`);
    }
  }
}

// Generate secure SHA-256 cache key using browser subtle crypto
export async function generateCacheKey(featureId: string, userInput: string): Promise<string> {
  const normalizedInput = userInput.trim().toLowerCase();
  const data = `${featureId}:${normalizedInput}`;
  const msgUint8 = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
