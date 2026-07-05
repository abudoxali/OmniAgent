import { useEffect, useMemo, useState } from 'react'
import { useAppPreferences } from '../i18n'

const STORAGE_KEY = 'manual_gui_verification_checklist_v1'

type ChecklistState = Record<string, boolean>

function ManualVerificationChecklist() {
  const { messages } = useAppPreferences()
  const [checkedMap, setCheckedMap] = useState<ChecklistState>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw) as ChecklistState
      setCheckedMap(parsed)
    } catch {
      setCheckedMap({})
    }
  }, [])

  const completedCount = useMemo(
    () => messages.manualChecklist.items.filter((item) => checkedMap[item.id]).length,
    [checkedMap, messages.manualChecklist.items],
  )

  const handleToggle = (itemId: string) => {
    setCheckedMap((current) => {
      const next = {
        ...current,
        [itemId]: !current[itemId],
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }

  const handleReset = () => {
    setCheckedMap({})
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore storage failures
    }
  }

  return (
    <div className="card help-checklist-card">
      <div className="help-section-header">
        <div>
          <h3 className="card-title">{messages.manualChecklist.title}</h3>
          <p className="card-description">{messages.manualChecklist.description}</p>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={handleReset}>
          {messages.manualChecklist.reset}
        </button>
      </div>
      <div className="help-checklist-summary">
        <span className="status-badge status-warning">
          {messages.manualChecklist.pendingBadge}: {messages.manualChecklist.items.length - completedCount}
        </span>
        <span className="status-badge status-connected">
          {messages.manualChecklist.doneBadge}: {completedCount}
        </span>
      </div>
      <div className="help-checklist-list">
        {messages.manualChecklist.items.map((item) => (
          <label key={item.id} className={`help-checklist-item ${checkedMap[item.id] ? 'checked' : ''}`}>
            <input
              type="checkbox"
              checked={Boolean(checkedMap[item.id])}
              onChange={() => handleToggle(item.id)}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
      <p className="card-description">{messages.manualChecklist.note}</p>
    </div>
  )
}

export default ManualVerificationChecklist
