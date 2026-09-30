import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

// End-to-end: Playwright starts the real Electron app (phase 0 prototype, `--serve`) and has it run
// each experiment. Every check of an experiment must pass, on every system the CI runs on.
interface Result {
  name: string
  checks: { name: string; pass: boolean; detail?: string }[]
  error?: string
}

let app: ElectronApplication

test.beforeAll(async () => {
  // CI runners on Linux cannot set up Chromium's sandbox helper.
  const noSandbox = process.env.CI && process.platform === 'linux' ? ['--no-sandbox'] : []
  app = await electron.launch({ args: ['.', '--serve', ...noSandbox] })
})
test.afterAll(async () => {
  await app.close()
})

const run = (name: string) => app.evaluate(async (_electron, n) => (globalThis as unknown as { wsnpProto: { run: (n: string) => Promise<Result> } }).wsnpProto.run(n), name)

for (const name of ['isolation', 'capture', 'pdf', 'convert', 'metrics']) {
  test(`experiment "${name}": every check passes`, async () => {
    const result = await run(name)
    expect(result.error, result.error).toBeUndefined()
    expect(result.checks.length).toBeGreaterThan(0)
    expect(result.checks.filter((c) => !c.pass), 'failed checks').toEqual([])
  })
}

test('the app has no window of its own (phase 0 has no interface)', async () => {
  expect(app.windows()).toHaveLength(0)
})
