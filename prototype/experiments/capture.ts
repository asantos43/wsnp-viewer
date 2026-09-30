import path from 'node:path'
import { SnapshotView } from '../../electron/snapshot-view.ts'
import { BLOCK_HEIGHT, blockColor, tallPageFiles, writeWsnp } from '../../fixtures/build.ts'
import { captureFullPage, captureVisible, probeSingleShot, Stitcher } from '../../export/capture.ts'
import { withMemoryPeak, type Experiment, type Recorder } from '../harness.ts'
import { appMemoryMb } from '../memory.ts'

const BLOCKS = 60 // 30 000 px

function hslToRgb(text: string): number[] {
  const [h, s, l] = (/hsl\((\d+), (\d+)%, (\d+)%\)/.exec(text) ?? []).slice(1).map(Number)
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}
const close = (a: number[], b: number[], tolerance: number) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= tolerance)

/** Item 3: the whole page as an image, in strips, and where the browser's own limit is. */
export const capture: Experiment = async (r, ctx) => {
  const file = path.join(ctx.workDir, 'tall.wsnp')
  await writeWsnp(file, tallPageFiles(BLOCKS))
  const view = await SnapshotView.open(file, { openExternal: ctx.openExternal, width: 1280, height: 800, offscreen: true })
  const stitcher = await Stitcher.create()
  const wc = view.webContents
  try {
    const totalCss = BLOCKS * BLOCK_HEIGHT
    // One case: capture, then check the pixels at block centres and at the seams between strips.
    const run = async (label: string, options: { scale: number; format: 'png' | 'jpeg'; stripPx: number; maxPartPx: number }, tolerance: number) => {
      const wrong: string[] = []
      const repeats: number[] = []
      const { result, peakMb } = await withMemoryPeak(appMemoryMb, () =>
        captureFullPage(wc, stitcher, {
          width: 1280,
          ...options,
          onPart: async (s, part) => {
            const points: { x: number; y: number; expect: number[]; label: string }[] = []
            for (let i = 0; i < BLOCKS; i++) {
              const mid = i * BLOCK_HEIGHT + 300 // a spot with no text
              if (mid >= part.y && mid < part.y + part.height) points.push({ x: Math.round(900 * options.scale), y: Math.round((mid - part.y) * options.scale), expect: hslToRgb(blockColor(i)), label: `block ${i + 1}` })
            }
            for (let y = part.y + options.stripPx; y < part.y + part.height; y += options.stripPx) {
              // the last row of one strip and the first of the next: both must be the block's colour
              for (const g of [y - 1, y]) points.push({ x: Math.round(900 * options.scale), y: Math.round((g - part.y) * options.scale), expect: hslToRgb(blockColor(Math.floor(g / BLOCK_HEIGHT))), label: `seam at ${g}` })
            }
            const seen = await s.sample(points.map(({ x, y }) => ({ x, y })))
            points.forEach((p, i) => { if (!close(seen[i], p.expect, tolerance)) wrong.push(`${p.label} got ${seen[i].slice(0, 3)} want ${p.expect}`) })
            // The fixed header (black, 40 px) sits at the top of the page: does it come back at the top of later strips?
            for (let y = part.y; y < part.y + part.height; y += options.stripPx) {
              if (y === 0) continue
              const [px] = await s.sample([{ x: Math.round(100 * options.scale), y: Math.round((y - part.y + 10) * options.scale) }])
              if (px[0] < 20 && px[1] < 20 && px[2] < 20) repeats.push(y)
            }
          },
        }),
      )
      const heights = result.parts.map((p) => p.height)
      const expectedPx = Math.round(totalCss * options.scale)
      r.check(`${label}: ${result.parts.length} part(s) add up to the page (${expectedPx} px)`, heights.reduce((a, b) => a + b, 0) === expectedPx && result.cssHeight === totalCss, { heights, cssHeight: result.cssHeight })
      r.check(`${label}: pixels are right at block centres and at the seams`, wrong.length === 0, wrong.slice(0, 4))
      // What was really written: decode the first part again.
      const first = result.parts[0]
      const decoded = await stitcher.inspect(first.bytes, options.format, [{ x: Math.round(900 * options.scale), y: Math.round(300 * options.scale) }])
      r.check(`${label}: the encoded file decodes to the same size and colours`, decoded.width === first.width && decoded.height === first.height && close(decoded.pixels[0], hslToRgb(blockColor(0)), tolerance), { decoded: [decoded.width, decoded.height], want: [first.width, first.height] })
      r.metric(label, { ms: result.ms, strips: result.strips, parts: result.parts.length, peakMb, megabytes: Math.round(result.parts.reduce((n, p) => n + p.bytes.length, 0) / 1e5) / 10, fixedHeaderRepeatsAt: repeats })
      return { result, repeats }
    }

    const a = await run('png 1x, strips of 4096 px, parts of at most 16384 px', { scale: 1, format: 'png', stripPx: 4096, maxPartPx: 16384 }, 3)
    await run('png 2x, parts of at most 16384 px', { scale: 2, format: 'png', stripPx: 2048, maxPartPx: 16384 }, 3)
    await run('jpeg 1x, one canvas of 30000 px', { scale: 1, format: 'jpeg', stripPx: 4096, maxPartPx: 40000 }, 14)
    r.note(a.repeats.length ? `the fixed header is drawn again at the top of strips starting at y = ${a.repeats.join(', ')}` : 'the fixed header appears once, at the top of the page, and not again in later strips')

    // Where does a single screenshot give up?
    const single = await probeSingleShot(wc, { width: 1280 }, [8192, 16384, 24000, 30000, 45000, 65000])
    r.metric('singleShot', single.map((s) => (s.ok ? `${s.height}px ok, image ${s.got}, ${s.ms}ms, ${Math.round((s.bytes ?? 0) / 1024)}KB` : `${s.height}px FAILED ${s.error}`)))
    r.check('a single screenshot of the tallest page works or fails cleanly (no crash)', single.every((s) => s.ok || !!s.error))
    r.check('when a single screenshot works, it has the size asked for', single.filter((s) => s.ok).every((s) => s.got === `1280x${s.height}`), single.map((s) => s.got))

    // The preview of a .wsnp: what is on screen, at most 1280 px wide.
    const visible = await captureVisible(wc, { width: 1280, viewportHeight: 800, scale: 1 })
    const preview = await stitcher.shrink(visible, 640, 85)
    const info = await stitcher.inspect(preview, 'jpeg', [{ x: 10, y: 10 }])
    r.check('the preview (visible area, shrunk to 640 px) has the right proportions', info.width === 640 && info.height === 400, [info.width, info.height])
    r.metric('previewKb', Math.round(preview.length / 1024))
  } finally {
    stitcher.close()
    await view.close()
  }
}
export type { Recorder }
