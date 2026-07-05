import { useState, useEffect } from 'react'
import { translatePhase, useAppPreferences } from '../i18n'
import { API_BASE } from '../lib/api'
import type { BackendRuntimeStatus } from '../types/omniagent'

function HealthIndicator() {
  const { messages, language } = useAppPreferences()
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [version, setVersion] = useState('')
  const [phase, setPhase] = useState('')
  const [runtimeStatus, setRuntimeStatus] = useState<BackendRuntimeStatus | null>(null)

  useEffect(() => {
    const loadRuntimeStatus = async () => {
      const nextStatus = await window.omniAgent?.getBackendRuntimeStatus?.()
      if (nextStatus) {
        setRuntimeStatus(nextStatus)
      }
    }

    void loadRuntimeStatus()
    const unsubscribe = window.omniAgent?.onBackendRuntimeStatus?.((nextStatus) => {
      setRuntimeStatus(nextStatus)
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`)
        if (response.ok) {
          const data = await response.json()
          setStatus('connected')
          setVersion(data.version || '')
          setPhase(data.phase || '')
        } else {
          setStatus('disconnected')
        }
      } catch {
        setStatus('disconnected')
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 10000)
    return () => clearInterval(interval)
  }, [])

  const runtimeHint =
    status === 'connected'
      ? runtimeStatus?.managed
        ? messages.health.bundledConnected
        : messages.health.lmstudioSeparate
      : runtimeStatus?.state === 'starting'
        ? messages.health.bundledStarting
        : runtimeStatus?.mode === 'external'
          ? messages.health.externalDisconnected
          : runtimeStatus?.message || messages.health.bundledFailed

  return (
    <div className={`health-indicator health-${status}`}>
      <div className="health-dot" />
      <div className="health-info">
        <span className="health-label">
          {status === 'checking' ? messages.health.checking : status === 'connected' ? messages.health.connected : messages.health.disconnected}
        </span>
        {version && <span className="health-version"><span>{messages.health.version}: </span><span className="ltr-code">v{version}</span></span>}
        {phase && status === 'connected' && <span className="health-version">{translatePhase(phase, language)}</span>}
        <span className="health-hint plaintext">{runtimeHint}</span>
      </div>
    </div>
  )
}

export default HealthIndicator
