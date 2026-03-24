function Navbar({ onToggleSidebar }) {
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
    </nav>
  );
}

export default Navbar;
