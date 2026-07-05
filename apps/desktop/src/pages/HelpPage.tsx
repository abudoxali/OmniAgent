import ManualVerificationChecklist from '../components/ManualVerificationChecklist'
import { useAppPreferences } from '../i18n'

function HelpPage() {
  const { messages } = useAppPreferences()

  return (
    <div className="page help-page">
      <div className="page-header">
        <div className="home-badge-row">
          <span className="preview-only-badge">{messages.shell.helpSubtitle}</span>
          <span className="preview-only-badge terminal-badge">read-only://guide</span>
        </div>
        <h2 className="page-title">{messages.help.title}</h2>
        <p className="page-subtitle">{messages.help.subtitle}</p>
      </div>

      <section className="section">
        <div className="card help-page-hero">
          <div>
            <h3 className="card-title">Help / Quick Guide</h3>
            <p className="card-description">
              استخدم الصفحة دي كمرجع يومي داخل التطبيق: startup, provider troubleshooting, Services explanation, و manual QA items.
            </p>
          </div>
          <div className="help-page-hero-chips">
            <span className="status-badge status-connected">Local-first</span>
            <span className="status-badge status-warning">Manual provider setup</span>
            <span className="status-badge status-not-configured">No auto actions</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="help-page-grid">
          <section className="card help-section-card">
            <h3 className="card-title">{messages.help.firstRunTitle}</h3>
            <ul className="help-bullet-list">
              {messages.help.firstRunItems.map((item) => (
                <li key={item} className="plaintext">{item}</li>
              ))}
            </ul>
          </section>

          <section className="card help-section-card">
            <h3 className="card-title">{messages.help.providerTitle}</h3>
            <ul className="help-bullet-list">
              {messages.help.providerItems.map((item) => (
                <li key={item} className="plaintext">{item}</li>
              ))}
            </ul>
          </section>

          <section className="card help-section-card">
            <h3 className="card-title">{messages.help.servicesTitle}</h3>
            <ul className="help-bullet-list">
              {messages.help.servicesItems.map((item) => (
                <li key={item} className="plaintext">{item}</li>
              ))}
            </ul>
          </section>

          <section className="card help-section-card">
            <h3 className="card-title">{messages.help.releaseTitle}</h3>
            <ul className="help-bullet-list">
              {messages.help.releaseItems.map((item) => (
                <li key={item} className="plaintext">{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <section className="section">
        <ManualVerificationChecklist />
      </section>

      <section className="section">
        <div className="help-page-grid help-page-grid-bottom">
          <section className="card help-section-card">
            <h3 className="card-title">{messages.help.manualTitle}</h3>
            <p className="card-description">{messages.help.manualDescription}</p>
            <ul className="help-bullet-list">
              {messages.manualChecklist.items.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          </section>

          <section className="card help-section-card">
            <h3 className="card-title">{messages.help.safetyTitle}</h3>
            <ul className="help-bullet-list">
              {messages.help.safetyItems.map((item) => (
                <li key={item} className="plaintext">{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  )
}

export default HelpPage
