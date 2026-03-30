import { useState, useEffect, useRef } from 'react';
import { deleteProcess, updateProcess, updateBpmn, getProcess, getProcessVersions, createProcess, getProcesses, generateId, createChangeRequest, aiGenerateBpmn } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import BpmnViewer from './BpmnViewer';
import BpmnEditor from './BpmnEditor';

const LEVELS = ['Support', 'Core', 'Strategic'];
const LEVEL_BADGE = {
  Support: 'badge-blue',
  Core: 'badge-green',
  Strategic: 'badge-purple',
};

// Inline editable field
function EditableField({ label, value, type = 'text', onSave, canEdit = true }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const start = () => { setDraft(value || ''); setEditing(true); };
  const cancel = () => setEditing(false);

  const save = async () => {
    if (draft === (value || '')) { cancel(); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && type !== 'select') save();
    if (e.key === 'Escape') cancel();
  };

  return (
    <div className="detail-meta-item">
      <div className="detail-meta-label">{label}</div>
      {editing ? (
        <div className="inline-edit-row">
          {type === 'select' ? (
            <select
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="inline-edit-input"
            >
              <option value="">— none —</option>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          ) : (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onKey}
              className="inline-edit-input"
            />
          )}
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? '...' : '✓'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={saving}>✕</button>
        </div>
      ) : (
        <div
          className="inline-edit-display"
          onClick={canEdit ? start : undefined}
          title={canEdit ? 'Click to edit' : undefined}
          style={canEdit ? undefined : { cursor: 'default' }}
        >
          {type === 'select' && value
            ? <span className={`badge ${LEVEL_BADGE[value] || 'badge-gray'}`}>{value}</span>
            : <span className="detail-meta-value">{value || <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>—</span>}</span>
          }
          {canEdit && <span className="inline-edit-pencil">✎</span>}
        </div>
      )}
    </div>
  );
}

// Normalize subProcesses to an array of tag strings
function normalizeSubProcessTags(sps) {
  if (!Array.isArray(sps)) return [];
  return sps.map(sp => (typeof sp === 'string' ? sp : sp.name)).filter(Boolean);
}

