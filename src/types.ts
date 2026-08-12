export interface InputField {
  name: string;
  type: string;
  required: boolean;
  format?: string;
  min?: number;
  max?: number;
  description?: string;
  validation?: string;
}

export interface Feature {
  id: string;
  name: string;
  version: string;
  description: string;
  assumptions?: string;
  input_fields: InputField[];
  business_rules: string[];
  output: Record<string, string>;
  dependencies?: string[];
  reference?: string;
}

export interface TestCase {
  id: string;
  title: string;
  type: 'positive' | 'negative' | 'boundary' | 'security' | 'performance' | 'business_rule';
  preconditions: string[];
  steps: string[];
  expected: string;
}

export interface TestResult {
  test_cases: TestCase[];
  coverage: string[];
}

export interface CacheEntry {
  cacheKey: string;
  featureId: string;
  userInput: string;
  result: TestResult;
  createdAt: string;
}

export interface BaseCaseTemplate {
  id: string;
  title: string;
  type: 'positive' | 'negative' | 'boundary' | 'security' | 'performance' | 'business_rule';
  enabled: boolean;
  preconditions: string[];
  steps: string[];
  expected: string;
  caseCount?: number;
  aiPrompt?: string;
}

export interface E2ETestCase {
  id: string;
  name: string;
  flowPath: string; // e.g., "LOGIN-001 -> CART-001 -> PAYMENT-001"
  preconditions: string[];
  steps: string[];
  expected: string;
}

export interface E2EJourney {
  id: string;
  name: string;
  description: string;
  mermaidFlowchart: string;
  testCases?: E2ETestCase[];
}

export interface AIConfig {
  aiMode: 'offline' | 'online' | 'webllm';
  // Offline Ollama Config
  ollamaUrl: string;
  ollamaModel: string;
  // Browser WebLLM Config
  webllmModel: string;
  // Online Cloud API Config
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  // General Hyperparameters
  temperature: number;
  maxTokens: number;
  aiCaseLimit?: number;
  // Customizable Baseline Templates
  programmaticTemplates?: BaseCaseTemplate[];
}
