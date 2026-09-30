import path from 'node:path'
import { app, BrowserWindow } from 'electron'
import { RecentFiles } from '../core/recent.ts'
import { SignerStore } from '../core/signers.ts'
import { snapshotPaths } from './argv.ts'
import { installMenu } from './menu.ts'
import { runPrototype, wantsPrototype } from './prototype-runner.ts'
import { SnapshotHost } from './snapshot-host.ts'
import { registerScheme } from './snapshot-view.ts'
import { createMainWindow } from './window.ts'

// Both the interface (wsnp-ui://) and the snapshots (wsnp://) are custom schemes: registered before the app is ready.
registerScheme()

if (process.argv.includes('--app-version')) {
  // For the packaging smoke test: the version of the application (Electron's own --version says Electron's).
  console.log(app.getVersion())
  app.exit(0)
} else if (wantsPrototype(process.argv)) {
  // The phase 0 experiments and the spike: no interface (`npm run prototype`, and the end-to-end tests with --serve).
  runPrototype()
} else if (!app.requestSingleInstanceLock()) {
  // A second launch (a double-click on another file) hands its files to the first and leaves.
  app.quit()
} else {
  let win: BrowserWindow | undefined
  let host: SnapshotHost | undefined
  const early: string[] = snapshotPaths(process.argv.slice(1), process.cwd())

  // macOS gives files through this event, also before the app is ready.
  app.on('open-file', (event, file) => {
    event.preventDefault()
    if (host) void host.openFromSystem(win, [file])
    else early.push(file)
  })
  app.on('second-instance', (_event, argv, cwd) => {
    void host?.openFromSystem(win, snapshotPaths(argv.slice(1), cwd))
    if (win?.isMinimized()) win.restore()
    win?.focus()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('before-quit', () => void host?.registry.closeAll())

  app.whenReady().then(async () => {
    host = new SnapshotHost(new RecentFiles(path.join(app.getPath('userData'), 'recent-files.json')), new SignerStore(path.join(app.getPath('userData'), 'trusted-signers.json')))
    host.registerIpc(() => win)
    win = createMainWindow(host)
    installMenu((command) => win?.webContents.send('wsnp:command', command))
    // What the command line named is opened now and handed to the interface when it says it is ready.
    await host.openFromSystem(win, early)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && host) win = createMainWindow(host)
    })
  })
}
