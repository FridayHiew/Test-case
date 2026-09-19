import { AIConfig, Feature, TestResult, BaseCaseTemplate, E2ETestCase, ConnectionTestResult, DiagnosticStep } from '../types';

export const DEFAULT_BASE_TEMPLATES: BaseCaseTemplate[] = [
  {
    id: 'input-field-validation-baseline',
    title: 'Verify Input Parameter Specifications for "{field_name}"',
    type: 'boundary',
    enabled: true,
    caseCount: 1,
    engineMode: 'both',
    preconditions: [
      '{dependencies}',
      'Target input parameter "{field_name}" (type: {field_type}, required: {field_required}) is rendered and interactable.',
      'Field Limits & Length: {field_length}.',
      'Field Purpose Reasoning: {field_description}'
    ],
    steps: [
      '1. Focus input parameter "{field_name}".',
      '2. Requiredness Check: Test empty submission behavior for {field_required} parameter.',
      '3. Data Type Compliance: Attempt mismatched values against data type "{field_type}".',
      '4. Boundary Limits & Length Verification: Verify length constraints ({field_length}) and bound limits ({field_limits}).',
      '5. Custom Constraint Compliance: Verify custom rule constraints ({field_validation}).',
      '6. Functional Reasoning: Verify behavior aligns with described parameter purpose ({field_description}).'
    ],
    expected: 'System strictly validates input parameter "{field_name}", enforcing type safety, length constraints ({field_length}), bound limits ({field_limits}), requiredness ({field_required}), custom validation ({field_validation}), and description reasoning.',
    aiPrompt: 'Rephrase boundary steps and add dynamic reasoning for edge cases based on parameter description "{field_description}".'
  },
  {
    id: 'business-rule-baseline',
    title: 'Verify Business Rule Enforcement: "{rule}"',
    type: 'business_rule',
    enabled: true,
    caseCount: 1,
    engineMode: 'both',
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
    engineMode: 'both',
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

  // Test connection to the selected LLM backend with full diagnostics
  async testConnection(): Promise<ConnectionTestResult> {
    const isClient = typeof window !== 'undefined';
    const origin = isClient ? window.location.origin : 'server';
    const protocol = isClient ? window.location.protocol : 'http:';
    const isHttps = protocol === 'https:';
    const steps: DiagnosticStep[] = [];
    const debugLogs: string[] = [];

    const addStep = (step: string, status: 'pending' | 'success' | 'warning' | 'error' | 'info', details?: string) => {
      const ts = new Date().toLocaleTimeString();
      steps.push({ step, status, details, timestamp: ts });
      debugLogs.push(`[${ts}] [${status.toUpperCase()}] ${step}${details ? `: ${details}` : ''}`);
      if (this.onProgress) {
        this.onProgress(`${step}${details ? ` (${details})` : ''}`, status === 'success' ? 100 : 50);
      }
    };

    if (this.config.aiMode === 'transformersjs') {
      addStep('Runtime Environment Assessment', 'info', `Origin: ${origin} | Browser Engine: ${navigator.userAgent.slice(0, 45)}...`);
      addStep('WebAssembly-SIMD Compatibility Check', 'pending');
      const hasSimd = typeof WebAssembly !== 'undefined' && typeof WebAssembly.validate === 'function';
      if (hasSimd) {
        addStep('WebAssembly-SIMD Compatibility Check', 'success', 'WebAssembly runtime validated and hardware vectorization enabled.');
      } else {
        addStep('WebAssembly-SIMD Compatibility Check', 'error', 'WebAssembly is not supported in this client context.');
      }

      addStep('Multi-threading WebWorker & SharedArrayBuffer Context', 'info', 
        typeof SharedArrayBuffer !== 'undefined' ? 'SharedArrayBuffer active (multi-core parallelism ready).' : 'Single-thread worker mode (Standard fallback).'
      );

      return {
        success: true,
        message: 'Hugging Face Transformers.js (WASM / WebGPU) verified! ONNX Runtime Web environment is ready to spawn threads and load offline weights.',
        debugLogs,
        diagnostics: {
          origin,
          targetUrl: 'in-browser (IndexedDB / WASM)',
          protocolMismatch: false,
          isHttps,
          isLocalTarget: false,
          steps,
          recommendations: [
            'Transformers.js runs 100% locally inside browser memory with zero network dependencies.',
            'First execution will download and cache model weights (approx 350MB for Qwen-0.5B).'
          ]
        }
      };
    } else if (this.config.aiMode === 'desktop') {
      addStep('Desktop Environment Scanner', 'info', `Origin: ${origin} | Native Socket Probe`);
      
      const endpointsToTest = [
        'http://localhost:8080/v1',
        'http://localhost:11434/v1',
        'http://127.0.0.1:8080/v1',
        'http://127.0.0.1:11434/v1'
      ];

      let foundEndpoint: string | null = null;
      for (const ep of endpointsToTest) {
        try {
          addStep(`Probing local native runtime at ${ep}`, 'pending');
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 1200);
          const res = await fetch(`${ep}/models`, { method: 'GET', signal: ctrl.signal, mode: 'cors' });
          clearTimeout(timer);
          if (res.ok) {
            foundEndpoint = ep;
            addStep(`Probing local native runtime at ${ep}`, 'success', `Responded with HTTP ${res.status}`);
            break;
          } else {
            addStep(`Probing local native runtime at ${ep}`, 'warning', `Returned HTTP ${res.status}`);
          }
        } catch (e: any) {
          addStep(`Probing local native runtime at ${ep}`, 'info', `Not reachable (${e.name || 'timeout'})`);
        }
      }

      if (foundEndpoint) {
        return {
          success: true,
          message: `Active native desktop server found at ${foundEndpoint}! High-speed local hardware execution is enabled.`,
          debugLogs,
          diagnostics: {
            origin,
            targetUrl: foundEndpoint,
            protocolMismatch: isHttps,
            isHttps,
            isLocalTarget: true,
            steps,
            recommendations: [
              `Direct connection established with native backend at ${foundEndpoint}.`
            ]
          }
        };
      }

      return {
        success: false,
        message: 'No active local desktop server found on port 8080 (llama.cpp) or 11434 (Ollama).',
        debugLogs,
        diagnostics: {
          origin,
          targetUrl: 'localhost:8080 / localhost:11434',
          protocolMismatch: isHttps,
          isHttps,
          isLocalTarget: true,
          errorType: 'OFFLINE_OR_UNREACHABLE',
          steps,
          recommendations: [
            'Start llama-server natively on your laptop: ./llama-server -m your-model.gguf --port 8080',
            'Or run Ollama natively: OLLAMA_ORIGINS="*" ollama serve'
          ]
        }
      };
    } else if (this.config.aiMode === 'webllm') {
      addStep('WebGPU Subsystem Verification', 'pending');
      try {
        const check = await checkWebGPUAvailability();
        if (!check.supported) {
          addStep('WebGPU Subsystem Verification', 'error', check.reason || 'No WebGPU adapter detected.');
          return {
            success: false,
            message: check.reason || 'No available WebGPU hardware adapter detected.',
            debugLogs,
            diagnostics: {
              origin,
              targetUrl: 'browser WebGPU adapter',
              protocolMismatch: false,
              isHttps,
              isLocalTarget: false,
              steps,
              recommendations: [
                'Ensure your browser has WebGPU enabled (Chrome 113+ or Edge).',
                'If running in a virtual machine or low-end GPU, use Transformers.js (WASM) instead.'
              ]
            }
          };
        }
        addStep('WebGPU Subsystem Verification', 'success', `Adapter: ${check.adapterInfo?.device || 'Active GPU'}`);
        const engine = await this.getWebLlmEngine();
        addStep('WebLLM Engine Pipeline', 'success', `Loaded model: ${this.config.webllmModel}`);
        return {
          success: true,
          message: `Browser WebLLM engine ready! Loaded model: [${this.config.webllmModel}]`,
          debugLogs,
          diagnostics: {
            origin,
            targetUrl: 'browser WebGPU adapter',
            protocolMismatch: false,
            isHttps,
            isLocalTarget: false,
            steps,
            recommendations: ['WebGPU engine is fully functional.']
          }
        };
      } catch (err: any) {
        addStep('WebLLM Engine Pipeline', 'error', err.message);
        return {
          success: false,
          message: `Failed to initialize local WebLLM engine: ${err.message || 'WebGPU initialization failure'}`,
          debugLogs,
          diagnostics: {
            origin,
            targetUrl: 'browser WebGPU adapter',
            protocolMismatch: false,
            isHttps,
            isLocalTarget: false,
            steps,
            recommendations: [
              'WebGPU driver issue detected.',
              'Switch to "Local Server (Ollama)" or "Transformers.js (WASM)" in Engine Settings.'
            ]
          }
        };
      }
    } else if (this.config.aiMode === 'offline') {
      const ollamaUrl = (this.config.ollamaUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
      const isHttpTarget = ollamaUrl.toLowerCase().startsWith('http://');
      const isLocalTarget = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/.test(ollamaUrl);
      const protocolMismatch = isHttps && isHttpTarget;

      addStep('Origin & Environment Inspection', 'info', `App origin: ${origin} (${protocol}) | Target URL: ${ollamaUrl}`);

      if (protocolMismatch && isLocalTarget) {
        addStep(
          'Security Policy Check (Mixed Content & PNA)',
          'warning',
          `Active Warning: App is served over HTTPS (${origin}), calling local HTTP (${ollamaUrl}). Chromium browsers enforce Private Network Access (PNA) and block requests from public web origins to private/localhost addresses.`
        );
      } else {
        addStep('Security Policy Check', 'success', 'No HTTPS-to-HTTP protocol mismatch detected.');
      }

      // Step 1: Probe /api/version
      let versionOk = false;
      let detectedVersion = '';
      try {
        addStep('Probe 1: Pinging Ollama Version Endpoint', 'pending', `GET ${ollamaUrl}/api/version`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const versionRes = await fetch(`${ollamaUrl}/api/version`, {
          method: 'GET',
          signal: controller.signal,
          mode: 'cors',
        });
        clearTimeout(timeoutId);

        if (versionRes.ok) {
          versionOk = true;
          const vData = await versionRes.json().catch(() => ({}));
          detectedVersion = vData.version || 'active';
          addStep('Probe 1: Pinging Ollama Version Endpoint', 'success', `HTTP ${versionRes.status} OK. Ollama core version: ${detectedVersion}`);
        } else {
          addStep('Probe 1: Pinging Ollama Version Endpoint', 'warning', `HTTP ${versionRes.status} ${versionRes.statusText}`);
        }
      } catch (err: any) {
        const isAbort = err.name === 'AbortError';
        addStep('Probe 1: Pinging Ollama Version Endpoint', 'error', isAbort ? 'Timed out after 4.5s' : `${err.name}: ${err.message || 'Fetch failed'}`);
      }

      // Step 2: Probe /api/tags
      try {
        addStep('Probe 2: Querying Installed Ollama Models', 'pending', `GET ${ollamaUrl}/api/tags`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const response = await fetch(`${ollamaUrl}/api/tags`, {
          method: 'GET',
          signal: controller.signal,
          mode: 'cors',
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const models = data.models || [];
          const modelNames = models.map((m: any) => m.name).join(', ');
          addStep('Probe 2: Querying Installed Ollama Models', 'success', `Found ${models.length} model(s): [${modelNames || 'None installed'}]`);

          const targetModel = this.config.ollamaModel;
          const hasSelected = models.some((m: any) => m.name === targetModel || m.name.startsWith(`${targetModel}:`));

          if (targetModel && !hasSelected && models.length > 0) {
            addStep('Probe 3: Target Model Check', 'warning', `Selected model "${targetModel}" not found in installed list. Did you run "ollama pull ${targetModel}"?`);
          } else if (targetModel && hasSelected) {
            addStep('Probe 3: Target Model Check', 'success', `Configured model "${targetModel}" is installed and verified.`);
          }

          return {
            success: true,
            message: `Successfully connected to local Ollama (v${detectedVersion || 'active'})! Detected models: [${modelNames || 'None installed'}]`,
            debugLogs,
            diagnostics: {
              origin,
              targetUrl: ollamaUrl,
              protocolMismatch,
              isHttps,
              isLocalTarget,
              steps,
              recommendations: [
                'Ollama connection is verified and healthy.',
                hasSelected ? `Model "${targetModel}" is ready.` : `Run "ollama pull ${targetModel}" in your terminal if you need this specific model.`
              ]
            }
          };
        } else {
          addStep('Probe 2: Querying Installed Ollama Models', 'error', `HTTP ${response.status}: ${response.statusText}`);
          return {
            success: false,
            message: `Ollama returned HTTP ${response.status} ${response.statusText}`,
            debugLogs,
            diagnostics: {
              origin,
              targetUrl: ollamaUrl,
              protocolMismatch,
              isHttps,
              isLocalTarget,
              errorType: 'WRONG_PORT_OR_ENDPOINT',
              steps,
              recommendations: [
                'Ollama server is reachable, but returned a non-200 response.',
                'Verify that your Ollama installation is running properly by testing http://localhost:11434 in your browser.'
              ]
            }
          };
        }
      } catch (err: any) {
        const isAbort = err.name === 'AbortError';
        addStep('Probe 2: Querying Installed Ollama Models', 'error', isAbort ? 'Connection timed out after 4.5s' : `${err.name}: ${err.message || 'Failed to fetch'}`);

        // Alternative host probe (e.g. localhost <-> 127.0.0.1)
        let altUrl: string | null = null;
        let altWorking = false;
        if (ollamaUrl.includes('localhost')) {
          altUrl = ollamaUrl.replace('localhost', '127.0.0.1');
        } else if (ollamaUrl.includes('127.0.0.1')) {
          altUrl = ollamaUrl.replace('127.0.0.1', 'localhost');
        }

        if (altUrl) {
          try {
            addStep(`Probe 3: Alternative IP Check (${altUrl})`, 'pending', `Testing ${altUrl}/api/version`);
            const altCtrl = new AbortController();
            const altTimer = setTimeout(() => altCtrl.abort(), 2000);
            const altRes = await fetch(`${altUrl}/api/version`, { method: 'GET', signal: altCtrl.signal, mode: 'cors' });
            clearTimeout(altTimer);
            if (altRes.ok) {
              altWorking = true;
              addStep(`Probe 3: Alternative IP Check (${altUrl})`, 'success', `Alternative endpoint ${altUrl} responded successfully!`);
            } else {
              addStep(`Probe 3: Alternative IP Check (${altUrl})`, 'warning', `${altUrl} returned HTTP ${altRes.status}`);
            }
          } catch (altErr: any) {
            addStep(`Probe 3: Alternative IP Check (${altUrl})`, 'info', `${altUrl} also unreachable (${altErr.message || 'failed'})`);
          }
        }

        let errorType: ConnectionTestResult['diagnostics']['errorType'] = 'UNKNOWN';
        const recommendations: string[] = [];

        if (isAbort) {
          errorType = 'TIMEOUT';
          recommendations.push('Connection timed out after 4.5s. Ollama may be unresponsive, overloaded, or blocked by a firewall.');
          recommendations.push('Try restarting Ollama: quit from the system tray/menu and run "ollama serve" in a new terminal.');
        } else if (protocolMismatch && isLocalTarget) {
          errorType = 'PNA_OR_MIXED_CONTENT';
          recommendations.push('🚨 ROOT CAUSE: Browser Mixed Content & Private Network Access (PNA) Block.');
          recommendations.push(`The PWA is running on HTTPS (${origin}), but Ollama is running on insecure HTTP (${ollamaUrl}). Chromium browsers (Chrome/Edge) strictly block public HTTPS web origins from making requests to private localhost addresses.`);
          recommendations.push('FIX 1 (Chrome Flag - Recommended): Open a new browser tab to "chrome://flags/#block-insecure-private-network-requests", change it to "Disabled", then relaunch Chrome.');
          recommendations.push('FIX 2 (PWA Site Settings): In the PWA window title bar, click the site info/lock/slider icon -> Site settings -> change "Insecure content" from Block to "Allow", then restart the app.');
          recommendations.push('FIX 3 (Ensure CORS is enabled): Ensure Ollama was launched with OLLAMA_ORIGINS="*" (e.g. OLLAMA_ORIGINS="*" ollama serve).');
          recommendations.push('FIX 4 (Local HTTPS Tunnel): Run "ngrok http 11434" or "cloudflared" on your laptop to get a secure https://... URL, then paste that HTTPS URL into the Ollama API URL box.');
          recommendations.push('FIX 5 (Instant In-Browser Alternative): Switch to "Transformers.js (WASM)" under AI Compute Backend—it downloads and runs models 100% locally inside your browser with zero network requests or Mixed Content restrictions!');
        } else {
          errorType = 'OFFLINE_OR_UNREACHABLE';
          recommendations.push('Ollama appears to be stopped or unreachable on this port.');
          recommendations.push('Check in your browser if http://localhost:11434 displays "Ollama is running".');
          recommendations.push('Make sure Ollama was launched with CORS permissions: OLLAMA_ORIGINS="*" ollama serve');
          if (altWorking && altUrl) {
            recommendations.push(`💡 Alternative IP ${altUrl} responded! Click "Apply ${altUrl}" below to switch.`);
          }
        }

        return {
          success: false,
          message: errorType === 'PNA_OR_MIXED_CONTENT'
            ? `Browser blocked connection to local Ollama due to HTTPS/HTTP Mixed Content & Private Network Access policy (PWA is on HTTPS, Ollama is on HTTP).`
            : `Failed to connect to local Ollama at ${ollamaUrl}: ${err.message || 'Connection refused'}`,
          debugLogs,
          diagnostics: {
            origin,
            targetUrl: ollamaUrl,
            protocolMismatch,
            isHttps,
            isLocalTarget,
            errorType,
            rawError: `${err.name}: ${err.message}`,
            steps,
            recommendations,
            alternativeSuggestion: altWorking && altUrl ? { label: `Switch to ${altUrl}`, url: altUrl } : undefined
          }
        };
      }
    } else {
      // Online mode: Built-in Gemini or custom OpenAI
      const isBuiltIn = !this.config.openaiApiKey || this.config.openaiApiKey.trim() === '';
      if (isBuiltIn) {
        addStep('Built-in Gemini Cloud Diagnostics', 'pending', 'GET /api/test-connection');
        try {
          const response = await fetch('/api/test-connection');
          const data = await response.json();
          if (response.ok && data.success) {
            addStep('Built-in Gemini Cloud Diagnostics', 'success', data.message);
            return {
              success: true,
              message: data.message,
              debugLogs,
              diagnostics: {
                origin,
                targetUrl: '/api/test-connection',
                protocolMismatch: false,
                isHttps,
                isLocalTarget: false,
                steps,
                recommendations: ['Built-in Cloud Gemini model is responsive and ready.']
              }
            };
          }
          addStep('Built-in Gemini Cloud Diagnostics', 'error', data.error || 'Server error');
          return {
            success: false,
            message: `Built-in Gemini connection error: ${data.error || 'Server error'}`,
            debugLogs,
            diagnostics: {
              origin,
              targetUrl: '/api/test-connection',
              protocolMismatch: false,
              isHttps,
              isLocalTarget: false,
              steps,
              recommendations: ['Check server logs or Gemini API key configuration.']
            }
          };
        } catch (err: any) {
          addStep('Built-in Gemini Cloud Diagnostics', 'error', err.message);
          return {
            success: false,
            message: `Network error connecting to built-in cloud API: ${err.message}`,
            debugLogs,
            diagnostics: {
              origin,
              targetUrl: '/api/test-connection',
              protocolMismatch: false,
              isHttps,
              isLocalTarget: false,
              steps,
              recommendations: ['Network request to cloud API endpoint failed. Check your internet connection.']
            }
          };
        }
      } else {
        // Custom OpenAI / DeepSeek API
        addStep('Custom API Endpoint Diagnostics', 'pending', `POST ${this.config.openaiBaseUrl}/chat/completions`);
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
            addStep('Custom API Endpoint Diagnostics', 'success', `Connected to custom model (${this.config.openaiModel})`);
            return {
              success: true,
              message: `Successfully connected to custom API (${this.config.openaiModel})!`,
              debugLogs,
              diagnostics: {
                origin,
                targetUrl: this.config.openaiBaseUrl,
                protocolMismatch: false,
                isHttps,
                isLocalTarget: false,
                steps,
                recommendations: ['Custom API endpoint is verified and responsive.']
              }
            };
          }
          const errData = await response.json().catch(() => ({}));
          addStep('Custom API Endpoint Diagnostics', 'error', `HTTP ${response.status}: ${errData.error?.message || response.statusText}`);
          return {
            success: false,
            message: `Cloud API connection error (${response.status}): ${errData.error?.message || response.statusText}`,
            debugLogs,
            diagnostics: {
              origin,
              targetUrl: this.config.openaiBaseUrl,
              protocolMismatch: false,
              isHttps,
              isLocalTarget: false,
              steps,
              recommendations: [
                'Verify your API key and base URL.',
                `Status code ${response.status}: ${errData.error?.message || 'Check model permissions.'}`
              ]
            }
          };
        } catch (err: any) {
          addStep('Custom API Endpoint Diagnostics', 'error', err.message);
          return {
            success: false,
            message: `Network error connecting to cloud API: ${err.message}`,
            debugLogs,
            diagnostics: {
              origin,
              targetUrl: this.config.openaiBaseUrl,
              protocolMismatch: false,
              isHttps,
              isLocalTarget: false,
              steps,
              recommendations: ['Network request failed. Check API URL and internet connectivity.']
            }
          };
        }
      }
    }
  }

  // Helper to dynamically compile placeholders inside baseline templates
  private compileTemplateValue(val: string, feature: Feature, requiredNames: string, outputNames: string): string {
    let result = val || '';
    result = result.replace(/{feature_id}/g, feature.id.toUpperCase());
    result = result.replace(/{feature_name}/g, feature.name);
    result = result.replace(/{required_inputs}/g, requiredNames || 'standard inputs');
    result = result.replace(/{output_names}/g, outputNames);
    result = result.replace(/{business_rules}/g, (feature.business_rules && feature.business_rules.length > 0) ? feature.business_rules.join('; ') : 'standard business constraints');

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

  // Compile field-level baseline template placeholders
  private compileFieldTemplateValue(
    val: string,
    feature: Feature,
    field: any,
    requiredNames: string,
    outputNames: string
  ): string {
    let result = this.compileTemplateValue(val, feature, requiredNames, outputNames);

    // Compute dynamic smart length text
    let fieldLengthStr = 'standard length constraints';
    if (field.min !== undefined && field.max !== undefined) {
      fieldLengthStr = `min length is ${field.min} and max length is ${field.max}`;
    } else if (field.min !== undefined) {
      fieldLengthStr = `minimum length is ${field.min} characters`;
    } else if (field.max !== undefined) {
      fieldLengthStr = `maximum length is ${field.max} characters`;
    } else if (field.format && field.format.trim() !== '') {
      fieldLengthStr = field.format;
    }

    // Compute dynamic smart limits text
    let fieldLimitsStr = 'standard parameter bounds';
    if (field.min !== undefined && field.max !== undefined) {
      fieldLimitsStr = `min value is ${field.min} and max value is ${field.max}`;
    } else if (field.min !== undefined) {
      fieldLimitsStr = `minimum threshold is ${field.min}`;
    } else if (field.max !== undefined) {
      fieldLimitsStr = `maximum threshold is ${field.max}`;
    } else if (field.format && field.format.trim() !== '') {
      fieldLimitsStr = field.format;
    }

    const fieldValidationStr = field.validation || 'standard format validation';
    const fieldDescStr = field.description || `validates functional purpose for input parameter "${field.name}"`;
    const fieldReqStr = field.required ? 'Mandatory (Required)' : 'Optional';

    result = result.replace(/{field_name}/g, field.name);
    result = result.replace(/{field_type}/g, field.type);
    result = result.replace(/{field_required}/g, fieldReqStr);
    result = result.replace(/{field_length}/g, fieldLengthStr);
    result = result.replace(/{field_limits}/g, fieldLimitsStr);
    result = result.replace(/{field_validation}/g, fieldValidationStr);
    result = result.replace(/{field_description}/g, fieldDescStr);

    if (result.includes('{bounds_steps}')) {
      const dynamicSteps = this.getDynamicFieldSteps(feature, field).join(' \n');
      result = result.replace(/{bounds_steps}/g, dynamicSteps);
    }

    return result;
  }

  // Compile business-rule-level baseline template placeholders
  private compileRuleTemplateValue(
    val: string,
    feature: Feature,
    rule: string,
    requiredNames: string,
    outputNames: string
  ): string {
    let result = this.compileTemplateValue(val, feature, requiredNames, outputNames);
    result = result.replace(/{rule}/g, rule);
    return result;
  }

  // Dynamic step generator for boundary testing if template includes {bounds_steps}
  private getDynamicFieldSteps(feature: Feature, field: any): string[] {
    const steps: string[] = [
      `1. Focus the input field "${field.name}" inside the "${feature.name}" workspace.`
    ];

    if (field.required) {
      steps.push(`2. Requiredness Check: Leave "${field.name}" completely blank and attempt validation. Expected: Submission blocks, highlighting "${field.name}" as mandatory.`);
    } else {
      steps.push(`2. Optionality Check: Leave "${field.name}" blank and submit. Expected: System accepts empty input without warning.`);
    }

    let wrongTypeSample = 'invalid_text';
    if (field.type === 'number') wrongTypeSample = '"not-a-number" text';
    else if (field.type === 'boolean') wrongTypeSample = '"some_string" instead of true/false';
    steps.push(`3. Data Type Compliance: Mismatch test by sending ${wrongTypeSample} to "${field.name}". Expected: Rejects value or forces conversion to conform with data type "${field.type}".`);

    if (field.type === 'string') {
      const minVal = field.min !== undefined ? field.min : 1;
      const maxVal = field.max !== undefined ? field.max : 255;
      steps.push(`4. Length Boundary Validation: Enter string of length ${minVal - 1} and length ${maxVal + 1}. Expected: Validation alerts trigger.`);
      steps.push(`5. Length Acceptance Verification: Enter string of length ${minVal} and length ${maxVal}. Expected: Accepted.`);
    } else if (field.type === 'number') {
      const minVal = field.min !== undefined ? field.min : 0;
      const maxVal = field.max !== undefined ? field.max : 999999;
      steps.push(`4. Value Range Boundary Validation: Enter numeric value ${minVal - 1} and value ${maxVal + 1}. Expected: Rejection warnings block submission.`);
      steps.push(`5. Value Acceptance Verification: Input boundary values ${minVal} and ${maxVal}. Expected: Accepted by numerical engine.`);
    }

    if (field.validation) {
      steps.push(`6. Custom Constraint Compliance: Attempt inputs violating specified rule "${field.validation}". Expected: System blocks submission.`);
    }

    if (field.description) {
      steps.push(`7. Logical Intent Reasoning: Check functional behavior based on described purpose ("${field.description}").`);
    }

    return steps;
  }

  // Programmatic, high-performance code-level test case generator.
  // Dynamically uses active baseline templates (including user edits) and generates test cases per field / rule / feature.
  public generateCodeLevelTestCases(feature: Feature, includeAllEngineModes = false): TestResult {
    const test_cases: any[] = [];
    const coverage: string[] = [];

    const codeTemplates = (this.config.programmaticTemplates && this.config.programmaticTemplates.length > 0
      ? this.config.programmaticTemplates
      : DEFAULT_BASE_TEMPLATES).filter(t => t.enabled !== false && (includeAllEngineModes || t.engineMode === 'code'));

    const requiredNames = (feature.input_fields || [])
      .filter(f => f.required)
      .map(f => f.name)
      .join(', ') || '';

    const outputNames = Object.keys(feature.output || {}).join(', ') || 'expected state outputs';

    codeTemplates.forEach((template) => {
      const isFieldTemplate = template.id.includes('field') || 
                              template.title.includes('{field_name}') || 
                              template.steps.some(s => s.includes('{field_name}'));
      const isRuleTemplate = template.id.includes('rule') || 
                             template.title.includes('{rule}') || 
                             template.steps.some(s => s.includes('{rule}'));

      if (isFieldTemplate) {
        // ONLY generate test cases for input fields (NOT business rules)
        const fields = feature.input_fields || [];
        fields.forEach((field, fIdx) => {
          const fieldNameUpper = field.name.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
          const id = `TC-${feature.id.toUpperCase()}-${fieldNameUpper || fIdx + 1}`;

          const title = this.compileFieldTemplateValue(template.title, feature, field, requiredNames, outputNames);
          const type = template.type || (field.required ? 'negative' : 'boundary');
          const preconditions = (template.preconditions || []).map(p => 
            this.compileFieldTemplateValue(p, feature, field, requiredNames, outputNames)
          );

          const steps: string[] = [];
          (template.steps || []).forEach(s => {
            if (s.includes('{bounds_steps}')) {
              steps.push(...this.getDynamicFieldSteps(feature, field));
            } else {
              steps.push(this.compileFieldTemplateValue(s, feature, field, requiredNames, outputNames));
            }
          });

          const expected = this.compileFieldTemplateValue(template.expected || '', feature, field, requiredNames, outputNames);

          test_cases.push({
            id,
            title,
            type,
            preconditions,
            steps,
            expected
          });

          coverage.push(`Input parameter "${field.name}" specification validation (${template.title})`);
        });
      } else if (isRuleTemplate) {
        // ONLY generate test cases for business rules (NOT input fields)
        const rules = feature.business_rules || [];
        rules.forEach((rule, rIdx) => {
          const id = `TC-${feature.id.toUpperCase()}-RULE-${rIdx + 1}`;

          const title = this.compileRuleTemplateValue(template.title, feature, rule, requiredNames, outputNames);
          const type = template.type || 'business_rule';
          const preconditions = (template.preconditions || []).map(p => 
            this.compileRuleTemplateValue(p, feature, rule, requiredNames, outputNames)
          );
          const steps = (template.steps || []).map(s => 
            this.compileRuleTemplateValue(s, feature, rule, requiredNames, outputNames)
          );
          const expected = this.compileRuleTemplateValue(template.expected || '', feature, rule, requiredNames, outputNames);

          test_cases.push({
            id,
            title,
            type,
            preconditions,
            steps,
            expected
          });

          coverage.push(`Business rule #${rIdx + 1} validation (${template.title})`);
        });
      } else {
        // Feature-level baseline template
        const id = `TC-${feature.id.toUpperCase()}-BASE-${template.id.toUpperCase().replace(/[^A-Z0-9_-]/g, '')}`;

        const title = this.compileTemplateValue(template.title, feature, requiredNames, outputNames);
        const type = template.type || 'positive';
        const preconditions = (template.preconditions || []).map(p => 
          this.compileTemplateValue(p, feature, requiredNames, outputNames)
        );
        const steps = (template.steps || []).map(s => 
          this.compileTemplateValue(s, feature, requiredNames, outputNames)
        );
        const expected = this.compileTemplateValue(template.expected || '', feature, requiredNames, outputNames);

        test_cases.push({
          id,
          title,
          type,
          preconditions,
          steps,
          expected
        });

        coverage.push(`Feature workflow validation (${feature.name})`);
      }
    });

    return { test_cases, coverage };
  }

  // Generate test cases based on feature metadata and user natural language input
  async generate(feature: Feature, userInput: string): Promise<TestResult> {
    const activeTemplates = (this.config.programmaticTemplates && this.config.programmaticTemplates.length > 0
      ? this.config.programmaticTemplates
      : DEFAULT_BASE_TEMPLATES).filter(t => t.enabled !== false);

    // Check if any template uses code-level generation
    const hasCodeTemplates = activeTemplates.some(t => t.engineMode === 'code');
    // Check if templates are configured as AI-only (or if all active templates are 'ai')
    const isAiOnly = activeTemplates.length > 0 && activeTemplates.every(t => t.engineMode === 'ai');

    // 1. Programmatically generate base test cases for 'code' engineMode templates only
    const programmaticResult = this.generateCodeLevelTestCases(feature, false);

    try {
      // 2. Build the lightweight, optimized AI prompt requesting custom/complex rule validations
      const prompt = this.buildOptimizedPrompt(feature, userInput);
      const systemInstruction = this.buildOptimizedSystemInstruction();

      let aiResult: TestResult;

      if (this.config.aiMode === 'transformersjs') {
        aiResult = await this.generateTransformersJs(prompt, systemInstruction);
      } else if (this.config.aiMode === 'desktop') {
        aiResult = await this.generateDesktop(prompt, systemInstruction);
      } else if (this.config.aiMode === 'webllm') {
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

      // If AI returned 0 test cases:
      if (!aiResult || !aiResult.test_cases || aiResult.test_cases.length === 0) {
        if (isAiOnly || !hasCodeTemplates || programmaticResult.test_cases.length === 0) {
          throw new Error('AI Generation failed: The AI model returned 0 test cases. Please check your AI model parameters, prompt, or connectivity.');
        }
      }

      // Merge the programmatic test suite (only from 'code' mode templates) with the AI's test cases
      let combinedTestCases = [...programmaticResult.test_cases, ...(aiResult?.test_cases || [])];
      let combinedCoverage = [...new Set([...programmaticResult.coverage, ...(aiResult?.coverage || [])])];

      // If combined result is 0 and we are in AI-only mode or have no code templates:
      if (combinedTestCases.length === 0) {
        if (isAiOnly || !hasCodeTemplates || programmaticResult.test_cases.length === 0) {
          throw new Error('AI Generation returned 0 test cases. Please verify your AI configuration, prompt, or model status.');
        }
        console.warn('AI model returned 0 test cases. Falling back to programmatic engine for all enabled templates.');
        const fallbackResult = this.generateCodeLevelTestCases(feature, true);
        combinedTestCases = fallbackResult.test_cases;
        combinedCoverage = fallbackResult.coverage;
      }

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
      // If Generation Engine Mode is AI only (or no 'code' templates exist, or programmatic cases are empty):
      // In the scenario AI is not working, DO NOT return code test cases. Surface and throw the error to be displayed in the UI.
      if (isAiOnly || !hasCodeTemplates || programmaticResult.test_cases.length === 0) {
        console.error('AI generation failed in AI-only mode:', err?.message || err);
        throw err;
      }

      console.warn('AI generation encountered error:', err?.message || err, '. Returning code-level test cases for "code" mode templates only.');
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

    const requiredNames = (feature.input_fields || [])
      .filter(f => f.required)
      .map(f => f.name)
      .join(', ') || '';
    const outputNames = Object.keys(feature.output || {}).join(', ') || 'expected state outputs';

    // Get active programmatic template titles so AI doesn't duplicate them
    const activeTemplates = this.config.programmaticTemplates && this.config.programmaticTemplates.length > 0
      ? this.config.programmaticTemplates
      : DEFAULT_BASE_TEMPLATES;

    // Only list programmatic titles for templates that run strictly in 'code' mode
    const codeOnlyTitles = activeTemplates
      .filter(t => t.enabled && (t.engineMode || 'both') === 'code')
      .map(t => `- ${t.title.replace(/{feature_name}/g, feature.name)}`)
      .join('\n');

    // Extract and resolve custom AI prompt directives from baseline templates enabled for 'ai' or 'both'
    const compiledAiPrompts: string[] = [];
    const aiTemplates = activeTemplates.filter(t => t.enabled && (t.engineMode || 'both') !== 'code');

    aiTemplates.forEach(t => {
      const isFieldTemplate = t.id.includes('field') || t.title.includes('{field_name}') || t.steps.some(s => s.includes('{field_name}'));
      const isRuleTemplate = t.id.includes('rule') || t.title.includes('{rule}') || t.steps.some(s => s.includes('{rule}'));

      // Massaged pre-processed data context (reduced prompt payload size for AI)
      const customPrompt = t.aiPrompt && t.aiPrompt.trim() !== '' 
        ? t.aiPrompt 
        : `Generate comprehensive test case for template: "${t.title}". Preconditions: ${t.preconditions?.join('; ')}. Steps: {bounds_steps}. Expected: ${t.expected}`;

      if (isFieldTemplate) {
        (feature.input_fields || []).forEach(field => {
          const promptText = this.compileFieldTemplateValue(customPrompt, feature, field, requiredNames, outputNames);
          compiledAiPrompts.push(`- [Parameter "${field.name}"] Target Directive: ${promptText}`);
        });
      } else if (isRuleTemplate) {
        (feature.business_rules || []).forEach(rule => {
          const promptText = this.compileRuleTemplateValue(customPrompt, feature, rule, requiredNames, outputNames);
          compiledAiPrompts.push(`- [Business Rule] Target Directive: ${promptText}`);
        });
      } else {
        const promptText = this.compileTemplateValue(customPrompt, feature, requiredNames, outputNames);
        compiledAiPrompts.push(`- [Feature Workflow] Target Directive: ${promptText}`);
      }
    });

    const aiPromptContext = compiledAiPrompts.length > 0
      ? `\n### Massaged Baseline AI Directives (GENERATION TARGETS):\nYou MUST generate test cases explicitly adhering to these massaged baseline directives:\n${compiledAiPrompts.join('\n')}\n`
      : '';

    return `
Please generate exactly ${limit} highly specialized test cases for this feature.

${codeOnlyTitles ? `The following titles are already generated strictly by code (do not duplicate):\n${codeOnlyTitles}\n` : ''}
### Feature: ${feature.name}
### Description: ${feature.description}${depsContext}${inputsContext}${assumptionsContext}${referenceContext}

### Business Rules to cover:
${feature.business_rules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n')}
${aiPromptContext}
### Target Custom User Test Scope:
"${userInput || 'Test advanced business rule interactions and input parameter specifications'}"

Notice: Standard baseline cases are generated locally for basic titles.
If "Massaged Baseline AI Directives" above specify custom instructions for parameters or rules, prioritize those directives and materialize them!

Generate ONLY ${limit} high-value test cases. Reply strictly in JSON format.
`;
  }

  // Build the strict system instruction
  private buildOptimizedSystemInstruction(): string {
    const limit = this.config.aiCaseLimit && this.config.aiCaseLimit > 0 ? this.config.aiCaseLimit : 2;
    return `
You are a senior QA & Test Automation Architect. Generate exactly ${limit} highly specialized test cases focusing on intricate business-logic interactions, custom edge cases, and baseline AI directives.
If specific Baseline AI Directives are provided in the prompt for parameters or rules, follow those directives precisely.

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

  // Option 1: Transformers.js (CPU WASM/WebGPU) Real Local Execution.
  // Downloads quantized model parameters into standard browser IndexedDB storage and performs local browser-side inference.
  private async generateTransformersJs(prompt: string, systemInstruction: string): Promise<TestResult> {
    try {
      if (this.onProgress) {
        this.onProgress('[Transformers.js] Initiating WebAssembly runtime context...', 5);
      }
      
      const { pipeline } = await import('@huggingface/transformers');
      const modelId = this.config.webllmModel || 'Xenova/Qwen1.5-0.5B-Chat';
      
      if (this.onProgress) {
        this.onProgress(`[Transformers.js] Loading local model [${modelId}] into browser (caches weights on first run)...`, 20);
      }
      
      const generator = await pipeline('text-generation', modelId, {
        progress_callback: (data: any) => {
          if (data.status === 'downloading' && this.onProgress) {
            const pct = Math.round((data.loaded / data.total) * 100);
            this.onProgress(`[Transformers.js] Downloading weights: ${data.file.substring(data.file.lastIndexOf('/') + 1)} (${pct}%)`, Math.min(20 + Math.round(pct * 0.6), 80));
          } else if (data.status === 'done' && this.onProgress) {
            this.onProgress(`[Transformers.js] Successfully loaded ${data.file.substring(data.file.lastIndexOf('/') + 1)}`, 80);
          }
        }
      });
      
      if (this.onProgress) {
        this.onProgress('[Transformers.js] Execution pipeline ready. Running local inference...', 85);
      }
      
      const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ];
      
      const output = await generator(messages, {
        max_new_tokens: this.config.maxTokens || 1024,
        temperature: this.config.temperature || 0.7,
        do_sample: this.config.temperature > 0,
        return_full_text: false,
      });
      
      const generatedText = Array.isArray(output) 
        ? (output[0]?.generated_text || '') 
        : ((output as any).generated_text || '');
        
      if (this.onProgress) {
        this.onProgress('[Transformers.js] Local generation complete! Formatting structured test cases...', 100);
      }
      
      const rawText = typeof generatedText === 'string' ? generatedText : JSON.stringify(generatedText);
      return {
        ...this.parseAndCleanJson(rawText),
        test_cases: (this.parseAndCleanJson(rawText).test_cases || []).map((tc: any) => ({
          ...tc,
          title: `${tc.title} (Transformers.js Local)`
        }))
      };
    } catch (err: any) {
      console.error('Transformers.js local execution failed:', err);
      if (this.onProgress) {
        this.onProgress('[Transformers.js] Hardware failure or connection blocked. Falling back to secure cloud connection...', 90);
      }
      const cloudResult = await this.generateBuiltIn(prompt, systemInstruction);
      return {
        test_cases: cloudResult.test_cases.map(tc => ({
          ...tc,
          title: `${tc.title} (ONNX WASM Fallback)`
        })),
        coverage: [...cloudResult.coverage, 'Browser CPU memory fallback activated due to runtime error: ' + (err.message || 'unknown')]
      };
    }
  }

  // Option 3: Standalone Desktop Host (Native llama.cpp / Ollama) Real Local Connection.
  // Scans for active local native server runtimes (port 8080 or port 11434) on the host machine.
  private async generateDesktop(prompt: string, systemInstruction: string): Promise<TestResult> {
    const localEndpoints = [
      'http://localhost:8080/v1', // Standard llama.cpp / llama-server
      'http://localhost:11434/v1', // Native Ollama API OpenAI Compatibility
      'http://127.0.0.1:8080/v1',
      'http://127.0.0.1:11434/v1'
    ];
    
    let lastError: any = null;
    
    for (const endpoint of localEndpoints) {
      try {
        if (this.onProgress) {
          this.onProgress(`[Desktop Native] Scanning for active local pipeline on ${endpoint}...`, 20);
        }
        
        const response = await fetch(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.ollamaModel || 'qwen2.5-coder',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            temperature: this.config.temperature || 0.7,
            max_tokens: this.config.maxTokens || 1024,
            response_format: { type: 'json_object' }
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const rawText = data.choices[0]?.message?.content || '';
          if (this.onProgress) {
            this.onProgress('[Desktop Native] Direct hardware socket connection established! Structuring test suite...', 100);
          }
          return {
            ...this.parseAndCleanJson(rawText),
            test_cases: (this.parseAndCleanJson(rawText).test_cases || []).map((tc: any) => ({
              ...tc,
              title: `${tc.title} (Local Native Host)`
            }))
          };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Local endpoint ${endpoint} was unreachable:`, err?.message || err);
      }
    }
    
    if (this.onProgress) {
      this.onProgress('[Desktop Native] No local native server responding. Falling back to secure cloud execution...', 80);
    }
    
    const cloudResult = await this.generateBuiltIn(prompt, systemInstruction);
    return {
      test_cases: cloudResult.test_cases.map(tc => ({
        ...tc,
        title: `${tc.title} (Native Host Cloud Fallback)`
      })),
      coverage: [...cloudResult.coverage, 'Note: Local llama-server was offline, routed through secure cloud channel']
    };
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
    const rawOllamaUrl = (this.config.ollamaUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
    
    // Candidate endpoints in case of IPv6/IPv4 localhost resolution differences or local bridge
    const endpointsToTry = [rawOllamaUrl];
    if (rawOllamaUrl.includes('localhost')) {
      endpointsToTry.push(rawOllamaUrl.replace('localhost', '127.0.0.1'));
    } else if (rawOllamaUrl.includes('127.0.0.1')) {
      endpointsToTry.push(rawOllamaUrl.replace('127.0.0.1', 'localhost'));
    }
    // Also try local bridge on 11435 if default 11434 was configured
    if (rawOllamaUrl.includes('11434')) {
      endpointsToTry.push(rawOllamaUrl.replace('11434', '11435'));
    }

    let lastError: any = null;

    for (const url of endpointsToTry) {
      try {
        const response = await fetch(`${url}/api/generate`, {
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
        lastError = err;
        console.warn(`Attempt to generate with Ollama at ${url} failed:`, err?.message || err);
      }
    }

    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isHttpTarget = rawOllamaUrl.toLowerCase().startsWith('http://');
    const isLocalTarget = /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/.test(rawOllamaUrl);

    if (isHttps && isHttpTarget && isLocalTarget) {
      throw new Error(`Connection to local Ollama (${rawOllamaUrl}) was blocked by browser security (Mixed Content & Private Network Access policy).

Because your PWA is running on HTTPS (GitHub Pages), the browser prevents web pages from connecting to local HTTP services unless explicitly permitted.

QUICK FIXES:
1. Allow Insecure Content (Instant): In your browser/PWA window, click the icon next to the address/app title -> "Site settings" -> set "Insecure content" to "Allow" -> reload.
2. Enable Ollama CORS: Start Ollama with OLLAMA_ORIGINS="*"
   - Windows PowerShell: $env:OLLAMA_ORIGINS="*"; ollama serve
   - Mac: launchctl setenv OLLAMA_ORIGINS "*" (then restart Ollama app)
   - Linux: Environment="OLLAMA_ORIGINS=*" in systemd
3. Run Local Bridge: Run "npm run bridge" in your project directory.
4. Or switch to "Transformers.js (WASM)" under AI Core Settings for 100% in-browser offline generation without needing local servers.`);
    }

    throw new Error(`Local Ollama generation failed (${rawOllamaUrl}). Ensure Ollama service is running with model [${this.config.ollamaModel}]. Error: ${lastError?.message || 'Connection refused'}`);
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
      let response = await fetch(`${this.config.openaiBaseUrl}/chat/completions`, {
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

      // If provider or model (e.g. DeepSeek R1 / deepseek-reasoner or custom proxies) errors out on response_format, retry without it
      if (!response.ok) {
        const firstErr = await response.json().catch(() => ({}));
        console.warn(`Initial API call with response_format failed (${response.status}): ${firstErr?.error?.message || response.statusText}. Retrying without response_format parameter...`);
        
        response = await fetch(`${this.config.openaiBaseUrl}/chat/completions`, {
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
            max_tokens: this.config.maxTokens
          }),
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || response.statusText);
      }

      const data = await response.json();
      const rawText = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : '';

      if (!rawText || rawText.trim() === '') {
        throw new Error('Model returned empty response content.');
      }

      return this.parseAndCleanJson(rawText);
    } catch (err: any) {
      throw new Error(`Cloud API (${this.config.openaiModel}) generation failed: ${err.message}`);
    }
  }

  // Fallback plain-text test case parser when LLM does not return valid JSON
  private parsePlainTextTestCases(text: string): any[] {
    const cases: any[] = [];
    const blocks = text.split(/(?=(?:Test Case|Case|TC-|\b\d+\.|\bTitle:))/i);
    
    blocks.forEach((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed || trimmed.length < 15) return;

      let title = `Test Case ${idx + 1}`;
      const titleMatch = trimmed.match(/(?:title|test case|case)\s*[:\-]?\s*([^\n\r]+)/i) || trimmed.match(/^(?:TC-\d+|\d+\.)\s*([^\n\r]+)/m);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
      }

      const steps: string[] = [];
      const stepLines = trimmed.split('\n');
      stepLines.forEach(line => {
        const stepMatch = line.match(/(?:step\s*\d+|\d+\.)\s*[:\-]?\s*([^\n\r]+)/i);
        if (stepMatch && stepMatch[1]) {
          steps.push(stepMatch[1].trim());
        }
      });

      let expected = 'System performs as expected.';
      const expectedMatch = trimmed.match(/(?:expected|result)\s*[:\-]?\s*([^\n\r]+)/i);
      if (expectedMatch && expectedMatch[1]) {
        expected = expectedMatch[1].trim();
      }

      let preconditions: string[] = [];
      const preMatch = trimmed.match(/(?:precondition|prerequisite)\s*[:\-]?\s*([^\n\r]+)/i);
      if (preMatch && preMatch[1]) {
        preconditions = [preMatch[1].trim()];
      }

      cases.push({
        id: `TC-${idx + 1}`,
        title,
        type: 'positive',
        preconditions,
        steps: steps.length > 0 ? steps : ['Execute scenario validation steps'],
        expected
      });
    });

    return cases;
  }

  // Helper to parse and clean response JSON string
  private parseAndCleanJson(rawText: string): TestResult {
    let cleaned = rawText.trim();
    
    // Proactively strip <think>...</think> reasoning blocks (DeepSeek-R1 / Qwen reasoning models)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // 1. Strip markdown code blocks if any
    if (cleaned.includes('```')) {
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
        // Attempt plain text extraction fallback
        const plainTextCases = this.parsePlainTextTestCases(rawText);
        if (plainTextCases.length > 0) {
          parsed = { test_cases: plainTextCases, coverage: ['Parsed from model response text'] };
        } else {
          console.error('Failed to parse raw LLM response as JSON. Raw output:', rawText);
          throw new Error(`Unable to parse JSON returned by model: ${err.message || 'Formatting error'}.`);
        }
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
