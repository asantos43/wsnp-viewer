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
    { label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { label: 'Settings…', accelerator: 'Cmd+,', click: () => send('openSettings') }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
    {
      label: 'File',
      submenu: [
        { label: 'Open File…', accelerator: 'Cmd+O', click: () => send('openFile') },
        { type: 'separator' },
        { label: 'Close Editor', accelerator: 'Cmd+W', click: () => send('closeEditor') },
      ],
    },
    { label: 'Edit', submenu: [{ role: 'copy' }, { role: 'selectAll' }] },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Side Bar', accelerator: 'Cmd+B', click: () => send('toggleSideBar') },
        { type: 'separator' },
        // The interface keeps its own zoom (and remembers it), so these are its commands, not the page's native zoom.
        { label: 'Zoom In', accelerator: 'Cmd+=', click: () => send('zoomIn') },
        { label: 'Zoom Out', accelerator: 'Cmd+-', click: () => send('zoomOut') },
        { label: 'Reset Zoom', accelerator: 'Cmd+0', click: () => send('zoomReset') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Next Editor', accelerator: 'Cmd+PageDown', click: () => send('nextEditor') },
        { label: 'Previous Editor', accelerator: 'Cmd+PageUp', click: () => send('previousEditor') },
      ],
    },
    { role: 'windowMenu' },
    { role: 'help', submenu: [] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
