import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { PNG_1X1, writePageKeepZip, writeSampleWsnp } from '../../fixtures/build.ts'
import { openArchive, type Archive } from './reader.ts'

let dir: string
let archive: Archive
beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsnp-concurrent-'))
  await writeSampleWsnp(path.join(dir, 'a.wsnp'))
  archive = await openArchive(path.join(dir, 'a.wsnp'))
})
afterAll(async () => {
  await archive.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

const bytesOf = async (stream: AsyncIterable<Buffer>) => Buffer.concat(await Array.fromAsync(stream))

it('serves the same small stored entry to many readers at once, all complete', async () => {
  const streams = await Promise.all(Array.from({ length: 300 }, () => archive.stream('assets/images/logo.png')))
  const results = await Promise.all(streams.map(bytesOf))
  expect(results.filter((b) => Buffer.compare(b, PNG_1X1) !== 0)).toHaveLength(0)
})

it('serves many different entries at once, each exact', async () => {
  const names = archive.entries.map((e) => e.name)
  const expected = new Map(await Promise.all(names.map(async (n) => [n, await archive.read(n)] as const)))
  const runs = Array.from({ length: 200 }, (_, i) => names[i % names.length])
  const got = await Promise.all(runs.map(async (n) => [n, await bytesOf(await archive.stream(n))] as const))
  expect(got.filter(([n, b]) => Buffer.compare(b, expected.get(n)!) !== 0).map(([n]) => n)).toEqual([])
})

it('reads a PageKeep-style zip the same way', async () => {
  await writePageKeepZip(path.join(dir, 'p.zip'))
  const zip = await openArchive(path.join(dir, 'p.zip'))
  const streams = await Promise.all(Array.from({ length: 300 }, () => zip.stream('assets/logo-1qg48nw.png')))
  expect((await Promise.all(streams.map(bytesOf))).filter((b) => Buffer.compare(b, PNG_1X1) !== 0)).toHaveLength(0)
  await zip.close()
})
