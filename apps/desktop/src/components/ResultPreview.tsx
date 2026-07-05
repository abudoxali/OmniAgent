import type { ResultPreviewState, WorkspaceResultDraft } from './ActionButtons'
import { translateStatus, useAppPreferences } from '../i18n'

interface ResultPreviewProps {
  result: ResultPreviewState | null
  onSaveResult?: (payload: WorkspaceResultDraft) => void
  isSavingResult?: boolean
  saveResultMessage?: string | null
}

function ResultPreview({ result, onSaveResult, isSavingResult = false, saveResultMessage = null }: ResultPreviewProps) {
  const { messages, language } = useAppPreferences()

  if (!result) {
    return (
      <div className="card result-preview-card">
        <div className="result-empty">
          <div className="result-empty-icon">◌</div>
          <p>{messages.result.emptyBody}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card result-preview-card">
      <div className="result-preview-content">
        <h4 className="card-title">{result.title}</h4>
        <p className="card-description result-body plaintext">{result.body}</p>
        {result.provider || result.model ? (
          <div className="result-summary-grid">
            {result.provider ? (
              <div className="result-meta">
                <span>{messages.result.provider}</span>
                <span className="ltr-code">{result.provider}</span>
              </div>
            ) : null}
            {result.model ? (
              <div className="result-meta">
                <span>{messages.result.model}</span>
                <span className="ltr-code">{result.model}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        {result.meta ? <div className="result-meta plaintext">{result.meta}</div> : null}
        {result.status ? <div className="result-meta"><span>{messages.result.status}</span><span>{translateStatus(result.status, language)}</span></div> : null}
        {result.savePayload && onSaveResult ? (
          <div className="result-action-row">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => onSaveResult(result.savePayload!)}
              disabled={isSavingResult}
            >
              {isSavingResult ? messages.result.saving : messages.result.save}
            </button>
            {saveResultMessage ? <span className="result-save-message plaintext">{saveResultMessage}</span> : null}
          </div>
        ) : null}
        {result.warnings && result.warnings.length > 0 ? (
          <ul className="result-warning-list">
            {result.warnings.map((warning) => (
              <li key={warning} className="plaintext">{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

export default ResultPreview
