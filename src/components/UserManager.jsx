import { useState, useEffect } from 'react'
import { getAppUsers, createAppUser, updateAppUser, deleteAppUser, signUpNewUser } from '../utils/api'
import { ROLES } from '../contexts/AuthContext'

const ALL_ROLES = Object.keys(ROLES)

const ROLE_BADGE = {
  system_administrator: 'badge-yellow',
  process_owner:        'badge-blue',
  process_analyst:      'badge-gray',
}

function RoleCheckboxes({ selected, onChange }) {
  const toggle = (role) => {
    if (selected.includes(role)) {
      if (selected.length === 1) return // must keep at least one
      onChange(selected.filter(r => r !== role))
    } else {
      onChange([...selected, role])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {ALL_ROLES.map(role => (
        <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13.5px' }}>
          <input
            type="checkbox"
            checked={selected.includes(role)}
            onChange={() => toggle(role)}
            style={{ width: 'auto' }}
          />
          <span>{ROLES[role]}</span>
        </label>
      ))}
      {selected.length === 0 && (
        <p className="form-error">At least one role is required</p>
      )}
    </div>
  )
}

function UserFormModal({ user, onSave, onClose }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    email:     user?.email || '',
    name:      user?.name || '',
    password:  '',
    roles:     user?.roles || ['process_analyst'],
    is_active: user?.is_active ?? true,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email.trim()) { setError('Email is required'); return }
    if (!isEdit && !form.password) { setError('Password is required'); return }
    if (!isEdit && form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!form.roles.length) { setError('At least one role is required'); return }
    setError('')
    setSaving(true)
    try {
      if (isEdit) {
        await updateAppUser(user.id, { name: form.name, roles: form.roles, is_active: form.is_active })
      } else {
        // Create Supabase Auth account first, then add to app_users
        await signUpNewUser(form.email.trim(), form.password)
        await createAppUser({ email: form.email.trim(), name: form.name.trim(), roles: form.roles })
      }
      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="delete-modal-overlay" onClick={onClose}>
      <div className="delete-modal" style={{ maxWidth: 460, textAlign: 'left' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: '20px' }}>{isEdit ? 'Edit User' : 'Add User'}</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email address {!isEdit && <span className="required">*</span>}</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="user@company.com"
              disabled={isEdit}
              required={!isEdit}
            />
          </div>

          {!isEdit && (
            <div className="form-group">
              <label>Password <span className="required">*</span></label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Minimum 6 characters"
                  required
                  style={{ paddingRight: '70px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '12px', color: 'var(--text-muted)', padding: '2px 4px',
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="form-hint">The user can change their password after first login.</p>
            </div>
          )}

          <div className="form-group">
            <label>Display name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
            />
          </div>

          <div className="form-group">
            <label>Roles <span className="required">*</span></label>
            <RoleCheckboxes
              selected={form.roles}
              onChange={roles => setForm(f => ({ ...f, roles }))}
            />
          </div>

          {isEdit && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  style={{ width: 'auto' }}
                />
                Active account
              </label>
            </div>
          )}

          {error && <p className="form-error" style={{ marginBottom: '12px' }}>{error}</p>}

          <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.roles.length}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UserManager({ onNavigate }) {
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [editUser, setEditUser]   = useState(null)
  const [addOpen, setAddOpen]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting]   = useState(false)
  const [error, setError]         = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setUsers(await getAppUsers())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteAppUser(confirmDel.id)
      setConfirmDel(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>User Management</h1>
          <p>Manage authorized users and their role assignments</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Add User</button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '16px', fontSize: '13.5px' }}>
          {error}
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <div className="loading-screen" style={{ padding: '48px' }}>Loading users…</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👤</div>
            <h3>No users yet</h3>
            <p>Add authorized users and assign their roles.</p>
            <button className="btn btn-primary" onClick={() => setAddOpen(true)}>+ Add User</button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500, color: 'var(--text-h)' }}>{u.name || <span className="text-muted">—</span>}</td>
                  <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{u.email}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(u.roles || []).map(r => (
                        <span key={r} className={`badge ${ROLE_BADGE[r] || 'badge-gray'}`}>
                          {ROLES[r] || r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {u.is_active
                      ? <span className="badge badge-green">Active</span>
                      : <span className="badge badge-red">Inactive</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(u)}>Edit</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setConfirmDel(u)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {users.length > 0 && (
          <div className="table-bottom">
            <span className="table-count">{users.length} user{users.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Role descriptions */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header"><h3>Role Permissions</h3></div>
        <div className="card-body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Read</th>
                <th>Add</th>
                <th>Edit</th>
                <th>Delete</th>
                <th>Approve Changes</th>
                <th>Manage Orgs</th>
                <th>Manage Users</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'process_analyst',      read: true, add: true,  edit: true,  del: false, approve: false, orgs: false, users: false },
                { key: 'process_owner',         read: true, add: true,  edit: true,  del: true,  approve: true,  orgs: false, users: false },
                { key: 'system_administrator',  read: true, add: true,  edit: true,  del: true,  approve: true,  orgs: true,  users: true  },
              ].map(r => (
                <tr key={r.key}>
                  <td style={{ fontWeight: 600 }}>{ROLES[r.key]}</td>
                  {[r.read, r.add, r.edit, r.del, r.approve, r.orgs, r.users].map((v, i) => (
                    <td key={i}>{v ? <span className="badge badge-green">✓ Yes</span> : <span className="badge badge-gray">— No</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            Note: Process Analyst edits are submitted for approval. Process Owner or System Administrator must approve before changes take effect.
          </div>
        </div>
      </div>

      {(addOpen || editUser) && (
        <UserFormModal
          user={editUser || null}
          onSave={() => { setAddOpen(false); setEditUser(null); load() }}
          onClose={() => { setAddOpen(false); setEditUser(null) }}
        />
      )}

      {confirmDel && (
        <div className="delete-modal-overlay" onClick={() => setConfirmDel(null)}>
          <div className="delete-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-modal-icon">⚠</div>
            <h3>Remove User?</h3>
            <p>
              Remove <strong>{confirmDel.name || confirmDel.email}</strong> from the system?
              They will no longer be able to sign in.
            </p>
            <div className="delete-modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
