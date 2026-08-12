import { AIConfig, Feature, TestResult, BaseCaseTemplate, E2ETestCase } from '../types';

export const DEFAULT_BASE_TEMPLATES: BaseCaseTemplate[] = [
  {
    id: 'happy-path',
    title: 'Verify happy-path execution of "{feature_name}" with fully compliant inputs',
    type: 'positive',
    enabled: true,
    caseCount: 2,
    preconditions: [
      '{dependencies}',
      'Subsystem "{feature_name}" is loaded and fully responsive.'
    ],
    steps: [
      '1. Navigate to the "{feature_name}" workspace interface.',
      '2. Fill in all required fields ({required_inputs}) with valid mock values.',
      '3. Submit the transaction or click the action button.'
    ],
    expected: 'The system processes the request successfully. Output contract [{output_names}] is generated correctly according to the specifications.'
  },
  {
    id: 'input-validation',
    title: 'Verify input validation locks when required fields are left blank',
    type: 'negative',
    enabled: true,
    caseCount: 1,
    preconditions: [
      'Subsystem "{feature_name}" is loaded.',
      'User is viewing the input form fields.'
    ],
    steps: [
      '1. Intentionally clear all required fields: {required_inputs}.',
      '2. Attempt to trigger the action or submit the form.'
    ],
    expected: 'The system halts execution, displays high-visibility inline validation warnings, and prevents form submission.'
  },
  {
    id: 'boundary-check',
    title: 'Verify system boundary checks and graceful error handling',
    type: 'boundary',
    enabled: true,
    caseCount: 1,
    preconditions: [
      'Active database connectivity is verified.',
      'User is on the entry form for "{feature_name}".'
    ],
    steps: [
      '{bounds_steps}',
      '2. Attempt submission.'
    ],
    expected: 'The system handles the boundary ranges gracefully, blocks bad data, and alerts the user with helpful feedback.'
  },
  {
    id: 'security-guard',
    title: 'Verify input sanitization against SQL Injection and Scripting (XSS) vectors',
    type: 'security',
    enabled: true,
    caseCount: 1,
    preconditions: [
      'Security filters and middlewares are active for "{feature_name}".'
    ],
    steps: [
      '1. Insert special script payloads (e.g. <script>alert(1)</script>) and query clauses (e.g. \' OR 1=1 --) into text inputs.',
      '2. Attempt submission.'
    ],
    expected: 'The application sterilizes HTML/SQL special characters, filters the request safely, or handles the inputs as harmless plain text.'
  },
  {
    id: 'concurrency-double-submission',
    title: 'Verify transaction integrity of {feature_name} under concurrent double-submission',
    type: 'performance',
    enabled: true,
    caseCount: 2,
    preconditions: [
      'Subsystem {feature_name} is fully active and loaded.',
      'Prerequisite state variables from [{dependencies}] are established.',
      'A valid test subject is available with all required transaction prerequisites satisfied.'
    ],
    steps: [
      '1. Populate all required field values: {required_inputs}.',
      '2. Prepare two identical requests using the same input payload and transaction context.',
      '3. Dispatch both requests concurrently within a 50ms execution window.',
      '4. Repeat the operation using two rapid user-interface submission events.',
      '5. Capture HTTP responses, transaction identifiers, persistence state, and generated outputs.'
    ],
    expected: 'The system processes the transaction at most once. Exactly one request creates or commits the intended state change, while the duplicate request is rejected, deduplicated, serialized, or returned as an idempotent response. The final state contains no duplicate transaction and conforms exactly to {output_names}.'
  },
  {
    id: 'rbac-authorization-enforcement',
    title: 'Verify role-based authorization enforcement for {feature_name} using unauthorized and authorized roles',
    type: 'security',
    enabled: true,
    caseCount: 2,
    preconditions: [
      'Subsystem {feature_name} is deployed and accessible.',
      'Prerequisite services from [{dependencies}] are available.',
      'At least one authorized role and one unauthorized role are configured.',
      'Valid authentication credentials or session contexts exist for each test role.'
    ],
    steps: [
      '1. Populate all required field values: {required_inputs}.',
      '2. Authenticate using the authorized role and invoke the {feature_id} operation.',
      '3. Record the response status, response body, and resulting system state.',
      '4. Authenticate using the unauthorized role and submit the same operation.',
      '5. Repeat the unauthorized attempt using direct API invocation rather than the user interface.',
      '6. Compare authorization behavior across all execution paths.'
    ],
    expected: 'The authorized role is permitted to execute {feature_name} and receives a response conforming exactly to {output_names}. The unauthorized role is consistently denied with an appropriate authorization error. Direct API access cannot bypass RBAC controls, and no protected state, sensitive output, or partial transaction is exposed to the unauthorized role.'
  },
  {
    id: 'offline-sync-conflict-recovery',
    title: 'Verify offline-mode synchronization and conflict recovery for {feature_name}',
    type: 'negative',
    enabled: true,
    caseCount: 2,
    preconditions: [
      'Subsystem {feature_name} is operational before network disconnection.',
      'Prerequisite services from [{dependencies}] are synchronized.',
      'A valid local client state exists and contains all required configuration.',
      'The client supports offline persistence and deferred synchronization.'
    ],
    steps: [
      '1. Populate all required field values: {required_inputs}.',
      '2. Disable network connectivity after the client has completed its initial synchronization.',
      '3. Execute the {feature_id} operation while the client is offline.',
      '4. Confirm that the operation is stored in the local pending-operation queue.',
      '5. Modify the same logical entity from another synchronized client or server-side process.',
      '6. Restore network connectivity and trigger synchronization.',
      '7. Capture synchronization results, conflict information, retry behavior, and final persisted state.'
    ],
    expected: 'Offline operations are retained without data loss and are not falsely reported as permanently synchronized. When connectivity returns, the client retries synchronization safely, detects conflicting server state, and applies the configured conflict-resolution strategy without creating duplicate transactions. The final synchronized state is internally consistent and conforms to {output_names}.'
  },
  {
    id: 'localization-special-character-boundary',
    title: 'Verify {feature_name} handles localized text, Unicode characters, and special-character boundary conditions',
    type: 'boundary',
    enabled: true,
    caseCount: 2,
    preconditions: [
      'Subsystem {feature_name} is active and configured for all supported locales.',
      'Prerequisite services from [{dependencies}] are available.',
      'Character encoding is configured for Unicode input and output.',
      'The test environment can switch between supported localization settings.'
    ],
    steps: [
      '1. Populate all required field values: {required_inputs}.',
      '2. Replace applicable textual values with supported multilingual characters, including Latin, Chinese, Malay, accented characters, and mixed-language content.',
      '3. Execute the operation using valid Unicode punctuation, whitespace, symbols, and supported special characters.',
      '4. Execute {bounds_steps}.',
      '5. Repeat the operation using characters at the minimum and maximum permitted field lengths.',
      '6. Include visually similar characters, combining characters, and characters outside the primary test locale where Unicode input is permitted.',
      '7. Validate the persisted values and returned response under each supported locale.'
    ],
    expected: 'All valid localized and Unicode input is accepted, preserved, normalized only where explicitly required, and returned without corruption, truncation, encoding errors, or unexpected character substitution. Values exceeding defined limits are rejected according to the field validation rules. The response structure remains compliant with {output_names} regardless of active locale.'
  },
  {
    id: 'latency-timeout-degradation',
    title: 'Verify {feature_name} remains resilient during dependency latency degradation and timeout conditions',
    type: 'performance',
    enabled: true,
    caseCount: 2,
    preconditions: [
      'Subsystem {feature_name} is deployed and operational.',
      'Prerequisite services from [{dependencies}] are available for controlled latency injection.',
      'Configured request, connection, and dependency timeout thresholds are known.',
      'Monitoring is enabled for request duration, timeout events, retries, and downstream failures.'
    ],
    steps: [
      '1. Populate all required field values: {required_inputs}.',
      '2. Execute the baseline {feature_id} operation under normal dependency latency.',
      '3. Introduce controlled latency below the configured timeout threshold and repeat the operation.',
      '4. Increase dependency latency to exceed the configured timeout threshold.',
      '5. Repeat the operation using multiple concurrent requests during the degraded period.',
      '6. Observe retry, circuit-breaker, fallback, cancellation, and resource-release behavior.',
      '7. Restore normal dependency latency and execute the operation again.',
      '8. Capture response time, status, timeout behavior, system state, and output payload for every scenario.'
    ],
    expected: 'The operation completes normally within the expected latency threshold under healthy conditions. During degradation, requests exceeding configured timeout limits fail deterministically without leaving partial transactions, leaked resources, or indefinite processing. Retry and fallback behavior follows configured policies, excessive retries are prevented, and recovery occurs automatically after dependencies return to normal. Successful responses conform exactly to {output_names}.'
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
  public generateCodeLevelTestCases(feature: Feature): TestResult {
    const test_cases: any[] = [];
    const coverage: string[] = [
      'Code-level inputs and structural verification',
      'Security-focused validation guards',
      'Transaction lifecycle validations',
      'Boundary boundary conditions checks'
    ];

    const requiredInputs = (feature.input_fields || []).filter(f => f.required);
    const requiredNames = requiredInputs.map(f => `"${f.name}"`).join(', ');
    const outputNames = Object.keys(feature.output || {}).map(key => `"${key}"`).join(', ') || 'expected action state';

    const boundsInputs = (feature.input_fields || []).filter(f => f.min !== undefined || f.max !== undefined || f.format !== undefined || f.type !== 'string');
    const boundStepsList = boundsInputs.length > 0
      ? boundsInputs.map((f, idx) => {
          const limitsText = [
            f.min !== undefined ? `min: ${f.min}` : '',
            f.max !== undefined ? `max: ${f.max}` : '',
            f.format ? `format: ${f.format}` : ''
          ].filter(Boolean).join(', ');
          return `${idx + 1}. Insert out-of-bounds or mismatching type values in "${f.name}" (${f.type}${limitsText ? `, constraints: ${limitsText}` : ''}).`;
        })
      : ['1. Input excessively large strings or extreme numerical boundary values into form inputs.'];

    // Select active templates from config or fall back to DEFAULT_BASE_TEMPLATES
    const activeTemplates = this.config.programmaticTemplates && this.config.programmaticTemplates.length > 0
      ? this.config.programmaticTemplates
      : DEFAULT_BASE_TEMPLATES;

    let index = 1;
    for (const template of activeTemplates) {
      if (!template.enabled) continue;

      // Skip input-validation if no required inputs are present
      if (template.id === 'input-validation' && requiredInputs.length === 0) {
        continue;
      }

      const count = template.caseCount && template.caseCount > 0 ? template.caseCount : 1;

      for (let cIdx = 0; cIdx < count; cIdx++) {
        // Compile preconditions
        let compiledPreconditions: string[] = [];
        for (const pre of template.preconditions) {
          if (pre.includes('{dependencies}') && feature.dependencies && feature.dependencies.length > 0) {
            compiledPreconditions.push(
              `Verification of prerequisite dependencies is complete: ${feature.dependencies.join(', ')} must be fully functional.`,
              `Upstream database states established by parent models [${feature.dependencies.join(', ')}] are accessible.`
            );
          } else {
            compiledPreconditions.push(this.compileTemplateValue(pre, feature, requiredNames, outputNames));
          }
        }

        // Compile steps
        let compiledSteps: string[] = [];
        for (const step of template.steps) {
          if (step.includes('{bounds_steps}')) {
            compiledSteps.push(...boundStepsList);
          } else {
            compiledSteps.push(this.compileTemplateValue(step, feature, requiredNames, outputNames));
          }
        }

        // Compile expected
        let compiledExpected = this.compileTemplateValue(template.expected, feature, requiredNames, outputNames);

        // Customize the title and contents dynamically depending on the case index to keep them distinct!
        let customizedTitle = this.compileTemplateValue(template.title, feature, requiredNames, outputNames);
        
        if (count > 1) {
          if (template.type === 'positive') {
            // Happy path sub-scenarios
            if (cIdx === 0) {
              customizedTitle = `[Standard Scenario] ${customizedTitle}`;
            } else if (feature.business_rules && feature.business_rules[cIdx - 1]) {
              const rule = feature.business_rules[cIdx - 1];
              customizedTitle = `[Rule Compliance] Verify happy path under rule: "${rule}"`;
              compiledPreconditions.push(`Precondition check for rule: "${rule}" is satisfied.`);
              compiledSteps.push(`4. Complete operation while ensuring conformity with the business rule guidelines: "${rule}".`);
              compiledExpected += ` Verifies compliance with rule: "${rule}".`;
            } else {
              customizedTitle = `[Variant ${cIdx + 1}] ${customizedTitle} (Alternate workflow integration)`;
              compiledSteps.push(`4. Perform the operational flow using alternative non-required fields schema.`);
            }
          } else if (template.type === 'negative') {
            // Negative validation scenarios
            if (cIdx === 0) {
              customizedTitle = `[All Fields Empty] ${customizedTitle}`;
            } else if (requiredInputs[cIdx - 1]) {
              const targetField = requiredInputs[cIdx - 1];
              customizedTitle = `[Missing Required Field] Verify form block when leaving "${targetField.name}" blank`;
              compiledSteps = [
                `1. Populate all inputs with valid credentials EXCEPT the required "${targetField.name}" field.`,
                `2. Clear "${targetField.name}" completely.`,
                `3. Attempt form submission or transaction click.`
              ];
              compiledExpected = `Form validation triggers inline warnings indicating that the required "${targetField.name}" field is missing or unpopulated.`;
            } else {
              customizedTitle = `[Negative Flow Variant] ${customizedTitle} (Type coercion rejection)`;
            }
          } else if (template.type === 'boundary') {
            // Boundary validation scenarios
            if (cIdx === 0) {
              customizedTitle = `[General Limit Ranges] ${customizedTitle}`;
            } else if (boundsInputs[cIdx - 1]) {
              const boundedField = boundsInputs[cIdx - 1];
              customizedTitle = `[Boundary Specific] Verify limit bounds guard on input field "${boundedField.name}"`;
              const limitDetails = [
                boundedField.min !== undefined ? `value less than minimum limit: ${boundedField.min}` : '',
                boundedField.max !== undefined ? `value greater than maximum limit: ${boundedField.max}` : '',
                boundedField.format ? `mismatching format structure: ${boundedField.format}` : ''
              ].filter(Boolean).join(' or ');
              compiledSteps = [
                `1. Input an out-of-bounds ${limitDetails} in the "${boundedField.name}" field.`,
                `2. Attempt transaction submission.`
              ];
              compiledExpected = `The input parser rejects submission and flags the "${boundedField.name}" field with a high-visibility boundary range alert.`;
            } else {
              customizedTitle = `[Limit Out-of-Bounds] ${customizedTitle} (Scenario variation)`;
            }
          } else if (template.type === 'security') {
            if (cIdx === 0) {
              customizedTitle = `[SQL Injection Guard] ${customizedTitle}`;
            } else if (cIdx === 1) {
              customizedTitle = `[XSS Injection Guard] Verify scripts execution is fully sanitized inside textual input blocks`;
              compiledSteps = [
                `1. Enter malicious cross-site scripting vectors (e.g. <img src=x onerror=alert(1)> or onload javascript triggers) into text fields.`,
                `2. Submit request.`
              ];
              compiledExpected = `HTML-escaping modules sterilize the tags, rendering the string strictly as harmless plain text data safely.`;
            } else {
              customizedTitle = `[Credential Spoofing Guard] Verify authorization token validation checks and session security filters`;
              compiledSteps = [
                `1. Formulate a payload with corrupted session cookie headers or forged JWT authorization tokens.`,
                `2. Send request to the application router.`,
              ];
              compiledPreconditions = ['Middlewares and signature authenticators are active.'];
              compiledExpected = `The application router blocks execution, returns an HTTP 401/403 status, and initiates an audit warning log.`;
            }
          } else if (template.type === 'performance') {
            if (cIdx === 0) {
              customizedTitle = `[Load Guard] ${customizedTitle}`;
            } else {
              customizedTitle = `[Concurrent Spikes] Verify performance and persistence rate-limits under heavy client concurrent requests`;
              compiledSteps = [
                `1. Establish continuous parallel transaction request queues.`,
                `2. Flood the endpoint with high volumes of simultaneous clicks.`
              ];
              compiledExpected = `The application server rate-limiter triggers HTTP 429 warnings, keeping the thread pools safe and responsive.`;
            }
          }
        }

        test_cases.push({
          id: `TC-${feature.id.toUpperCase()}-${String(index).padStart(3, '0')}`,
          title: customizedTitle,
          type: template.type,
          preconditions: compiledPreconditions,
          steps: compiledSteps,
          expected: compiledExpected
        });

        index++;
      }
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

    // Get active programmatic template titles so AI doesn't duplicate them
    const activeTemplates = this.config.programmaticTemplates && this.config.programmaticTemplates.length > 0
      ? this.config.programmaticTemplates
      : DEFAULT_BASE_TEMPLATES;
    const activeProgrammaticTitles = activeTemplates
      .filter(t => t.enabled)
      .map(t => `- ${t.title.replace(/{feature_name}/g, feature.name)}`)
      .join('\n');

    return `
Please generate exactly ${limit} highly specialized, advanced test cases that target the unique business rules or custom user specifications of this feature.

The following test scenario types are already covered programmatically at the code level. Do NOT generate duplicates of these:
${activeProgrammaticTitles || '- Standard basic checks'}

### Feature: ${feature.name}
### Description: ${feature.description}${depsContext}

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
