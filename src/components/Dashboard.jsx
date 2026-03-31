import { useState } from 'react';

function Dashboard({ processes, onNavigate }) {
  const [cleared, setCleared] = useState(false);

  const orgs = [...new Set(processes.map(p => p.org).filter(Boolean))].length;

  const recent = cleared
    ? []
    : [...processes]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5);

  const orgBreakdown = processes.reduce((acc, p) => {
    if (p.org) acc[p.org] = (acc[p.org] || 0) + 1;
    return acc;
  }, {});


  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <h1>Dashboard</h1>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('add')}>
              + Add Process
            </button>
          </div>
          <p>Overview of your BPMN process repository</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('processes')}>
          <div className="stat-icon blue">◈</div>
          <div className="stat-info">
            <div className="stat-value">{processes.length}</div>
            <div className="stat-label">Total Processes</div>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('orgs')}>
          <div className="stat-icon green">⊙</div>
          <div className="stat-info">
            <div className="stat-value">{orgs}</div>
            <div className="stat-label">Organizations</div>
          </div>
        </div>
      </div>

      {/* Content */}
      {processes.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state" style={{ padding: '48px 24px' }}>
              <div className="empty-state-icon">◈</div>
              <h3>No processes yet</h3>
              <p>Use the <strong>Upload Process</strong> button above to add your first BPMN diagram.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard-grid">
          {/* Recent processes */}
          <div className="recent-section">
            <div className="recent-header">
              <h3>Recently Updated</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {processes.length} total
                </span>
                {!cleared && recent.length > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '3px 8px' }}
                    onClick={() => setCleared(true)}
                  >
                    ✕ Clear
                  </button>
                )}
                {cleared && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11.5px', color: 'var(--primary)', padding: '3px 8px' }}
                    onClick={() => setCleared(false)}
                  >
                    ↺ Restore
                  </button>
                )}
              </div>
            </div>
            {recent.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.4 }}>◌</div>
                No recent activity
              </div>
            ) : (
              recent.map(p => (
                <div
                  key={p.id}
                  className="activity-item"
                  onClick={() => onNavigate('detail', p)}
                >
                  <div className="activity-dot" />
                  <div className="activity-info">
                    <div className="activity-name">{p.processName}</div>
                    <div className="activity-meta">
                      {[p.org, p.function, p.level].filter(Boolean).join(' · ')}
                      {p.id && <span style={{ marginLeft: '6px', opacity: 0.6 }}>· {p.id}</span>}
                    </div>
                  </div>
                  <div className="activity-badge">
                    <span className="badge badge-blue">v{p.version || '1.0'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Breakdowns */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.keys(orgBreakdown).length > 0 && (
              <div className="quick-stats-card">
                <div className="quick-stats-title">By Organization</div>
                {Object.entries(orgBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([org, count]) => (
                    <div key={org} className="quick-stat-row">
                      <span className="quick-stat-key">{org}</span>
                      <span className="quick-stat-val">{count}</span>
                    </div>
                  ))}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
