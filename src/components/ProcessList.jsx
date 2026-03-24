import { useState, useEffect } from 'react';
import { deleteProcess } from '../utils/api';

function ProcessList({ processes, onNavigate, onDelete, onRefresh, initialFilterOrg = '' }) {
  const [search, setSearch] = useState('');
  const [filterOrg, setFilterOrg] = useState(initialFilterOrg);

  useEffect(() => {
    setFilterOrg(initialFilterOrg);
  }, [initialFilterOrg]);
  const [filterLevel, setFilterLevel] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const orgs = [...new Set(processes.map(p => p.org).filter(Boolean))];
  const levels = [...new Set(processes.map(p => p.level).filter(Boolean))];

  const filtered = processes.filter(p => {
    const q = search.toLowerCase();
    const fns = Array.isArray(p.function) ? p.function : (p.function ? [p.function] : []);
    const matchSearch = !q ||
      p.processName?.toLowerCase().includes(q) ||
      (p.processNames || []).some(n => n.toLowerCase().includes(q)) ||
      p.id?.toLowerCase().includes(q) ||
      p.org?.toLowerCase().includes(q) ||
      fns.some(f => f.toLowerCase().includes(q)) ||
      p.level?.toLowerCase().includes(q);
    const matchOrg = !filterOrg || p.org === filterOrg;
    const matchLevel = !filterLevel || p.level === filterLevel;
    return matchSearch && matchOrg && matchLevel;
  });

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await deleteProcess(id);
      onDelete(id);
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const levelBadge = (level) => {
    const map = { L1: 'badge-blue', L2: 'badge-green', L3: 'badge-yellow', L4: 'badge-purple', L5: 'badge-red' };
    return map[level] || 'badge-gray';
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Process Library</h1>
          <p>{processes.length} process{processes.length !== 1 ? 'es' : ''} in your repository</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={onRefresh} title="Refresh">↺ Refresh</button>
          <button className="btn btn-primary" onClick={() => onNavigate('add')}>+ Add Process</button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search processes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {orgs.length > 0 && (
              <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} style={{ width: 'auto' }}>
                <option value="">All Orgs</option>
                {orgs.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {levels.length > 0 && (
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{ width: 'auto' }}>
                <option value="">All Levels</option>
                {levels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            {(search || filterOrg || filterLevel) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterOrg(''); setFilterLevel(''); }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◈</div>
            <h3>{processes.length === 0 ? 'No processes yet' : 'No results found'}</h3>
            <p>
              {processes.length === 0
                ? 'Upload your first BPMN diagram to get started.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {processes.length === 0 && (
              <button className="btn btn-primary" onClick={() => onNavigate('add')}>+ Add Process</button>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Process Name</th>
                <th>Organization</th>
                <th>Function</th>
                <th>Level</th>
                <th>Sub-Processes</th>
                <th>Version</th>
                <th>Diagram</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: 'nowrap', minWidth: '50px' }}>
                    <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-block', padding: '2px 4px', background: 'var(--surface-raised)', borderRadius: '2px', letterSpacing: '0.03em' }}>{p.id}</span>
                  </td>
                  <td>
                    <span
                      style={{ fontWeight: 500, cursor: 'pointer', color: 'var(--primary)' }}
                      onClick={() => onNavigate('detail', p)}
                    >
                      {p.processName}
                    </span>
                    {(p.processNames || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {(p.processNames || []).map((n, i) => (
                          <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', background: 'var(--surface-raised)', padding: '1px 6px', borderRadius: '4px' }}>
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{p.org || <span className="text-muted">—</span>}</td>
                  <td>{p.function || <span className="text-muted">—</span>}</td>
                  <td>
                    {p.level
                      ? <span className={`badge ${levelBadge(p.level)}`}>{p.level}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    {p.subProcesses?.length > 0
                      ? <span className="badge badge-gray">{p.subProcesses.length} sub</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    {p.version
                      ? <span className="badge badge-blue">v{p.version}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    {p.bpmnXml
                      ? <span className="badge badge-green">✓ Attached</span>
                      : <span className="badge badge-gray">None</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('detail', p)}>View</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('edit', p)}>Edit</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setConfirmDelete(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {filtered.length > 0 && (
          <div className="table-bottom">
            <span className="table-count">Showing {filtered.length} of {processes.length} processes</span>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="delete-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-icon">⚠</div>
            <h3>Delete Process?</h3>
            <p>
              Are you sure you want to delete{' '}
              <strong>{processes.find(p => p.id === confirmDelete)?.processName || confirmDelete}</strong>?
              This action cannot be undone.
            </p>
            <div className="delete-modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)} disabled={!!deleting}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDelete(confirmDelete)}
                disabled={!!deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProcessList;
