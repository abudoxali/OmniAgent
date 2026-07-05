import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('omniAgent', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  hideOverlay: () => ipcRenderer.invoke('hide-overlay'),
  getOverlayTargetContext: () => ipcRenderer.invoke('get-overlay-target-context'),
  getBackendRuntimeStatus: () => ipcRenderer.invoke('get-backend-runtime-status'),
  onShortcutTriggered: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('shortcut-triggered', listener)
    return () => ipcRenderer.removeListener('shortcut-triggered', listener)
  },
  onShowOverlay: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('show-overlay', listener)
    return () => ipcRenderer.removeListener('show-overlay', listener)
  },
  onOverlayTargetContext: (callback: (context: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, context: unknown) => callback(context)
    ipcRenderer.on('overlay-target-context', listener)
    return () => ipcRenderer.removeListener('overlay-target-context', listener)
  },
  onBackendRuntimeStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, status: unknown) => callback(status)
    ipcRenderer.on('backend-runtime-status', listener)
    return () => ipcRenderer.removeListener('backend-runtime-status', listener)
  },
})
