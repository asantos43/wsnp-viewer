import path from 'node:path'
import { networkProbeFiles, sampleFiles, writeWsnp } from '../../fixtures/build.ts'
import { SnapshotView } from '../../electron/snapshot-view.ts'
import { delay, startProbeServer, type Experiment } from '../harness.ts'

const js = <T>(view: SnapshotView, code: string) => view.webContents.executeJavaScript(code, false) as Promise<T>

/** Item 1: one `wsnp://` origin per snapshot, the policy, and nothing reaching the network. */
export const isolation: Experiment = async (r, ctx) => {
  const server = await startProbeServer()
  const open = (file: string, sandbox = false) => SnapshotView.open(file, { sandbox, openExternal: ctx.openExternal, width: 1280, height: 800 })
  const opened: SnapshotView[] = []
  try {
    // ---- a page that tries every way to contact a server on this computer
    const probeFile = path.join(ctx.workDir, 'probe.wsnp')
    await writeWsnp(probeFile, networkProbeFiles(server.origin))
    const probe = await open(probeFile)
    opened.push(probe)
    await delay(1500)
    r.check('the probe page loaded and its own script ran', (await js(probe, 'document.documentElement.dataset.probe')) === 'ran')
    r.check('no request reached the server on this computer', server.hits.length === 0, server.hits)
    r.metric('probeStoppedByPolicy', probe.console.filter((line) => /Content Security Policy/.test(line)).length)
    r.note(`with the policy, ${probe.console.filter((line) => /Content Security Policy/.test(line)).length} attempts were stopped by it before any request was made`)

    // ---- the layer below the policy, on its own: the same page served with NO policy
    const bareFile = path.join(ctx.workDir, 'bare.wsnp')
    await writeWsnp(bareFile, networkProbeFiles(server.origin))
    const bare = await SnapshotView.open(bareFile, { csp: '', openExternal: ctx.openExternal })
    opened.push(bare)
    await delay(1500)
    r.check('without any policy, the probe page still runs', (await js(bare, 'document.documentElement.dataset.probe')) === 'ran')
    r.check('without any policy, the requests are cancelled below the page and none reach the server', bare.blocked.length >= 12 && server.hits.length === 0, { cancelled: bare.blocked.length, hits: server.hits })
    r.metric('probeCancelledWithoutPolicy', bare.blocked.length)
    r.note(`cancelled below the policy: ${[...new Set(bare.blocked.map((b) => b.split(' ')[0]))].sort().join(', ')}`)

    // ---- links: a script cannot leave, a click on a link goes to the system browser
    const before = probe.webContents.getURL()
    await js(probe, "(() => { location.href = 'https://evil.example/nav'; return true })()")
    await delay(500)
    r.check('a page script that navigates away is stopped and nothing is opened', probe.external.length === 0 && probe.webContents.getURL() === before, { external: probe.external, url: probe.webContents.getURL() })
    const spot = await js<{ x: number; y: number }>(probe, "(() => { const b = document.getElementById('ext').getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) } })()")
    probe.webContents.focus()
    for (const type of ['mouseDown', 'mouseUp'] as const) probe.webContents.sendInputEvent({ type, x: spot.x, y: spot.y, button: 'left', clickCount: 1 })
    await delay(800)
    r.check('a real click on a web link is handed to the system browser, and the view stays put', probe.external.includes('https://example.com/clicked') && probe.webContents.getURL() === before, { external: probe.external, url: probe.webContents.getURL() })

    // ---- a page that works: script, style, image, and the policy
    const sampleFile = path.join(ctx.workDir, 'sample.wsnp')
    await writeWsnp(sampleFile, sampleFiles())
    const a = await open(sampleFile)
    const b = await open(sampleFile)
    opened.push(a, b)
    r.check('the page loaded without a failed load', a.failedLoads.length === 0, a.failedLoads)
    const loadedLogs = { a: a.console.length }
    r.check('its _wsnp script runs under the policy', (await js(a, 'document.documentElement.dataset.offline')) === 'ready')
    await js(a, "document.getElementById('next').click()")
    r.check('the script keeps working (Next shows Item 2)', (await js(a, "document.getElementById('item').textContent")) === 'Item 2')
    r.check('the stylesheet and the picture are served from the archive', (await js(a, "getComputedStyle(document.getElementById('item')).color")) === 'rgb(0, 128, 128)' && (await js(a, "createImageBitmap(document.getElementById('logo')).then((b) => b.width, () => 0)")) === 1)
    r.check('the policy stops an inline script', (await js(a, "(() => { const s = document.createElement('script'); s.textContent = 'window.__inline = 1'; document.head.append(s); return window.__inline === undefined })()")) === true)
    r.check('the policy stops eval', (await js(a, "(() => { try { eval('1'); return 'allowed' } catch (e) { return e.name } })()")) === 'EvalError')
    r.check('nothing was cancelled for a normal page', a.blocked.length === 0, a.blocked)
    r.check('mimetype is not served to the page', (await js(a, "fetch('/mimetype').then((x) => x.status)")) === 404)
    r.check('a snapshot cannot read another one', (await js(a, `fetch('${b.origin}/index.html').then((x) => x.status, () => 'blocked')`)) === 'blocked')
    r.check('each snapshot has an origin of its own', a.origin !== b.origin && (await js(a, 'location.origin')) === a.origin)
    r.check('nothing is kept on disk: the session is in memory', !a.webContents.session.storagePath)

    // ---- the same page with the `sandbox` directive (an opaque origin, like an iframe without allow-same-origin)
    const boxed = await open(sampleFile, true)
    opened.push(boxed)
    const boxedLogs = boxed.console.length
    r.check('sandbox directive: the page has an opaque origin', (await js(boxed, 'window.origin')) === 'null')
    r.check('sandbox directive: the script still runs', (await js(boxed, 'document.documentElement.dataset.offline')) === 'ready')
    await js(boxed, "document.getElementById('next').click()")
    r.check('sandbox directive: the page still works (Next shows Item 2)', (await js(boxed, "document.getElementById('item').textContent")) === 'Item 2')
    r.check('sandbox directive: a font is read across origins (CORS header)', (await js(boxed, "fetch('assets/fonts/f.woff2').then((x) => x.status, (e) => String(e))")) === 200)
    r.check('sandbox directive: storage is refused', (await js(boxed, "(() => { try { localStorage.length; return 'allowed' } catch (e) { return e.name } })()")) === 'SecurityError')
    r.check('sandbox directive: a request to another snapshot is still cancelled', (await js(boxed, `fetch('${b.origin}/index.html').then((x) => x.status, () => 'blocked')`)) === 'blocked')
    r.check('sandbox directive: nothing cancelled for a normal page', boxed.blocked.length === 0, boxed.blocked)
    const violations = a.console.slice(0, loadedLogs.a).concat(boxed.console.slice(0, boxedLogs)).filter((line) => /Content Security Policy|Refused to/.test(line))
    r.check('loading a normal page logs no policy violation (the ones later are the deliberate attempts)', violations.length === 0, violations)
    r.check('the probe server was never reached, over the whole experiment', server.hits.length === 0, server.hits)
  } finally {
    await Promise.all(opened.map((v) => v.close().catch(() => {})))
    await server.close()
  }
}
