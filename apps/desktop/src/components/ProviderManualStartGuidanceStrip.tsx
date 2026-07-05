import { useEffect, useMemo, useState } from 'react'
import { useAppPreferences } from '../i18n'
import type { ProviderInfo } from './ProviderSelector'

const PROVIDER_MANUAL_START_STORAGE_PREFIX = 'provider_manual_start_guidance_dismissed_v1'

interface ProviderManualStartGuidanceStripProps {
  provider?: ProviderInfo | null
  variant?: 'default' | 'compact'
  className?: string
}

interface ProviderManualStartContent {
  storageKey: string
  severity: 'warning' | 'error'
  badge: string
  title: string
  summary: string
  items: string[]
  commandExample?: string
  safetyNote: string
}

function buildStorageKey(providerId: string, statusKey: string, selectedModel: string): string {
  return `${PROVIDER_MANUAL_START_STORAGE_PREFIX}:${providerId}:${statusKey}:${selectedModel || 'none'}`
}

function getProviderManualStartContent(
  strings: ReturnType<typeof useAppPreferences>['messages'],
  provider?: ProviderInfo | null,
): ProviderManualStartContent | null {
  if (!provider) {
    return null
  }

  const providerId = provider.id
  if (providerId !== 'lmstudio' && providerId !== 'ollama') {
    return null
  }

  const statusKey = provider.diagnostic_status || provider.status || provider.health_status || 'unknown'
  const selectedModel = provider.selected_model?.trim() || ''
  const isHealthy = ['online', 'healthy', 'ok'].includes(statusKey)

  if (providerId === 'lmstudio') {
    const shouldShow = !isHealthy || !selectedModel || statusKey === 'unknown' || statusKey === 'unconfigured' || statusKey === 'partial'
    if (!shouldShow) {
      return null
    }

    return {
      storageKey: buildStorageKey(providerId, statusKey, selectedModel),
      severity: statusKey === 'missing_server' || statusKey === 'offline' || statusKey === 'error' || statusKey === 'timeout' ? 'error' : 'warning',
      badge: strings.manualStartStrip.lmstudioBadge,
      title: strings.manualStartStrip.lmstudioTitle,
      summary: strings.manualStartStrip.lmstudioSummary,
      items: [
        strings.manualStartStrip.lmstudioStep1,
        strings.manualStartStrip.lmstudioStep2,
        strings.manualStartStrip.lmstudioStep3,
      ],
      safetyNote: strings.manualStartStrip.safetyNote,
    }
  }

  const shouldShow = !isHealthy
    || !selectedModel
    || statusKey === 'no_model_loaded'
    || statusKey === 'bad_model'
    || statusKey === 'unconfigured'
    || statusKey === 'unknown'
    || statusKey === 'partial'

  if (!shouldShow) {
    return null
  }

  return {
    storageKey: buildStorageKey(providerId, statusKey, selectedModel),
    severity: statusKey === 'offline' || statusKey === 'error' || statusKey === 'timeout' ? 'error' : 'warning',
    badge: strings.manualStartStrip.ollamaBadge,
    title: strings.manualStartStrip.ollamaTitle,
    summary: strings.manualStartStrip.ollamaSummary,
    items: [
      strings.manualStartStrip.ollamaStep1,
      strings.manualStartStrip.ollamaStep2,
      strings.manualStartStrip.ollamaStep3,
    ],
    commandExample: strings.manualStartStrip.ollamaCommandExample,
    safetyNote: strings.manualStartStrip.safetyNote,
  }
}

function ProviderManualStartGuidanceStrip({
  provider,
  variant = 'default',
  className,
}: ProviderManualStartGuidanceStripProps) {
  const { messages } = useAppPreferences()
  const content = useMemo(() => getProviderManualStartContent(messages, provider), [messages, provider])
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    if (!content) {
      setIsDismissed(false)
      return
    }

    try {
      setIsDismissed(localStorage.getItem(content.storageKey) === 'dismissed')
    } catch {
      setIsDismissed(false)
    }
  }, [content])

  if (!content || isDismissed) {
    return null
  }

  const stripClasses = [
    'provider-manual-start-strip',
    `provider-manual-start-strip-${content.severity}`,
    variant === 'compact' ? 'provider-manual-start-strip-compact' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleDismiss = () => {
    try {
      localStorage.setItem(content.storageKey, 'dismissed')
    } catch {
      // ignore storage failures
    }
    setIsDismissed(true)
  }

  return (
    <div className={stripClasses}>
      <div className="provider-manual-start-strip-header">
        <div>
          <span className="provider-manual-start-strip-badge">{content.badge}</span>
          <h4 className="provider-manual-start-strip-title">{content.title}</h4>
        </div>
        <button className="btn btn-ghost btn-sm provider-manual-start-dismiss" type="button" onClick={handleDismiss}>
          {messages.manualStartStrip.dismissLabel}
        </button>
      </div>
      <p className="provider-manual-start-strip-summary plaintext">{content.summary}</p>
      <ul className="provider-manual-start-strip-list">
        {content.items.map((item) => (
          <li key={item} className="plaintext">{item}</li>
        ))}
      </ul>
      {content.commandExample ? (
        <div className="provider-manual-start-strip-command">
          <span>{messages.manualStartStrip.commandLabel}</span>
          <span className="ltr-code">{content.commandExample}</span>
        </div>
      ) : null}
      <p className="provider-manual-start-strip-note plaintext">{content.safetyNote}</p>
    </div>
  )
}

export default ProviderManualStartGuidanceStrip
