import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { EXPERIMENTS } from '../prototype/experiments/index.ts'
import { Recorder, type Context, type ExperimentResult } from '../prototype/harness.ts'

// The phase 0 / spike runner: the app has no window of its own, it runs the experiments of prototype/ and prints what it found.
const args = process.argv.slice(app.isPackaged ? 1 : 2)
const option = (name: string): string | undefined => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  return hit === undefined ? undefined : (hit.split('=')[1] ?? '')
}

async function runExperiment(name: string, ctx: Context): Promise<ExperimentResult> {
  const recorder = new Recorder()
  const started = Date.now()
  let error: string | undefined
  try {
    // A stuck experiment must not hold the run (or a CI job) forever.
    const limit = Number(option('timeout') ?? 180) * 1000
    await Promise.race([
      EXPERIMENTS[name](recorder, ctx),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${limit / 1000} s`)), limit)),
    ])
  } catch (err) {
    error = (err as Error).stack ?? String(err)
    recorder.check('the experiment ran to the end', false, (err as Error).message)
  }
  return { name, checks: recorder.checks, metrics: recorder.metrics, notes: recorder.notes, error, ms: Date.now() - started }
}

function print(result: ExperimentResult): void {
  console.log(`\n== ${result.name} (${(result.ms / 1000).toFixed(1)} s)`)
  for (const c of result.checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${!c.pass && c.detail ? `: ${c.detail}` : ''}`)
  for (const [k, v] of Object.entries(result.metrics)) console.log(`      ${k} = ${typeof v === 'object' ? JSON.stringify(v) : v}`)
  for (const n of result.notes) console.log(`      note: ${n}`)
  if (result.error) console.log(result.error)
}

/** Removes a scratch folder; Windows may still hold a file for a moment, so it retries and never fails the run. */
function cleanUp(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  } catch (err) {
    console.error(`could not remove ${dir}: ${(err as Error).message}`)
  }
}

function makeContext(): Context {
  const cacheDir = path.join(app.getAppPath(), '.cache')
  fs.mkdirSync(cacheDir, { recursive: true })
  const externals: string[] = []
  return {
    workDir: fs.mkdtempSync(path.join(os.tmpdir(), 'wsnp-proto-')),
    cacheDir,
    bigMb: Number(option('big-mb') ?? process.env.WSNP_BIG_MB ?? 256),
    realZip: option('real-zip') || process.env.WSNP_REAL_ZIP || undefined,
    externals,
    openExternal: (url) => externals.push(url),
  }
}

async function main(): Promise<number> {
  const requested = option('experiments')
  const names = requested ? requested.split(',') : Object.keys(EXPERIMENTS)
  const unknown = names.filter((n) => !(n in EXPERIMENTS))
  if (unknown.length) {
    console.error(`unknown experiment: ${unknown.join(', ')} (known: ${Object.keys(EXPERIMENTS).join(', ')})`)
    return 2
  }
  const root = app.getAppPath()
  const ctx = makeContext()
  const workDir = ctx.workDir
  await app.whenReady()
  ;(globalThis as { __wsnpStartup?: { readyMs: number } }).__wsnpStartup = { readyMs: Math.round(process.uptime() * 1000) }
  app.dock?.hide()
  const results: ExperimentResult[] = []
  for (const name of names) {
    const result = await runExperiment(name, ctx)
    print(result)
    results.push(result)
  }
  cleanUp(workDir)

  const failed = results.flatMap((r) => r.checks.filter((c) => !c.pass)).length
  const out = option('out') || path.join(root, 'prototype', 'results', `${process.platform}-${process.arch}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify({ platform: process.platform, arch: process.arch, electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, results }, null, 2))
  console.log(`\n${failed ? `${failed} check(s) failed` : 'all checks passed'}; results in ${out}`)
  return failed ? 1 : 0
}

/** True when the command line asks for the experiments instead of the interface. */
export const wantsPrototype = (argv: string[]): boolean => argv.some((a) => a === '--serve' || a.startsWith('--serve=') || a === '--experiments' || a.startsWith('--experiments='))

export function runPrototype(): void {
  // Closing the last hidden window must not end the run: main() decides when to quit.
  app.on('window-all-closed', () => {})
  if (option('serve') !== undefined) {
    // For the end-to-end tests: stay open, and let the test (Playwright) run one experiment at a time.
    app.whenReady().then(() => {
      ;(globalThis as { wsnpProto?: unknown }).wsnpProto = {
        names: Object.keys(EXPERIMENTS),
        run: async (name: string): Promise<ExperimentResult> => {
          const ctx = makeContext()
          try {
            return await runExperiment(name, ctx)
          } finally {
            cleanUp(ctx.workDir)
          }
        },
      }
    })
  } else {
    main().then((code) => app.exit(code), (err) => {
      console.error(err)
      app.exit(1)
    })
  }
}
