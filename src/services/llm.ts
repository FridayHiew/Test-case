import { AIConfig, Feature, TestResult, BaseCaseTemplate, E2ETestCase } from '../types';

export const DEFAULT_BASE_TEMPLATES: BaseCaseTemplate[] = [
  {
    id: 'input-field-validation-baseline',
    title: 'Verify Input Parameter Specifications for "{field_name}"',
    type: 'boundary',
    enabled: true,
    caseCount: 1,
    preconditions: [
      '{dependencies}',
      'Target input parameter "{field_name}" (type: {field_type}) is rendered and interactable.',
      'Field Purpose Reasoning: {field_description}'
    ],
    steps: [
      '1. Focus input parameter "{field_name}".',
      '2. Requiredness Check: Test empty submission behavior (Mandatory vs Optional).',
      '3. Data Type Compliance: Attempt mismatched values against data type "{field_type}".',
      '4. Boundary Limits Verification: Test min/max range limits, lengths, and format constraints.',
      '5. Custom Constraint Compliance: Verify custom validation rules if specified.',
      '6. Functional Reasoning: Verify behavior matches described parameter purpose.'
    ],
    expected: 'System strictly validates input parameter "{field_name}", enforcing type safety, boundary limits, required constraints, custom validation rules, and description reasoning.',
    aiPrompt: 'Validate edge case parameter values, special character sanitization, and boundary limits for this input field.'
  },
  {
    id: 'business-rule-baseline',
    title: 'Verify Business Rule Enforcement: "{rule}"',
    type: 'business_rule',
    enabled: true,
    caseCount: 1,
    preconditions: [
      '{dependencies}',
      'System state satisfies prerequisite conditions for rule: "{rule}".'
    ],
    steps: [
      '1. Initialize form/workflow parameters associated with business rule: "{rule}".',
      '2. Trigger execution path to evaluate condition: "{rule}".',
      '3. Verify system enforces business rule behavior and records output state.'
    ],
    expected: 'System correctly evaluates and enforces business rule "{rule}", preserving data integrity and state transition rules.',
    aiPrompt: 'Include specific edge case validations and boundary conditions associated with this business rule.'
  },
  {
    id: 'ai-light-business-logic',
    title: 'Verify custom business workflows and E2E business constraints for "{feature_name}"',
    type: 'positive',
    enabled: true,
    caseCount: 1,
    preconditions: [
      '{dependencies}',
      'Ensure the active environment state satisfies general specifications.'
    ],
    steps: [
      '1. Initialize the workflow interface for "{feature_name}".',
      '2. Submit inputs adhering to the custom business rules and functional constraints: {business_rules}.',
      '3. Verify that the state outputs successfully map to: {output_names}.'
    ],
    expected: 'The application computes the target output values exactly as specified by the business rules and updates the system state.',
    aiPrompt: 'Focus on verifying end-to-end integration flows and complex state transitions across system components.'
  }
];

