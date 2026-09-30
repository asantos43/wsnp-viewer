import path from 'node:path'
import { app, BrowserWindow, ipcMain, session } from 'electron'
import { UI_SCHEME } from './snapshot-view.ts'
import { serveUi, UI_ORIGIN } from './ui-protocol.ts'

export const PARTITION = 'persist:ui'
const TITLE_BAR_HEIGHT = 30
const COLOR = /^#[0-9a-f]{6}$/i

/** Dark+ colours, used until the interface tells the window which theme it is in. */
const FIRST_COLORS = { color: '#3C3C3C', symbolColor: '#CCCCCC', background: '#1E1E1E' }

/** Nothing but the interface and the snapshots' own files is ever fetched; the rest is cancelled below the page. */
function guardUiSession(ses: Electron.Session): void {
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const allowed = details.url.startsWith(`${UI_ORIGIN}/`) || /^(data|blob|devtools):/.test(details.url)
    callback(allowed ? {} : { cancel: true })
  })
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
}

/** The colours of the window buttons follow the theme. Only the sender's own window is touched. */
function handleTitleBarColors(): void {
  ipcMain.on('wsnp:title-bar', (event, colors: unknown) => {
    const c = colors as { color?: unknown; symbolColor?: unknown } | null
    if (typeof c?.color !== 'string' || typeof c.symbolColor !== 'string' || !COLOR.test(c.color) || !COLOR.test(c.symbolColor)) return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || process.platform === 'darwin') return
    win.setTitleBarOverlay({ color: c.color, symbolColor: c.symbolColor, height: TITLE_BAR_HEIGHT })
    win.setBackgroundColor(c.color)
  })
}

export function createMainWindow(): BrowserWindow {
  const root = path.join(app.getAppPath(), 'dist')
  const ses = session.fromPartition(PARTITION)
  ses.protocol.handle(UI_SCHEME, (request) => serveUi(root, request.url))
  guardUiSession(ses)
  handleTitleBarColors()

  const mac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 400,
    show: false,
    title: 'WSNP Viewer',
    backgroundColor: FIRST_COLORS.background,
    ...(mac ? {} : { icon: path.join(app.getAppPath(), 'build', 'icon.png') }),
    titleBarStyle: 'hidden',
    ...(mac
      ? { trafficLightPosition: { x: 12, y: 8 } }
      : { titleBarOverlay: { color: FIRST_COLORS.color, symbolColor: FIRST_COLORS.symbolColor, height: TITLE_BAR_HEIGHT } }),
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })
  win.setMenuBarVisibility(false)
  win.once('ready-to-show', () => win.show())
  void win.loadURL(`${UI_ORIGIN}/index.html`)
  return win
}
