import { NavLink } from 'react-router-dom'
import { useAppPreferences } from '../i18n'

function Sidebar() {
  const { messages, language } = useAppPreferences()

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon ltr-code" aria-hidden="true">&gt;_</div>
          <div>
            <h1 className="logo-title">{messages.brand.name}</h1>
            <span className="logo-subtitle">{messages.brand.subtitle}</span>
          </div>
        </div>
        <p className="sidebar-intro">{messages.shell.quickInfo}</p>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <span className="nav-icon">&gt;</span>
          <span>{messages.nav.home}</span>
        </NavLink>

        <NavLink to="/workspace" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">[]</span>
          <span>{messages.nav.workspace}</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">@</span>
          <span>{messages.nav.settings}</span>
        </NavLink>
        <NavLink to="/logs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">::</span>
          <span>{messages.nav.logs}</span>
        </NavLink>
        <NavLink to="/help" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">?</span>
          <span>{messages.shell.help}</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-footer-stack">
          <div className="phase-badge">{messages.phaseBadge}</div>
          <span className="sidebar-language-chip">{language.toUpperCase()}</span>
        </div>
        <span className="version-text ltr-code">v0.1.0</span>
      </div>
    </aside>
  )
}

export default Sidebar
