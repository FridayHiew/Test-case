import React, { useState, useEffect } from 'react';
import { AIConfig } from '../types';
import { LLMClient, checkWebGPUAvailability } from '../services/llm';
import { Settings, Cpu, Cloud, CheckCircle, XCircle, RefreshCw, Sliders, Sparkles, AlertCircle, Database, HardDrive, Terminal, Activity, RotateCcw } from 'lucide-react';

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
  }>({ tested: false, success: false, message: '' });
  const [isTesting, setIsTesting] = useState(false);

  // Apply state changes to parent config
  const saveConfig = (updatedFields: Partial<AIConfig>) => {
    const newConfig = { ...config, ...updatedFields };
    onConfigChange(newConfig);
    llmClient.updateConfig(newConfig);
  };

  const handleModeChange = (mode: 'offline' | 'online' | 'webllm') => {
    saveConfig({ aiMode: mode });
    setConnectionStatus({ tested: false, success: false, message: '' });
    setProgressText('');
    setProgressPercent(0);
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
        message: res.message
      });
    } catch (err: any) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: err.message || '测试连接时发生未知错误。'
      });
    } finally {
      setIsTesting(false);
    }
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
            <h2 className="text-lg font-semibold text-slate-900">AI Core Settings</h2>
            <p className="text-xs text-slate-500">Configure engine backend, model parameters, and API options</p>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">AI Compute Backend</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange('webllm')}
            className={`flex items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
              config.aiMode === 'webllm'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4 mr-2 text-indigo-500 animate-pulse" />
            In-Browser (WebLLM)
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('offline')}
            className={`flex items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
              config.aiMode === 'offline'
                ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-4 h-4 mr-2 text-blue-500" />
            Local Server (Ollama)
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('online')}
            className={`flex items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
              config.aiMode === 'online'
                ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Cloud className="w-4 h-4 mr-2 text-blue-500" />
            Cloud Mode (API)
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed pt-1">
          {config.aiMode === 'webllm'
            ? '💡 In-Browser (WebLLM): Runs local WebAssembly model inside browser with GPU acceleration. 100% zero network requests and zero server dependencies!'
            : config.aiMode === 'offline'
              ? '💡 Local Server: Queries local Ollama service via HTTP. Your data never leaves your device.'
              : '💡 Cloud Mode: Use built-in Cloud Gemini model (free, no key needed) or custom OpenAI/DeepSeek endpoints.'}
        </p>
      </div>

      {/* Mode Settings Form */}
      {config.aiMode === 'webllm' ? (
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
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ollama Host URL</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => {
                setOllamaUrl(e.target.value);
                saveConfig({ ollamaUrl: e.target.value });
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="http://localhost:11434"
            />
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
              placeholder="e.g. qwen2.5:0.5b, llama3.2:1b"
            />
            <p className="text-[11px] text-slate-400 mt-1">Lightweight models are recommended for rapid local response time.</p>
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
        <div className="pt-2 space-y-2.5">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="w-full flex items-center justify-center py-2 px-4 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-slate-100 transition disabled:opacity-65"
          >
            {isTesting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Diagnosing Connection...
              </>
            ) : (
              'Test AI Connection'
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
            <div
              className={`p-3 rounded-lg border flex items-start space-x-2 text-xs leading-relaxed ${
                connectionStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                  : 'bg-rose-50 text-rose-800 border-rose-100'
              }`}
            >
              {connectionStatus.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>{connectionStatus.message}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
