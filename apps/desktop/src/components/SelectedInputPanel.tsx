import { useMemo, useRef, useState } from 'react'
import { useAppPreferences } from '../i18n'
import { buildWorkspaceSavePayload, type ResultPreviewState, type WorkspaceResultDraft } from './ActionButtons'

const MAX_SELECTED_INPUT_CHARS = 64_000
const MAX_SELECTED_INPUT_BYTES = 64 * 1024
const ALLOWED_EXTENSIONS = ['.txt', '.md', '.json', '.csv'] as const

type InputMode = 'paste' | 'file'
type SelectedInputAction = 'summarize' | 'rewrite' | 'classify' | 'extract'
type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number]

interface FilePreviewState {
  name: string
  size: number
  extension: AllowedExtension
  text: string
}

interface SelectedInputPanelProps {
  apiBase: string
  selectedProviderId: string
  selectedProviderModel?: string
  selectedProviderName?: string
  onResult: (result: ResultPreviewState) => void
}

interface PanelStatus {
  type: 'info' | 'error' | 'success'
  message: string
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

function buildSavePayload(params: {
  messages: ReturnType<typeof useAppPreferences>['messages']
  language: ReturnType<typeof useAppPreferences>['language']
  action: string
  inputMode: InputMode
  fileState: FilePreviewState | null
  provider: string
  model: string
  content: string
  textLength: number
}): WorkspaceResultDraft {
  const actionLabel = params.messages.selectedInput.actions[params.action as keyof typeof params.messages.selectedInput.actions] || params.action
  const sourceLabel = params.inputMode === 'file'
    ? params.fileState?.name || params.messages.selectedInput.fileSourceLabel
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
  const metadata = {
    input_type: params.inputMode,
    action: params.action,
    file_name: params.fileState?.name || null,
    file_extension: params.fileState?.extension || null,
    file_size: params.fileState?.size || null,
    character_count: params.textLength,
  }
  return {
    ...base,
    source: params.inputMode === 'file' ? 'selected_file' : 'selected_text',
    metadata,
  }
}

function SelectedInputPanel({ apiBase, selectedProviderId, selectedProviderModel = '', selectedProviderName, onResult }: SelectedInputPanelProps) {
  const { messages, language, locale, formatNumber } = useAppPreferences()
  const [inputMode, setInputMode] = useState<InputMode>('paste')
  const [pastedText, setPastedText] = useState('')
  const [selectedAction, setSelectedAction] = useState<SelectedInputAction>('summarize')
  const [fileState, setFileState] = useState<FilePreviewState | null>(null)
  const [status, setStatus] = useState<PanelStatus | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const currentText = inputMode === 'file' ? fileState?.text || '' : pastedText
  const currentLength = currentText.length
  const isOverCharLimit = currentLength > MAX_SELECTED_INPUT_CHARS

  const actions = useMemo<Array<{ value: SelectedInputAction; label: string; description: string }>>(() => ([
    { value: 'summarize', label: messages.selectedInput.actions.summarize, description: messages.selectedInput.actionsDescription.summarize },
    { value: 'rewrite', label: messages.selectedInput.actions.rewrite, description: messages.selectedInput.actionsDescription.rewrite },
    { value: 'classify', label: messages.selectedInput.actions.classify, description: messages.selectedInput.actionsDescription.classify },
    { value: 'extract', label: messages.selectedInput.actions.extract, description: messages.selectedInput.actionsDescription.extract },
  ]), [messages.selectedInput.actions, messages.selectedInput.actionsDescription])

  const activeActionMeta = useMemo(() => actions.find((item) => item.value === selectedAction), [actions, selectedAction])

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    const extension = `.${(file.name.split('.').pop() || '').toLowerCase()}` as AllowedExtension
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setFileState(null)
      setStatus({ type: 'error', message: messages.selectedInput.errors.unsupportedExtension })
      return
    }

