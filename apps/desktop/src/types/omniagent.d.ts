export { }

export interface DiagnosticsChecklistItem {
  id: string
  label_key: string
  status: 'pass' | 'fail' | 'warn'
}

export interface DiagnosticsHistoryEvent {
  provider: string
  provider_label?: string
  diagnostic_status: string
  success: boolean
  message?: string
  latency_ms?: number
  tested_at?: string
}

export interface OverlayTargetContext {
  active_window_title?: string
  active_process_name?: string
  active_process_id?: number
  capture_status?: { active_window: string }
  timestamp?: string
  warnings?: string[]
  capture_failed?: boolean
  capture_error?: string
}

export interface BackendRuntimeStatus {
  mode: 'bundled' | 'external'
  state: 'checking' | 'starting' | 'connected' | 'disconnected' | 'failed'
  managed: boolean
  message: string
  details?: string
}

declare global {
  interface Window {
    omniAgent?: {
      getVersion?: () => Promise<string>
      getOverlayTargetContext?: () => Promise<OverlayTargetContext | null>
      getBackendRuntimeStatus?: () => Promise<BackendRuntimeStatus | null>
      onShortcutTriggered?: (callback: () => void) => (() => void) | void
      onShowOverlay?: (callback: () => void) => (() => void) | void
      onOverlayTargetContext?: (callback: (context: OverlayTargetContext | null) => void) => (() => void) | void
      onBackendRuntimeStatus?: (callback: (status: BackendRuntimeStatus | null) => void) => (() => void) | void
      hideOverlay?: () => Promise<void>
    }
  }
}
