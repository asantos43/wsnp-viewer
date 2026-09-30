import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// format-sync.mjs keeps the description of the format the same in the viewer and in PageKeep. Here two throw-away repositories stand
// for them, each with its own copy of the script (the script finds its repository from where it is).
const SCRIPT = path.resolve(import.meta.dirname, 'format-sync.mjs')
let dir: string
let viewer: string
let pagekeep: string

const write = (repo: string, file: string, text: string) => {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
  fs.writeFileSync(path.join(repo, file), text)
}
const run = (repo: string, ...args: string[]) => {
  const result = spawnSync(process.execPath, [path.join(repo, repo === viewer ? 'scripts' : 'tests', 'format-sync.mjs'), ...args], { encoding: 'utf8' })
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsnp-sync-'))
  viewer = path.join(dir, 'wsnp-viewer')
  pagekeep = path.join(dir, 'webpage-snapshot')
  write(viewer, 'electron/main.ts', '')
  write(pagekeep, 'page-snapshot-extension/manifest.json', '{}')
  fs.copyFileSync(SCRIPT, (write(viewer, 'scripts/x', ''), path.join(viewer, 'scripts/format-sync.mjs')))
  fs.copyFileSync(SCRIPT, (write(pagekeep, 'tests/x', ''), path.join(pagekeep, 'tests/format-sync.mjs')))
  for (const repo of [viewer, pagekeep]) {
    write(repo, 'docs/FORMAT.md', '# WSNP\nsection 1\n')
    write(repo, 'docs/MANIFEST-SIGNING.md', '# Signing\n')
  }
  expect(run(viewer, '--update').code).toBe(0)
  fs.copyFileSync(path.join(viewer, 'docs/FORMAT.sha256'), (write(pagekeep, 'docs/FORMAT.sha256', ''), path.join(pagekeep, 'docs/FORMAT.sha256')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('format-sync', () => {
  it('says the two are identical when they are', () => {
    const result = run(viewer, `--sibling=${pagekeep}`)
    expect(result.code).toBe(0)
    expect(result.out).toContain('identical in both repositories')
    expect(run(pagekeep, `--sibling=${viewer}`).code).toBe(0)
  })
  it('checks the recorded hashes alone when the other repository is not there (what CI does)', () => {
    const result = run(viewer, `--sibling=${path.join(dir, 'nowhere')}`)
    expect(result.code).toBe(0)
    expect(result.out).toContain('the other repository was not found')
    expect(run(viewer, `--sibling=${path.join(dir, 'nowhere')}`, '--require-sibling').code).toBe(1)
  })
  it('fails when the format docs are edited without recording them: the change has to be made on purpose, and copied', () => {
    write(viewer, 'docs/FORMAT.md', '# WSNP\nsection 1 changed\n')
    const result = run(viewer, `--sibling=${path.join(dir, 'nowhere')}`)
    expect(result.code).toBe(1)
    expect(result.out).toContain('changed without docs/FORMAT.sha256')
    expect(result.out).toContain('--update')
  })
  it('after the change is recorded, names what the other repository is missing, with the line where it differs', () => {
    write(viewer, 'docs/FORMAT.md', '# WSNP\nsection 1 changed\n')
    expect(run(viewer, '--update').code).toBe(0)
    const result = run(viewer, `--sibling=${pagekeep}`)
    expect(result.code).toBe(1)
    expect(result.out).toMatch(/docs\/FORMAT\.md differs \(the viewer's is the source\): line 2: «section 1 changed» against «section 1»/)
    expect(result.out).toContain('docs/FORMAT.sha256 differs')
    // Copying the docs and the record makes them the same again.
    for (const file of ['docs/FORMAT.md', 'docs/FORMAT.sha256']) fs.copyFileSync(path.join(viewer, file), path.join(pagekeep, file))
    expect(run(pagekeep, `--sibling=${viewer}`).code).toBe(0)
  })
  it('catches a copy in PageKeep that was edited there', () => {
    write(pagekeep, 'docs/MANIFEST-SIGNING.md', '# Signing, edited in PageKeep\n')
    const result = run(pagekeep, `--sibling=${viewer}`)
    expect(result.code).toBe(1)
    expect(result.out).toContain('docs/MANIFEST-SIGNING.md changed without docs/FORMAT.sha256')
    expect(result.out).toContain('do not edit them in PageKeep')
  })
  it('does not let PageKeep record its own hashes: the viewer\'s docs are the source', () => {
    const result = run(pagekeep, '--update')
    expect(result.code).toBe(2)
    expect(result.out).toContain('--update is for the viewer')
  })
  it('fails when a doc or the record is missing', () => {
    fs.rmSync(path.join(pagekeep, 'docs/MANIFEST-SIGNING.md'))
    expect(run(viewer, `--sibling=${pagekeep}`).out).toContain('docs/MANIFEST-SIGNING.md is missing in PageKeep')
    fs.rmSync(path.join(viewer, 'docs/FORMAT.sha256'))
    expect(run(viewer, `--sibling=${path.join(dir, 'nowhere')}`).code).toBe(1)
  })
})

describe('the real docs of this repository', () => {
  it('match the hashes recorded for them', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '--sibling=/nonexistent-sibling'], { encoding: 'utf8' })
    expect(result.stdout + result.stderr).not.toContain('changed without')
    expect(result.status).toBe(0)
  })
})
