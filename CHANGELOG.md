# Changelog

All notable changes to the WSNP Viewer are written here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Every pull request adds its lines under **Unreleased**.

## [Unreleased]

### Added

- The workbench shell (`src/`): React 19, Vite and Tailwind 4, with VS Code's layout: a 30 px title bar with the menu (File, Edit, View, Go, Help) and the
  command-centre box, a 48 px activity bar, a side bar with sashes (Allotment) that remembers its width, the editor group and a 22 px status bar. `Ctrl+B` (`⌘B`) toggles the side bar.
- Design tokens named like VS Code's (`src/theme/tokens.css`) for Dark+ and Light+; the theme follows the system and can be chosen from the gear menu, and the choice is remembered.
  Tailwind's colours are replaced by the tokens, so no component writes a colour.
- A frameless window (`titleBarStyle: 'hidden'`): the native window buttons through `titleBarOverlay` on Windows and Linux (coloured with the theme), the traffic lights and the native menu on macOS.
- `electron/ui-protocol`: the interface is served from `wsnp-ui://host/` under its own policy, out of the Vite build; the window's session cancels every other request.
- English and Brazilian Portuguese, following the system language (`src/i18n`).
- `core/validate`: `openWsnp` checks the structure of a `.wsnp` (steps 1 to 8 of `FORMAT.md` section 10) from the ZIP directory and the manifest, with a stable code for every reason to refuse (not a ZIP, ZIP64, ZIP encryption, first entry, unsafe or clashing names, unlisted or missing files, a newer version, an application, a password-protected file…); `verifyContents` reads each file once for its size and SHA-256 and scans pages and stylesheets for inline scripts, foreign scripts, event handlers and network references. `core/manifest` types the manifest.
- Component tests (Testing Library, happy-dom) and end-to-end tests of the workbench (`e2e/workbench.spec.ts`).
- Phase 1 spike (`prototype/experiments/iframe.ts`): a snapshot in an `<iframe sandbox>` of the interface passes the isolation, network, find, link and overlay checks; the interface will show snapshots this way (`docs/ARCHITECTURE.md`, "Phase 1 spike results").
- `docs/UI-DESIGN.md`: research and decisions for an interface as close to VS Code as possible (Dark+ and Light+, VS Code's tabs and menu, the name WSNP Viewer), and the starting point of phase 1.
- The application icon: a page with the `</>` tag rising out of a folder closed by a zipper (the container a `.wsnp` is), with a camera lens (the snapshot), on a midnight rounded square with transparent corners (`build/icon.svg`, `build/icon.png`).
- Phase 0 prototype: an Electron app without an interface that runs experiments and prints what it finds
  (`npm run prototype`).
- `core/archive`: a ZIP reader that opens a file by its central directory and reads entries by byte range
  (it refuses ZIP64, ZIP-level encryption, other compression methods and unsafe names), and a streaming ZIP writer.
- `core/serve`: the answer for a file of a snapshot, with its media type, Content Security Policy, CORS header
  and `Range` support.
- `electron/snapshot-view`: one isolated view per snapshot, with its own in-memory session and `wsnp://`
  origin, requests below the page cancelled, and web links opened only after a real click.
- `export/capture` and `export/pdf`: a whole-page image in strips joined in a canvas, and a PDF with a
  running header and footer, in print or screen style.
- Unit tests (vitest) and end-to-end tests (Playwright driving Electron).
- Packaging with electron-builder (`.deb`, `.rpm`, `.exe`, universal `.dmg`, unsigned) and a CI workflow for
  Linux, Windows and macOS.
- Documentation: README, CONTRIBUTING, `docs/DEVELOPMENT.md`, and the measurements of phase 0 in
  `docs/ARCHITECTURE.md`.
- `converted_from` field in the manifest (`docs/FORMAT.md`), for files made from another format.

### Changed

- `electron/main.ts` starts the interface; the phase 0 experiments and the spike run with `--experiments` or `--serve` (`electron/prototype-runner.ts`).
- `npm run build` builds the interface and the main process; `npm run app` builds and starts the app. The end-to-end tests and the packages build both.
- Every dependency is bundled, so all of them are `devDependencies`: the packaged `app.asar` went from 14.6 MB to 1.4 MB and holds no `node_modules`.
