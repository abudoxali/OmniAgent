import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useAppPreferences } from '../i18n'
import type { ResultPreviewState, WorkspaceResultDraft } from './ActionButtons'
import { buildWorkspaceSavePayload } from './ActionButtons'

const MAX_SELECTED_INPUT_CHARS = 64_000
const MAX_SELECTED_INPUT_BYTES = 64 * 1024
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.json', '.csv'] as const

export type OverlaySelectedInputAction = 'summarize' | 'rewrite' | 'classify' | 'extract'
export type OverlaySelectedInputMode = 'paste' | 'file'
type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number]

export interface OverlaySelectedInputFileMeta {
  name: string
  size: number
  extension: AllowedExtension
}

export interface OverlaySelectedInputPersistedState {
  inputMode: OverlaySelectedInputMode
  pastedText: string
  selectedAction: OverlaySelectedInputAction
  fileMeta?: OverlaySelectedInputFileMeta | null
}

export interface OverlaySelectedInputMiniPanelHandle {
  focusInput: () => void
  runSelectedInput: () => void
  clearInputs: () => void
}

interface OverlaySelectedInputMiniPanelProps {
  apiBase: string
  selectedProviderId: string
  selectedProviderModel?: string
  onResult: (result: ResultPreviewState) => void
  initialState?: OverlaySelectedInputPersistedState
  onStateChange?: (state: OverlaySelectedInputPersistedState) => void
  resetSignal?: number
}

interface PanelStatus {
  type: 'info' | 'error' | 'success'
  message: string
}

interface FileState {
  meta: OverlaySelectedInputFileMeta
  text: string
  requiresReload: boolean
}

function formatBytes(size: number | undefined | null, locale: string): string {
  if (typeof size !== 'number') {
    return '-'
  }
  if (size < 1024) {
    return `${new Intl.NumberFormat(locale).format(size)} ${locale.startsWith('ar') ? 'بايت' : 'bytes'}`
  }
  const kb = size / 1024
  return `${kb.toFixed(kb >= 10 ? 0 : 1)} ${locale.startsWith('ar') ? 'كيلوبايت' : 'KB'}`
}

function buildResultMeta(
  strings: ReturnType<typeof useAppPreferences>['messages'],
  locale: string,
  actionLabel: string,
  fileState: FileState | null,
  inputMode: OverlaySelectedInputMode,
): string {
  const parts: string[] = [`${strings.selectedInput.metaAction}: ${actionLabel}`]
  if (inputMode === 'file' && fileState) {
    parts.push(`${strings.selectedInput.metaSource}: ${fileState.meta.name}`)
    parts.push(`${strings.selectedInput.metaSize}: ${formatBytes(fileState.meta.size, locale)}`)
  } else {
    parts.push(`${strings.selectedInput.metaSource}: ${strings.selectedInput.pasteSourceLabel}`)
  }
  return parts.join(' · ')
}

function buildSavePayload(params: {
  messages: ReturnType<typeof useAppPreferences>['messages']
  language: ReturnType<typeof useAppPreferences>['language']
  action: OverlaySelectedInputAction
  inputMode: OverlaySelectedInputMode
  fileState: FileState | null
  provider: string
  model: string
  content: string
  textLength: number
}): WorkspaceResultDraft {
  const actionLabel = params.messages.selectedInput.actions[params.action] || params.action
  const sourceLabel = params.inputMode === 'file'
    ? params.fileState?.meta.name || params.messages.selectedInput.fileSourceLabel
    : params.messages.selectedInput.pasteSourceLabel
  const instructionPreview = `${actionLabel} · ${sourceLabel}`
  const base = buildWorkspaceSavePayload({
    messages: params.messages,
    language: params.language,
    mode: params.action,
    instruction: instructionPreview,
    output: params.content,
    provider: params.provider,
    model: params.model,
  })
  return {
    ...base,
    source: params.inputMode === 'file' ? 'selected_file' : 'selected_text',
    metadata: {
      input_type: params.inputMode,
      action: params.action,
      file_name: params.fileState?.meta.name ?? null,
      file_extension: params.fileState?.meta.extension ?? null,
      file_size: params.fileState?.meta.size ?? null,
      character_count: params.textLength,
    },
  }
}

