import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import type { IntegrityEvent, OpenResult, SaveResult, WsnpApi } from '../core/api.ts'

/** What the interface may ask of the main process: nothing else crosses the boundary (core/api.ts). */
const on = <T>(channel: string, listener: (value: T) => void) => {
  const handler = (_event: unknown, value: T) => listener(value)
  ipcRenderer.on(channel, handler)
  return () => void ipcRenderer.removeListener(channel, handler)
}

const api: WsnpApi = {
  platform: process.platform,
  setZoomLevel: (level) => {
    if (typeof level === 'number' && Number.isFinite(level)) webFrame.setZoomLevel(Math.min(9, Math.max(-8, level)))
  },
  setTitleBar: (colors) => ipcRenderer.send('wsnp:title-bar', colors),
  onCommand: (listener) => on<string>('wsnp:command', listener),
  pathForFile: (file) => webUtils.getPathForFile(file),
  ready: () => ipcRenderer.invoke('wsnp:ready') as Promise<OpenResult[]>,
  openDialog: () => ipcRenderer.invoke('wsnp:open-dialog') as Promise<OpenResult[]>,
  openPaths: (paths) => ipcRenderer.invoke('wsnp:open-paths', paths) as Promise<OpenResult[]>,
  onOpened: (listener) => on<OpenResult[]>('wsnp:opened', listener),
  close: (id) => ipcRenderer.invoke('wsnp:close', id) as Promise<void>,
  readFile: (id, path) => ipcRenderer.invoke('wsnp:read-file', id, path),
  saveFileAs: (id, path) => ipcRenderer.invoke('wsnp:save-as', id, path),
  verify: (id) => ipcRenderer.invoke('wsnp:verify', id) as Promise<void>,
  onIntegrity: (listener) => on<IntegrityEvent>('wsnp:integrity', listener),
  onOpenFile: (listener) => on<{ snapshotId: string; path: string }>('wsnp:open-file', listener),
  onSaved: (listener) => on<{ name: string; result: SaveResult }>('wsnp:saved', listener),
  openExternal: (url) => ipcRenderer.invoke('wsnp:open-external', url) as Promise<void>,
  signers: {
    list: () => ipcRenderer.invoke('wsnp:signers-list') as Promise<Record<string, { name?: string }>>,
    trust: (fingerprint, name) => ipcRenderer.invoke('wsnp:signers-trust', fingerprint, name) as Promise<void>,
    forget: (fingerprint) => ipcRenderer.invoke('wsnp:signers-forget', fingerprint) as Promise<void>,
  },
  copyText: (text) => ipcRenderer.invoke('wsnp:copy', text) as Promise<void>,
  reveal: (id) => ipcRenderer.invoke('wsnp:reveal', id) as Promise<void>,
  recent: { list: () => ipcRenderer.invoke('wsnp:recent-list') as Promise<string[]>, clear: () => ipcRenderer.invoke('wsnp:recent-clear') as Promise<void> },
}

contextBridge.exposeInMainWorld('wsnp', api)
