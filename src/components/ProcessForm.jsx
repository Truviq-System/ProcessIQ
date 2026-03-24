import { useState, useRef, useEffect } from 'react';
import { createProcess, updateProcess, generateId, getOrgs, getOrgData, createChangeRequest } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

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

function ProcessForm({ process, processes = [], onSave, onCancel, permissions = {} }) {
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
      : { ...defaultForm }
  );
  const [errors, setErrors] = useState({});
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
    if (!form.level) e.level = 'Level is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
                  <label>Sub-Processes</label>
                  <TagInput
                    tags={form.subProcesses}
                    onAdd={addSpTag}
                    onRemove={removeSpTag}
                    inputRef={spTagRef}
                    placeholder="Type to search or add sub-processes..."
                    suggestions={orgTableData && form.function[0] ? (orgTableData[form.function[0]]?.subProcesses || []) : []}
                  />
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
            <h3>BPMN Diagram <span className="required">*</span></h3>
            {form.fileName && <span className="badge badge-green">✓ {form.fileName}</span>}
          </div>
          <div className="card-body">
            {form.bpmnXml ? (
              <div className="upload-area has-file">
                <div className="upload-icon">✓</div>
                <div className="upload-title">Diagram Attached</div>
                <div className="upload-filename">{form.fileName}</div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: '12px' }} onClick={removeFile}>
                  Remove &amp; Upload Different File
                </button>
              </div>
            ) : (
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
            )}
            {errors.file && <p className="form-error">{errors.file}</p>}
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
