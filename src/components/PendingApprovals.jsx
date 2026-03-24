import { useState, useEffect } from 'react'
import { getAllChangeRequests, approveChangeRequest, rejectChangeRequest } from '../utils/api'
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

function ReviewModal({ request, onApprove, onReject, onClose }) {
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const changeData = request.change_data || {}
  const form = changeData.form || {}

  const handleApprove = async () => {
    setError('')
    setSaving(true)
    try {
      await onApprove(request.id, notes)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const handleReject = async () => {
    if (!notes.trim()) { setError('Please provide a reason for rejection.'); return }
    setError('')
    setSaving(true)
    try {
      await onReject(request.id, notes)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="delete-modal-overlay" onClick={onClose}>
      <div
        style={{
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          padding: '28px 32px', maxWidth: 560, width: '100%',
          boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ marginBottom: '4px' }}>Review Change Request</h3>
            <p style={{ fontSize: '12.5px' }}>
              Submitted by <strong>{request.requester_email}</strong> · {new Date(request.created_at).toLocaleString()}
            </p>
          </div>
          <span className={`badge ${CHANGE_TYPE_LABEL[request.change_type] ? 'badge-blue' : 'badge-gray'}`}>
            {CHANGE_TYPE_LABEL[request.change_type] || request.change_type}
          </span>
        </div>

        {request.change_notes && (
          <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '16px', fontSize: '13px' }}>
            <strong>Analyst notes:</strong> {request.change_notes}
          </div>
        )}

        {/* Show proposed change details */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header"><h3>Proposed Changes</h3></div>
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
                {form.subProcesses?.length > 0 && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sub-Processes:</span> {form.subProcesses.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {request.status === 'pending' && (
          <>
            <div className="form-group">
              <label>Review notes {action === 'reject' && <span className="required">*</span>}</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder={action === 'reject' ? 'Reason for rejection (required)…' : 'Optional notes…'}
                style={{ resize: 'vertical' }}
              />
            </div>
            {error && <p className="form-error" style={{ marginBottom: '12px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={saving}>Reject</button>
              <button className="btn btn-primary" onClick={handleApprove} disabled={saving}>
                {saving ? 'Applying…' : 'Approve & Apply'}
              </button>
            </div>
          </>
        )}

        {request.status !== 'pending' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PendingApprovals({ onNavigate, onCountChange }) {
  const { user, permissions } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('pending')
  const [reviewing, setReviewing] = useState(null)
  const [error, setError]       = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const all = await getAllChangeRequests()
      setRequests(all)
      const pending = all.filter(r => r.status === 'pending').length
      if (onCountChange) onCountChange(pending)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleApprove = async (id, reviewNotes) => {
    const req = requests.find(r => r.id === id)
    await approveChangeRequest(id, {
      reviewerEmail: user.email,
      reviewedBy:    user.id,
      reviewNotes,
      changeType:    req.change_type,
      processId:     req.process_id,
      changeData:    req.change_data,
    })
    await load()
  }

  const handleReject = async (id, reviewNotes) => {
    await rejectChangeRequest(id, {
      reviewerEmail: user.email,
      reviewedBy:    user.id,
      reviewNotes,
    })
    await load()
  }

  const filtered = requests.filter(r => filter === 'all' || r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Change Approvals</h1>
          <p>Review and approve change requests submitted by Process Analysts</p>
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
            {['pending', 'approved', 'rejected', 'all'].map(s => (
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
          <div className="loading-screen" style={{ padding: '48px' }}>Loading requests…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✓</div>
            <h3>{filter === 'pending' ? 'No pending approvals' : 'No requests found'}</h3>
            <p>{filter === 'pending' ? 'All change requests have been reviewed.' : 'Try a different filter.'}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Process</th>
                <th>Submitted by</th>
                <th>Date</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Action</th>
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
                  <td style={{ fontSize: '13px' }}>{r.requester_email}</td>
                  <td style={{ fontSize: '12.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ fontSize: '12.5px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.change_notes || <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>
                      {r.status}
                    </span>
                    {r.reviewer_email && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>by {r.reviewer_email}</div>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setReviewing(r)}>
                      {r.status === 'pending' ? 'Review' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && (
          <div className="table-bottom">
            <span className="table-count">Showing {filtered.length} of {requests.length} requests</span>
          </div>
        )}
      </div>

      {reviewing && (
        <ReviewModal
          request={reviewing}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  )
}
