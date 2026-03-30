import { useState, useRef } from 'react';
import BpmnViewer from './BpmnViewer';
import { aiGenerateBpmn, aiGenerateTests, aiGenerateSpringBootPrompt, aiGenerateReactPrompt, extractDocument } from '../utils/api';

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
  { id: 'diagram', label: '◈ BPMN Diagram' },
  { id: 'tests',   label: '✓ Test Cases' },
  { id: 'spring',  label: '⚙ Spring Boot' },
  { id: 'react',   label: '⬡ React Frontend' },
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
    <button
      onClick={copy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '5px 12px',
        background: copied ? '#dcfce7' : 'var(--surface)',
        color: copied ? '#15803d' : 'var(--text-muted)',
        border: `1px solid ${copied ? '#bbf7d0' : 'var(--border)'}`,
        borderRadius: '999px',
        fontSize: '12px', fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  );
}

export default function AIGenerator({ onNavigate, permissions = {} }) {
  const [form, setForm] = useState({ description: '', appName: '', appIndustry: '', appPurpose: '' });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('diagram');

  const [tests, setTests] = useState(null);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState('');

  const [springPrompt, setSpringPrompt] = useState(null);
  const [springLoading, setSpringLoading] = useState(false);
  const [springError, setSpringError] = useState('');

  const [reactPrompt, setReactPrompt] = useState(null);
  const [reactLoading, setReactLoading] = useState(false);
  const [reactError, setReactError] = useState('');

  // Document context
  const [extractedDocText, setExtractedDocText] = useState('');
  const [extractedBpmnXml, setExtractedBpmnXml] = useState('');
  const [docMeta, setDocMeta] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const docInputRef = useRef(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const clearDocument = () => {
    setExtractedDocText('');
    setExtractedBpmnXml('');
    setDocMeta(null);
    setExtractError('');
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc', 'bpmn'].includes(ext)) {
      setExtractError('Unsupported file. Use .bpmn, .pdf, .docx, or .doc');
      return;
    }
    clearDocument();
    setExtracting(true);
    setExtractError('');
    try {
      const data = await extractDocument(file);
      if (data.error) { setExtractError(`Extraction failed: ${data.error}`); return; }
      setExtractedDocText(data.text || '');
      setExtractedBpmnXml(data.bpmn_xml || '');
      setDocMeta({
        filename:   data.filename,
        file_type:  data.file_type,
        has_bpmn:   data.has_bpmn,
        pages:      data.pages,
        char_count: data.char_count,
      });
    } catch (err) {
      setExtractError(err.message);
    } finally {
      setExtracting(false);
    }
  };

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
        documentContext: extractedDocText,
        existingBpmnXml: extractedBpmnXml,
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
      setTestsLoading(true); setTestsError('');
      try { const d = await aiGenerateTests(result.session_id); setTests(d.test_cases || []); }
      catch (err) { setTestsError(err.message); }
      finally { setTestsLoading(false); }
    }
    if (tab === 'spring' && !springPrompt && !springLoading) {
      setSpringLoading(true); setSpringError('');
      try { const d = await aiGenerateSpringBootPrompt(result.session_id); setSpringPrompt(d.prompt || ''); }
      catch (err) { setSpringError(err.message); }
      finally { setSpringLoading(false); }
    }
    if (tab === 'react' && !reactPrompt && !reactLoading) {
      setReactLoading(true); setReactError('');
      try { const d = await aiGenerateReactPrompt(result.session_id); setReactPrompt(d.prompt || ''); }
      catch (err) { setReactError(err.message); }
      finally { setReactLoading(false); }
    }
  };

  const handleReset = () => {
    setResult(null); setTests(null); setSpringPrompt(null); setReactPrompt(null); setActiveTab('diagram');
    clearDocument();
  };

  const handleSave = () => {
    if (!result?.xml) return;
    onNavigate('add', null, { initialBpmn: result.xml });
  };

  const SUITE_COLORS = {
    'Happy Path':         { bg: '#dcfce7', color: '#15803d' },
    'Gateway Branches':   { bg: '#dbeafe', color: '#1d4ed8' },
    'Boundary Events':    { bg: '#fef9c3', color: '#a16207' },
    'Exception Handling': { bg: '#fee2e2', color: '#b91c1c' },
    'Negative Tests':     { bg: '#f3e8ff', color: '#7e22ce' },
  };

  return (
    <div>

      <div className="page-header">
        <div className="page-header-left">
          <h1>AI BPMN Generator</h1>
          <p>Describe your business process in plain language — AI generates a BPMN diagram, test cases, and code prompts.</p>
        </div>
      </div>

      {/* ── Input Form ──────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3>Process Description</h3>
          {result && <span className="badge badge-green">✓ BPMN generated</span>}
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

            {/* Document context upload */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Reference Document <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
              {!docMeta ? (
                <div
                  onClick={() => !extracting && docInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${extracting ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: extracting ? 'default' : 'pointer',
                    background: extracting ? 'var(--primary-light)' : 'var(--surface-raised)',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{extracting ? '⏳' : '📄'}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-h)' }}>
                      {extracting ? 'Extracting document…' : 'Upload a reference document'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Supports .bpmn, .pdf, .docx, .doc — AI uses this as context for generation
                    </div>
                  </div>
                  {extracting && <span className="ai-spinner" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".bpmn,.pdf,.docx,.doc"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div style={{
                  border: '1.5px solid #c7d3fb',
                  borderRadius: 'var(--radius)',
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  background: 'var(--primary-light)',
                }}>
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>
                    {docMeta.file_type === 'bpmn' ? '◈' : docMeta.file_type === 'pdf' ? '📕' : '📝'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {docMeta.filename}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ textTransform: 'uppercase', fontWeight: 600, color: 'var(--primary)' }}>{docMeta.file_type}</span>
                      {docMeta.pages > 0 && <span>{docMeta.pages} page{docMeta.pages !== 1 ? 's' : ''}</span>}
                      {docMeta.char_count > 0 && <span>{docMeta.char_count.toLocaleString()} chars extracted</span>}
                      {docMeta.has_bpmn && <span style={{ color: '#7e22ce', fontWeight: 600 }}>✦ Contains BPMN</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={clearDocument}
                    style={{ flexShrink: 0, fontSize: '12px' }}
                  >
                    ✕ Remove
                  </button>
                </div>
              )}
              {extractError && (
                <p style={{ color: 'var(--danger)', fontSize: '12.5px', marginTop: '6px' }}>{extractError}</p>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>
                Process Description <span className="required">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={5}
                placeholder="Describe the business process in detail. Include the actors, decision points, tasks, and expected outcomes…"
                style={{
                  resize: 'vertical',
                  borderColor: form.description.trim() ? 'var(--primary)' : 'var(--border)',
                  boxShadow: form.description.trim() ? '0 0 0 3px rgba(79,110,247,0.1)' : 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                required
              />
            </div>

            {genError && (
              <div style={{ background:'var(--danger-light)', color:'var(--danger)', padding:'10px 14px', borderRadius:'var(--radius)', marginBottom:'16px', fontSize:'13.5px', display:'flex', alignItems:'center', gap:'8px' }}>
                <span>⚠</span> {genError}
              </div>
            )}

            <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              <button
                type="submit"
                disabled={generating || !form.description.trim()}
                style={{
                  display:'inline-flex', alignItems:'center', gap:'8px',
                  padding:'10px 24px',
                  background: generating
                    ? 'var(--primary)'
                    : 'linear-gradient(135deg, #4f6ef7 0%, #6c47ff 100%)',
                  color:'#fff', border:'none',
                  borderRadius:'var(--radius-sm)',
                  fontSize:'14px', fontWeight:600,
                  cursor: generating || !form.description.trim() ? 'not-allowed' : 'pointer',
                  opacity: !form.description.trim() ? 0.55 : 1,
                  boxShadow: !form.description.trim() ? 'none' : '0 3px 12px rgba(79,110,247,0.45)',
                  transition: 'all 0.2s',
                }}
              >
                {generating ? (
                  <><span className="ai-spinner" /> Generating…</>
                ) : (
                  '✦ Generate BPMN'
                )}
              </button>

              {result && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleReset}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────── */}
      {result && (
        <div className="card" style={{ overflow:'hidden' }}>

          {/* Tab header */}
          <div style={{
            display:'flex', alignItems:'center',
            borderBottom:'1px solid var(--border)',
            background:'var(--surface)',
            overflowX:'auto',
            padding:'0 4px',
          }}>
            {AI_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  padding:'13px 18px',
                  border:'none',
                  background: activeTab === tab.id ? 'var(--primary-light)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize:'13px',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  borderRadius: activeTab === tab.id ? '8px 8px 0 0' : '0',
                  borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor:'pointer',
                  whiteSpace:'nowrap',
                  transition:'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: 0, background:'var(--surface)' }}>

            {activeTab === 'diagram' && (
              <BpmnViewer xml={result.xml} fileName="ai-generated.bpmn" />
            )}

            {activeTab === 'tests' && (
              <div style={{ padding:'20px' }}>
                {testsLoading && (
                  <div className="empty-state">
                    <span className="ai-spinner" style={{ width:'32px', height:'32px' }} />
                    <p style={{ marginTop:'12px' }}>Generating test cases…</p>
                  </div>
                )}
                {testsError && (
                  <div style={{ color:'var(--danger)', padding:'12px', background:'var(--danger-light)', borderRadius:'var(--radius)' }}>
                    {testsError}
                  </div>
                )}
                {tests && tests.length === 0 && (
                  <div className="empty-state"><p>No test cases returned.</p></div>
                )}
                {tests && tests.length > 0 && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                      <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>
                        {tests.length} test case{tests.length !== 1 ? 's' : ''} generated
                      </span>
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                        <thead>
                          <tr style={{ background:'var(--surface-raised)' }}>
                            {['ID','Suite','Name','Type','Description','Steps','Expected Result'].map(h => (
                              <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontWeight:600, fontSize:'12px', color:'var(--text-muted)', whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tests.map((tc, idx) => {
                            const sc = SUITE_COLORS[tc.suite] || { bg:'#f0f0f0', color:'#555' };
                            return (
                              <tr key={tc.id || idx} style={{ borderBottom:'1px solid var(--border)' }}>
                                <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:'12px', whiteSpace:'nowrap' }}>{tc.id}</td>
                                <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                                  <span style={{ background:sc.bg, color:sc.color, padding:'2px 9px', borderRadius:'999px', fontSize:'11.5px', fontWeight:500 }}>
                                    {tc.suite}
                                  </span>
                                </td>
                                <td style={{ padding:'8px 12px', minWidth:'160px' }}>{tc.name}</td>
                                <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                                  <span className={tc.test_type === 'Positive' ? 'badge badge-green' : 'badge badge-red'}>
                                    {tc.test_type}
                                  </span>
                                </td>
                                <td style={{ padding:'8px 12px', minWidth:'200px', maxWidth:'280px' }}>{tc.description}</td>
                                <td style={{ padding:'8px 12px', minWidth:'200px', maxWidth:'300px', whiteSpace:'pre-line', fontSize:'12px' }}>{tc.steps}</td>
                                <td style={{ padding:'8px 12px', minWidth:'160px' }}>{tc.expected_result}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'spring' && (
              <div style={{ padding:'20px' }}>
                {springLoading && (
                  <div className="empty-state">
                    <span className="ai-spinner" style={{ width:'32px', height:'32px' }} />
                    <p style={{ marginTop:'12px' }}>Generating Spring Boot prompt…</p>
                  </div>
                )}
                {springError && (
                  <div style={{ color:'var(--danger)', padding:'12px', background:'var(--danger-light)', borderRadius:'var(--radius)' }}>
                    {springError}
                  </div>
                )}
                {springPrompt && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', gap:'12px' }}>
                      <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>
                        Copy this prompt into Cursor, Copilot, or JetBrains AI to generate a production-ready Spring Boot application.
                      </span>
                      <CopyButton text={springPrompt} />
                    </div>
                    <pre style={{ background:'var(--surface-raised)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'16px', fontSize:'12.5px', lineHeight:'1.6', whiteSpace:'pre-wrap', wordBreak:'break-word', maxHeight:'500px', overflowY:'auto', fontFamily:'monospace' }}>
                      {springPrompt}
                    </pre>
                  </>
                )}
              </div>
            )}

            {activeTab === 'react' && (
              <div style={{ padding:'20px' }}>
                {reactLoading && (
                  <div className="empty-state">
                    <span className="ai-spinner" style={{ width:'32px', height:'32px' }} />
                    <p style={{ marginTop:'12px' }}>Generating React frontend prompt…</p>
                  </div>
                )}
                {reactError && (
                  <div style={{ color:'var(--danger)', padding:'12px', background:'var(--danger-light)', borderRadius:'var(--radius)' }}>
                    {reactError}
                  </div>
                )}
                {reactPrompt && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', gap:'12px' }}>
                      <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>
                        Copy this prompt into Cursor, Copilot, or JetBrains AI to generate a complete React 18 + TypeScript frontend.
                      </span>
                      <CopyButton text={reactPrompt} />
                    </div>
                    <pre style={{ background:'var(--surface-raised)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'16px', fontSize:'12.5px', lineHeight:'1.6', whiteSpace:'pre-wrap', wordBreak:'break-word', maxHeight:'500px', overflowY:'auto', fontFamily:'monospace' }}>
                      {reactPrompt}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Save action footer ────────────────────────────── */}
          {permissions.add && (
            <div style={{
              borderTop: '1px solid var(--border)',
              background: 'linear-gradient(135deg, #f0f3ff 0%, #ece9ff 100%)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f6ef7 0%, #6c47ff 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '17px', color: '#fff', flexShrink: 0,
                boxShadow: '0 2px 8px rgba(79,110,247,0.4)',
              }}>
                ＋
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-h)', marginBottom: '2px' }}>
                  Save to Process Library
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Add this AI-generated BPMN diagram to your ProcessIQ library
                </div>
              </div>
              {result.rag_used && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: '#f3e8ff', color: '#7e22ce',
                  border: '1px solid #e9d5ff',
                  padding: '3px 10px', borderRadius: '999px',
                  fontSize: '11.5px', fontWeight: 600, flexShrink: 0,
                }}>
                  ✦ RAG context applied
                </span>
              )}
              <button
                type="button"
                onClick={handleSave}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '10px 22px',
                  background: 'linear-gradient(135deg, #4f6ef7 0%, #6c47ff 100%)',
                  color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13.5px', fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 3px 12px rgba(79,110,247,0.45)',
                  flexShrink: 0,
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,110,247,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(79,110,247,0.45)'; }}
              >
                Save to Library →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
