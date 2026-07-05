import { translateStatus, useAppPreferences } from '../i18n'
import type { ProviderInfo } from './ProviderSelector'

type MatrixTone = 'info' | 'warning' | 'error' | 'success'

interface MatrixScenario {
  id: string
  matchStatuses: string[]
  title: string
  summary: string
  steps: readonly string[]
  tone: MatrixTone
}

interface ProviderReadinessMatrixProps {
  provider?: ProviderInfo | null
}

function createScenario(
  id: string,
  matchStatuses: string[],
  title: string,
  summary: string,
  steps: readonly string[],
  tone: MatrixTone,
): MatrixScenario {
  return {
    id,
    matchStatuses,
    title,
    summary,
    steps,
    tone,
  }
}

function getMatrixScenarios(providerId: string, strings: ReturnType<typeof useAppPreferences>['messages']): MatrixScenario[] {
  if (providerId === 'lmstudio') {
    return [
      createScenario(
        'lmstudio_server',
        ['missing_server', 'offline', 'error', 'timeout'],
        strings.settings.readinessMatrix.scenarios.lmstudioServer.title,
        strings.settings.readinessMatrix.scenarios.lmstudioServer.summary,
        strings.settings.readinessMatrix.scenarios.lmstudioServer.steps,
        'error',
      ),
      createScenario(
        'lmstudio_no_model',
        ['no_model_loaded'],
        strings.settings.readinessMatrix.scenarios.lmstudioNoModel.title,
        strings.settings.readinessMatrix.scenarios.lmstudioNoModel.summary,
        strings.settings.readinessMatrix.scenarios.lmstudioNoModel.steps,
        'warning',
      ),
      createScenario(
        'lmstudio_bad_model',
        ['bad_model'],
        strings.settings.readinessMatrix.scenarios.lmstudioBadModel.title,
        strings.settings.readinessMatrix.scenarios.lmstudioBadModel.summary,
        strings.settings.readinessMatrix.scenarios.lmstudioBadModel.steps,
        'warning',
      ),
      createScenario(
        'lmstudio_ready',
        ['online', 'healthy', 'ok'],
        strings.settings.readinessMatrix.scenarios.providerReady.title,
        strings.settings.readinessMatrix.scenarios.providerReady.summary,
        strings.settings.readinessMatrix.scenarios.providerReady.steps,
        'success',
      ),
      createScenario(
        'lmstudio_unknown',
        ['unknown', 'unconfigured', 'partial'],
        strings.settings.readinessMatrix.scenarios.providerUnknown.title,
        strings.settings.readinessMatrix.scenarios.providerUnknown.summary,
        strings.settings.readinessMatrix.scenarios.providerUnknown.steps,
        'info',
      ),
    ]
  }

  if (providerId === 'ollama') {
    return [
      createScenario(
        'ollama_server',
        ['missing_server', 'offline', 'error', 'timeout'],
        strings.settings.readinessMatrix.scenarios.ollamaServer.title,
        strings.settings.readinessMatrix.scenarios.ollamaServer.summary,
        strings.settings.readinessMatrix.scenarios.ollamaServer.steps,
        'error',
      ),
      createScenario(
        'ollama_no_model',
        ['no_model_loaded'],
        strings.settings.readinessMatrix.scenarios.ollamaNoModel.title,
        strings.settings.readinessMatrix.scenarios.ollamaNoModel.summary,
        strings.settings.readinessMatrix.scenarios.ollamaNoModel.steps,
        'warning',
      ),
      createScenario(
        'ollama_bad_model',
        ['bad_model'],
        strings.settings.readinessMatrix.scenarios.ollamaBadModel.title,
        strings.settings.readinessMatrix.scenarios.ollamaBadModel.summary,
        strings.settings.readinessMatrix.scenarios.ollamaBadModel.steps,
        'warning',
      ),
      createScenario(
        'ollama_ready',
        ['online', 'healthy', 'ok'],
        strings.settings.readinessMatrix.scenarios.providerReady.title,
        strings.settings.readinessMatrix.scenarios.providerReady.summary,
        strings.settings.readinessMatrix.scenarios.providerReady.steps,
        'success',
      ),
      createScenario(
        'ollama_unknown',
        ['unknown', 'unconfigured', 'partial'],
        strings.settings.readinessMatrix.scenarios.providerUnknown.title,
        strings.settings.readinessMatrix.scenarios.providerUnknown.summary,
        strings.settings.readinessMatrix.scenarios.providerUnknown.steps,
        'info',
      ),
    ]
  }

  return [
    createScenario(
      'openai_config',
      ['misconfigured', 'unconfigured'],
      strings.settings.readinessMatrix.scenarios.openaiConfig.title,
      strings.settings.readinessMatrix.scenarios.openaiConfig.summary,
      strings.settings.readinessMatrix.scenarios.openaiConfig.steps,
      'warning',
    ),
    createScenario(
      'openai_credentials',
      ['bad_credentials'],
      strings.settings.readinessMatrix.scenarios.openaiCredentials.title,
      strings.settings.readinessMatrix.scenarios.openaiCredentials.summary,
      strings.settings.readinessMatrix.scenarios.openaiCredentials.steps,
      'error',
    ),
    createScenario(
      'openai_server',
      ['missing_server', 'offline', 'error', 'timeout'],
      strings.settings.readinessMatrix.scenarios.openaiServer.title,
      strings.settings.readinessMatrix.scenarios.openaiServer.summary,
      strings.settings.readinessMatrix.scenarios.openaiServer.steps,
      'warning',
    ),
    createScenario(
      'openai_ready',
      ['online', 'healthy', 'ok'],
      strings.settings.readinessMatrix.scenarios.providerReady.title,
      strings.settings.readinessMatrix.scenarios.providerReady.summary,
      strings.settings.readinessMatrix.scenarios.providerReady.steps,
      'success',
    ),
    createScenario(
      'openai_unknown',
      ['unknown', 'partial'],
      strings.settings.readinessMatrix.scenarios.providerUnknown.title,
      strings.settings.readinessMatrix.scenarios.providerUnknown.summary,
      strings.settings.readinessMatrix.scenarios.providerUnknown.steps,
      'info',
    ),
  ]
}

