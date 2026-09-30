# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Phase 0 (a throwaway prototype, no interface) is done and merged (pull request #1): the reader of the archive, the isolated view of a snapshot, image and PDF capture, a prototype of the PageKeep ZIP conversion, and the tests and CI around them. The interface is a shell with no snapshot in it yet; **phase 1 is in progress** (branch `phase-1-mvp`, its own PR): the spike is done (snapshots are shown in `<iframe sandbox>`, `docs/ARCHITECTURE.md` "Phase 1 spike results") and the workbench shell, `core/validate`, the snapshot host, opening files (picker, command line, second launch, drop, recent) and the tabs (snapshots and their files; source, picture with a zoom toolbar, PDF viewer with zoom and page navigation, fonts; Save As for files that cannot be shown) exist; next are packaging with the file association, Settings and zoom, the remaining docs, and the CI on the three systems (`docs/UI-DESIGN.md`, "Phase 1: where to start"). The name (WSNP Viewer), the icon (`build/icon.svg`, `build/icon.png`, from which electron-builder makes `.ico` and `.icns`), the two themes and the menu are decided (`docs/UI-DESIGN.md`, "Decisions"). Its measurements and what they settled are in `docs/ARCHITECTURE.md` ("Phase 0 results"). Documents:

- `docs/FORMAT.md`: the WSNP file format, 1.0 and 1.1 (source of truth for the format). **The description of the format must be identical in this repository and in PageKeep** (`~/Dev/AI/projetos/chrome-extensions/webpage-snapshot`, which holds exact copies of `docs/FORMAT.md`, `docs/MANIFEST-SIGNING.md` and `docs/FORMAT.sha256`): change it here first, run `node scripts/format-sync.mjs --update` (records the hashes in `docs/FORMAT.sha256`), copy the three files to PageKeep, and run `npm run format-sync` in both (CI here checks the record; with the other repository beside this one it also compares the copies). A behaviour change to the format is not done until PageKeep's copy says the same.
- `docs/VIEWER-GUIDELINES.md`: what the viewer must do (open, show, search, print, protect, convert, export, `.wsnpx`).
- `docs/ARCHITECTURE.md`: the decision (Electron + TypeScript), code layout, testing, documentation plan, packaging, phases and phase 0 results. Start here before writing code.
- `docs/MANIFEST-SIGNING.md`: the **decided** design to sign the manifest (a key per installation, trusted on first use, told by the user), since the ZIP can be unzipped and the manifest edited; the format is `docs/FORMAT.md` 1.1 section 12, and the viewer reads it (`core/validate/signature.ts`, `core/signers.ts`). **PageKeep signs from its release that follows this design** (branch `sign-manifest` in its repository): a file it wrote before is unsigned ("Not signed", quietly), and only a signed file's manifest is protected. A snapshot whose files do not match the manifest, or whose signature does not check, is "not valid" (held back, Show Anyway).
- `docs/PAGEKEEP-ZIP.md`: the plain ZIP that PageKeep saves, and the rules for converting it to `.wsnp`.
- `docs/DEVELOPMENT.md`: setup, scripts, options of the experiments.
- `docs/UI-DESIGN.md`: the interface must be **as close to VS Code as possible** (Dark+ and Light+, VS Code's tabs, menu and behaviours; the product name is "WSNP Viewer"); research, decisions, tokens, libraries, the native-view overlay problem, the chosen icon (`build/icon.svg`, `build/icon.png`), and where phase 1 starts.
- `tests/`: **reference for the format only.** These Node scripts (`wsnp-check.mjs`, `wsnp-crypt.mjs`, `zip.js`, `wsnp.mjs`) were copied from the PageKeep extension repo to show how the format is validated, encrypted and packed. Read them like a spec; do not run them, list them as project commands, or build on them as a test suite, oracle or dependency. The viewer's own validator, crypto and ZIP code are written from `docs/FORMAT.md`. (The viewer's own tests are `*.test.ts` next to the code and `e2e/`.)

Keep the docs and code in step: a behaviour change belongs in the doc as well.

## Commands

Node 22+ (CI uses 24). `npm ci` first.

- `npm run app` builds and starts the app. `npm run build` builds the interface (`dist/`, Vite) and the main process and preload (`dist-electron/`).
- `npm run lint` (oxlint), `npm run typecheck` (tsc), `npm test` (vitest: `core/`, `electron/`, `export/`, `prototype/`, `src/`; component tests use `// @vitest-environment happy-dom`).
- One unit test file or case: `npx vitest run core/serve.test.ts`, `npx vitest run -t "byte range"`.
- `npm run test:e2e`: builds, then Playwright drives the real Electron app (`--serve` mode). One test: `npm run build:electron && npx playwright test -g convert`.
- `npm run prototype [-- --experiments=isolation,large,capture,pdf,convert,metrics --big-mb=N --real-zip=FILE]`: the phase 0 experiments, each check printed as PASS/FAIL, JSON in `prototype/results/` (not committed). `--real-zip` files are private: keep their output aggregate.
- `npm run package:linux|win|mac`: unsigned release files into `release/` (needs `rpm` for `.rpm`; Fedora also `libxcrypt-compat`).
- On a Linux CI or container, run Electron under `xvfb-run` with `--no-sandbox` on the command line.

## Code layout and gotchas

`src/` (the interface: React 19, Tailwind 4; `theme/tokens.css` is the only place with colours; `i18n/`, `state/` (the pure reducer of tabs), `views/`, `workbench/`), `core/` (no Electron imports: `archive/` reader and writer, `validate/`, `snapshots.ts` (the registry of open snapshots), `api.ts` (what the preload offers), `shortcuts.ts`, `serve.ts`), `electron/` (main process: `window.ts`, `ui-protocol.ts`, `snapshot-view.ts`; `prototype-runner.ts` runs with `--experiments` or `--serve`), `export/` (capture, PDF), `fixtures/` (synthetic file builders), `e2e/`, and `prototype/` (**throwaway** experiments, `convert-min.ts` and `validate-min.ts` are replaced by `core/convert` and `core/validate` later).

