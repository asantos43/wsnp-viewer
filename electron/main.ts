import { app, BrowserWindow } from 'electron'
import { installMenu } from './menu.ts'
import { runPrototype, wantsPrototype } from './prototype-runner.ts'
import { registerScheme } from './snapshot-view.ts'
import { createMainWindow } from './window.ts'

// Both the interface (wsnp-ui://) and the snapshots (wsnp://) are custom schemes: registered before the app is ready.
registerScheme()

if (wantsPrototype(process.argv)) {
  // The phase 0 experiments and the spike: no interface (`npm run prototype`, and the end-to-end tests with --serve).
  runPrototype()
} else {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.whenReady().then(() => {
    let win = createMainWindow()
    installMenu((command) => win.webContents.send('wsnp:command', command))
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) win = createMainWindow()
    })
  })
}
