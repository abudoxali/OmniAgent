import { useEffect, useMemo, useRef, useState } from 'react'
import ProviderSelector, { type ProviderInfo } from '../components/ProviderSelector'
import ProviderGuidancePanel from '../components/ProviderGuidancePanel'
import ProviderReadinessMatrix from '../components/ProviderReadinessMatrix'
import { translateProviderLabel, translateStatus, useAppPreferences } from '../i18n'
import { API_BASE } from '../lib/api'

interface ProviderTestResult {
  provider: string
  model: string
  status: string
  latency_ms: number
  tested_at?: string
  output_preview?: string
  output_text?: string
  warnings: string[]
  safe_error_message?: string
}

interface ProviderSettingsState {
  active_provider: string
  active_model: string
  ollama_base_url: string
  ollama_model: string
  lmstudio_base_url: string
  lmstudio_model: string
  openai_compatible_base_url: string
  openai_compatible_model: string
  openai_compatible_api_key_env: string
  request_timeout_seconds: number
}

interface DiagnosticsChecklistItem {
  id: string
  label_key: string
  status: 'pass' | 'fail' | 'warn'
}

interface DiagnosticsHistoryEvent {
  provider: string
  provider_label?: string
  diagnostic_status: string
  success: boolean
  message?: string
  latency_ms?: number
  tested_at?: string
}

interface DiagnosticsPayload {
  checklist: DiagnosticsChecklistItem[]
  history: DiagnosticsHistoryEvent[]
}

type ProviderId = 'ollama' | 'lmstudio' | 'openai_compatible'
type SettingsStatus = { type: 'info' | 'success' | 'error'; message: string } | null

const defaultSettings: ProviderSettingsState = {
  active_provider: 'ollama',
  active_model: '',
  ollama_base_url: 'http://127.0.0.1:11434',
  ollama_model: '',
  lmstudio_base_url: 'http://127.0.0.1:1234/v1',
  lmstudio_model: '',
  openai_compatible_base_url: '',
  openai_compatible_model: '',
  openai_compatible_api_key_env: 'OPENAI_COMPATIBLE_API_KEY',
  request_timeout_seconds: 60,
}

function getProviderModelField(providerId: ProviderId): keyof ProviderSettingsState {
  if (providerId === 'lmstudio') {
    return 'lmstudio_model'
  }
  if (providerId === 'openai_compatible') {
    return 'openai_compatible_model'
  }
  return 'ollama_model'
}

function getProviderBaseUrlField(providerId: ProviderId): keyof ProviderSettingsState {
  if (providerId === 'lmstudio') {
    return 'lmstudio_base_url'
  }
  if (providerId === 'openai_compatible') {
    return 'openai_compatible_base_url'
  }
  return 'ollama_base_url'
}

function isProviderId(value: string): value is ProviderId {
  return value === 'ollama' || value === 'lmstudio' || value === 'openai_compatible'
}

