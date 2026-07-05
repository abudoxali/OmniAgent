import { Link } from 'react-router-dom'
import { useAppPreferences } from '../i18n'

interface CommandCenterCardsProps {
  backendHealthy: boolean
  providerReady: boolean
  overlayPending?: boolean
  className?: string
}

function CommandCenterCards({
  backendHealthy,
  providerReady,
  overlayPending = true,
  className,
}: CommandCenterCardsProps) {
  const { messages } = useAppPreferences()

  const cards = [
    {
      id: 'backend',
      title: messages.commandCenter.backendTitle,
      status: backendHealthy ? messages.commandCenter.backendHealthy : messages.commandCenter.backendOffline,
      tone: backendHealthy ? 'success' : 'error',
      linkTo: '/services',
      linkLabel: messages.commandCenter.openServices,
    },
    {
      id: 'provider',
      title: messages.commandCenter.providerTitle,
      status: providerReady ? messages.commandCenter.providerReady : messages.commandCenter.providerAttention,
      tone: providerReady ? 'success' : 'warning',
      linkTo: '/settings',
      linkLabel: messages.commandCenter.openSettings,
    },
    {
      id: 'overlay',
      title: messages.commandCenter.overlayTitle,
      status: overlayPending ? messages.commandCenter.overlayPending : messages.commandCenter.overlayReady,
      tone: overlayPending ? 'warning' : 'success',
      linkTo: '/services',
      linkLabel: messages.commandCenter.openServices,
    },
    {
      id: 'workspace',
      title: messages.commandCenter.workspaceTitle,
      status: messages.commandCenter.workspaceLocal,
      tone: 'info',
      linkTo: '/workspace',
      linkLabel: messages.commandCenter.openWorkspace,
    },
    {
      id: 'safety',
      title: messages.commandCenter.safetyTitle,
      status: messages.commandCenter.safetyProtected,
      tone: 'info',
      linkTo: '/services',
      linkLabel: messages.commandCenter.openServices,
    },
  ]

  return (
    <section className={`section ${className ?? ''}`.trim()}>
      <div className="section-header section-header-stack">
        <div>
          <h3 className="section-title section-title-no-border">{messages.commandCenter.title}</h3>
          <p className="card-description section-description">{messages.commandCenter.description}</p>
        </div>
      </div>
      <div className="command-center-grid">
        {cards.map((card) => (
          <div key={card.id} className={`card command-center-card command-center-card-${card.tone}`}>
            <div className="command-center-card-head">
              <span className="command-center-card-title">{card.title}</span>
              <span className={`status-badge status-${card.tone === 'success' ? 'connected' : card.tone === 'error' ? 'error' : 'warning'}`}>
                {card.status}
              </span>
            </div>
            <Link className="btn btn-ghost btn-sm command-center-link" to={card.linkTo}>
              {card.linkLabel}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

export default CommandCenterCards