// Helper to safely verify WebGPU hardware adapter
export async function checkWebGPUAvailability(): Promise<{ 
  supported: boolean; 
  reason?: string;
  adapterInfo?: {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  };
  limits?: {
    maxStorageBufferBindingSize?: number;
    maxComputeWorkgroupStorageSize?: number;
  };
}> {
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

    let adapterInfo = {};
    if (adapter.requestAdapterInfo) {
      try {
        const reqInfo = await adapter.requestAdapterInfo();
        adapterInfo = {
          vendor: reqInfo.vendor || '',
          architecture: reqInfo.architecture || '',
          device: reqInfo.device || '',
          description: reqInfo.description || ''
        };
      } catch (e) {
        // requestAdapterInfo might reject in some strict iframes
      }
    }

    const limits = {
      maxStorageBufferBindingSize: adapter.limits?.maxStorageBufferBindingSize || 0,
      maxComputeWorkgroupStorageSize: adapter.limits?.maxComputeWorkgroupStorageSize || 0,
    };

    return { 
      supported: true,
      adapterInfo,
      limits
    };
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

  // Hard reset of the local browser engine
  async resetEngine(): Promise<void> {
    if (this.webLlmEngine) {
      try {
        if (typeof this.webLlmEngine.unload === 'function') {
          await this.webLlmEngine.unload();
        }
      } catch (err) {
        console.warn('Error unloading WebLLM engine:', err);
      }
    }
    this.webLlmEngine = null;
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

  // Helper to dynamically compile placeholders inside baseline templates
  private compileTemplateValue(val: string, feature: Feature, requiredNames: string, outputNames: string): string {
    let result = val;
    result = result.replace(/{feature_id}/g, feature.id.toUpperCase());
    result = result.replace(/{feature_name}/g, feature.name);
    result = result.replace(/{required_inputs}/g, requiredNames || 'standard inputs');
    result = result.replace(/{output_names}/g, outputNames);

    // Resolve dependencies placeholder
    if (result.includes('{dependencies}')) {
      if (feature.dependencies && feature.dependencies.length > 0) {
        result = result.replace(/{dependencies}/g, `Verification of prerequisite dependencies is complete: ${feature.dependencies.join(', ')} must be fully functional.`);
      } else {
        result = result.replace(/{dependencies}/g, 'User is authenticated with active session privileges.');
      }
    }

    return result;
  }

  // Programmatic, high-performance code-level test case generator
  // Handles the MAIN/HEAVY LOAD: Generating exactly 1 detailed test case per input field,
  // validating all parameters (lengths, datatype, validations, etc.) and reasoning with descriptions.
  public generateCodeLevelTestCases(feature: Feature): TestResult {
    const test_cases: any[] = [];
    const coverage: string[] = [];

    const fields = feature.input_fields || [];

    if (fields.length === 0) {
      // Fallback if no fields are defined
      test_cases.push({
        id: `TC-${feature.id.toUpperCase()}-NO-FIELDS`,
        title: `Verify initial configuration and load response of "${feature.name}"`,
        type: 'positive',
        preconditions: [
          feature.dependencies && feature.dependencies.length > 0
            ? `Verification of prerequisite dependencies is complete: ${feature.dependencies.join(', ')} must be fully functional.`
            : 'Active user session is verified.',
          'Subsystem is loaded and fully operational.'
        ],
        steps: [
          `1. Navigate to the "${feature.name}" feature workspace.`,
          `2. Check that the interface initializes without errors or pending locks.`
        ],
        expected: `System loads successfully. Description context: "${feature.description}" is fully compliant.`
      });
      coverage.push('Initial load and setup validation');
    } else {
      // Loop over each field and generate exactly 1 comprehensive validation test case!
      fields.forEach((field, fIdx) => {
        const fieldNameUpper = field.name.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const id = `TC-${feature.id.toUpperCase()}-${fieldNameUpper || fIdx + 1}`;
        const title = `[Field Validation] Comprehensive validation for field "${field.name}"`;
        
        // Build robust preconditions
        const preconditions: string[] = [
          feature.dependencies && feature.dependencies.length > 0
            ? `Dependencies are healthy: ${feature.dependencies.join(', ')} are operational.`
            : 'User is authenticated with an active form session.',
          `Target input field "${field.name}" (type: ${field.type}) is rendered and interactable.`
        ];

        // If description is present, add reasoning about how the system works
        if (field.description) {
          preconditions.push(`Field Purpose Reasoning (from description): ${field.description}`);
        } else {
          preconditions.push(`Field Purpose Reasoning: Validates data entry for parameter "${field.name}".`);
        }

        // Build exhaustive steps to check datatype, lengths, empty values, and validation rules
        const steps: string[] = [
          `1. Focus the input field "${field.name}" inside the "${feature.name}" workspace.`
        ];

        // Required check
        if (field.required) {
          steps.push(`2. Requiredness Check: Leave "${field.name}" completely blank and attempt validation or submit. Expected: Submission blocks, highlighting "${field.name}" as mandatory.`);
        } else {
          steps.push(`2. Optionality Check: Leave "${field.name}" blank and submit. Expected: System accepts empty input without warning.`);
        }

        // Data type check
        let wrongTypeSample = 'invalid_text';
        if (field.type === 'number') {
          wrongTypeSample = '"not-a-number" text';
        } else if (field.type === 'boolean') {
          wrongTypeSample = '"some_string" instead of true/false';
        } else if (field.type === 'array') {
          wrongTypeSample = 'a scalar string';
        } else if (field.type === 'object') {
          wrongTypeSample = 'primitive string';
        }
        steps.push(`3. Data Type Compliance: Type mismatch trial by sending ${wrongTypeSample} to "${field.name}". Expected: Rejects value or forces conversion to conform with data type "${field.type}".`);

        // Length/Range boundary checks
        if (field.type === 'string') {
          const minVal = field.min !== undefined ? field.min : 1;
          const maxVal = field.max !== undefined ? field.max : 255;
          steps.push(`4. Length Boundary Validation: Write text string of length ${minVal - 1} (below min length constraint of ${minVal}) and length ${maxVal + 1} (above max length constraint of ${maxVal}). Expected: Validation alerts trigger, blocking the inputs.`);
          steps.push(`5. Length Acceptance Verification: Write a compliant string of length exactly ${minVal} and length ${maxVal}. Expected: Successfully verified and accepted.`);
        } else if (field.type === 'number') {
          const minVal = field.min !== undefined ? field.min : 0;
          const maxVal = field.max !== undefined ? field.max : 999999;
          steps.push(`4. Value Boundary Range Validation: Enter numeric value ${minVal - 1} (below min constraint of ${minVal}) and numeric value ${maxVal + 1} (above max constraint of ${maxVal}). Expected: Rejection warnings block submission.`);
          steps.push(`5. Value Acceptance Verification: Input compliant boundary values (exactly ${minVal} and ${maxVal}). Expected: Accepted by numerical engine.`);
        } else {
          steps.push(`4. General bounds verification check: Validate elements with respect to limits, sizes, and formats.`);
        }

        // Custom validation check
        if (field.validation) {
          steps.push(`6. Custom Constraint Compliance: Attempt inputs that violate specified validation rules "${field.validation}". Expected: System blocks submission and displays specific validation warnings.`);
        }

        // Use field description for user logic reasoning step
        if (field.description) {
          steps.push(`7. Logical Intent Reasoning: Check functional behavior based on described purpose ("${field.description}") to ensure business operations map accurately.`);
        }

        // Expected output details
        const expected = `The system successfully enforces all constraints on input parameter "${field.name}". It blocks empty states if required, restricts inputs based on type "${field.type}" and size limits, applies standard rule validations${field.validation ? ` ("${field.validation}")` : ''}, and matches the logical design expectations outlined in the field description.`;

        test_cases.push({
          id,
          title,
          type: field.required ? 'negative' : 'boundary',
          preconditions,
          steps,
          expected
        });

        coverage.push(`Input field "${field.name}" comprehensive specifications validation`);
      });
    }

    // Generate 1 test case per business rule defined in feature specifications!
    const rules = feature.business_rules || [];
    if (rules.length > 0) {
      const outputNamesStr = Object.keys(feature.output || {}).join(', ') || 'expected system outputs';
      rules.forEach((rule, rIdx) => {
        const id = `TC-${feature.id.toUpperCase()}-RULE-${rIdx + 1}`;
        const title = `[Business Rule] Verify compliance for rule: "${rule}"`;
        
        const preconditions: string[] = [
          feature.dependencies && feature.dependencies.length > 0
            ? `Dependencies are operational: ${feature.dependencies.join(', ')} must be in a ready state.`
            : 'Active user session and feature workspace are loaded.',
          `Rule Context: "${rule}"`,
          `System Assumptions: ${feature.assumptions || 'Default environment conditions apply.'}`
        ];

        const steps: string[] = [
          `1. Initialize the "${feature.name}" workspace transaction.`,
          `2. Formulate input values specifically to evaluate business rule: "${rule}".`,
          `3. Trigger execution path and observe rule processing.`,
          `4. Inspect output fields [${outputNamesStr}] and verify state persistence.`
        ];

        const expected = `The application strictly enforces business rule: "${rule}". State transitions and output contracts [${outputNamesStr}] complete as expected without specification violations.`;

        test_cases.push({
          id,
          title,
          type: 'business_rule',
          preconditions,
          steps,
          expected
        });

        coverage.push(`Business rule #${rIdx + 1} ("${rule}") unit test validation`);
      });
    }

    return { test_cases, coverage };
  }

  // Generate test cases based on feature metadata and user natural language input
  async generate(feature: Feature, userInput: string): Promise<TestResult> {
    // 1. Programmatically generate robust, high-quality base test cases instantly
    const programmaticResult = this.generateCodeLevelTestCases(feature);

    try {
      // 2. Build the lightweight, optimized AI prompt requesting only custom/complex rule validations
      const prompt = this.buildOptimizedPrompt(feature, userInput);
      const systemInstruction = this.buildOptimizedSystemInstruction();

      let aiResult: TestResult;

      if (this.config.aiMode === 'webllm') {
        aiResult = await this.generateWebLlm(prompt, systemInstruction);
      } else if (this.config.aiMode === 'offline') {
        aiResult = await this.generateOffline(prompt, systemInstruction);
      } else {
        const isBuiltIn = !this.config.openaiApiKey || this.config.openaiApiKey.trim() === '';
        if (isBuiltIn) {
          aiResult = await this.generateBuiltIn(prompt, systemInstruction);
        } else {
          aiResult = await this.generateOnlineCustom(prompt, systemInstruction);
        }
      }

      // Merge the programmatic test suite with the AI's specialized rule/scope validations
      const combinedTestCases = [...programmaticResult.test_cases, ...aiResult.test_cases];
      const combinedCoverage = [...new Set([...programmaticResult.coverage, ...aiResult.coverage])];

      // Ensure unique IDs across all merged test cases
      const uniqueTestCases = combinedTestCases.map((tc, index) => ({
        ...tc,
        id: `TC-${feature.id.toUpperCase()}-${String(index + 1).padStart(3, '0')}`
      }));

      return {
        test_cases: uniqueTestCases,
        coverage: combinedCoverage
      };
    } catch (err: any) {
      console.warn('AI generation failed or hit local memory/quota limitations. Falling back to robust code-level suite:', err);
      // Perfect fallback: return programmatic cases so the application never fails
      return programmaticResult;
    }
  }

  // Generate prompt for the model
  private buildOptimizedPrompt(feature: Feature, userInput: string): string {
    const limit = this.config.aiCaseLimit && this.config.aiCaseLimit > 0 ? this.config.aiCaseLimit : 2;
    const depsContext = feature.dependencies && feature.dependencies.length > 0
      ? `\n### Upstream Module Dependencies to assume:\n${feature.dependencies.map(dep => `- Prerequisite completed state established by parent module "${dep}" must be verified.`).join('\n')}`
      : '';

    const inputsContext = feature.input_fields && feature.input_fields.length > 0
      ? `\n### Form Inputs & Validation Criteria:\n${feature.input_fields.map(f => `- \`${f.name}\` (type: ${f.type}${f.required ? ', required: true' : ''}${f.description ? `, description: "${f.description}"` : ''}${f.validation ? `, validation constraints: "${f.validation}"` : ''})`).join('\n')}`
      : '';

    const assumptionsContext = feature.assumptions
      ? `\n### Assumptions & Preconditions:\n${feature.assumptions}`
      : '';

    const referenceContext = feature.reference
      ? `\n### External References / System Maps:\n${feature.reference}`
      : '';

    // Get active programmatic template titles so AI doesn't duplicate them
    const activeTemplates = this.config.programmaticTemplates && this.config.programmaticTemplates.length > 0
      ? this.config.programmaticTemplates
      : DEFAULT_BASE_TEMPLATES;
    const activeProgrammaticTitles = activeTemplates
      .filter(t => t.enabled)
      .map(t => `- ${t.title.replace(/{feature_name}/g, feature.name)}`)
      .join('\n');

    // Extract custom AI prompt directives from baseline templates
    const activeAiPrompts = activeTemplates
      .filter(t => t.enabled && t.aiPrompt && t.aiPrompt.trim() !== '')
      .map(t => `- Template "${t.title.replace(/{feature_name}/g, feature.name)}": ${t.aiPrompt}`)
      .join('\n');

    const aiPromptContext = activeAiPrompts
      ? `\n### Baseline AI Prompt Guidance (Special Scenario Directives):\n${activeAiPrompts}\n*Special Requirement*: Ensure the generated test cases incorporate the special scenario directives specified in the baseline templates above.\n`
      : '';

    return `
Please generate exactly ${limit} highly specialized, advanced test cases that target the unique business rules or custom user specifications of this feature.

The following test scenario types are already covered programmatically at the code level. Do NOT generate duplicates of these:
${activeProgrammaticTitles || '- Standard basic checks'}
${aiPromptContext}
### Feature: ${feature.name}
### Description: ${feature.description}${depsContext}${inputsContext}${assumptionsContext}${referenceContext}

### Business Rules to cover:
${feature.business_rules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n')}

### Target Custom User Test Scope:
"${userInput || 'Test advanced business rule interactions'}"

Generate ONLY ${limit} high-value, deep test cases. Reply strictly in JSON format.
`;
  }

  // Build the strict system instruction
  private buildOptimizedSystemInstruction(): string {
    const limit = this.config.aiCaseLimit && this.config.aiCaseLimit > 0 ? this.config.aiCaseLimit : 2;
    return `
You are a senior QA & Test Automation Architect. Generate exactly ${limit} highly specialized test cases focusing purely on intricate business-logic interactions, custom edge cases, or the user's specific test scope.
Do NOT generate basic, simple validations because those are already handled programmatically at the code level.

You MUST reply strictly in JSON format with two top-level fields:
{
  "test_cases": [
    {
      "id": "TC-SPEC-1",
      "title": "Concise test title focusing on business rules or custom scope",
      "type": "positive", // or "negative", "boundary", "security", "performance"
      "preconditions": ["List 1-2 preconditions"],
      "steps": ["Step 1...", "Step 2..."],
      "expected": "Expected behavior matching specifications"
    }
  ],
  "coverage": ["Summarize business rules covered by these specific ${limit} test cases"]
}

Rules:
- Ensure valid JSON with double quotes for strings and keys.
- Do NOT wrap response in extra markdown or commentary outside the JSON.
- Limit output to exactly ${limit} specialized test cases to keep processing extremely fast.
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
    let cleaned = rawText.trim();
    
    // 1. Strip markdown code blocks if any
    if (cleaned.startsWith('```')) {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        cleaned = match[1].trim();
      } else {
        const lines = cleaned.split('\n');
        cleaned = lines.filter(line => !line.trim().startsWith('```')).join('\n').trim();
      }
    }

    // 2. If it still doesn't look like JSON, try to extract from the first { to the last }
    // or from the first [ to the last ]
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      const braceStartIndex = cleaned.indexOf('{');
      const braceEndIndex = cleaned.lastIndexOf('}');
      const bracketStartIndex = cleaned.indexOf('[');
      const bracketEndIndex = cleaned.lastIndexOf(']');

      if (braceStartIndex !== -1 && braceEndIndex !== -1 && (bracketStartIndex === -1 || braceStartIndex < bracketStartIndex)) {
        cleaned = cleaned.substring(braceStartIndex, braceEndIndex + 1);
      } else if (bracketStartIndex !== -1 && bracketEndIndex !== -1) {
        cleaned = cleaned.substring(bracketStartIndex, bracketEndIndex + 1);
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err: any) {
      // 3. Fallback: try to clean up trailing commas which break standard JSON.parse
      try {
        const relaxedCleaned = cleaned
          .replace(/,(\s*[\]}])/g, '$1') // remove trailing commas
          .replace(/[\u201C\u201D]/g, '"'); // replace smart quotes
        parsed = JSON.parse(relaxedCleaned);
      } catch (innerErr) {
        console.error('Failed to parse raw LLM response as JSON. Raw output:', rawText);
        throw new Error(`Unable to parse JSON returned by model: ${err.message || 'Formatting error'}.`);
      }
    }

    // 4. Normalize the parsed structure into a valid TestResult
    const result: TestResult = {
      test_cases: [],
      coverage: []
    };

    if (Array.isArray(parsed)) {
      // Direct array returned by the model
      result.test_cases = parsed;
    } else if (parsed && typeof parsed === 'object') {
      // Check for common variations of 'test_cases'
      const possibleCaseKeys = ['test_cases', 'testCases', 'cases', 'testcases', 'test-cases', 'results', 'data', 'list'];
      let foundCases = false;

      for (const key of possibleCaseKeys) {
        if (parsed[key] && Array.isArray(parsed[key])) {
          result.test_cases = parsed[key];
          foundCases = true;
          break;
        }
      }

      // If still not found, search the object keys for any array of objects
      if (!foundCases) {
        for (const key of Object.keys(parsed)) {
          if (Array.isArray(parsed[key]) && parsed[key].length > 0 && typeof parsed[key][0] === 'object') {
            result.test_cases = parsed[key];
            foundCases = true;
            break;
          }
        }
      }

      // Set coverage
      if (parsed.coverage && Array.isArray(parsed.coverage)) {
        result.coverage = parsed.coverage.map((c: any) => String(c));
      } else if (parsed.coverage && typeof parsed.coverage === 'string') {
        result.coverage = [parsed.coverage];
      }
    } else {
      throw new Error('Model output is not a valid JSON object or array.');
    }

    // 5. Clean, sanitize and validate each test case item to guarantee UI compatibility
    if (!Array.isArray(result.test_cases)) {
      result.test_cases = [];
    }

    result.test_cases = result.test_cases.map((tc: any, index: number) => {
      // Make sure we have some base object
      const safeTc = typeof tc === 'object' && tc !== null ? tc : {};
      
      // Ensure preconditions is an array of strings
      let finalPreconditions: string[] = [];
      if (Array.isArray(safeTc.preconditions)) {
        finalPreconditions = safeTc.preconditions.map((p: any) => String(p));
      } else if (typeof safeTc.preconditions === 'string') {
        finalPreconditions = [safeTc.preconditions];
      }

      // Ensure steps is an array of strings
      let finalSteps: string[] = [];
      if (Array.isArray(safeTc.steps)) {
        finalSteps = safeTc.steps.map((s: any) => String(s));
      } else if (typeof safeTc.steps === 'string') {
        finalSteps = [safeTc.steps];
      }

      // Ensure type fits 'positive' | 'negative' | 'boundary' | 'security' | 'performance'
      const rawType = String(safeTc.type || 'positive').toLowerCase();
      let finalType: 'positive' | 'negative' | 'boundary' | 'security' | 'performance' = 'positive';
      if (['positive', 'negative', 'boundary', 'security', 'performance'].includes(rawType)) {
        finalType = rawType as any;
      }

      return {
        id: String(safeTc.id || `tc-${index + 1}`),
        title: String(safeTc.title || `Test Case ${index + 1}`),
        type: finalType,
        preconditions: finalPreconditions,
        steps: finalSteps.length > 0 ? finalSteps : ['Perform integration tests'],
        expected: String(safeTc.expected || 'System performs as expected.')
      };
    });

    // Populate default coverage if missing
    if (result.coverage.length === 0) {
      result.coverage = ['General specification coverage verification'];
    }

    return result;
  }

  // Generate E2E Test Cases from a Mermaid Flowchart using Gemini
  async generateE2E(name: string, description: string, mermaidFlowchart: string, features: Feature[]): Promise<E2ETestCase[]> {
    try {
      const response = await fetch('/api/generate-e2e', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          mermaidFlowchart,
          features,
          temperature: this.config.temperature
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server E2E generation request failed');
      }

      return data.data.test_cases || [];
    } catch (err: any) {
      console.error('Failed to generate smart E2E cases:', err);
      throw new Error(`E2E flow analysis failed: ${err.message}`);
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
