import fs from 'node:fs'
import path from 'node:path'
import { SnapshotView } from '../../electron/snapshot-view.ts'
import { openArchive } from '../../core/archive/reader.ts'
import { captureVisible, Stitcher } from '../../export/capture.ts'
import { writePageKeepZip } from '../../fixtures/build.ts'
import { convertPageKeepZip } from '../../core/convert/pagekeep.ts'
import { delay, type Experiment, type Recorder } from '../harness.ts'
import { validateWsnp } from '../validate-min.ts'

const GENERATOR = { name: 'wsnp-viewer (phase 0 prototype)', version: '0.0.0' }
const js = <T>(view: SnapshotView, code: string) => view.webContents.executeJavaScript(code, false) as Promise<T>

/** Item 5: PageKeep ZIP → .wsnp, checked by a validator, then opened in the isolated view. */
export const convert: Experiment = async (r, ctx) => {
  const stitcher = await Stitcher.create()
  try {
    const cases: { label: string; zip: string; synthetic: boolean }[] = []
    for (const old of [false, true]) {
      const zip = path.join(ctx.workDir, old ? 'old.zip' : 'new.zip')
      await writePageKeepZip(zip, { old })
      cases.push({ label: old ? 'synthetic ZIP, early format ("Page Snapshot 1.0.0")' : 'synthetic ZIP, current format', zip, synthetic: true })
    }
    if (ctx.realZip) cases.push({ label: 'real PageKeep ZIP', zip: ctx.realZip, synthetic: false })
    else r.note('no real PageKeep ZIP given (use --real-zip=FILE or WSNP_REAL_ZIP): only synthetic ones were converted')

    for (const c of cases) {
      const out = path.join(ctx.workDir, `${path.basename(c.zip, '.zip')}.wsnp`)
      const t0 = Date.now()
      const first = await convertPageKeepZip(c.zip, out, { generator: GENERATOR })
      const convertMs = Date.now() - t0
      const t1 = Date.now()
      const problems = await validateWsnp(out)
      const validateMs = Date.now() - t1
      r.check(`${c.label}: the converted file passes the validator`, problems.length === 0, problems.slice(0, 5))

      const view = await SnapshotView.open(out, { openExternal: ctx.openExternal, width: 1280, height: 800, offscreen: true })
      try {
        const loadedIn = Date.now() - t1
        await delay(1200)
        r.check(`${c.label}: the page loads with no failed load`, view.failedLoads.length === 0, view.failedLoads.slice(0, 3))
        const scripts = await js<{ total: number; own: number }>(view, "(() => { const s = [...document.scripts].filter((x) => !/json/.test(x.type)); return { total: s.length, own: s.filter((x) => x.getAttribute('src')?.startsWith('_wsnp/')).length } })()")
        r.check(`${c.label}: every script is a file of _wsnp/`, scripts.total === scripts.own, scripts)
        r.check(`${c.label}: nothing had to be cancelled below the page`, view.blocked.length === 0, view.blocked.slice(0, 5))
        if (c.synthetic) await syntheticChecks(r, view, c.label, first.manifest, out)

        const preview = await stitcher.shrink(await captureVisible(view.webContents, { width: 1280, viewportHeight: 800 }), 1280, 85)
        if (!c.synthetic) fs.writeFileSync(path.join(ctx.cacheDir, 'real-preview.jpg'), preview) // private: .cache is not committed
        const second = await convertPageKeepZip(c.zip, out, { generator: GENERATOR, preview })
        const again = await validateWsnp(out)
        r.check(`${c.label}: with the preview added, the file still passes`, again.length === 0 && second.manifest.preview === '_wsnp/preview.jpg', again.slice(0, 5))

        const kinds: Record<string, number> = {}
        for (const w of first.warnings) kinds[w.replace(/"[^"]*"/g, '"…"')] = (kinds[w.replace(/"[^"]*"/g, '"…"')] ?? 0) + 1
        r.metric(c.label, { convertMs, validateMs, convertPlusLoadMs: loadedIn, zipKb: Math.round(fs.statSync(c.zip).size / 1024), wsnpKb: Math.round(fs.statSync(out).size / 1024), previewKb: Math.round(preview.length / 1024), stats: first.stats, warningKinds: kinds })
      } finally {
        await view.close()
      }
    }
  } finally {
    stitcher.close()
  }
}

async function syntheticChecks(r: Recorder, view: SnapshotView, label: string, manifest: Record<string, unknown>, file: string): Promise<void> {
  r.check(`${label}: the offline script (moved out of the page) runs`, (await js(view, 'document.documentElement.dataset.offline')) === 'ready')
  await js(view, "document.getElementById('next').click()")
  r.check(`${label}: the page works (Next shows Item 2)`, (await js(view, "document.getElementById('item').textContent")) === 'Item 2')
  r.check(`${label}: the stylesheet, its font and import were moved and still resolve`, (await js(view, "getComputedStyle(document.getElementById('item')).color")) === 'rgb(0, 128, 128)')
  // Not `naturalWidth`: for an <img srcset> it can read 0 while the picture is fine (the candidate chosen at
  // another pixel ratio), so the picture itself is measured.
  const width = await js<number>(view, "createImageBitmap(document.getElementById('logo')).then((b) => b.width, () => 0)")
  const src = await js<string>(view, "document.getElementById('logo').getAttribute('src')")
  r.check(`${label}: the picture (in src and srcset) loads from assets/images/`, width === 1 && src === 'assets/images/logo-1qg48nw.png', { width, src, errors: view.requestErrors })
  r.check(`${label}: the download link points into assets/files/`, (await js(view, "document.getElementById('dl').getAttribute('href')")) === 'assets/files/notes-9zz9zz.pdf')
  const zip = await openArchive(file)
  const css = (await zip.read('assets/styles/site-1x05wni.css')).toString()
  await zip.close()
  r.check(`${label}: CSS references now go between the folders (../fonts/…)`, css.includes('../fonts/font-2ab.woff2') && css.includes('base-2b7c.css'), css.slice(0, 120))
  const m = manifest as { title: string; description: string; source: { canonical: string; language: string }; converted_from: { tool: string }; failed: unknown[]; files: { path: string }[] }
  r.check(`${label}: the manifest has title, description, canonical, language, origin and the failed list`, m.title === 'Harbor news' && m.description === 'News from the harbor.' && m.source.canonical === 'https://harbortimes.example/news' && m.source.language === 'en' && m.failed.length === 1 && /Page Snapshot|PageKeep/.test(m.converted_from.tool), m)
  r.check(`${label}: the JSON data script stayed in the page`, (await js(view, "!!document.getElementById('snap-pagers')")) === true)
}
