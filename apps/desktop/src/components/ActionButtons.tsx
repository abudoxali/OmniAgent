import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { translateMode, useAppPreferences } from '../i18n'
import type { OverlayTargetContext } from '../types/omniagent'

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
  active_window_title?: string
  active_process_name?: string
  active_process_id?: number
  clipboard_text_preview?: string
  timestamp: string
}

export interface ResultPreviewState {
  title: string
  body: string
  meta?: string
  provider?: string
  model?: string
  warnings?: string[]
  status?: string
  savePayload?: WorkspaceResultDraft
}

export interface WorkspaceResultDraft {
  title: string
  content: string
  provider?: string
  model?: string
  mode?: string
  source?: string
  metadata?: Record<string, unknown>
}

export interface ActionButtonsHandle {
  focusInstruction: () => void
  runPrompt: () => void
  copyLatestOutput: () => void
  clearSessionShortcut: () => void
  applyTemplate: (template: { instruction: string; mode?: string }) => void
}

interface ActionButtonsProps {
  apiBase: string
  context: ContextData | null
  targetContext?: OverlayTargetContext | null
  selectedProviderId: string
  selectedProviderModel?: string
  onResult: (result: ResultPreviewState) => void
  initialState?: Partial<ActionButtonsPersistedState>
  onStateChange?: (state: ActionButtonsPersistedState) => void
  resetSignal?: number
  onClearSession?: () => void
  showClearSessionButton?: boolean
}

interface ActionStatus {
  type: 'info' | 'success' | 'error' | 'warning'
  message: string
  actionType?: string
}

interface PendingAction {
  action_id: string
  action_type: string
  payload_preview: string
  payload_length: number
  user_visible_summary_ar: string
  target_hint?: string
  target_window_title?: string
  target_process_name?: string
  target_captured_at?: string
}

export interface ActionButtonsPersistedState {
  instruction: string
  mode: string
  includeClipboardContext: boolean
  includeSelectedTextContext: boolean
  includeActiveWindowContext: boolean
  latestOutput: string
  pendingAction?: PendingAction | null
}

function buildTargetHint(targetContext: OverlayTargetContext | null | undefined): string | undefined {
  if (!targetContext) return undefined
  const parts: string[] = []
  if (targetContext.active_window_title) {
    parts.push(targetContext.active_window_title)
  }
  if (targetContext.active_process_name && targetContext.active_process_name !== 'unknown') {
    parts.push(targetContext.active_process_name)
  }
  if (parts.length === 0) return undefined
  return parts.slice(0, 2).join(' | ')
}

function getContextClipboardText(context: ContextData | null): string {
  return context?.clipboard_text_preview || context?.clipboard?.text || ''
}

function getContextWindowTitle(context: ContextData | null): string | undefined {
  return context?.active_window_title || context?.active_window?.title || undefined
}

function getContextProcessName(context: ContextData | null): string | undefined {
  return context?.active_process_name || context?.active_window?.process_name || undefined
}

export function buildWorkspaceSavePayload(params: {
  messages: ReturnType<typeof useAppPreferences>['messages']
  language: ReturnType<typeof useAppPreferences>['language']
  mode: string
  instruction: string
  output: string
  provider: string
  model: string
}): WorkspaceResultDraft {
  const instructionPreview = params.instruction.trim().replace(/\s+/g, ' ').slice(0, 72)
  const modeLabel = translateMode(params.mode, params.language)
  const title = instructionPreview ? `${modeLabel} - ${instructionPreview}` : `${params.messages.actions.aiResultTitle} - ${modeLabel}`
  return {
    title,
    content: params.output,
    provider: params.provider,
    model: params.model,
    mode: params.mode,
    source: 'manual_save',
  }
}