    if (file.size > MAX_SELECTED_INPUT_BYTES) {
      setFileState(null)
      setStatus({ type: 'error', message: messages.selectedInput.errors.fileTooLarge })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setFileState({ name: file.name, size: file.size, extension, text })
      setInputMode('file')
      setStatus(null)
    }
    reader.onerror = () => {
      setFileState(null)
      setStatus({ type: 'error', message: messages.selectedInput.errors.readFailed })
    }
    reader.readAsText(file)
  }

  const clearFile = () => {
    setFileState(null)
    setInputMode('paste')
    setStatus(null)
  }

  const buildResultMeta = (actionLabel: string): string => {
    const parts: string[] = []
    parts.push(`${messages.selectedInput.metaAction}: ${actionLabel}`)
    if (inputMode === 'file') {
      parts.push(`${messages.selectedInput.metaSource}: ${fileState?.name || messages.selectedInput.fileSourceLabel}`)
      if (fileState?.size) {
        parts.push(`${messages.selectedInput.metaSize}: ${formatBytes(fileState.size, locale)}`)
      }
    } else {
      parts.push(`${messages.selectedInput.metaSource}: ${messages.selectedInput.pasteSourceLabel}`)
    }
    return parts.join(' · ')
  }

  const runSelectedInput = async () => {
    const textPayload = currentText.trim()
    if (!textPayload) {
      setStatus({ type: 'error', message: inputMode === 'file' ? messages.selectedInput.errors.emptyFileText : messages.selectedInput.errors.emptyPaste })
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
          file_name: fileState?.name,
          file_extension: fileState?.extension,
          file_size: fileState?.size,
          provider: selectedProviderId,
          model: selectedProviderModel || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || messages.selectedInput.errors.generic)
      }

      const actionLabel = activeActionMeta?.label || selectedAction
      const outputText = data.output_text || messages.selectedInput.noOutput
      const provider = data.provider || selectedProviderId
      const model = data.model || selectedProviderModel || ''
      const meta = buildResultMeta(actionLabel)

      const resultPayload: ResultPreviewState = {
        title: `${messages.selectedInput.resultTitle} - ${actionLabel}`,
        body: outputText,
        provider,
        model,
        warnings: data.warnings || [],
        status: data.status || 'ok',
        meta,
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
      }
      onResult(resultPayload)
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

  return (
    <div className="card selected-input-card">
      <div className="selected-input-header">
        <div>
          <h4 className="card-title">{messages.selectedInput.title}</h4>
          <p className="card-description">{messages.selectedInput.description}</p>
        </div>
        <div className="selected-input-provider-meta">
          <span className="context-label">{messages.selectedInput.providerLabel}</span>
          <span className="context-value">
            {selectedProviderName || selectedProviderId}
          </span>
        </div>
      </div>

      <div className="selected-input-tabs">
        <button
          type="button"
          className={`selected-input-tab ${inputMode === 'paste' ? 'active' : ''}`}
          onClick={() => setInputMode('paste')}
        >
          {messages.selectedInput.pasteTab}
        </button>
        <button
          type="button"
          className={`selected-input-tab ${inputMode === 'file' ? 'active' : ''}`}
          onClick={() => setInputMode('file')}
        >
          {messages.selectedInput.fileTab}
        </button>
      </div>

      {inputMode === 'paste' ? (
        <div className="selected-input-field">
          <label className="ai-field">
            <span className="ai-label">{messages.selectedInput.pasteLabel}</span>
            <textarea
              className="ai-textarea plaintext"
              rows={6}
              value={pastedText}
              placeholder={messages.selectedInput.pastePlaceholder}
              onChange={(event) => setPastedText(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <div className="selected-input-file-panel">
          <div className="selected-input-file-actions">
            <button className="btn btn-secondary" type="button" onClick={handleFileSelect}>
              {messages.selectedInput.selectFile}
            </button>
            {fileState ? (
              <button className="btn btn-ghost" type="button" onClick={clearFile}>
                {messages.selectedInput.clearFile}
              </button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={handleFileChange}
            hidden
          />
          {fileState ? (
            <div className="selected-input-file-meta">
              <div>
                <span className="context-label">{messages.selectedInput.fileMetaName}</span>
                <span className="context-value plaintext">{fileState.name}</span>
              </div>
              <div>
                <span className="context-label">{messages.selectedInput.fileMetaExt}</span>
                <span className="context-value ltr-code">{fileState.extension}</span>
              </div>
              <div>
                <span className="context-label">{messages.selectedInput.fileMetaSize}</span>
                <span className="context-value ltr-code">{formatBytes(fileState.size, locale)}</span>
              </div>
            </div>
          ) : (
            <p className="card-description">{messages.selectedInput.allowedExtensions}</p>
          )}
          {fileState ? (
            <div className="selected-input-preview-box plaintext">
              {fileState.text || messages.selectedInput.previewPlaceholder}
            </div>
          ) : null}
        </div>
      )}

      <div className="selected-input-counter-row">
        <span className={`selected-input-count ${isOverCharLimit ? 'warning' : ''}`}>
          {messages.selectedInput.charCount.replace('{count}', formatNumber(currentLength))}
        </span>
        <span className="selected-input-limit">{messages.selectedInput.charLimit}</span>
      </div>
      {isOverCharLimit ? (
        <p className="selected-input-warning">{messages.selectedInput.charLimitWarning}</p>
      ) : null}

      <div className="selected-input-actions">
        <span className="ai-label">{messages.selectedInput.actionLabel}</span>
        <div className="selected-input-action-grid">
          {actions.map((action) => (
            <label key={action.value} className={`selected-input-action ${selectedAction === action.value ? 'active' : ''}`}>
              <input
                type="radio"
                name="selected-input-action"
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
      </div>

      <div className="selected-input-run-row">
        <button className="btn btn-primary" type="button" onClick={runSelectedInput} disabled={isRunning}>
          {isRunning ? messages.selectedInput.running : messages.selectedInput.run}
        </button>
        <span className="card-description selected-input-run-hint">{messages.selectedInput.runHint}</span>
      </div>

      {status ? <div className={`selected-input-status selected-input-status-${status.type}`}>{status.message}</div> : null}
    </div>
  )
}

export default SelectedInputPanel
