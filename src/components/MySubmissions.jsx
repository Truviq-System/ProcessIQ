import { useState, useEffect } from 'react'
import { getMyChangeRequests } from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

const CHANGE_TYPE_LABEL = {
  create: 'New Process',
  update: 'Edit Process',
  bpmn:   'BPMN Diagram Edit',
}

const STATUS_BADGE = {
  pending:  'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
}

function DetailModal({ request, onClose }) {
  const changeData = request.change_data || {}
  const form = changeData.form || {}

  return (
    <div className="delete-modal-overlay" onClick={onClose}>
      <div
        style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          padding: '28px 32px', maxWidth: 520, width: '100%',
          boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ marginBottom: '4px' }}>Submission Details</h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              {new Date(request.created_at).toLocaleString()}
            </p>
          </div>
          <span className={`badge ${STATUS_BADGE[request.status] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
            {request.status}
          </span>
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header">
            <h3>Your Change</h3>
            <span className="badge badge-blue">{CHANGE_TYPE_LABEL[request.change_type] || request.change_type}</span>
          </div>
          <div className="card-body" style={{ fontSize: '13px' }}>
            {request.change_type === 'bpmn' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Process ID:</span> {request.process_id}</div>
                <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>File:</span> {changeData.fileName || '—'}</div>
                <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontStyle: 'italic' }}>BPMN XML diagram update</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {form.processName && <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Name:</span> {form.processName}</div>}
                {form.org && <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Org:</span> {form.org}</div>}
                {form.level && <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Level:</span> {form.level}</div>}
                {form.version && <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Version:</span> {form.version}</div>}
                {form.function?.length > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Function:</span> {form.function.join(', ')}
                  </div>
                )}
              </div>
            )}
            {request.change_notes && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Your notes:</span> {request.change_notes}
              </div>
            )}
          </div>
        </div>

        {request.status !== 'pending' && (
          <div
            style={{
              background: request.status === 'approved' ? 'var(--success-light, #f0fdf4)' : 'var(--danger-light)',
              border: `1px solid ${request.status === 'approved' ? 'var(--success, #22c55e)' : 'var(--danger)'}`,
              borderRadius: 'var(--radius)',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '13px',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px', color: request.status === 'approved' ? 'var(--success, #16a34a)' : 'var(--danger)' }}>
              {request.status === 'approved' ? '✓ Approved' : '✕ Rejected'} by {request.reviewer_email}
            </div>
            {request.reviewed_at && (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: request.review_notes ? '6px' : 0 }}>
                {new Date(request.reviewed_at).toLocaleString()}
              </div>
            )}
            {request.review_notes && (
              <div style={{ marginTop: '4px' }}>
                <span style={{ fontWeight: 600 }}>Reviewer notes:</span> {request.review_notes}
              </div>
            )}
          </div>
        )}

        {request.status === 'pending' && (
          <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            ⏳ Awaiting review by a Process Owner or Administrator.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function MySubmissions({ onNavigate }) {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [viewing, setViewing]   = useState(null)
  const [error, setError]       = useState('')

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getMyChangeRequests(user.id)
      setRequests(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  const filtered = requests.filter(r => filter === 'all' || r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>My Submissions</h1>
          <p>Track the status of change requests you have submitted for approval</p>
        </div>
        {pendingCount > 0 && (
          <div className="page-header-actions">
            <span className="badge badge-yellow">{pendingCount} pending</span>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '16px', fontSize: '13.5px' }}>
          {error}
        </div>
      )}

      <div className="table-container">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'pending', 'approved', 'rejected'].map(s => (
              <button
                key={s}
                className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setFilter(s)}
                style={{ textTransform: 'capitalize' }}
              >
                {s}{s === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={load}>↺ Refresh</button>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ padding: '48px' }}>Loading submissions…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◌</div>
            <h3>{filter === 'all' ? 'No submissions yet' : `No ${filter} submissions`}</h3>
            <p>{filter === 'all' ? 'When you submit changes for approval, they will appear here.' : 'Try a different filter.'}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Process</th>
                <th>Submitted</th>
                <th>Your Notes</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>
                    <span className="badge badge-blue">{CHANGE_TYPE_LABEL[r.change_type] || r.change_type}</span>
                  </td>
                  <td>
                    {r.process_id
                      ? <span className="font-mono" style={{ fontSize: '12px', background: 'var(--surface-raised)', padding: '2px 6px', borderRadius: '4px' }}>{r.process_id}</span>
                      : r.change_type === 'create'
                        ? <span style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>New: {r.change_data?.form?.processName || '—'}</span>
                        : <span className="text-muted">—</span>}
                  </td>
                  <td style={{ fontSize: '12.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: '12.5px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.change_notes || <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    {r.reviewer_email || <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setViewing(r)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && (
          <div className="table-bottom">
            <span className="table-count">Showing {filtered.length} of {requests.length} submissions</span>
          </div>
        )}
      </div>

      {viewing && (
        <DetailModal request={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}
