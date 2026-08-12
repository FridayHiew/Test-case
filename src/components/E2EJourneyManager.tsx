import React, { useState, useEffect, useRef } from 'react';
import { E2EJourney, E2ETestCase, Feature, AIConfig } from '../types';
import { LLMClient } from '../services/llm';
import { 
  GitFork, Play, FileText, Sparkles, Plus, Trash2, Edit3, Save, 
  X, Check, AlertTriangle, Eye, Code, HelpCircle, ArrowRight,
  RefreshCw, CheckCircle2, ChevronRight, Terminal, Upload, Download,
  Folder, FolderOpen, Clipboard, Info, Layers, ListChecks, CheckSquare
} from 'lucide-react';

interface E2EJourneyManagerProps {
  config: AIConfig;
  llmClient: LLMClient;
  features: Feature[];
  active: boolean;
}

const DEFAULT_E2E_JOURNEYS: E2EJourney[] = [
  {
    id: 'journey-001',
    name: 'Unified Purchase Settlement & Inventory Reconciliation Pipeline',
    description: 'Validates a complete user transaction flow starting with secure login auth, continuing to multi-factor 3D-Secure payment routing, and executing final physical warehouse inventory reconciliation.',
    mermaidFlowchart: `graph TD
    A[LOGIN-001: User Authentication] -->|Token Granted| B[PAYMENT-001: Escrow Settlement]
    B -->|Low Risk Routing| C[INVENTORY-002: Stock Reconciliation]
    B -->|High Risk Flagged| D[MFA-001: 3D-Secure Verification]
    D -->|Auth Passed| C
    D -->|Auth Failed| E[FRAUD-999: Transaction Lockout]`,
    testCases: [
      {
        id: 'E2E-TC-001',
        name: 'Happy-path Standard Settlement Flow',
        flowPath: 'LOGIN-001 ➡️ PAYMENT-001 ➡️ INVENTORY-002',
        preconditions: [
          'User authenticated session token is valid and set in context.',
          'Warehouse safety buffer stock levels for item_id "sku-8891" is normal (> 10 units).'
        ],
        steps: [
          '1. [LOGIN-001] Input username="e2e_auditor" and password="PassWord123!" into login fields and trigger verification.',
          '2. [LOGIN-001] Capture jwt_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" from output contract response.',
          '3. [PAYMENT-001] Inject jwt_token in Authorization header. Send checkout payload with cartId="cart-f47ac10b", amount=149.99, and currency="USD".',
          '4. [PAYMENT-001] Payment engine scores transaction as low risk. Capture settlement status="completed" and charge_id="chg_010203".',
          '5. [INVENTORY-002] Pass charge_id to warehouse stock decrementor and confirm stock_level matches normal bounds.'
        ],
        expected: 'Expected outputs: paymentIntentId="tx_889122", totalCharged=149.99, status="success", and stock levels are decremented by exactly 1 unit.'
      }
    ]
  }
];

