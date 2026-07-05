import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ActionButtons, { type ActionButtonsHandle, type ActionButtonsPersistedState, type ResultPreviewState } from '../components/ActionButtons'
import OnboardingChecklistCard, { ONBOARDING_CHECKLIST_STORAGE_KEY } from '../components/OnboardingChecklistCard'
import OverlaySelectedInputMiniPanel, { type OverlaySelectedInputMiniPanelHandle, type OverlaySelectedInputPersistedState } from '../components/OverlaySelectedInputMiniPanel'
import ProviderManualStartGuidanceStrip from '../components/ProviderManualStartGuidanceStrip'
import ProviderSelector, { type ProviderInfo } from '../components/ProviderSelector'
import ResultPreview from '../components/ResultPreview'
import SafePromptTemplates from '../components/SafePromptTemplates'
import { translateProviderLabel, translateStatus, useAppPreferences } from '../i18n'
import { API_BASE } from '../lib/api'
import { saveWorkspaceResult } from '../lib/workspace'
import type { OverlayTargetContext } from '../types/omniagent'

const OVERLAY_SESSION_STORAGE_KEY = 'overlay_session_v1'
const OVERLAY_SESSION_TTL_MS = 60 * 60 * 1000

interface OverlaySessionData {
  timestamp: number
  providerId?: string
  composer?: ActionButtonsPersistedState
  selectedInput?: OverlaySelectedInputPersistedState
  result?: ResultPreviewState | null
  activeTab?: OverlayComposerTab
}

type OverlayComposerTab = 'prompt' | 'selected_input'

