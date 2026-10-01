import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'
import type { AppInfo, ExtractResult, IntegrityEvent, OpenResult, OpenWithResult, PrintResult, SaveResult, WsnpApi, ZipList } from '../core/api.ts'

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
  appInfo: () => ipcRenderer.invoke('wsnp:app-info') as Promise<AppInfo>,
  zipList: (id, path) => ipcRenderer.invoke('wsnp:zip-list', id, path) as Promise<ZipList>,
  zipExtract: (id, path, names, options) => ipcRenderer.invoke('wsnp:zip-extract', id, path, names, options) as Promise<ExtractResult>,
  copyFromPage: (id) => ipcRenderer.invoke('wsnp:page-copy', id) as Promise<boolean>,
  findInPage: (id, query, options) => ipcRenderer.invoke('wsnp:page-find', id, query, options) as Promise<{ found: boolean; count: number }>,
  selectAllInPage: (id) => ipcRenderer.invoke('wsnp:page-select-all', id) as Promise<void>,
  onPageContext: (listener) => on<{ snapshotId: string; x: number; y: number; hasSelection: boolean }>('wsnp:page-context', listener),
  clearFindInPage: (id) => ipcRenderer.invoke('wsnp:page-find-clear', id) as Promise<void>,
  print: (request) => ipcRenderer.invoke('wsnp:print', request) as Promise<PrintResult>,
  savePdf: (request) => ipcRenderer.invoke('wsnp:save-pdf', request) as Promise<SaveResult>,
  saveConverted: (id) => ipcRenderer.invoke('wsnp:save-converted', id) as Promise<SaveResult>,
  openWith: (id, path) => ipcRenderer.invoke('wsnp:open-with', id, path) as Promise<OpenWithResult>,
  openWithApp: (token, appId, always) => ipcRenderer.invoke('wsnp:open-with-app', token, appId, always) as Promise<OpenWithResult>,
  openWithCancel: (token) => ipcRenderer.invoke('wsnp:open-with-cancel', token) as Promise<void>,
  copyText: (text) => ipcRenderer.invoke('wsnp:copy', text) as Promise<void>,
  reveal: (id) => ipcRenderer.invoke('wsnp:reveal', id) as Promise<void>,
  recent: { list: () => ipcRenderer.invoke('wsnp:recent-list') as Promise<string[]>, clear: () => ipcRenderer.invoke('wsnp:recent-clear') as Promise<void> },
}

contextBridge.exposeInMainWorld('wsnp', api)
