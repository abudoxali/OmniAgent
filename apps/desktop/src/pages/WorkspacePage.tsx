import { useEffect, useMemo, useState } from 'react'
import { useAppPreferences } from '../i18n'
import { API_BASE } from '../lib/api'
import type { WorkspaceItem, WorkspaceItemType, WorkspaceTab } from '../lib/workspace'

type TaskCompletionFilter = 'all' | 'open' | 'done'

async function fetchWorkspace(endpoint: string, loadError: string): Promise<WorkspaceItem[]> {
  const response = await fetch(`${API_BASE}${endpoint}`)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.detail || loadError)
  }
  return data.items || []
}

async function mutateWorkspace(endpoint: string, method: 'POST' | 'PATCH', body: Record<string, unknown>, saveError: string): Promise<WorkspaceItem> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.detail || saveError)
  }
  return data
}

function buildQueryString(params: Record<string, string | boolean | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === false) {
      return
    }
    search.set(key, String(value))
  })
  const serialized = search.toString()
  return serialized ? `?${serialized}` : ''
}

function WorkspacePage() {
  const { messages, formatDateTime } = useAppPreferences()
  const [tab, setTab] = useState<WorkspaceTab>('note')
  const [items, setItems] = useState<WorkspaceItem[]>([])
  const [selectedItem, setSelectedItem] = useState<WorkspaceItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [taskCompletionFilter, setTaskCompletionFilter] = useState<TaskCompletionFilter>('all')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskContent, setTaskContent] = useState('')
  const [taskCompleted, setTaskCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const tabs: Array<{ value: WorkspaceTab; label: string }> = [
    { value: 'all', label: messages.workspace.tabs.all },
    { value: 'note', label: messages.workspace.tabs.notes },
    { value: 'task', label: messages.workspace.tabs.tasks },
    { value: 'result', label: messages.workspace.tabs.results },
  ]

  const selectedType = selectedItem?.item_type ?? (tab === 'all' ? null : tab)

  const resetEditor = (targetTab: WorkspaceTab) => {
    setSelectedItem(null)
    setBanner(null)
    if (targetTab === 'task') {
      setTaskTitle('')
      setTaskContent('')
      setTaskCompleted(false)
    } else {
      setNoteTitle('')
      setNoteContent('')
    }
  }

  const loadItems = async () => {
    setLoading(true)
    setBanner(null)
    try {
      const common = buildQueryString({
        q: searchQuery.trim() || undefined,
        include_archived: includeArchived,
        pinned_only: pinnedOnly,
      })

      let endpoint = '/workspace/search'
      if (tab === 'note' && !searchQuery.trim()) {
        endpoint = `/workspace/notes${buildQueryString({ include_archived: includeArchived, pinned_only: pinnedOnly })}`
      } else if (tab === 'task' && !searchQuery.trim()) {
        endpoint = `/workspace/tasks${buildQueryString({
          include_archived: includeArchived,
          pinned_only: pinnedOnly,
          completed: taskCompletionFilter !== 'all' ? taskCompletionFilter : undefined,
        })}`
      } else if (tab === 'result' && !searchQuery.trim()) {
        endpoint = `/workspace/results${buildQueryString({ include_archived: includeArchived, pinned_only: pinnedOnly })}`
      } else {
        endpoint = `/workspace/search${buildQueryString({
          q: searchQuery.trim() || undefined,
          include_archived: includeArchived,
          pinned_only: pinnedOnly,
          item_type: tab === 'all' ? undefined : tab,
        })}`
        if (tab === 'task' && taskCompletionFilter !== 'all') {
          endpoint = `/workspace/tasks${buildQueryString({
            q: searchQuery.trim() || undefined,
            include_archived: includeArchived,
            pinned_only: pinnedOnly,
            completed: taskCompletionFilter,
          })}`
        }
      }

      if (tab === 'all' && !searchQuery.trim()) {
        endpoint = `/workspace/search${buildQueryString({
          include_archived: includeArchived,
          pinned_only: pinnedOnly,
        })}`
      } else if (common && tab === 'note' && searchQuery.trim()) {
        endpoint = `/workspace/search${buildQueryString({
          q: searchQuery.trim(),
          include_archived: includeArchived,
          pinned_only: pinnedOnly,
          item_type: 'note',
        })}`
      } else if (common && tab === 'result' && searchQuery.trim()) {
        endpoint = `/workspace/search${buildQueryString({
          q: searchQuery.trim(),
          include_archived: includeArchived,
          pinned_only: pinnedOnly,
          item_type: 'result',
        })}`
      }

      const nextItems = await fetchWorkspace(endpoint, messages.workspace.loadError)
      setItems(nextItems)
      setSelectedItem((current) => {
        if (!current) return nextItems[0] ?? null
        return nextItems.find((item) => item.id === current.id && item.item_type === current.item_type) ?? nextItems[0] ?? null
      })
    } catch (error) {
      setItems([])
      setSelectedItem(null)
      setBanner({ type: 'error', message: error instanceof Error ? error.message : messages.workspace.loadError })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, searchQuery, includeArchived, pinnedOnly, taskCompletionFilter])

  useEffect(() => {
    if (!selectedItem) {
      if (tab === 'note') {
        setNoteTitle('')
        setNoteContent('')
      } else if (tab === 'task') {
        setTaskTitle('')
        setTaskContent('')
        setTaskCompleted(false)
      }
      return
    }
    if (selectedItem.item_type === 'note') {
      setNoteTitle(selectedItem.title)
      setNoteContent(selectedItem.content)
    } else if (selectedItem.item_type === 'task') {
      setTaskTitle(selectedItem.title)
      setTaskContent(selectedItem.content)
      setTaskCompleted(selectedItem.is_completed)
    }
  }, [selectedItem, tab])

  const selectedSummary = useMemo(() => {
    if (!selectedItem) return null
    if (selectedItem.item_type === 'result') {
      return [
        `${messages.workspace.detail.provider}: ${selectedItem.provider || '-'}`,
        `${messages.workspace.detail.model}: ${selectedItem.model || '-'}`,
        `${messages.workspace.detail.mode}: ${selectedItem.mode || '-'}`,
      ]
    }
    return null
  }, [messages.workspace.detail.mode, messages.workspace.detail.model, messages.workspace.detail.provider, selectedItem])

  const handleCreateOrUpdateNote = async () => {
    setSubmitting(true)
    setBanner(null)
    try {
      const endpoint = selectedItem?.item_type === 'note' ? `/workspace/notes/${selectedItem.id}` : '/workspace/notes'
      const method = selectedItem?.item_type === 'note' ? 'PATCH' : 'POST'
      const item = await mutateWorkspace(endpoint, method, { title: noteTitle, content: noteContent }, messages.workspace.saveError)
      setSelectedItem(item)
      setBanner({ type: 'success', message: method === 'POST' ? messages.workspace.noteCreated : messages.workspace.noteUpdated })
      await loadItems()
    } catch (error) {
      setBanner({ type: 'error', message: error instanceof Error ? error.message : messages.workspace.saveError })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateOrUpdateTask = async () => {
    setSubmitting(true)
    setBanner(null)
    try {
      const endpoint = selectedItem?.item_type === 'task' ? `/workspace/tasks/${selectedItem.id}` : '/workspace/tasks'
      const method = selectedItem?.item_type === 'task' ? 'PATCH' : 'POST'
      const item = await mutateWorkspace(endpoint, method, {
        title: taskTitle,
        content: taskContent,
        is_completed: taskCompleted,
      }, messages.workspace.saveError)
      setSelectedItem(item)
      setBanner({ type: 'success', message: method === 'POST' ? messages.workspace.taskCreated : messages.workspace.taskUpdated })
      await loadItems()
    } catch (error) {
      setBanner({ type: 'error', message: error instanceof Error ? error.message : messages.workspace.saveError })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTogglePin = async (item: WorkspaceItem) => {
    try {
      await mutateWorkspace(`/workspace/${item.item_type}s/${item.id}/pin`, 'POST', { pinned: !item.is_pinned }, messages.workspace.saveError)
      await loadItems()
    } catch (error) {
      setBanner({ type: 'error', message: error instanceof Error ? error.message : messages.workspace.saveError })
    }
  }

  const handleToggleArchive = async (item: WorkspaceItem) => {
    try {
      await mutateWorkspace(`/workspace/${item.item_type}s/${item.id}/archive`, 'POST', { archived: !item.is_archived }, messages.workspace.saveError)
      if (selectedItem?.id === item.id && selectedItem.item_type === item.item_type && !item.is_archived) {
        setSelectedItem(null)
      }
      await loadItems()
    } catch (error) {
      setBanner({ type: 'error', message: error instanceof Error ? error.message : messages.workspace.saveError })
    }
  }

  const handleToggleTaskCompleted = async (item: WorkspaceItem) => {
    try {
      const updated = await mutateWorkspace(`/workspace/tasks/${item.id}`, 'PATCH', { is_completed: !item.is_completed }, messages.workspace.saveError)
      setSelectedItem(updated)
      await loadItems()
    } catch (error) {
      setBanner({ type: 'error', message: error instanceof Error ? error.message : messages.workspace.saveError })
    }
  }

  const renderDetailPanel = () => {
    if (tab === 'note' || selectedType === 'note') {
      return (
        <div className="card workspace-detail-card">
          <div className="section-header">
            <div>
              <h3 className="section-title section-title-no-border">
                {selectedItem?.item_type === 'note' ? messages.workspace.editNote : messages.workspace.newNote}
              </h3>
              <p className="card-description">{messages.workspace.noteDescription}</p>
            </div>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => resetEditor('note')}>
              {messages.workspace.newItem}
            </button>
          </div>
          <label className="ai-field">
            <span className="ai-label">{messages.workspace.fields.title}</span>
            <input className="ai-input plaintext" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
          </label>
          <label className="ai-field">
            <span className="ai-label">{messages.workspace.fields.content}</span>
            <textarea className="ai-textarea plaintext" rows={10} value={noteContent} onChange={(event) => setNoteContent(event.target.value)} />
          </label>
          <div className="workspace-detail-actions">
            <button className="btn btn-primary" type="button" onClick={() => void handleCreateOrUpdateNote()} disabled={submitting}>
              {submitting ? messages.workspace.saving : selectedItem?.item_type === 'note' ? messages.workspace.update : messages.workspace.create}
            </button>
            {selectedItem?.item_type === 'note' ? (
              <>
                <button className="btn btn-secondary" type="button" onClick={() => void handleTogglePin(selectedItem)}>
                  {selectedItem.is_pinned ? messages.workspace.unpin : messages.workspace.pin}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => void handleToggleArchive(selectedItem)}>
                  {selectedItem.is_archived ? messages.workspace.restore : messages.workspace.archive}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )
    }

    if (tab === 'task' || selectedType === 'task') {
      return (
        <div className="card workspace-detail-card">
          <div className="section-header">
            <div>
              <h3 className="section-title section-title-no-border">
                {selectedItem?.item_type === 'task' ? messages.workspace.editTask : messages.workspace.newTask}
              </h3>
              <p className="card-description">{messages.workspace.taskDescription}</p>
            </div>
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => resetEditor('task')}>
              {messages.workspace.newItem}
            </button>
          </div>
          <label className="ai-field">
            <span className="ai-label">{messages.workspace.fields.title}</span>
            <input className="ai-input plaintext" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
          </label>
          <label className="ai-field">
            <span className="ai-label">{messages.workspace.fields.content}</span>
            <textarea className="ai-textarea plaintext" rows={8} value={taskContent} onChange={(event) => setTaskContent(event.target.value)} />
          </label>
          <label className="ai-toggle">
            <input type="checkbox" checked={taskCompleted} onChange={(event) => setTaskCompleted(event.target.checked)} />
            <span>{messages.workspace.fields.completed}</span>
          </label>
          <div className="workspace-detail-actions">
            <button className="btn btn-primary" type="button" onClick={() => void handleCreateOrUpdateTask()} disabled={submitting}>
              {submitting ? messages.workspace.saving : selectedItem?.item_type === 'task' ? messages.workspace.update : messages.workspace.create}
            </button>
            {selectedItem?.item_type === 'task' ? (
              <>
                <button className="btn btn-secondary" type="button" onClick={() => void handleToggleTaskCompleted(selectedItem)}>
                  {selectedItem.is_completed ? messages.workspace.uncheck : messages.workspace.check}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => void handleTogglePin(selectedItem)}>
                  {selectedItem.is_pinned ? messages.workspace.unpin : messages.workspace.pin}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => void handleToggleArchive(selectedItem)}>
                  {selectedItem.is_archived ? messages.workspace.restore : messages.workspace.archive}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )
    }

    if (selectedItem?.item_type === 'result') {
      return (
        <div className="card workspace-detail-card">
          <div className="section-header">
            <div>
              <h3 className="section-title section-title-no-border">{messages.workspace.savedResultTitle}</h3>
              <p className="card-description">{messages.workspace.resultDescription}</p>
            </div>
          </div>
          <div className="workspace-detail-stack">
            <div className="context-row">
              <span className="context-label">{messages.workspace.fields.title}</span>
              <span className="context-value plaintext">{selectedItem.title}</span>
            </div>
            {selectedSummary?.map((line) => (
                <div key={line} className="workspace-result-meta ltr-code">{line}</div>
            ))}
            <div className="workspace-result-body plaintext">{selectedItem.content}</div>
          </div>
          <div className="workspace-detail-actions">
            <button className="btn btn-secondary" type="button" onClick={() => void handleTogglePin(selectedItem)}>
              {selectedItem.is_pinned ? messages.workspace.unpin : messages.workspace.pin}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => void handleToggleArchive(selectedItem)}>
              {selectedItem.is_archived ? messages.workspace.restore : messages.workspace.archive}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="card workspace-detail-card">
        <div className="empty-state">{messages.workspace.selectItemHint}</div>
      </div>
    )
  }

  return (
    <div className="page workspace-page">
      <div className="page-header">
        <h2 className="page-title">{messages.workspace.title}</h2>
        <p className="page-subtitle">{messages.workspace.subtitle}</p>
      </div>

      <section className="section workspace-toolbar-section">
        <div className="workspace-toolbar">
          <div className="workspace-tab-row">
            {tabs.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`workspace-tab ${tab === item.value ? 'active' : ''}`}
                onClick={() => {
                  setTab(item.value)
                  if (item.value !== tab) {
                    resetEditor(item.value)
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="workspace-filter-grid">
            <input
              className="ai-input plaintext"
              placeholder={messages.workspace.searchPlaceholder}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <label className="ai-toggle">
              <input type="checkbox" checked={pinnedOnly} onChange={(event) => setPinnedOnly(event.target.checked)} />
              <span>{messages.workspace.filters.pinnedOnly}</span>
            </label>
            <label className="ai-toggle">
              <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
              <span>{messages.workspace.filters.includeArchived}</span>
            </label>
            {(tab === 'task' || (tab === 'all' && items.some((item) => item.item_type === 'task'))) ? (
              <label className="ai-field workspace-task-filter">
                <span className="ai-label">{messages.workspace.filters.taskState}</span>
                <select className="ai-select" value={taskCompletionFilter} onChange={(event) => setTaskCompletionFilter(event.target.value as TaskCompletionFilter)}>
                  <option value="all">{messages.workspace.filters.taskStates.all}</option>
                  <option value="open">{messages.workspace.filters.taskStates.open}</option>
                  <option value="done">{messages.workspace.filters.taskStates.done}</option>
                </select>
              </label>
            ) : null}
          </div>
        </div>
      </section>

      {banner ? (
        <div className={`action-status-banner action-status-${banner.type === 'info' ? 'info' : banner.type === 'success' ? 'success' : 'error'}`}>
          <span>{banner.message}</span>
        </div>
      ) : null}

      <section className="section workspace-layout">
        <div className="card workspace-list-card">
          <div className="section-header">
            <h3 className="section-title section-title-no-border">{messages.workspace.listTitle}</h3>
            <span className="preview-only-badge">{items.length} {messages.workspace.itemsCount}</span>
          </div>
          {loading ? (
            <div className="loading-state">{messages.workspace.loading}</div>
          ) : items.length === 0 ? (
            <div className="empty-state">{messages.workspace.empty}</div>
          ) : (
            <div className="workspace-list">
              {items.map((item) => (
                <div
                  key={`${item.item_type}-${item.id}`}
                  className={`workspace-list-item ${selectedItem?.id === item.id && selectedItem?.item_type === item.item_type ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedItem(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedItem(item)
                    }
                  }}
                >
                  <div className="workspace-list-item-header">
                    <span className="workspace-item-title plaintext">{item.title}</span>
                    <div className="workspace-item-badges">
                      {item.is_pinned ? <span className="workspace-badge workspace-badge-pinned">{messages.workspace.badges.pinned}</span> : null}
                      {item.item_type === 'task' && item.is_completed ? <span className="workspace-badge workspace-badge-done">{messages.workspace.badges.completed}</span> : null}
                      {item.is_archived ? <span className="workspace-badge workspace-badge-archived">{messages.workspace.badges.archived}</span> : null}
                    </div>
                  </div>
                  <div className="workspace-item-meta">
                    <span>{item.item_type === 'note' ? messages.workspace.tabs.notes : item.item_type === 'task' ? messages.workspace.tabs.tasks : messages.workspace.tabs.results}</span>
                    <span className="ltr-code">{formatDateTime(item.updated_at)}</span>
                  </div>
                  <p className="workspace-item-preview plaintext">{item.content_preview || messages.workspace.noPreview}</p>
                  <div className="workspace-item-actions">
                    {item.item_type === 'task' ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleToggleTaskCompleted(item)
                        }}
                      >
                        {item.is_completed ? messages.workspace.uncheck : messages.workspace.check}
                      </button>
                    ) : null}
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleTogglePin(item)
                      }}
                    >
                      {item.is_pinned ? messages.workspace.unpin : messages.workspace.pin}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleToggleArchive(item)
                      }}
                    >
                      {item.is_archived ? messages.workspace.restore : messages.workspace.archive}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {renderDetailPanel()}
      </section>
    </div>
  )
}

export default WorkspacePage
