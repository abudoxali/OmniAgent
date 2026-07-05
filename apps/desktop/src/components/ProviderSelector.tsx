import { translateProviderLabel, translateStatus, useAppPreferences } from '../i18n'
import ProviderGuidancePanel, { type ProviderGuidance } from './ProviderGuidancePanel'

export interface ProviderInfo {
  id: string
  label: string
  display_name?: string
  display_name_ar?: string
  status: string
  diagnostic_status: string
  diagnostic_message?: string
  diagnostic_action?: string
  configured: boolean
  enabled: boolean
  base_url: string
  selected_model: string
  health_status: string
  warnings: string[]
  models: string[]
  discovered_models?: string[]
  is_active: boolean
  api_key_env?: string | null
  api_key_configured?: boolean | null
  last_test_at?: string | null
  last_test_success?: boolean | null
  last_test_status?: string | null
  last_test_message?: string | null
  last_test_latency_ms?: number | null
  guidance?: ProviderGuidance | null
}

interface ProviderSelectorProps {
  providers: ProviderInfo[]
  selectedProviderId: string
  isLoading?: boolean
  onSelect: (providerId: string) => void
}

function isNoActionMessage(value?: string | null) {
  if (!value) {
    return true
  }
  const normalized = value.trim().toLowerCase()
  return normalized === 'لا يوجد إجراء مطلوب الآن.' || normalized === 'no action needed right now.'
}

function ProviderSelector({ providers, selectedProviderId, isLoading = false, onSelect }: ProviderSelectorProps) {
  const { messages, language, formatDateTime } = useAppPreferences()

  if (isLoading) {
    return (
      <div className="card provider-card">
        <div className="provider-info">
          <h4 className="provider-name">{messages.provider.loadingTitle}</h4>
          <p className="provider-description provider-description-static">{messages.provider.loadingDescription}</p>
        </div>
      </div>
    )
  }

  if (providers.length === 0) {
    return (
      <div className="card provider-card">
        <div className="provider-info">
          <h4 className="provider-name">{messages.provider.emptyTitle}</h4>
          <p className="provider-description provider-description-static">{messages.provider.emptyDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="provider-grid">
      {providers.map((provider) => {
        const lastTestTimeLabel = provider.last_test_at ? formatDateTime(provider.last_test_at) : null
        const lastTestStatusClass = provider.last_test_success === undefined || provider.last_test_success === null
          ? 'unknown'
          : provider.last_test_success
            ? 'success'
            : 'error'
        const lastTestStatusLabel = provider.last_test_success === undefined || provider.last_test_success === null
          ? messages.settings.noTestResult
          : provider.last_test_success
            ? messages.settings.lastTestSuccess
            : messages.settings.lastTestFailed

        return (
          <button
            key={provider.id}
            className={`card provider-card provider-button ${selectedProviderId === provider.id ? 'provider-selected' : ''}`}
            onClick={() => onSelect(provider.id)}
            type="button"
          >
            <div className="provider-info">
              <h4 className="provider-name">
                {language === 'ar'
                  ? provider.display_name_ar || provider.display_name || translateProviderLabel(provider.label, language)
                  : provider.display_name || provider.display_name_ar || translateProviderLabel(provider.label, language)}
              </h4>
              <div className="provider-meta-grid">
                <p className="provider-description">
                  <span>{messages.provider.model}</span>
                  <span className={provider.selected_model ? 'ltr-code' : undefined}>
                    {provider.selected_model || translateStatus('unconfigured', language)}
                  </span>
                </p>
                <p className="provider-description">
                  <span>{messages.provider.endpoint}</span>
                  <span className="ltr-code">{provider.base_url || '-'}</span>
                </p>
                <p className="provider-description">
                  <span>{messages.provider.health}</span>
                  <span>{translateStatus(provider.diagnostic_status || provider.health_status, language)}</span>
                  {provider.is_active ? <span className="provider-active-badge">{messages.provider.activeDefault}</span> : null}
                </p>
                <div className="provider-description provider-discovered-models">
                  <span>{messages.provider.discoveredModels}</span>
                  <div className="provider-model-list">
                    {(provider.discovered_models || provider.models).length > 0 ? (
                      (provider.discovered_models || provider.models).map((model) => (
                        <span key={model} className="provider-model-chip ltr-code">{model}</span>
                      ))
                    ) : (
                      <span>{messages.provider.noModels}</span>
                    )}
                  </div>
                </div>
              </div>
              {(provider.diagnostic_message || provider.diagnostic_action || provider.warnings.length > 0) && (
                <div className="provider-guidance-block">
                  {provider.diagnostic_message ? (
                    <p className="plaintext provider-guidance-message">{provider.diagnostic_message}</p>
                  ) : null}
                  {provider.diagnostic_action && !isNoActionMessage(provider.diagnostic_action) ? (
                    <p className="provider-guidance-action">
                      <span>{messages.provider.nextStep}</span>
                      <span>{provider.diagnostic_action}</span>
                    </p>
                  ) : null}
                  {provider.warnings.length > 0 ? (
                    <ul className="provider-warning-list">
                      {provider.warnings.map((warning) => (
                        <li key={warning} className="plaintext">{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
              <div className="provider-last-test-block">
                <div className="provider-last-test-row">
                  <span>{messages.settings.lastTestResult}</span>
                  <span className={`provider-last-test-status provider-last-test-status-${lastTestStatusClass}`}>{lastTestStatusLabel}</span>
                </div>
                <p className="provider-last-test-message plaintext">{provider.last_test_message || messages.settings.noTestResult}</p>
                {(lastTestTimeLabel || typeof provider.last_test_latency_ms === 'number') ? (
                  <div className="provider-last-test-meta">
                    {lastTestTimeLabel ? (
                      <span>
                        {messages.settings.lastTestedAt}: <span className="ltr-code">{lastTestTimeLabel}</span>
                      </span>
                    ) : null}
                    {typeof provider.last_test_latency_ms === 'number' ? (
                      <span>
                        {messages.settings.latency}: <span className="ltr-code">{provider.last_test_latency_ms} ms</span>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <ProviderGuidancePanel guidance={provider.guidance} />
            </div>
            <span className={`status-badge status-${provider.diagnostic_status === 'online' ? 'connected' : provider.diagnostic_status === 'missing_server' || provider.diagnostic_status === 'offline' ? 'error' : provider.diagnostic_status === 'bad_model' || provider.diagnostic_status === 'no_model_loaded' ? 'warning' : 'not-configured'}`}>
              {translateStatus(provider.diagnostic_status || provider.status, language)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default ProviderSelector