- A hidden view must be created with `offscreen: true` to be photographed, or the screenshot never returns. Closing the last hidden window must not quit the app (`window-all-closed`).
- yauzl closes the file itself when the last stream ends: never `closeSync` a descriptor yauzl opened.
- The interface may import from `core/` only types and pure modules (`@core/…`): importing `core/validate/index.ts` would bundle Node modules into the renderer (use `core/validate/issues.ts`).
- PDFs are drawn by pdf.js in the interface: the build copies its data (`cmaps`, `standard_fonts`, `iccs`, `wasm`) into `dist/pdfjs/` (`vite.config.ts`), and the interface's CSP allows `worker-src 'self'` and `'wasm-unsafe-eval'`; the `wsnp-ui` scheme needs `supportFetchAPI` for pdf.js to fetch them. pdfjs-dist v6 has no `isEvalSupported` option.
- An `<iframe>` moved in the DOM reloads: the snapshot frames keep the order the snapshots were opened in, whatever the order of the tabs.
- Do not trust `naturalWidth` of an `<img srcset>` (it can read 0 for a fine picture); use `createImageBitmap`.
- Electron has no DevTools `Page.printToPDF`: use `webContents.printToPDF`; the screen media can still be emulated through `Emulation.setEmulatedMedia`.

## What is being built

A desktop app (Linux, Windows, macOS) in **Electron + TypeScript** that opens `.wsnp` files (later `.wsnpx`), and also:

- reads a ZIP saved by PageKeep and **converts it to `.wsnp`** (docs/PAGEKEEP-ZIP.md);
- **exports** a `.wsnp` to **PNG/JPG and PDF**.

Releases are `.exe` (Windows), a universal `.dmg` (macOS, Apple Silicon and Intel), `.deb` (Debian) and `.rpm` (Fedora/Red Hat), built with electron-builder. No AppImage.

**Workflow:** the repository is `asantos43/wsnp-viewer` on GitHub. From phase 0 on, each phase of `docs/ARCHITECTURE.md` is developed on its own branch and delivered as a separate pull request against `main`; never push implementation work directly to `main`. Functionality and interface tests (unit, component, end-to-end, security, performance, packaging; `docs/ARCHITECTURE.md`, "Testing") are written during development, in the same pull request as the feature. A pull request is not complete without those tests, its `CHANGELOG.md` lines (under `[Unreleased]`) and the documentation it affects; `docs/ARCHITECTURE.md` ("Documentation") lists the README, CHANGELOG, CONTRIBUTING, PRIVACY, SECURITY, user guide and other files planned for each phase.

The sibling projects on this machine are useful context: PageKeep, the extension that writes the files (`~/Dev/AI/projetos/chrome-extensions/webpage-snapshot`, see `page-snapshot-extension/offscreen.js`), and `~/Dev/AI/projetos/github/mdiff-electron`, an earlier Electron app by the same author whose tooling (Vite, React, Tailwind, vitest, oxlint, electron-builder) the viewer is meant to follow. Sample ZIP/`.wsnp` files in `~/Downloads` come from private sites: never copy them into this repository; use synthetic fixtures.

## What WSNP is

A `.wsnp` is a ZIP "photo" of one web page for offline reading: `mimetype` (first entry, stored), `manifest.json`, `index.html`, `assets/{images,styles,fonts,media,files}/`, and `_wsnp/` (the writer's own offline scripts and optional preview). `.wsnpx` is the sibling profile that also carries an application (`app/`, `data/`, permissions). PageKeep only captures and writes open `.wsnp`; everything about reading, managing, searching, printing, converting, exporting and password-protecting belongs to the viewer.

## Constraints that span the docs

- **Reading:** read entries in memory through the ZIP central directory with ranged reads; never unzip to disk and never load a whole large file. Serve each file with the manifest's `media_type`, not by folder. Ignore unknown entries and fields; refuse unknown major versions. No ZIP64, no ZIP-level encryption.
- **Validation:** the checklist in FORMAT.md §10. Refusals say why in plain words ("made by a newer version", "password-protected", "contains an application this viewer can't run yet"), never "broken file".
- **Rendering:** each snapshot in its own sandboxed view with its own origin, under the CSP `default-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline' data:`. Only the `_wsnp/` scripts run. Nothing leaves the computer: block requests below the page as well as by CSP. Web links open in the user's browser only when clicked, never inside the view. No account, no analytics.
- **Conversion and export** render in a hidden view with the same isolation and network blocking as a normal snapshot view. A converted `.wsnp` must pass the validator before it is delivered.
- **Password protection (FORMAT.md §9):** a protected file is exactly three stored entries (`mimetype`, `encryption.json`, `_wsnp/encrypted`). PBKDF2-SHA-256 (writers ≥ 600 000 rounds, readers refuse < 100 000) and chunked AES-256-GCM. Decrypt in memory only; never store, log or send the password. The UI asks for ≥ 8 characters typed twice and warns that a forgotten password cannot be recovered.
- **`.wsnpx` (last phase, §8):** open with scripts off and a bar naming the app and its permissions; run scripts only after the user enables them, remembered per exact hash set, and never when hashes mismatch. The app talks to the reader only through the postMessage API (§8.5), which must check the source frame and the granted permissions. Until supported, the viewer says the file holds an application it cannot run yet.
- **Languages:** English and Brazilian Portuguese, following the system language.
