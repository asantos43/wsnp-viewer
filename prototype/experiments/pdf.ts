import fs from 'node:fs'
import path from 'node:path'
import { SnapshotView } from '../../electron/snapshot-view.ts'
import { printPageFiles, tallPageFiles, writeWsnp } from '../../fixtures/build.ts'
import { printToPdf } from '../../export/pdf.ts'
import { pdfInfo } from '../pdf-text.ts'
import type { Experiment } from '../harness.ts'

const HEADER = 'Harbor news - https://harbortimes.example/'
const FOOTER = 'Captured 2026-09-29 - saved by wsnp-viewer'

/** Item 4: the PDF, with running header and footer, and the screen or print styles. */
export const pdf: Experiment = async (r, ctx) => {
  const file = path.join(ctx.workDir, 'print.wsnp')
  const files = printPageFiles(60)
  files[0].data = (files[0].data as string).replace('</style>', '@page{@top-center{content:"PAGEBOX-TOP"}}</style>')
  await writeWsnp(file, files)
  const view = await SnapshotView.open(file, { openExternal: ctx.openExternal, width: 1280, height: 800 })
  try {
    const wc = view.webContents
    const save = (name: string, bytes: Buffer) => { if (ctx.cacheDir) fs.writeFileSync(path.join(ctx.cacheDir, name), bytes) }

    const print = await printToPdf(wc, { media: 'print', header: HEADER, footer: FOOTER })
    save('print.pdf', print)
    const p = await pdfInfo(print)
    r.check('a paginated PDF has several pages', p.pages > 1, p.pages)
    r.check('the running header names the source address', p.pageTexts.every((t) => t.includes(HEADER)), p.pageTexts.map((t) => t.includes(HEADER)))
    r.check('the running footer has the capture date and "page / total"', p.pageTexts.every((t, i) => t.includes(FOOTER) && t.includes(`${i + 1} / ${p.pages}`)))
    r.check('print media: print-only text is there and screen-only text is not', p.text.includes('visible in print only') && !p.text.includes('visible on screen only'))
    r.check('the page text is real text (selectable, searchable), not a picture', p.text.includes('Paragraph 1.') && p.text.includes('Paragraph 60.'))
    r.note(p.text.includes('PAGEBOX-TOP') ? 'CSS @page margin boxes ARE drawn by this Chromium' : 'CSS @page margin boxes are NOT drawn by this Chromium (use the header and footer templates)')
    r.metric('printPdf', { pages: p.pages, kb: Math.round(print.length / 1024) })

    const screen = await printToPdf(wc, { media: 'screen', header: HEADER, footer: FOOTER })
    const s = await pdfInfo(screen)
    r.check('screen media ("as on screen"): screen-only text is there and print-only text is not', s.text.includes('visible on screen only') && !s.text.includes('visible in print only'), { screenOnly: s.text.includes('visible on screen only'), printOnly: s.text.includes('visible in print only') })
    r.metric('screenPdf', { pages: s.pages, kb: Math.round(screen.length / 1024) })

    const bare = await pdfInfo(await printToPdf(wc, { media: 'print' }))
    r.check('without header or footer templates none is printed', !bare.text.includes(HEADER) && !bare.text.includes('saved by wsnp-viewer'))

    // A "single long page": a custom paper as tall as the content.
    const tallFile = path.join(ctx.workDir, 'tall.wsnp')
    await writeWsnp(tallFile, tallPageFiles(60))
    const tall = await SnapshotView.open(tallFile, { openExternal: ctx.openExternal, width: 1280, height: 800 })
    try {
      const heightIn = 30000 / 96 // 312.5 in
      const tries: Record<string, string> = {}
      for (const inches of [100, 200, 250, heightIn + 1]) {
        try {
          const bytes = await printToPdf(tall.webContents, { paperWidth: 1280 / 96, paperHeight: inches, margin: 0 })
          const info = await pdfInfo(bytes)
          tries[`${Math.round(inches)} in`] = `ok, ${info.pages} page(s), ${Math.round(bytes.length / 1024)} KB`
        } catch (err) {
          tries[`${Math.round(inches)} in`] = `refused: ${(err as Error).message.slice(0, 80)}`
        }
      }
      r.metric('longPagePaperHeights', tries)
      r.check('a long-page request either works or is refused cleanly', Object.values(tries).every((t) => t.startsWith('ok') || t.startsWith('refused')))
      r.note(`a 312 in (30000 px) single page: ${tries[`${Math.round(heightIn + 1)} in`]}`)
    } finally {
      await tall.close()
    }
  } finally {
    await view.close()
  }
}
