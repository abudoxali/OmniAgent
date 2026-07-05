import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import ServicesPage from './pages/ServicesPage'
import WorkspacePage from './pages/WorkspacePage'
import SettingsPage from './pages/SettingsPage'
import LogsPage from './pages/LogsPage'
import OverlayPage from './pages/OverlayPage'
import HelpPage from './pages/HelpPage'
import { useAppPreferences } from './i18n'

const isOverlayMode = new URLSearchParams(window.location.search).has('overlay')

function App() {
  const { effectiveTheme } = useAppPreferences()

  useEffect(() => {
    if (isOverlayMode) {
      document.body.classList.add('overlay-mode')
    }
    return () => {
      document.body.classList.remove('overlay-mode')
    }
  }, [])

  if (isOverlayMode) {
    return (
      <HashRouter>
        <div className={`app-root app-root-${effectiveTheme}`}>
          <OverlayPage />
        </div>
      </HashRouter>
    )
  }

  return (
    <HashRouter>
      <div className={`app-root app-root-${effectiveTheme}`}>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/workspace" element={<WorkspacePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}

export default App
