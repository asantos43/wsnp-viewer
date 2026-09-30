import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { SnapshotView } from '../../electron/snapshot-view.ts'
import { openArchive } from '../../core/archive/reader.ts'
import { serveEntry } from '../../core/serve.ts'
import { bigChunk, writeBigWsnp } from '../../fixtures/build.ts'
import { withMemoryPeak, type Experiment } from '../harness.ts'
import { appMemoryMb } from '../memory.ts'

const CHUNK = 1 << 20

/** The bytes [start, start + length) of the big file, made again from the chunk recipe. */
function expected(start: number, length: number): Buffer {
  const out = Buffer.alloc(length)
  for (let pos = start, at = 0; at < length; ) {
    const inside = pos % CHUNK
    const n = Math.min(CHUNK - inside, length - at)
    bigChunk(Math.floor(pos / CHUNK)).copy(out, at, inside, inside + n)
    at += n
    pos += n
  }
  return out
}

const mb = (bytes: number) => Math.round(bytes / (1 << 20))

/** Item 2: a very big .wsnp is opened and read by ranges, never loaded whole. */
export const large: Experiment = async (r, ctx) => {
  const file = path.join(ctx.cacheDir, `big-${ctx.bigMb}.wsnp`)
  let bigSha256: string
  const sizeOfBig = ctx.bigMb * CHUNK
  if (!fs.existsSync(file)) {
    const { result, peakMb } = await withMemoryPeak(appMemoryMb, async () => {
      const started = Date.now()
      const made = await writeBigWsnp(file, ctx.bigMb)
      return { ...made, ms: Date.now() - started }
    })
    bigSha256 = result.bigSha256
    r.metric('fixtureWriteMs', result.ms)
    r.metric('fixtureWritePeakMb', peakMb)
  } else {
    const a = await openArchive(file)
    bigSha256 = (JSON.parse((await a.read('manifest.json')).toString()) as { files: { path: string; sha256: string }[] }).files.find((f) => f.path === 'assets/media/big.bin')!.sha256
    await a.close()
  }
  r.metric('fileMb', mb(fs.statSync(file).size))

  const rssBefore = appMemoryMb()
  const opened = await withMemoryPeak(appMemoryMb, async () => {
    const started = process.hrtime.bigint()
    const archive = await openArchive(file)
    return { archive, ms: Number(process.hrtime.bigint() - started) / 1e6 }
  })
  const { archive } = opened.result
  r.metric('openArchiveMs', Math.round(opened.result.ms * 10) / 10)
  r.metric('openArchivePeakMb', opened.peakMb)
  r.check('the big entry is stored and has the size that was written', archive.get('assets/media/big.bin')?.method === 0 && archive.get('assets/media/big.bin')?.size === sizeOfBig)

  // The page next to the big file.
  const html = await serveEntry(archive, '/index.html')
  r.check('the page is read without touching the big entry', html.status === 200)

  // Ranges at the start, the middle, the end and some random places.
  const spots = [0, Math.floor(sizeOfBig / 2), sizeOfBig - 1000, ...Array.from({ length: 4 }, () => crypto.randomInt(0, sizeOfBig - 5000))]
  let wrong = 0
  const started = process.hrtime.bigint()
  for (const start of spots) {
    const length = Math.min(3000 + (start % 2_000_000), sizeOfBig - start)
    const res = await serveEntry(archive, '/assets/media/big.bin', { range: `bytes=${start}-${start + length - 1}` })
    const got = Buffer.concat(await Array.fromAsync(res.body as AsyncIterable<Buffer>))
    if (res.status !== 206 || Buffer.compare(got, expected(start, length)) !== 0) wrong++
  }
  r.check(`${spots.length} byte ranges (start, middle, end, random) come back exact`, wrong === 0, `${wrong} wrong`)
  r.metric('rangeReadsMs', Math.round(Number(process.hrtime.bigint() - started) / 1e6))

  // The whole big entry, streamed through the server function, hashed on the way.
  const streamed = await withMemoryPeak(appMemoryMb, async () => {
    const t = Date.now()
    const hash = crypto.createHash('sha256')
    const res = await serveEntry(archive, '/assets/media/big.bin')
    for await (const chunk of res.body as AsyncIterable<Buffer>) hash.update(chunk)
    return { sha: hash.digest('hex'), ms: Date.now() - t }
  })
  r.check('streaming the whole big entry gives its SHA-256', streamed.result.sha === bigSha256)
  r.metric('streamAllMs', streamed.result.ms)
  r.metric('streamAllMBps', Math.round(ctx.bigMb / (streamed.result.ms / 1000)))
  r.metric('streamAllPeakMb', streamed.peakMb)
  r.check('memory stays far below the size of the file while streaming it', streamed.peakMb - rssBefore < Math.max(400, ctx.bigMb / 2), `${streamed.peakMb - Math.round(rssBefore)} MB more than at rest, for a ${ctx.bigMb} MB entry`)

  // A DEFLATE entry has to be inflated from its start.
  const log = archive.get('assets/files/log.txt')!
  const t0 = Date.now()
  const inflated = await serveEntry(archive, '/assets/files/log.txt', { range: `bytes=${log.size - 50}-` })
  const tail = Buffer.concat(await Array.fromAsync(inflated.body as AsyncIterable<Buffer>))
  r.check('a range of a DEFLATE entry is answered (from the inflated whole)', inflated.status === 206 && tail.length === 50)
  r.metric('deflateRangeMs', Date.now() - t0)
  r.metric('deflateSizeMb', mb(log.size))
  await archive.close()

  // In the browser: first page with the big file next to it, and a range asked by the page itself.
  const view = await withMemoryPeak(appMemoryMb, async () => {
    const t = Date.now()
    const v = await SnapshotView.open(file, { openExternal: ctx.openExternal })
    return { v, ms: Date.now() - t }
  })
  r.metric('firstPageMs', view.result.ms)
  r.metric('firstPagePeakMb', view.peakMb)
  const answer = await view.result.v.webContents.executeJavaScript(
    "fetch('/assets/media/big.bin', { headers: { Range: 'bytes=1048576-2097151' } }).then(async (x) => [x.status, x.headers.get('content-range'), (await x.arrayBuffer()).byteLength])",
  )
  r.check('the page can ask for a range and gets a 206 of the right size', answer[0] === 206 && answer[2] === 1048576 && answer[1] === `bytes 1048576-2097151/${sizeOfBig}`, answer)
  await view.result.v.close()
}
