import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { BrowserWindow, clipboard, dialog, ipcMain, shell, type IpcMainInvokeEvent, type Session, type WebFrameMain } from 'electron'
import type { IntegrityEvent, OpenResult, ReadResult, SaveResult } from '../core/api.ts'
import { BINARY_LIMIT, viewKind } from '../core/filekind.ts'
import type { RecentFiles } from '../core/recent.ts'
import { infoOf, SnapshotRegistry, type OpenOutcome } from '../core/snapshots.ts'
import { verifyContents } from '../core/validate/index.ts'
import { SCHEME } from './snapshot-view.ts'
import { UI_ORIGIN } from './ui-protocol.ts'

const WEB_LINK = /^(https?|mailto):/i

/**
 * The snapshot host of the interface: every open snapshot is an `<iframe sandbox>` of the window, loading `wsnp://<id>/`
 * from one shared session (docs/ARCHITECTURE.md, "Phase 1 spike results"). It answers for the snapshots' files, cancels
 * every request that is not the interface's own or a snapshot asking for itself, hands a clicked web link to the default
 * browser, and offers the interface what it may ask of the main process, over IPC that only the interface's own frame can use.
 */
export class SnapshotHost {
  readonly registry = new SnapshotRegistry()
  /** Requests cancelled below the page, for the tests and the log. */
  readonly blocked: string[] = []
  private readonly integrity = new Map<string, AbortController>()
  private pending: OpenResult[] = []
  private listening = false

  private readonly recent: RecentFiles
  private readonly openExternal: (url: string) => void

  constructor(recent: RecentFiles, openExternal: (url: string) => void = (url) => void shell.openExternal(url)) {
    this.recent = recent
    this.openExternal = openExternal
  }