function ProcessDetail({ process, onNavigate, onDelete, onSave, permissions = {} }) {
  const { user } = useAuth()
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingBpmn, setEditingBpmn] = useState(false);
  const [currentProcess, setCurrentProcess] = useState(process);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [bpmnSubmitted, setBpmnSubmitted] = useState(false);
  const [namesDraft, setNamesDraft] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [nameSaveModal, setNameSaveModal] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);

  // Inline AI generation panel
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiDesc, setAiDesc] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    if (!process?.id) return;
    setFetching(true);
    setFetchError(null);
    setSelectedVersion(null);
    Promise.all([getProcess(process.id), getProcessVersions(process.id)])
      .then(([data, vers]) => { setCurrentProcess(data); setVersions(vers); setFetching(false); })
      .catch(err => { setFetchError(err.message); setFetching(false); });
    setNamesDraft(null);
    setNameInput('');
  }, [process?.id]);

  if (fetching) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '32px', opacity: 0.4 }}>◌</div>
        <p>Loading process...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠</div>
        <h3>Failed to load process</h3>
        <p style={{ color: 'var(--danger)' }}>{fetchError}</p>
      </div>
    );
  }

  if (!currentProcess) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">◈</div>
        <h3>Process not found</h3>
        <button className="btn btn-primary" onClick={() => onNavigate('processes')}>Back</button>
      </div>
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProcess(currentProcess.id);
      onDelete(currentProcess.id);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleDownload = () => {
    if (!currentProcess.bpmnXml) return;
    const blob = new Blob([currentProcess.bpmnXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentProcess.fileName || `${currentProcess.id}.bpmn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBpmnSave = async (newXml, changeNotes) => {
    if (permissions.editsRequireApproval) {
      await createChangeRequest({
        processId:      currentProcess.id,
        requestedBy:    user.id,
        requesterEmail: user.email,
        changeType:     'bpmn',
        changeData:     { bpmnXml: newXml, fileName: currentProcess.fileName, changeNotes },
        changeNotes,
      });
      setEditingBpmn(false);
      setBpmnSubmitted(true);
      return;
    }
    const saved = await updateBpmn(currentProcess.id, {
      bpmnXml: newXml,
      fileName: currentProcess.fileName,
      changeNotes,
    });
    setCurrentProcess(saved);
    setEditingBpmn(false);
    if (onSave) onSave(saved);
  };

  const handleAiGenerate = async () => {
    if (!aiDesc.trim()) return;
    setAiGenerating(true);
    setAiError('');
    setAiResult(null);
    try {
      const data = await aiGenerateBpmn({ description: aiDesc });
      if (!data.success) throw new Error(data.error || 'Generation failed');
      setAiResult(data);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApplyAiBpmn = async () => {
    if (!aiResult?.xml) return;
    try {
      await handleBpmnSave(aiResult.xml, 'AI-generated BPMN');
      setShowAiPanel(false);
      setAiResult(null);
      setAiDesc('');
    } catch (err) {
      setAiError('Failed to apply: ' + err.message);
    }
  };

  const persist = async (patch) => {
    const saved = await updateProcess(currentProcess.id, { ...currentProcess, ...patch });
    setCurrentProcess(saved);
    if (onSave) onSave(saved);
  };

  const allNames = namesDraft ?? [currentProcess?.processName, ...(currentProcess?.processNames || [])].filter(Boolean);

  const handleAddName = () => {
    const t = nameInput.trim();
    if (!t || allNames.includes(t)) return;
    setNamesDraft([...allNames, t]);
    setNameInput('');
  };

  const handleRemoveName = (idx) => {
    if (allNames.length === 1) return;
    setNamesDraft(allNames.filter((_, i) => i !== idx));
  };

  const handleNamesSave = async (asNew) => {
    setNameSaving(true);
    const [primary, ...aliases] = allNames;
    try {
      if (asNew) {
        const existing = await getProcesses();
        const newId = generateId(currentProcess.function?.[0] || null, existing);
        const saved = await createProcess({
          ...currentProcess,
          id: newId,
          processName: primary,
          processNames: aliases,
          version: '1.0',
          createdAt: undefined,
          updatedAt: undefined,
        });
        setNamesDraft(null);
        setNameInput('');
        setNameSaveModal(false);
        if (onSave) onSave(saved);
        onNavigate('detail', saved);
      } else {
        const saved = await updateProcess(currentProcess.id, { ...currentProcess, processName: primary, processNames: aliases });
        setCurrentProcess(saved);
        setNamesDraft(null);
        setNameInput('');
        setNameSaveModal(false);
        if (onSave) onSave(saved);
      }
    } catch (err) {
      alert('Failed to save: ' + err.message);
    } finally {
      setNameSaving(false);
    }
  };

  const formatDate = (iso) => iso ? new Date(iso).toLocaleString() : '—';

  return (
    <div>
      {editingBpmn && (
        <BpmnEditor
          xml={currentProcess.bpmnXml}
          fileName={currentProcess.fileName}
          onSave={handleBpmnSave}
          onClose={() => setEditingBpmn(false)}
        />
      )}

      {bpmnSubmitted && (
        <div style={{ background: 'var(--success-light)', color: 'var(--success)', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '16px', fontSize: '13.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ BPMN change submitted for approval. A Process Owner will review it.</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setBpmnSubmitted(false)}>✕</button>
        </div>
      )}

      <div className="breadcrumb">
        <span className="breadcrumb-item" onClick={() => onNavigate('dashboard')}>Dashboard</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{currentProcess.processName}</span>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1>{currentProcess.processName}</h1>
          <p style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
            <span className="font-mono" style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text-muted)', display: 'inline-block', padding: '2px 8px', background: 'var(--surface-raised)', borderRadius: '8px', letterSpacing: '0.03em' }}>{currentProcess.id}</span>
            {currentProcess.level && (
              <span className={`badge ${LEVEL_BADGE[currentProcess.level] || 'badge-gray'}`}>
                {currentProcess.level}
              </span>
            )}
            {currentProcess.version && (
              <select
                className="badge badge-blue"
                style={{ cursor: 'pointer', border: 'none', background: 'transparent', appearance: 'auto', paddingRight: '4px' }}
                value={selectedVersion?.id ?? ''}
                onChange={e => {
                  const v = versions.find(v => String(v.id) === e.target.value) || null;
                  setSelectedVersion(v);
                }}
              >
                <option value="">v{currentProcess.version} (current)</option>
                {versions.map(v => (
                  <option key={v.id} value={String(v.id)}>
                    v{v.version}{v.changeNotes ? ` — ${v.changeNotes}` : ''} ({new Date(v.archivedAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            )}
          </p>
        </div>
        <div className="page-header-actions">
          {currentProcess.bpmnXml && (
            <button className="btn btn-secondary" onClick={handleDownload}>↓ Download</button>
          )}
          {permissions.edit && (
            <button className="btn btn-secondary" onClick={() => setEditingBpmn(true)}>
              Edit BPMN
            </button>
          )}
          {permissions.delete && (
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* BPMN Diagram */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3>BPMN Diagram</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {selectedVersion && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Viewing archived v{selectedVersion.version}
                {selectedVersion.changeNotes ? ` — ${selectedVersion.changeNotes}` : ''}
              </span>
            )}
            {permissions.edit && (
              <button
                className="btn btn-sm"
                onClick={() => { setShowAiPanel(p => !p); setAiResult(null); setAiError(''); setAiDesc(''); }}
                style={showAiPanel ? {
                  background: 'linear-gradient(135deg, #4f6ef7 0%, #6c47ff 100%)',
                  color: '#fff', border: 'none',
                  boxShadow: '0 2px 6px rgba(79,110,247,0.3)',
                } : {
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  border: '1px solid #c7d3fb',
                  fontWeight: 600,
                }}
              >
                ✦ {showAiPanel ? 'Close AI' : 'Generate with AI'}
              </button>
            )}
          </div>
        </div>

        {/* Inline AI Generation Panel */}
        {showAiPanel && (
          <div style={{
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, #f8f9ff 0%, #eef1fd 100%)',
            padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--primary)' }}>✦ AI BPMN Generator</span>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 400 }}>
                — describe your process to generate a new diagram
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <textarea
                value={aiDesc}
                onChange={e => setAiDesc(e.target.value)}
                rows={3}
                placeholder="Describe the business process in detail — include actors, tasks, decision points, and expected outcomes…"
                style={{ flex: 1, resize: 'vertical' }}
                disabled={aiGenerating}
              />
              <button
                className="btn btn-primary"
                disabled={aiGenerating || !aiDesc.trim()}
                onClick={handleAiGenerate}
                style={{ flexShrink: 0, alignSelf: 'flex-end' }}
              >
                {aiGenerating ? (
                  <><span className="ai-spinner" /> Generating…</>
                ) : '✦ Generate'}
              </button>
            </div>

            {aiError && (
              <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 'var(--radius)', marginTop: '10px', fontSize: '13px' }}>
                {aiError}
              </div>
            )}

            {aiResult && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Preview — apply this to replace the current BPMN diagram.
                </div>
                <BpmnViewer xml={aiResult.xml} fileName="ai-preview.bpmn" />

                {/* Attractive action row */}
                <div style={{
                  display: 'flex', gap: '10px', alignItems: 'center',
                  marginTop: '14px', paddingTop: '14px',
                  borderTop: '1px solid #dde3f8',
                }}>
                  <button
                    onClick={handleApplyAiBpmn}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      padding: '9px 20px',
                      background: 'linear-gradient(135deg, #4f6ef7 0%, #6c47ff 100%)',
                      color: '#fff', border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13.5px', fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 3px 10px rgba(79,110,247,0.4)',
                      transition: 'opacity 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    ✓ Apply to Process
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setAiResult(null); setAiDesc(''); setShowAiPanel(false); }}
                  >
                    Discard
                  </button>
                  {aiResult.rag_used && (
                    <span className="badge badge-purple" style={{ marginLeft: 'auto' }}>✦ RAG context applied</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="card-body" style={{ padding: 0 }}>
          <BpmnViewer
            xml={selectedVersion ? selectedVersion.bpmnXml : currentProcess.bpmnXml}
            fileName={selectedVersion ? selectedVersion.fileName : currentProcess.fileName}
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3>Process Details</h3>
        </div>
        <div className="card-body">

          {/* Organization */}
          <div className="form-section">
            <div className="form-section-title">Organization</div>
            <div className="detail-meta-item">
              <div className="detail-meta-label">Organization</div>
              <div className="detail-meta-value">{currentProcess.org || <span style={{ color: 'var(--text-light)' }}>—</span>}</div>
            </div>
          </div>

          {/* Functions & Sub-Processes */}
          <div className="form-section">
            <div className="form-section-title">Functions &amp; Sub-Processes</div>
            <div className="form-grid">
              <div className="detail-meta-item">
                <div className="detail-meta-label">Function</div>
                <div className="detail-meta-value">
                  {(() => {
                    const fns = normalizeSubProcessTags(currentProcess.function);
                    return fns.length > 0
                      ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                        {fns.map((f, i) => <span key={i} className="tag-chip" style={{ cursor: 'default' }}>{f}</span>)}
                      </div>
                      : <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>—</span>;
                  })()}
                </div>
              </div>
              <div className="detail-meta-item">
                <div className="detail-meta-label">Sub-Processes</div>
                <div className="detail-meta-value">
                  {(() => {
                    const tags = normalizeSubProcessTags(currentProcess.subProcesses);
                    return tags.length > 0
                      ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                        {tags.map((tag, idx) => (
                          <span key={idx} className="tag-chip" style={{ cursor: 'default' }}>{tag}</span>
                        ))}
                      </div>
                      : <span style={{ color: 'var(--text-light)', fontWeight: 400 }}>—</span>;
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Identification */}
          <div className="form-section">
            <div className="form-section-title">Identification</div>
            <div className="form-grid">
              <div className="detail-meta-item" style={{ gridColumn: '1 / -1' }}>
                <div className="detail-meta-label">Process Name</div>
                <div className="detail-meta-value">
                  <div className="tag-input-container" style={{ marginTop: '4px' }}>
                    {allNames.map((n, i) => (
                      <span key={i} className="tag-chip" style={{ opacity: i === 0 ? 1 : 0.85 }}>
                        {n}
                        {permissions.edit && !permissions.editsRequireApproval && (
                          <button
                            type="button"
                            className="tag-chip-remove"
                            onClick={() => handleRemoveName(i)}
                            disabled={allNames.length === 1}
                            title={allNames.length === 1 ? 'Must have at least one name' : 'Remove'}
                          >✕</button>
                        )}
                      </span>
                    ))}
                    {permissions.edit && !permissions.editsRequireApproval && (
                      <input
                        type="text"
                        className="tag-input"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAddName(); }
                        }}
                        placeholder="Add name..."
                      />
                    )}
                  </div>
                  {namesDraft !== null && permissions.edit && !permissions.editsRequireApproval && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => setNameSaveModal(true)}>
                        Save Names
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setNamesDraft(null); setNameInput(''); }}>
                        Discard
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <EditableField
                label="Level"
                value={currentProcess.level}
                type="select"
                onSave={v => persist({ level: v })}
                canEdit={!!permissions.edit && !permissions.editsRequireApproval}
              />
              <div className="detail-meta-item">
                <div className="detail-meta-label">Version</div>
                <div className="detail-meta-value">
                  {currentProcess.version
                    ? <span className="badge badge-blue">v{currentProcess.version}</span>
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="detail-meta-grid" style={{ marginTop: '8px' }}>
            <div className="detail-meta-item">
              <div className="detail-meta-label">Created</div>
              <div className="detail-meta-value">{formatDate(currentProcess.createdAt)}</div>
            </div>
            <div className="detail-meta-item">
              <div className="detail-meta-label">Last Updated</div>
              <div className="detail-meta-value">{formatDate(currentProcess.updatedAt)}</div>
            </div>
          </div>

        </div>
      </div>

      {nameSaveModal && (
        <div className="delete-modal-overlay" onClick={() => setNameSaveModal(false)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>◈</div>
            <h3>Save Name Changes</h3>
            <p>How would you like to save the updated process names?</p>
            <div className="delete-modal-actions" style={{ flexDirection: 'column' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '10px 16px' }}
                onClick={() => handleNamesSave(false)}
                disabled={nameSaving}
              >
                <span>Save as new version</span>
                <span style={{ fontSize: '11px', opacity: 0.75, fontWeight: 400 }}>Updates this process · v{currentProcess.version} → next</span>
              </button>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '10px 16px' }}
                onClick={() => handleNamesSave(true)}
                disabled={nameSaving}
              >
                <span>Save as new process</span>
                <span style={{ fontSize: '11px', opacity: 0.75, fontWeight: 400 }}>Creates a new entry with a new ID</span>
              </button>
              <button className="btn btn-ghost" onClick={() => setNameSaveModal(false)} disabled={nameSaving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="delete-modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-icon">⚠</div>
            <h3>Delete Process?</h3>
            <p>
              Are you sure you want to delete{' '}
              <strong>{currentProcess.processName}</strong>?
              This action cannot be undone.
            </p>
            <div className="delete-modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ProcessDetail;
