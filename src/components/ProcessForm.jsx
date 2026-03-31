import { useState, useRef, useEffect } from 'react';
import { createProcess, updateProcess, generateId, getOrgs, getOrgData, createChangeRequest, aiGenerateBpmn, extractDocument } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import BpmnViewer from './BpmnViewer';
import BpmnEditor from './BpmnEditor';

const LEVELS = ['Support', 'Core', 'Strategic'];

const defaultForm = {
  id: '',
  processName: '',
  processNames: [],
  org: '',
  function: [],
  level: '',
  subProcesses: [],
  version: '1.0',
  bpmnXml: '',
  fileName: '',
};

const normalizeTagArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val ? [val] : [];
};

function TagInput({ tags, onAdd, onRemove, inputRef, placeholder, suggestions = [] }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filtered = input.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s))
    : suggestions.filter(s => !tags.includes(s));

  const commit = (value) => {
    const tag = value.trim().replace(/,$/, '').trim();
    if (tag && !tags.includes(tag)) onAdd(tag);
    setInput('');
    setShowSuggestions(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onRemove(tags.length - 1);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div className="tag-input-container" onClick={() => inputRef.current?.focus()}>
        {tags.map((tag, idx) => (
          <span key={idx} className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-chip-remove"
              onClick={e => { e.stopPropagation(); onRemove(idx); }}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="tag-input"
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={onKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length === 0 ? placeholder : ''}
        />
      </div>
      {showSuggestions && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          maxHeight: '180px', overflowY: 'auto', marginTop: '2px',
        }}>
          {filtered.map(s => (
            <div
              key={s}
              onMouseDown={() => commit(s)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: '13.5px',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover, #f5f5f5)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessForm({ process, processes = [], onSave, onCancel, permissions = {}, initialBpmn = null }) {
  const { user } = useAuth()
  const isEdit = !!process;
  const needsApproval = !!permissions.editsRequireApproval;

  const [form, setForm] = useState(
    isEdit
      ? {
          ...process,
          processNames: normalizeTagArray(process.processNames),
          function: normalizeTagArray(process.function),
          subProcesses: normalizeTagArray(process.subProcesses).map(sp =>
            typeof sp === 'string' ? sp : sp.name
          ),
        }
      : { ...defaultForm, ...(initialBpmn ? { bpmnXml: initialBpmn, fileName: 'ai-generated.bpmn' } : {}) }
  );
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [allOrgs, setAllOrgs] = useState([]);
  const [orgTableData, setOrgTableData] = useState(null);
  const [orgTableLoading, setOrgTableLoading] = useState(false);
  const fileInputRef = useRef(null);
  const spTagRef = useRef(null);
  const pnTagRef = useRef(null);
  const editorRef = useRef(null);

  // Inline AI generation inside the BPMN card
  const [bpmnMode, setBpmnMode] = useState('upload'); // 'upload' | 'ai'
  const [aiDesc, setAiDesc] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  // Document context for AI generation
  const [docMeta, setDocMeta] = useState(null);
  const [docText, setDocText] = useState('');
  const [docBpmnXml, setDocBpmnXml] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const docInputRef = useRef(null);


  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Load org list on mount
  useEffect(() => {
    getOrgs().then(setAllOrgs).catch(() => {});
  }, []);

  // Load functions + sub-processes whenever the selected org changes
  useEffect(() => {
    if (!form.org) { setOrgTableData(null); return; }
    setOrgTableLoading(true);
    getOrgData(form.org)
      .then(data => setOrgTableData(Object.keys(data).length ? data : null))
      .catch(() => setOrgTableData(null))
      .finally(() => setOrgTableLoading(false));
  }, [form.org]);

  const selectOrg = (org) => {
    setForm(f => ({ ...f, org, function: [], subProcesses: [] }));
  };

  const validate = () => {
    const e = {};
    if (!form.bpmnXml) e.file = 'BPMN diagram is required';
    if (!form.id.trim()) e.id = 'Process ID is required';
    if (!form.processName.trim()) e.processName = 'Process name is required';
    if (!form.org.trim()) e.org = 'Organization is required';
    if (!form.function.length) e.function = 'Function is required';
    if (!form.subProcesses.length) e.subProcesses = 'At least one sub-process is required';
    if (!form.level) e.level = 'Level is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!validate()) return;
    setSaving(true);
    setErrors({});
    try {
      if (needsApproval) {
        await createChangeRequest({
          processId:     isEdit ? form.id : null,
          requestedBy:   user.id,
          requesterEmail: user.email,
          changeType:    isEdit ? 'update' : 'create',
          changeData:    { form },
          changeNotes:   changeNotes.trim() || null,
        });
        setSubmitted(true);
      } else {
        const saved = isEdit
          ? await updateProcess(form.id, form)
          : await createProcess(form);
        onSave(saved);
      }
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.bpmn') && !file.name.endsWith('.xml')) {
      setErrors(e => ({ ...e, file: 'Please upload a .bpmn or .xml file' }));
      return;
    }
    setErrors(e => ({ ...e, file: undefined }));
    const reader = new FileReader();
    reader.onload = (ev) => {
      set('bpmnXml', ev.target.result);
      set('fileName', file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const removeFile = () => {
    set('bpmnXml', '');
    set('fileName', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAiGenerate = async () => {
    if (!aiDesc.trim()) return;
    setAiGenerating(true);
    setAiError('');
    setAiResult(null);
    try {
      // Build a structured context from the form fields already filled in
      const contextLines = [];
      if (form.org)                     contextLines.push(`Organization: ${form.org}`);
      if (form.function.length)         contextLines.push(`Function: ${form.function.join(', ')}`);
      if (form.processName)             contextLines.push(`Process Name: ${form.processName}`);
      if (form.subProcesses.length)     contextLines.push(`Sub-Processes: ${form.subProcesses.join(', ')}`);
      if (form.level)                   contextLines.push(`Level: ${form.level}`);

      const enrichedDescription = contextLines.length > 0
        ? `Process Context:\n${contextLines.join('\n')}\n\nProcess Description:\n${aiDesc.trim()}`
        : aiDesc.trim();

      const data = await aiGenerateBpmn({
        description: enrichedDescription,
        documentContext: docText,
        existingBpmnXml: docBpmnXml,
      });
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setAiResult(data);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleUseAiBpmn = async () => {
    if (!aiResult?.xml) return;
    const xml = editorRef.current ? await editorRef.current.getXml() : aiResult.xml;
    const baseName = form.processName.trim()
      ? form.processName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : 'ai-generated';
    set('bpmnXml', xml);
    set('fileName', `${baseName}.bpmn`);
    setErrors(e => ({ ...e, file: undefined }));
    setAiResult(null);
    setAiDesc('');
  };

  const clearDoc = () => {
    setDocMeta(null); setDocText(''); setDocBpmnXml(''); setExtractError('');
    if (docInputRef.current) docInputRef.current.value = '';
  };

  const handleDocFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc', 'bpmn'].includes(ext)) {
      setExtractError('Unsupported file. Use .bpmn, .pdf, .docx, or .doc');
      return;
    }
    clearDoc();
    setExtracting(true);
    try {
      const data = await extractDocument(file);
      if (data.error) { setExtractError(`Extraction failed: ${data.error}`); return; }
      setDocText(data.text || '');
      setDocBpmnXml(data.bpmn_xml || '');
      setDocMeta({ filename: data.filename, file_type: data.file_type, has_bpmn: data.has_bpmn, pages: data.pages, char_count: data.char_count });
    } catch (err) {
      setExtractError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const addFnTag = (tag) => {
    if (!isEdit) {
      setForm(f => ({ ...f, function: [tag], id: generateId(tag, processes) }));
    } else {
      set('function', [tag]);
    }
  };
  const removeFnTag = () => {
    if (!isEdit) {
      setForm(f => ({ ...f, function: [], id: generateId(null, processes) }));
    } else {
      set('function', []);
    }
  };

  const addSpTag = (tag) => {
    setForm(f => f.subProcesses.includes(tag) ? f : { ...f, subProcesses: [...f.subProcesses, tag] });
  };
  const removeSpTag = (idx) => {
    setForm(f => ({ ...f, subProcesses: f.subProcesses.filter((_, i) => i !== idx) }));
  };

  const addPnTag = (tag) => {
    setForm(f => f.processNames.includes(tag) ? f : { ...f, processNames: [...f.processNames, tag] });
  };
  const removePnTag = (idx) => {
    setForm(f => ({ ...f, processNames: f.processNames.filter((_, i) => i !== idx) }));
  };

  if (submitted) {
    return (
      <div className="empty-state" style={{ paddingTop: '80px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px', color: 'var(--success)' }}>✓</div>
        <h3>Change Submitted for Approval</h3>
        <p style={{ maxWidth: '380px', textAlign: 'center', marginBottom: '24px' }}>
          Your {isEdit ? 'changes to' : 'new'} process have been submitted.
          A Process Owner will review and approve your request.
        </p>
        <button className="btn btn-primary" onClick={onCancel}>Back to Processes</button>
      </div>
    )
  }

  return (
    <div>
      <div className="breadcrumb">
        <span className="breadcrumb-item" onClick={onCancel}>
          {isEdit ? 'Process' : 'Processes'}
        </span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{isEdit ? 'Edit Process' : 'Add Process'}</span>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1>{isEdit ? 'Edit Process' : 'Add Process'}</h1>
          <p>
            {isEdit ? `Editing: ${process.processName}` : 'Fill in the details then attach your BPMN diagram'}
            {needsApproval && (
              <span className="badge badge-yellow" style={{ marginLeft: '10px' }}>Requires Approval</span>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1 — Process Details */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3>Process Details</h3>
            {form.id && <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{form.id}</span>}
          </div>
          <div className="card-body">
            <div className="form-section">
              <div className="form-section-title">Organization</div>
              <div className="form-group">
                <label>Organization <span className="required">*</span></label>
                <select value={form.org} onChange={e => selectOrg(e.target.value)}>
                  <option value="">— select an organization —</option>
                  {allOrgs.map(org => <option key={org} value={org}>{org}</option>)}
                </select>
                {errors.org && <p className="form-error">{errors.org}</p>}
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Functions &amp; Sub-Processes</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Function <span className="required">*</span></label>
                  <select
                    value={form.function[0] || ''}
                    onChange={e => e.target.value ? addFnTag(e.target.value) : removeFnTag()}
                    disabled={!form.org}
                  >
                    <option value="">— select a function —</option>
                    {orgTableData && Object.keys(orgTableData).map(fn => (
                      <option key={fn} value={fn}>{fn}</option>
                    ))}
                  </select>
                  {errors.function && <p className="form-error">{errors.function}</p>}
                </div>
                <div className="form-group">
                  <label>Sub-Processes <span className="required">*</span></label>
                  <TagInput
                    tags={form.subProcesses}
                    onAdd={addSpTag}
                    onRemove={removeSpTag}
                    inputRef={spTagRef}
                    placeholder="Type to search or add sub-processes..."
                    suggestions={orgTableData && form.function[0] ? (orgTableData[form.function[0]]?.subProcesses || []) : []}
                  />
                  {errors.subProcesses && <p className="form-error">{errors.subProcesses}</p>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Identification</div>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Process Name <span className="required">*</span></label>
                  <TagInput
                    tags={[form.processName, ...form.processNames].filter(Boolean)}
                    onAdd={(tag) => {
                      if (!form.processName) {
                        if (!isEdit) setForm(f => ({ ...f, processName: tag, id: generateId(f.function[0] || null, processes) }));
                        else set('processName', tag);
                      } else {
                        addPnTag(tag);
                      }
                    }}
                    onRemove={(idx) => {
                      if (idx === 0) {
                        const next = form.processNames[0] || '';
                        const rest = form.processNames.slice(1);
                        setForm(f => ({ ...f, processName: next, processNames: rest }));
                      } else {
                        removePnTag(idx - 1);
                      }
                    }}
                    inputRef={pnTagRef}
                    placeholder="Type a name and press Enter — add multiple aliases..."
                    suggestions={[
                      ...(orgTableData && form.function[0] ? (orgTableData[form.function[0]]?.processNames || []) : []),
                      ...new Set(processes.flatMap(p => [p.processName, ...(p.processNames || [])]).filter(Boolean)),
                    ].filter((v, i, a) => a.indexOf(v) === i)}
                  />
                  {errors.processName && <p className="form-error">{errors.processName}</p>}
                  <p className="form-hint">First name is the primary. Additional names are aliases — all are searchable.</p>
                </div>
                <div className="form-group">
                  <label>Level <span className="required">*</span></label>
                  <select value={form.level} onChange={e => set('level', e.target.value)}>
                    <option value="">Select level...</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {errors.level && <p className="form-error">{errors.level}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 — BPMN file */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3>BPMN Diagram <span className="required">*</span></h3>
              {form.fileName && <span className="badge badge-green">✓ {form.fileName}</span>}
            </div>
          </div>

          {/* Mode toggle — only when no BPMN attached yet */}
          {!form.bpmnXml && (
            <div style={{
              display: 'flex', gap: '6px',
              padding: '12px 18px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-raised)',
            }}>
              <button
                type="button"
                onClick={() => { setBpmnMode('upload'); setAiResult(null); setAiError(''); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '999px',
                  border: bpmnMode === 'upload' ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                  background: bpmnMode === 'upload' ? 'var(--primary-light)' : 'var(--surface)',
                  color: bpmnMode === 'upload' ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: bpmnMode === 'upload' ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                ⬆ Upload File
              </button>
              <button
                type="button"
                onClick={() => { setBpmnMode('ai'); setAiResult(null); setAiError(''); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '999px',
                  border: bpmnMode === 'ai' ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                  background: bpmnMode === 'ai'
                    ? 'linear-gradient(135deg, #4f6ef7 0%, #6c47ff 100%)'
                    : 'var(--surface)',
                  color: bpmnMode === 'ai' ? '#fff' : 'var(--text-muted)',
                  fontSize: '13px', fontWeight: bpmnMode === 'ai' ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: bpmnMode === 'ai' ? '0 2px 8px rgba(79,110,247,0.35)' : 'none',
                }}
              >
                ✦ Generate with AI
              </button>
            </div>
          )}

          <div className="card-body">
            {form.bpmnXml ? (
              /* ── Attached state ─────────────────────────── */
              <div className="upload-area has-file">
                <div className="upload-icon">✓</div>
                <div className="upload-title">Diagram Attached</div>
                <div className="upload-filename">{form.fileName}</div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: '12px' }}
                  onClick={removeFile}
                >
                  Remove &amp; Choose Different
                </button>
              </div>
            ) : bpmnMode === 'upload' ? (
              /* ── Upload mode ────────────────────────────── */
              <div
                className={`upload-area${dragOver ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon">⬆</div>
                <div className="upload-title">Drop your BPMN file here</div>
                <div className="upload-subtitle">or click to browse · Supports .bpmn and .xml files</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".bpmn,.xml"
                  style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files[0])}
                />
              </div>
            ) : (
              /* ── AI Generate mode ───────────────────────── */
              <div>
                <div style={{
                  background: 'linear-gradient(135deg, #f8f9ff 0%, #eef1fd 100%)',
                  border: '1px solid #c7d3fb',
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  marginBottom: aiResult ? '16px' : '0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{
                      width: '28px', height: '28px', borderRadius: '7px',
                      background: 'linear-gradient(135deg, #4f6ef7 0%, #6c47ff 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '13px', flexShrink: 0,
                    }}>✦</span>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-h)' }}>
                      Generate BPMN with AI
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      — describe your process and AI will create the diagram
                    </span>
                  </div>

                  {/* Context pills — show what process info will be sent */}
                  {(form.org || form.function.length > 0 || form.processName || form.subProcesses.length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      {form.org && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eef1fd', color: '#4f6ef7', border: '1px solid #c7d3fb', borderRadius: '999px', padding: '2px 10px', fontSize: '12px' }}>
                          <span style={{ opacity: 0.6, fontSize: '10px' }}>ORG</span> {form.org}
                        </span>
                      )}
                      {form.function.length > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eef1fd', color: '#4f6ef7', border: '1px solid #c7d3fb', borderRadius: '999px', padding: '2px 10px', fontSize: '12px' }}>
                          <span style={{ opacity: 0.6, fontSize: '10px' }}>FN</span> {form.function.join(', ')}
                        </span>
                      )}
                      {form.processName && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eef1fd', color: '#4f6ef7', border: '1px solid #c7d3fb', borderRadius: '999px', padding: '2px 10px', fontSize: '12px' }}>
                          <span style={{ opacity: 0.6, fontSize: '10px' }}>NAME</span> {form.processName}
                        </span>
                      )}
                      {form.subProcesses.map(sp => (
                        <span key={sp} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eef1fd', color: '#4f6ef7', border: '1px solid #c7d3fb', borderRadius: '999px', padding: '2px 10px', fontSize: '12px' }}>
                          <span style={{ opacity: 0.6, fontSize: '10px' }}>SUB</span> {sp}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <textarea
                      value={aiDesc}
                      onChange={e => setAiDesc(e.target.value)}
                      rows={4}
                      placeholder="Describe the business process in detail — include actors, tasks, decision points, and expected outcomes…"
                      style={{
                        flex: 1, resize: 'vertical',
                        borderColor: aiDesc.trim() ? 'var(--primary)' : 'var(--border)',
                        boxShadow: aiDesc.trim() ? '0 0 0 3px rgba(79,110,247,0.1)' : 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      disabled={aiGenerating}
                    />
                    <button
                      type="button"
                      disabled={aiGenerating || !aiDesc.trim()}
                      onClick={handleAiGenerate}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                        padding: '10px 18px',
                        background: aiGenerating || !aiDesc.trim()
                          ? 'var(--text-light)'
                          : 'linear-gradient(135deg, #4f6ef7 0%, #6c47ff 100%)',
                        color: '#fff', border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13.5px', fontWeight: 600,
                        cursor: aiGenerating || !aiDesc.trim() ? 'not-allowed' : 'pointer',
                        boxShadow: aiGenerating || !aiDesc.trim() ? 'none' : '0 3px 10px rgba(79,110,247,0.4)',
                        flexShrink: 0, alignSelf: 'flex-end',
                        transition: 'all 0.2s',
                      }}
                    >
                      {aiGenerating
                        ? <><span className="ai-spinner" /> Generating…</>
                        : '✦ Generate'
                      }
                    </button>
                  </div>
                  {/* Compact doc upload */}
                  <div style={{ marginTop: '10px', borderTop: '1px solid #dde3f8', paddingTop: '10px' }}>
                    {!docMeta ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>Reference doc:</span>
                        <button
                          type="button"
                          onClick={() => docInputRef.current?.click()}
                          disabled={extracting}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '4px 10px',
                            background: 'var(--surface)', color: 'var(--text-muted)',
                            border: '1px solid var(--border)', borderRadius: '999px',
                            fontSize: '12px', cursor: extracting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {extracting ? <><span className="ai-spinner" style={{ borderTopColor: 'var(--primary)', borderColor: 'var(--border)' }} /> Extracting…</> : '📄 Browse file'}
                        </button>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-light)' }}>.bpmn · .pdf · .docx · .doc</span>
                        <input ref={docInputRef} type="file" accept=".bpmn,.pdf,.docx,.doc" style={{ display: 'none' }} onChange={handleDocFile} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>Reference doc:</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid #c7d3fb', borderRadius: '999px', padding: '3px 10px', fontSize: '12px', fontWeight: 500, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {docMeta.file_type === 'bpmn' ? '◈' : '📄'} {docMeta.filename}
                          {docMeta.has_bpmn && <span style={{ color: '#7e22ce', fontWeight: 700 }}>· BPMN</span>}
                        </span>
                        <button type="button" onClick={clearDoc} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' }}>✕</button>
                      </div>
                    )}
                    {extractError && <p style={{ color: 'var(--danger)', fontSize: '12px', margin: '5px 0 0' }}>{extractError}</p>}
                  </div>

                  {aiError && (
                    <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--radius)', marginTop: '10px', fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span>⚠</span> {aiError}
                    </div>
                  )}
                </div>

                {/* Preview + Use button */}
                {aiResult && (
                  <div style={{
                    border: '1px solid #c7d3fb',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '10px 14px',
                      background: 'var(--primary-light)',
                      borderBottom: '1px solid #c7d3fb',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                        ✦ AI-Generated BPMN — Edit before saving
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {aiResult.rag_used && (
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#7e22ce', background: '#f3e8ff', padding: '2px 8px', borderRadius: '999px' }}>
                            ✦ RAG applied
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleUseAiBpmn}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '7px 16px',
                            background: 'linear-gradient(135deg, #4f6ef7 0%, #6c47ff 100%)',
                            color: '#fff', border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '13px', fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(79,110,247,0.4)',
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                        >
                          ✓ Use this BPMN
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setAiResult(null); setAiDesc(''); }}
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                    <BpmnEditor ref={editorRef} xml={aiResult.xml} />
                  </div>
                )}
              </div>
            )}
            {errors.file && <p className="form-error" style={{ marginTop: '8px' }}>{errors.file}</p>}
          </div>
        </div>

        {needsApproval && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <h3>Approval Request Notes</h3>
              <span className="badge badge-yellow">Requires Process Owner Approval</span>
            </div>
            <div className="card-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Notes for reviewer <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  value={changeNotes}
                  onChange={e => setChangeNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe what changed and why…"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        )}

        {submitAttempted && Object.keys(errors).filter(k => k !== 'submit').length > 0 && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px' }}>⚠</span>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#92400e' }}>
                Please fix the following before submitting:
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.entries(errors)
                .filter(([k]) => k !== 'submit')
                .map(([k, msg]) => (
                  <li key={k} style={{ fontSize: '13px', color: '#b45309' }}>{msg}</li>
                ))}
            </ul>
          </div>
        )}

        {errors.submit && (
          <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '16px', fontSize: '13.5px' }}>
            {errors.submit}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving
              ? (needsApproval ? 'Submitting…' : 'Saving…')
              : needsApproval
                ? (isEdit ? '↑ Submit Changes for Approval' : '↑ Submit for Approval')
                : (isEdit ? '✓ Save Changes' : '+ Add Process')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProcessForm;
