import crypto from 'node:crypto'
import path from 'node:path'
import { Readable } from 'node:stream'
import { BrowserWindow, session, type WebFrameMain } from 'electron'
import { openArchive, type Archive } from '../../core/archive/reader.ts'
import { serveEntry } from '../../core/serve.ts'
import { networkProbeFiles, sampleFiles, writeWsnp, type FixtureFile } from '../../fixtures/build.ts'
import { SCHEME, UI_SCHEME } from '../../electron/snapshot-view.ts'
import { delay, startProbeServer, type Experiment } from '../harness.ts'

// Phase 1 spike (docs/UI-DESIGN.md, "The hard part"): show snapshots in `<iframe sandbox>` elements of
// the interface instead of one WebContentsView each, so that HTML can be drawn over a page.

const HOST_ORIGIN = `${UI_SCHEME}://host`
/** The interface page: only frames from `wsnp://` may be embedded, and it has no script of its own. */
const HOST_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>WSNP Viewer</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%;display:block}iframe.hidden{display:none}#bar{height:30px}#tabs{height:calc(100% - 30px)}</style></head>
<body><div id="bar">interface text that is not in a snapshot</div><div id="tabs"></div></body></html>`
const HOST_CSP = `default-src 'none'; frame-src ${SCHEME}: https: http:; style-src 'unsafe-inline'`

interface Slot {
  archive: Archive
  types: Map<string, string>
  entry?: string
  /** Overrides the policy (an empty string sends none): only to test the layer below it. */
  csp?: string
}

/** The candidate design: one window (the interface), one session, one iframe per snapshot. */
class IframeHost {
  readonly blocked: string[] = []
  readonly external: string[] = []
  readonly console: string[] = []
  readonly slots = new Map<string, Slot>()
  readonly window: BrowserWindow
  private readonly openExternal: (url: string) => void

  private constructor(openExternal: (url: string) => void) {
    this.openExternal = openExternal
    const partition = `ui-spike-${crypto.randomBytes(6).toString('hex')}`
    const ses = session.fromPartition(partition)
    this.window = new BrowserWindow({ show: false, width: 1280, height: 800, webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false } })
    this.bindProtocols(ses)
    this.guardSession(ses)
    this.guardNavigation()
    this.window.webContents.on('console-message', (event) => this.console.push(`${event.level}: ${event.message}`))
  }

  static async create(openExternal: (url: string) => void): Promise<IframeHost> {
    const host = new IframeHost(openExternal)
    await host.window.loadURL(`${HOST_ORIGIN}/index.html`)
    // On screen (not offscreen, not hidden): a click is routed into an out-of-process iframe only then.
    host.window.showInactive()
    return host
  }

  get webContents() {
    return this.window.webContents
  }

  private bindProtocols(ses: Electron.Session): void {
    ses.protocol.handle(UI_SCHEME, () => new Response(HOST_HTML, { headers: { 'content-type': 'text/html', 'content-security-policy': HOST_CSP } }))
    ses.protocol.handle(SCHEME, async (request) => {
      const url = new URL(request.url)
      const slot = this.slots.get(url.hostname)
      if (!slot) return new Response(null, { status: 403 })
      // The iframe's own `sandbox` attribute gives the opaque origin; the header adds the same directive.
      const res = await serveEntry(slot.archive, url.pathname, { range: request.headers.get('range') }, { types: slot.types, entry: slot.entry, sandbox: true, csp: slot.csp })
      const body: BodyInit | null = res.body instanceof Readable ? (Readable.toWeb(res.body) as ReadableStream) : res.body ? new Uint8Array(res.body) : null
      return new Response(body, { status: res.status, headers: res.headers })
    })
  }

  /** Nothing leaves: only the interface, and each snapshot's own files asked for by that snapshot. */
  private guardSession(ses: Electron.Session): void {
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      if (details.url.startsWith(`${HOST_ORIGIN}/`) || /^(data|blob):/.test(details.url)) return callback({})
      const wanted = /^wsnp:\/\/([^/]+)\//.exec(details.url)?.[1]
      if (wanted && this.slots.has(wanted)) {
        // For a frame's own navigation the requesting frame is the new frame (no address yet): its parent asked.
        const asking = (details.resourceType === 'subFrame' ? details.frame?.parent?.url : details.frame?.url) ?? ''
        const fromInterface = details.resourceType === 'subFrame' && asking.startsWith(`${HOST_ORIGIN}/`)
        const fromItself = asking.startsWith(`${SCHEME}://${wanted}/`)
        if (fromInterface || fromItself) return callback({})
      }
      this.blocked.push(`${details.resourceType} ${details.url} (asked by ${details.frame?.url ?? 'unknown'})`)
      callback({ cancel: true })
    })
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    ses.setPermissionCheckHandler(() => false)
  }

  /**
   * Links. `will-frame-navigate` fires for the snapshot's own iframe (where the input events of a
   * click inside an out-of-process iframe do not reliably reach the interface), so the click is
   * recognised by asking the frame whether it has a transient user activation.
   */
  private guardNavigation(): void {
    const wc = this.webContents
    const handle = (url: string, event: Electron.Event | undefined, frame: WebFrameMain | null | undefined) => {
      if (url.startsWith(`${HOST_ORIGIN}/`) || url.startsWith(`${SCHEME}://`)) return
      event?.preventDefault()
      const web = /^(https?|mailto):/.test(url)
      const activation = web && frame ? frame.executeJavaScript('navigator.userActivation.isActive').catch(() => false) : Promise.resolve(false)
      void activation.then((clicked) => {
        if (clicked) {
          this.external.push(url)
          this.openExternal(url)
        } else {
          this.blocked.push(`navigation ${url}`)
        }
      })
    }
    wc.on('will-frame-navigate', (event) => handle(event.url, event, event.frame))
    wc.on('will-redirect', (event) => handle(event.url, event, event.frame))
    wc.setWindowOpenHandler(({ url }) => {
      handle(url, undefined, null)
      return { action: 'deny' }
    })
  }

  /** Adds a snapshot as an iframe and waits until it has loaded. */
  async add(file: string, options: { hidden?: boolean; csp?: string } = {}): Promise<string> {
    const hidden = options.hidden ?? false
    const archive = await openArchive(file)
    const manifest = JSON.parse((await archive.read('manifest.json')).toString('utf8')) as { pages?: { entry?: string }[]; files?: { path: string; media_type?: string }[] }
    const id = `s${crypto.randomBytes(8).toString('hex')}`
    this.slots.set(id, { archive, types: new Map((manifest.files ?? []).filter((f) => f.media_type).map((f) => [f.path, f.media_type as string])), entry: manifest.pages?.[0]?.entry, csp: options.csp })
    await this.webContents.executeJavaScript(`new Promise((resolve) => {
      const f = document.createElement('iframe'); f.id = ${JSON.stringify(id)}; f.className = ${JSON.stringify(hidden ? 'hidden' : '')};
      f.setAttribute('sandbox', 'allow-scripts'); f.onload = () => resolve(true);
      f.src = ${JSON.stringify(`${SCHEME}://${id}/`)}; document.getElementById('tabs').append(f)
    })`)
    return id
  }

  /** Shows one snapshot and hides the others, as tabs do. */
  async show(id: string): Promise<void> {
    await this.webContents.executeJavaScript(`document.querySelectorAll('iframe').forEach((f) => f.classList.toggle('hidden', f.id !== ${JSON.stringify(id)}))`)
    await delay(200)
  }

  frameOf(id: string): WebFrameMain {
    const frame = this.webContents.mainFrame.frames.find((f) => f.url.startsWith(`${SCHEME}://${id}/`))
    if (!frame) throw new Error(`no frame for ${id}`)
    return frame
  }

  js<T>(id: string, code: string): Promise<T> {
    return this.frameOf(id).executeJavaScript(code) as Promise<T>
  }

  async close(): Promise<void> {
    this.window.destroy()
    await Promise.all([...this.slots.values()].map((s) => s.archive.close().catch(() => {})))
  }
}