const ActionButtons = forwardRef<ActionButtonsHandle, ActionButtonsProps>(function ActionButtons({
  apiBase,
  context,
  targetContext,
  selectedProviderId,
  selectedProviderModel = '',
  onResult,
  initialState,
  onStateChange,
  resetSignal,
  onClearSession,
  showClearSessionButton = true,
}: ActionButtonsProps, ref) {
  const { messages, language, formatDateTime } = useAppPreferences()
  const [instruction, setInstruction] = useState(initialState?.instruction ?? '')
  const [mode, setMode] = useState(initialState?.mode ?? 'custom')
  const [includeClipboardContext, setIncludeClipboardContext] = useState(initialState?.includeClipboardContext ?? true)
  const [includeSelectedTextContext, setIncludeSelectedTextContext] = useState(initialState?.includeSelectedTextContext ?? false)
  const [includeActiveWindowContext, setIncludeActiveWindowContext] = useState(initialState?.includeActiveWindowContext ?? true)
  const [isRunning, setIsRunning] = useState(false)
  const [latestOutput, setLatestOutput] = useState(initialState?.latestOutput ?? '')
  const [actionStatus, setActionStatus] = useState<ActionStatus | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(initialState?.pendingAction ?? null)
  const [hasConfirmedCursorPlacement, setHasConfirmedCursorPlacement] = useState(false)
  const instructionRef = useRef<HTMLTextAreaElement | null>(null)

  const clearActionStatus = () => setActionStatus(null)
  const hasActionOutput = latestOutput.trim().length > 0
  const modes = useMemo(() => ([
    { value: 'custom', label: translateMode('custom', language) },
    { value: 'summarize', label: translateMode('summarize', language) },
    { value: 'rewrite', label: translateMode('rewrite', language) },
    { value: 'explain', label: translateMode('explain', language) },
    { value: 'translate', label: translateMode('translate', language) },
    { value: 'generate_reply', label: translateMode('generate_reply', language) },
  ]), [language])

  useEffect(() => {
    if (!onStateChange) return
    onStateChange({
      instruction,
      mode,
      includeClipboardContext,
      includeSelectedTextContext,
      includeActiveWindowContext,
      latestOutput,
      pendingAction,
    })
  }, [instruction, mode, includeClipboardContext, includeSelectedTextContext, includeActiveWindowContext, latestOutput, pendingAction, onStateChange])

  useEffect(() => {
    if (resetSignal === undefined) return
    if (pendingAction) {
      void fetch(`${apiBase}/actions/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: pendingAction.action_id, confirm: false }),
      })
    }
    setInstruction('')
    setMode('custom')
    setIncludeClipboardContext(true)
    setIncludeSelectedTextContext(false)
    setIncludeActiveWindowContext(true)
    setLatestOutput('')
    setPendingAction(null)
    setHasConfirmedCursorPlacement(false)
    setActionStatus(null)
  }, [resetSignal, pendingAction, apiBase])

  useEffect(() => {
    if (!pendingAction) {
      setHasConfirmedCursorPlacement(false)
    }
  }, [pendingAction])

  const formattedTargetTimestamp = useMemo(() => {
    if (!targetContext?.timestamp) return '-'
    return formatDateTime(targetContext.timestamp)
  }, [formatDateTime, targetContext])

  const handleCopy = async () => {
    clearActionStatus()
    const text = latestOutput
    if (!text) {
      setActionStatus({ type: 'error', message: messages.actions.noOutputForAction })
      return
    }
    const response = await fetch(`${apiBase}/actions/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const data = await response.json()
    setActionStatus({
      type: data.executed ? 'success' : 'error',
      message: data.safe_message || messages.actions.actionStatusCopied,
      actionType: 'copy_to_clipboard',
    })
    onResult({
      title: messages.actions.copyResultTitle,
      body: text,
      meta: data.safe_message || messages.actions.copyResultMeta,
      status: data.executed ? 'ok' : 'error',
    })
  }

  const handlePastePreview = async () => {
    clearActionStatus()
    const text = latestOutput || getContextClipboardText(context)
    if (!text) {
      setActionStatus({ type: 'error', message: messages.actions.noOutputForAction })
      return
    }
    const response = await fetch(`${apiBase}/actions/paste-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const data = await response.json()
    onResult({
      title: messages.actions.pastePreviewTitle,
      body: data.payload_preview,
      meta: data.safe_message,
      status: 'ok',
    })
  }

  const handleRequestPaste = async () => {
    clearActionStatus()
    const text = latestOutput
    if (!text) {
      setActionStatus({ type: 'error', message: messages.actions.noOutputForAction })
      return
    }
    const targetHint = buildTargetHint(targetContext) || getContextWindowTitle(context)
    const response = await fetch(`${apiBase}/actions/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: 'paste_text_approved',
        text,
        target_hint: targetHint,
        target_window_title: targetContext?.active_window_title || getContextWindowTitle(context),
        target_process_name: targetContext?.active_process_name || getContextProcessName(context),
        target_captured_at: targetContext?.timestamp || undefined,
      }),
    })
    const data = await response.json()
    if (data.allowed) {
      setPendingAction({
        action_id: data.action_id,
        action_type: data.action_type,
        payload_preview: data.payload_preview,
        payload_length: data.payload_length,
        user_visible_summary_ar: data.user_visible_summary_ar,
        target_hint: data.target_hint,
        target_window_title: targetContext?.active_window_title || getContextWindowTitle(context),
        target_process_name: targetContext?.active_process_name || getContextProcessName(context),
        target_captured_at: targetContext?.timestamp || undefined,
      })
      setActionStatus({ type: 'info', message: data.user_visible_summary_ar, actionType: 'paste_text_approved' })
    } else {
      setActionStatus({ type: 'error', message: data.warnings[0] || messages.actions.pastePreviewTitle })
    }
  }

  const handleCancelPaste = async () => {
    if (!pendingAction) {
      setActionStatus({ type: 'info', message: messages.actions.actionStatusCanceled })
      return
    }
    await fetch(`${apiBase}/actions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_id: pendingAction.action_id, confirm: false }),
    })
    setPendingAction(null)
    setActionStatus({ type: 'info', message: messages.actions.actionStatusCanceled })
  }

  const handleConfirmPaste = async () => {
    if (!pendingAction || !hasConfirmedCursorPlacement) return
    const response = await fetch(`${apiBase}/actions/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_id: pendingAction.action_id, confirm: true }),
    })
    const data = await response.json()
    setPendingAction(null)
    setHasConfirmedCursorPlacement(false)
    setActionStatus({
      type: data.executed ? 'success' : 'error',
      message: data.safe_message || (data.executed ? messages.actions.actionStatusPasted : messages.actions.actionStatusPasteFailed),
      actionType: 'paste_text_approved',
    })
    onResult({
      title: messages.actions.pasteResultTitle,
      body: latestOutput,
      meta: data.safe_message,
      status: data.executed ? 'ok' : 'error',
      warnings: data.warnings,
    })
  }

  const handleRunAgent = async () => {
    if (!instruction.trim()) {
      onResult({
        title: messages.actions.aiResultTitle,
        body: messages.actions.validationBody,
        status: 'validation_error',
        warnings: [messages.actions.validationWarning],
      })
      return
    }

    setIsRunning(true)
    setPendingAction(null)
    clearActionStatus()
    try {
      const response = await fetch(`${apiBase}/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          mode,
          include_clipboard_context: includeClipboardContext,
          include_selected_text_context: includeSelectedTextContext,
          include_active_window_context: includeActiveWindowContext,
          provider: selectedProviderId,
          model: selectedProviderModel || undefined,
        }),
      })

      const data = await response.json()
      const outputText = data.output_text || data.response || messages.actions.noModelOutput
      setLatestOutput(outputText)
      const provider = data.provider || selectedProviderId
      const model = data.model || ''
      onResult({
        title: messages.actions.aiResultTitle,
        body: outputText,
        provider,
        model,
        warnings: data.warnings || [],
        status: data.status || (response.ok ? 'ok' : 'error'),
        savePayload: buildWorkspaceSavePayload({
          messages,
          language,
          mode,
          instruction,
          output: outputText,
          provider,
          model,
        }),
      })
    } catch (error) {
      onResult({
        title: messages.actions.aiResultTitle,
        body: messages.actions.networkBody,
        warnings: [error instanceof Error ? error.message : messages.actions.networkWarning],
        status: 'error',
      })
    } finally {
      setIsRunning(false)
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      focusInstruction() {
        if (instructionRef.current) {
          instructionRef.current.focus()
          const length = instructionRef.current.value.length
          instructionRef.current.setSelectionRange(length, length)
        }
      },
      runPrompt() {
        if (!isRunning && instruction.trim()) {
          void handleRunAgent()
        }
      },
      copyLatestOutput() {
        if (hasActionOutput) {
          void handleCopy()
        }
      },
      clearSessionShortcut() {
        if (onClearSession) {
          onClearSession()
        }
      },
      applyTemplate(template) {
        setInstruction(template.instruction)
        if (template.mode) {
          setMode(template.mode)
        }
        if (instructionRef.current) {
          instructionRef.current.focus()
        }
      },
    }),
    [handleRunAgent, handleCopy, hasActionOutput, instruction, isRunning, onClearSession],
  )

  return (
    <div className="ai-composer">
      <div className="card ai-composer-card">
        <div className="ai-composer-header">
          <div>
            <h4 className="card-title">{messages.actions.title}</h4>
            <p className="card-description">{messages.actions.description}</p>
          </div>
          {onClearSession && showClearSessionButton ? (
            <button className="btn btn-ghost btn-sm" type="button" onClick={onClearSession}>
              {messages.actions.clearSession}
            </button>
          ) : null}
        </div>
        <div className="ai-form-grid">
          <label className="ai-field">
            <span className="ai-label">{messages.actions.mode}</span>
            <select className="ai-select" value={mode} onChange={(event) => setMode(event.target.value)}>
              {modes.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="ai-field">
            <span className="ai-label">{messages.actions.providerOverride}</span>
            <input className="ai-input ltr-code" value={selectedProviderId} readOnly />
          </label>
          <label className="ai-field">
            <span className="ai-label">{messages.actions.modelOverride}</span>
            <input className="ai-input ltr-code" value={selectedProviderModel || '-'} readOnly />
          </label>
        </div>
        <label className="ai-field">
          <span className="ai-label">{messages.actions.instruction}</span>
          <textarea
            className="ai-textarea plaintext"
            placeholder={messages.actions.instructionPlaceholder}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={5}
            ref={instructionRef}
          />
        </label>
        <div className="ai-toggle-row">
          <label className="ai-toggle">
            <input type="checkbox" checked={includeActiveWindowContext} onChange={(event) => setIncludeActiveWindowContext(event.target.checked)} />
            <span>{messages.actions.includeActiveWindow}</span>
          </label>
          <label className="ai-toggle">
            <input type="checkbox" checked={includeClipboardContext} onChange={(event) => setIncludeClipboardContext(event.target.checked)} />
            <span>{messages.actions.includeClipboard}</span>
          </label>
          <label className="ai-toggle">
            <input type="checkbox" checked={includeSelectedTextContext} onChange={(event) => setIncludeSelectedTextContext(event.target.checked)} />
            <span>{messages.actions.includeSelectedText}</span>
          </label>
        </div>
        <div className="ai-action-row">
          <button className="btn btn-primary" onClick={handleRunAgent} type="button" disabled={isRunning}>
            {isRunning ? messages.actions.running : messages.actions.run}
          </button>
          <button className="btn btn-secondary" onClick={handleCopy} type="button" disabled={!hasActionOutput}>
            {messages.actions.copy}
          </button>
          <button className="btn btn-secondary" onClick={handlePastePreview} type="button" disabled={!hasActionOutput && !getContextClipboardText(context)}>
            {messages.actions.pastePreview}
          </button>
          <button className="btn btn-secondary" onClick={handleRequestPaste} type="button" disabled={!hasActionOutput || pendingAction !== null}>
            {messages.actions.pasteAfterApproval}
          </button>
        </div>

        {pendingAction ? (
          <div className="paste-approval-banner">
            <div className="paste-approval-header">
              <div>
                <h5 className="card-title">{messages.actions.pasteBannerTitle}</h5>
                <p className="card-description">{pendingAction.user_visible_summary_ar || messages.actions.pasteBannerBody}</p>
              </div>
              <span className="preview-only-badge">{messages.actions.safeModeBadge}</span>
            </div>
            <div className="paste-target-grid">
              <div>
                <span className="context-label">{messages.actions.pasteBannerTargetApp}</span>
                <span className="context-value ltr-code">{pendingAction.target_process_name || '-'}</span>
              </div>
              <div>
                <span className="context-label">{messages.actions.pasteBannerTargetWindow}</span>
                <span className="context-value plaintext">{pendingAction.target_window_title || targetContext?.active_window_title || '-'}</span>
              </div>
              <div>
                <span className="context-label">{messages.actions.pasteBannerTargetTime}</span>
                <span className="context-value ltr-code">{pendingAction.target_captured_at ? formatDateTime(pendingAction.target_captured_at) : formattedTargetTimestamp}</span>
              </div>
            </div>
            {pendingAction.target_hint ? (
              <div className="paste-target-hint">
                <span className="context-label">{messages.overlay.targetContext}</span>
                <span className="context-value ltr-code plaintext">{pendingAction.target_hint}</span>
              </div>
            ) : null}
            <div className="paste-preview-box ltr-code plaintext">{pendingAction.payload_preview}</div>
            <label className="paste-banner-checkbox">
              <input
                type="checkbox"
                checked={hasConfirmedCursorPlacement}
                onChange={(event) => setHasConfirmedCursorPlacement(event.target.checked)}
              />
              <span>{messages.actions.pasteBannerCursorCheckbox}</span>
            </label>
            <div className="paste-banner-actions">
              <button className="btn btn-primary" onClick={handleConfirmPaste} type="button" disabled={!hasConfirmedCursorPlacement}>
                {messages.actions.confirmPaste}
              </button>
              <button className="btn btn-secondary" onClick={handleCancelPaste} type="button">
                {messages.actions.cancel}
              </button>
            </div>
          </div>
        ) : null}

        {actionStatus ? (
          <div className={`action-status-banner action-status-${actionStatus.type}`}>
            <span>{actionStatus.message}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
})

export default ActionButtons
