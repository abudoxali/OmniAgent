import { useAppPreferences } from '../i18n'

export interface ProviderGuidance {
  title?: string
  steps?: string[]
  command_hint?: string
  severity?: 'info' | 'warning' | 'error'
  provider?: string
}

interface ProviderGuidancePanelProps {
  guidance?: ProviderGuidance | null
  variant?: 'default' | 'compact'
  className?: string
}

function ProviderGuidancePanel({ guidance, variant = 'default', className }: ProviderGuidancePanelProps) {
  const { messages } = useAppPreferences()

  if (!guidance) {
    return null
  }

  const severityClass = guidance.severity || 'info'
  const panelClasses = [
    'provider-guidance-panel',
    `provider-guidance-panel-${severityClass}`,
    variant === 'compact' ? 'provider-guidance-panel-compact' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={panelClasses}>
      {guidance.title ? <h5 className="provider-guidance-panel-title">{guidance.title}</h5> : null}
      {guidance.steps && guidance.steps.length > 0 ? (
        <ol className="provider-guidance-steps">
          {guidance.steps.map((step) => (
            <li key={step} className="plaintext">{step}</li>
          ))}
        </ol>
      ) : null}
      {guidance.command_hint ? (
        <div className="provider-guidance-command ltr-code">
          {messages.provider.commandHintLabel}: {guidance.command_hint}
        </div>
      ) : null}
    </div>
  )
}

export default ProviderGuidancePanel
