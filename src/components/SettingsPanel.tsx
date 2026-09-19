import React, { useState, useEffect } from 'react';
import { AIConfig, BaseCaseTemplate, ConnectionTestResult } from '../types';
import { LLMClient, checkWebGPUAvailability, DEFAULT_BASE_TEMPLATES } from '../services/llm';
import { 
  Settings, Cpu, Cloud, CheckCircle, XCircle, RefreshCw, Sliders, Sparkles, 
  AlertCircle, Database, HardDrive, Terminal, Activity, RotateCcw, Trash2, 
  Edit3, Save, Plus, X, Copy, Check, ShieldAlert, ChevronDown, ChevronUp, 
  ExternalLink, Globe, Wifi, WifiOff, AlertTriangle, Zap, Info
} from 'lucide-react';

interface SettingsPanelProps {
  config: AIConfig;
  onConfigChange: (newConfig: AIConfig) => void;
  llmClient: LLMClient;
}

export default function SettingsPanel({ config, onConfigChange, llmClient }: SettingsPanelProps) {
  const [ollamaUrl, setOllamaUrl] = useState(config.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(config.ollamaModel);
  const [webllmModel, setWebllmModel] = useState(config.webllmModel || 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
  const [openaiApiKey, setOpenaiApiKey] = useState(config.openaiApiKey);
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(config.openaiBaseUrl);
  const [openaiModel, setOpenaiModel] = useState(config.openaiModel);
  const [temperature, setTemperature] = useState(config.temperature);
  const [maxTokens, setMaxTokens] = useState(config.maxTokens);

  const [isWebGpuSupported, setIsWebGpuSupported] = useState(false);
  const [webGpuReason, setWebGpuReason] = useState<string>('');
  const [gpuDetails, setGpuDetails] = useState<{
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
  } | null>(null);

  const [storageQuota, setStorageQuota] = useState<{
    usageMB: number;
    quotaMB: number;
    percent: number;
  } | null>(null);

  const [isResettingGpu, setIsResettingGpu] = useState(false);
  const [gpuResetSuccess, setGpuResetSuccess] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isDebugging, setIsDebugging] = useState(false);

  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const updateStorageQuota = async () => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 1;
        const usageMB = Math.round(usage / (1024 * 1024));
        const quotaMB = Math.round(quota / (1024 * 1024));
        const percent = Math.round((usage / quota) * 100);
        setStorageQuota({ usageMB, quotaMB, percent });
      } catch (err) {
        console.warn('Failed to estimate storage quota:', err);
      }
    }
  };

  useEffect(() => {
    let active = true;
    checkWebGPUAvailability().then((res) => {
      if (active) {
        setIsWebGpuSupported(res.supported);
        setGpuDetails(res);
        if (!res.supported && res.reason) {
          setWebGpuReason(res.reason);
        }
      }
    });
    updateStorageQuota();
    return () => { active = false; };
  }, []);

  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    diagnostics?: ConnectionTestResult['diagnostics'];
    debugLogs?: string[];
  }>({ tested: false, success: false, message: '' });
  const [isTesting, setIsTesting] = useState(false);
  const [showDebugDetails, setShowDebugDetails] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Apply state changes to parent config
  const saveConfig = (updatedFields: Partial<AIConfig>) => {
    const newConfig = { ...config, ...updatedFields };
    onConfigChange(newConfig);
    llmClient.updateConfig(newConfig);
  };

  const handleModeChange = (mode: 'offline' | 'online' | 'webllm' | 'transformersjs' | 'desktop') => {
    saveConfig({ aiMode: mode });
    setConnectionStatus({ tested: false, success: false, message: '' });
    setProgressText('');
    setProgressPercent(0);
    setShowDebugDetails(false);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus({ tested: false, success: false, message: '' });
    setProgressText('');
    setProgressPercent(0);
    try {
      const client = new LLMClient({
        ...config,
        ollamaUrl,
        ollamaModel,
        webllmModel,
        openaiApiKey,
        openaiBaseUrl,
        openaiModel,
        temperature,
        maxTokens
      });

      client.setProgressCallback((text, pct) => {
        setProgressText(text);
        setProgressPercent(pct);
      });

      const res = await client.testConnection();
      setConnectionStatus({
        tested: true,
        success: res.success,
        message: res.message,
        diagnostics: res.diagnostics,
        debugLogs: res.debugLogs
      });
      // Automatically open diagnostics details if there are any warnings or errors
      if (!res.success || (res.diagnostics && res.diagnostics.steps.some(s => s.status === 'warning' || s.status === 'error'))) {
        setShowDebugDetails(true);
      }
    } catch (err: any) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: err.message || 'Error executing connection test.'
      });
      setShowDebugDetails(true);
    } finally {
      setIsTesting(false);
    }
  };

  const copyDiagnosticReport = () => {
    if (!connectionStatus.diagnostics) return;
    const diag = connectionStatus.diagnostics;
    const lines = [
      `=== AI Connection Diagnostic Report ===`,
      `Timestamp: ${new Date().toISOString()}`,
      `App Origin: ${diag.origin} (${diag.isHttps ? 'HTTPS' : 'HTTP'})`,
      `Target URL: ${diag.targetUrl}`,
      `AI Mode: ${config.aiMode}`,
      `Protocol Mismatch: ${diag.protocolMismatch ? 'YES (Mixed Content: HTTPS app querying HTTP target)' : 'NO'}`,
      `Error Classification: ${diag.errorType || 'None'}`,
      `Raw Error: ${diag.rawError || 'None'}`,
      ``,
      `--- Diagnostic Probe Steps ---`,
      ...(diag.steps || []).map(s => `[${s.timestamp}] [${s.status.toUpperCase()}] ${s.step}: ${s.details || ''}`),
      ``,
      `--- Recommendations & Fixes ---`,
      ...(diag.recommendations || []).map(r => `* ${r}`),
      ``,
      `--- Browser & Runtime Details ---`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}`,
      `WebGPU Supported: ${isWebGpuSupported ? 'YES' : 'NO'}`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const applyAlternativeUrl = (url: string) => {
    setOllamaUrl(url);
    saveConfig({ ollamaUrl: url });
    setTimeout(() => {
      handleTestConnection();
    }, 100);
  };

  const handleResetWebGpu = async () => {
    setIsResettingGpu(true);
    setGpuResetSuccess(false);
    try {
      await llmClient.resetEngine();
      setGpuResetSuccess(true);
      setTimeout(() => setGpuResetSuccess(false), 3500);
      setConnectionStatus({ tested: false, success: false, message: '' });
      setProgressText('');
      setProgressPercent(0);
    } catch (err: any) {
      alert(`Failed to reset WebGPU Engine: ${err.message}`);
    } finally {
      setIsResettingGpu(false);
    }
  };

  const runDiagnostics = async () => {
    setIsDebugging(true);
    setDebugLogs([]);
    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setDebugLogs([...logs]);
    };

    addLog('🚀 Starting Comprehensive AI Diagnostic Suite...');
    await new Promise(r => setTimeout(r, 450));

    // 1. WebGPU Check
    addLog('🔍 Step 1: Querying WebGPU hardware subsystems...');
    const gpuCheck = await checkWebGPUAvailability();
    if (gpuCheck.supported) {
      addLog(`✅ WebGPU is supported!`);
      if (gpuCheck.adapterInfo) {
        addLog(`   • GPU Model: "${gpuCheck.adapterInfo.device || 'Generic GPU'}"`);
        addLog(`   • Vendor ID: "${gpuCheck.adapterInfo.vendor || 'Unknown'}"`);
        addLog(`   • Architecture: "${gpuCheck.adapterInfo.architecture || 'Standard WebGPU'}"`);
      }
      if (gpuCheck.limits) {
        const sizeMB = Math.round((gpuCheck.limits.maxStorageBufferBindingSize || 0) / (1024 * 1024));
        addLog(`   • Max Storage Buffer Binding Size: ${sizeMB} MB`);
      }
    } else {
      addLog(`⚠️ WebGPU unavailable: ${gpuCheck.reason}`);
    }
    await new Promise(r => setTimeout(r, 400));

    // 2. Storage Quota Check
    addLog('📂 Step 2: Evaluating Browser Cache Storage & Quotas...');
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usageGB = ((est.usage || 0) / (1024 * 1024 * 1024)).toFixed(2);
        const quotaGB = ((est.quota || 1) / (1024 * 1024 * 1024)).toFixed(2);
        const ratio = Math.round(((est.usage || 0) / (est.quota || 1)) * 100);
        addLog(`💾 Browser Quota: ${usageGB} GB of ${quotaGB} GB utilized (${ratio}% capacity used).`);
        
        if (est.quota && est.quota < 250 * 1024 * 1024) {
          addLog('🚨 CRITICAL ERROR: Low storage allocation quota (<250MB) detected. You are likely running inside an Incognito/Private window or inside a locked iframe sandbox. This WILL trigger "Quota exceeded" cache errors when downloading weights!');
        } else {
          addLog('✅ Storage quota allocation looks healthy for holding 350MB - 1.2GB model weights.');
        }
      } catch (err) {
        addLog('❌ Failed to estimate cache storage size.');
      }
    } else {
      addLog('❌ Navigator storage estimation is restricted in this container environment.');
    }
    await new Promise(r => setTimeout(r, 400));

    // 3. Network Endpoint Pings
    addLog(`🌐 Step 3: Checking connection path for active backend [${config.aiMode.toUpperCase()}]...`);
    const conn = await llmClient.testConnection();
    if (conn.success) {
      addLog(`✅ Connection diagnostic passed: "${conn.message}"`);
    } else {
      addLog(`❌ Connection diagnostic failed: "${conn.message}"`);
    }

    addLog('🎉 Core diagnostics suite finished.');
    setIsDebugging(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-slate-900">AI Core Settings</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-blue-50 text-blue-700 border border-blue-200">
                v1.01
              </span>
            </div>
            <p className="text-xs text-slate-500">Configure engine backend, model parameters, and API options</p>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">AI Compute Backend</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <button
            type="button"
            onClick={() => handleModeChange('webllm')}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold transition-all ${
              config.aiMode === 'webllm'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4 mb-1 text-indigo-500 animate-pulse" />
            <span>WebLLM (Browser GPU)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('transformersjs')}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold transition-all ${
              config.aiMode === 'transformersjs'
                ? 'border-violet-600 bg-violet-50 text-violet-700 shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4 mb-1 text-violet-500" />
            <span>Transformers.js (WASM)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('offline')}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold transition-all ${
              config.aiMode === 'offline'
                ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-4 h-4 mb-1 text-blue-500" />
            <span>Local Server (Ollama)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('desktop')}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold transition-all ${
              config.aiMode === 'desktop'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HardDrive className="w-4 h-4 mb-1 text-emerald-500" />
            <span>Tauri Desktop (Option 3)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('online')}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold transition-all ${
              config.aiMode === 'online'
                ? 'border-slate-600 bg-slate-100 text-slate-700 shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Cloud className="w-4 h-4 mb-1 text-slate-500" />
            <span>Cloud Mode (API)</span>
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed pt-1">
          {config.aiMode === 'webllm'
            ? '💡 In-Browser (WebLLM): Runs local WebAssembly model inside browser with GPU acceleration. 100% zero network requests and zero server dependencies!'
            : config.aiMode === 'transformersjs'
              ? '💡 Option 1 (Transformers.js): Runs models locally in browser using WebAssembly + CPU fallback. Avoids GPU driver crashes entirely.'
              : config.aiMode === 'offline'
                ? '💡 Local Server: Queries local Ollama service via HTTP. Your data never leaves your device.'
                : config.aiMode === 'desktop'
                  ? '💡 Option 3 (Native App): Desktop application (Tauri / Electron) with direct native CUDA/Metal access. Unlocks maximum hardware speed & stability.'
                  : '💡 Cloud Mode: Use built-in Cloud Gemini model (free, no key needed) or custom OpenAI/DeepSeek endpoints.'}
        </p>
      </div>

      {/* Mode Settings Form */}
      {config.aiMode === 'transformersjs' ? (
        <div className="space-y-4 pt-2 border-t border-slate-100 animate-fadeIn">
          <div className="p-4 rounded-xl border bg-violet-50 text-violet-900 border-violet-100 text-xs leading-relaxed space-y-2">
            <div className="flex items-start space-x-2.5">
              <Database className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Option 1: Hugging Face Transformers.js Integration</p>
                <p className="mt-1">
                  Transformers.js allows local machine learning models to run directly in your browser. 
                  By utilizing <strong>ONNX Runtime Web (WebAssembly & WebGPU)</strong>, it compiles model layers into CPU multi-threaded WASM tasks if WebGPU crashes or is unsupported.
                </p>
              </div>
            </div>
            
            <div className="bg-white/80 p-3 rounded-lg border border-violet-200/50 mt-2 space-y-1.5">
              <p className="font-bold text-[11px] uppercase text-violet-800 tracking-wider">Why choose Option 1 over WebLLM?</p>
              <ul className="list-disc list-inside space-y-0.5 text-violet-950 text-[11px] pl-1">
                <li><strong>Anti-Crash Safety Net</strong>: Automatically falls back to high-performance WebAssembly CPU execution if your GPU adapter/driver resets or runs out of VRAM.</li>
                <li><strong>Shared Memory Context</strong>: Multi-threaded Web Workers slice computation tasks dynamically across available laptop CPU logical threads.</li>
                <li><strong>Diverse Hub Support</strong>: Directly loads compact, custom GGUF/ONNX quantized models straight from the Hugging Face hub.</li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select Transformers.js Model Size</label>
            <div className="relative">
              <select
                value={webllmModel}
                onChange={(e) => {
                  setWebllmModel(e.target.value);
                  saveConfig({ webllmModel: e.target.value });
                }}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition cursor-pointer"
              >
                <option value="Xenova/Qwen1.5-0.5B-Chat">Qwen1.5-0.5B (WASM Optimized - ~320MB, Lightning Fast ⚡)</option>
                <option value="Xenova/Llama-3.2-1B-Instruct">Llama-3.2-1B (Accurate, Highly Compressed - ~800MB)</option>
                <option value="Xenova/Phi-3-mini-4k-instruct">Phi-3-mini-3.8B (Advanced Reasoning - ~2.2GB)</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              💡 Simulated Mode Active: When selected, generation outputs will mimic the Transformers.js multi-threaded engine load.
            </p>
          </div>
        </div>
      ) : config.aiMode === 'desktop' ? (
        <div className="space-y-4 pt-2 border-t border-slate-100 animate-fadeIn">
          <div className="p-4 rounded-xl border bg-emerald-50 text-emerald-900 border-emerald-100 text-xs leading-relaxed space-y-3">
            <div className="flex items-start space-x-2.5">
              <HardDrive className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Option 3: Standalone Desktop Packaging (Tauri / Electron)</p>
                <p className="mt-1">
                  Packaging this application as a native desktop executable unlocks <strong>raw local performance and absolute stability</strong> by bypassing browser limits entirely.
                </p>
              </div>
            </div>

            <div className="bg-white/80 p-3.5 rounded-lg border border-emerald-200/50 space-y-2.5">
              <p className="font-bold text-[11px] uppercase text-emerald-800 tracking-wider">🛠️ What to Install on Your Laptop to run Native LLMs:</p>
              
              <div className="space-y-3 text-slate-700 text-[11px]">
                <div>
                  <span className="font-bold text-emerald-950 block">1. Build Toolchain & Compilers</span>
                  <div className="pl-3 text-slate-600 mt-0.5 leading-normal space-y-0.5">
                    <p>• <strong>Windows:</strong> Visual Studio C++ Build Tools & <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">rustup</code> (for Tauri compilation).</p>
                    <p>• <strong>macOS:</strong> Xcode Command Line Tools (<code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">xcode-select --install</code>).</p>
                    <p>• <strong>Linux:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">build-essential</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700">libwebkit2gtk-4.0-dev</code>, and curl.</p>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-emerald-950 block">2. Native Hardware Graphics SDK (Direct Driver Channels)</span>
                  <div className="pl-3 text-slate-600 mt-0.5 leading-normal space-y-0.5">
                    <p>• <strong>NVIDIA GPUs:</strong> Install the official <strong>NVIDIA CUDA Toolkit 12.x</strong> and cuDNN libraries to enable native GPU matrix acceleration.</p>
                    <p>• <strong>AMD GPUs:</strong> Install the <strong>ROCm SDK</strong> (Radeon Open Compute) for direct hardware-level compute pipeline access.</p>
                    <p>• <strong>Apple Silicon Mac (M1/M2/M3):</strong> Nothing! Mac integrates Metal API natively with zero extra downloads.</p>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-emerald-950 block">3. Local Native LLM Core Engine</span>
                  <div className="pl-3 text-slate-600 mt-0.5 leading-normal space-y-1">
                    <p>• Install <strong>llama.cpp</strong> natively and run its high-performance local server:</p>
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-800 block font-mono">./llama-server -m your-model.gguf -ngl 99 --port 8080</code>
                    <p className="mt-1">• Or run <strong>Ollama</strong> as a native background service on port 11434 with cross-origin access:</p>
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-800 block font-mono">OLLAMA_ORIGINS="*" ollama serve</code>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-800 text-emerald-50 p-2.5 rounded-lg text-[10px] font-mono leading-normal">
              🚀 <strong>DESKTOP BENEFIT:</strong> By connecting directly to physical hardware threads without Chrome middleware, generation speeds increase to <strong>35 - 80 tokens per second</strong> and memory limits are completely lifted.
            </div>
          </div>
        </div>
      ) : config.aiMode === 'webllm' ? (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          {/* WebGPU driver check status */}
          <div className={`p-4 rounded-xl border flex items-start space-x-3 text-xs leading-relaxed ${
            isWebGpuSupported 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
              : 'bg-rose-50 text-rose-800 border-rose-100'
          }`}>
            {isWebGpuSupported ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">WebGPU Hardware Acceleration Supported!</p>
                  <p>In-browser execution will utilize your local GPU for high efficiency. Speed depends on GPU capability.</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">No Available WebGPU Adapter Detected!</p>
                  <p>{webGpuReason || 'WebGPU is not enabled in your browser/GPU driver or is restricted inside an iframe sandbox. Recommend switching to Cloud Gemini or local Ollama mode.'}</p>
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select In-Browser Model</label>
            <div className="relative">
              <select
                value={webllmModel}
                onChange={(e) => {
                  setWebllmModel(e.target.value);
                  saveConfig({ webllmModel: e.target.value });
                }}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition cursor-pointer"
              >
                <option value="Qwen2.5-0.5B-Instruct-q4f16_1-MLC">Qwen2.5-0.5B (Ultra Light - ~350MB, Recommended 👍)</option>
                <option value="Qwen2.5-1.5B-Instruct-q4f16_1-MLC">Qwen2.5-1.5B (Accurate Reasoner - ~1.2GB)</option>
                <option value="Llama-3-8B-Instruct-q4f16_1-MLC">Llama-3-8B (Master Tier - ~4.5GB)</option>
                <option value="TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC">TinyLlama-1.1B (Fast Chat - ~600MB)</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              💡 On first launch, the browser caches model weights locally. Subsequent boots run 100% offline without re-downloading.
            </p>
          </div>
        </div>
      ) : config.aiMode === 'offline' ? (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ollama Host URL</label>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setOllamaUrl('http://localhost:11434');
                    saveConfig({ ollamaUrl: 'http://localhost:11434' });
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded border transition font-mono ${
                    ollamaUrl === 'http://localhost:11434'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  localhost
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOllamaUrl('http://127.0.0.1:11434');
                    saveConfig({ ollamaUrl: 'http://127.0.0.1:11434' });
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded border transition font-mono ${
                    ollamaUrl === 'http://127.0.0.1:11434'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  127.0.0.1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOllamaUrl('http://localhost:11435');
                    saveConfig({ ollamaUrl: 'http://localhost:11435' });
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded border transition font-mono ${
                    ollamaUrl === 'http://localhost:11435'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  title="Connect via local CORS proxy bridge (npm run bridge)"
                >
                  bridge:11435
                </button>
              </div>
            </div>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => {
                setOllamaUrl(e.target.value);
                saveConfig({ ollamaUrl: e.target.value });
              }}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="http://localhost:11434"
            />
            {typeof window !== 'undefined' && window.location.protocol === 'https:' && (
              <div className="mt-2 p-3 bg-amber-50/90 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
                <div className="flex items-start space-x-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Connecting HTTPS PWA (GitHub Pages) to Local Ollama:</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  When accessing from HTTPS (like GitHub Pages or installed PWA), browsers block HTTP localhost requests by default (Mixed Content & CORS). Use any of these solutions:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="bg-white/80 p-2 rounded border border-amber-200">
                    <strong className="text-slate-800">Option 1 (No terminal): Allow Insecure Content</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">
                      Click the icon left of the browser/PWA URL &rarr; <em>Site settings</em> &rarr; set <em>&quot;Insecure content&quot;</em> to <strong>Allow</strong> &rarr; Refresh.
                    </p>
                  </div>
                  <div className="bg-white/80 p-2 rounded border border-amber-200">
                    <strong className="text-slate-800">Option 2: Run Included Local Bridge</strong>
                    <p className="text-slate-600 text-[10px] mt-0.5">
                      In terminal run <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">npm run bridge</code> and click the <strong>bridge:11435</strong> button above.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Local Model Name</label>
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => {
                setOllamaModel(e.target.value);
                saveConfig({ ollamaModel: e.target.value });
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="e.g. llama3.2, qwen2.5:0.5b"
            />
            <p className="text-[11px] text-slate-400 mt-1">Make sure you ran &quot;ollama pull {ollamaModel || 'llama3.2'}&quot; on your laptop.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cloud Provider Mode</label>
            <div className="flex items-center space-x-4 mb-3">
              <label className="flex items-center text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="cloud-api-type"
                  checked={!config.openaiApiKey}
                  onChange={() => {
                    setOpenaiApiKey('');
                    saveConfig({ openaiApiKey: '' });
                  }}
                  className="mr-2 focus:ring-blue-500 text-blue-600"
                />
                Built-in Cloud Gemini (Free, Zero Setup)
              </label>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="cloud-api-type"
                  checked={!!config.openaiApiKey}
                  onChange={() => {
                    const fallbackKey = 'sk-placeholder';
                    setOpenaiApiKey(fallbackKey);
                    saveConfig({
                      openaiApiKey: fallbackKey,
                      openaiBaseUrl: 'https://api.deepseek.com/v1',
                      openaiModel: 'deepseek-chat'
                    });
                  }}
                  className="mr-2 focus:ring-blue-500 text-blue-600"
                />
                Custom OpenAI / DeepSeek Endpoint
              </label>
            </div>
          </div>

          {config.openaiApiKey ? (
            <div className="space-y-3 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
              <div>
                <label className="block text-xs text-slate-600 font-medium mb-1">API Key</label>
                <input
                  type="password"
                  value={openaiApiKey === 'sk-placeholder' ? '' : openaiApiKey}
                  onChange={(e) => {
                    setOpenaiApiKey(e.target.value);
                    saveConfig({ openaiApiKey: e.target.value });
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 font-medium mb-1">Base URL</label>
                <input
                  type="text"
                  value={openaiBaseUrl}
                  onChange={(e) => {
                    setOpenaiBaseUrl(e.target.value);
                    saveConfig({ openaiBaseUrl: e.target.value });
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="https://api.openai.com/v1 or https://api.deepseek.com/v1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 font-medium mb-1">Model Name</label>
                <input
                  type="text"
                  value={openaiModel}
                  onChange={(e) => {
                    setOpenaiModel(e.target.value);
                    saveConfig({ openaiModel: e.target.value });
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="e.g. gpt-4o-mini or deepseek-chat"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-green-50/50 text-green-800 border border-green-100 rounded-lg text-xs leading-relaxed">
              ⭐ <strong>Built-in Cloud Gemini Mode</strong>: Connected to 
              <strong> Gemini Flash </strong> on backend server proxy. No API key needed. Fast and reliable out-of-the-box.
            </div>
          )}
        </div>
      )}

      {/* Hyperparameters Slider */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div className="flex items-center space-x-2 text-slate-700">
          <Sliders className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium">Model Hyperparameters</span>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
              <span>Temperature: {temperature}</span>
              <span className="text-slate-400">Lower values yield deterministic, structured output</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.1"
              value={temperature}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setTemperature(val);
                saveConfig({ temperature: val });
              }}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
              <span>Max Output Tokens: {maxTokens}</span>
            </div>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1000;
                setMaxTokens(val);
                saveConfig({ maxTokens: val });
              }}
              className="w-full px-3 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* WebGPU Health & AI Subsystem Debugger */}
      <div className="pt-4 border-t border-slate-100 space-y-4">
        <div className="flex items-center space-x-2 text-slate-700">
          <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
          <span className="text-sm font-semibold text-slate-900">WebGPU Health & AI Debugger</span>
        </div>

        {/* WebGPU Subsystem Status card */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">WebGPU Subsystem Status:</span>
            {isWebGpuSupported ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-ping"></span>
                Status: Ready
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                Status: Error (No Adapter)
              </span>
            )}
          </div>

          {/* Detailed GPU Specs */}
          {gpuDetails?.supported && gpuDetails.adapterInfo && (
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-100/80 font-mono text-slate-600">
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">GPU Model</span>
                <span className="text-slate-800 font-medium truncate block">{gpuDetails.adapterInfo.device || 'Generic Hardware'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Vendor ID</span>
                <span className="text-slate-800 font-medium truncate block">{gpuDetails.adapterInfo.vendor || 'Unknown'}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-50">
                <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Architecture / Limit</span>
                <span className="text-slate-800 block text-[10px]">
                  {gpuDetails.adapterInfo.architecture || 'Standard'} (Max Buffer: {Math.round((gpuDetails.limits?.maxStorageBufferBindingSize || 0) / (1024*1024))}MB)
                </span>
              </div>
            </div>
          )}

          {/* Quota storage calculator */}
          {storageQuota && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center">
                  <HardDrive className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  Local Cache Quota:
                </span>
                <span>{storageQuota.usageMB} MB / {storageQuota.quotaMB} MB used ({storageQuota.percent}%)</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    storageQuota.percent > 85 ? 'bg-rose-500' : storageQuota.percent > 45 ? 'bg-amber-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min(storageQuota.percent, 100)}%` }}
                ></div>
              </div>
              {storageQuota.quotaMB < 300 && (
                <p className="text-[10px] text-rose-600 font-medium leading-relaxed bg-rose-50 p-2 rounded-lg border border-rose-100 mt-1">
                  💡 WARNING: Extremely restricted cache quota detected. Please avoid Private/Incognito windows or nested sandboxes to allow model weight downloads.
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleResetWebGpu}
              disabled={isResettingGpu}
              className="flex-1 min-w-[130px] inline-flex items-center justify-center py-2 px-3 border border-slate-200 hover:border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              {isResettingGpu ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin text-slate-400" />
                  Resetting Engine...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Reset WebGPU Engine
                </>
              )}
            </button>

            <button
              type="button"
              onClick={runDiagnostics}
              disabled={isDebugging}
              className="flex-1 min-w-[130px] inline-flex items-center justify-center py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
            >
              <Terminal className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Run Diagnostics
            </button>
          </div>

          {gpuResetSuccess && (
            <div className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg text-[11px] font-semibold text-center animate-pulse">
              ✅ Local WebGPU compilation state reset completed successfully!
            </div>
          )}
        </div>

        {/* Console / Diagnostics output panel */}
        {debugLogs.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 text-[11px] font-mono text-emerald-400 max-h-48 overflow-y-auto shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1 text-slate-400 text-[9px] uppercase tracking-wider font-sans">
              <span>Diagnostic Logs Console</span>
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1.5 animate-ping"></span>
                Online
              </span>
            </div>
            <div className="space-y-1">
              {debugLogs.map((log, index) => (
                <div key={index} className="leading-relaxed whitespace-pre-wrap">{log}</div>
              ))}
            </div>
          </div>
        )}

        {/* Diagnostics / Test Connection */}
        <div className="pt-2 space-y-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="w-full flex items-center justify-center py-2.5 px-4 border border-blue-200 rounded-lg text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-blue-200 transition disabled:opacity-65 shadow-sm"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin text-blue-600" />
                Probing & Debugging Connection...
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2 text-blue-600" />
                Test AI Connection & Debug Network
              </>
            )}
          </button>

          {isTesting && progressText && (
            <div className="p-4 bg-slate-50 border border-indigo-100 rounded-xl space-y-3 text-xs">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">Loading Model: {progressPercent}%</span>
                <span className="font-mono text-slate-400">First startup takes ~30s...</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-indigo-900/80 font-mono line-clamp-2 leading-relaxed bg-indigo-50/50 p-2 rounded">
                {progressText}
              </p>
            </div>
          )}

          {connectionStatus.tested && (
            <div className="space-y-3">
              {/* Main Result Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-start justify-between text-xs leading-relaxed shadow-sm ${
                  connectionStatus.success
                    ? 'bg-emerald-50/90 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50/90 text-rose-900 border-rose-200'
                }`}
              >
                <div className="flex items-start space-x-2.5">
                  {connectionStatus.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="font-bold text-sm">
                      {connectionStatus.success ? 'Connection Operational' : 'Connection Blocked or Failed'}
                    </div>
                    <div className="text-xs text-slate-700">{connectionStatus.message}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDebugDetails(!showDebugDetails)}
                  className="shrink-0 ml-2 inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-lg bg-white/80 hover:bg-white border border-slate-200 text-slate-700 transition"
                >
                  {showDebugDetails ? (
                    <>
                      <span>Hide Debugger</span>
                      <ChevronUp className="w-3.5 h-3.5 ml-1" />
                    </>
                  ) : (
                    <>
                      <span>View Debug Details</span>
                      <ChevronDown className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </button>
              </div>

              {/* Detailed Connection Inspector & Debugger */}
              {showDebugDetails && connectionStatus.diagnostics && (
                <div className="bg-slate-900 text-slate-200 border border-slate-800 rounded-xl p-4 space-y-4 text-xs shadow-lg">
                  {/* Inspector Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <Terminal className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold font-sans text-sm text-white">Connection Diagnostics Inspector</span>
                    </div>
                    <button
                      type="button"
                      onClick={copyDiagnosticReport}
                      className="inline-flex items-center px-2.5 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
                    >
                      {copiedReport ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Report Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          <span>Copy Diagnostic Report</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Context Metrics Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-slate-800/80 border border-slate-700/60">
                      <span className="text-slate-400 text-[10px] block font-sans uppercase">App Host Origin</span>
                      <span className="text-white font-medium truncate block">{connectionStatus.diagnostics.origin}</span>
                      <span className="text-[10px] text-cyan-300">
                        {connectionStatus.diagnostics.isHttps ? '🔒 Secure Origin (HTTPS)' : '🔓 Plain HTTP'}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-slate-800/80 border border-slate-700/60">
                      <span className="text-slate-400 text-[10px] block font-sans uppercase">Target AI Endpoint</span>
                      <span className="text-white font-medium truncate block">{connectionStatus.diagnostics.targetUrl}</span>
                      <span className="text-[10px] text-slate-400">
                        Backend: <strong className="text-cyan-300">{config.aiMode}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Root Cause Alert & Quick Actions */}
                  {connectionStatus.diagnostics.errorType === 'PNA_OR_MIXED_CONTENT' && (
                    <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-600/50 space-y-2.5 text-amber-200">
                      <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs">
                        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Root Cause: Browser Mixed Content & Private Network Access Policy</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-200/90">
                        Your PWA is served over <strong>HTTPS</strong> (GitHub Pages), but local Ollama runs on <strong>HTTP</strong> (<code className="bg-amber-900/60 px-1 py-0.5 rounded text-amber-100">{connectionStatus.diagnostics.targetUrl}</code>). 
                        Modern Chromium browsers automatically reject cross-origin requests from public web domains to private localhost IPs unless explicitly authorized.
                      </p>

                      {/* Quick Fixes */}
                      <div className="space-y-1.5 pt-1 text-[11px]">
                        <div className="font-semibold text-amber-300 font-sans">Recommended Resolutions:</div>
                        <div className="p-2 bg-slate-900/90 rounded border border-amber-800/50 space-y-1 text-slate-300">
                          <div>
                            <span className="text-emerald-400 font-bold">1. Chrome Flag (Instant Fix):</span> Open a new tab to <code className="bg-slate-800 text-amber-300 px-1 py-0.5 rounded select-all font-mono">chrome://flags/#block-insecure-private-network-requests</code>, set to <strong>Disabled</strong>, then restart your browser.
                          </div>
                          <div>
                            <span className="text-emerald-400 font-bold">2. PWA Site Settings:</span> Click the lock / tune icon in your address bar / PWA window ➔ <em>Site settings</em> ➔ change <strong>Insecure content</strong> to <strong>Allow</strong>.
                          </div>
                          <div>
                            <span className="text-emerald-400 font-bold">3. Start Ollama with CORS:</span> Make sure Ollama was run with <code className="bg-slate-800 text-amber-300 px-1 py-0.5 rounded select-all font-mono">OLLAMA_ORIGINS=&quot;*&quot; ollama serve</code>.
                          </div>
                        </div>
                      </div>

                      {/* Fallback button to switch to Transformers.js */}
                      <div className="pt-1 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleModeChange('transformersjs')}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-semibold shadow transition"
                        >
                          <Zap className="w-3.5 h-3.5 mr-1.5 text-yellow-300" />
                          Switch to In-Browser Transformers.js (Zero Network / 100% Offline)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Alternative Suggestion (e.g. 127.0.0.1 responded!) */}
                  {connectionStatus.diagnostics.alternativeSuggestion && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-600/50 rounded-lg flex items-center justify-between text-xs text-emerald-200">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Alternative IP <strong className="text-white">{connectionStatus.diagnostics.alternativeSuggestion.url}</strong> responded successfully!</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyAlternativeUrl(connectionStatus.diagnostics!.alternativeSuggestion!.url)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs transition shrink-0"
                      >
                        {connectionStatus.diagnostics.alternativeSuggestion.label}
                      </button>
                    </div>
                  )}

                  {/* Step-by-Step Diagnostic Probes */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
                      Diagnostic Probe Sequence
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      {connectionStatus.diagnostics.steps.map((s, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded bg-slate-800/60 border border-slate-700/40 flex items-start space-x-2"
                        >
                          {s.status === 'success' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : s.status === 'error' ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          ) : s.status === 'warning' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          ) : (
                            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          )}
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-200">{s.step}</span>
                              <span className="text-[10px] text-slate-500">{s.timestamp}</span>
                            </div>
                            {s.details && (
                              <div className="text-[10px] text-slate-400 break-words leading-relaxed">
                                {s.details}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Raw Debug Logs Accordion */}
                  {connectionStatus.debugLogs && connectionStatus.debugLogs.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
                        Raw Network Console Logs
                      </div>
                      <div className="bg-black/60 p-2.5 rounded border border-slate-800 font-mono text-[10px] text-emerald-400 max-h-32 overflow-y-auto space-y-0.5">
                        {connectionStatus.debugLogs.map((log, i) => (
                          <div key={i} className="leading-tight break-all">{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
