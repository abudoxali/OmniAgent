import type { WorkspaceResultDraft } from '../components/ActionButtons'
import { API_BASE } from './api'

export type WorkspaceItemType = 'note' | 'task' | 'result'
export type WorkspaceTab = 'all' | WorkspaceItemType

export interface WorkspaceItem {
  id: number
  item_type: WorkspaceItemType
  title: string
  content: string
  content_preview: string
  is_pinned: boolean
  is_archived: boolean
  is_completed: boolean
  source?: string | null
  provider?: string | null
  model?: string | null
  mode?: string | null
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export async function saveWorkspaceResult(payload: WorkspaceResultDraft): Promise<WorkspaceItem> {
  const response = await fetch(`${API_BASE}/workspace/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.detail || 'تعذر حفظ النتيجة محليًا.')
  }
  return data
}
