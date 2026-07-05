import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'

const OVERLAY_WIDTH = 560
const OVERLAY_HEIGHT = 840
const BACKEND_BASE_URL = 'http://127.0.0.1:8000'
const BACKEND_HEALTH_URL = `${BACKEND_BASE_URL}/health`
const BACKEND_CONTEXT_URL = `${BACKEND_BASE_URL}/context/current`
const BACKEND_START_TIMEOUT_MS = 15000
const BACKEND_POLL_INTERVAL_MS = 10000
const CONTEXT_FETCH_TIMEOUT_MS = 1500
const HEALTH_FETCH_TIMEOUT_MS = 1500

interface OverlayTargetContext {
  active_window_title?: string
  active_process_name?: string
  active_process_id?: number
  capture_status?: { active_window: string }
  timestamp?: string
  warnings?: string[]
  capture_failed?: boolean
  capture_error?: string
}

type BackendRuntimeMode = 'bundled' | 'external'
type BackendRuntimeState = 'checking' | 'starting' | 'connected' | 'disconnected' | 'failed'

interface BackendRuntimeStatus {
  mode: BackendRuntimeMode
  state: BackendRuntimeState
  managed: boolean
  message: string
  details?: string
}

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let overlayTargetContext: OverlayTargetContext | null = null
let backendProcess: ChildProcess | null = null
let backendHealthInterval: NodeJS.Timeout | null = null
let isQuitting = false
let backendRuntimeStatus: BackendRuntimeStatus = {
  mode: app.isPackaged ? 'bundled' : 'external',
  state: 'checking',
  managed: false,
  message: app.isPackaged
    ? 'جارٍ التحقق من تشغيل الخلفية المحلية...'
    : 'شغّل الخلفية المحلية عبر npm run dev:backend أثناء التطوير.',
}

function getOverlayUrl() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}?overlay=1`
  }
  return `file://${path.join(__dirname, '../dist/index.html')}?overlay=1`
}

function isOverlaySelfProcessName(name: string | undefined): boolean {
  if (!name) return false
  const lowered = name.toLowerCase()
  return lowered.includes('omniagent') || lowered.includes('abud')
}

function isOverlaySelfTitle(title: string | undefined): boolean {
  if (!title) return false
  const lowered = title.toLowerCase()
  return lowered.includes('omniagent') || lowered.includes('أومني أجنت') || lowered.includes('overlay')
}

function addOverlaySelfCaptureWarning(context: OverlayTargetContext): OverlayTargetContext {
  const warnings = context.warnings ? [...context.warnings] : []
  const processName = context.active_process_name || ''
  const title = context.active_window_title || ''
  if (isOverlaySelfProcessName(processName) || isOverlaySelfTitle(title)) {
    warnings.push('تم التقاط النافذة الحالية بدلاً من التطبيق المستهدف. ضع المؤشر في التطبيق المطلوب ثم أعد فتح النافذة.')
  }
  return { ...context, warnings }
}

function updateBackendRuntimeStatus(next: BackendRuntimeStatus) {
  backendRuntimeStatus = next
  mainWindow?.webContents.send('backend-runtime-status', backendRuntimeStatus)
  overlayWindow?.webContents.send('backend-runtime-status', backendRuntimeStatus)
}

