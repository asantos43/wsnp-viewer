import { contextBridge, ipcRenderer } from 'electron'

/** What the interface may ask of the main process: nothing else crosses the boundary. */
contextBridge.exposeInMainWorld('wsnp', {
  platform: process.platform,
  /** Tells the window the colours of the title bar (the native window buttons are drawn with them on Windows and Linux). */
  setTitleBar: (colors: { color: string; symbolColor: string }) => ipcRenderer.send('wsnp:title-bar', colors),
  /** Runs when a command comes from the native menu (macOS). */
  onCommand: (listener: (command: string) => void) => {
    const handler = (_event: unknown, command: string) => listener(command)
    ipcRenderer.on('wsnp:command', handler)
    return () => ipcRenderer.removeListener('wsnp:command', handler)
  },
})
