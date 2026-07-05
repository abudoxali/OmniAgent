import { useEffect, useMemo, useRef, useState } from 'react'
import CommandCenterCards from '../components/CommandCenterCards'
import HealthIndicator from '../components/HealthIndicator'
import ProviderSelector, { type ProviderInfo } from '../components/ProviderSelector'
import ProviderManualStartGuidanceStrip from '../components/ProviderManualStartGuidanceStrip'
import ProviderReadinessMatrix from '../components/ProviderReadinessMatrix'
import { translatePhase, translateStatus, useAppPreferences } from '../i18n'
import { API_BASE } from '../lib/api'
import type { BackendRuntimeStatus, DiagnosticsChecklistItem, DiagnosticsHistoryEvent } from '../types/omniagent'

interface HealthPayload {
  status: string
  version: string
  phase: string
  timestamp: string
  started_at: string
  uptime_seconds: number
  backend_host: string
  backend_port: number
  runtime_files: {
    db_path: string
    provider_settings_path: string
    provider_test_history_path: string
  }
  capture_features: {
    active_window_enabled: boolean
    clipboard_enabled: boolean
    selected_text_enabled: boolean
    screenshot_enabled: boolean
  }
}

interface DiagnosticsPayload {
  active_provider?: string
  checklist: DiagnosticsChecklistItem[]
  history: DiagnosticsHistoryEvent[]
}

function formatUptime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const secs = rounded % 60

  if (hours > 0) {
    return `${hours}س ${minutes}د ${secs}ث`
  }
  if (minutes > 0) {
    return `${minutes}د ${secs}ث`
  }
  return `${secs}ث`
}

