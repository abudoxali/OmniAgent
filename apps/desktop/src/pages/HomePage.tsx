import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CommandCenterCards from '../components/CommandCenterCards'
import HealthIndicator from '../components/HealthIndicator'
import ProviderSelector, { type ProviderInfo } from '../components/ProviderSelector'
import ProviderGuidancePanel from '../components/ProviderGuidancePanel'
import ProviderManualStartGuidanceStrip from '../components/ProviderManualStartGuidanceStrip'
import ActionButtons, { type ActionButtonsHandle, type ResultPreviewState } from '../components/ActionButtons'
import ResultPreview from '../components/ResultPreview'
import SafePromptTemplates from '../components/SafePromptTemplates'
import SelectedInputPanel from '../components/SelectedInputPanel'
import OnboardingChecklistCard, { ONBOARDING_CHECKLIST_STORAGE_KEY } from '../components/OnboardingChecklistCard'
import { translateStatus, useAppPreferences } from '../i18n'
import { API_BASE } from '../lib/api'
import { saveWorkspaceResult } from '../lib/workspace'

interface ContextData {
  active_window: {
    title: string
    process_name: string
    process_id: number
    class_name: string
  }
  clipboard: {
    text: string
    has_text: boolean
    length: number
    capture_status: string
  }
  selected_text: {
    text: string
    available: boolean
    length: number
    capture_status: string
  }
  screenshot: {
    width: number
    height: number
    format: string
    captured_at: string | null
    capture_status: string
    preview_available: boolean
  }
  active_window_title: string
  active_process_name: string
  active_process_id: number
  clipboard_text_preview: string
  clipboard_text_length: number
  selected_text_preview: string
  selected_text_length: number
  capture_status: {
    active_window: string
    clipboard: string
    selected_text: string
    screenshot: string
  }
  warnings: string[]
  timestamp: string
}

