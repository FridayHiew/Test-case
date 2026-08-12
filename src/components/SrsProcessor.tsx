import React, { useState, useEffect } from 'react';
import { Feature, InputField } from '../types';
import { TestGenDB } from '../db/indexedDB';
import { 
  FileText, Copy, Check, Play, RefreshCw, 
  HelpCircle, AlertCircle, Plus, LayoutGrid, ListCollapse, Database, Import
} from 'lucide-react';

interface SrsProcessorProps {
  db: TestGenDB;
  onImportComplete: () => void;
}

const LIST_TEMPLATE = `# SRS-001: User Profile Update
**Version:** 1.2.0
**Description:** Allows registered members to modify their profile name, avatar url, and subscription status.
**Assumptions / Pre-conditions:** User holds an active authenticated session with verified email permissions.

## Input Fields
- \`displayName\` (type: string, required: true, min: 3, max: 50, validation: "^[a-zA-Z0-9 ]+$", description: "Display name visible to other network users")
- \`avatarUrl\` (type: string, required: false, format: url, description: "Public HTTPS profile image web address")
- \`receiveEmails\` (type: boolean, required: false, description: "Opt-in flag for promotional and security email updates")

## Business Rules
1. Display name can only contain alphanumeric characters and spaces.
2. Profile updates are restricted to authenticated premium account holders.
3. If receiveEmails is true, the user email status must be confirmed.

## Expected Output Contracts
- \`status\`: "updated" | "failed"
- \`updatedAt\`: string (timestamp of modification)
- \`message\`: string (feedback)

## Dependencies
- USER-AUTH-001, COMPLIANCE-009

## Reference
- ISO/IEC 25010 Software Quality Model, IEEE Std 830-1998 SRS Guidelines`;

const TABLE_TEMPLATE = `# SRS-002: Payment Checkout
**Version:** 2.1.0
**Description:** Processes user checkout sessions and initiates secure Stripe payment sequences.
**Assumptions / Pre-conditions:** Payment gateway sandbox credentials and merchant account are active.

## Input Fields
| Field Name | Type | Required | Format/Limits | Validation | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| cartId | string | Yes | UUID format | ^[a-f0-9-]{36}$ | Unique active shopping cart session identifier |
| amount | number | Yes | Min: 0.50, Max: 10000 | > 0 | Total checkout transaction currency amount |
| currency | string | Yes | 3-letter currency code | ^[A-Z]{3}$ | ISO 4217 standard currency symbol |
| discountCode | string | No | Alphanumeric | ^[A-Z0-9_-]+$ | Optional promotional coupon code |

## Business Rules
1. Cart amount must exceed the minimum payment limit of $0.50.
2. Orders with promotional coupons must apply the discount factor before charging.
3. Stock levels must be reserved inside database before token check is completed.

## Expected Output Contracts
| Output Key | Value Type | Description |
| :--- | :--- | :--- |
| paymentIntentId | string | Unique checkout reference ID |
| totalCharged | number | Final total payment amount |
| status | string | Final state ("success" or "declined") |

## Dependencies
- CART-001, STRIPE-API-002

## Reference
- Stripe API Specification v2023-10-16, PCI-DSS Compliance Requirement 6.5`;

