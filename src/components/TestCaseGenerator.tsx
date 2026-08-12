import React, { useState, useEffect } from 'react';
import { Feature, TestResult, TestCase } from '../types';
import { TestGenDB } from '../db/indexedDB';
import { LLMClient, generateCacheKey } from '../services/llm';
import { formatResultToMarkdown } from '../utils/formatter';
import { 
  Play, Copy, Download, RefreshCw, Zap, Check, AlertCircle, 
  HelpCircle, Sparkles, ChevronDown, CheckCircle, Database
} from 'lucide-react';

interface TestCaseGeneratorProps {
  features: Feature[];
  selectedFeatureId: string;
  onSelectFeature: (id: string) => void;
  db: TestGenDB;
  llmClient: LLMClient;
  onCacheChange: () => void;
}

export default function TestCaseGenerator({
  features,
  selectedFeatureId,
  onSelectFeature,
  db,
  llmClient,
  onCacheChange
}: TestCaseGeneratorProps) {
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useCache, setUseCache] = useState(true);
  const [cacheStatus, setCacheStatus] = useState<'none' | 'hit' | 'miss'>('none');
  const [generationTimeMs, setGenerationTimeMs] = useState<number | null>(null);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Output Results
  const [result, setResult] = useState<TestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'cards' | 'markdown' | 'json'>('cards');
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedFeature = features.find(f => f.id === selectedFeatureId);

  // Sync state if selected feature changes
  useEffect(() => {
    setResult(null);
    setCacheStatus('none');
    setGenerationTimeMs(null);
    setErrorMessage('');
  }, [selectedFeatureId]);

  const handleGenerate = async () => {
    if (!selectedFeature) {
      setErrorMessage('Please select a feature specification from the dropdown above or Feature Repository.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');
    setCacheStatus('none');
    setProgressText('');
    setProgressPercent(0);
    const startTime = performance.now();

    try {
      const input = userInput.trim() || 'Generate comprehensive positive, negative, boundary, and security test cases';
      const cacheKey = await generateCacheKey(selectedFeature.id, input);

      if (useCache) {
        // 1. Try reading from cache
        const cached = await db.getCache(cacheKey);
        if (cached) {
          setResult(cached.result);
          setCacheStatus('hit');
          setGenerationTimeMs(Math.round(performance.now() - startTime));
          setIsGenerating(false);
          onCacheChange(); // Refresh cache stats in parent
          return;
        }
      }

      // 2. Cache miss, query AI backend
      setCacheStatus('miss');
      
      // Wire up progress listener
      llmClient.setProgressCallback((text, pct) => {
        setProgressText(text);
        setProgressPercent(pct);
      });

      const responseData = await llmClient.generate(selectedFeature, input);

      // 3. Save to IndexedDB Cache
      await db.saveCache(cacheKey, {
        cacheKey,
        featureId: selectedFeature.id,
        userInput: input,
        result: responseData,
        createdAt: new Date().toISOString()
      });

      setResult(responseData);
      setGenerationTimeMs(Math.round(performance.now() - startTime));
      onCacheChange(); // Notify parent of database cache change
    } catch (err: any) {
      setErrorMessage(err.message || 'Generation failed. Please check your AI configuration or network.');
      setCacheStatus('none');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!selectedFeature || !result) return;
    const md = formatResultToMarkdown(selectedFeature, result, userInput);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `TestCase_${selectedFeature.id}_${new Date().toISOString().slice(0,10)}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    if (!selectedFeature || !result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `TestCase_${selectedFeature.id}_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  const markdownContent = selectedFeature && result 
    ? formatResultToMarkdown(selectedFeature, result, userInput) 
    : '';

  return (
    <div className="space-y-6">
      {/* 1. Prompt and Control Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Feature Selector */}
          <div className="md:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Feature Specification</label>
            <div className="relative">
              <select
                value={selectedFeatureId}
                onChange={(e) => onSelectFeature(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition appearance-none cursor-pointer"
              >
                <option value="">-- Select a Feature Spec --</option>
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    [{f.id}] {f.name} (v{f.version})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* User Custom Demand */}
          <div className="md:col-span-8 space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Custom Test Scope / Requirements</span>
              <span className="text-[11px] text-slate-400 font-normal">Leave blank for full automatic suite</span>
            </label>
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              placeholder="e.g. Focus on boundary checks, rate limiting exceptions, security audit..."
            />
          </div>
        </div>

        {/* Generate triggers & Cache options */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-slate-100 gap-3">
          <div className="flex items-center space-x-4">
            <label className="flex items-center text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useCache}
                onChange={(e) => setUseCache(e.target.checked)}
                className="mr-1.5 h-3.5 w-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              Enable Smart IndexedDB Cache
            </label>
            <span className="text-[11px] text-slate-400">
              💡 Repeated queries hit instant offline cache without API calls.
            </span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedFeatureId}
            className="flex items-center justify-center space-x-2 py-2 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-blue-800 font-semibold text-sm shadow-sm transition disabled:opacity-55 disabled:cursor-not-allowed shrink-0"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>AI Generating Cases...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Test Cases with AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Loading State Animation */}
      {isGenerating && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-8 flex flex-col items-center justify-center space-y-4">
          {progressText ? (
            <div className="w-full max-w-lg space-y-4 text-center">
              <div className="relative mx-auto w-12 h-12 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-full animate-bounce">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-800">Browser WebLLM Engine Loading ({progressPercent}%)</h4>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <p className="text-[11px] font-mono text-indigo-900/80 bg-indigo-50/50 p-3 rounded-lg leading-relaxed text-left max-h-[100px] overflow-y-auto">
                  {progressText}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <Sparkles className="w-5 h-5 text-blue-500 absolute top-3.5 left-3.5 animate-pulse" />
              </div>
              <div className="text-center space-y-1 max-w-md">
                <h4 className="text-sm font-semibold text-slate-800">Synthesizing Structured Test Cases</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Analyzing input constraints, business rules, and equivalence classes to derive thorough test steps. This usually takes 3-8 seconds.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-800 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="font-semibold text-sm">Test Case Generation Failed</h5>
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* 4. Results Board */}
      {result && !isGenerating && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
          {/* Header & Meta Panel */}
          <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
            {/* Statuses */}
            <div className="flex items-center space-x-3">
              <span className="text-sm font-bold text-slate-800">Generated Results</span>
              {cacheStatus === 'hit' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 border border-emerald-100 text-emerald-700">
                  <Database className="w-3.5 h-3.5 mr-1" />
                  Cache Hit (0 Traffic)
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 border border-blue-100 text-blue-700">
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  Live AI Generated
                </span>
              )}
              {generationTimeMs && (
                <span className="text-xs text-slate-400">Time: {generationTimeMs}ms</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleCopyText(activeTab === 'markdown' ? markdownContent : JSON.stringify(result, null, 2))}
                className="flex items-center space-x-1 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="flex items-center space-x-1 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Export MD</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="flex items-center space-x-1 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition"
              >
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Sub-tabs selectors */}
          <div className="border-b border-slate-100 px-4 flex space-x-4">
            <button
              onClick={() => setActiveTab('cards')}
              className={`py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'cards' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Matrix Cards ({result.test_cases?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              className={`py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'markdown' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Markdown Spec Document
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'json' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Raw JSON Data
            </button>
          </div>

          {/* Tab Contents */}
          <div className="p-5 max-h-[550px] overflow-y-auto bg-slate-50/35">
            {activeTab === 'cards' && (
              <div className="space-y-5">
                {/* Coverage overview in Cards */}
                <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">QA Coverage Analysis</h4>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600">
                    {result.coverage.map((c, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cards List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.test_cases.map((tc) => {
                    const badgeStyles: Record<string, string> = {
                      positive: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                      negative: 'bg-rose-50 text-rose-700 border-rose-100',
                      boundary: 'bg-amber-50 text-amber-700 border-amber-100',
                      security: 'bg-purple-50 text-purple-700 border-purple-100',
                      performance: 'bg-blue-50 text-blue-700 border-blue-100',
                    };
                    const typeLabel: Record<string, string> = {
                      positive: 'Positive',
                      negative: 'Negative',
                      boundary: 'Boundary',
                      security: 'Security',
                      performance: 'Performance',
                    };

                    return (
                      <div key={tc.id} className="bg-white rounded-xl border border-slate-200/60 p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                              {tc.id}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 border rounded-full ${badgeStyles[tc.type] || 'bg-slate-100 text-slate-700'}`}>
                              {typeLabel[tc.type] || tc.type}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 leading-snug">{tc.title}</h4>
                          
                          {tc.preconditions.length > 0 && (
                            <div className="text-xs">
                              <span className="text-slate-400 font-medium">Precondition: </span>
                              <span className="text-slate-600">{tc.preconditions.join(' | ')}</span>
                            </div>
                          )}

                          <div className="space-y-1 pt-1">
                            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide block">Test Steps</span>
                            <ol className="text-xs text-slate-600 space-y-1">
                              {tc.steps.map((step, sIdx) => (
                                <li key={sIdx} className="flex items-start">
                                  <span className="font-mono text-[10px] text-slate-400 mr-1 shrink-0">{sIdx + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-50 bg-slate-50/50 p-2.5 rounded-lg">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide block mb-0.5">Expected Result</span>
                          <p className="text-xs font-semibold text-blue-700 leading-normal">{tc.expected}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'markdown' && (
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed">
                {markdownContent}
              </div>
            )}

            {activeTab === 'json' && (
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed">
                {JSON.stringify(result, null, 2)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
