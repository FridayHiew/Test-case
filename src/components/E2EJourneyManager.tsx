import React, { useState, useEffect } from 'react';
import { E2EJourney, E2ETestCase, Feature, AIConfig } from '../types';
import { LLMClient } from '../services/llm';
import { 
  GitFork, Play, FileText, Sparkles, Plus, Trash2, Edit3, Save, 
  X, Check, AlertTriangle, Eye, Code, HelpCircle, ArrowRight,
  RefreshCw, CheckCircle2, ChevronRight, Terminal
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
          'User authentication subsystem is active.',
          'Warehouse safety buffer inventory levels are normal (> 10 units).'
        ],
        steps: [
          '1. Perform user login authentication at LOGIN-001 using valid credentials.',
          '2. Securely carry forward session token to PAYMENT-001 escrow gateway.',
          '3. Trigger standard checkout transaction under PAYMENT-001. System scores fraud pattern as low risk.',
          '4. Directly pass transaction ID outputs to INVENTORY-002 and trigger stock level updates.'
        ],
        expected: 'User checkout completes. Multi-warehouse proximity allocation completes. Stock units are decremented cleanly without conflicts.'
      },
      {
        id: 'E2E-TC-002',
        name: 'Anomalous Transaction with Escalated MFA Verification Success',
        flowPath: 'LOGIN-001 ➡️ PAYMENT-001 ➡️ MFA-001 ➡️ INVENTORY-002',
        preconditions: [
          '3D-Secure gateway trigger parameter is initialized.',
          'Warehouse stock is locked row-level.'
        ],
        steps: [
          '1. Log user in via LOGIN-001 and request a secure verification context.',
          '2. Trigger checkout at PAYMENT-001 with anomalous telemetry coordinates to stimulate a high risk score.',
          '3. Intercept execution and dispatch high-risk payload to MFA-001 challenge page.',
          '4. Input valid multi-factor verification code. Complete MFA validation sequence successfully.',
          '5. Direct state machine to authorize INVENTORY-002 stock reconciliation.'
        ],
        expected: 'Transaction is verified after second-factor authentication. Escrow funds are routed to schedules, and stock levels are synchronized.'
      },
      {
        id: 'E2E-TC-003',
        name: 'High-Risk Payment Multi-Factor Verification Rejection and Lockout',
        flowPath: 'LOGIN-001 ➡️ PAYMENT-001 ➡️ MFA-001 ➡️ FRAUD-999',
        preconditions: [
          'MFA thresholds set to maximum security strictness.',
          'Fraud reporting telemetry sinks are listening.'
        ],
        steps: [
          '1. Log user in via LOGIN-001.',
          '2. Dispatch high-risk transaction parameters to PAYMENT-001.',
          '3. Trigger 3D-Secure verification on MFA-001.',
          '4. Simulate dynamic verification failure (timeout/incorrect code inputs).',
          '5. Intercept checkout workflow and isolate user account into FRAUD-999 lockout state.'
        ],
        expected: 'Transaction is immediately aborted. Account state is flagged as suspicious. Fraud audit logs are generated and warehouse stock remains unaffected.'
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
  }, [selectedJourneyId]);

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

  const handleDeleteJourney = (id: string) => {
    if (journeys.length <= 1) {
      alert('You must retain at least one E2E journey pipeline.');
      return;
    }
    const updated = journeys.filter(j => j.id !== id);
    setJourneys(updated);
    setSelectedJourneyId(updated[0].id);
  };

  // Compile / Generate smart E2E test cases (exactly 1 per path analyzed by LLM)
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

  // Bespoke Flowchart Parsing & Node Grid Placement Visualizer
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <GitFork className="w-5 h-5 animate-pulse" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Mermaid E2E Journey Manager</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
            Design complete end-to-end user lifecycles using structured Mermaid text graphs. The system automatically parses each execution branch to generate <strong>exactly 1 highly robust E2E test case per path</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedJourneyId}
            onChange={(e) => setSelectedJourneyId(e.target.value)}
            className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
          >
            {journeys.map(j => (
              <option key={j.id} value={j.id}>{j.name.substring(0, 42)}...</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAddJourney}
            className="inline-flex items-center px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-xl transition shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Journey Pipeline
          </button>
        </div>
      </div>

      {/* Workspace Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Journey Details, Live Graph, and Code Editor */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 space-y-4">
            
            {/* Toggle Editor vs Viewer */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Operational Graph</span>
                {isEditing && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Editing Mode
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setViewMode('visual')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition ${
                    viewMode === 'visual' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Live Map View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('code')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition ${
                    viewMode === 'code' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Code className="w-3.5 h-3.5 mr-1" />
                  Edit Mermaid Code
                </button>

                <div className="w-px h-5 bg-slate-200 mx-2" />

                {isEditing ? (
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveJourney}
                      className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5 mr-1" />
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                    title="Edit Title & Flowchart"
                  >
                    <Edit3 className="w-4 h-4" />
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
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
                <h3 className="font-bold text-slate-800 text-base leading-snug">{currentJourney.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{currentJourney.description}</p>
              </div>
            )}

            {/* Visual Graph View Mode */}
            {viewMode === 'visual' ? (
              <div className="border border-slate-150 rounded-xl bg-slate-50/50 p-6 flex flex-col items-center justify-center min-h-[360px] relative overflow-hidden">
                <div className="absolute top-3 left-3 flex items-center space-x-1.5 text-[10px] text-slate-400 font-bold bg-white/80 py-1 px-2.5 rounded-lg border border-slate-100 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Interactive Flowpath Highlights Active</span>
                </div>

                {/* Styled Bespoke Graph Visualizer */}
                <div className="w-full space-y-6 pt-4 max-w-md">
                  {visualData.nodes.map((node, index) => {
                    const isActive = isNodeActiveInPath(node.id);
                    const outgoingLinks = visualData.edges.filter(e => e.source === node.id);

                    return (
                      <div key={node.id} className="space-y-4">
                        {/* Render Node card */}
                        <div className={`p-4 rounded-xl border-2 transition-all flex items-start space-x-3.5 shadow-sm ${
                          isActive 
                            ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-50 scale-102 translate-x-1' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}>
                          <div className={`p-2 rounded-lg font-mono text-xs font-bold ${
                            isActive ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-400 font-mono tracking-wider block uppercase">{node.id}</span>
                            <h4 className="text-xs font-extrabold text-slate-800 leading-tight">{node.label}</h4>
                            {node.subText && <p className="text-[10px] text-slate-500 leading-relaxed pt-0.5">{node.subText}</p>}
                          </div>
                        </div>

                        {/* Render links underneath the card */}
                        {outgoingLinks.length > 0 && (
                          <div className="pl-8 space-y-3">
                            {outgoingLinks.map((link, lIdx) => {
                              const linkActive = isEdgeActiveInPath(link.source, link.target);
                              return (
                                <div key={lIdx} className="flex items-center space-x-2 text-[11px]">
                                  {/* Styled Custom Edge Arrow */}
                                  <div className="flex flex-col items-center">
                                    <div className={`w-0.5 h-6 transition-colors ${
                                      linkActive ? 'bg-emerald-500' : 'bg-slate-200'
                                    }`} />
                                    <ArrowRight className={`w-3.5 h-3.5 rotate-90 transition-colors -mt-1 ${
                                      linkActive ? 'text-emerald-500' : 'text-slate-350'
                                    }`} />
                                  </div>

                                  {link.label && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                      linkActive 
                                        ? 'bg-emerald-100/60 text-emerald-800 border-emerald-200' 
                                        : 'bg-slate-100 text-slate-500 border-slate-150'
                                    }`}>
                                      {link.label}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
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
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Standard Mermaid Graph Language</span>
                  <span className="font-mono text-slate-300">[graph TD / graph LR supported]</span>
                </div>
                <textarea
                  value={isEditing ? editMermaid : currentJourney.mermaidFlowchart}
                  onChange={(e) => {
                    if (isEditing) {
                      setEditMermaid(e.target.value);
                    } else {
                      // Trigger edit automatically
                      handleStartEdit();
                      setEditMermaid(e.target.value);
                    }
                  }}
                  rows={8}
                  className="w-full p-4 border border-slate-200 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="graph TD&#10;    A[LOGIN-001: Auth Portal] --> B[PAYMENT-001: Payout]"
                />
                <div className="bg-slate-50 rounded-lg p-3.5 text-[11px] text-slate-500 flex items-start space-x-2">
                  <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-slate-700 mb-0.5">Quick Syntax Helper</span>
                    To create nodes with descriptive subtitles, use the bracket syntax: <code>NodeID[Short Label: Detailed Description Subtitle]</code>.
                  </div>
                </div>
              </div>
            )}

            {/* Smart Analyzer Action Control */}
            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-bold">
                <GitFork className="w-4 h-4 text-slate-400" />
                <span>Detected Paths: {visualData.edges.length || 1} Branches</span>
              </div>

              <button
                type="button"
                onClick={handleGenerateE2ECases}
                disabled={isGenerating}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-350 text-white text-xs font-bold rounded-xl transition shadow-md shadow-indigo-100"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Analyzing Flowpaths & Compiling E2E Suite...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                    Compile 1 Test Case Per Flow Path
                  </>
                )}
              </button>
            </div>

            {generationError && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{generationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Generated E2E Test Cases Display */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 space-y-4 min-h-[460px] flex flex-col">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-indigo-500" />
                Active E2E Test Case Suite
              </h3>
              <span className="bg-indigo-50 text-indigo-700 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-100">
                {currentJourney.testCases?.length || 0} Cases
              </span>
            </div>

            {currentJourney.testCases && currentJourney.testCases.length > 0 ? (
              <div className="flex-1 flex flex-col space-y-4">
                
                {/* Compact Accordion Tabs */}
                <div className="grid grid-cols-1 gap-2.5">
                  {currentJourney.testCases.map((tc) => {
                    const isActive = activeTestCaseId === tc.id;
                    return (
                      <button
                        key={tc.id}
                        type="button"
                        onClick={() => setActiveTestCaseId(tc.id)}
                        className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                          isActive 
                            ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100/50' 
                            : 'bg-slate-50/40 border-slate-150 hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-0.5 truncate mr-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-mono">
                              {tc.id}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase font-mono tracking-wider">
                              Path Coverage Test Case
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-800 leading-tight block truncate">
                            {tc.name}
                          </span>
                        </div>
                        <ChevronRight className={`w-4 h-4 transition ${isActive ? 'text-indigo-600 translate-x-0.5' : 'text-slate-350'}`} />
                      </button>
                    );
                  })}
                </div>

                {/* Detail View of selected test case */}
                {activeTestCase && (
                  <div className="flex-1 bg-slate-50/50 border border-slate-150 rounded-xl p-4.5 space-y-4 text-xs">
                    
                    {/* Path mapping header */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">E2E Operational Flow Path</span>
                      <div className="p-2.5 bg-white border border-slate-150 rounded-lg flex items-center space-x-2 font-mono text-[10px] font-bold text-indigo-700 shadow-xs overflow-x-auto whitespace-nowrap">
                        <Terminal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{activeTestCase.flowPath}</span>
                      </div>
                    </div>

                    {/* Preconditions */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Preconditions</span>
                      <ul className="list-disc pl-4 space-y-1 text-slate-600 leading-relaxed font-semibold">
                        {activeTestCase.preconditions.map((p, idx) => <li key={idx}>{p}</li>)}
                      </ul>
                    </div>

                    {/* Chronological Steps */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Chronological Trace Steps</span>
                      <div className="bg-white p-3.5 rounded-lg border border-slate-150 space-y-2.5 shadow-xs">
                        {activeTestCase.steps.map((step, idx) => (
                          <div key={idx} className="flex items-start space-x-2 text-slate-700 leading-normal font-semibold">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                            <span>{step.replace(/^\d+\.\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Unified Expected Outcome */}
                    <div className="space-y-1 bg-indigo-50/40 p-3 rounded-lg border border-indigo-50">
                      <span className="text-[10px] uppercase font-bold text-indigo-600 block tracking-wider">Unified Expected Result</span>
                      <span className="text-slate-800 leading-relaxed block font-semibold">{activeTestCase.expected}</span>
                    </div>

                  </div>
                )}

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                <GitFork className="w-8 h-8 text-slate-350 mb-2.5" />
                <span className="text-xs font-bold text-slate-700 block">No E2E cases generated yet</span>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                  Click the <strong>Analyze Flowpaths</strong> button to trigger Gemini to trace this Mermaid flowchart and generate exactly 1 E2E test case per path.
                </p>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
