# Development

## Prerequisites

- Node.js 22 or newer and npm.
- On Linux, to run the Electron app in a container or on a server, a virtual display (`xvfb-run`) and the
  `--no-sandbox` argument (Chromium's sandbox helper cannot be set up there). A normal desktop needs neither.
- To build the Linux packages locally: `rpm` (for `.rpm`) and, on Fedora, `libxcrypt-compat` (a library the
  packaging tool needs; without installing it: `dnf download libxcrypt-compat`, unpack the x86_64 rpm with `rpm2cpio | cpio -idm` in a scratch folder and run the packaging with `LD_LIBRARY_PATH=<folder>/usr/lib64`). The CI builds them on Ubuntu.

```sh
npm ci
```

## Layout

```
electron/     the main process: main.ts (starts the app), window.ts (the frameless window and its session), ui-protocol.ts (serves the
              interface), preload.ts, menu.ts (macOS), snapshot-view.ts (the wsnp:// protocol), prototype-runner.ts (the experiments)
src/          the interface (renderer): React, Tailwind; theme/ (tokens), i18n/, components/, workbench/ (title bar, activity bar, side bar, editor group, status bar)
core/         plain TypeScript with no Electron imports: archive/ (ZIP reader and writer), serve.ts
export/       image and PDF capture
prototype/    the phase 0 experiments (throwaway): experiments/, convert-min.ts, validate-min.ts
fixtures/     builders of synthetic .wsnp files and PageKeep ZIPs (build.ts, with pictures and PDFs for the viewers; pdf.ts makes a valid PDF), and of files to refuse or flag (hostile.ts), used by the tests and the experiments
e2e/          end-to-end tests (Playwright driving the Electron app)
docs/         the specification, guidelines, architecture and this guide
tests/        a reference for the WSNP format only; not run
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run app` | Builds everything and starts the app |
| `npm run build` | `build:ui` (the interface, Vite, into `dist/`) and `build:electron` (the main process and the preload, into `dist-electron/`) |
| `npm run prototype` | Builds and runs every phase 0 experiment |
| `npm test` | Unit and component tests (vitest): `core/`, `electron/`, `export/`, `prototype/`, `src/` |
| `npm run test:e2e` | Builds, then runs the Playwright tests against the real Electron app (each launch has its own `--user-data-dir`) |
| `npm run notices` / `npm run notices:check` | Writes `THIRD-PARTY-NOTICES.md` (the licences of the libraries bundled into the application, with their texts, and what Electron ships) / fails when it is out of date; CI runs the check. Run `npm run notices` after changing a dependency that the application imports (the list is `ROOTS` in `scripts/third-party-notices.mjs`). The installers carry the file and the About window shows it |
| `npm run format-sync` | Checks that `docs/FORMAT.md` and `docs/MANIFEST-SIGNING.md` match the hashes recorded in `docs/FORMAT.sha256`, and, when PageKeep is found beside this repository (or given with `-- --sibling=PATH`), that its copies are identical. After editing the format docs: `node scripts/format-sync.mjs --update`, then copy the three files to PageKeep |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc` with no output |
| `npm run package:smoke` | Opens what `release/` holds with the tool of the system (`dpkg-deb`, `rpm`) and checks the menu entry, the `.wsnp` file type (by name and by the first entry of the ZIP), the icon and the install script; starts the unpacked application with `--app-version` and compares the version. Run by CI after the packages are built |
| `npm run package:linux` / `package:win` / `package:mac` | Builds the release files into `release/` (unsigned) |

## Running the experiments

```sh
npm run prototype -- --experiments=isolation,large,capture,pdf,convert,metrics,iframe
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

The `iframe` experiment (phase 1 spike) shows a window for a few seconds: a hidden window does not paint and a click reaches an iframe only on screen.

The other experiments render in hidden windows. A hidden window that is not rendered offscreen never paints, so
anything that photographs a page must use `offscreen: true` (see `SnapshotViewOptions`).

## Tests

- **Unit** tests are `*.test.ts` next to the code and use synthetic files from `fixtures/`. **Component** tests are `*.test.tsx` with `// @vitest-environment happy-dom` on the first line.
- **End-to-end** tests start the app with `--serve` and ask it to run each experiment; every check of every
  experiment must pass.
- Hostile inputs (ZIP64, encryption, unsafe names, wrong sizes) are covered in `core/archive/reader.test.ts`.