  /** Serves `wsnp://<id>/…` from the session and cancels what must not leave. */
  bindSession(ses: Session): void {
    ses.protocol.handle(SCHEME, async (request) => {
      const url = new URL(request.url)
      const res = await this.registry.serve(url.hostname, url.pathname, request.headers.get('range'))
      const body: BodyInit | null = res.body instanceof Readable ? (Readable.toWeb(res.body) as ReadableStream) : res.body ? new Uint8Array(res.body) : null
      return new Response(body, { status: res.status, headers: res.headers })
    })
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      if (details.url.startsWith(`${UI_ORIGIN}/`) || /^(data|blob|devtools):/.test(details.url)) return callback({})
      const wanted = /^wsnp:\/\/([^/]+)\//.exec(details.url)?.[1]
      if (wanted && this.registry.has(wanted)) {
        // For a frame's own navigation the requesting frame is the new frame (no address yet): its parent asked.
        const asking = (details.resourceType === 'subFrame' ? details.frame?.parent?.url : details.frame?.url) ?? ''
        const fromInterface = details.resourceType === 'subFrame' && asking.startsWith(`${UI_ORIGIN}/`)
        const fromItself = asking.startsWith(`${SCHEME}://${wanted}/`)
        if (fromInterface || fromItself) return callback({})
      }
      this.blocked.push(`${details.resourceType} ${details.url}`)
      callback({ cancel: true })
    })
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    ses.setPermissionCheckHandler(() => false)
  }

  /**
   * Links. The window never leaves the interface, and a snapshot's frame never leaves its snapshot: a click on a web link
   * goes to the default browser, anything else the page does on its own is dropped. The click is recognised by the frame's
   * transient user activation (the `input-event` of a click inside an out-of-process frame does not reach the window).
   */
  guardNavigation(win: BrowserWindow): void {
    const wc = win.webContents
    const clicked = (frame: WebFrameMain | null | undefined): Promise<boolean> => (frame ? frame.executeJavaScript('navigator.userActivation.isActive').then(Boolean, () => false) : Promise.resolve(false))
    const handle = (url: string, event: Electron.Event | undefined, frame: WebFrameMain | null | undefined, isMainFrame: boolean) => {
      if (url.startsWith(`${UI_ORIGIN}/`)) return
      if (url.startsWith(`${SCHEME}://`)) return this.handleFileLink(win, url, event, frame, clicked)
      event?.preventDefault()
      void (!isMainFrame && WEB_LINK.test(url) ? clicked(frame) : Promise.resolve(false)).then((yes) => {
        if (yes) this.openExternal(url)
        else this.blocked.push(`navigation ${url}`)
      })
    }
    wc.on('will-frame-navigate', (event) => handle(event.url, event, event.frame, event.isMainFrame))
    wc.on('will-redirect', (event) => handle(event.url, event, event.frame, event.isMainFrame))
    wc.setWindowOpenHandler(({ url }) => {
      handle(url, undefined, null, false)
      return { action: 'deny' }
    })
  }

  /**
   * A link inside a snapshot to another of its files. A page stays in its frame; anything else (a PDF, a ZIP, a picture, a
   * text) is not shown in the frame: what a tab can show opens in one, and the rest is offered with Save As, as the guidelines ask.
   */
  private handleFileLink(win: BrowserWindow, url: string, event: Electron.Event | undefined, frame: WebFrameMain | null | undefined, clicked: (f: WebFrameMain | null | undefined) => Promise<boolean>): void {
    const target = new URL(url)
    const snapshot = this.registry.get(target.hostname)
    if (!snapshot) return
    let name: string
    try {
      name = decodeURIComponent(target.pathname).replace(/^\/+/, '')
    } catch {
      return
    }
    const type = snapshot.types.get(name)
    if (!name || name === snapshot.manifest.pages[0].entry || !snapshot.archive.get(name) || /^(text\/html|application\/xhtml\+xml)\b/.test(type ?? '')) return
    event?.preventDefault()
    void clicked(frame).then(async (yes) => {
      if (!yes || win.isDestroyed()) return
      const kind = viewKind(type, name, snapshot.archive.get(name)!.size)
      if (kind === 'other') win.webContents.send('wsnp:saved', { name, result: await this.save(win, snapshot.id, name) })
      else win.webContents.send('wsnp:open-file', { snapshotId: snapshot.id, path: name })
    })
  }

  /** Opens files and reports each outcome; a file already open is not opened again. */
  async openPaths(paths: string[]): Promise<OpenResult[]> {
    const results: OpenResult[] = []
    for (const file of paths) {
      const outcome: OpenOutcome = await this.registry.openPath(file).catch((err: Error) => ({ ok: false as const, path: file, issues: [{ code: 'read-error' as const, path: path.basename(file), detail: err.message }], omitted: 0 }))
      if (outcome.ok) {
        this.recent.add(outcome.snapshot.path)
        results.push({ ok: true, snapshot: infoOf(outcome.snapshot), already: outcome.already })
      } else results.push(outcome)
    }
    return results
  }

  /** Files the system asked for: shown at once when the interface is listening, kept for it otherwise. */
  async openFromSystem(win: BrowserWindow | undefined, paths: string[]): Promise<void> {
    if (!paths.length) return
    const results = await this.openPaths(paths)
    if (this.listening && win && !win.isDestroyed()) {
      win.webContents.send('wsnp:opened', results)
      if (win.isMinimized()) win.restore()
      win.focus()
    } else this.pending.push(...results)
  }

  async save(win: BrowserWindow, id: string, name: string): Promise<SaveResult> {
    const stream = await this.registry.stream(id, name)
    if (!stream) return { saved: false, reason: 'error', message: 'The file is not in the snapshot.' }
    const picked = await dialog.showSaveDialog(win, { defaultPath: path.basename(name) })
    if (picked.canceled || !picked.filePath) {
      stream.destroy()
      return { saved: false, reason: 'cancelled' }
    }
    try {
      await pipeline(stream, fs.createWriteStream(picked.filePath))
      return { saved: true, path: picked.filePath }
    } catch (err) {
      return { saved: false, reason: 'error', message: (err as Error).message }
    }
  }

  private async verify(win: BrowserWindow, id: string): Promise<void> {
    const snapshot = this.registry.get(id)
    if (!snapshot) return
    this.integrity.get(id)?.abort()
    const controller = new AbortController()
    this.integrity.set(id, controller)
    const send = (event: IntegrityEvent) => !win.isDestroyed() && win.webContents.send('wsnp:integrity', event)
    let last = 0
    const report = await verifyContents(snapshot.archive, snapshot.manifest, {
      signal: controller.signal,
      onProgress: (done, total) => {
        const now = Date.now()
        if (now - last > 100) {
          last = now
          send({ id, state: 'running', done, total })
        }
      },
    })
    if (this.integrity.get(id) === controller) this.integrity.delete(id)
    if (!report.aborted) send({ id, state: 'done', report })
  }

  /** IPC for the interface. Only the window's own top frame may call: a snapshot's frame has no preload, and is refused anyway. */
  registerIpc(getWindow: () => BrowserWindow | undefined): void {
    const fromInterface = (event: IpcMainInvokeEvent) => {
      const win = getWindow()
      if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !event.senderFrame.url.startsWith(`${UI_ORIGIN}/`)) throw new Error('refused')
      return win
    }
    const handle = <A extends unknown[], R>(channel: string, fn: (win: BrowserWindow, ...args: A) => R | Promise<R>) =>
      ipcMain.handle(channel, (event, ...args) => fn(fromInterface(event), ...(args as A)))
    const isPaths = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 100 && v.every((p) => typeof p === 'string' && p.length < 4096)

    handle('wsnp:ready', async () => {
      this.listening = true
      const results = this.pending
      this.pending = []
      return results
    })
    handle('wsnp:open-dialog', async (win) => {
      const picked = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'WSNP snapshot', extensions: ['wsnp'] }, { name: 'All files', extensions: ['*'] }],
      })
      return picked.canceled ? [] : this.openPaths(picked.filePaths)
    })
    handle('wsnp:open-paths', (_win, paths: unknown) => (isPaths(paths) ? this.openPaths(paths) : []))
    handle('wsnp:close', async (_win, id: unknown) => {
      if (typeof id !== 'string') return
      this.integrity.get(id)?.abort()
      this.integrity.delete(id)
      await this.registry.close(id)
    })
    handle('wsnp:read-file', async (_win, id: unknown, name: unknown): Promise<ReadResult> => {
      if (typeof id !== 'string' || typeof name !== 'string') return { error: 'no-file' }
      const read = await this.registry.read(id, name, BINARY_LIMIT)
      return 'bytes' in read ? { bytes: new Uint8Array(read.bytes) } : read
    })
    handle('wsnp:save-as', (win, id: unknown, name: unknown): Promise<SaveResult> | SaveResult =>
      typeof id === 'string' && typeof name === 'string' ? this.save(win, id, name) : { saved: false, reason: 'error' })
    handle('wsnp:verify', (win, id: unknown) => (typeof id === 'string' ? this.verify(win, id) : undefined))
    handle('wsnp:open-external', (_win, url: unknown) => {
      if (typeof url === 'string' && WEB_LINK.test(url)) this.openExternal(url)
    })
    handle('wsnp:copy', (_win, text: unknown) => {
      if (typeof text === 'string' && text.length < 100_000) clipboard.writeText(text)
    })
    handle('wsnp:reveal', (_win, id: unknown) => {
      const snapshot = typeof id === 'string' ? this.registry.get(id) : undefined
      if (snapshot) shell.showItemInFolder(snapshot.path)
    })
    handle('wsnp:recent-list', () => this.recent.list())
    handle('wsnp:recent-clear', () => this.recent.clear())
  }
}
