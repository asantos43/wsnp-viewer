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
- Opening files and tabs: the file picker (`Ctrl+O`), the command line and a double click (the file is a launch argument; `open-file` on macOS), a second launch that hands its file to the running app (single instance), files dropped on the window, and **Open Recent** (kept in the user's profile, with Clear). Several snapshots stay open at once, each in an `<iframe sandbox>` of the window that keeps its state while another tab shows; a file that is already open only shows its tab.
- Tabs as in VS Code: preview tabs in italics that the next click replaces, kept by a double click; pinned tabs; drag to reorder; middle click and × to close; the context menu (Close, Close Others, Close to the Right, Close All, Pin, Copy Source Address or Path, Reveal in File Manager); `Ctrl+W`, `Ctrl+Tab` in the order of use, `Ctrl+PageUp` and `PageDown`, `Alt+1…9`. The workbench's shortcuts are read by the main process, so they also work while a snapshot's frame has the focus.
- The side bar: Open Snapshots, the files of the selected snapshot as a tree (folders first, arrows, type to find, Enter keeps, context menu), Information (what the manifest says) and Integrity; breadcrumbs; a status bar with the source address (opens the browser), the capture date and the integrity result.
- Files of a snapshot open in tabs: source with colours and line numbers (CodeMirror 6, read-only, in the theme's colours), pictures with their size, fonts as samples. A file that cannot be shown (PDF, ZIP, documents, video, too large) shows a page with **Save As…**, which streams it from the archive to the chosen place; the tree's context menu has Save As for every file, and a click on a link to a saved file offers it (a link to a viewable file opens a tab).
- Pictures open with a toolbar: zoom out and in, a box (Fit, Fit Width, Fit Page, 25 % to 400 %, or any percentage by the steps), actual size, and Save As; Ctrl and the wheel zoom around the pointer, `+` `-` `0` zoom from the keyboard, a zoomed picture is dragged, and the zoom stays with the tab.
- PDFs open in a tab, drawn by pdf.js inside the interface (no plug-in, nothing of the PDF runs, no network): page after page, only the pages near the window kept drawn, selectable text, and a toolbar with the same zoom, the page (previous, next, go to, "of N") and Save As. A PDF that cannot be read, or is password-protected, says so and can be saved. A click on a link to a PDF in a page opens it in a tab.
- **Show Metadata**: a tab with everything the manifest says and what was checked (structure, contents, signature), from the View menu, the tab's context menu and the Information view; the raw manifest opens from it, and the metadata can be copied as JSON.
- A snapshot whose files are not what the manifest says (a SHA-256 or a size that does not match) is **not valid**: its page is held back behind a notice (Show Anyway, Close Snapshot, Show Metadata) and the status bar says "Invalid". This replaces the warning the integrity check gave before.
- **Signed manifests** (`FORMAT.md` 1.1, section 12; `docs/MANIFEST-SIGNING.md`): `signature.json` holds the writer's public key and its signature of `manifest.json` (Ed25519 or ECDSA P-256). Editing the manifest's title, address or date after signing makes the snapshot **not valid** at once (held back, "Invalid"), even if the editor also fixes the hash in `signature.json`. The viewer shows the signer's fingerprint and method, tells a key it does not know from one the user trusts (**Trust this signer**, with an optional name, **Stop trusting**; kept in `trusted-signers.json` in the profile), and says "Not signed" quietly for the files written before 1.1. `core/validate/signature.ts` with a known-answer test vector; `fixtures/sign.ts` is the writer's side for the tests. PageKeep signs from the release that follows this design.
- The reference copies in `tests/` (`wsnp-check.mjs`, `wsnp.mjs`, and the new `signing.js`) follow PageKeep's, which now checks and makes signatures.
- Refusals in plain words in both languages, as notifications: an error for a file that is not valid, an information for a file made by a newer version, one with an application, or a protected one. The integrity pass runs in the background after opening and shows progress, "intact" or the files that changed.
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

- The description of the format is kept identical in this repository and in PageKeep: PageKeep holds exact copies of `docs/FORMAT.md`, `docs/MANIFEST-SIGNING.md` and `docs/FORMAT.sha256`, and `scripts/format-sync.mjs` (`npm run format-sync`, run in CI) fails when a doc is edited without recording it, or when the two repositories differ. It found that PageKeep's copy already lacked `converted_from`.
- `tsconfig.json`, Vite and vitest have an `@core` alias for `core/`, which the interface uses for types and pure code only.
- `electron/main.ts` starts the interface; the phase 0 experiments and the spike run with `--experiments` or `--serve` (`electron/prototype-runner.ts`).
- `npm run build` builds the interface and the main process; `npm run app` builds and starts the app. The end-to-end tests and the packages build both.
- Every dependency is bundled, so all of them are `devDependencies`: the packaged `app.asar` went from 14.6 MB to 1.4 MB and holds no `node_modules`.
