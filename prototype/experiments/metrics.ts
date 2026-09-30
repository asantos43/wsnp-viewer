import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { SnapshotView } from '../../electron/snapshot-view.ts'
import { sampleFiles, writeWsnp } from '../../fixtures/build.ts'
import { delay, type Experiment } from '../harness.ts'

function directorySize(dir: string): number {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    total += entry.isDirectory() ? directorySize(full) : entry.isFile() ? fs.statSync(full).size : 0
  }
  return total
}

const byType = () => {
  const out: Record<string, number> = {}
  for (const p of app.getAppMetrics()) out[p.type] = (out[p.type] ?? 0) + Math.round(p.memory.workingSetSize / 1024)
  return { totalMb: Object.values(out).reduce((a, b) => a + b, 0), processes: app.getAppMetrics().length, byTypeMb: out }
}

/** Item 6: start-up time, memory with 0, 1 and 5 snapshots open, and the size of what has to be shipped. */
export const metrics: Experiment = async (r, ctx) => {
  const startup = (globalThis as { __wsnpStartup?: { readyMs: number } }).__wsnpStartup
  if (startup) r.metric('appReadyMs', startup.readyMs)
  r.metric('machine', { platform: process.platform, arch: process.arch, cpus: os.cpus().length, ramGb: Math.round(os.totalmem() / 2 ** 30), electron: process.versions.electron, chrome: process.versions.chrome })
  // On macOS the Electron files are in the .app bundle, three levels above the executable.
  const distribution = process.platform === 'darwin' ? path.resolve(process.execPath, '../../..') : path.dirname(process.execPath)
  r.metric('electronUnpackedMb', Math.round(directorySize(distribution) / 2 ** 20))
  await delay(1500)
  r.metric('memoryNoSnapshot', byType())

  const file = path.join(ctx.workDir, 'sample.wsnp')
  await writeWsnp(file, sampleFiles())
  const views: SnapshotView[] = []
  const t0 = Date.now()
  views.push(await SnapshotView.open(file, { openExternal: ctx.openExternal }))
  r.metric('firstSnapshotOpenMs', Date.now() - t0)
  await delay(2000)
  r.metric('memoryOneSnapshot', byType())
  for (let i = 0; i < 4; i++) views.push(await SnapshotView.open(file, { openExternal: ctx.openExternal }))
  await delay(2000)
  r.metric('memoryFiveSnapshots', byType())
  await Promise.all(views.map((v) => v.close()))
  await delay(2000)
  r.metric('memoryAfterClosing', byType())
  r.check('memory came back down after closing the snapshots', byType().totalMb < (r.metrics.memoryFiveSnapshots as { totalMb: number }).totalMb)
}
