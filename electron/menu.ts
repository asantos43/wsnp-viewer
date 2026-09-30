import { app, Menu, type MenuItemConstructorOptions } from 'electron'

/**
 * The native application menu of macOS, as VS Code has it: File, Edit, View, Go, Help. Commands the interface
 * handles go to it as `wsnp:command`. On Windows and Linux the menu is drawn in the title bar by the interface.
 */
export function installMenu(send: (command: string) => void): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  const template: MenuItemConstructorOptions[] = [
    { label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'File', submenu: [{ role: 'close' }] },
    { label: 'Edit', submenu: [{ role: 'copy' }, { role: 'selectAll' }] },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Side Bar', accelerator: 'Cmd+B', click: () => send('toggleSideBar') },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { label: 'Go', submenu: [] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
