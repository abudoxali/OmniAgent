import { useAppPreferences } from '../i18n'

interface SafePromptTemplatesProps {
  onApply: (template: { instruction: string; mode: string }) => void
  className?: string
}

function SafePromptTemplates({ onApply, className }: SafePromptTemplatesProps) {
  const { messages } = useAppPreferences()

  return (
    <section className={`section ${className ?? ''}`.trim()}>
      <div className="section-header section-header-stack">
        <div>
          <h3 className="section-title section-title-no-border">{messages.promptTemplates.title}</h3>
          <p className="card-description section-description">{messages.promptTemplates.description}</p>
        </div>
      </div>
      <div className="template-grid">
        {messages.promptTemplates.templates.map((template) => (
          <div key={template.id} className="card template-card">
            <div>
              <h4 className="card-title">{template.title}</h4>
              <p className="card-description plaintext">{template.instruction}</p>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => onApply({ instruction: template.instruction, mode: template.mode })}
            >
              {messages.promptTemplates.apply}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default SafePromptTemplates