function getCurrentScenario(provider: ProviderInfo, scenarios: MatrixScenario[]): MatrixScenario {
  const statusKey = provider.diagnostic_status || provider.status || provider.health_status || 'unknown'
  return scenarios.find((scenario) => scenario.matchStatuses.includes(statusKey))
    ?? scenarios[scenarios.length - 1]
}

function getScenarioSteps(provider: ProviderInfo, scenario: MatrixScenario, isCurrent: boolean): readonly string[] {
  if (isCurrent && provider.guidance?.steps?.length) {
    return provider.guidance.steps
  }
  return scenario.steps
}

function getScenarioCommand(provider: ProviderInfo, isCurrent: boolean): string | null {
  if (isCurrent && provider.guidance?.command_hint) {
    return provider.guidance.command_hint
  }
  return null
}

function ProviderReadinessMatrix({ provider }: ProviderReadinessMatrixProps) {
  const { messages, language, formatDateTime } = useAppPreferences()

  if (!provider) {
    return null
  }

  const scenarios = getMatrixScenarios(provider.id, messages)
  const currentScenario = getCurrentScenario(provider, scenarios)
  const lastTestLabel = provider.last_test_at
    ? formatDateTime(provider.last_test_at)
    : messages.settings.noTestResult

  return (
    <div className="card settings-provider-span readiness-matrix-card">
      <div className="readiness-matrix-header">
        <div>
          <h3 className="card-title">{messages.settings.readinessMatrix.title}</h3>
          <p className="card-description">{messages.settings.readinessMatrix.description}</p>
        </div>
        <span className={`status-badge status-${currentScenario.tone === 'success' ? 'connected' : currentScenario.tone === 'error' ? 'error' : 'not-configured'}`}>
          {translateStatus(provider.diagnostic_status || provider.status || provider.health_status || 'unknown', language)}
        </span>
      </div>

      <div className="readiness-matrix-summary">
        <div className="readiness-matrix-summary-item">
          <span className="setting-label">{messages.settings.readinessMatrix.providerLabel}</span>
          <span>{language === 'ar' ? provider.display_name_ar || provider.display_name || provider.label : provider.display_name || provider.display_name_ar || provider.label}</span>
        </div>
        <div className="readiness-matrix-summary-item">
          <span className="setting-label">{messages.settings.readinessMatrix.modelLabel}</span>
          <span className={provider.selected_model ? 'ltr-code' : ''}>{provider.selected_model || messages.settings.noModelConfigured}</span>
        </div>
        <div className="readiness-matrix-summary-item">
          <span className="setting-label">{messages.settings.lastTestResult}</span>
          <span className={provider.last_test_at ? 'ltr-code' : ''}>{lastTestLabel}</span>
        </div>
      </div>

      <div className={`readiness-matrix-current readiness-matrix-current-${currentScenario.tone}`}>
        <div className="readiness-matrix-current-header">
          <span className="readiness-matrix-current-badge">{messages.settings.readinessMatrix.currentBadge}</span>
          <h4 className="readiness-matrix-current-title">{currentScenario.title}</h4>
        </div>
        <p className="plaintext readiness-matrix-current-body">
          {provider.diagnostic_message || currentScenario.summary}
        </p>
        {provider.diagnostic_action && provider.diagnostic_action.trim() !== 'لا يوجد إجراء مطلوب الآن.' && provider.diagnostic_action.trim().toLowerCase() !== 'no action needed right now.' ? (
          <p className="plaintext readiness-matrix-current-action">
            {messages.provider.nextStep}: {provider.diagnostic_action}
          </p>
        ) : null}
      </div>

      <div className="readiness-matrix-grid">
        {scenarios.map((scenario) => {
          const isCurrent = scenario.id === currentScenario.id
          const scenarioSteps = getScenarioSteps(provider, scenario, isCurrent)
          const scenarioCommand = getScenarioCommand(provider, isCurrent)

          return (
            <div
              key={scenario.id}
              className={`readiness-matrix-item readiness-matrix-item-${scenario.tone} ${isCurrent ? 'current' : ''}`}
            >
              <div className="readiness-matrix-item-header">
                <h5 className="readiness-matrix-item-title">{scenario.title}</h5>
                <span className={`readiness-matrix-item-badge readiness-matrix-item-badge-${isCurrent ? 'current' : scenario.tone}`}>
                  {isCurrent ? messages.settings.readinessMatrix.currentBadge : messages.settings.readinessMatrix.referenceBadge}
                </span>
              </div>
              <p className="plaintext readiness-matrix-item-summary">{scenario.summary}</p>
              <ol className="readiness-matrix-item-steps">
                {scenarioSteps.map((step) => (
                  <li key={`${scenario.id}-${step}`} className="plaintext">{step}</li>
                ))}
              </ol>
              {scenarioCommand ? (
                <div className="readiness-matrix-item-command ltr-code">
                  {messages.provider.commandHintLabel}: {scenarioCommand}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="card-description readiness-matrix-footer">{messages.settings.readinessMatrix.footerNote}</p>
    </div>
  )
}

export default ProviderReadinessMatrix
