import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButtons, { type ActionButtonsHandle, type ResultPreviewState } from '../components/ActionButtons'
import ResultPreview from '../components/ResultPreview'
import SafePromptTemplates from '../components/SafePromptTemplates'
import SelectedInputPanel from '../components/SelectedInputPanel'
import { useAppPreferences } from '../i18n'
import { API_BASE } from '../lib/api'
import { saveWorkspaceResult } from '../lib/workspace'

interface ProviderInfo {
  id: string
  status: string
  diagnostic_status?: string
}

function HomePage() {
  const { messages, language } = useAppPreferences()
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string>('ollama')
  const [result, setResult] = useState<ResultPreviewState | null>(null)
  const [isSavingResult, setIsSavingResult] = useState(false)
  const [saveResultMessage, setSaveResultMessage] = useState<string | null>(null)
  const hasInitialized = useRef(false)
  const actionButtonsRef = useRef<ActionButtonsHandle | null>(null)

  const handleResultChange = (nextResult: ResultPreviewState) => {
    setSaveResultMessage(null)
    setResult(nextResult)
  }

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const loadHomeData = async () => {
      try {
        const providerResponse = await fetch(`${API_BASE}/models/providers`)
        if (providerResponse.ok) {
          const providerData = await providerResponse.json()
          setProviders(providerData.providers ?? [])
          if (providerData.active_provider) {
            setSelectedProviderId(providerData.active_provider)
          }
        }
      } catch {
        // ignore errors
      }
    }

    void loadHomeData()
  }, [])

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId)
  const isProviderReady = selectedProvider?.diagnostic_status === 'online'

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
      <div className="welcome-section" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 className="welcome-title">{messages.home.welcomeIntro} <span className="gradient-text">{messages.brand.shortName}</span></h2>
        {!isProviderReady && (
          <div className="onboarding-steps" style={{ marginTop: '24px', textAlign: 'left', background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '16px' }}>{language === 'ar' ? '٣ خطوات للبدء:' : '3 Steps to Start:'}</h3>
            <ol style={{ paddingLeft: language === 'ar' ? '0' : '20px', paddingRight: language === 'ar' ? '20px' : '0', lineHeight: '1.8' }}>
              <li>{language === 'ar' ? 'افتح برنامج LM Studio.' : 'Open LM Studio.'}</li>
              <li>{language === 'ar' ? 'اذهب إلى الإعدادات لاختبار الاتصال.' : 'Go to Settings to test the AI connection.'}</li>
              <li>{language === 'ar' ? 'اكتب أمرك هنا للبدء!' : 'Type your prompt here to start!'}</li>
            </ol>
            <div style={{ marginTop: '16px' }}>
              <Link to="/settings" className="btn btn-primary">
                {language === 'ar' ? 'الذهاب إلى الإعدادات' : 'Go to Settings'}
              </Link>
            </div>
          </div>
        )}
      </div>

      <section className="section" style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <ActionButtons
          ref={actionButtonsRef}
          apiBase={API_BASE}
          context={null}
          selectedProviderId={selectedProviderId}
          selectedProviderModel={''}
          onResult={handleResultChange}
        />
      </section>

      <SafePromptTemplates onApply={(template) => actionButtonsRef.current?.applyTemplate(template)} />

      <section className="section">
        <SelectedInputPanel
          apiBase={API_BASE}
          selectedProviderId={selectedProviderId}
          selectedProviderModel={''}
          selectedProviderName={''}
          onResult={handleResultChange}
        />
      </section>

      <section className="section">
        <ResultPreview
          result={result}
          onSaveResult={(payload) => void handleSaveResult(payload)}
          isSavingResult={isSavingResult}
          saveResultMessage={saveResultMessage}
        />
      </section>
    </div>
  )
}

export default HomePage