const TEXT_PAGE = (word: string, times: number): FixtureFile[] => [
  {
    path: 'index.html',
    type: 'text/html',
    source: 'generated',
    data: `<!doctype html><html><head><meta charset="utf-8"><title>Text</title></head><body>${Array.from({ length: times }, (_, i) => `<p>the ${word} number ${i}</p>`).join('')}<a id="ext" href="https://example.com/more" style="position:fixed;left:20px;top:100px;display:block;width:200px;height:40px">a link</a></body></html>`,
  },
]

/** Point on screen (in the interface's coordinates) of an element of a snapshot's iframe. */
async function pointOf(host: IframeHost, id: string, selector: string): Promise<{ x: number; y: number }> {
  const inner = await host.js<{ x: number; y: number }>(id, `(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()`)
  const offset = await host.webContents.executeJavaScript(`(() => { const b = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y) } })()`)
  return { x: inner.x + offset.x, y: inner.y + offset.y }
}

/** Spike of phase 1: can the snapshot be shown in a sandboxed iframe of the interface? */
export const iframe: Experiment = async (r, ctx) => {
  const server = await startProbeServer()
  const host = await IframeHost.create(ctx.openExternal)
  try {
    // ---- 1. the snapshot loads in an iframe, and the page works under `sandbox` (no allow-same-origin) + policy
    const sampleFile = path.join(ctx.workDir, 'sample.wsnp')
    await writeWsnp(sampleFile, sampleFiles())
    const a = await host.add(sampleFile)
    const b = await host.add(sampleFile, { hidden: true })
    r.check('the snapshot loads in an iframe of the interface', host.frameOf(a).url.startsWith(`${SCHEME}://${a}/`))
    r.check('the iframe has an opaque origin', (await host.js(a, 'window.origin')) === 'null')
    r.check('its _wsnp script runs under the policy', (await host.js(a, 'document.documentElement.dataset.offline')) === 'ready')
    await host.js(a, "document.getElementById('next').click()")
    r.check('the script keeps working (Next shows Item 2)', (await host.js(a, "document.getElementById('item').textContent")) === 'Item 2')
    r.check('the stylesheet and the picture are served from the archive', (await host.js(a, "getComputedStyle(document.getElementById('item')).color")) === 'rgb(0, 128, 128)' && (await host.js(a, "createImageBitmap(document.getElementById('logo')).then((x) => x.width, () => 0)")) === 1)
    r.check('a font is read across origins (CORS header)', (await host.js(a, "fetch('assets/fonts/f.woff2').then((x) => x.status, (e) => String(e))")) === 200)
    r.check('storage is refused', (await host.js(a, "(() => { try { localStorage.length; return 'allowed' } catch (e) { return e.name } })()")) === 'SecurityError')
    r.check('the policy stops an inline script', (await host.js(a, "(() => { const s = document.createElement('script'); s.textContent = 'window.__inline = 1'; document.head.append(s); return window.__inline === undefined })()")) === true)
    r.check('the policy stops eval', (await host.js(a, "(() => { try { eval('1'); return 'allowed' } catch (e) { return e.name } })()")) === 'EvalError')
    r.check('mimetype is not served to the page', (await host.js(a, "fetch('/mimetype').then((x) => x.status)")) === 404)
    r.check('the page cannot read the interface (parent.document)', (await host.js(a, "(() => { try { return parent.document.title } catch (e) { return e.name } })()")) === 'SecurityError')
    r.check('the page cannot navigate the interface (top.location)', (await host.js(a, "(() => { try { top.location.href = 'https://evil.example/top'; return 'allowed' } catch (e) { return e.name } })()")) !== undefined && host.external.length === 0)
    await delay(300)
    r.check('the interface stayed where it was after that attempt', host.webContents.getURL().startsWith(`${HOST_ORIGIN}/`), host.webContents.getURL())
    r.check('nothing was cancelled for a normal page', host.blocked.length === 0, host.blocked)
    r.check('a snapshot cannot read another one', (await host.js(a, `fetch('${SCHEME}://${b}/index.html').then((x) => x.status, () => 'blocked')`)) === 'blocked')
    r.check('the interface session persists nothing on disk', !host.webContents.session.storagePath)
    const other = host.frameOf(a).processId !== host.webContents.mainFrame.processId
    r.metric('snapshotInSeparateProcess', other)
    r.note(`the snapshot's iframe ${other ? 'runs in its own process' : 'shares the interface process'} (osProcessId ${host.frameOf(a).osProcessId} against ${host.webContents.mainFrame.osProcessId})`)
    host.blocked.length = 0

    // ---- the layer below the policy, on its own: the same probe page served with NO policy
    const bareFile = path.join(ctx.workDir, 'bare.wsnp')
    await writeWsnp(bareFile, networkProbeFiles(server.origin))
    const bare = await host.add(bareFile, { csp: '' })
    await delay(1500)
    r.check('without any policy, the probe page still runs', (await host.js(bare, 'document.documentElement.dataset.probe')) === 'ran')
    r.check('without any policy, the requests are cancelled below the page and none reach the server', host.blocked.length >= 12 && server.hits.length === 0, { cancelled: host.blocked.length, hits: server.hits })
    r.metric('probeCancelledWithoutPolicy', host.blocked.length)
    r.note(`cancelled below the policy: ${[...new Set(host.blocked.map((x) => x.split(' ')[0]))].sort().join(', ')}`)
    host.blocked.length = 0
    r.check('without any policy, a snapshot still cannot read another one (cancelled by the session)', (await host.js(bare, `fetch('${SCHEME}://${b}/index.html').then((x) => x.status, () => 'blocked')`)) === 'blocked' && host.blocked.some((line) => line.includes(`${SCHEME}://${b}/`)), host.blocked)
    host.blocked.length = 0

    // ---- 2. nothing reaches the network, from inside the iframe
    const probeFile = path.join(ctx.workDir, 'probe.wsnp')
    await writeWsnp(probeFile, networkProbeFiles(server.origin))
    const probe = await host.add(probeFile)
    await delay(1500)
    r.check('the probe page ran inside the iframe', (await host.js(probe, 'document.documentElement.dataset.probe')) === 'ran')
    r.check('no request reached the server on this computer', server.hits.length === 0, server.hits)
    const byPolicy = host.console.filter((line) => /Content Security Policy/.test(line)).length
    r.note(`the probe page's 16 attempts: ${byPolicy} stopped by the policy, ${host.blocked.length} cancelled below the page (${[...new Set(host.blocked.map((x) => x.split(' ')[0]))].sort().join(', ')})`)
    r.metric('probeStoppedByPolicy', byPolicy)
    r.metric('probeCancelledBelowPage', host.blocked.length)

    // ---- 3. links: a script cannot leave, a real click goes to the system browser
    const before = host.webContents.getURL()
    await host.js(probe, "(() => { location.href = 'https://evil.example/nav'; return true })()")
    await delay(500)
    r.check('a page script that navigates away is stopped and nothing is opened', host.external.length === 0 && host.frameOf(probe).url.startsWith(`${SCHEME}://${probe}/`), { external: host.external, frame: host.frameOf(probe).url })
    await host.show(probe)
    const spot = await pointOf(host, probe, '#ext')
    host.webContents.focus()
    // The DevTools protocol routes the pointer events like a real mouse does (webContents.sendInputEvent cannot reach an out-of-process iframe).
    const dbg = host.webContents.debugger
    dbg.attach('1.3')
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'] as const) {
      await dbg.sendCommand('Input.dispatchMouseEvent', { type, x: spot.x, y: spot.y, button: 'left', clickCount: 1 })
    }
    dbg.detach()
    await delay(800)
    r.check('a real click on a web link in the iframe is handed to the system browser', host.external.includes('https://example.com/clicked'), { external: host.external })
    r.check('the interface and the snapshot both stay put', host.webContents.getURL() === before && host.frameOf(probe).url.startsWith(`${SCHEME}://${probe}/`))

    // ---- 4. find in page across the iframe
    const textFile = path.join(ctx.workDir, 'text.wsnp')
    await writeWsnp(textFile, TEXT_PAGE('lighthouse', 3))
    const shown = await host.add(textFile)
    const found = (text: string, options?: Electron.FindInPageOptions) =>
      new Promise<Electron.FoundInPageResult>((resolve) => {
        const on = (_e: Electron.Event, result: Electron.FoundInPageResult) => {
          if (!result.finalUpdate) return
          host.webContents.off('found-in-page', on)
          resolve(result)
        }
        host.webContents.on('found-in-page', on)
        host.webContents.findInPage(text, options)
      })
    // Only the iframe that is shown counts: hide every other one, as tabs do.
    await host.show(shown)
    const hit = await Promise.race([found('lighthouse'), delay(5000).then(() => undefined)])
    r.check('findInPage finds text inside the iframe, with the number of matches', hit?.matches === 3, hit)
    const next = await Promise.race([
      new Promise<Electron.FoundInPageResult>((resolve) => {
        const on = (_e: Electron.Event, result: Electron.FoundInPageResult) => {
          if (!result.finalUpdate) return
          host.webContents.off('found-in-page', on)
          resolve(result)
        }
        host.webContents.on('found-in-page', on)
        host.webContents.findInPage('lighthouse', { findNext: true, forward: true })
      }),
      delay(5000).then(() => undefined),
    ])
    r.check('the next match is number 2', next?.activeMatchOrdinal === 2, next)
    const none = await Promise.race([found('zzz-not-there'), delay(5000).then(() => undefined)])
    r.check('a text that is not there gives 0 matches', none?.matches === 0, none)
    const interfaceText = await Promise.race([found('interface text'), delay(5000).then(() => undefined)])
    r.note(`the interface's own text counts as a match too (${interfaceText?.matches} for "interface text"): the find widget has to ask the frame, or the interface text must be left out`)
    r.metric('findInterfaceTextMatches', interfaceText?.matches)
    host.webContents.stopFindInPage('clearSelection')

    // ---- 5. an overlay drawn over the page is plain HTML: it is on top in a real screenshot
    await host.webContents.executeJavaScript(`(() => { const o = document.createElement('div'); o.id = 'overlay'; o.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;background:rgb(255,0,255);z-index:10'; document.body.append(o) })()`)
    await delay(300)
    const image = await host.webContents.capturePage()
    const size = image.getSize()
    const pixel = image.crop({ x: Math.floor(size.width / 2), y: Math.floor(size.height / 2), width: 1, height: 1 }).toBitmap()
    r.check('an HTML overlay is drawn above the iframe (the captured pixel is the overlay colour)', pixel[0] === 255 && pixel[1] === 0 && pixel[2] === 255, [...pixel])
    r.check('no policy violation, and the probe server was never reached', server.hits.length === 0, server.hits)
  } finally {
    await host.close()
    await server.close()
  }
}
