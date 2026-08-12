import React, { useState, useEffect, useMemo } from 'react';
import { AIConfig, Feature } from './types';
import { TestGenDB } from './db/indexedDB';
import { LLMClient } from './services/llm';
import FeatureManager from './components/FeatureManager';
import TestCaseGenerator from './components/TestCaseGenerator';
import CacheManager from './components/CacheManager';
import SettingsPanel from './components/SettingsPanel';
import PwaPrompt from './components/PwaPrompt';
import { 
  Sparkles, Folder, Database, Settings, Cpu, Cloud, 
  FileSpreadsheet, Activity, Wifi, WifiOff, HelpCircle
} from 'lucide-react';

const DEFAULT_CONFIG: AIConfig = {
  aiMode: 'online',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:0.5b',
  webllmModel: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  openaiApiKey: '', // Empty means Built-in server proxy Gemini
  openaiBaseUrl: 'https://api.deepseek.com/v1',
  openaiModel: 'deepseek-chat',
  temperature: 0.3,
  maxTokens: 2000
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'generator' | 'manager' | 'cache' | 'settings'>('generator');
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>('');
  const [cacheCount, setCacheCount] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Initialize DB & LLM instances
  const db = useMemo(() => new TestGenDB(), []);
  
  // Load config from localStorage
  const [config, setConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('TestGen_Config');
    if (saved) {
      try {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  const llmClient = useMemo(() => new LLMClient(config), [config]);

  // Network listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save config to localStorage
  const handleConfigChange = (newConfig: AIConfig) => {
    setConfig(newConfig);
    localStorage.setItem('TestGen_Config', JSON.stringify(newConfig));
  };

  // Initialize DB and load specifications
  const initApp = async () => {
    try {
      await db.init();
      const allFeatures = await db.getFeatures();
      setFeatures(allFeatures);
      
      if (allFeatures.length > 0) {
        setSelectedFeatureId(allFeatures[0].id);
      }
      
      const count = await db.getCacheCount();
      setCacheCount(count);
      
      setIsInitialized(true);
    } catch (err) {
      console.error('Failed to initialize app database:', err);
    }
  };

  useEffect(() => {
    initApp();
  }, [db]);

  const refreshFeatures = async () => {
    const allFeatures = await db.getFeatures();
    setFeatures(allFeatures);
  };

  const refreshCacheStats = async () => {
    const count = await db.getCacheCount();
    setCacheCount(count);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500">
        <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold animate-pulse">Initializing IndexedDB storage engine...</p>
      </div>
    );
  }

  // Active channel label
  const channelLabel = config.aiMode === 'webllm'
    ? `WebLLM In-Browser (${config.webllmModel})`
    : config.aiMode === 'offline' 
      ? `Local Ollama (${config.ollamaModel})`
      : config.openaiApiKey 
        ? `Cloud API (${config.openaiModel})`
        : 'Built-in Gemini Cloud';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col pb-12 font-sans">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Titles */}
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm shadow-blue-500/20">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center">
                  AI Test Case Generator
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
                  Dual-Engine AI Productivity Suite with PWA & IndexedDB Caching
                </p>
              </div>
            </div>

            {/* Status Badges */}
            <div className="hidden md:flex items-center space-x-3 text-xs font-semibold">
              {/* Network Status */}
              <div className={`flex items-center px-2.5 py-1 rounded-full border ${
                isOnline 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                  : 'bg-rose-50 text-rose-700 border-rose-100'
              }`}>
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 mr-1.5" />
                    Online
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 mr-1.5" />
                    Offline Mode
                  </>
                )}
              </div>

              {/* Selected Model Status */}
              <div className={`flex items-center px-2.5 py-1 rounded-full border ${
                config.aiMode === 'webllm'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                  : config.aiMode === 'offline'
                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                    : 'bg-blue-50 text-blue-700 border-blue-100'
              }`}>
                {config.aiMode === 'webllm' ? (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                ) : config.aiMode === 'offline' ? (
                  <Cpu className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                )}
                <span>Channel: {channelLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 flex-1 flex flex-col space-y-6">
        {/* PWA Promotion Banner */}
        <PwaPrompt />

        {/* Responsive Info Badge for Mobile screens */}
        <div className="md:hidden bg-white border border-slate-200/80 rounded-xl p-3 flex items-center justify-between text-xs font-semibold shrink-0">
          <span className="text-slate-500">AI Compute Engine</span>
          <span className={`px-2 py-0.5 rounded-full ${
            config.aiMode === 'webllm'
              ? 'bg-indigo-50 text-indigo-700'
              : config.aiMode === 'offline' 
                ? 'bg-amber-50 text-amber-700' 
                : 'bg-blue-50 text-blue-700'
          }`}>
            {channelLabel}
          </span>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-1.5 flex flex-wrap gap-1 shadow-sm shrink-0">
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'generator'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Generate Cases</span>
          </button>

          <button
            onClick={() => setActiveTab('manager')}
            className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'manager'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Folder className="w-4 h-4 shrink-0" />
            <span>Feature Specs ({features.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('cache')}
            className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'cache'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 shrink-0" />
            <span>Cache Database ({cacheCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Engine Settings</span>
          </button>
        </div>

        {/* Tab Content Display Area */}
        <div className="flex-1">
          {activeTab === 'generator' && (
            <TestCaseGenerator
              features={features}
              selectedFeatureId={selectedFeatureId}
              onSelectFeature={setSelectedFeatureId}
              db={db}
              llmClient={llmClient}
              onCacheChange={refreshCacheStats}
            />
          )}

          {activeTab === 'manager' && (
            <FeatureManager
              features={features}
              selectedFeatureId={selectedFeatureId}
              onSelectFeature={setSelectedFeatureId}
              onRefreshFeatures={refreshFeatures}
              db={db}
            />
          )}

          {activeTab === 'cache' && (
            <CacheManager
              features={features}
              db={db}
              llmClient={llmClient}
              cacheCount={cacheCount}
              onCacheRefresh={refreshCacheStats}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel
              config={config}
              onConfigChange={handleConfigChange}
              llmClient={llmClient}
            />
          )}
        </div>
      </main>
    </div>
  );
}
