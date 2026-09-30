# Development

## Prerequisites

- Node.js 22 or newer and npm.
- On Linux, to run the Electron app in a container or on a server, a virtual display (`xvfb-run`) and the
  `--no-sandbox` argument (Chromium's sandbox helper cannot be set up there). A normal desktop needs neither.
- To build the Linux packages locally: `rpm` (for `.rpm`) and, on Fedora, `libxcrypt-compat` (a library the
  packaging tool needs). The CI builds them on Ubuntu.

```sh
npm ci
```

## Layout

```
electron/     the main process: the snapshot view, the wsnp:// protocol, the phase 0 runner (main.ts)
core/         plain TypeScript with no Electron imports: archive/ (ZIP reader and writer), serve.ts
export/       image and PDF capture
prototype/    the phase 0 experiments (throwaway): experiments/, convert-min.ts, validate-min.ts
fixtures/     builders of synthetic .wsnp files and PageKeep ZIPs, used by the tests and the experiments
e2e/          end-to-end tests (Playwright driving the Electron app)
docs/         the specification, guidelines, architecture and this guide
tests/        a reference for the WSNP format only; not run
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build:electron` | Bundles the main process into `dist-electron/main.cjs` |
| `npm run prototype` | Builds and runs every phase 0 experiment |
| `npm test` | Unit tests (vitest): `core/`, `electron/`, `export/`, `prototype/` |
| `npm run test:e2e` | Builds, then runs the Playwright tests against the real Electron app |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc` with no output |
| `npm run package:linux` / `package:win` / `package:mac` | Builds the release files into `release/` (unsigned) |

## Running the experiments

```sh
npm run prototype -- --experiments=isolation,large,capture,pdf,convert,metrics
```

| Option | Meaning |
| --- | --- |
| `--experiments=a,b` | Only these; without a value, all of them |
| `--big-mb=N` | Size of the big test file, in MiB (default 256; the plan's test is 1024). The file is written once to `.cache/`, which is not committed. |
| `--real-zip=FILE` | Also convert a real PageKeep ZIP (or set `WSNP_REAL_ZIP`). It stays local: only aggregate numbers are printed. |
| `--timeout=SECONDS` | Longest an experiment may run (default 180) |
| `--out=FILE` | Where to write the JSON results (default `prototype/results/`) |

`WSNP_DEBUG=1` prints progress lines to stderr. Experiments stop the run with exit code 3 if the app's memory
goes over 4 GB, so a mistake cannot take the computer with it.

The experiments render in hidden windows. A hidden window that is not rendered offscreen never paints, so
anything that photographs a page must use `offscreen: true` (see `SnapshotViewOptions`).

## Tests

- **Unit** tests are `*.test.ts` next to the code and use synthetic files from `fixtures/`.
- **End-to-end** tests start the app with `--serve` and ask it to run each experiment; every check of every
  experiment must pass.
- Hostile inputs (ZIP64, encryption, unsafe names, wrong sizes) are covered in `core/archive/reader.test.ts`.
