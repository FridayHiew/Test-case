export interface InputField {
  name: string;
  type: string;
  required: boolean;
  format?: string;
  min?: number;
  max?: number;
}

export interface Feature {
  id: string;
  name: string;
  version: string;
  description: string;
  input_fields: InputField[];
  business_rules: string[];
  output: Record<string, string>;
  dependencies?: string[];
}

export interface TestCase {
  id: string;
  title: string;
  type: 'positive' | 'negative' | 'boundary' | 'security' | 'performance';
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
}
