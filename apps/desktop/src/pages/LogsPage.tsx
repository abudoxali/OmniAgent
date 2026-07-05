import { useState, useEffect } from 'react'
import { useAppPreferences } from '../i18n'
import { API_BASE } from '../lib/api'

interface LogEntry {
  timestamp: string
  level: string
  message: string
  source: string
}

interface ActionLogEntry {
  id: number
  timestamp: string
  action_type: string
  risk_level: string
  status: string
  approved: boolean
  payload_length: number
  target_hint?: string | null
  warnings: string[]
}

function LogsPage() {
  const { messages, formatTime } = useAppPreferences()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_BASE}/logs`)
        if (response.ok) {
          const data = await response.json()
          setLogs(data.logs || [])
          setActionLogs(data.action_logs || [])
        }
      } catch {
        setLogs([{ timestamp: new Date().toISOString(), level: 'error', message: messages.logs.fetchError, source: 'desktop' }])
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [])

  const [showSystemLogs, setShowSystemLogs] = useState(false)

  return (
    <div className="page logs-page">
      <div className="page-header">
        <h2 className="page-title">{messages.logs.actionTitle}</h2>
        <p className="page-subtitle">{messages.logs.actionSubtitle}</p>
      </div>
      <div className="card logs-container">
        {actionLogs.length === 0 ? (
          <div className="empty-state">{messages.logs.noActionLogs}</div>
        ) : (
          <div className="logs-list">
            {actionLogs.map((log) => (
              <div key={log.id} className="log-entry">
                <span className="log-timestamp ltr-code">{formatTime(log.timestamp)}</span>
                <span className={`log-level level-${log.status === 'ok' ? 'info' : log.status === 'canceled' ? 'warning' : 'error'} ltr-code`}>
                  {log.status.toUpperCase()}
                </span>
                <span className="log-source ltr-code">[{log.action_type}]</span>
                <span className="log-message plaintext">
                  {messages.logs.actionLine({ risk: log.risk_level, length: log.payload_length, approved: log.approved })}
                  {log.warnings.length > 0 ? ` — ${log.warnings.join(', ')}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="page-header" style={{ marginTop: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 className="page-title">{messages.logs.title}</h3>
          <p className="page-subtitle">{messages.logs.subtitle}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowSystemLogs(!showSystemLogs)}>
          {showSystemLogs ? 'Hide System Logs' : 'Show System Logs'}
        </button>
      </div>
      
      {showSystemLogs && (
        <div className="card logs-container">
          {loading ? (
            <div className="loading-state">{messages.logs.loading}</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">{messages.logs.empty}</div>
          ) : (
            <div className="logs-list">
              {logs.map((log, i) => (
                <div key={i} className={`log-entry log-${log.level}`}>
                  <span className="log-timestamp ltr-code">{formatTime(log.timestamp)}</span>
                  <span className={`log-level level-${log.level} ltr-code`}>{log.level.toUpperCase()}</span>
                  <span className="log-source ltr-code">[{log.source}]</span>
                  <span className="log-message plaintext">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LogsPage