function HomePage() {
  const { messages, language, formatDateTime } = useAppPreferences()
  const [context, setContext] = useState<ContextData | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('ollama')
  const [result, setResult] = useState<ResultPreviewState | null>(null)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [isRefreshingContext, setIsRefreshingContext] = useState(false)
  const [isSavingResult, setIsSavingResult] = useState(false)
  const [saveResultMessage, setSaveResultMessage] = useState<string | null>(null)
  const [showOnboardingChecklist, setShowOnboardingChecklist] = useState(true)
  const hasInitialized = useRef(false)
  const actionButtonsRef = useRef<ActionButtonsHandle | null>(null)
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0] ?? null
  const selectedProviderDisplayName =
    language === 'ar'
      ? selectedProvider?.display_name_ar || selectedProvider?.display_name || selectedProvider?.label || selectedProvider?.id || selectedProviderId
      : selectedProvider?.display_name || selectedProvider?.display_name_ar || selectedProvider?.label || selectedProvider?.id || selectedProviderId
  const backendRuntimeLabel = context ? messages.home.terminalLines.online : messages.home.terminalLines.waiting
  const providerRuntimeLabel = selectedProvider
    ? `${selectedProviderDisplayName} • ${translateStatus(selectedProvider.diagnostic_status || selectedProvider.status, language)}`
    : messages.home.terminalLines.waiting
  const terminalStatusLines = [
    { key: 'purpose', label: messages.home.terminalLines.purpose, value: 'summary | rewrite | explain | tasks' },
    { key: 'backend', label: messages.home.terminalLines.backend, value: backendRuntimeLabel },
    { key: 'provider', label: messages.home.terminalLines.provider, value: providerRuntimeLabel },
    { key: 'overlay', label: messages.home.terminalLines.overlay, value: 'Ctrl+Alt+A' },
    { key: 'safety', label: messages.home.terminalLines.safety, value: messages.home.terminalLines.approval },
    { key: 'storage', label: messages.home.terminalLines.storage, value: `workspace • ${messages.home.terminalLines.localOnly}` },
  ]
  const formatLastTestLabel = (value?: string | null) => {
    if (!value) {
      return null
    }
    return formatDateTime(value)
  }

  const handleResultChange = (nextResult: ResultPreviewState) => {
    setSaveResultMessage(null)
    setResult(nextResult)
  }

  const loadContext = async () => {
    setIsRefreshingContext(true)
    try {
      const response = await fetch(`${API_BASE}/context/current`)
      if (response.ok) {
        setContext(await response.json())
      }
    } finally {
      setIsRefreshingContext(false)
    }
  }

  useEffect(() => {
    if (hasInitialized.current) {
      return
    }
    hasInitialized.current = true

    try {
      const dismissed = localStorage.getItem(ONBOARDING_CHECKLIST_STORAGE_KEY)
      if (dismissed === 'dismissed') {
        setShowOnboardingChecklist(false)
      }
    } catch {
      // ignore storage access errors
    }

    const loadHomeData = async () => {
      setIsLoadingProviders(true)
      try {
        const providerResponse = await fetch(`${API_BASE}/models/providers`)
        if (providerResponse.ok) {
          const providerData = await providerResponse.json()
          setProviders(providerData.providers ?? [])
          if (providerData.active_provider) {
            setSelectedProviderId(providerData.active_provider)
          }
        } else {
          setProviders([])
        }
      } catch {
        setProviders([])
      } finally {
        setIsLoadingProviders(false)
      }
    }

    void loadHomeData()
    void loadContext()
  }, [])

  const handleDismissOnboardingChecklist = () => {
    setShowOnboardingChecklist(false)
    try {
      localStorage.setItem(ONBOARDING_CHECKLIST_STORAGE_KEY, 'dismissed')
    } catch {
      // ignore storage failures
    }
  }

  const handleSaveResult = async (payload: NonNullable<ResultPreviewState['savePayload']>) => {
    setIsSavingResult(true)
    setSaveResultMessage(null)
    try {
      await saveWorkspaceResult(payload)
      setSaveResultMessage(messages.result.saveSuccess)
    } catch (error) {
      setSaveResultMessage(error instanceof Error ? error.message : messages.result.saveError)
    } finally {
      setIsSavingResult(false)
    }
  }

  return (
    <div className="page home-page">
      <HealthIndicator />

      <div className="welcome-section">
        <div className="home-badge-row">
          <span className="preview-only-badge">{messages.home.safePreviewBadge}</span>
          {selectedProvider ? (
            <span className={`status-badge status-${selectedProvider.diagnostic_status === 'online' ? 'connected' : selectedProvider.diagnostic_status === 'missing_server' || selectedProvider.diagnostic_status === 'offline' ? 'error' : selectedProvider.diagnostic_status === 'bad_model' || selectedProvider.diagnostic_status === 'no_model_loaded' ? 'warning' : 'not-configured'}`}>
              {messages.home.readinessLabel}: {translateStatus(selectedProvider.diagnostic_status || selectedProvider.status, language)}
            </span>
          ) : null}
        </div>
        <h2 className="welcome-title">{messages.home.welcomeIntro} <span className="gradient-text">{messages.brand.shortName}</span></h2>
        <p className="welcome-subtitle">{messages.home.terminalDescription}</p>
        <ProviderManualStartGuidanceStrip provider={selectedProvider} className="home-manual-start-guidance" />
      </div>

      <section className="section">
        <h3 className="section-title">{messages.home.quickActionsTitle}</h3>
        <ActionButtons
          ref={actionButtonsRef}
          apiBase={API_BASE}
          context={context}
          selectedProviderId={selectedProviderId}
          selectedProviderModel={selectedProvider?.selected_model || ''}
          onResult={handleResultChange}
        />
      </section>

      <SafePromptTemplates onApply={(template) => actionButtonsRef.current?.applyTemplate(template)} />

      <section className="section">
        <div className="section-header section-header-stack">
          <div>
            <h3 className="section-title">{messages.home.selectedInputTitle}</h3>
            <p className="card-description section-description">{messages.home.selectedInputSubtitle}</p>
          </div>
        </div>
        <SelectedInputPanel
          apiBase={API_BASE}
          selectedProviderId={selectedProviderId}
          selectedProviderModel={selectedProvider?.selected_model || ''}
          selectedProviderName={selectedProviderDisplayName}
          onResult={handleResultChange}
        />
      </section>

      <section className="section">
        <h3 className="section-title">{messages.home.resultTitle}</h3>
        <ResultPreview
          result={result}
          onSaveResult={(payload) => void handleSaveResult(payload)}
          isSavingResult={isSavingResult}
          saveResultMessage={saveResultMessage}
        />
      </section>

      <section className="section">
        <h3 className="section-title">{messages.home.providersTitle}</h3>
        <ProviderSelector
          providers={providers}
          selectedProviderId={selectedProviderId}
          isLoading={isLoadingProviders}
          onSelect={setSelectedProviderId}
        />
      </section>
      
      {showOnboardingChecklist ? (
        <section className="section onboarding-section">
          <OnboardingChecklistCard onDismiss={handleDismissOnboardingChecklist} />
        </section>
      ) : null}
    </div>
  )
}

export default HomePage
