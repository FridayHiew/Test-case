import React, { useState, useEffect } from 'react';
import { Feature } from '../types';
import { TestGenDB } from '../db/indexedDB';
import { LLMClient, generateCacheKey } from '../services/llm';
import { 
  Database, Trash2, Flame, Loader2, CheckCircle2, 
  Info, TrendingUp, Clock, ShieldCheck
} from 'lucide-react';

interface CacheManagerProps {
  features: Feature[];
  db: TestGenDB;
  llmClient: LLMClient;
  cacheCount: number;
  onCacheRefresh: () => void;
}

export default function CacheManager({
  features,
  db,
  llmClient,
  cacheCount,
  onCacheRefresh
}: CacheManagerProps) {
  const [isPreheating, setIsPreheating] = useState(false);
  const [preheatProgress, setPreheatProgress] = useState({ current: 0, total: 0, currentFeatureName: '' });
  const [preheatResults, setPreheatResults] = useState<{ id: string; success: boolean; msg: string }[]>([]);
  const [flushSuccess, setFlushSuccess] = useState(false);

  // Simple statistics
  const timeSavedSec = cacheCount * 5.2; // approx 5.2 seconds saved per AI fetch
  const costSavedDollars = cacheCount * 0.0035; // approx $0.0035 saved per AI tokens query

  const handleClearCache = async () => {
    if (!window.confirm('Are you sure you want to clear all test case caches? This will delete all locally cached test cases.')) return;

    try {
      setFlushSuccess(false);
      await db.clearCache();
      
      // Crucial: IndexedDB commits transaction asynchronously. Wait 150ms to ensure full DB commit
      // before reading counts and updating React states.
      await new Promise(resolve => setTimeout(resolve, 150));
      
      onCacheRefresh();
      setPreheatResults([]);
      setFlushSuccess(true);
      setTimeout(() => setFlushSuccess(false), 4000);
    } catch (err: any) {
      alert(`Failed to clear cache: ${err.message}`);
    }
  };

  const handlePreheatCache = async () => {
    if (features.length === 0) {
      alert('There are no feature specifications in the repository. Please add or import features first.');
      return;
    }

    if (!window.confirm(`About to preheat default test suites for all [${features.length}] features. This will batch query your configured AI model. Continue?`)) return;

    setIsPreheating(true);
    setPreheatResults([]);
    setPreheatProgress({ current: 0, total: features.length, currentFeatureName: '' });

    const resultsLog: { id: string; success: boolean; msg: string }[] = [];

    for (let idx = 0; idx < features.length; idx++) {
      const feat = features[idx];
      setPreheatProgress(p => ({ ...p, current: idx + 1, currentFeatureName: feat.name }));

      try {
        const defaultInput = 'Generate comprehensive positive, negative, and boundary test cases';
        const cacheKey = await generateCacheKey(feat.id, defaultInput);

        // Check if already exists in cache
        const existing = await db.getCache(cacheKey);
        if (existing) {
          resultsLog.push({ id: feat.id, success: true, msg: 'Already Cached (Skipped)' });
          continue;
        }

        // Call LLM client
        const resultData = await llmClient.generate(feat, defaultInput);

        // Save cache
        await db.saveCache(cacheKey, {
          cacheKey,
          featureId: feat.id,
          userInput: defaultInput,
          result: resultData,
          createdAt: new Date().toISOString()
        });

        resultsLog.push({ id: feat.id, success: true, msg: 'Preheat Success' });
      } catch (err: any) {
        resultsLog.push({
          id: feat.id,
          success: false,
          msg: `Preheat Failed: ${err.message || 'AI Response Error'}`
        });
      }

      // Update statistics live
      onCacheRefresh();
      setPreheatResults([...resultsLog]);
      // Small sleep to throttle requests
      await new Promise(r => setTimeout(r, 600));
    }

    setIsPreheating(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Count Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wide">Cached Test Suites</span>
            <span className="text-2xl font-bold text-slate-800">{cacheCount} Suites</span>
          </div>
        </div>

        {/* Saved Time Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wide">Est. Time Saved</span>
            <span className="text-2xl font-bold text-slate-800">~{timeSavedSec.toFixed(1)}s</span>
          </div>
        </div>

        {/* Saved Cost Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block uppercase tracking-wide">Est. Token Cost Saved</span>
            <span className="text-2xl font-bold text-slate-800">${costSavedDollars.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* 2. Management Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
              <Database className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Cache Management</h2>
              <p className="text-xs text-slate-500">Flush cached cases or preheat default suites for sub-second offline responses</p>
            </div>
          </div>
        </div>

        {/* Content Action Split */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section: Preheat Cache */}
          <div className="space-y-3 border-r border-slate-100 pr-0 md:pr-6">
            <h3 className="text-sm font-bold text-slate-800 flex items-center">
              <Flame className="w-4 h-4 text-amber-600 mr-1.5" />
              Batch Suite Preheat
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Automatically pre-generate default positive, negative, and boundary test cases for all features in your repository so team members get instant responses.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePreheatCache}
                disabled={isPreheating || features.length === 0}
                className="inline-flex items-center py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-55 disabled:cursor-not-allowed"
              >
                {isPreheating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Preheating ({preheatProgress.current}/{preheatProgress.total})
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5 mr-1.5" />
                    Start Preheat Batch
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section: Clear Cache */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center">
                <Trash2 className="w-4 h-4 text-slate-400 mr-1.5" />
                Flush Store
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                If you updated model parameters, prompt engineering rules, or LLM backends, reset the cache store to align future outputs with your latest configuration.
              </p>
            </div>
            <div className="pt-2 flex items-center space-x-3">
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isPreheating}
                className="inline-flex items-center py-2 px-4 bg-rose-50 border border-rose-200 hover:bg-rose-100/50 text-rose-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                Flush All Caches
              </button>
              {flushSuccess && (
                <span className="inline-flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg animate-fade-in animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  Store Flushed!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Preheat Progress overlay */}
        {isPreheating && (
          <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-700">Preheating: {preheatProgress.currentFeatureName}</span>
              <span className="font-mono text-slate-500">
                {preheatProgress.current} / {preheatProgress.total} ({Math.round((preheatProgress.current / preheatProgress.total) * 100)}%)
              </span>
            </div>
            {/* Progress bar container */}
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(preheatProgress.current / preheatProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Preheat results logger */}
        {preheatResults.length > 0 && (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preheat Job Logs</h4>
            <div className="bg-slate-50/50 rounded-lg border border-slate-100 p-3 max-h-[160px] overflow-y-auto font-mono text-[11px] space-y-1">
              {preheatResults.map((res, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-slate-600">Feature [{res.id}]</span>
                  <span className={res.success ? 'text-emerald-600 font-semibold' : 'text-rose-600'}>
                    {res.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guide notice */}
        <div className="p-4.5 bg-blue-50/50 rounded-xl border border-blue-100/60 text-xs text-blue-800 flex items-start space-x-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p className="font-semibold">Local Storage & Data Isolation</p>
            <p>
              All feature metadata and generated test caches are stored locally inside browser IndexedDB & LocalStorage. There are no cloud data sync trackers, ensuring your spec information and test suites stay <strong>100% private and secure on your device.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