export default function E2EJourneyManager({ config, llmClient, features, active }: E2EJourneyManagerProps) {
  const [journeys, setJourneys] = useState<E2EJourney[]>(() => {
    const local = localStorage.getItem('e2e_journeys');
    return local ? JSON.parse(local) : DEFAULT_E2E_JOURNEYS;
  });

  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(
    journeys.length > 0 ? journeys[0].id : ''
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMermaid, setEditMermaid] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [activeTestCaseId, setActiveTestCaseId] = useState<string | null>(null);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const [copiedStepIdx, setCopiedStepIdx] = useState<number | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentJourney = journeys.find(j => j.id === selectedJourneyId);

  useEffect(() => {
    localStorage.setItem('e2e_journeys', JSON.stringify(journeys));
  }, [journeys]);

  // Set default active test case when current journey changes
  useEffect(() => {
    if (currentJourney && currentJourney.testCases && currentJourney.testCases.length > 0) {
      setActiveTestCaseId(currentJourney.testCases[0].id);
    } else {
      setActiveTestCaseId(null);
    }
  }, [selectedJourneyId, journeys]);

  const handleStartEdit = () => {
    if (!currentJourney) return;
    setEditName(currentJourney.name);
    setEditDescription(currentJourney.description);
    setEditMermaid(currentJourney.mermaidFlowchart);
    setIsEditing(true);
  };

  const handleSaveJourney = () => {
    if (!currentJourney) return;
    const updated = journeys.map(j => {
      if (j.id === currentJourney.id) {
        return {
          ...j,
          name: editName,
          description: editDescription,
          mermaidFlowchart: editMermaid
        };
      }
      return j;
    });
    setJourneys(updated);
    setIsEditing(false);
  };

  const handleAddJourney = () => {
    const newJourney: E2EJourney = {
      id: `journey-${Date.now()}`,
      name: 'Custom System Lifecycle Journey',
      description: 'Define your multi-service interaction stages here using standard flowchart nodes and arrows.',
      mermaidFlowchart: `graph TD
    A[LOGIN-001: Auth Portal] -->|Login Success| B[ORDER-001: Order Creator]
    B -->|Direct Checkout| C[PAYMENT-001: Payout Processing]`,
      testCases: []
    };
    setJourneys([...journeys, newJourney]);
    setSelectedJourneyId(newJourney.id);
    setIsEditing(true);
    setEditName(newJourney.name);
    setEditDescription(newJourney.description);
    setEditMermaid(newJourney.mermaidFlowchart);
  };

  const handleDeleteJourney = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (journeys.length <= 1) {
      alert('You must retain at least one E2E journey pipeline.');
      return;
    }
    const updated = journeys.filter(j => j.id !== id);
    setJourneys(updated);
    setSelectedJourneyId(updated[0].id);
  };

  const handleStartRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameId(id);
    setRenameVal(currentName);
  };

  const handleSaveRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!renameId || !renameVal.trim()) return;
    const updated = journeys.map(j => {
      if (j.id === renameId) {
        return { ...j, name: renameVal.trim() };
      }
      return j;
    });
    setJourneys(updated);
    setRenameId(null);
  };

  // Export current selected E2E Journey as JSON
  const handleExportJourney = (journey: E2EJourney) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(journey, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const sanitizedName = journey.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadAnchor.setAttribute("download", `${sanitizedName}-e2e-journey.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export ALL E2E Journeys as JSON
  const handleExportAllJourneys = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(journeys, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `all-saved-e2e-journeys.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import E2E Journey JSON
  const handleImportJourney = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result as string;
        const parsed = JSON.parse(fileContent);

        let importedJourneys: E2EJourney[] = [];
        if (Array.isArray(parsed)) {
          // If it is an array of journeys
          importedJourneys = parsed.map(j => ({
            ...j,
            id: j.id || `journey-imported-${Date.now()}-${Math.random()}`
          }));
        } else if (parsed && typeof parsed === 'object' && parsed.mermaidFlowchart) {
          // If it is a single journey
          importedJourneys = [{
            ...parsed,
            id: parsed.id || `journey-imported-${Date.now()}`
          }];
        } else {
          throw new Error('Invalid format. File must contain a mermaidFlowchart key or be a list of journeys.');
        }

        // Merge with existing journeys (prevent duplicate IDs)
        const updated = [...journeys];
        importedJourneys.forEach(imported => {
          const index = updated.findIndex(existing => existing.id === imported.id);
          if (index !== -1) {
            updated[index] = imported;
          } else {
            updated.push(imported);
          }
        });

        setJourneys(updated);
        setSelectedJourneyId(importedJourneys[0].id);
        alert(`Successfully imported ${importedJourneys.length} E2E Journey file(s).`);
      } catch (err: any) {
        alert(`Failed to import JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Compile / Generate smart concrete E2E test cases
  const handleGenerateE2ECases = async () => {
    if (!currentJourney) return;
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const generatedCases = await llmClient.generateE2E(
        currentJourney.name,
        currentJourney.description,
        currentJourney.mermaidFlowchart,
        features
      );

      const updated = journeys.map(j => {
        if (j.id === currentJourney.id) {
          return {
            ...j,
            testCases: generatedCases
          };
        }
        return j;
      });

      setJourneys(updated);
      if (generatedCases.length > 0) {
        setActiveTestCaseId(generatedCases[0].id);
      }
    } catch (err: any) {
      setGenerationError(err.message || 'Verification flow timeout. Please check your cloud connection.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyStepText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStepIdx(idx);
    setTimeout(() => setCopiedStepIdx(null), 1500);
  };

  const copyAllTestCase = (tc: E2ETestCase) => {
    const content = `Test Case: ${tc.name}\nFlow: ${tc.flowPath}\n\nPreconditions:\n${tc.preconditions.map(p => `- ${p}`).join('\n')}\n\nSteps:\n${tc.steps.map(s => s).join('\n')}\n\nExpected Outcomes:\n${tc.expected}`;
    navigator.clipboard.writeText(content);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Parses basic Mermaid "graph TD" or "graph LR" lines
  const parseMermaidToVisualNodes = (mermaidText: string) => {
    const nodes: Array<{ id: string; label: string; subText?: string }> = [];
    const edges: Array<{ source: string; target: string; label?: string }> = [];

    const lines = mermaidText.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('graph') || trimmed.startsWith('%%')) return;

      // Match node definition with brackets: ID[Title / Details]
      const nodeMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*\[(.*?)\]/);
      if (nodeMatch) {
        const id = nodeMatch[1].trim();
        const content = nodeMatch[2].trim();
        // Split ID from subtext if structured with a colon
        const parts = content.split(':');
        const label = parts[0].trim();
        const subText = parts[1] ? parts[1].trim() : undefined;
        
        if (!nodes.some(n => n.id === id)) {
          nodes.push({ id, label, subText });
        }
      }

      // Match edge connection with possible label: A -->|Label| B or A --> B
      const edgeMatchWithLabel = trimmed.match(/^([a-zA-Z0-9_-]+)\s*-->\s*\|(.*?)\|\s*([a-zA-Z0-9_-]+)/);
      const edgeMatchSimple = trimmed.match(/^([a-zA-Z0-9_-]+)\s*-->\s*([a-zA-Z0-9_-]+)/);

      if (edgeMatchWithLabel) {
        const source = edgeMatchWithLabel[1].trim();
        const label = edgeMatchWithLabel[2].trim();
        const target = edgeMatchWithLabel[3].trim();
        edges.push({ source, target, label });

        // Auto-seed missing nodes
        [source, target].forEach(id => {
          if (!nodes.some(n => n.id === id)) {
            nodes.push({ id, label: id });
          }
        });
      } else if (edgeMatchSimple) {
        const source = edgeMatchSimple[1].trim();
        const target = edgeMatchSimple[2].trim();
        edges.push({ source, target });

        // Auto-seed missing nodes
        [source, target].forEach(id => {
          if (!nodes.some(n => n.id === id)) {
            nodes.push({ id, label: id });
          }
        });
      }
    });

    return { nodes, edges };
  };

  const visualData = parseMermaidToVisualNodes(
    isEditing ? editMermaid : (currentJourney?.mermaidFlowchart || '')
  );

  const activeTestCase = currentJourney?.testCases?.find(tc => tc.id === activeTestCaseId);
  
  // Helper to check if a node or link is in the currently selected E2E case's flowPath string
  const isNodeActiveInPath = (nodeId: string) => {
    if (!activeTestCase) return false;
    const pathUpper = activeTestCase.flowPath.toUpperCase();
    return pathUpper.includes(nodeId.toUpperCase());
  };

  const isEdgeActiveInPath = (source: string, target: string) => {
    if (!activeTestCase) return false;
    const pathUpper = activeTestCase.flowPath.toUpperCase();
    const sourceIdx = pathUpper.indexOf(source.toUpperCase());
    const targetIdx = pathUpper.indexOf(target.toUpperCase());
    return sourceIdx !== -1 && targetIdx !== -1 && sourceIdx < targetIdx;
  };

  if (!currentJourney) return null;

  return (
    <div className="space-y-6">
      {/* Primary Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <GitFork className="w-5 h-5 animate-pulse" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Mermaid E2E Journey Manager</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            Design complete end-to-end user lifecycles. Generate **detailed, highly concrete test cases** complete with mock test parameters, explicit API steps, and system outcome contracts.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Hidden Import file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJourney}
            accept=".json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-xs"
            title="Import JSON Journey file"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Import File
          </button>

          <button
            type="button"
            onClick={handleExportAllJourneys}
            className="inline-flex items-center px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition shadow-xs"
            title="Export all journeys as .json archive"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Export Archive
          </button>
        </div>
      </div>

      {/* Workspace Split Layout: 3-Columns on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMN 1: E2E Journey Repository Browser (File Manager Concept) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4.5 flex flex-col h-full min-h-[450px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center">
                <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                Journey Repository
              </span>
              <button
                type="button"
                onClick={handleAddJourney}
                className="p-1 hover:bg-indigo-50 rounded text-indigo-600 transition"
                title="Create New E2E File"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List of Journeys (Styled as files) */}
            <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[380px] pr-1">
              {journeys.map(j => {
                const isSelected = j.id === selectedJourneyId;
                const isRenaming = renameId === j.id;

                return (
                  <div
                    key={j.id}
                    onClick={() => {
                      if (!isRenaming) setSelectedJourneyId(j.id);
                    }}
                    className={`group w-full p-2.5 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-150/40' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5">
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-500 group-hover:bg-slate-100'
                      }`}>
                        <FileText className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <div className="flex items-center space-x-1.5 mt-0.5" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renameVal}
                              onChange={(e) => setRenameVal(e.target.value)}
                              className="w-full px-2 py-1 border border-indigo-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none font-semibold text-slate-800"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleSaveRename}
                              className="p-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameId(null);
                              }}
                              className="p-1 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-800 block truncate leading-tight group-hover:text-indigo-900 transition">
                              {j.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold block font-mono">
                              {j.testCases?.length || 0} smart cases • {j.mermaidFlowchart.split('\n').filter(l => l.includes('-->')).length} links
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Hover Controls */}
                    {!isRenaming && (
                      <div className="flex items-center justify-end space-x-1 border-t border-slate-100 mt-2.5 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(j.id, j.name, e)}
                          className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded transition text-[10px] font-bold inline-flex items-center"
                          title="Rename E2E File"
                        >
                          <Edit3 className="w-3 h-3 mr-0.5" />
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportJourney(j);
                          }}
                          className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded transition text-[10px] font-bold inline-flex items-center"
                          title="Export Single JSON File"
                        >
                          <Download className="w-3 h-3 mr-0.5" />
                          Export
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteJourney(j.id, e)}
                          className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded transition text-[10px] font-bold inline-flex items-center"
                          title="Delete Journey file"
                        >
                          <Trash2 className="w-3 h-3 mr-0.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-150 bg-slate-50/50 p-2.5 rounded-xl border text-[10px] text-slate-500 leading-normal flex items-start space-x-2">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Select your E2E Journey file block to inspect its interactive transition map, edit its underlying flow code, or generate detailed test files.
              </span>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Flowchart Map Visualizer & Mermaid Editor */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 space-y-4">
            
            {/* Toggle Editor vs Viewer */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Operational Map</span>
                {isEditing && (
                  <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Editing Mode
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setViewMode('visual')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center transition ${
                    viewMode === 'visual' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Live View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('code')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center transition ${
                    viewMode === 'code' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Code className="w-3.5 h-3.5 mr-1" />
                  Code
                </button>

                <div className="w-px h-4 bg-slate-200 mx-1.5" />

                {isEditing ? (
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="p-1 hover:bg-slate-100 text-slate-500 rounded transition"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveJourney}
                      className="inline-flex items-center px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded transition shadow-sm"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="p-1 hover:bg-slate-100 text-slate-600 rounded transition"
                    title="Edit Metadata & Flowchart"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Info and Description */}
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Journey Name..."
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Describe the end-to-end journey parameters..."
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-800 text-sm leading-snug">{currentJourney.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{currentJourney.description}</p>
              </div>
            )}

            {/* Visual Graph View Mode */}
            {viewMode === 'visual' ? (
              <div className="border border-slate-150 rounded-xl bg-slate-50/50 p-5 flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden">
                <div className="absolute top-2.5 left-2.5 flex items-center space-x-1 text-[9px] text-slate-400 font-bold bg-white/85 py-1 px-2.5 rounded-lg border border-slate-100 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Highlight Traces Active</span>
                </div>

                {/* Styled Bespoke Graph Visualizer */}
                <div className="w-full space-y-4 pt-3 max-w-sm">
                  {visualData.nodes.map((node, index) => {
                    const isActive = isNodeActiveInPath(node.id);
                    const outgoingLinks = visualData.edges.filter(e => e.source === node.id);

                    return (
                      <div key={node.id} className="space-y-3">
                        {/* Render Node card */}
                        <div className={`p-3.5 rounded-xl border-2 transition-all flex items-start space-x-3 shadow-sm ${
                          isActive 
                            ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-100 scale-102 translate-x-0.5' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}>
                          <div className={`p-1.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                            isActive ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[9px] font-bold text-slate-400 font-mono tracking-wider block uppercase">{node.id}</span>
                            <h4 className="text-xs font-extrabold text-slate-800 leading-tight truncate">{node.label}</h4>
                            {node.subText && <p className="text-[10px] text-slate-500 leading-tight pt-0.5">{node.subText}</p>}
                          </div>
                        </div>

                        {/* Render links underneath the card */}
                        {outgoingLinks.length > 0 && (
                          <div className="pl-6 space-y-2">
                            {outgoingLinks.map((link, lIdx) => {
                              const linkActive = isEdgeActiveInPath(link.source, link.target);
                              return (
                                <div key={lIdx} className="flex items-center space-x-2 text-[10px]">
                                  <div className="flex flex-col items-center">
                                    <div className={`w-0.5 h-5 transition-colors ${
                                      linkActive ? 'bg-emerald-500' : 'bg-slate-200'
                                    }`} />
                                    <ArrowRight className={`w-3 h-3 rotate-90 transition-colors -mt-1 ${
                                      linkActive ? 'text-emerald-500' : 'text-slate-350'
                                    }`} />
                                  </div>

                                  {link.label && (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                                      linkActive 
                                        ? 'bg-emerald-100/60 text-emerald-800 border-emerald-200' 
                                        : 'bg-slate-100 text-slate-500 border-slate-150'
                                    }`}>
                                      {link.label}
                                    </span>
                                  )}
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                                    to {link.target}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Code Editor Mode */
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Standard Mermaid Flowchart Language</span>
                  <span className="font-mono text-slate-300">[graph TD / LR supported]</span>
                </div>
                <textarea
                  value={isEditing ? editMermaid : currentJourney.mermaidFlowchart}
                  onChange={(e) => {
                    if (isEditing) {
                      setEditMermaid(e.target.value);
                    } else {
                      handleStartEdit();
                      setEditMermaid(e.target.value);
                    }
                  }}
                  rows={8}
                  className="w-full p-3.5 border border-slate-200 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10px] leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="graph TD&#10;    A[LOGIN-001: Auth Portal] --> B[PAYMENT-001: Payout]"
                />
                <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-500 flex items-start space-x-2">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-slate-700 mb-0.5">Quick Syntax Helper</span>
                    Declare links with tags: <code>A --&gt;|Token Granted| B</code>. Use colon dividers to write details: <code>A[LOGIN-001: Security Portal]</code>.
                  </div>
                </div>
              </div>
            )}

            {/* Smart Analyzer Action Control */}
            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-bold">
                <GitFork className="w-3.5 h-3.5 text-slate-400" />
                <span>Detected Paths: {visualData.edges.length || 1} Branches</span>
              </div>

              <button
                type="button"
                onClick={handleGenerateE2ECases}
                disabled={isGenerating}
                className="w-full sm:w-auto inline-flex items-center justify-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-350 text-white text-xs font-bold rounded-xl transition shadow-md shadow-indigo-100"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Generating E2E Suites...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Compile Concrete Test Cases
                  </>
                )}
              </button>
            </div>

            {generationError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{generationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: Highly Concrete, "Normal-Style" Test Cases Display */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 space-y-4 min-h-[450px] flex flex-col">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-indigo-500" />
                E2E Test Suites
              </h3>
              <span className="bg-indigo-50 text-indigo-700 font-mono text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-100">
                {currentJourney.testCases?.length || 0} Saved
              </span>
            </div>

            {currentJourney.testCases && currentJourney.testCases.length > 0 ? (
              <div className="flex-1 flex flex-col space-y-4">
                
                {/* Compact Accordion Tabs */}
                <div className="grid grid-cols-1 gap-1.5">
                  {currentJourney.testCases.map((tc) => {
                    const isActive = activeTestCaseId === tc.id;
                    return (
                      <button
                        key={tc.id}
                        type="button"
                        onClick={() => setActiveTestCaseId(tc.id)}
                        className={`text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                          isActive 
                            ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100/50' 
                            : 'bg-slate-50/40 border-slate-150 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-0.5 truncate mr-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded font-mono">
                              {tc.id}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase font-mono tracking-wider">
                              Branch Path
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-800 leading-snug block truncate">
                            {tc.name}
                          </span>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 transition ${isActive ? 'text-indigo-600 translate-x-0.5' : 'text-slate-300'}`} />
                      </button>
                    );
                  })}
                </div>

                {/* Detail View of selected test case: Highly Detailed, Granular "Normal-Style" Test Case Render */}
                {activeTestCase && (
                  <div className="flex-1 bg-slate-50/50 border border-slate-150 rounded-xl p-4 space-y-4 text-[11px]">
                    
                    {/* Copy All Button */}
                    <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Granular Case Specifications
                      </span>
                      <button
                        type="button"
                        onClick={() => copyAllTestCase(activeTestCase)}
                        className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-bold text-[10px]"
                      >
                        {copiedSuccess ? (
                          <>
                            <Check className="w-3 h-3 mr-1 text-emerald-500" />
                            Copied Spec!
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-3 h-3 mr-1" />
                            Copy Full Spec
                          </>
                        )}
                      </button>
                    </div>

                    {/* Path mapping trace */}
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider font-sans">Trace flow Path</span>
                      <div className="p-2 bg-white border border-slate-150 rounded-lg flex items-center space-x-1.5 font-mono text-[9px] font-bold text-indigo-700 shadow-xs overflow-x-auto whitespace-nowrap">
                        <Terminal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{activeTestCase.flowPath}</span>
                      </div>
                    </div>

                    {/* Preconditions */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Preconditions & Initial State</span>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-150 space-y-1.5 shadow-xs">
                        {activeTestCase.preconditions.map((p, idx) => (
                          <div key={idx} className="flex items-start space-x-2 text-slate-700 leading-normal font-semibold">
                            <CheckSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chronological Action-by-Action Steps with parameters */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">Detailed Execution steps (Normal-Style)</span>
                      <div className="space-y-2">
                        {activeTestCase.steps.map((step, idx) => (
                          <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-150 shadow-xs space-y-1 relative group/step">
                            <button
                              type="button"
                              onClick={() => copyStepText(step, idx)}
                              className="absolute top-2 right-2 opacity-0 group-hover/step:opacity-100 p-0.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded transition"
                              title="Copy Step Text"
                            >
                              {copiedStepIdx === idx ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Clipboard className="w-3 h-3" />
                              )}
                            </button>
                            
                            <div className="flex items-center space-x-1 text-[9px] font-extrabold font-mono text-slate-400 uppercase">
                              <span className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded">STEP {idx + 1}</span>
                              {step.includes('[') && (
                                <span className="text-indigo-600">
                                  {step.match(/\[(.*?)\]/)?.[0] || 'Feature'}
                                </span>
                              )}
                            </div>

                            <p className="text-slate-700 font-semibold leading-relaxed pr-6">
                              {step.replace(/^\d+\.\s*|\[.*?\]\s*/g, '')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Unified Expected Outcome */}
                    <div className="space-y-1 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/60">
                      <span className="text-[9px] uppercase font-bold text-indigo-600 block tracking-wider flex items-center">
                        <ListChecks className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                        Expected Outcome Contracts & Assertions
                      </span>
                      <p className="text-slate-800 leading-relaxed font-bold text-xs">{activeTestCase.expected}</p>
                    </div>

                  </div>
                )}

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                <GitFork className="w-8 h-8 text-slate-350 mb-2.5" />
                <span className="text-xs font-bold text-slate-700 block">No concrete E2E test cases compiled</span>
                <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                  Click <strong>Compile Concrete Test Cases</strong> to have Gemini trace your flowchart and design a high-fidelity test checklist.
                </p>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
