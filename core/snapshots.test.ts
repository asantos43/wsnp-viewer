import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { writeSampleWsnp } from '../fixtures/build.ts'
import { infoOf, SnapshotRegistry } from './snapshots.ts'

let dir: string
let sample: string
beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsnp-registry-'))
  sample = path.join(dir, 'sample.wsnp')
  await writeSampleWsnp(sample)
})
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('SnapshotRegistry', () => {
  it('opens a file, gives it an unguessable id, and answers for its files', async () => {
    const registry = new SnapshotRegistry()
    const outcome = await registry.openPath(sample)
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues))
    expect(outcome.already).toBe(false)
    expect(outcome.snapshot.id).toMatch(/^s[0-9a-f]{16}$/)
    const page = await registry.serve(outcome.snapshot.id, '/')
    expect(page.status).toBe(200)
    expect(page.headers['content-type']).toBe('text/html')
    expect(page.headers['content-security-policy']).toContain('sandbox allow-scripts')
    expect((await registry.serve(outcome.snapshot.id, '/mimetype')).status).toBe(404)
    await registry.closeAll()
  })
  it('does not open the same file twice, and gives two files two ids', async () => {
    const registry = new SnapshotRegistry()
    const first = await registry.openPath(sample)
    const again = await registry.openPath(sample)
    if (!first.ok || !again.ok) throw new Error('did not open')
    expect(again.already).toBe(true)
    expect(again.snapshot.id).toBe(first.snapshot.id)
    const copy = path.join(dir, 'copy.wsnp')
    fs.copyFileSync(sample, copy)
    const other = await registry.openPath(copy)
    if (!other.ok) throw new Error('did not open')
    expect(other.snapshot.id).not.toBe(first.snapshot.id)
    expect(registry.ids).toHaveLength(2)
    await registry.closeAll()
  })
  it('refuses with the issues and keeps nothing open', async () => {
    const registry = new SnapshotRegistry()
    const bad = path.join(dir, 'bad.wsnp')
    fs.writeFileSync(bad, 'this is not a zip file at all, only text that is long enough to be scanned')
    const outcome = await registry.openPath(bad)
    expect(outcome).toMatchObject({ ok: false, path: bad, issues: [{ code: 'not-zip' }] })
    expect(registry.ids).toEqual([])
  })
  it('refuses a request for a snapshot that is not open (or was closed)', async () => {
    const registry = new SnapshotRegistry()
    const outcome = await registry.openPath(sample)
    if (!outcome.ok) throw new Error('did not open')
    const { id } = outcome.snapshot
    await registry.close(id)
    expect((await registry.serve(id, '/')).status).toBe(403)
    expect(await registry.read(id, 'index.html', 1000)).toEqual({ error: 'no-snapshot' })
    expect(registry.has(id)).toBe(false)
  })
  it('reads a whole file for a tab, within a limit, and streams any file for Save As', async () => {
    const registry = new SnapshotRegistry()
    const outcome = await registry.openPath(sample)
    if (!outcome.ok) throw new Error('did not open')
    const { id } = outcome.snapshot
    const css = await registry.read(id, 'assets/styles/site.css', 1000)
    expect('bytes' in css && css.bytes.toString()).toContain('h2{color')
    expect(await registry.read(id, 'assets/styles/site.css', 5)).toEqual({ error: 'too-large' })
    expect(await registry.read(id, 'nope.txt', 1000)).toEqual({ error: 'no-file' })
    const stream = await registry.stream(id, 'assets/images/logo.png')
    expect(Buffer.concat(await Array.fromAsync(stream!)).length).toBeGreaterThan(50)
    expect(await registry.stream(id, 'nope.png')).toBeUndefined()
    await registry.closeAll()
  })
  it('describes a snapshot for the interface without handing it the archive', async () => {
    const registry = new SnapshotRegistry()
    const outcome = await registry.openPath(sample)
    if (!outcome.ok) throw new Error('did not open')
    const info = infoOf(outcome.snapshot)
    expect(Object.keys(info).sort()).toEqual(['files', 'id', 'manifest', 'path'])
    expect(info.files.map((f) => f.path)).toContain('assets/fonts/f.woff2')
    expect(info.files.find((f) => f.path === 'index.html')?.mediaType).toBe('text/html')
    expect(JSON.stringify(info)).not.toContain('archive')
    await registry.closeAll()
  })
})
