import React, { useState, useRef } from 'react';
import { Feature, InputField } from '../types';
import { TestGenDB } from '../db/indexedDB';
import { 
  Folder, Plus, Trash2, Edit3, Upload, Download, Play, 
  HelpCircle, ChevronRight, CheckCircle2, AlertTriangle, FileJson
} from 'lucide-react';

interface FeatureManagerProps {
  features: Feature[];
  selectedFeatureId: string;
  onSelectFeature: (id: string) => void;
  onRefreshFeatures: () => Promise<void>;
  db: TestGenDB;
}

export default function FeatureManager({
  features,
  selectedFeatureId,
  onSelectFeature,
  onRefreshFeatures,
  db
}: FeatureManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<'create' | 'update'>('create');
  
  // Feature states
  const [featureId, setFeatureId] = useState('');
  const [featureName, setFeatureName] = useState('');
  const [featureVersion, setFeatureVersion] = useState('1.0');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featureAssumptions, setFeatureAssumptions] = useState('');
  const [inputFields, setInputFields] = useState<InputField[]>([]);
  const [businessRules, setBusinessRules] = useState<string[]>([]);
  const [outputObj, setOutputObj] = useState<Record<string, string>>({});
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [featureReference, setFeatureReference] = useState('');

  // Advanced Raw JSON Editor Toggle
  const [isRawJsonMode, setIsRawJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');

  // UI States
  const [infoMessage, setInfoMessage] = useState({ text: '', type: 'info' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFeature = features.find(f => f.id === selectedFeatureId);

  // Field Form Helpers
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');
  const [newFieldRequired, setNewFieldRequired] = useState(true);
  const [newFieldDescription, setNewFieldDescription] = useState('');
  const [newFieldValidation, setNewFieldValidation] = useState('');

  // Business Rule Helpers
  const [newRuleText, setNewRuleText] = useState('');

  // Output Helpers
  const [newOutputKey, setNewOutputKey] = useState('');
  const [newOutputVal, setNewOutputVal] = useState('string');

  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setInfoMessage({ text, type });
    setTimeout(() => setInfoMessage({ text: '', type: 'info' }), 4000);
  };

  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    if (inputFields.some(f => f.name === newFieldName)) {
      showMessage('Field already exists', 'error');
      return;
    }
    setInputFields([...inputFields, {
      name: newFieldName.trim(),
      type: newFieldType,
      required: newFieldRequired,
      description: newFieldDescription.trim() || undefined,
      validation: newFieldValidation.trim() || undefined
    }]);
    setNewFieldName('');
    setNewFieldDescription('');
    setNewFieldValidation('');
  };

  const handleRemoveField = (idx: number) => {
    setInputFields(inputFields.filter((_, i) => i !== idx));
  };

  const handleAddRule = () => {
    if (!newRuleText.trim()) return;
    setBusinessRules([...businessRules, newRuleText.trim()]);
    setNewRuleText('');
  };

  const handleRemoveRule = (idx: number) => {
    setBusinessRules(businessRules.filter((_, i) => i !== idx));
  };

  const handleAddOutput = () => {
    if (!newOutputKey.trim()) return;
    setOutputObj({ ...outputObj, [newOutputKey.trim()]: newOutputVal });
    setNewOutputKey('');
  };

  const handleRemoveOutput = (key: string) => {
    const updated = { ...outputObj };
    delete updated[key];
    setOutputObj(updated);
  };

  const startCreate = () => {
    setEditMode('create');
    setFeatureId(`FEAT-${Date.now().toString().slice(-4)}`);
    setFeatureName('');
    setFeatureVersion('1.0');
    setFeatureDescription('');
    setFeatureAssumptions('');
    setInputFields([]);
    setBusinessRules([]);
    setOutputObj({});
    setDependencies([]);
    setFeatureReference('');
    setIsEditing(true);
    setIsRawJsonMode(false);
  };

  const startEdit = (feat: Feature) => {
    setEditMode('update');
    setFeatureId(feat.id);
    setFeatureName(feat.name);
    setFeatureVersion(feat.version);
    setFeatureDescription(feat.description);
    setFeatureAssumptions(feat.assumptions || '');
    setInputFields(feat.input_fields);
    setBusinessRules(feat.business_rules);
    setOutputObj(feat.output);
    setDependencies(feat.dependencies || []);
    setFeatureReference(feat.reference || '');
    
    // Format JSON text in case they switch to raw json mode
    setRawJsonText(JSON.stringify(feat, null, 2));
    
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      let finalFeature: Feature;

      if (isRawJsonMode) {
        try {
          const parsed = JSON.parse(rawJsonText);
          if (!parsed.id || !parsed.name || !parsed.description) {
            showMessage('JSON data must contain id, name, and description fields', 'error');
            return;
          }
          finalFeature = parsed as Feature;
        } catch (e: any) {
          showMessage(`JSON syntax error: ${e.message}`, 'error');
          return;
        }
      } else {
        if (!featureId.trim()) {
          showMessage('Feature ID cannot be empty', 'error');
          return;
        }
        if (!featureName.trim()) {
          showMessage('Feature name cannot be empty', 'error');
          return;
        }

        finalFeature = {
          id: featureId.trim().toUpperCase(),
          name: featureName.trim(),
          version: featureVersion.trim() || '1.0',
          description: featureDescription.trim(),
          assumptions: featureAssumptions.trim() || undefined,
          input_fields: inputFields,
          business_rules: businessRules,
          output: outputObj,
          dependencies: dependencies,
          reference: featureReference.trim() || undefined
        };
      }

      // Check if ID already exists on creation
      if (editMode === 'create' && features.some(f => f.id === finalFeature.id)) {
        showMessage(`Feature ID [${finalFeature.id}] already exists. Please enter a unique ID.`, 'error');
        return;
      }

      await db.saveFeature(finalFeature);
      await onRefreshFeatures();
      onSelectFeature(finalFeature.id);
      setIsEditing(false);
      showMessage('Feature specification saved successfully!', 'success');
    } catch (err: any) {
      showMessage(`Save failed: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete feature spec [${id}]? Associated generation cache will also be unindexed.`)) return;

    try {
      await db.deleteFeature(id);
      await onRefreshFeatures();
      if (selectedFeatureId === id) {
        const remaining = features.filter(f => f.id !== id);
        if (remaining.length > 0) {
          onSelectFeature(remaining[0].id);
        } else {
          onSelectFeature('');
        }
      }
      showMessage('Feature specification deleted', 'success');
    } catch (err: any) {
      showMessage(`Deletion failed: ${err.message}`, 'error');
    }
  };

  // Toggle editor mode
  const toggleRawJsonMode = () => {
    if (!isRawJsonMode) {
      // Form -> JSON
      const currentObj = {
        id: featureId,
        name: featureName,
        version: featureVersion,
        description: featureDescription,
        assumptions: featureAssumptions,
        input_fields: inputFields,
        business_rules: businessRules,
        output: outputObj,
        dependencies: dependencies,
        reference: featureReference
      };
      setRawJsonText(JSON.stringify(currentObj, null, 2));
    } else {
      // JSON -> Form
      try {
        const parsed = JSON.parse(rawJsonText);
        setFeatureId(parsed.id || '');
        setFeatureName(parsed.name || '');
        setFeatureVersion(parsed.version || '1.0');
        setFeatureDescription(parsed.description || '');
        setFeatureAssumptions(parsed.assumptions || '');
        setInputFields(parsed.input_fields || []);
        setBusinessRules(parsed.business_rules || []);
        setOutputObj(parsed.output || {});
        setDependencies(parsed.dependencies || []);
        setFeatureReference(parsed.reference || '');
      } catch (e) {
        showMessage('Current JSON has syntax errors. Please fix before returning to visual form.', 'error');
        return;
      }
    }
    setIsRawJsonMode(!isRawJsonMode);
  };

  // Import Features
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const importedArray = Array.isArray(parsed) ? parsed : [parsed];

        let successCount = 0;
        for (const item of importedArray) {
          if (item.id && item.name && item.description) {
            await db.saveFeature(item);
            successCount++;
          }
        }

        await onRefreshFeatures();
        if (successCount > 0) {
          onSelectFeature(importedArray[0].id);
          showMessage(`Successfully imported ${successCount} feature specification(s)!`, 'success');
        } else {
          showMessage('Import failed: JSON data must contain id, name, and description properties.', 'error');
        }
      } catch (err: any) {
        showMessage(`Failed to parse JSON file: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Export Features
  const handleExportAll = () => {
    if (features.length === 0) {
      showMessage('No feature specifications to export', 'info');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(features, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `features_export_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showMessage('Successfully exported all feature specifications JSON', 'success');
  };

  // Reset/Restore defaults
  const handleRestoreDefaults = async () => {
    if (!window.confirm('Resetting will restore default sample features. Existing features with identical IDs will be overwritten. Proceed?')) return;
    try {
      localStorage.removeItem('TestGenDB_seeded'); // For safe trigger
      await db.clearCache(); // Clean caches to maintain integrity
      // Force delete existing to let seed trigger cleanly
      for (const f of features) {
        await db.deleteFeature(f.id);
      }
      // Re-init
      await db.init();
      await onRefreshFeatures();
      if (features.length > 0) onSelectFeature(features[0].id);
      showMessage('Default sample features restored successfully!', 'success');
    } catch (err: any) {
      showMessage(`Reset failed: ${err.message}`, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* 1. Left: Features List (Column 4) */}
      <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col h-[650px]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-800">
            <Folder className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm">Feature Specs ({features.length})</span>
          </div>
          <button
            onClick={startCreate}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
            title="Add New Spec"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Bulk Operations */}
        <div className="p-3 bg-white border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 hover:text-blue-600 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={handleExportAll}
            className="flex items-center space-x-1 hover:text-blue-600 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export All</span>
          </button>
          <button
            onClick={handleRestoreDefaults}
            className="text-slate-400 hover:text-amber-600 transition text-[11px]"
          >
            Restore Defaults
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {features.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Folder className="w-10 h-10 mx-auto text-slate-200" />
              <p className="text-sm">No feature specs found</p>
              <button
                onClick={handleRestoreDefaults}
                className="text-xs text-blue-600 underline hover:text-blue-800"
              >
                Click here to restore sample specs
              </button>
            </div>
          ) : (
            features.map((feat) => (
              <div
                key={feat.id}
                onClick={() => {
                  onSelectFeature(feat.id);
                  setIsEditing(false);
                }}
                className={`p-3.5 cursor-pointer flex items-start justify-between group transition-all ${
                  selectedFeatureId === feat.id
                    ? 'bg-blue-50/65 border-l-4 border-blue-600 pl-2.5'
                    : 'hover:bg-slate-50/80 border-l-4 border-transparent'
                }`}
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                      {feat.id}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">v{feat.version}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 truncate">{feat.name}</h3>
                  <p className="text-xs text-slate-400 truncate line-clamp-1">{feat.description}</p>
                </div>
                <div className="flex items-center space-x-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(feat);
                    }}
                    className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-white transition"
                    title="Edit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(feat.id, e)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-white transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Right: Feature Details or Editor (Column 8) */}
      <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 h-[650px] overflow-y-auto flex flex-col">
        {isEditing ? (
          /* ================== EDITOR VIEW ================== */
          <div className="space-y-5 flex-1 flex flex-col min-h-0">
            {/* Editor Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {editMode === 'create' ? '✨ Create Feature Specification' : '📝 Edit Feature Specification'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isRawJsonMode ? 'Edit raw metadata in standard JSON' : 'Configure metadata using visual form'}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleRawJsonMode}
                className="text-xs flex items-center space-x-1 py-1.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition"
              >
                <FileJson className="w-3.5 h-3.5 text-blue-600" />
                <span>{isRawJsonMode ? 'Visual Form' : 'Advanced JSON Editor'}</span>
              </button>
            </div>

            {/* Editor Body */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-0 space-y-4">
              {isRawJsonMode ? (
                /* Raw JSON Textarea */
                <div className="h-full flex flex-col min-h-[350px]">
                  <textarea
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    className="w-full flex-1 p-4 font-mono text-xs border border-slate-200 rounded-lg bg-slate-900 text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[300px]"
                    placeholder="Enter valid JSON matching Feature schema..."
                  />
                  <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-xs mt-3 leading-relaxed flex items-start space-x-1.5">
                    <HelpCircle className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                    <span>Advanced Mode: Allows pasting full JSON specification including fields, rules, and outputs. Ensure JSON syntax is valid.</span>
                  </div>
                </div>
              ) : (
                /* Visual Form Fields */
                <div className="space-y-4 text-sm">
                  {/* Row: ID, Name, Version */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Feature Unique ID</label>
                      <input
                        type="text"
                        value={featureId}
                        onChange={(e) => setFeatureId(e.target.value)}
                        disabled={editMode === 'update'}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 font-mono focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                        placeholder="e.g. LOGIN-001"
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Feature Name</label>
                      <input
                        type="text"
                        value={featureName}
                        onChange={(e) => setFeatureName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. User Login Feature"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Version</label>
                      <input
                        type="text"
                        value={featureVersion}
                        onChange={(e) => setFeatureVersion(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="e.g. 1.0"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Feature Description</label>
                    <textarea
                      value={featureDescription}
                      onChange={(e) => setFeatureDescription(e.target.value)}
                      className="w-full px-3 py-1.5 h-16 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Describe the business logic and behavior of this module..."
                    />
                  </div>

                  {/* Assumptions / Pre-conditions */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Assumptions & Pre-conditions</label>
                    <textarea
                      value={featureAssumptions}
                      onChange={(e) => setFeatureAssumptions(e.target.value)}
                      className="w-full px-3 py-1.5 h-16 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="e.g. User is authenticated, payment account balance is positive, database index is updated..."
                    />
                  </div>

                  {/* Input Fields Section */}
                  <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">1. Input Fields</h4>
                    <div className="space-y-2">
                      {/* Field Inputs List */}
                      {inputFields.map((f, i) => (
                        <div key={i} className="bg-white px-3 py-2 rounded-lg border border-slate-200/60 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-800">
                              {f.name} <span className="text-slate-400 font-normal">({f.type})</span>
                              {f.required && <span className="text-rose-600 font-semibold ml-1.5">*Required</span>}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveField(i)}
                              className="text-slate-400 hover:text-rose-600 transition p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {(f.description || f.validation) && (
                            <div className="text-[11px] text-slate-500 pl-2 border-l-2 border-slate-100 space-y-0.5">
                              {f.description && <div><span className="font-medium text-slate-400">Desc:</span> {f.description}</div>}
                              {f.validation && <div><span className="font-medium text-slate-400">Val:</span> {f.validation}</div>}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add field tools */}
                      <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                          <div className="md:col-span-5">
                            <input
                              type="text"
                              value={newFieldName}
                              onChange={(e) => setNewFieldName(e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white outline-none"
                              placeholder="Field name (e.g. phone, username)"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <select
                              value={newFieldType}
                              onChange={(e) => setNewFieldType(e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white outline-none"
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                              <option value="array">Array</option>
                              <option value="object">Object</option>
                            </select>
                          </div>
                          <div className="md:col-span-2 flex items-center justify-center">
                            <label className="flex items-center text-xs text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newFieldRequired}
                                onChange={(e) => setNewFieldRequired(e.target.checked)}
                                className="mr-1 rounded text-blue-600 focus:ring-blue-500"
                              />
                              Required
                            </label>
                          </div>
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={handleAddField}
                              className="w-full py-1 bg-slate-800 text-white rounded hover:bg-slate-700 font-semibold text-xs transition"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newFieldDescription}
                            onChange={(e) => setNewFieldDescription(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white outline-none"
                            placeholder="Field Description (e.g. Unique registered email)"
                          />
                          <input
                            type="text"
                            value={newFieldValidation}
                            onChange={(e) => setNewFieldValidation(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white outline-none"
                            placeholder="Validation Rules (e.g. min: 3, max: 255, email)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Business Rules */}
                  <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">2. Business Rules</h4>
                    <div className="space-y-2">
                      {businessRules.map((r, i) => (
                        <div key={i} className="flex items-start justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 text-xs">
                          <span className="text-slate-700 leading-relaxed">{i+1}. {r}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(i)}
                            className="text-slate-400 hover:text-rose-600 transition p-1 shrink-0 ml-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Add rule input */}
                      <div className="flex space-x-2 pt-2 border-t border-dashed border-slate-200">
                        <input
                          type="text"
                          value={newRuleText}
                          onChange={(e) => setNewRuleText(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded bg-white outline-none"
                          placeholder="e.g. Show CAPTCHA after 3 failed attempts, max 10 requests per day..."
                        />
                        <button
                          type="button"
                          onClick={handleAddRule}
                          className="px-4 py-1 bg-slate-800 text-white rounded hover:bg-slate-700 font-semibold text-xs transition shrink-0"
                        >
                          Add Rule
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Output Parameters */}
                  <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">3. Expected Outputs</h4>
                    <div className="space-y-2">
                      {Object.entries(outputObj).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 text-xs">
                          <span className="font-mono text-slate-800">
                            <strong>{k}</strong> : <span className="text-blue-600">{v}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveOutput(k)}
                            className="text-slate-400 hover:text-rose-600 transition p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Add output fields */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 pt-2 border-t border-dashed border-slate-200">
                        <div className="md:col-span-5">
                          <input
                            type="text"
                            value={newOutputKey}
                            onChange={(e) => setNewOutputKey(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white outline-none"
                            placeholder="Output key (e.g. token, order_id)"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <select
                            value={newOutputVal}
                            onChange={(e) => setNewOutputVal(e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white outline-none"
                          >
                            <option value="string">string</option>
                            <option value="number">number</option>
                            <option value="integer">integer</option>
                            <option value="boolean">boolean</option>
                            <option value="object">object</option>
                            <option value="array">array</option>
                          </select>
                        </div>
                        <div className="md:col-span-3">
                          <button
                            type="button"
                            onClick={handleAddOutput}
                            className="w-full py-1 bg-slate-800 text-white rounded hover:bg-slate-700 font-semibold text-xs transition"
                          >
                            Add Param
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reference for Future Use */}
                  <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/30">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">4. Reference (For Future Use)</h4>
                    <textarea
                      value={featureReference}
                      onChange={(e) => setFeatureReference(e.target.value)}
                      className="w-full px-3 py-1.5 h-16 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white text-xs"
                      placeholder="Add external links, swagger docs, system design specifications, or general system maps here..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Error Notification inside editor */}
            {infoMessage.text && (
              <div
                className={`p-2.5 rounded-lg border text-xs leading-relaxed shrink-0 flex items-start space-x-2 ${
                  infoMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                    : 'bg-rose-50 text-rose-800 border-rose-100'
                }`}
              >
                {infoMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{infoMessage.text}</span>
              </div>
            )}

            {/* Editor Footer Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="py-2 px-4 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="py-2 px-5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-xs shadow-sm transition"
              >
                Save Spec
              </button>
            </div>
          </div>
        ) : selectedFeature ? (
          /* ================== DETAIL VIEW ================== */
          <div className="flex flex-col h-full text-slate-800">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded">
                    {selectedFeature.id}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">v{selectedFeature.version}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1.5">{selectedFeature.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => startEdit(selectedFeature)}
                className="flex items-center space-x-1.5 py-1.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs transition"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Spec</span>
              </button>
            </div>

            {/* Details Content */}
            <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
              {/* Description */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Feature Description</h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedFeature.description}</p>
              </div>

              {/* Assumptions & Pre-conditions */}
              {selectedFeature.assumptions && (
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Assumptions & Pre-conditions</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedFeature.assumptions}</p>
                </div>
              )}

              {/* Grid: Inputs and Outputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Input Fields */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center">
                    <span>1. Input Fields ({selectedFeature.input_fields.length})</span>
                  </h3>
                  {selectedFeature.input_fields.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No input fields</p>
                  ) : (
                    <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                      {selectedFeature.input_fields.map((field, idx) => (
                        <div key={idx} className="p-3 hover:bg-slate-50/40 transition text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-slate-700">{field.name}</span>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-slate-400">{field.type}</span>
                              {field.required ? (
                                <span className="text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-100/60 px-1.5 py-0.5 rounded">
                                  Required
                                </span>
                              ) : (
                                <span className="text-[10px] bg-slate-50 text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded">
                                  Optional
                                </span>
                              )}
                            </div>
                          </div>
                          {(field.description || field.validation) && (
                            <div className="text-[11px] text-slate-500 pl-2.5 border-l-2 border-slate-200/80 space-y-1 mt-1 leading-relaxed">
                              {field.description && (
                                <div>
                                  <strong className="text-slate-400">Description:</strong> {field.description}
                                </div>
                              )}
                              {field.validation && (
                                <div>
                                  <strong className="text-slate-400">Validation:</strong> <code className="font-mono bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-[10px]">{field.validation}</code>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outputs */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center">
                    <span>2. Expected Outputs ({Object.keys(selectedFeature.output).length})</span>
                  </h3>
                  {Object.keys(selectedFeature.output).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No outputs defined</p>
                  ) : (
                    <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                      {Object.entries(selectedFeature.output).map(([key, val]) => (
                        <div key={key} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/40 transition">
                          <span className="font-mono font-bold text-slate-700">{key}</span>
                          <span className="font-mono text-blue-600">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Business Rules */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">3. Business Rules</h3>
                {selectedFeature.business_rules.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No business rules defined</p>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-100 p-1 divide-y divide-slate-50">
                    {selectedFeature.business_rules.map((rule, idx) => (
                      <div key={idx} className="p-3 flex items-start text-xs text-slate-700 leading-relaxed hover:bg-slate-50/30 transition">
                        <span className="font-mono text-slate-400 mr-2.5 shrink-0 font-bold">{(idx + 1).toString().padStart(2, '0')}</span>
                        <span>{rule}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dependencies */}
              {selectedFeature.dependencies && selectedFeature.dependencies.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Dependencies (Feature IDs)</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedFeature.dependencies.map((dep) => (
                      <span key={dep} className="font-mono text-[11px] font-semibold bg-slate-50 border border-slate-200/60 text-slate-600 px-2 py-0.5 rounded-lg">
                        {dep}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reference */}
              {selectedFeature.reference && (
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100/80">
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Reference</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedFeature.reference}</p>
                </div>
              )}
            </div>

            {/* Actions Quick Run */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
              <span className="text-xs text-slate-400">Selected as main feature for test suite generation</span>
              <div className="flex items-center space-x-1.5 text-xs text-blue-600 font-semibold">
                <span>Ready</span>
                <ChevronRight className="w-4 h-4 animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          /* ================== NO SELECTION VIEW ================== */
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-4">
            <Folder className="w-16 h-16 text-slate-200" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-700">No Feature Selected</h3>
              <p className="text-xs max-w-sm leading-relaxed">
                Select a feature from the left list or click <span className="font-bold">"+"</span> to create a new specification.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
