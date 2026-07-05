import { useEffect, useState } from 'react'
import { useAppPreferences } from '../i18n'

function Overlay() {
  const { messages } = useAppPreferences()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const api = window.omniAgent
    if (!api?.onShortcutTriggered) {
      return
    }

    const unsubscribe = api.onShortcutTriggered(() => {
      setVisible(true)
    })

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setVisible(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      unsubscribe?.()
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="overlay">
      <div className="overlay-content">
        <div className="overlay-header">
          <h2>{messages.overlay.title}</h2>
          <span className="overlay-shortcut ltr-code">Ctrl+Alt+A</span>
        </div>
        <input
          type="text"
          className="overlay-input"
          placeholder={messages.overlay.placeholder}
          autoFocus
        />
        <div className="overlay-hint">{messages.overlay.hint}</div>
      </div>
    </div>
  )
}

export default Overlay