async function isBackendHealthy(): Promise<boolean> {
  try {
    const response = await fetch(BACKEND_HEALTH_URL, {
      signal: AbortSignal.timeout(HEALTH_FETCH_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}

function ensureBackendDataDirectories() {
  const backendRoot = path.join(app.getPath('userData'), 'backend')
  const dataDir = path.join(backendRoot, 'data')
  const runtimeDir = path.join(backendRoot, 'runtime')
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(runtimeDir, { recursive: true })
  return {
    backendRoot,
    dataDir,
    runtimeDir,
    dbPath: path.join(dataDir, 'omniagent.db'),
    providerSettingsPath: path.join(runtimeDir, 'provider_settings.json'),
  }
}

function getBundledBackendExecutablePath(): string {
  return path.join(process.resourcesPath, 'backend', 'AbudOmniAgentBackend.exe')
}

function getDevelopmentWindowIconPath(): string | undefined {
  const iconPath = path.join(app.getAppPath(), 'build', 'icon.png')
  return existsSync(iconPath) ? iconPath : undefined
}

function stopManagedBackend() {
  if (!backendProcess) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(backendProcess.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
  } else {
    backendProcess.kill()
  }
  backendProcess = null
}

function spawnManagedBackend() {
  if (backendProcess || !app.isPackaged) {
    return
  }

  const executablePath = getBundledBackendExecutablePath()
  if (!existsSync(executablePath)) {
    updateBackendRuntimeStatus({
      mode: 'bundled',
      state: 'failed',
      managed: false,
      message: 'تعذر العثور على الخلفية المحلية المضمنة داخل التطبيق.',
      details: executablePath,
    })
    return
  }

  const paths = ensureBackendDataDirectories()
  const env = {
    ...process.env,
    BACKEND_HOST: '127.0.0.1',
    BACKEND_PORT: '8000',
    LOG_LEVEL: process.env.LOG_LEVEL || 'warning',
    DB_PATH: paths.dbPath,
    PROVIDER_SETTINGS_PATH: paths.providerSettingsPath,
  }

  backendProcess = spawn(executablePath, [], {
    cwd: path.dirname(executablePath),
    env,
    windowsHide: true,
    stdio: 'ignore',
  })

  backendProcess.on('exit', (code) => {
    backendProcess = null
    if (!isQuitting) {
      updateBackendRuntimeStatus({
        mode: 'bundled',
        state: 'failed',
        managed: false,
        message: 'توقفت الخلفية المحلية بعد تشغيلها. أعد فتح التطبيق للمحاولة مرة أخرى.',
        details: code === null ? 'terminated' : `exit:${code}`,
      })
    }
  })

  updateBackendRuntimeStatus({
    mode: 'bundled',
    state: 'starting',
    managed: true,
    message: 'جارٍ تشغيل الخلفية المحلية المضمنة...',
  })
}

async function waitForBackendHealthy(timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await isBackendHealthy()) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

async function ensureBackendRuntime() {
  if (await isBackendHealthy()) {
    updateBackendRuntimeStatus({
      mode: app.isPackaged ? 'bundled' : 'external',
      state: 'connected',
      managed: app.isPackaged && backendProcess !== null,
      message: app.isPackaged
        ? 'الخلفية المحلية جاهزة.'
        : 'الخلفية المحلية متصلة.',
    })
    return
  }

  if (!app.isPackaged) {
    updateBackendRuntimeStatus({
      mode: 'external',
      state: 'disconnected',
      managed: false,
      message: 'الخلفية غير متصلة. شغّل npm run dev:backend أثناء التطوير.',
    })
    return
  }

  spawnManagedBackend()
  if (!backendProcess) {
    return
  }

  const healthy = await waitForBackendHealthy(BACKEND_START_TIMEOUT_MS)
  updateBackendRuntimeStatus(
    healthy
      ? {
          mode: 'bundled',
          state: 'connected',
          managed: true,
          message: 'الخلفية المحلية تعمل تلقائيًا داخل التطبيق.',
        }
      : {
          mode: 'bundled',
          state: 'failed',
          managed: true,
          message: 'تعذر تجهيز الخلفية المحلية تلقائيًا. أعد فتح التطبيق أو تحقق من ملفات التثبيت.',
        },
  )
}

function startBackendHealthMonitor() {
  if (backendHealthInterval) {
    clearInterval(backendHealthInterval)
  }

  backendHealthInterval = setInterval(async () => {
    const healthy = await isBackendHealthy()
    if (healthy) {
      updateBackendRuntimeStatus({
        mode: app.isPackaged ? 'bundled' : 'external',
        state: 'connected',
        managed: app.isPackaged && backendProcess !== null,
        message:
          app.isPackaged && backendProcess
            ? 'الخلفية المحلية تعمل تلقائيًا داخل التطبيق.'
            : 'الخلفية المحلية متصلة.',
      })
      return
    }

    if (!app.isPackaged) {
      updateBackendRuntimeStatus({
        mode: 'external',
        state: 'disconnected',
        managed: false,
        message: 'الخلفية غير متصلة. شغّل npm run dev:backend أثناء التطوير.',
      })
      return
    }

    if (backendProcess) {
      updateBackendRuntimeStatus({
        mode: 'bundled',
        state: 'starting',
        managed: true,
        message: 'الخلفية المحلية قيد المحاولة أو إعادة التشغيل...',
      })
      return
    }

    updateBackendRuntimeStatus({
      mode: 'bundled',
      state: 'failed',
      managed: false,
      message: 'الخلفية المحلية غير متاحة داخل التطبيق الحالي.',
    })
  }, BACKEND_POLL_INTERVAL_MS)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Abud OmniAgent',
    backgroundColor: '#0a0e1a',
    icon: getDevelopmentWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('backend-runtime-status', backendRuntimeStatus)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    overlayWindow?.destroy()
    overlayWindow = null
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    title: 'Abud OmniAgent Overlay',
    backgroundColor: '#00000000',
    icon: getDevelopmentWindowIconPath(),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const x = Math.round((width - OVERLAY_WIDTH) / 2)
  const y = Math.round((height - OVERLAY_HEIGHT) / 2)
  overlayWindow.setPosition(x, y)

  overlayWindow.setVisibleOnAllWorkspaces(true)
  overlayWindow.setAlwaysOnTop(true, 'floating')

  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow?.webContents.send('backend-runtime-status', backendRuntimeStatus)
  })

  overlayWindow.on('close', (event: { preventDefault: () => void }) => {
    event.preventDefault()
    overlayWindow?.hide()
  })

  overlayWindow.loadURL(getOverlayUrl())
}

async function fetchTargetContext(): Promise<OverlayTargetContext> {
  try {
    const response = await fetch(BACKEND_CONTEXT_URL, {
      signal: AbortSignal.timeout(CONTEXT_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }
    const data = (await response.json()) as OverlayTargetContext
    overlayTargetContext = addOverlaySelfCaptureWarning({
      ...data,
      capture_failed: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    overlayTargetContext = {
      active_window_title: '',
      active_process_name: 'unknown',
      active_process_id: 0,
      capture_failed: true,
      capture_error: message,
      warnings: [`تعذر التقاط السياق المستهدف قبل فتح النافذة: ${message}`],
      timestamp: new Date().toISOString(),
    }
  }
  return overlayTargetContext
}

function sendOverlayTargetContext() {
  overlayWindow?.webContents.send('overlay-target-context', overlayTargetContext)
  overlayWindow?.webContents.send('show-overlay')
}

async function showOverlay() {
  const wasVisible = overlayWindow?.isVisible() && !overlayWindow?.isDestroyed()

  if (!wasVisible) {
    overlayTargetContext = null
    await fetchTargetContext()
  }

  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow()
    overlayWindow?.once('ready-to-show', () => {
      overlayWindow?.show()
      overlayWindow?.focus()
      sendOverlayTargetContext()
    })
    return
  }

  if (overlayWindow.isMinimized()) {
    overlayWindow.restore()
  }
  if (!overlayWindow.isVisible()) {
    overlayWindow.show()
  }
  overlayWindow.focus()
  sendOverlayTargetContext()
}

app.whenReady().then(() => {
  ipcMain.handle('get-version', () => app.getVersion())
  ipcMain.handle('hide-overlay', () => {
    overlayWindow?.hide()
  })
  ipcMain.handle('get-overlay-target-context', () => overlayTargetContext)
  ipcMain.handle('get-backend-runtime-status', () => backendRuntimeStatus)

  createWindow()
  createOverlayWindow()
  void ensureBackendRuntime()
  startBackendHealthMonitor()

  globalShortcut.register('Ctrl+Alt+A', () => {
    void showOverlay()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  if (backendHealthInterval) {
    clearInterval(backendHealthInterval)
    backendHealthInterval = null
  }
  stopManagedBackend()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