function loadOverlaySession(): OverlaySessionData | null {
  try {
    const raw = localStorage.getItem(OVERLAY_SESSION_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as OverlaySessionData
    if (!data?.timestamp || Date.now() - data.timestamp > OVERLAY_SESSION_TTL_MS) {
      localStorage.removeItem(OVERLAY_SESSION_STORAGE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

interface CurrentContextData {
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
  screenshot: {
    width: number
    height: number
    capture_status: string
  }
  warnings: string[]
  timestamp: string
}

function isOverlaySelfCapture(context: OverlayTargetContext | null): boolean {
  if (!context) return false
  const name = (context.active_process_name || '').toLowerCase()
  const title = (context.active_window_title || '').toLowerCase()
  return name.includes('omniagent') || name.includes('abud') || title.includes('omniagent') || title.includes('overlay')
}

function OverlayPage() {
  const { messages, language, formatDateTime } = useAppPreferences()
  const persistedSession = useMemo(loadOverlaySession, [])
  const initialComposerTab: OverlayComposerTab = persistedSession?.activeTab ?? 'prompt'
  const [targetContext, setTargetContext] = useState<OverlayTargetContext | null>(null)
  const [currentContext, setCurrentContext] = useState<CurrentContextData | null>(null)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const initialProvider = persistedSession?.providerId || 'ollama'
  const [selectedProviderId, setSelectedProviderId] = useState<string>(initialProvider)
  const [result, setResult] = useState<ResultPreviewState | null>(persistedSession?.result ?? null)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [isRefreshingCurrentContext, setIsRefreshingCurrentContext] = useState(false)
  const [targetContextError, setTargetContextError] = useState<string | null>(null)
  const [isSavingResult, setIsSavingResult] = useState(false)
  const [saveResultMessage, setSaveResultMessage] = useState<string | null>(null)
  const [composerState, setComposerState] = useState<ActionButtonsPersistedState | undefined>(persistedSession?.composer)
  const [selectedInputState, setSelectedInputState] = useState<OverlaySelectedInputPersistedState | undefined>(persistedSession?.selectedInput)
  const [clearSignal, setClearSignal] = useState(0)
  const [selectedInputResetSignal, setSelectedInputResetSignal] = useState(0)
  const [composerMode, setComposerMode] = useState<OverlayComposerTab>(initialComposerTab)
  const [showOnboardingChecklist, setShowOnboardingChecklist] = useState(true)
  const [sessionNotice, setSessionNotice] = useState<'restored' | 'cleared' | null>(persistedSession ? 'restored' : null)
  const hasInitialized = useRef(false)
  const actionButtonsRef = useRef<ActionButtonsHandle | null>(null)
  const selectedInputRef = useRef<OverlaySelectedInputMiniPanelHandle | null>(null)
  const sessionRef = useRef<OverlaySessionData>(
    persistedSession ?? {
      timestamp: Date.now(),
      providerId: initialProvider,
      composer: composerState,
      selectedInput: selectedInputState,
      result: result ?? undefined,
      activeTab: initialComposerTab,
    },
  )

  const persistSession = (updates: Partial<OverlaySessionData>) => {
    sessionRef.current = {
      ...sessionRef.current,
      ...updates,
      timestamp: Date.now(),
    }
    try {
      localStorage.setItem(OVERLAY_SESSION_STORAGE_KEY, JSON.stringify(sessionRef.current))
    } catch {
      // ignore storage failures
    }
  }

  const clearSessionStorage = useCallback(() => {
    sessionRef.current = {
      timestamp: Date.now(),
      providerId: selectedProviderId,
      composer: undefined,
      selectedInput: undefined,
      result: undefined,
      activeTab: 'prompt',
    }
    try {
      localStorage.setItem(OVERLAY_SESSION_STORAGE_KEY, JSON.stringify(sessionRef.current))
    } catch {
      // ignore
    }
  }, [selectedProviderId])

  useEffect(() => {
    if (!sessionNotice) return
    const timeout = window.setTimeout(() => setSessionNotice(null), 4000)
    return () => window.clearTimeout(timeout)
  }, [sessionNotice])

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(ONBOARDING_CHECKLIST_STORAGE_KEY)
      if (dismissed === 'dismissed') {
        setShowOnboardingChecklist(false)
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  const handleDismissOnboardingChecklist = () => {
    setShowOnboardingChecklist(false)
    try {
      localStorage.setItem(ONBOARDING_CHECKLIST_STORAGE_KEY, 'dismissed')
    } catch {
      // ignore storage errors
    }
  }

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0] ?? null

  const handleResultChange = (nextResult: ResultPreviewState) => {
    setSaveResultMessage(null)
    setResult(nextResult)
    persistSession({ result: nextResult })
  }

  const loadCurrentContext = async () => {
    setIsRefreshingCurrentContext(true)
    setTargetContextError(null)
    try {
      const response = await fetch(`${API_BASE}/context/current`)
      if (response.ok) {
        setCurrentContext(await response.json())
      } else {
        setTargetContextError(messages.overlay.currentMissingChip)
      }
    } catch (error) {
      setTargetContextError(error instanceof Error ? error.message : messages.actions.networkBody)
    } finally {
      setIsRefreshingCurrentContext(false)
    }
  }

  const loadTargetContext = async () => {
    try {
      const context = await window.omniAgent?.getOverlayTargetContext?.()
      if (context) {
        setTargetContext(context)
      } else {
        setTargetContextError(messages.overlay.captureFailed)
      }
    } catch (error) {
      setTargetContextError(error instanceof Error ? error.message : messages.overlay.captureFailed)
    }
  }

  const loadProviders = async () => {
    setIsLoadingProviders(true)
    try {
      const response = await fetch(`${API_BASE}/models/providers`)
      if (response.ok) {
        const data = await response.json()
        setProviders(data.providers ?? [])
        if (persistedSession?.providerId && data.providers?.some((provider: ProviderInfo) => provider.id === persistedSession.providerId)) {
          setSelectedProviderId(persistedSession.providerId)
        } else if (data.active_provider) {
          setSelectedProviderId(data.active_provider)
          persistSession({ providerId: data.active_provider })
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

  useEffect(() => {
    if (hasInitialized.current) {
      return
    }
    hasInitialized.current = true
    void loadProviders()
    void loadTargetContext()
    void loadCurrentContext()
  }, [])

  useEffect(() => {
    const unsubscribe = window.omniAgent?.onOverlayTargetContext?.((context) => {
      setTargetContext(context)
      setTargetContextError(null)
    })
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.omniAgent?.hideOverlay?.()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const handleClose = () => {
    window.omniAgent?.hideOverlay?.()
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

  const handleComposerStateChange = (state: ActionButtonsPersistedState) => {
    setComposerState(state)
    persistSession({ composer: state })
  }

  const handleSelectedInputStateChange = (state: OverlaySelectedInputPersistedState) => {
    setSelectedInputState(state)
    persistSession({ selectedInput: state })
  }

  const handleTabChange = (tab: OverlayComposerTab) => {
    setComposerMode(tab)
    persistSession({ activeTab: tab })
  }

  const handleClearSession = useCallback(() => {
    setClearSignal((value) => value + 1)
    setSelectedInputResetSignal((value) => value + 1)
    setComposerState(undefined)
    setSelectedInputState(undefined)
    setResult(null)
    setSaveResultMessage(null)
    setComposerMode('prompt')
    clearSessionStorage()
    setSessionNotice('cleared')
  }, [clearSessionStorage])

  useEffect(() => {
    persistSession({ providerId: selectedProviderId })
  }, [selectedProviderId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!document.hasFocus() || event.isComposing || event.repeat) {
        return
      }

      const key = event.key.toLowerCase()
      const ctrlOrCmd = event.ctrlKey || event.metaKey

      if (ctrlOrCmd && !event.altKey && !event.shiftKey && event.key === 'Enter') {
        event.preventDefault()
        if (composerMode === 'selected_input') {
          selectedInputRef.current?.runSelectedInput()
        } else {
          actionButtonsRef.current?.runPrompt()
        }
        return
      }

      if (event.altKey && !ctrlOrCmd && !event.shiftKey && key === 'i') {
        event.preventDefault()
        if (composerMode === 'selected_input') {
          selectedInputRef.current?.focusInput()
        } else {
          actionButtonsRef.current?.focusInstruction()
        }
        return
      }

      if (ctrlOrCmd && event.shiftKey && !event.altKey && key === 'c') {
        event.preventDefault()
        actionButtonsRef.current?.copyLatestOutput()
        return
      }

      if (ctrlOrCmd && event.shiftKey && !event.altKey && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault()
        handleClearSession()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [composerMode, handleClearSession])

  const currentWindowTitle = currentContext?.active_window_title || messages.overlay.noContext
  const currentProcessName = currentContext?.active_process_name || '-'
  const currentProcessId = currentContext?.active_process_id ?? 0
  const currentCaptureTime = currentContext?.timestamp ? formatDateTime(currentContext.timestamp) : '-'
  const clipboardStatus = currentContext?.capture_status?.clipboard || 'disabled'
  const selectedTextStatus = currentContext?.capture_status?.selected_text || 'disabled'
  const screenshotStatus = currentContext?.capture_status?.screenshot || 'disabled'

  const targetWindowTitle = targetContext?.active_window_title || messages.overlay.noContext
  const targetProcessName = targetContext?.active_process_name || '-'
  const targetProcessId = targetContext?.active_process_id ?? 0
  const targetCaptureFailed = targetContext?.capture_failed === true
  const targetCaptureTime = targetContext?.timestamp ? formatDateTime(targetContext.timestamp) : '-'
  const targetWarnings = targetContext?.warnings || []
  const targetSelfWarning = isOverlaySelfCapture(targetContext)
  const targetHasContext = Boolean(targetContext && !targetCaptureFailed)
  const currentHasContext = Boolean(currentContext)

  const targetMetaRows = [
    { key: 'target-app', label: messages.overlay.targetApp, value: targetProcessName, valueClass: 'ltr-code' },
    { key: 'target-window', label: messages.overlay.targetWindow, value: targetWindowTitle, valueClass: 'plaintext' },
    { key: 'target-pid', label: messages.overlay.targetProcessId, value: targetProcessId || '-', valueClass: 'ltr-code' },
  ]

  const currentMetaRows = [
    { key: 'current-app', label: messages.overlay.activeApp, value: currentProcessName, valueClass: 'ltr-code' },
    { key: 'current-window', label: messages.overlay.activeWindow, value: currentWindowTitle, valueClass: 'plaintext' },
    { key: 'current-pid', label: messages.home.processId, value: currentProcessId || '-', valueClass: 'ltr-code' },
  ]

  const currentStatusChips = [
    { key: 'clipboard', label: messages.overlay.clipboardStatus, value: translateStatus(clipboardStatus, language) },
    { key: 'selection', label: messages.overlay.selectedTextStatus, value: translateStatus(selectedTextStatus, language) },
    { key: 'screenshot', label: messages.overlay.screenshotStatus, value: translateStatus(screenshotStatus, language) },
  ]

  const providerDisplayName = selectedProvider
    ? (language === 'ar'
      ? selectedProvider.display_name_ar || selectedProvider.display_name || translateProviderLabel(selectedProvider.label, language) || selectedProvider.id
      : selectedProvider.display_name || selectedProvider.display_name_ar || translateProviderLabel(selectedProvider.label, language) || selectedProvider.id)
    : translateProviderLabel(selectedProviderId, language) || selectedProviderId
  const providerModel = selectedProvider?.selected_model || messages.overlay.providerModelUnknown
  const providerStatusKey = selectedProvider?.diagnostic_status || selectedProvider?.status || 'unknown'
  const providerStatusLabel = translateStatus(providerStatusKey, language)
  const providerStatusLevel = (() => {
    if (providerStatusKey === 'online' || providerStatusKey === 'healthy' || providerStatusKey === 'ok') return 'success'
    if (providerStatusKey === 'missing_server' || providerStatusKey === 'offline' || providerStatusKey === 'error' || providerStatusKey === 'timeout') {
      return 'error'
    }
    if (providerStatusKey === 'no_model_loaded' || providerStatusKey === 'bad_model' || providerStatusKey === 'partial' || providerStatusKey === 'unconfigured') {
      return 'warning'
    }
    return 'unknown'
  })()
  const providerWarningMessage = selectedProvider?.diagnostic_message
    || selectedProvider?.warnings?.[0]
    || (providerStatusLevel === 'error'
      ? messages.overlay.providerOfflineWarning
      : providerStatusLevel === 'warning'
        ? messages.overlay.providerWarningGeneric
        : null)
  const providerLastTestStatusLabel = selectedProvider?.last_test_success === true
    ? messages.overlay.providerTestPassed
    : selectedProvider?.last_test_success === false
      ? messages.overlay.providerTestFailed
      : messages.overlay.providerTestNever
  const providerLastTestTime = selectedProvider?.last_test_at ? formatDateTime(selectedProvider.last_test_at) : null
  const providerLastTestLatency = typeof selectedProvider?.last_test_latency_ms === 'number'
    ? `${selectedProvider.last_test_latency_ms} ms`
    : null

  const composerTabs: { key: OverlayComposerTab; label: string }[] = [
    { key: 'prompt', label: messages.overlay.promptTab },
    { key: 'selected_input', label: messages.overlay.selectedInputTab },
  ]

  const overlayShortcuts = [
    { id: 'run', keys: ['Ctrl / ⌘', 'Enter'], label: messages.overlay.shortcutsRun },
    { id: 'focus', keys: ['Alt', 'I'], label: messages.overlay.shortcutsFocus },
    { id: 'copy', keys: ['Ctrl / ⌘', 'Shift', 'C'], label: messages.overlay.shortcutsCopy },
    { id: 'clear', keys: ['Ctrl / ⌘', 'Shift', '⌫ / Delete'], label: messages.overlay.shortcutsClear },
  ]

  return (
    <div className="overlay-page">
      <div className="overlay-page-card">
        <div className="overlay-page-header">
          <div>
            <h2 className="overlay-page-title">{messages.overlay.title}</h2>
            <span className="preview-only-badge">{messages.overlay.safeModeBadge}</span>
          </div>
          <button className="overlay-close-btn" onClick={handleClose} type="button" aria-label={messages.overlay.hideHint}>
            <span className="ltr-code">{messages.overlay.closeHint}</span>
            <span className="overlay-close-hint">{messages.overlay.hideHint}</span>
          </button>
        </div>

        {sessionNotice ? (
          <div className={`overlay-session-banner overlay-session-banner-${sessionNotice === 'restored' ? 'info' : 'cleared'}`}>
            <span>{sessionNotice === 'restored' ? messages.overlay.sessionRestored : messages.overlay.sessionCleared}</span>
          </div>
        ) : null}

        <div className="overlay-provider-row">
          <ProviderSelector
            providers={providers}
            selectedProviderId={selectedProviderId}
            isLoading={isLoadingProviders}
            onSelect={setSelectedProviderId}
          />
          <div className="overlay-provider-panel">
            <div className="overlay-provider-chip-grid">
              <div className="overlay-provider-chip">
                <span className="chip-label">{messages.overlay.providerLabel}</span>
                <span className="chip-value">{providerDisplayName}</span>
              </div>
              <div className="overlay-provider-chip">
                <span className="chip-label">{messages.overlay.modelLabel}</span>
                <span className="chip-value ltr-code">{providerModel}</span>
              </div>
            </div>
            <div className="overlay-provider-status-row">
              <span className={`provider-status-chip provider-status-${providerStatusLevel}`}>{providerStatusLabel}</span>
              {providerWarningMessage ? <span className="overlay-provider-warning plaintext">{providerWarningMessage}</span> : null}
            </div>
            <div className="overlay-provider-last-test">
              <span>{messages.overlay.providerLastTestStatus}: {providerLastTestStatusLabel}</span>
              {providerLastTestTime ? (
                <span>
                  {messages.overlay.providerLastTestTime}: <span className="ltr-code">{providerLastTestTime}</span>
                </span>
              ) : null}
              {providerLastTestLatency ? (
                <span>
                  {messages.overlay.providerLatency}: <span className="ltr-code">{providerLastTestLatency}</span>
                </span>
              ) : null}
            </div>
            <p className="overlay-provider-hint">{messages.overlay.providerInfoHint}</p>
          </div>
        </div>

        <ProviderManualStartGuidanceStrip provider={selectedProvider} variant="compact" className="overlay-manual-start-guidance" />

        {showOnboardingChecklist ? (
          <div className="overlay-onboarding-card">
            <OnboardingChecklistCard variant="compact" onDismiss={handleDismissOnboardingChecklist} />
          </div>
        ) : null}

        <div className="overlay-context-card overlay-target-context-card">
          <div className="overlay-context-header">
            <div>
              <h3 className="card-title">{messages.overlay.targetContext}</h3>
              <p className="context-help">{messages.overlay.targetContextHelp}</p>
            </div>
            <div className="context-chip-row">
              <div className="context-chip-stack">
                {targetContext?.timestamp ? (
                  <span className="context-chip context-chip-time">{messages.overlay.captureTime} · {targetCaptureTime}</span>
                ) : (
                  <span className="context-chip context-chip-muted">{messages.overlay.noTargetContextChip}</span>
                )}
                {targetHasContext ? <span className="context-chip context-chip-success">{messages.overlay.targetCapturedChip}</span> : null}
              </div>
              <div className="context-chip-stack">
                {targetCaptureFailed ? <span className="context-chip context-chip-warning">{messages.overlay.captureFailed}</span> : null}
                {targetSelfWarning ? <span className="context-chip context-chip-warning">{messages.overlay.overlaySelfWarning}</span> : null}
              </div>
            </div>
          </div>
          {targetContextError ? (
            <div className="context-error-block">
              <span className="context-label">{messages.overlay.captureFailed}</span>
              <p className="plaintext">{targetContextError}</p>
            </div>
          ) : null}
          <div className="context-meta-grid">
            {targetMetaRows.map((row) => (
              <div key={row.key} className="context-meta-row">
                <span className="context-label">{row.label}</span>
                <span className={`context-value ${row.valueClass}`}>{row.value}</span>
              </div>
            ))}
          </div>
          {targetCaptureFailed ? (
            <div className="context-warning-block">
              <span className="context-label">{messages.home.warnings}</span>
              <p className="plaintext">{messages.overlay.captureFailed}</p>
            </div>
          ) : null}
          {targetSelfWarning ? (
            <div className="context-warning-block">
              <span className="context-label">{messages.home.warnings}</span>
              <p className="plaintext">{messages.overlay.overlaySelfWarning}</p>
            </div>
          ) : null}
          {targetWarnings.length > 0 ? (
            <div className="context-warning-block">
              <span className="context-label">{messages.home.warnings}</span>
              <ul className="context-warning-list">
                {targetWarnings.map((warning) => (
                  <li key={warning} className="plaintext">{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="overlay-context-card">
          <div className="overlay-context-header">
            <div>
              <h3 className="card-title">{messages.overlay.currentContext}</h3>
              <p className="context-help">{messages.overlay.currentContextHelp}</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => void loadCurrentContext()} type="button" disabled={isRefreshingCurrentContext}>
              {isRefreshingCurrentContext ? messages.overlay.refreshingContext : messages.overlay.refreshContext}
            </button>
          </div>
          <div className="context-chip-row">
            <div className="context-chip-stack">
              {currentContext?.timestamp ? (
                <span className="context-chip context-chip-muted">{messages.overlay.captureTime} · {currentCaptureTime}</span>
              ) : (
                <span className="context-chip context-chip-warning">{messages.overlay.currentMissingChip}</span>
              )}
              {currentHasContext ? <span className="context-chip context-chip-success">{messages.overlay.currentLiveChip}</span> : null}
            </div>
            <div className="context-chip-stack">
              {currentStatusChips.map((chip) => (
                <span key={chip.key} className="context-chip context-chip-status">{chip.label}: {chip.value}</span>
              ))}
            </div>
          </div>
          <div className="context-meta-grid">
            {currentMetaRows.map((row) => (
              <div key={row.key} className="context-meta-row">
                <span className="context-label">{row.label}</span>
                <span className={`context-value ${row.valueClass}`}>{row.value}</span>
              </div>
            ))}
          </div>
          {currentContext?.warnings.length ? (
            <div className="context-warning-block">
              <span className="context-label">{messages.home.warnings}</span>
              <ul className="context-warning-list">
                {currentContext.warnings.map((warning) => (
                  <li key={warning} className="plaintext">{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="overlay-composer-section">
          <SafePromptTemplates className="overlay-template-section" onApply={(template) => actionButtonsRef.current?.applyTemplate(template)} />
          <div className="overlay-composer-tabs" role="tablist">
            {composerTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`overlay-composer-tab ${composerMode === tab.key ? 'active' : ''}`}
                aria-pressed={composerMode === tab.key}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={`overlay-tab-panel ${composerMode === 'prompt' ? 'active' : ''}`} hidden={composerMode !== 'prompt'}>
            <ActionButtons
              ref={actionButtonsRef}
              apiBase={API_BASE}
              context={currentContext as never}
              targetContext={targetContext}
              selectedProviderId={selectedProviderId}
              selectedProviderModel={selectedProvider?.selected_model || ''}
              onResult={handleResultChange}
              initialState={composerState}
              onStateChange={handleComposerStateChange}
              resetSignal={clearSignal}
              onClearSession={handleClearSession}
              showClearSessionButton={composerMode === 'prompt'}
            />
          </div>
          <div className={`overlay-tab-panel ${composerMode === 'selected_input' ? 'active' : ''}`} hidden={composerMode !== 'selected_input'}>
            <p className="overlay-composer-hint">{messages.overlay.selectedInputHint}</p>
            <OverlaySelectedInputMiniPanel
              ref={selectedInputRef}
              apiBase={API_BASE}
              selectedProviderId={selectedProviderId}
              selectedProviderModel={selectedProvider?.selected_model || ''}
              onResult={handleResultChange}
              initialState={selectedInputState}
              onStateChange={handleSelectedInputStateChange}
              resetSignal={selectedInputResetSignal}
            />
          </div>
        </div>

        <section className="overlay-result-section">
          <h3 className="section-title">{messages.overlay.resultTitle}</h3>
          <ResultPreview
            result={result}
            onSaveResult={(payload) => void handleSaveResult(payload)}
            isSavingResult={isSavingResult}
            saveResultMessage={saveResultMessage}
          />
        </section>

        <section className="overlay-shortcuts-card">
          <div className="overlay-shortcuts-header">
            <h3 className="section-title">{messages.overlay.shortcutsTitle}</h3>
            <p className="context-help">{messages.overlay.shortcutsScope}</p>
          </div>
          <ul className="overlay-shortcuts-list">
            {overlayShortcuts.map((shortcut) => (
              <li key={shortcut.id} className="overlay-shortcut-row">
                <span className="shortcut-keys" aria-hidden="true">
                  {shortcut.keys.map((keyLabel, index) => (
                    <span key={`${shortcut.id}-${keyLabel}-${index}`} className="shortcut-key-wrapper">
                      <kbd>{keyLabel}</kbd>
                      {index < shortcut.keys.length - 1 ? <span className="shortcut-key-plus">+</span> : null}
                    </span>
                  ))}
                </span>
                <span className="shortcut-label">{shortcut.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

export default OverlayPage
