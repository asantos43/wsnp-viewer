# Changelog

All notable changes to the WSNP Viewer are written here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Every pull request adds its lines under **Unreleased**.

## [Unreleased]

### Added

- Phase 1 spike (`prototype/experiments/iframe.ts`): a snapshot in an `<iframe sandbox>` of the interface passes the isolation, network, find, link and overlay checks; the interface will show snapshots this way (`docs/ARCHITECTURE.md`, "Phase 1 spike results").
- `docs/UI-DESIGN.md`: research and decisions for an interface as close to VS Code as possible (Dark+ and Light+, VS Code's tabs and menu, the name WSNP Viewer), and the starting point of phase 1.
- The application icon: a browser window with the `</>` tag and a camera lens (`build/icon.svg`, `build/icon.png`).
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