function ServicesPage() {
  const { messages, language, formatDateTime } = useAppPreferences()
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('ollama')
  const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<BackendRuntimeStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const hasInitialized = useRef(false)

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

  const loadServicesData = async () => {
    setLoadError(null)
    setIsRefreshing(true)
    try {
      const [healthResponse, providersResponse, diagnosticsResponse] = await Promise.all([
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/models/providers`),
        fetch(`${API_BASE}/models/diagnostics`),
      ])

      if (!healthResponse.ok || !providersResponse.ok || !diagnosticsResponse.ok) {
        throw new Error(messages.services.loadError)
      }

      const healthData = (await healthResponse.json()) as HealthPayload
      const providerData = await providersResponse.json()
      const diagnosticsData = (await diagnosticsResponse.json()) as DiagnosticsPayload
      const nextProviders = (providerData.providers ?? []) as ProviderInfo[]
      const nextSelectedProviderId = providerData.active_provider || diagnosticsData.active_provider || nextProviders[0]?.id || 'ollama'

      setHealth(healthData)
      setProviders(nextProviders)
      setDiagnostics(diagnosticsData)
      setSelectedProviderId((current) => (nextProviders.some((provider) => provider.id === current) ? current : nextSelectedProviderId))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : messages.services.loadError)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) {
      return
    }
    hasInitialized.current = true
    void loadServicesData()
    const interval = window.setInterval(() => {
      void loadServicesData()
    }, 15000)
    return () => window.clearInterval(interval)
  }, [])

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? providers[0] ?? null,
    [providers, selectedProviderId],
  )

  const checklistLabelMap: Record<string, string> = {
    backendHealthy: messages.settings.diagnosticsChecklistLabels.backendHealthy,
    activeProvider: messages.settings.diagnosticsChecklistLabels.activeProvider,
    baseUrlConfigured: messages.settings.diagnosticsChecklistLabels.baseUrlConfigured,
    serverReachable: messages.settings.diagnosticsChecklistLabels.serverReachable,
    modelConfigured: messages.settings.diagnosticsChecklistLabels.modelConfigured,
    lastTestRecorded: messages.settings.diagnosticsChecklistLabels.lastTestRecorded,
    lastTestPassed: messages.settings.diagnosticsChecklistLabels.lastTestPassed,
    guidanceAction: messages.settings.diagnosticsChecklistLabels.guidanceAction,
  }

  const checklistStatusLabel: Record<'pass' | 'fail' | 'warn', string> = {
    pass: messages.settings.diagnosticsStatusPass,
    fail: messages.settings.diagnosticsStatusFail,
    warn: messages.settings.diagnosticsStatusWarn,
  }

  const readinessMetrics = [
    { key: 'backendHealthy', label: messages.services.readinessMetrics.backendHealthy, passed: health?.status === 'healthy' },
    { key: 'providerConfigured', label: messages.services.readinessMetrics.providerConfigured, passed: Boolean(selectedProvider?.configured) },
    { key: 'modelSelected', label: messages.services.readinessMetrics.modelSelected, passed: Boolean(selectedProvider?.selected_model) },
    { key: 'lastTestPassed', label: messages.services.readinessMetrics.lastTestPassed, passed: selectedProvider?.last_test_success === true },
  ]
  const readinessScore = readinessMetrics.reduce((score, item) => score + (item.passed ? 25 : 0), 0)
  const runtimeModeLabel = runtimeStatus?.mode === 'bundled' ? messages.services.runtimeModeBundled : messages.services.runtimeModeExternal

  return (
    <div className="page services-page">
      <HealthIndicator />

      <div className="page-header">
        <h2 className="page-title">{messages.services.title}</h2>
        <p className="page-subtitle">{messages.services.subtitle}</p>
      </div>

      <CommandCenterCards
        backendHealthy={health?.status === 'healthy'}
        providerReady={selectedProvider?.diagnostic_status === 'online'}
      />

      <section className="section">
        <div className="section-header">
          <h3 className="section-title section-title-no-border">{messages.services.statusTitle}</h3>
          <button className="btn btn-secondary" onClick={() => void loadServicesData()} type="button" disabled={isRefreshing}>
            {isRefreshing ? messages.services.refreshing : messages.services.refresh}
          </button>
        </div>
        {loadError ? (
          <div className="card services-error-card">
            <p className="plaintext">{loadError}</p>
          </div>
        ) : null}
        <div className="services-summary-grid">
          <div className="card services-summary-card">
            <span className="services-summary-label">{messages.services.backendConnection}</span>
            <span className={`services-summary-value status-${health?.status === 'healthy' ? 'connected' : 'error'}`}>
              {health ? translateStatus(health.status, language) : messages.services.noHealthData}
            </span>
            <p className="card-description">{runtimeStatus?.message || messages.services.noRuntimeMessage}</p>
          </div>
          <div className="card services-summary-card">
            <span className="services-summary-label">{messages.services.runtimeMode}</span>
            <span className="services-summary-value">{runtimeStatus ? runtimeModeLabel : '-'}</span>
            <p className="card-description">
              {messages.services.runtimeManaged}: {runtimeStatus ? (runtimeStatus.managed ? messages.services.managedYes : messages.services.managedNo) : '-'}
            </p>
          </div>
          <div className="card services-summary-card">
            <span className="services-summary-label">{messages.services.uptime}</span>
            <span className="services-summary-value ltr-code">{health ? formatUptime(health.uptime_seconds) : '-'}</span>
            <p className="card-description">
              {messages.services.startedAt}: <span className="ltr-code">{health ? formatDateTime(health.started_at) : '-'}</span>
            </p>
          </div>
          <div className="card services-summary-card">
            <span className="services-summary-label">{messages.services.activeProvider}</span>
            <span className="services-summary-value">
              {language === 'ar'
                ? selectedProvider?.display_name_ar || selectedProvider?.display_name || selectedProvider?.label || '-'
                : selectedProvider?.display_name || selectedProvider?.display_name_ar || selectedProvider?.label || '-'}
            </span>
            <p className="card-description">
              {selectedProvider ? translateStatus(selectedProvider.diagnostic_status || selectedProvider.status, language) : messages.services.noProviderState}
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="services-meta-grid">
          <div className="card services-detail-card">
            <h3 className="card-title">{messages.services.runtimeDetailsTitle}</h3>
            <div className="services-detail-list">
              <div className="context-row">
                <span className="context-label">{messages.services.phase}</span>
                <span className="context-value">{health ? translatePhase(health.phase, language) : '-'}</span>
              </div>
              <div className="context-row">
                <span className="context-label">{messages.services.version}</span>
                <span className="context-value ltr-code">{health ? `v${health.version}` : '-'}</span>
              </div>
              <div className="context-row">
                <span className="context-label">{messages.services.backendHost}</span>
                <span className="context-value ltr-code">{health ? health.backend_host : '-'}</span>
              </div>
              <div className="context-row">
                <span className="context-label">{messages.services.backendPort}</span>
                <span className="context-value ltr-code">{health ? health.backend_port : '-'}</span>
              </div>
              <div className="context-row">
                <span className="context-label">{messages.services.lastHealthCheck}</span>
                <span className="context-value ltr-code">{health ? formatDateTime(health.timestamp) : '-'}</span>
              </div>
              <div className="context-row">
                <span className="context-label">{messages.services.runtimeMessage}</span>
                <span className="context-value plaintext">{runtimeStatus?.message || messages.services.noRuntimeMessage}</span>
              </div>
              {runtimeStatus?.details ? (
                <div className="context-row">
                  <span className="context-label">{messages.services.runtimeDetails}</span>
                  <span className="context-value ltr-code">{runtimeStatus.details}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card services-detail-card">
            <h3 className="card-title">{messages.services.runtimeFilesTitle}</h3>
            <div className="services-file-list">
              <div className="services-file-item">
                <span className="setting-label">{messages.services.dbPath}</span>
                <code className="ltr-code services-file-code">{health?.runtime_files.db_path || '-'}</code>
              </div>
              <div className="services-file-item">
                <span className="setting-label">{messages.services.providerSettingsPath}</span>
                <code className="ltr-code services-file-code">{health?.runtime_files.provider_settings_path || '-'}</code>
              </div>
              <div className="services-file-item">
                <span className="setting-label">{messages.services.providerTestsPath}</span>
                <code className="ltr-code services-file-code">{health?.runtime_files.provider_test_history_path || '-'}</code>
              </div>
            </div>
          </div>

          <div className="card services-detail-card">
            <h3 className="card-title">{messages.services.captureFeaturesTitle}</h3>
            <div className="services-capture-grid">
              <div className="services-capture-item">
                <span>{messages.services.captureActiveWindow}</span>
                <span className={`status-badge status-${health?.capture_features.active_window_enabled ? 'connected' : 'warning'}`}>
                  {health?.capture_features.active_window_enabled ? messages.services.featureEnabled : messages.services.featureDisabled}
                </span>
              </div>
              <div className="services-capture-item">
                <span>{messages.services.captureClipboard}</span>
                <span className={`status-badge status-${health?.capture_features.clipboard_enabled ? 'connected' : 'warning'}`}>
                  {health?.capture_features.clipboard_enabled ? messages.services.featureEnabled : messages.services.featureDisabled}
                </span>
              </div>
              <div className="services-capture-item">
                <span>{messages.services.captureSelectedText}</span>
                <span className={`status-badge status-${health?.capture_features.selected_text_enabled ? 'connected' : 'warning'}`}>
                  {health?.capture_features.selected_text_enabled ? messages.services.featureEnabled : messages.services.featureDisabled}
                </span>
              </div>
              <div className="services-capture-item">
                <span>{messages.services.captureScreenshot}</span>
                <span className={`status-badge status-${health?.capture_features.screenshot_enabled ? 'connected' : 'warning'}`}>
                  {health?.capture_features.screenshot_enabled ? messages.services.featureEnabled : messages.services.featureDisabled}
                </span>
              </div>
            </div>
          </div>

          <div className="card services-detail-card">
            <h3 className="card-title">{messages.services.readinessScoreTitle}</h3>
            <p className="card-description">{messages.services.readinessScoreDescription}</p>
            <div className="services-score-value">
              <span className="services-score-number ltr-code">{readinessScore}</span>
              <span className="services-score-total">{messages.services.readinessScoreOutOf}</span>
            </div>
            <div className="services-score-list">
              {readinessMetrics.map((metric) => (
                <div key={metric.key} className="services-score-item">
                  <span>{metric.label}</span>
                  <span className={`status-badge status-${metric.passed ? 'connected' : 'warning'}`}>
                    {metric.passed ? messages.services.featureEnabled : messages.services.featureDisabled}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3 className="section-title">{messages.services.providersTitle}</h3>
        <div className="card services-provider-card">
          {isLoading ? (
            <p className="card-description">{messages.provider.loadingDescription}</p>
          ) : (
            <ProviderSelector
              providers={providers}
              selectedProviderId={selectedProvider?.id || selectedProviderId}
              isLoading={false}
              onSelect={setSelectedProviderId}
            />
          )}
        </div>
        <ProviderManualStartGuidanceStrip provider={selectedProvider} className="services-manual-start-guidance" />
        <ProviderReadinessMatrix provider={selectedProvider} />
      </section>

      <section className="section">
        <div className="card diagnostics-card">
          <div className="diagnostics-header">
            <div>
              <h3 className="card-title">{messages.services.diagnosticsTitle}</h3>
              <p className="card-description">{messages.services.diagnosticsDescription}</p>
            </div>
          </div>
          <div className="diagnostics-grid">
            <div className="diagnostics-section">
              <h4 className="diagnostics-section-title">{messages.settings.diagnosticsChecklist}</h4>
              {diagnostics?.checklist && diagnostics.checklist.length > 0 ? (
                <ul className="diagnostics-checklist">
                  {diagnostics.checklist.map((item) => (
                    <li key={item.id} className={`diagnostics-checklist-item diagnostics-checklist-item-${item.status}`}>
                      <span className="diagnostics-checklist-status">{checklistStatusLabel[item.status]}</span>
                      <span>{checklistLabelMap[item.label_key] || item.label_key}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="card-description">{messages.settings.diagnosticsEmpty}</p>
              )}
            </div>
            <div className="diagnostics-section">
              <h4 className="diagnostics-section-title">{messages.settings.diagnosticsHistory}</h4>
              {diagnostics?.history && diagnostics.history.length > 0 ? (
                <ul className="diagnostics-history-list">
                  {diagnostics.history.map((event) => (
                    <li
                      key={`${event.provider}-${event.tested_at || event.message}`}
                      className={`diagnostics-history-item diagnostics-history-item-${event.success ? 'success' : 'error'}`}
                    >
                      <div className="diagnostics-history-row">
                        <span className="diagnostics-history-provider">{event.provider_label || event.provider}</span>
                        {event.tested_at ? (
                          <span className="diagnostics-history-time ltr-code">{formatDateTime(event.tested_at)}</span>
                        ) : null}
                      </div>
                      <p className="diagnostics-history-message plaintext">{event.message || '-'}</p>
                      <div className="diagnostics-history-meta">
                        <span>{translateStatus(event.diagnostic_status, language)}</span>
                        {typeof event.latency_ms === 'number' ? <span className="ltr-code">{event.latency_ms} ms</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="card-description">{messages.settings.diagnosticsEmpty}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card services-runbook-card">
          <h3 className="card-title">{messages.services.runbookTitle}</h3>
          <p className="card-description">{messages.services.runbookDescription}</p>
          <div className="services-runbook-grid">
            {messages.services.runbookSections.map((section) => (
              <div key={section.title} className="services-runbook-section">
                <h4 className="services-runbook-section-title">{section.title}</h4>
                <ol className="services-runbook-list">
                  {section.steps.map((step) => (
                    <li key={`${section.title}-${step}`} className="plaintext">{step}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="services-meta-grid">
          <div className="card services-detail-card">
            <h3 className="card-title">{messages.services.technologiesTitle}</h3>
            <p className="card-description">{messages.services.technologiesDescription}</p>
            <div className="technology-grid">
              {messages.services.technologies.map((item) => (
                <div key={item.title} className="technology-card">
                  <h4>{item.title}</h4>
                  <p className="plaintext">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card services-detail-card">
            <h3 className="card-title">{messages.services.localVsExternalTitle}</h3>
            <div className="help-columns">
              <div>
                <h4 className="services-runbook-section-title">{language === 'ar' ? 'محلي' : 'Local'}</h4>
                <ul className="help-bullet-list">
                  {messages.services.localList.map((item) => (
                    <li key={item} className="plaintext">{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="services-runbook-section-title">{language === 'ar' ? 'خارجي / منفصل' : 'External / Separate'}</h4>
                <ul className="help-bullet-list">
                  {messages.services.externalList.map((item) => (
                    <li key={item} className="plaintext">{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="card services-detail-card">
            <h3 className="card-title">{messages.services.neverDoesTitle}</h3>
            <ul className="help-bullet-list">
              {messages.services.neverDoes.map((item) => (
                <li key={item} className="plaintext">{item}</li>
              ))}
            </ul>
          </div>

          <div className="card services-detail-card">
            <h3 className="card-title">{messages.services.releaseReadinessTitle}</h3>
            <ul className="help-bullet-list">
              {messages.services.releaseReadinessItems.map((item) => (
                <li key={item} className="plaintext">{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ServicesPage
