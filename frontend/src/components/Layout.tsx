import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0].toUpperCase() || '?';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-wordmark">Ne<em>Tempo</em></div>
          <div className="logo-tagline">Net Worth Timeline</div>
        </div>

        <nav style={{ padding: '8px 0', flex: 1 }}>
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <i className="ti ti-layout-dashboard" aria-hidden="true" />
            Dashboard
          </NavLink>
          <NavLink to="/timeline" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <i className="ti ti-chart-line" aria-hidden="true" />
            Timeline
          </NavLink>

          <div className="nav-section-label">Assets</div>
          <NavLink to="/assets" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <i className="ti ti-wallet" aria-hidden="true" />
            All assets
          </NavLink>

          <div className="nav-section-label">Debt</div>
          <NavLink to="/liabilities" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <i className="ti ti-receipt" aria-hidden="true" />
            Liabilities
          </NavLink>

          <div className="nav-section-label">Account</div>
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <i className="ti ti-settings" aria-hidden="true" />
            Settings
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" />
              ) : (
                initials
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.displayName || user?.email}
              </div>
              <button
                onClick={handleLogout}
                style={{ background: 'none', border: 'none', color: 'var(--nt-muted)', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-mono)' }}
              >
                sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <Outlet />
      </div>
    </div>
  );
}