function SettingsPage() {
  const { messages, language, formatDateTime, themePreference, setThemePreference, setLanguage } = useAppPreferences()
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>('ollama')
  const [settings, setSettings] = useState<ProviderSettingsState>(defaultSettings)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatus>(null)
  const [isTestingProvider, setIsTestingProvider] = useState(false)
  const [testPrompt, setTestPrompt] = useState('')
  const [lastTestResult, setLastTestResult] = useState<ProviderTestResult | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsPayload | null>(null)
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(true)
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic')
  const hasInitialized = useRef(false)

  const loadProviders = async (preferredProviderId?: string) => {
    setIsLoadingProviders(true)
    try {
      const response = await fetch(`${API_BASE}/models/providers`)
      if (!response.ok) {
        setProviders([])
        return
      }

      const data = await response.json()
      const nextProviders = (data.providers ?? []) as ProviderInfo[]
      setProviders(nextProviders)

      const fallbackProviderId = preferredProviderId || selectedProviderId || data.active_provider || nextProviders[0]?.id || 'ollama'
      const resolvedProviderId = nextProviders.some((provider) => provider.id === fallbackProviderId)
        ? fallbackProviderId
        : (data.active_provider || nextProviders[0]?.id || 'ollama')

      if (isProviderId(resolvedProviderId)) {
        setSelectedProviderId(resolvedProviderId)
      }
    } catch {
      setProviders([])
    } finally {
      setIsLoadingProviders(false)
    }
  }

  const loadDiagnostics = async () => {
    setIsLoadingDiagnostics(true)
    try {
      const response = await fetch(`${API_BASE}/models/diagnostics`)
      if (!response.ok) {
        throw new Error(messages.settings.diagnosticsLoadError)
      }
      const data = await response.json()
      setDiagnostics({
        checklist: Array.isArray(data.checklist) ? data.checklist : [],
        history: Array.isArray(data.history) ? data.history : [],
      })
    } catch {
      setDiagnostics(null)
    } finally {
      setIsLoadingDiagnostics(false)
    }
  }

  const loadSettings = async () => {
    setIsLoadingSettings(true)
    try {
      const response = await fetch(`${API_BASE}/models/settings`)
      if (!response.ok) {
        throw new Error(messages.settings.loadSettingsError)
      }

      const data = await response.json()
      const nextSettings: ProviderSettingsState = {
        ...defaultSettings,
        ...data,
        request_timeout_seconds: Number(data.request_timeout_seconds ?? defaultSettings.request_timeout_seconds),
      }
      setSettings(nextSettings)
      setSettingsStatus({ type: 'info', message: messages.settings.providerSettingsLoaded })

      if (isProviderId(nextSettings.active_provider)) {
        setSelectedProviderId(nextSettings.active_provider)
      }
    } catch (error) {
      setSettingsStatus({
        type: 'error',
        message: error instanceof Error ? error.message : messages.settings.loadSettingsError,
      })
    } finally {
      setIsLoadingSettings(false)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) {
      return
    }
    hasInitialized.current = true
    void Promise.all([loadSettings(), loadProviders(), loadDiagnostics()])
  }, [])

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? providers[0] ?? null,
    [providers, selectedProviderId],
  )

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === settings.active_provider) ?? null,
    [providers, settings.active_provider],
  )

  const selectedProviderModels = useMemo(() => {
    const models = selectedProvider?.discovered_models || selectedProvider?.models || []
    return Array.from(new Set(models.filter(Boolean)))
  }, [selectedProvider])

  const activeProviderModels = useMemo(() => {
    const models = activeProvider?.discovered_models || activeProvider?.models || []
    return Array.from(new Set(models.filter(Boolean)))
  }, [activeProvider])

  const updateProviderModel = (providerId: ProviderId, value: string) => {
    const modelField = getProviderModelField(providerId)
    setSettings((current) => {
      const next = {
        ...current,
        [modelField]: value,
      }

      if (current.active_provider === providerId) {
        next.active_model = value
      }

      return next
    })
  }

  const handleActiveProviderChange = (providerId: ProviderId) => {
    setSettings((current) => ({
      ...current,
      active_provider: providerId,
      active_model: String(current[getProviderModelField(providerId)] || ''),
    }))
  }

  const handleActiveModelChange = (value: string) => {
    updateProviderModel(settings.active_provider as ProviderId, value)
    setSettings((current) => ({
      ...current,
      active_model: value,
    }))
  }

  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    setSettingsStatus(null)

    const payload = {
      ...settings,
      request_timeout_seconds: Number(settings.request_timeout_seconds || defaultSettings.request_timeout_seconds),
    }

    try {
      const response = await fetch(`${API_BASE}/models/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || messages.settings.saveError)
      }

      const nextSettings: ProviderSettingsState = {
        ...defaultSettings,
        ...data,
        request_timeout_seconds: Number(data.request_timeout_seconds ?? defaultSettings.request_timeout_seconds),
      }
      setSettings(nextSettings)
      setSettingsStatus({ type: 'success', message: messages.settings.saveSuccess })
      await loadProviders(nextSettings.active_provider)
      await loadDiagnostics()
    } catch (error) {
      setSettingsStatus({
        type: 'error',
        message: error instanceof Error ? error.message : messages.settings.saveError,
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleTestProvider = async () => {
    if (!selectedProvider) {
      setLastTestResult({
        provider: '',
        model: '',
        status: 'validation_error',
        latency_ms: 0,
        output_preview: messages.settings.noProviderSelected,
        warnings: [messages.settings.noProviderSelected],
      })
      return
    }

    setIsTestingProvider(true)
    try {
      const response = await fetch(`${API_BASE}/models/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider.id,
          model: selectedProvider.selected_model || undefined,
          test_prompt: testPrompt.trim() || undefined,
        }),
      })
      const data = await response.json()
      setLastTestResult({
        provider: data.provider || selectedProvider.id,
        model: data.model || selectedProvider.selected_model || '',
        status: data.status || (response.ok ? 'ok' : 'error'),
        latency_ms: data.latency_ms ?? 0,
        tested_at: data.tested_at || new Date().toISOString(),
        output_preview: data.output_preview || data.output_text || '',
        output_text: data.output_text || '',
        warnings: data.warnings || [],
        safe_error_message: data.safe_error_message || data.raw_error,
      })
      await loadProviders(selectedProvider.id)
      await loadDiagnostics()
    } catch (error) {
      setLastTestResult({
        provider: selectedProvider.id,
        model: selectedProvider.selected_model || '',
        status: 'error',
        latency_ms: 0,
        tested_at: new Date().toISOString(),
        output_preview: '',
        warnings: [error instanceof Error ? error.message : 'تعذر الوصول إلى الخلفية.'],
        safe_error_message: error instanceof Error ? error.message : messages.actions.networkBody,
      })
    } finally {
      setIsTestingProvider(false)
    }
  }

  const selectedProviderModelField = getProviderModelField(selectedProviderId)
  const selectedProviderBaseUrlField = getProviderBaseUrlField(selectedProviderId)
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
  const activeProviderLastTest = useMemo(() => {
    if (!activeProvider) {
      return null
    }
    return {
      success: activeProvider.last_test_success,
      status: activeProvider.last_test_status,
      message: activeProvider.last_test_message,
      tested_at: activeProvider.last_test_at,
      latency_ms: activeProvider.last_test_latency_ms,
    }
  }, [activeProvider])
  const readinessLastTestStatusClass = activeProviderLastTest?.success === undefined || activeProviderLastTest?.success === null
    ? 'unknown'
    : activeProviderLastTest.success
      ? 'success'
      : 'error'
  const readinessLastTestLabel = activeProviderLastTest?.success === undefined || activeProviderLastTest?.success === null
    ? messages.settings.noTestResult
    : activeProviderLastTest.success
      ? messages.settings.lastTestSuccess
      : messages.settings.lastTestFailed
  const readinessLastTestTime = activeProviderLastTest?.tested_at ? formatDateTime(activeProviderLastTest.tested_at) : null
  const currentLanguageLabel = language === 'ar' ? messages.preferences.languageArabic : messages.preferences.languageEnglish
  const currentThemeLabel = themePreference === 'dark'
    ? messages.preferences.themeDark
    : themePreference === 'light'
      ? messages.preferences.themeLight
      : messages.preferences.themeSystem

  return (
    <div className="page settings-page">
      <div className="page-header">
        <h2 className="page-title">{messages.settings.title}</h2>
        <p className="page-subtitle">{messages.settings.subtitle}</p>
      </div>

      <div className="overlay-composer-tabs" role="tablist" style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className={`overlay-composer-tab ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          Basic Settings
        </button>
        <button
          type="button"
          className={`overlay-composer-tab ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          Advanced Diagnostics
        </button>
      </div>

      {settings.active_provider && activeTab === 'basic' ? (
        <div className={`settings-readiness-banner ${activeProvider?.diagnostic_status === 'online' ? 'ready' : activeProvider?.diagnostic_status === 'missing_server' || activeProvider?.diagnostic_status === 'offline' ? 'offline' : activeProvider?.diagnostic_status === 'bad_model' || activeProvider?.diagnostic_status === 'no_model_loaded' ? 'warning' : 'not-configured'}`}>
          <div className="settings-readiness-item">
            <span className="settings-readiness-label">{messages.settings.activeProviderDisplay}</span>
            <span className="settings-readiness-value">
              {language === 'ar'
                ? activeProvider?.display_name_ar || activeProvider?.display_name || translateProviderLabel(activeProvider?.label || settings.active_provider, language)
                : activeProvider?.display_name || activeProvider?.display_name_ar || translateProviderLabel(activeProvider?.label || settings.active_provider, language)}
            </span>
          </div>
          <div className="settings-readiness-item">
            <span className="settings-readiness-label">{messages.settings.activeModelDisplay}</span>
            <span className="settings-readiness-value ltr-code">{settings.active_model || messages.settings.noModelConfigured}</span>
          </div>
          <div className="settings-readiness-item">
            <span className="settings-readiness-label">
              {lastTestResult?.status === 'ok' ? messages.settings.lastTestSuccess : lastTestResult?.status ? messages.settings.lastTestFailed : messages.settings.testProviderBeforeHome}
            </span>
            <span className="settings-readiness-value">
              {lastTestResult?.status === 'ok'
                ? messages.settings.providerReady
                : activeProvider?.diagnostic_status === 'missing_server'
                  ? messages.settings.providerOffline
                  : activeProvider?.diagnostic_status === 'no_model_loaded'
                    ? messages.settings.providerModelNotLoaded
                    : activeProvider?.diagnostic_status === 'bad_model'
                      ? translateStatus('bad_model', language)
                      : messages.settings.testProviderBeforeHome}
            </span>
          </div>
          {activeProviderLastTest ? (
            <div className="settings-readiness-item settings-readiness-last-test">
              <span className="settings-readiness-label">{messages.settings.lastTestResult}</span>
              <span className={`provider-last-test-status provider-last-test-status-${readinessLastTestStatusClass}`}>{readinessLastTestLabel}</span>
              {activeProviderLastTest.message ? <p className="plaintext provider-last-test-message">{activeProviderLastTest.message}</p> : null}
              {(readinessLastTestTime || typeof activeProviderLastTest.latency_ms === 'number') ? (
                <div className="provider-last-test-meta">
                  {readinessLastTestTime ? (
                    <span>{messages.settings.lastTestedAt}: <span className="ltr-code">{readinessLastTestTime}</span></span>
                  ) : null}
                  {typeof activeProviderLastTest.latency_ms === 'number' ? (
                    <span>{messages.settings.latency}: <span className="ltr-code">{activeProviderLastTest.latency_ms} ms</span></span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {activeProvider?.diagnostic_message ? (
            <div className="settings-readiness-guidance">
              <p className="plaintext">{activeProvider.diagnostic_message}</p>
              {activeProvider.diagnostic_action && activeProvider.diagnostic_action !== 'لا يوجد إجراء مطلوب الآن.' ? (
                <p className="settings-readiness-action">
                  <span>{messages.provider.nextStep}</span>
                  <span>{activeProvider.diagnostic_action}</span>
                </p>
              ) : null}
            </div>
          ) : null}
          <ProviderGuidancePanel guidance={activeProvider?.guidance} variant="compact" className="settings-guidance-inline" />
        </div>
      ) : null}

      <div className="settings-grid">
        <div className="card settings-provider-span">
          <div className="settings-provider-header">
            <div>
              <h3 className="card-title">{messages.settings.providerSelectionTitle}</h3>
              <p className="card-description">{messages.settings.providerSelectionDescription}</p>
            </div>
            <button className="btn btn-secondary" onClick={() => void Promise.all([loadProviders(), loadDiagnostics()])} type="button" disabled={isLoadingProviders}>
              {isLoadingProviders ? messages.settings.refreshingProviders : messages.settings.refreshProviders}
            </button>
          </div>
          <ProviderSelector
            providers={providers}
            selectedProviderId={selectedProvider?.id || selectedProviderId}
            isLoading={isLoadingProviders}
            onSelect={(providerId) => {
              if (isProviderId(providerId)) {
                setSelectedProviderId(providerId)
              }
            }}
          />
        </div>

        {activeTab === 'advanced' && (
          <ProviderReadinessMatrix provider={selectedProvider} />
        )}

        <div className="card settings-provider-span" hidden={activeTab !== 'basic'}>
          <h3 className="card-title">{messages.settings.saveSettingsTitle}</h3>
          <p className="card-description">{messages.settings.saveSettingsDescription}</p>
          {settingsStatus ? (
            <div className={`settings-banner settings-banner-${settingsStatus.type}`}>
              <span>{settingsStatus.message}</span>
            </div>
          ) : null}
          <div className="settings-form-grid">
            <label className="ai-field">
              <span className="ai-label">{messages.settings.activeProvider}</span>
              <select
                className="ai-select"
                value={settings.active_provider}
                onChange={(event) => {
                  if (isProviderId(event.target.value)) {
                    handleActiveProviderChange(event.target.value)
                  }
                }}
                disabled={isLoadingSettings || isSavingSettings}
              >
                {(['ollama', 'lmstudio', 'openai_compatible'] as ProviderId[]).map((providerId) => {
                  const provider = providers.find((item) => item.id === providerId)
                  const label = language === 'ar'
                    ? provider?.display_name_ar || provider?.display_name || translateProviderLabel(provider?.label || providerId, language)
                    : provider?.display_name || provider?.display_name_ar || translateProviderLabel(provider?.label || providerId, language)
                  return (
                    <option key={providerId} value={providerId}>{label}</option>
                  )
                })}
              </select>
              <span className="settings-help-text">{messages.settings.activeProviderDescription}</span>
            </label>

            <label className="ai-field">
              <span className="ai-label">{messages.settings.activeModel}</span>
              {activeProviderModels.length > 0 ? (
                <select
                  className="ai-select ltr-code"
                  value={settings.active_model}
                  onChange={(event) => handleActiveModelChange(event.target.value)}
                  disabled={isLoadingSettings || isSavingSettings}
                >
                  <option value="">{messages.settings.noModelConfigured}</option>
                  {activeProviderModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="ai-input ltr-code"
                  value={settings.active_model}
                  onChange={(event) => handleActiveModelChange(event.target.value)}
                  placeholder={messages.settings.modelPlaceholder}
                  disabled={isLoadingSettings || isSavingSettings}
                />
              )}
            </label>

            <label className="ai-field">
              <span className="ai-label">{messages.settings.timeoutLabel}</span>
              <input
                className="ai-input ltr-code"
                type="number"
                min={1}
                max={300}
                value={settings.request_timeout_seconds}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  request_timeout_seconds: Number(event.target.value || defaultSettings.request_timeout_seconds),
                }))}
                disabled={isLoadingSettings || isSavingSettings}
              />
            </label>
          </div>
          <div className="settings-action-row">
            <button className="btn btn-primary" onClick={() => void handleSaveSettings()} type="button" disabled={isLoadingSettings || isSavingSettings}>
              {isSavingSettings ? messages.settings.savingSettings : messages.settings.saveSettings}
            </button>
          </div>
          <p className="card-description settings-inline-note">{messages.settings.secretsNote}</p>
        </div>

        <div className="card" hidden={activeTab !== 'basic'}>
          <h3 className="card-title">{messages.settings.languageTitle}</h3>
          <p className="card-description">{messages.settings.languageDescription}</p>
          <div className="settings-theme-row">
            <button
              className={`btn ${language === 'ar' ? 'btn-primary' : 'btn-secondary'}`}
              type="button"
              onClick={() => setLanguage('ar')}
              aria-pressed={language === 'ar'}
            >
              {messages.preferences.languageArabic}
            </button>
            <button
              className={`btn ${language === 'en' ? 'btn-primary' : 'btn-secondary'}`}
              type="button"
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
            >
              {messages.preferences.languageEnglish}
            </button>
          </div>
          <p className="card-description settings-inline-note">{messages.preferences.languageDescription}</p>
        </div>

        <div className="card" hidden={activeTab !== 'basic'}>
          <h3 className="card-title">{messages.settings.themeTitle}</h3>
          <p className="card-description">{messages.settings.themeDescription}</p>
          <div className="settings-theme-row">
            {(['dark', 'light', 'system'] as const).map((theme) => (
              <button
                key={theme}
                className={`btn ${themePreference === theme ? 'btn-primary' : 'btn-secondary'}`}
                type="button"
                onClick={() => setThemePreference(theme)}
                aria-pressed={themePreference === theme}
              >
                {theme === 'dark'
                  ? messages.preferences.themeDark
                  : theme === 'light'
                    ? messages.preferences.themeLight
                    : messages.preferences.themeSystem}
              </button>
            ))}
          </div>
          <p className="card-description settings-inline-note">{messages.settings.appearanceApplied}</p>
        </div>

        <div className="card" hidden={activeTab !== 'basic'}>
          <h3 className="card-title">{messages.settings.providerConfigTitle}</h3>
          <p className="card-description">{messages.settings.providerConfigDescription}</p>
          <div className="settings-provider-config-grid">
            <label className="ai-field">
              <span className="ai-label">{messages.provider.endpoint}</span>
              <input
                className="ai-input ltr-code"
                value={String(settings[selectedProviderBaseUrlField] || '')}
                onChange={(event) => setSettings((current) => ({
                  ...current,
                  [selectedProviderBaseUrlField]: event.target.value,
                }))}
                placeholder={messages.settings.baseUrlPlaceholder}
                disabled={isLoadingSettings || isSavingSettings}
              />
            </label>

            <label className="ai-field">
              <span className="ai-label">{messages.settings.providerModelLabel}</span>
              {selectedProviderModels.length > 0 ? (
                <select
                  className="ai-select ltr-code"
                  value={String(settings[selectedProviderModelField] || '')}
                  onChange={(event) => updateProviderModel(selectedProviderId, event.target.value)}
                  disabled={isLoadingSettings || isSavingSettings}
                >
                  <option value="">{messages.settings.noModelConfigured}</option>
                  {selectedProviderModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="ai-input ltr-code"
                  value={String(settings[selectedProviderModelField] || '')}
                  onChange={(event) => updateProviderModel(selectedProviderId, event.target.value)}
                  placeholder={messages.settings.modelPlaceholder}
                  disabled={isLoadingSettings || isSavingSettings}
                />
              )}
            </label>

            {selectedProviderId === 'openai_compatible' ? (
              <label className="ai-field">
                <span className="ai-label">{messages.settings.keyEnvLabel}</span>
                <input
                  className="ai-input ltr-code"
                  value={settings.openai_compatible_api_key_env}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    openai_compatible_api_key_env: event.target.value,
                  }))}
                  placeholder={messages.settings.envVarPlaceholder}
                  disabled={isLoadingSettings || isSavingSettings}
                />
              </label>
            ) : null}
          </div>
          {selectedProvider ? (
            <div className="provider-summary-grid">
              <div className="setting-item">
                <label className="setting-label">{messages.settings.connectionStatus}</label>
                <div className="settings-value-row">
                  <span>{translateStatus(selectedProvider.health_status, language)}</span>
                  <span className={`status-badge status-${selectedProvider.health_status === 'online' ? 'connected' : selectedProvider.health_status === 'offline' ? 'error' : 'not-configured'}`}>
                    {translateStatus(selectedProvider.status, language)}
                  </span>
                </div>
              </div>
              <div className="setting-item">
                <label className="setting-label">{messages.settings.discoveredModels}</label>
                {(selectedProvider.discovered_models || selectedProvider.models).length > 0 ? (
                  <div className="provider-model-list provider-model-list-inline">
                    {(selectedProvider.discovered_models || selectedProvider.models).map((model) => (
                      <span key={model} className="provider-model-chip ltr-code">{model}</span>
                    ))}
                  </div>
                ) : (
                  <div className="settings-value-row">{messages.settings.noModelsDiscovered}</div>
                )}
              </div>
              {selectedProvider.api_key_env ? (
                <div className="setting-item">
                  <label className="setting-label">{messages.settings.keySource}</label>
                  <div className="settings-value-row">
                    <span className="ltr-code">{selectedProvider.api_key_env}</span>
                    <span>{selectedProvider.api_key_configured ? translateStatus('configured', language) : messages.settings.keyMissing}</span>
                  </div>
                </div>
              ) : null}
              {selectedProvider.warnings.length > 0 ? (
                <div className="setting-item provider-summary-warning-block">
                  <label className="setting-label">{messages.home.warnings}</label>
                  <ul className="provider-warning-list">
                    {selectedProvider.warnings.map((warning) => (
                      <li key={warning} className="plaintext">{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ProviderGuidancePanel guidance={selectedProvider.guidance} className="settings-provider-guidance" />
            </div>
          ) : (
            <div className="placeholder-content">
              <span className="placeholder-badge">{messages.settings.noProviderSelected}</span>
            </div>
          )}
        </div>

        <div className="card" hidden={activeTab !== 'basic'}>
          <h3 className="card-title">{messages.settings.startupGuideTitle}</h3>
          <p className="card-description">{messages.settings.startupGuideDescription}</p>
          <div className="settings-guidance-panel">
            <p className="plaintext">{messages.settings.startupStep1}</p>
            <p className="plaintext">{messages.settings.startupStep2}</p>
            <p className="plaintext">{messages.settings.startupStep3}</p>
            <p className="plaintext ltr-code">{messages.settings.startupStep4}</p>
            <p className="plaintext">{messages.settings.startupStep5}</p>
            <p className="plaintext">{messages.settings.startupStep6}</p>
            <p className="plaintext">{messages.settings.startupStep7}</p>
            <p className="plaintext">{messages.settings.startupStep8}</p>
          </div>
        </div>

        <div className="card" hidden={activeTab !== 'basic'}>
          <h3 className="card-title">{messages.settings.guidanceTitle}</h3>
          <p className="card-description">{messages.settings.guidanceDescription}</p>
          <div className="settings-guidance-panel">
            <p className="plaintext">{messages.settings.ollamaGuide}</p>
            <p className="plaintext">{messages.settings.lmstudioGuide}</p>
            <p className="plaintext">{messages.settings.openaiGuide}</p>
            <p className="plaintext">{messages.settings.testSafetyGuide}</p>
          </div>
        </div>

        <div className="card" hidden={activeTab !== 'advanced'}>
          <h3 className="card-title">{messages.settings.providersTitle}</h3>
          <p className="card-description">{messages.settings.providersDescription}</p>
          {selectedProvider ? (
            <div className="provider-summary-grid">
              <div className="setting-item">
                <label className="setting-label">{messages.settings.activeProvider}</label>
                <div className="settings-value-row">
                  <span>{language === 'ar'
                    ? selectedProvider.display_name_ar || selectedProvider.display_name || translateProviderLabel(selectedProvider.label, language)
                    : selectedProvider.display_name || selectedProvider.display_name_ar || translateProviderLabel(selectedProvider.label, language)}</span>
                  {selectedProvider.is_active ? <span className="provider-active-badge">{messages.provider.activeDefault}</span> : null}
                </div>
              </div>
              <div className="setting-item">
                <label className="setting-label">{messages.settings.selectedModel}</label>
                <div className={`settings-value-row ${selectedProvider.selected_model ? 'ltr-code' : ''}`}>
                  {selectedProvider.selected_model || messages.settings.noModelConfigured}
                </div>
              </div>
              <div className="setting-item">
                <label className="setting-label">{messages.provider.endpoint}</label>
                <div className="settings-value-row ltr-code">{selectedProvider.base_url || '-'}</div>
              </div>
            </div>
          ) : (
            <div className="placeholder-content">
              <span className="placeholder-badge">{messages.settings.noProviderSelected}</span>
            </div>
          )}
        </div>

        <div className="card" hidden={activeTab !== 'advanced'}>
          <h3 className="card-title">{messages.settings.providerTestTitle}</h3>
          <p className="card-description">{messages.settings.providerTestDescription}</p>
          <label className="ai-field">
            <span className="ai-label">{messages.settings.testPromptLabel}</span>
            <textarea
              className="ai-textarea plaintext"
              placeholder={messages.settings.testPromptPlaceholder}
              rows={4}
              value={testPrompt}
              onChange={(event) => setTestPrompt(event.target.value)}
            />
          </label>
          <div className="settings-action-row">
            <button className="btn btn-primary" onClick={() => void handleTestProvider()} type="button" disabled={!selectedProvider || isTestingProvider}>
              {isTestingProvider ? messages.settings.testingProvider : messages.settings.testProvider}
            </button>
          </div>
          <div className="settings-note-stack">
            <p className="card-description">{messages.settings.noContextNote}</p>
            <p className="card-description">{messages.settings.localProvidersNote}</p>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">{messages.settings.lastTestResult}</h3>
          {lastTestResult ? (
            <div className="result-preview-content">
              <p className="card-description result-body plaintext">
                {lastTestResult.output_preview || lastTestResult.output_text || lastTestResult.safe_error_message || messages.settings.noTestResult}
              </p>
              <div className="result-summary-grid">
                <div className="result-meta">
                  <span>{messages.result.provider}</span>
                  <span className="ltr-code">{lastTestResult.provider || (selectedProvider?.id || '-')}</span>
                </div>
                <div className="result-meta">
                  <span>{messages.result.model}</span>
                  <span className="ltr-code">{lastTestResult.model || selectedProvider?.selected_model || '-'}</span>
                </div>
                <div className="result-meta">
                  <span>{messages.result.status}</span>
                  <span>{translateStatus(lastTestResult.status, language)}</span>
                </div>
                <div className="result-meta">
                  <span>{messages.settings.latency}</span>
                  <span className="ltr-code">{lastTestResult.latency_ms} ms</span>
                </div>
                {lastTestResult.tested_at ? (
                  <div className="result-meta">
                    <span>{messages.settings.lastTestedAt}</span>
                    <span className="ltr-code">{formatDateTime(lastTestResult.tested_at)}</span>
                  </div>
                ) : null}
              </div>
              {lastTestResult.safe_error_message ? (
                <div className="result-meta">
                  <span>{messages.settings.errorDetails}</span>
                  <span className="ltr-code">{lastTestResult.safe_error_message}</span>
                </div>
              ) : null}
              {lastTestResult.warnings.length > 0 ? (
                <ul className="result-warning-list">
                  {lastTestResult.warnings.map((warning) => (
                    <li key={warning} className="plaintext">{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="result-empty">
              <p>{messages.settings.noTestResult}</p>
            </div>
          )}
        </div>

        <div className="card settings-provider-span diagnostics-card">
          <div className="diagnostics-header">
            <div>
              <h3 className="card-title">{messages.settings.diagnosticsTitle}</h3>
              <p className="card-description">{messages.settings.diagnosticsDescription}</p>
            </div>
            <button className="btn btn-secondary" onClick={() => void loadDiagnostics()} type="button" disabled={isLoadingDiagnostics}>
              {isLoadingDiagnostics ? messages.settings.refreshingDiagnostics : messages.settings.refreshDiagnostics}
            </button>
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
                <p className="card-description">{isLoadingDiagnostics ? messages.settings.diagnosticsLoading : messages.settings.diagnosticsEmpty}</p>
              )}
            </div>
            <div className="diagnostics-section">
              <h4 className="diagnostics-section-title">{messages.settings.diagnosticsHistory}</h4>
              {diagnostics?.history && diagnostics.history.length > 0 ? (
                <ul className="diagnostics-history-list">
                  {diagnostics.history.map((event) => (
                    <li key={`${event.provider}-${event.tested_at || event.message}`}
                      className={`diagnostics-history-item diagnostics-history-item-${event.success ? 'success' : 'error'}`}>
                      <div className="diagnostics-history-row">
                        <span className="diagnostics-history-provider">{event.provider_label || event.provider}</span>
                        {event.tested_at ? (
                          <span className="diagnostics-history-time ltr-code">{formatDateTime(event.tested_at)}</span>
                        ) : null}
                      </div>
                      <p className="diagnostics-history-message plaintext">{event.message || '-'}</p>
                      <div className="diagnostics-history-meta">
                        <span>{translateStatus(event.diagnostic_status, language)}</span>
                        {typeof event.latency_ms === 'number' ? (
                          <span className="ltr-code">{event.latency_ms} ms</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="card-description">{isLoadingDiagnostics ? messages.settings.diagnosticsLoading : messages.settings.diagnosticsEmpty}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">{messages.settings.safetyTitle}</h3>
          <p className="card-description">{messages.settings.safetyDescription}</p>
          <ul className="help-bullet-list">
            {messages.help.safetyItems.map((item) => (
              <li key={item} className="plaintext">{item}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3 className="card-title">{messages.settings.hotkeyTitle}</h3>
          <p className="card-description">{messages.settings.hotkeyDescription}</p>
          <div className="setting-item">
            <label className="setting-label">{messages.settings.quickActionShortcut}</label>
            <div className="shortcut-display ltr-code">Ctrl + Alt + A</div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">{messages.settings.appearanceTitle}</h3>
          <p className="card-description">{messages.settings.appearanceDescription}</p>
          <div className="provider-summary-grid">
            <div className="setting-item">
              <label className="setting-label">{messages.preferences.languageLabel}</label>
              <div className="settings-value-row">
                <span>{currentLanguageLabel}</span>
              </div>
            </div>
            <div className="setting-item">
              <label className="setting-label">{messages.preferences.themeLabel}</label>
              <div className="settings-value-row">
                <span>{currentThemeLabel}</span>
              </div>
            </div>
          </div>
          <p className="card-description settings-inline-note">{messages.settings.appearanceApplied}</p>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