export default function SrsProcessor({ db, onImportComplete }: SrsProcessorProps) {
  const [markdown, setMarkdown] = useState<string>(LIST_TEMPLATE);
  const [parsedFeature, setParsedFeature] = useState<Feature | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Parsing algorithm to handle both tabular and bulleted layouts
  const parseMarkdownToFeature = (md: string): Feature => {
    const lines = md.split('\n');
    let id = 'SRS-001';
    let name = 'Untitled Feature';
    let version = '1.0';
    let description = '';
    let assumptions = '';
    let reference = '';
    const input_fields: InputField[] = [];
    const business_rules: string[] = [];
    const output: Record<string, string> = {};
    const dependencies: string[] = [];

    // Temporary variables for heading tracking
    let currentSection = '';

    // Match header: e.g. "# SRS-001: User Profile Update" or "# User Profile Update"
    const firstLine = lines[0] || '';
    const headerMatch = firstLine.match(/^#\s*([A-Z0-9_-]+)\s*[:|-]\s*(.*)$/i);
    if (headerMatch) {
      id = headerMatch[1].trim();
      name = headerMatch[2].trim();
    } else {
      const basicHeaderMatch = firstLine.match(/^#\s*(.*)$/);
      if (basicHeaderMatch) {
        name = basicHeaderMatch[1].trim();
      }
    }

    // Traverse lines for parsing metadata
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Extract metadata properties
      const versionMatch = line.match(/^\*\*Version:\*\*\s*(.*)$/i) || line.match(/^Version:\s*(.*)$/i);
      if (versionMatch) {
        version = versionMatch[1].replace(/[*_]/g, '').trim();
        continue;
      }

      const descMatch = line.match(/^\*\*Description:\*\*\s*(.*)$/i) || line.match(/^Description:\s*(.*)$/i);
      if (descMatch) {
        description = descMatch[1].replace(/[*_]/g, '').trim();
        continue;
      }

      const assumptionsMatch = line.match(/^\*\*Assumptions(?:\s*[\/|&]\s*Pre-conditions)?:\*\*\s*(.*)$/i) || 
                               line.match(/^Assumptions(?:\s*[\/|&]\s*Pre-conditions)?:\s*(.*)$/i) || 
                               line.match(/^\*\*Pre-conditions:\*\*\s*(.*)$/i) || 
                               line.match(/^Pre-conditions:\s*(.*)$/i);
      if (assumptionsMatch) {
        assumptions = assumptionsMatch[1].replace(/[*_]/g, '').trim();
        continue;
      }

      const referenceMatch = line.match(/^\*\*Reference[s]?:\*\*\s*(.*)$/i) || line.match(/^Reference[s]?:\s*(.*)$/i);
      if (referenceMatch) {
        reference = referenceMatch[1].replace(/[*_]/g, '').trim();
        continue;
      }

      // Check for Section headers
      if (line.startsWith('##')) {
        const secHeader = line.toLowerCase();
        if (secHeader.includes('input')) {
          currentSection = 'inputs';
        } else if (secHeader.includes('rule')) {
          currentSection = 'rules';
        } else if (secHeader.includes('output') || secHeader.includes('contract')) {
          currentSection = 'outputs';
        } else if (secHeader.includes('depend')) {
          currentSection = 'dependencies';
        } else if (secHeader.includes('reference')) {
          currentSection = 'reference';
        } else {
          currentSection = '';
        }
        continue;
      }

      // Parse list-items or table-rows based on current active section
      if (currentSection === 'inputs') {
        // Layout 1: List layout: - `displayName` (type: string, required: true, min: 3, max: 50, validation: "...", description: "...")
        if (line.startsWith('-')) {
          const fieldNameMatch = line.match(/`([^`]+)`/);
          if (fieldNameMatch) {
            const fieldName = fieldNameMatch[1].trim();
            const typeMatch = line.match(/type:\s*([\w]+)/i);
            const reqMatch = line.match(/required:\s*(true|false|yes|no)/i);
            const minMatch = line.match(/min:\s*(\d+)/i);
            const maxMatch = line.match(/max:\s*(\d+)/i);
            const formatMatch = line.match(/format:\s*([\w|]+)/i);
            const descMatch = line.match(/description:\s*["']([^"']+)["']/i) || line.match(/desc:\s*["']([^"']+)["']/i);
            const valMatch = line.match(/validation:\s*["']([^"']+)["']/i) || line.match(/val:\s*["']([^"']+)["']/i);

            const inputField: InputField = {
              name: fieldName,
              type: typeMatch ? typeMatch[1].toLowerCase() : 'string',
              required: reqMatch ? (reqMatch[1].toLowerCase() === 'true' || reqMatch[1].toLowerCase() === 'yes') : false
            };

            if (minMatch) inputField.min = parseInt(minMatch[1], 10);
            if (maxMatch) inputField.max = parseInt(maxMatch[1], 10);
            if (formatMatch) inputField.format = formatMatch[1];
            if (descMatch) inputField.description = descMatch[1];
            if (valMatch) inputField.validation = valMatch[1];

            input_fields.push(inputField);
          }
        } 
        // Layout 2: Tabular layout: | cartId | string | Yes | UUID format | validation | description |
        else if (line.startsWith('|')) {
          const cells = line.split('|').map(c => c.trim()).filter(Boolean);
          // Skip header row and formatting rows (e.g. |---|---|)
          if (cells.length >= 3 && !cells[0].includes('---') && !cells[0].toLowerCase().includes('field name')) {
            const fieldName = cells[0].replace(/`/g, '');
            const type = cells[1].toLowerCase() || 'string';
            const isRequired = cells[2].toLowerCase().includes('yes') || cells[2].toLowerCase().includes('true');
            const limitsCol = cells[3] || '';
            const valCol = cells.length >= 5 ? cells[4] : '';
            const descCol = cells.length >= 6 ? cells[5] : (cells.length === 5 && !valCol.includes('^') && !valCol.includes('>') ? valCol : '');

            const inputField: InputField = {
              name: fieldName,
              type: type,
              required: isRequired
            };

            // Parse numeric limits or string format bounds
            const minMatch = limitsCol.match(/min:\s*([\d.]+)/i);
            const maxMatch = limitsCol.match(/max:\s*([\d.]+)/i);
            const formatMatch = limitsCol.match(/(\w+)\s+format/i) || limitsCol.match(/format:\s*(\w+)/i);

            if (minMatch) inputField.min = parseFloat(minMatch[1]);
            if (maxMatch) inputField.max = parseFloat(maxMatch[1]);
            if (formatMatch) {
              inputField.format = formatMatch[1].toLowerCase();
            } else if (limitsCol && !minMatch && !maxMatch) {
              inputField.format = limitsCol; // Fallback to raw string
            }

            if (valCol && valCol !== descCol) inputField.validation = valCol;
            if (descCol) inputField.description = descCol;

            input_fields.push(inputField);
          }
        }
      }

      else if (currentSection === 'rules') {
        // Handles standard numbered lists (1. Rule) or bullet points
        const ruleMatch = line.match(/^\d+\.\s*(.*)$/) || line.match(/^[-*]\s*(.*)$/);
        if (ruleMatch) {
          business_rules.push(ruleMatch[1].trim());
        }
      }

      else if (currentSection === 'outputs') {
        // Layout 1: List layout: - `status`: "updated" | "failed"
        if (line.startsWith('-')) {
          const outputNameMatch = line.match(/`([^`]+)`/);
          if (outputNameMatch) {
            const outKey = outputNameMatch[1].trim();
            const afterColon = line.split(':');
            const outValue = afterColon.length > 1 ? afterColon[1].trim() : 'string';
            output[outKey] = outValue;
          }
        } 
        // Layout 2: Tabular layout: | paymentIntentId | string | Description |
        else if (line.startsWith('|')) {
          const cells = line.split('|').map(c => c.trim()).filter(Boolean);
          if (cells.length >= 2 && !cells[0].includes('---') && !cells[0].toLowerCase().includes('key') && !cells[0].toLowerCase().includes('output')) {
            const outKey = cells[0].replace(/`/g, '');
            const valType = cells[1] || 'string';
            output[outKey] = valType;
          }
        }
      }

      else if (currentSection === 'dependencies') {
        const depLine = line.replace(/^[-*\s]+/, '').trim();
        if (depLine) {
          // Supports comma-separated dependencies: USER-001, AUTH-002
          const parts = depLine.split(',').map(p => p.trim()).filter(Boolean);
          dependencies.push(...parts);
        }
      }

      else if (currentSection === 'reference') {
        const refLine = line.replace(/^[-*\s]+/, '').trim();
        if (refLine) {
          reference = reference ? `${reference}; ${refLine}` : refLine;
        }
      }
    }

    return {
      id,
      name,
      version,
      description: description || `Specifications parsed for feature ${name}`,
      assumptions: assumptions ? assumptions : undefined,
      input_fields,
      business_rules,
      output,
      dependencies,
      reference: reference ? reference : undefined
    };
  };

  useEffect(() => {
    try {
      const feat = parseMarkdownToFeature(markdown);
      setParsedFeature(feat);
    } catch (e) {
      console.warn('Live parsing failed:', e);
    }
  }, [markdown]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = async () => {
    if (!parsedFeature) return;
    try {
      await db.saveFeature(parsedFeature);
      setImportStatus({
        type: 'success',
        message: `🎉 Successfully imported feature "${parsedFeature.name}" (${parsedFeature.id}) into database store!`
      });
      onImportComplete();
      setTimeout(() => setImportStatus({ type: null, message: '' }), 5000);
    } catch (err: any) {
      setImportStatus({
        type: 'error',
        message: `❌ Failed to import spec to storage: ${err.message}`
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Header Block */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-slate-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            Markdown SRS Document Processor
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
            Convert your software requirements specifications (SRS) Markdown files instantly into system features. Paste specs, copy template layouts, edit parsed parameters, and persist features to the generator in one click.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMarkdown(LIST_TEMPLATE)}
            className="inline-flex items-center px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold transition"
          >
            <ListCollapse className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Standard List Template
          </button>
          <button
            type="button"
            onClick={() => setMarkdown(TABLE_TEMPLATE)}
            className="inline-flex items-center px-3 py-1.5 border border-slate-200 hover:border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold transition"
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Tabular Spec Template
          </button>
        </div>
      </div>

      {/* Side-by-Side Playground */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Code / Markdown Entry column */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-5 space-y-4 flex flex-col min-h-[500px]">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-900 flex items-center uppercase tracking-wider">
              📝 Input SRS Document (.md)
            </span>
            <button
              onClick={() => copyToClipboard(markdown)}
              className="inline-flex items-center text-[10px] sm:text-xs font-semibold text-slate-500 hover:text-slate-800 transition py-1 px-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-md"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Copied Template!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Copy Template
                </>
              )}
            </button>
          </div>

          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="flex-1 w-full p-4 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/50 rounded-xl font-mono text-xs leading-relaxed resize-none focus:outline-none"
            placeholder="Paste your software requirements specifications here..."
          />
        </div>

        {/* Live Parse Preview & Import Column */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center uppercase tracking-wider">
                ⚙️ Live Visual AST Preview
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                Auto-Parsing Active
              </span>
            </div>

            {parsedFeature ? (
              <div className="space-y-4 text-xs">
                {/* Meta Panel */}
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Feature ID</span>
                    <span className="font-mono font-bold text-blue-600">{parsedFeature.id}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Feature Name</span>
                    <span className="font-semibold text-slate-800 truncate block">{parsedFeature.name}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Version</span>
                    <span className="font-semibold text-slate-700">{parsedFeature.version}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Description</span>
                    <span className="text-slate-600 truncate block">{parsedFeature.description}</span>
                  </div>
                  {parsedFeature.assumptions && (
                    <div className="col-span-3 border-t border-slate-200/60 pt-2">
                      <span className="text-[9px] uppercase font-bold text-amber-600 block">Assumptions / Pre-conditions</span>
                      <span className="text-slate-700 text-[11px] block">{parsedFeature.assumptions}</span>
                    </div>
                  )}
                </div>

                {/* Input fields */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-800 block">Parsed Input Parameters ({parsedFeature.input_fields.length})</span>
                  {parsedFeature.input_fields.length > 0 ? (
                    <div className="overflow-x-auto border border-slate-100 rounded-lg">
                      <table className="min-w-full divide-y divide-slate-100 text-[11px] text-left">
                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[9px]">
                          <tr>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Req</th>
                            <th className="px-3 py-2">Constraints</th>
                            <th className="px-3 py-2">Validation</th>
                            <th className="px-3 py-2">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white font-mono text-slate-600 text-[10px]">
                          {parsedFeature.input_fields.map((f, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 text-slate-900 font-semibold">{f.name}</td>
                              <td className="px-3 py-1.5 text-blue-600">{f.type}</td>
                              <td className="px-3 py-1.5">
                                {f.required ? (
                                  <span className="text-rose-600 font-bold bg-rose-50 px-1 py-0.5 rounded text-[9px]">Yes</span>
                                ) : (
                                  <span className="text-slate-400">No</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 truncate max-w-[120px]">
                                {[
                                  f.min !== undefined ? `min: ${f.min}` : '',
                                  f.max !== undefined ? `max: ${f.max}` : '',
                                  f.format ? `format: ${f.format}` : ''
                                ].filter(Boolean).join(', ') || <span className="text-slate-300">-</span>}
                              </td>
                              <td className="px-3 py-1.5 text-purple-600 truncate max-w-[100px]">
                                {f.validation || <span className="text-slate-300">-</span>}
                              </td>
                              <td className="px-3 py-1.5 text-slate-500 font-sans truncate max-w-[160px]">
                                {f.description || <span className="text-slate-300">-</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-100 text-center text-slate-400 italic rounded-lg">
                      No input parameters detected. Check heading "## Input Fields"
                    </div>
                  )}
                </div>

                {/* Business rules list */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-800 block">Business Safety Constraints ({parsedFeature.business_rules.length})</span>
                  {parsedFeature.business_rules.length > 0 ? (
                    <ul className="space-y-1 bg-slate-50/50 p-3 rounded-lg border border-slate-100 list-decimal pl-6 text-slate-600 leading-relaxed">
                      {parsedFeature.business_rules.map((rule, idx) => (
                        <li key={idx}>{rule}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-100 text-center text-slate-400 italic rounded-lg">
                      No business constraints detected. Check heading "## Business Rules"
                    </div>
                  )}
                </div>

                {/* Expected Contracts */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-800 block">Output Response Contracts ({Object.keys(parsedFeature.output).length})</span>
                  {Object.keys(parsedFeature.output).length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(parsedFeature.output).map(([key, type]) => (
                        <div key={key} className="flex justify-between items-center p-2 border border-slate-100 bg-white rounded-lg font-mono">
                          <span className="text-slate-700 font-medium">{key}</span>
                          <span className="text-slate-400 text-[10px]">{type}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-100 text-center text-slate-400 italic rounded-lg">
                      No response contracts detected. Check heading "## Expected Output Contracts"
                    </div>
                  )}
                </div>

                {/* Dependencies list */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-800 block">Feature Dependencies ({parsedFeature.dependencies?.length || 0})</span>
                  {parsedFeature.dependencies && parsedFeature.dependencies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {parsedFeature.dependencies.map((dep, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {dep}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 border border-slate-100 text-slate-400 italic rounded-lg text-[11px]">
                      No upstream software modules listed as dependencies.
                    </div>
                  )}
                </div>

                {/* Reference section */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-800 block">Reference / Documentation Links</span>
                  {parsedFeature.reference ? (
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-600 text-[11px] leading-relaxed">
                      {parsedFeature.reference}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 border border-slate-100 text-slate-400 italic rounded-lg text-[11px]">
                      No external references or documentation notes specified.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 italic">
                Awaiting valid SRS document formatting...
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            {importStatus.type && (
              <div className={`p-3 rounded-lg border text-xs font-semibold leading-relaxed ${
                importStatus.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                  : 'bg-rose-50 text-rose-800 border-rose-100'
              }`}>
                {importStatus.message}
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!parsedFeature}
              className="w-full flex items-center justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white rounded-xl text-sm font-bold transition disabled:opacity-55"
            >
              <Import className="w-4 h-4 mr-2" />
              Import Feature Specifications to Storage
            </button>
          </div>
        </div>
      </div>

      {/* Theoretical Panel: How Dependencies Impact Test Generation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 text-slate-300">
        <div className="flex items-center space-x-2 text-white">
          <HelpCircle className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold">How ## Dependencies Impact Test Case Generation</h3>
        </div>
        
        <p className="text-xs text-slate-400 leading-relaxed">
          Including dependency IDs (e.g. <code>USER-AUTH-001</code>) inside your SRS documents establishes a structural relationship graph between features. During generation:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-slate-800/50 border border-slate-800 rounded-lg space-y-1.5">
            <span className="font-semibold text-white block">1. Auto-Injected Preconditions</span>
            <span className="text-slate-400 leading-relaxed block">
              The hybrid generator parses parent dependency IDs and automatically appends critical pre-requisite steps (e.g., "Verify parent system dependency USER-AUTH-001 has been validated and completed successfully").
            </span>
          </div>

          <div className="p-3.5 bg-slate-800/50 border border-slate-800 rounded-lg space-y-1.5">
            <span className="font-semibold text-white block">2. Rich Logical Context for AI</span>
            <span className="text-slate-400 leading-relaxed block">
              By passing dependencies to the optimization prompt, the AI understands the sequence flow of your system, ensuring it does not generate irrelevant or overlapping authentication checks.
            </span>
          </div>

          <div className="p-3.5 bg-slate-800/50 border border-slate-800 rounded-lg space-y-1.5">
            <span className="font-semibold text-white block">3. Transactional Safety</span>
            <span className="text-slate-400 leading-relaxed block">
              Tests are sequenced so that upstream modules fail-first if required antecedents fail, matching correct enterprise QA integration testing paradigms.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
