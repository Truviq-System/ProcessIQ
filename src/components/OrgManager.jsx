import { useState, useEffect, useRef } from 'react';
import { getOrgs, getOrgData, addOrgFunction, deleteOrgFunction, deleteOrg } from '../utils/api';

function TagInput({ tags, onChange, placeholder, suggestions = [] }) {
  const [input, setInput] = useState('');
  const [showSug, setShowSug] = useState(false);
  const inputRef = useRef(null);

  const filtered = suggestions.filter(
    s => !tags.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  );

  const commit = (val) => {
    const tag = val.trim().replace(/,$/, '').trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput('');
    setShowSug(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(input); }
    else if (e.key === 'Backspace' && !input && tags.length > 0) onChange(tags.slice(0, -1));
    else if (e.key === 'Escape') setShowSug(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div className="tag-input-container" onClick={() => inputRef.current?.focus()}>
        {tags.map((tag, i) => (
          <span key={i} className="tag-chip">
            {tag}
            <button type="button" className="tag-chip-remove"
              onClick={e => { e.stopPropagation(); onChange(tags.filter((_, j) => j !== i)); }}>
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="tag-input"
          value={input}
          onChange={e => { setInput(e.target.value); setShowSug(true); }}
          onKeyDown={onKeyDown}
          onFocus={() => setShowSug(true)}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder={tags.length === 0 ? placeholder : ''}
        />
      </div>
      {showSug && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          maxHeight: '160px', overflowY: 'auto', marginTop: '2px',
        }}>
          {filtered.map(s => (
            <div key={s} onMouseDown={() => commit(s)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13.5px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover, #f5f5f5)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FunctionCard({ org, fnName, subProcesses, processNames, onSaved, onDeleted }) {
  const [sps, setSps] = useState(subProcesses || []);
  const [pns, setPns] = useState(processNames || []);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = JSON.stringify(sps) !== JSON.stringify(subProcesses || []) ||
                  JSON.stringify(pns) !== JSON.stringify(processNames || []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await addOrgFunction(org, { functionName: fnName, subProcesses: sps, processNames: pns });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteOrgFunction(org, fnName);
      onDeleted();
    } catch (err) {
      alert('Delete failed: ' + err.message);
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', opacity: 0.5 }}>{expanded ? '▾' : '▸'}</span>
          <h4 style={{ margin: 0, fontSize: '14.5px' }}>{fnName}</h4>
          {(sps.length > 0 || pns.length > 0) && (
            <span className="badge badge-gray" style={{ fontSize: '11px' }}>
              {sps.length} sub · {pns.length} names
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
          {isDirty && (
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          {saved && !isDirty && (
            <span style={{ fontSize: '12px', color: 'var(--success, green)' }}>Saved</span>
          )}
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
            onClick={() => setConfirmDel(true)}>Delete</button>
        </div>
      </div>

      {expanded && (
        <div className="card-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Sub-Processes</label>
              <TagInput
                tags={sps}
                onChange={setSps}
                placeholder="Type and press Enter to add..."
              />
              <p className="form-hint">{sps.length} sub-process{sps.length !== 1 ? 'es' : ''}</p>
            </div>
            <div className="form-group">
              <label>Process Names</label>
              <TagInput
                tags={pns}
                onChange={setPns}
                placeholder="Type and press Enter to add..."
              />
              <p className="form-hint">{pns.length} process name{pns.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {isDirty && (
            <div style={{ marginTop: '12px' }}>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      )}

      {confirmDel && (
        <div className="delete-modal-overlay" onClick={() => setConfirmDel(false)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-icon">⚠</div>
            <h3>Delete Function?</h3>
            <p>
              Are you sure you want to delete <strong>{fnName}</strong>?
              This action cannot be undone.
            </p>
            <div className="delete-modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDel(false)} disabled={deleting}>
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

function OrgManager({ onNavigate }) {
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgData, setOrgData] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  // Add org
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [addingOrg, setAddingOrg] = useState(false);

  // Add function
  const [showAddFn, setShowAddFn] = useState(false);
  const [newFn, setNewFn] = useState({ name: '', subProcesses: [], processNames: [] });
  const [addingFn, setAddingFn] = useState(false);

  // Delete org
  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);

  useEffect(() => {
    getOrgs()
      .then(list => { setOrgs(list); if (list.length > 0) setSelectedOrg(list[0]); })
      .catch(err => alert('Failed to load organizations: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedOrg) return;
    setLoadingData(true);
    getOrgData(selectedOrg)
      .then(setOrgData)
      .catch(() => setOrgData({}))
      .finally(() => setLoadingData(false));
  }, [selectedOrg]);

  const reloadOrgData = () => {
    if (!selectedOrg) return;
    getOrgData(selectedOrg).then(setOrgData).catch(() => {});
  };

  const handleAddOrg = async () => {
    const name = newOrgName.trim();
    if (!name) return;
    setAddingOrg(true);
    try {
      // Create the org with a placeholder function that the user fills in
      await addOrgFunction(name, { functionName: '__placeholder__', subProcesses: [], processNames: [] });
      await deleteOrgFunction(name, '__placeholder__');
      const updated = await getOrgs();
      setOrgs(updated);
      setSelectedOrg(name);
      setNewOrgName('');
      setShowAddOrg(false);
    } catch (err) {
      alert('Failed to create organization: ' + err.message);
    } finally {
      setAddingOrg(false);
    }
  };

  const handleAddFunction = async () => {
    if (!newFn.name.trim()) return;
    setAddingFn(true);
    try {
      await addOrgFunction(selectedOrg, {
        functionName: newFn.name.trim(),
        subProcesses: newFn.subProcesses,
        processNames: newFn.processNames,
      });
      setNewFn({ name: '', subProcesses: [], processNames: [] });
      setShowAddFn(false);
      reloadOrgData();
    } catch (err) {
      alert('Failed to add function: ' + err.message);
    } finally {
      setAddingFn(false);
    }
  };

  const handleDeleteOrg = async () => {
    setDeletingOrg(true);
    try {
      await deleteOrg(selectedOrg);
      const updated = await getOrgs();
      setOrgs(updated);
      setSelectedOrg(updated[0] || null);
      setOrgData({});
      setConfirmDeleteOrg(false);
    } catch (err) {
      alert('Failed to delete organization: ' + err.message);
    } finally {
      setDeletingOrg(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '32px', opacity: 0.4 }}>◌</div>
        <p>Loading organizations...</p>
      </div>
    );
  }

  const functions = Object.entries(orgData);

  return (
    <div>
      <div className="breadcrumb">
        <span className="breadcrumb-item" onClick={() => onNavigate('dashboard')}>Dashboard</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Organization Manager</span>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1>Organization Manager</h1>
          <p>Manage organizations, functions, sub-processes, and process names.</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowAddOrg(true)}>
            + Add Organization
          </button>
        </div>
      </div>

      {/* Add Organization inline form */}
      {showAddOrg && (
        <div className="card" style={{ marginBottom: '20px', borderColor: 'var(--primary, #4f6ef7)' }}>
          <div className="card-header"><h3>New Organization</h3></div>
          <div className="card-body">
            <div className="form-group" style={{ maxWidth: '360px' }}>
              <label>Organization Name <span className="required">*</span></label>
              <input
                type="text"
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddOrg()}
                placeholder="e.g. Acme Corp"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className="btn btn-primary" onClick={handleAddOrg} disabled={addingOrg || !newOrgName.trim()}>
                {addingOrg ? 'Creating...' : 'Create Organization'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowAddOrg(false); setNewOrgName(''); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Org list */}
        <div className="card">
          <div className="card-header"><h3>Organizations</h3></div>
          <div className="card-body" style={{ padding: '8px' }}>
            {orgs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px' }}>No organizations yet.</p>
            ) : (
              orgs.map(org => (
                <button
                  key={org}
                  onClick={() => { setSelectedOrg(org); setConfirmDeleteOrg(false); setShowAddFn(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '9px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    fontSize: '13.5px', fontWeight: selectedOrg === org ? 600 : 400,
                    background: selectedOrg === org ? 'var(--primary-light, #eef1fd)' : 'transparent',
                    color: selectedOrg === org ? 'var(--primary, #4f6ef7)' : 'var(--text)',
                    marginBottom: '2px',
                  }}
                >
                  {org}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Org detail */}
        <div>
          {!selectedOrg ? (
            <div className="card">
              <div className="card-body empty-state">
                <div className="empty-state-icon">🏢</div>
                <p>Select or create an organization to get started.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Org header card */}
              <div className="card" style={{ marginBottom: '16px' }}>
                <div className="card-header">
                  <h3>{selectedOrg}</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-gray">{functions.length} function{functions.length !== 1 ? 's' : ''}</span>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                      onClick={() => setConfirmDeleteOrg(true)}>
                      Delete Org
                    </button>
                  </div>
                </div>
              </div>

              {/* Functions */}
              {loadingData ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading...</div>
              ) : (
                <>
                  {functions.length === 0 && !showAddFn && (
                    <div className="card" style={{ marginBottom: '12px' }}>
                      <div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                        No functions yet. Add the first function below.
                      </div>
                    </div>
                  )}

                  {functions.map(([fn, data]) => (
                    <FunctionCard
                      key={fn}
                      org={selectedOrg}
                      fnName={fn}
                      subProcesses={data.subProcesses}
                      processNames={data.processNames}
                      onSaved={reloadOrgData}
                      onDeleted={reloadOrgData}
                    />
                  ))}

                  {/* Add Function */}
                  {showAddFn ? (
                    <div className="card" style={{ marginBottom: '12px', borderColor: 'var(--primary, #4f6ef7)' }}>
                      <div className="card-header"><h4 style={{ margin: 0 }}>New Function</h4></div>
                      <div className="card-body">
                        <div className="form-group">
                          <label>Function Name <span className="required">*</span></label>
                          <input
                            type="text"
                            value={newFn.name}
                            onChange={e => setNewFn(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Finance, HR, Sales..."
                            autoFocus
                          />
                        </div>
                        <div className="form-grid">
                          <div className="form-group">
                            <label>Sub-Processes</label>
                            <TagInput
                              tags={newFn.subProcesses}
                              onChange={v => setNewFn(f => ({ ...f, subProcesses: v }))}
                              placeholder="Type and press Enter..."
                            />
                          </div>
                          <div className="form-group">
                            <label>Process Names</label>
                            <TagInput
                              tags={newFn.processNames}
                              onChange={v => setNewFn(f => ({ ...f, processNames: v }))}
                              placeholder="Type and press Enter..."
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button className="btn btn-primary" onClick={handleAddFunction}
                            disabled={addingFn || !newFn.name.trim()}>
                            {addingFn ? 'Adding...' : 'Add Function'}
                          </button>
                          <button className="btn btn-ghost"
                            onClick={() => { setShowAddFn(false); setNewFn({ name: '', subProcesses: [], processNames: [] }); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => setShowAddFn(true)}>
                      + Add Function
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {confirmDeleteOrg && (
        <div className="delete-modal-overlay" onClick={() => setConfirmDeleteOrg(false)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-icon">⚠</div>
            <h3>Delete Organization?</h3>
            <p>
              Are you sure you want to delete <strong>{selectedOrg}</strong>?
              This will remove all its functions and data. This action cannot be undone.
            </p>
            <div className="delete-modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDeleteOrg(false)} disabled={deletingOrg}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteOrg} disabled={deletingOrg}>
                {deletingOrg ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrgManager;
