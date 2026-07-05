import { useAppPreferences } from '../i18n'

export const ONBOARDING_CHECKLIST_STORAGE_KEY = 'onboarding_checklist_dismissed_v1'

type ChecklistSection = {
  title: string
  items: readonly string[]
}

interface OnboardingChecklistCardProps {
  variant?: 'full' | 'compact'
  onDismiss?: () => void
  className?: string
}

function OnboardingChecklistCard({ variant = 'full', onDismiss, className }: OnboardingChecklistCardProps) {
  const { messages } = useAppPreferences()
  const checklist = messages.home.onboardingChecklist
  const isCompact = variant === 'compact'
  const sections = (isCompact
    ? checklist.compactSections ?? []
    : checklist.sections ?? []) as ReadonlyArray<ChecklistSection>
  const title = isCompact ? checklist.compactTitle || checklist.title : checklist.title
  const description = isCompact ? checklist.compactDescription || checklist.description : checklist.description
  const notes = isCompact ? checklist.compactNotes ?? checklist.notes : checklist.notes

  return (
    <div className={`card onboarding-checklist-card ${isCompact ? 'compact' : 'full'} ${className ?? ''}`.trim()}>
      <div className="onboarding-card-header">
        <div>
          <span className="onboarding-card-badge">{checklist.badge}</span>
          <h3 className="card-title onboarding-card-title">{title}</h3>
        </div>
        {onDismiss ? (
          <button className="btn btn-ghost btn-sm onboarding-dismiss-btn" type="button" onClick={onDismiss}>
            {checklist.dismissLabel}
          </button>
        ) : null}
      </div>
      {description ? <p className="card-description onboarding-card-description">{description}</p> : null}
      <div className="onboarding-checklist-sections">
        {sections.map((section) => (
          <div key={section.title} className="onboarding-checklist-section">
            <p className="onboarding-section-title">{section.title}</p>
            <ul className="onboarding-section-list">
              {section.items.map((item) => (
                <li key={item} className="plaintext">{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {notes?.length ? (
        <div className="onboarding-checklist-notes">
          <span className="onboarding-notes-title">{checklist.notesTitle}</span>
          <ul className="onboarding-notes-list">
            {notes.map((note) => (
              <li key={note} className="plaintext">{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default OnboardingChecklistCard
