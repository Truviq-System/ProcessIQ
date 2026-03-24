import { useAuth, ROLES } from '../contexts/AuthContext'

const ROLE_BADGE_CLASS = {
  system_administrator: 'role-admin',
  process_owner:        'role-editor',
  process_analyst:      'role-viewer',
}

function Navbar({ onToggleSidebar, pendingCount = 0 }) {
  const { user, roles, signOut } = useAuth()

  // Show the highest role as the primary badge
  const primaryRole = roles.includes('system_administrator') ? 'system_administrator'
    : roles.includes('process_owner') ? 'process_owner'
    : roles[0]

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="btn-icon" onClick={onToggleSidebar} title="Toggle sidebar">
          ☰
        </button>
        <div className="navbar-logo">
          <div className="navbar-logo-icon">B</div>
          <div>
            <div className="navbar-title">ProcessIQ</div>
            <div className="navbar-subtitle">Enterprise Process Management</div>
          </div>
        </div>
      </div>

      {user && (
        <div className="navbar-right">
          <div className="navbar-user">
            <span className="navbar-user-name">{user.displayName || user.email}</span>
            {primaryRole && (
              <span className={`navbar-role-badge ${ROLE_BADGE_CLASS[primaryRole] || 'role-viewer'}`}>
                {ROLES[primaryRole] || primaryRole}
              </span>
            )}
          </div>
          {pendingCount > 0 && (
            <span className="navbar-pending-badge" title={`${pendingCount} pending approval${pendingCount !== 1 ? 's' : ''}`}>
              {pendingCount}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out">
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