const OverlaySelectedInputMiniPanel = forwardRef<OverlaySelectedInputMiniPanelHandle, OverlaySelectedInputMiniPanelProps>(function OverlaySelectedInputMiniPanel({
  apiBase,
  selectedProviderId,
  selectedProviderModel = '',
  onResult,
  initialState,
  onStateChange,
  resetSignal,
}, ref) {
  const { messages, language, locale, formatNumber } = useAppPreferences()
  const [inputMode, setInputMode] = useState<OverlaySelectedInputMode>(initialState?.inputMode ?? 'paste')
  const [pastedText, setPastedText] = useState(initialState?.pastedText ?? '')
  const [selectedAction, setSelectedAction] = useState<OverlaySelectedInputAction>(initialState?.selectedAction ?? 'summarize')
  const [fileState, setFileState] = useState<FileState | null>(
    initialState?.fileMeta
      ? { meta: initialState.fileMeta, text: '', requiresReload: true }
      : null,
  )
  const [status, setStatus] = useState<PanelStatus | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

  const currentText = inputMode === 'file' ? fileState?.text ?? '' : pastedText
  const currentLength = currentText.length
  const isOverCharLimit = currentLength > MAX_SELECTED_INPUT_CHARS
  const requiresFileReload = inputMode === 'file' && Boolean(fileState?.requiresReload)
  const actions = useMemo<Array<{ value: OverlaySelectedInputAction; label: string; description: string }>>(() => ([
    { value: 'summarize', label: messages.selectedInput.actions.summarize, description: messages.selectedInput.actionsDescription.summarize },
    { value: 'rewrite', label: messages.selectedInput.actions.rewrite, description: messages.selectedInput.actionsDescription.rewrite },
    { value: 'classify', label: messages.selectedInput.actions.classify, description: messages.selectedInput.actionsDescription.classify },
    { value: 'extract', label: messages.selectedInput.actions.extract, description: messages.selectedInput.actionsDescription.extract },
  ]), [messages.selectedInput.actions, messages.selectedInput.actionsDescription])

  useEffect(() => {
    onStateChange?.({
      inputMode,
      pastedText,
      selectedAction,
      fileMeta: fileState?.meta ?? null,
    })
  }, [inputMode, pastedText, selectedAction, fileState, onStateChange])

  useEffect(() => {
    if (resetSignal === undefined) {
      return
    }
    setInputMode('paste')
    setPastedText('')
    setSelectedAction('summarize')
    setFileState(null)
    setStatus(null)
    setIsRunning(false)
  }, [resetSignal])

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const clearFile = useCallback(() => {
    setFileState(null)
  }, [])

  const clearAllInputs = useCallback(() => {
    setPastedText('')
    clearFile()
    setStatus(null)
    setInputMode('paste')
  }, [clearFile])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    const extension = `.${(file.name.split('.').pop() || '').toLowerCase()}` as AllowedExtension
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      clearFile()
      setStatus({ type: 'error', message: messages.selectedInput.errors.unsupportedExtension })
      return
    }

    if (file.size > MAX_SELECTED_INPUT_BYTES) {
      clearFile()
      setStatus({ type: 'error', message: messages.selectedInput.errors.fileTooLarge })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setFileState({ meta: { name: file.name, size: file.size, extension }, text, requiresReload: false })
      setInputMode('file')
      setStatus(null)
    }
    reader.onerror = () => {
      clearFile()
      setStatus({ type: 'error', message: messages.selectedInput.errors.readFailed })
    }
    reader.readAsText(file)
  }

  const currentActionMeta = useMemo(() => actions.find((action) => action.value === selectedAction), [actions, selectedAction])

  const runSelectedInput = async () => {
    const textPayload = currentText.trim()
    if (!textPayload) {
      const message = inputMode === 'file'
        ? requiresFileReload
          ? messages.overlay.selectedInputFileReload
          : messages.selectedInput.errors.emptyFileText
        : messages.selectedInput.errors.emptyPaste
      setStatus({ type: 'error', message })
      return
    }

    if (requiresFileReload) {
      setStatus({ type: 'error', message: messages.overlay.selectedInputFileReload })
      return
    }

    if (isOverCharLimit) {
      setStatus({ type: 'error', message: messages.selectedInput.errors.overCharLimit })
      return
    }

    setIsRunning(true)
    setStatus(null)
    try {
      const response = await fetch(`${apiBase}/agent/selected-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedAction,
          source_type: inputMode === 'file' ? 'file' : 'paste',
          input_text: currentText,
          file_name: fileState?.meta.name,
          file_extension: fileState?.meta.extension,
          file_size: fileState?.meta.size,
          provider: selectedProviderId,
          model: selectedProviderModel || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || messages.selectedInput.errors.generic)
      }

      const actionLabel = currentActionMeta?.label || selectedAction
      const outputText = data.output_text || messages.selectedInput.noOutput
      const provider = data.provider || selectedProviderId
      const model = data.model || selectedProviderModel || ''
      const metaSummary = buildResultMeta(messages, locale, actionLabel, fileState, inputMode)

      onResult({
        title: `${messages.selectedInput.resultTitle} - ${actionLabel}`,
        body: outputText,
        provider,
        model,
        warnings: data.warnings || [],
        status: data.status || 'ok',
        meta: metaSummary,
        savePayload: buildSavePayload({
          messages,
          language,
          action: selectedAction,
          inputMode,
          fileState,
          provider,
          model,
          content: outputText,
          textLength: textPayload.length,
        }),
      })
      setStatus({ type: 'success', message: messages.selectedInput.statusSuccess })
    } catch (error) {
      const message = error instanceof Error ? error.message : messages.selectedInput.errors.generic
      setStatus({ type: 'error', message })
      onResult({
        title: messages.selectedInput.resultTitle,
        body: message,
        status: 'error',
        warnings: [message],
      })
    } finally {
      setIsRunning(false)
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      focusInput() {
        if (inputMode === 'paste' && textAreaRef.current) {
          const element = textAreaRef.current
          element.focus()
          const length = element.value.length
          element.setSelectionRange(length, length)
        }
      },
      runSelectedInput() {
        void runSelectedInput()
      },
      clearInputs() {
        clearAllInputs()
      },
    }),
    [clearAllInputs, inputMode, runSelectedInput],
  )

  return (
    <div className="card overlay-selected-input-card">
      <div className="overlay-selected-input-mode-row">
        <button
          type="button"
          className={`overlay-selected-input-tab ${inputMode === 'paste' ? 'active' : ''}`}
          onClick={() => setInputMode('paste')}
        >
          {messages.selectedInput.pasteTab}
        </button>
        <button
          type="button"
          className={`overlay-selected-input-tab ${inputMode === 'file' ? 'active' : ''}`}
          onClick={() => setInputMode('file')}
        >
          {messages.selectedInput.fileTab}
        </button>
      </div>

      {inputMode === 'paste' ? (
        <label className="ai-field overlay-selected-input-field">
          <span className="ai-label">{messages.selectedInput.pasteLabel}</span>
          <textarea
            ref={textAreaRef}
            className="ai-textarea plaintext"
            rows={4}
            value={pastedText}
            placeholder={messages.selectedInput.pastePlaceholder}
            onChange={(event) => setPastedText(event.target.value)}
          />
        </label>
      ) : (
        <div className="overlay-selected-input-file-panel">
          <div className="overlay-selected-input-file-actions">
            <button className="btn btn-secondary" type="button" onClick={handleFileSelect}>
              {messages.selectedInput.selectFile}
            </button>
            {fileState ? (
              <button className="btn btn-ghost" type="button" onClick={clearFile}>
                {messages.selectedInput.clearFile}
              </button>
            ) : null}
          </div>
          <input ref={fileInputRef} type="file" accept={ALLOWED_EXTENSIONS.join(',')} onChange={handleFileChange} hidden />
          {fileState ? (
            <div className="overlay-selected-input-file-meta">
              <div>
                <span className="context-label">{messages.selectedInput.fileMetaName}</span>
                <span className="context-value plaintext">{fileState.meta.name}</span>
              </div>
              <div>
                <span className="context-label">{messages.selectedInput.fileMetaExt}</span>
                <span className="context-value ltr-code">{fileState.meta.extension}</span>
              </div>
              <div>
                <span className="context-label">{messages.selectedInput.fileMetaSize}</span>
                <span className="context-value ltr-code">{formatBytes(fileState.meta.size, locale)}</span>
              </div>
            </div>
          ) : (
            <p className="card-description overlay-selected-input-hint">{messages.selectedInput.allowedExtensions}</p>
          )}
          {fileState ? (
            <div className={`overlay-selected-input-preview-box plaintext ${requiresFileReload ? 'preview-warning' : ''}`}>
              {requiresFileReload ? messages.overlay.selectedInputFileReload : fileState.text || messages.selectedInput.previewPlaceholder}
            </div>
          ) : null}
        </div>
      )}

      <div className="overlay-selected-input-counter-row">
        <span className={`selected-input-count ${isOverCharLimit ? 'warning' : ''}`}>
          {messages.selectedInput.charCount.replace('{count}', formatNumber(currentLength))}
        </span>
        <span className="selected-input-limit">{messages.selectedInput.charLimit}</span>
      </div>
      {isOverCharLimit ? <p className="selected-input-warning">{messages.selectedInput.charLimitWarning}</p> : null}

      <div className="overlay-selected-input-action-grid">
        {actions.map((action) => (
          <label key={action.value} className={`overlay-selected-input-action ${selectedAction === action.value ? 'active' : ''}`}>
            <input
              type="radio"
              name="overlay-selected-input-action"
              value={action.value}
              checked={selectedAction === action.value}
              onChange={() => setSelectedAction(action.value)}
            />
            <div>
              <span className="action-label">{action.label}</span>
              <p className="action-description">{action.description}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="overlay-selected-input-run-row">
        <div className="overlay-selected-input-run-actions">
          <button className="btn btn-primary" type="button" onClick={() => void runSelectedInput()} disabled={isRunning}>
            {isRunning ? messages.selectedInput.running : messages.selectedInput.run}
          </button>
          <button className="btn btn-ghost" type="button" onClick={clearAllInputs}>
            {messages.selectedInput.clearFile}
          </button>
        </div>
        <span className="overlay-selected-input-run-hint">{messages.selectedInput.runHint}</span>
      </div>

      {status ? <div className={`selected-input-status selected-input-status-${status.type}`}>{status.message}</div> : null}
    </div>
  )
})

export default OverlaySelectedInputMiniPanel
