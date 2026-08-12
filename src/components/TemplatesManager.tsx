import React, { useState } from 'react';
import { AIConfig, BaseCaseTemplate } from '../types';
import { LLMClient, DEFAULT_BASE_TEMPLATES } from '../services/llm';
import { 
  Database, RotateCcw, Trash2, Edit3, Save, Plus, X, 
  HelpCircle, Check, Sparkles, LayoutGrid, CheckCircle2 
} from 'lucide-react';

interface TemplatesManagerProps {
  config: AIConfig;
  onConfigChange: (newConfig: AIConfig) => void;
  llmClient: LLMClient;
}

export default function TemplatesManager({ config, onConfigChange, llmClient }: TemplatesManagerProps) {
  const [templates, setTemplates] = useState<BaseCaseTemplate[]>(() => {
    return config.programmaticTemplates && config.programmaticTemplates.length > 0
      ? config.programmaticTemplates
      : DEFAULT_BASE_TEMPLATES;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<'positive' | 'negative' | 'boundary' | 'security' | 'performance'>('positive');
  const [editPreconditions, setEditPreconditions] = useState('');
  const [editSteps, setEditSteps] = useState('');
  const [editExpected, setEditExpected] = useState('');

  const saveConfig = (updatedTemplates: BaseCaseTemplate[]) => {
    const newConfig = { ...config, programmaticTemplates: updatedTemplates };
    onConfigChange(newConfig);
    llmClient.updateConfig(newConfig);
  };

  const handleToggleTemplate = (id: string) => {
    const updated = templates.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t);
    setTemplates(updated);
    saveConfig(updated);
  };

  const handleStartEdit = (template: BaseCaseTemplate) => {
    setEditingId(template.id);
    setEditTitle(template.title);
    setEditType(template.type);
    setEditPreconditions(template.preconditions.join('\n'));
    setEditSteps(template.steps.join('\n'));
    setEditExpected(template.expected);
  };

  const handleSaveEdit = (id: string) => {
    const updated = templates.map(t => {
      if (t.id === id) {
        return {
          ...t,
          title: editTitle,
          type: editType,
          preconditions: editPreconditions.split('\n').map(l => l.trim()).filter(Boolean),
          steps: editSteps.split('\n').map(l => l.trim()).filter(Boolean),
          expected: editExpected
        };
      }
      return t;
    });
    setTemplates(updated);
    saveConfig(updated);
    setEditingId(null);
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    saveConfig(updated);
    if (editingId === id) setEditingId(null);
  };

  const handleAddTemplate = () => {
    const newTemplate: BaseCaseTemplate = {
      id: `custom-${Date.now()}`,
      title: 'Verify custom baseline behavior of "{feature_name}"',
      type: 'positive',
      enabled: true,
      preconditions: ['Subsystem "{feature_name}" is active.'],
      steps: ['1. Trigger the main workspace handler.', '2. Inspect the result state.'],
      expected: 'Outputs are generated correctly.'
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    saveConfig(updated);
    handleStartEdit(newTemplate);
  };

  const handleResetTemplates = () => {
    if (window.confirm('Are you sure you want to restore the programmatic test case baseline to factory defaults? This will erase all custom configurations.')) {
      setTemplates(DEFAULT_BASE_TEMPLATES);
      saveConfig(DEFAULT_BASE_TEMPLATES);
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Description Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Baseline Case Structure Templates</h2>
          </div>
          <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
            Configure the programmatic base test cases compiled instantly in-browser. This ensures key validation paths run at 0ms latency without consuming model tokens or hitting offline request limits.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetTemplates}
          className="inline-flex items-center text-xs font-semibold text-rose-600 hover:text-rose-800 transition py-2 px-3.5 bg-rose-50 border border-rose-100 hover:border-rose-200 rounded-lg"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Factory Reset Baseline
        </button>
      </div>

      {/* Placeholders Cheat Sheet */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
          <Sparkles className="w-4 h-4 mr-1.5 text-blue-500" />
          Placeholder Mapping Syntax Guide
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          The code compiler matches and replaces these tokens with active specification data when generating a test suite:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px] pt-1">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col space-y-1">
            <span className="font-bold text-blue-700"><code>{`{feature_name}`}</code></span>
            <span className="text-slate-500 text-[10px]">Replaced with feature spec name</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col space-y-1">
            <span className="font-bold text-blue-700"><code>{`{feature_id}`}</code></span>
            <span className="text-slate-500 text-[10px]">Standardized uppercase target spec identifier</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col space-y-1">
            <span className="font-bold text-blue-700"><code>{`{required_inputs}`}</code></span>
            <span className="text-slate-500 text-[10px]">Lists all fields tagged as required</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col space-y-1">
            <span className="font-bold text-blue-700"><code>{`{bounds_steps}`}</code></span>
            <span className="text-slate-500 text-[10px]">Calculates boundary steps dynamically from limit rules</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col space-y-1">
            <span className="font-bold text-blue-700"><code>{`{output_names}`}</code></span>
            <span className="text-slate-500 text-[10px]">Injects matching outputs contract schema dictionary</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col space-y-1">
            <span className="font-bold text-blue-700"><code>{`{dependencies}`}</code></span>
            <span className="text-slate-500 text-[10px]">Injects upstream module state prerequisites</span>
          </div>
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        {templates.map((template) => {
          const isEditing = editingId === template.id;

          return (
            <div key={template.id} className={`bg-white rounded-xl shadow-sm border p-5 space-y-4 transition ${
              isEditing ? 'border-blue-400 ring-2 ring-blue-50' : 'border-slate-200/80 hover:border-slate-300'
            }`}>
              {/* Header: Title, Type and Status toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={template.enabled}
                    onChange={() => handleToggleTemplate(template.id)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded cursor-pointer"
                    title={template.enabled ? 'Disable Template' : 'Enable Template'}
                  />
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      template.type === 'positive' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      template.type === 'negative' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                      template.type === 'boundary' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      template.type === 'security' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {template.type}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 font-bold">[{template.id}]</span>
                  </div>
                </div>

                {/* Actions */}
                {!isEditing && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(template)}
                      className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Edit Template
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50/50 border border-slate-200 hover:border-rose-200 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-400" />
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Edit Form */}
              {isEditing ? (
                <div className="space-y-4 bg-slate-50/50 p-4 border border-slate-150 rounded-xl text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Template Title Pattern</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-sans font-semibold text-slate-800"
                      placeholder="e.g. Verify execution of &quot;{feature_name}&quot;"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Test Type Category</label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="positive">Positive (Happy Path)</option>
                        <option value="negative">Negative (Error Handling)</option>
                        <option value="boundary">Boundary (Limits Check)</option>
                        <option value="security">Security (Injection Guard)</option>
                        <option value="performance">Performance (Load Guard)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Preconditions (One per line)</label>
                    <textarea
                      value={editPreconditions}
                      onChange={(e) => setEditPreconditions(e.target.value)}
                      rows={3}
                      className="w-full p-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-[11px] leading-normal"
                      placeholder="e.g. Subsystem &quot;{feature_name}&quot; is active."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Steps (One per line)</label>
                    <textarea
                      value={editSteps}
                      onChange={(e) => setEditSteps(e.target.value)}
                      rows={4}
                      className="w-full p-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-[11px] leading-normal"
                      placeholder="e.g. 1. Trigger the main workspace handler."
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Expected Outcome Pattern</label>
                    <textarea
                      value={editExpected}
                      onChange={(e) => setEditExpected(e.target.value)}
                      rows={3}
                      className="w-full p-3 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-[11px] leading-normal"
                      placeholder="e.g. Outputs are generated correctly according to specs."
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center px-3.5 py-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold transition"
                    >
                      <X className="w-4 h-4 mr-1 text-slate-500" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(template.id)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      <Save className="w-4 h-4 mr-1.5" />
                      Save Template Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 pl-5 border-l-2 border-slate-200/80">
                  <div className="font-semibold text-slate-800 text-sm leading-snug">{template.title}</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Preconditions</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        {template.preconditions.map((p, idx) => <li key={idx}>{p}</li>)}
                      </ul>
                    </div>
                    <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Test Scenario Steps</span>
                      <ul className="list-decimal pl-4 space-y-1 text-slate-600">
                        {template.steps.map((s, idx) => <li key={idx}>{s}</li>)}
                      </ul>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/30 rounded-lg border border-blue-50/50">
                    <span className="text-[10px] uppercase font-bold text-blue-500 block tracking-wider mb-0.5">Expected Outcome</span>
                    <span className="text-slate-700 text-xs font-semibold leading-relaxed block">{template.expected}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add trigger */}
      <button
        type="button"
        onClick={handleAddTemplate}
        className="w-full flex items-center justify-center py-3 px-4 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-xs font-bold text-slate-500 hover:text-blue-600 bg-white hover:bg-blue-50/30 transition shadow-sm"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Custom Baseline Template
      </button>
    </div>
  );
}
