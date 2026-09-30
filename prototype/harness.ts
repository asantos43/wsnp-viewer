import http from 'node:http'

export interface Check {
  name: string
  pass: boolean
  detail?: string
}

export interface ExperimentResult {
  name: string
  checks: Check[]
  metrics: Record<string, unknown>
  notes: string[]
  error?: string
  ms: number
}

/** Collects what an experiment finds: checks pass or fail, metrics are numbers, notes are observations. */
export class Recorder {
  readonly checks: Check[] = []
  readonly metrics: Record<string, unknown> = {}
  readonly notes: string[] = []

  check(name: string, pass: boolean, detail?: unknown): boolean {
    this.checks.push({ name, pass, ...(detail === undefined ? {} : { detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }) })
    return pass
  }

  metric(name: string, value: unknown): void {
    this.metrics[name] = value
  }

  note(text: string): void {
    this.notes.push(text)
  }
}

export interface Context {
  /** A scratch folder for this run (removed afterwards). */
  workDir: string
  /** A folder that survives runs (big fixtures). */
  cacheDir: string
  bigMb: number
  realZip?: string
  /** Where "open in the system browser" goes: recorded, never opened. */
  externals: string[]
  openExternal: (url: string) => void
}

export type Experiment = (recorder: Recorder, ctx: Context) => Promise<void>

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** A server on this computer that counts every request it gets: a page that stays closed never reaches it. */
export async function startProbeServer(): Promise<{ origin: string; hits: string[]; close: () => Promise<void> }> {
  const hits: string[] = []
  const server = http.createServer((req, res) => {
    hits.push(`${req.method} ${req.url}`)
    res.statusCode = 404
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  return {
    origin: `http://127.0.0.1:${port}`,
    hits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

/** Samples the memory of every process of the app while `work` runs; returns the peak in MB. */
export async function withMemoryPeak<T>(getMb: () => number, work: () => Promise<T>, limitMb = 4000): Promise<{ result: T; peakMb: number }> {
  let peak = 0
  const timer = setInterval(() => {
    peak = Math.max(peak, getMb())
    if (peak > limitMb) {
      console.error(`memory guard: ${Math.round(peak)} MB is over the ${limitMb} MB limit, stopping`)
      process.exit(3)
    }
  }, 100)
  try {
    const result = await work()
    peak = Math.max(peak, getMb())
    return { result, peakMb: Math.round(peak) }
  } finally {
    clearInterval(timer)
  }
}

/** Progress lines on stderr when WSNP_DEBUG is set (to see where a run is stuck). */
export const log = (...parts: unknown[]): void => {
  if (process.env.WSNP_DEBUG) console.error('[proto]', ...parts)
}
