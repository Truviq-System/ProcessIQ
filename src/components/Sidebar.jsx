import { useState } from 'react';

const getFn = (p) => (Array.isArray(p.function) ? p.function[0] : p.function);

export default function Sidebar({ collapsed, currentView, onNavigate, processes = [], permissions = {}, pendingCount = 0 }) {
  const [openOrgs, setOpenOrgs] = useState({});
  const [openFns, setOpenFns] = useState({});
  const [openLevels, setOpenLevels] = useState({});

  const toggle = (setter, key) =>
    setter((prev) => ({ ...prev, [key]: !prev[key] }));

  const orgs = [...new Set(processes.map((p) => p.org).filter(Boolean))].sort();

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Main nav */}
      <div className="sidebar-section">
        <button
          className={`sidebar-nav-item${currentView === 'dashboard' ? ' active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span className="sidebar-nav-icon">◈</span>
          <span className="sidebar-nav-text">Dashboard</span>
        </button>

        <button
          className={`sidebar-nav-item${currentView === 'processes' ? ' active' : ''}`}
          onClick={() => onNavigate('processes')}
        >
          <span className="sidebar-nav-icon">☰</span>
          <span className="sidebar-nav-text">Process Library</span>
          {processes.length > 0 && (
            <span className="sidebar-nav-count">{processes.length}</span>
          )}
        </button>

        <button
          className={`sidebar-nav-item${currentView === 'ai-generator' ? ' active' : ''}`}
          onClick={() => onNavigate('ai-generator')}
        >
          <span className="sidebar-nav-icon">✦</span>
          <span className="sidebar-nav-text">AI Generator</span>
        </button>

        {permissions.approveChanges && (
          <button
            className={`sidebar-nav-item${currentView === 'approvals' ? ' active' : ''}`}
            onClick={() => onNavigate('approvals')}
          >
            <span className="sidebar-nav-icon">✓</span>
            <span className="sidebar-nav-text">Approvals</span>
            {pendingCount > 0 && (
              <span className="sidebar-nav-count" style={{ background: 'var(--danger)', color: '#fff' }}>
                {pendingCount}
              </span>
            )}
          </button>
        )}

        {permissions.manageOrgs && (
          <button
            className={`sidebar-nav-item${currentView === 'orgs' ? ' active' : ''}`}
            onClick={() => onNavigate('orgs')}
          >
            <span className="sidebar-nav-icon">⊞</span>
            <span className="sidebar-nav-text">Organizations</span>
          </button>
        )}

        {permissions.manageUsers && (
          <button
            className={`sidebar-nav-item${currentView === 'users' ? ' active' : ''}`}
            onClick={() => onNavigate('users')}
          >
            <span className="sidebar-nav-icon">👤</span>
            <span className="sidebar-nav-text">User Management</span>
          </button>
        )}
      </div>

      <div className="sidebar-divider" />

      {/* Tree browser */}
      {!collapsed && (
        <div className="sidebar-browse">
          <div className="sidebar-section-label" style={{ padding: '8px 20px 4px' }}>Browse</div>

          {orgs.length === 0 ? (
            <div className="sidebar-tree-empty" style={{ paddingLeft: '20px' }}>No processes yet</div>
          ) : (
            orgs.map((org) => {
              const orgOpen = openOrgs[org];
              const orgProcesses = processes.filter((p) => p.org === org);
              const fns = [...new Set(orgProcesses.map(getFn).filter(Boolean))];

              return (
                <div className="sidebar-tree-row" key={org}>
                  <button
                    className={`sidebar-tree-item${orgOpen ? ' tree-open' : ''}`}
                    onClick={() => toggle(setOpenOrgs, org)}
                    onDoubleClick={() => onNavigate('processes', null, { filterOrg: org })}
                    title="Double-click to filter by this org"
                  >
                    <span className="sidebar-tree-arrow">{orgOpen ? '▾' : '▸'}</span>
                    <span className="sidebar-tree-label">{org}</span>
                  </button>

                  {orgOpen && (
                    <div className="sidebar-tree-children">
                      {fns.map((fn) => {
                        const fnKey = `${org}-${fn}`;
                        const fnOpen = openFns[fnKey];
                        const fnProcesses = orgProcesses.filter((p) => getFn(p) === fn);
                        const levels = [...new Set(fnProcesses.map((p) => p.level).filter(Boolean))];

                        return (
                          <div className="sidebar-tree-row" key={fn}>
                            <button
                              className={`sidebar-tree-item${fnOpen ? ' tree-open' : ''}`}
                              onClick={() => toggle(setOpenFns, fnKey)}
                            >
                              <span className="sidebar-tree-arrow">{fnOpen ? '▾' : '▸'}</span>
                              <span className="sidebar-tree-label">{fn}</span>
                            </button>

                            {fnOpen && (
                              <div className="sidebar-tree-children">
                                {levels.map((level) => {
                                  const lvlKey = `${fnKey}-${level}`;
                                  const lvlOpen = openLevels[lvlKey];
                                  const lvlProcesses = fnProcesses.filter((p) => p.level === level);

                                  return (
                                    <div className="sidebar-tree-row" key={level}>
                                      <button
                                        className={`sidebar-tree-item${lvlOpen ? ' tree-open' : ''}`}
                                        onClick={() => toggle(setOpenLevels, lvlKey)}
                                      >
                                        <span className="sidebar-tree-arrow">{lvlOpen ? '▾' : '▸'}</span>
                                        <span className="sidebar-tree-label">{level}</span>
                                      </button>

                                      {lvlOpen && (
                                        <div className="sidebar-tree-children">
                                          {lvlProcesses.map((p) => {
                                            const aliases = p.processNames || [];
                                            const tooltip = aliases.length > 0
                                              ? `${p.processName}\nAlso known as: ${aliases.join(', ')}`
                                              : p.processName;
                                            return (
                                              <button
                                                key={p.id}
                                                className="sidebar-tree-item sidebar-tree-leaf"
                                                onClick={() => onNavigate('detail', p)}
                                                title={tooltip}
                                              >
                                                <span className="sidebar-tree-dot">●</span>
                                                <span className="sidebar-tree-label">
                                                  {p.processName}
                                                  {p.version && (
                                                    <span style={{ opacity: 0.45, fontSize: '11px', marginLeft: '4px' }}>
                                                      v{p.version}
                                                    </span>
                                                  )}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
}
