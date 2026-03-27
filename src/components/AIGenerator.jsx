import { useState, useEffect, useRef } from 'react';
import BpmnViewer from './BpmnViewer';
import { aiGenerateBpmn, aiGenerateTests, aiGenerateSpringBootPrompt, aiGenerateReactPrompt } from '../utils/api';

const INDUSTRIES = [
  'Banking & Finance',
  'Insurance',
  'Healthcare',
  'Retail & E-Commerce',
  'Manufacturing',
  'Telecommunications',
  'Government & Public Sector',
  'Education',
  'Real Estate',
  'Travel & Hospitality',
  'Other',
];

const AI_TABS = [
  { id: 'diagram', label: 'BPMN Diagram' },
  { id: 'tests',   label: 'Test Cases' },
  { id: 'spring',  label: 'Spring Boot' },
  { id: 'react',   label: 'React Frontend' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="btn btn-secondary btn-sm" onClick={copy}>
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  );
}

export default function AIGenerator({ onNavigate, permissions = {} }) {
  // Form state
  const [form, setForm] = useState({
    description: '',
    appName: '',
    appIndustry: '',
    appPurpose: '',
  });

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [result, setResult] = useState(null); // { xml, session_id, rag_used, ... }

  // Active tab after generation
  const [activeTab, setActiveTab] = useState('diagram');

  // Per-tab state
  const [tests, setTests] = useState(null);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState('');

  const [springPrompt, setSpringPrompt] = useState(null);
  const [springLoading, setSpringLoading] = useState(false);
  const [springError, setSpringError] = useState('');

  const [reactPrompt, setReactPrompt] = useState(null);
  const [reactLoading, setReactLoading] = useState(false);
  const [reactError, setReactError] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) return;
    setGenerating(true);
    setGenError('');
    setResult(null);
    setTests(null);
    setSpringPrompt(null);
    setReactPrompt(null);
    setActiveTab('diagram');
    try {
      const data = await aiGenerateBpmn({
        description: form.description,
        appName: form.appName,
        appIndustry: form.appIndustry,
        appPurpose: form.appPurpose,
      });
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setResult(data);
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    if (!result?.session_id) return;

    if (tab === 'tests' && !tests && !testsLoading) {
      setTestsLoading(true);
      setTestsError('');
      try {
        const data = await aiGenerateTests(result.session_id);
        setTests(data.test_cases || []);
      } catch (err) {
        setTestsError(err.message);
      } finally {
        setTestsLoading(false);
      }
    }

    if (tab === 'spring' && !springPrompt && !springLoading) {
      setSpringLoading(true);
      setSpringError('');
      try {
        const data = await aiGenerateSpringBootPrompt(result.session_id);
        setSpringPrompt(data.prompt || '');
      } catch (err) {
        setSpringError(err.message);
      } finally {
        setSpringLoading(false);
      }
    }

    if (tab === 'react' && !reactPrompt && !reactLoading) {
      setReactLoading(true);
      setReactError('');
      try {
        const data = await aiGenerateReactPrompt(result.session_id);
        setReactPrompt(data.prompt || '');
      } catch (err) {
        setReactError(err.message);
      } finally {
        setReactLoading(false);
      }
    }
  };

  const handleUseInProcessIQ = () => {
    if (!result?.xml) return;
    onNavigate('add', null, { initialBpmn: result.xml });
  };

  const SUITE_COLORS = {
    'Happy Path':        '#dcfce7',
    'Gateway Branches':  '#dbeafe',
    'Boundary Events':   '#fef9c3',
    'Exception Handling':'#fee2e2',
    'Negative Tests':    '#f3e8ff',
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>AI BPMN Generator</h1>
          <p>Describe your business process in plain language — AI generates a BPMN diagram, test cases, and code prompts.</p>
        </div>
      </div>

      {/* Input Form */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3>Process Description</h3>
          {result && (
            <span className="badge badge-green">✓ BPMN generated</span>
          )}
        </div>
        <div className="card-body">
          <form onSubmit={handleGenerate}>
            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <div className="form-group">
                <label>Application Name</label>
                <input
                  type="text"
                  value={form.appName}
                  onChange={e => set('appName', e.target.value)}
                  placeholder="e.g. Loan Origination System"
                />
              </div>
              <div className="form-group">
                <label>Industry</label>
                <select value={form.appIndustry} onChange={e => set('appIndustry', e.target.value)}>
                  <option value="">— select industry —</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Application Purpose</label>
                <input
                  type="text"
                  value={form.appPurpose}
                  onChange={e => set('appPurpose', e.target.value)}
                  placeholder="e.g. Automate the end-to-end loan approval workflow"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>
                Process Description <span className="required">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={5}
                placeholder="Describe the business process in detail. Include the actors, decision points, tasks, and expected outcomes…"
                style={{ resize: 'vertical' }}
                required
              />
            </div>

            {genError && (
              <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '14px', fontSize: '13.5px' }}>
                {genError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={generating || !form.description.trim()}
              >
                {generating ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="ai-spinner" />
                    Generating…
                  </span>
                ) : (
                  '✦ Generate BPMN'
                )}
              </button>
              {result && permissions.add && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleUseInProcessIQ}
                >
                  + Save to Process Library
                </button>
              )}
              {result && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                  {result.rag_used ? '✦ RAG context applied' : ''}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <div className="card-header" style={{ padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '0', overflowX: 'auto' }}>
              {AI_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  style={{
                    padding: '14px 20px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="card-body" style={{ padding: 0 }}>

            {/* BPMN Diagram tab */}
            {activeTab === 'diagram' && (
              <BpmnViewer xml={result.xml} fileName="ai-generated.bpmn" />
            )}

            {/* Test Cases tab */}
            {activeTab === 'tests' && (
              <div style={{ padding: '20px' }}>
                {testsLoading && (
                  <div className="empty-state">
                    <span className="ai-spinner" style={{ width: '32px', height: '32px' }} />
                    <p style={{ marginTop: '12px' }}>Generating test cases…</p>
                  </div>
                )}
                {testsError && (
                  <div style={{ color: 'var(--danger)', padding: '12px', background: 'var(--danger-light)', borderRadius: 'var(--radius)' }}>
                    {testsError}
                  </div>
                )}
                {tests && tests.length === 0 && (
                  <div className="empty-state"><p>No test cases returned.</p></div>
                )}
                {tests && tests.length > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {tests.length} test case{tests.length !== 1 ? 's' : ''} generated
                      </span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface-raised)' }}>
                            {['ID', 'Suite', 'Name', 'Type', 'Description', 'Steps', 'Expected Result'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tests.map((tc, idx) => (
                            <tr key={tc.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>{tc.id}</td>
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  background: SUITE_COLORS[tc.suite] || '#f0f0f0',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '11.5px',
                                  fontWeight: 500,
                                }}>
                                  {tc.suite}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', minWidth: '160px' }}>{tc.name}</td>
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                <span className={tc.test_type === 'Positive' ? 'badge badge-green' : 'badge badge-red'}>
                                  {tc.test_type}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', minWidth: '200px', maxWidth: '280px' }}>{tc.description}</td>
                              <td style={{ padding: '8px 12px', minWidth: '200px', maxWidth: '300px', whiteSpace: 'pre-line', fontSize: '12px' }}>{tc.steps}</td>
                              <td style={{ padding: '8px 12px', minWidth: '160px' }}>{tc.expected_result}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {!testsLoading && !testsError && !tests && (
                  <div className="empty-state">
                    <p>Click the <strong>Test Cases</strong> tab to generate test cases from the BPMN.</p>
                  </div>
                )}
              </div>
            )}

            {/* Spring Boot tab */}
            {activeTab === 'spring' && (
              <div style={{ padding: '20px' }}>
                {springLoading && (
                  <div className="empty-state">
                    <span className="ai-spinner" style={{ width: '32px', height: '32px' }} />
                    <p style={{ marginTop: '12px' }}>Generating Spring Boot prompt…</p>
                  </div>
                )}
                {springError && (
                  <div style={{ color: 'var(--danger)', padding: '12px', background: 'var(--danger-light)', borderRadius: 'var(--radius)' }}>
                    {springError}
                  </div>
                )}
                {springPrompt && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Copy this prompt into Cursor, Copilot, or JetBrains AI to generate a production-ready Spring Boot application.
                      </span>
                      <CopyButton text={springPrompt} />
                    </div>
                    <pre style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '16px',
                      fontSize: '12.5px',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '500px',
                      overflowY: 'auto',
                      fontFamily: 'monospace',
                    }}>
                      {springPrompt}
                    </pre>
                  </>
                )}
              </div>
            )}

            {/* React Frontend tab */}
            {activeTab === 'react' && (
              <div style={{ padding: '20px' }}>
                {reactLoading && (
                  <div className="empty-state">
                    <span className="ai-spinner" style={{ width: '32px', height: '32px' }} />
                    <p style={{ marginTop: '12px' }}>Generating React frontend prompt…</p>
                  </div>
                )}
                {reactError && (
                  <div style={{ color: 'var(--danger)', padding: '12px', background: 'var(--danger-light)', borderRadius: 'var(--radius)' }}>
                    {reactError}
                  </div>
                )}
                {reactPrompt && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Copy this prompt into Cursor, Copilot, or JetBrains AI to generate a complete React 18 + TypeScript frontend.
                      </span>
                      <CopyButton text={reactPrompt} />
                    </div>
                    <pre style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '16px',
                      fontSize: '12.5px',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      maxHeight: '500px',
                      overflowY: 'auto',
                      fontFamily: 'monospace',
                    }}>
                      {reactPrompt}
                    </pre>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
