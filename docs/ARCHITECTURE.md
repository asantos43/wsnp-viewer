# Architecture of the WSNP viewer

Decision record and plan. The requirements are in [`VIEWER-GUIDELINES.md`](VIEWER-GUIDELINES.md); the file
format is in [`FORMAT.md`](FORMAT.md); the ZIP the viewer converts is in [`PAGEKEEP-ZIP.md`](PAGEKEEP-ZIP.md).
Nothing here is built yet. Size and memory figures are estimates from published comparisons, to be measured in phase 0.

## Decision: Electron

The viewer is a desktop app for Linux, Windows and macOS, built with **Electron** and TypeScript, and released as `.exe`
(Windows), `.dmg` (macOS), `.deb` (Debian) and `.rpm` (Fedora and Red Hat). Reasons:

- The product is a browser for saved pages. Pages were captured in Chrome and must look and behave as when unzipped, so
  one engine, Chromium, with the same behaviour on the three systems avoids three sets of rendering and performance bugs.
- Chromium in Electron gives what the requirements need without extra work: a custom protocol to serve files out of the
  archive, network blocking below the page, `findInPage`, `printToPDF`, and the DevTools protocol for screenshots.
- Written in TypeScript, like the author's other Electron project (`mdiff-electron`: Vite, React, Tailwind, vitest, oxlint,
  electron-builder), so tooling is already known.

Cost: an installer of roughly 50–80 MB compressed (120–150 MB installed) and 150–200 MB of memory when idle, against
roughly 5–15 MB and 40–80 MB for a system-WebView shell. Electron also has to be updated every few versions to receive
Chromium's security fixes. Mitigations: keep only the locales used, ASAR, no native modules, create a snapshot's view when
its tab is activated and destroy idle ones.

### Rejected

| Option | Why not |
| --- | --- |
| Tauri, Wails, Neutralino (system WebView) | Smallest, but Linux uses WebKitGTK, which renders and performs differently from Chromium; three engines to test. |
| Flutter, Go with Fyne | They draw their own UI and have no HTML renderer. A WebView plugin is still needed, and on Linux it is WebKitGTK or a bundled Chromium, so no gain. |
| Tauri with CEF, NW.js, MōBrowser, Electrobun | Bundle Chromium too, so the size is about the same, with a less mature ecosystem, or a licence limit (MōBrowser). |
| Qt WebEngine | Heavy, LGPL, and none of the TypeScript work carries over. |
| Installable web app (PWA) | Only Chrome and Edge, and no control over printing and search. |

## New requirements

Beyond the guidelines, the viewer must:

1. Read a ZIP saved by PageKeep and convert it to `.wsnp` ([`PAGEKEEP-ZIP.md`](PAGEKEEP-ZIP.md)).
2. Export a `.wsnp` to JPG, PNG and PDF.

## Layout of the code

```
electron/   main process: window, views, wsnp:// protocol, IPC, menu, file association
src/        renderer (React): tabs or list, information bar, conversion and export dialogs, en / pt-BR
core/       plain TypeScript, no Electron imports, unit-tested:
            archive (ranged ZIP reads, streamed writes), validate (FORMAT.md section 10), crypt (section 9),
            convert (PageKeep ZIP → .wsnp), mime, text (extraction for search)
export/     image and PDF capture
```

The files in `tests/` are a reference for the format only. They are not run, and the viewer does not depend on them; its
own validator and crypto are written in `core/` from `FORMAT.md`.

## How it works

- **Isolation.** Each open snapshot has its own `WebContentsView` (`sandbox: true`, context isolation, no Node integration)
  in its own non-persistent partition, at its own origin `wsnp://<id>/`. Responses carry the Content Security Policy of
  `FORMAT.md` section 10. A `sandbox allow-scripts` directive on the top document is a candidate to add, if phase 0
  shows it works with fonts (which then need `Access-Control-Allow-Origin: *`).
- **No network.** The policy, plus cancelling in `session.webRequest.onBeforeRequest` everything that is not
  `wsnp://<id>/`, `data:` or `blob:`, plus denying every permission. Links to the web open in the system browser, only when
  clicked (`will-navigate`, `setWindowOpenHandler`, `shell.openExternal`).
- **Reading.** Entries are read through the central directory with positioned reads (`yauzl`, Node `fs` and `zlib`), never
  the whole file in memory and never unzipped to disk. Range requests (206) are answered for stored media.
- **Validation.** The checklist of `FORMAT.md` section 10, with the plain-language refusals the guidelines ask for.
- **Integrity.** SHA-256 of every file in a `utilityProcess`; the result appears in the information bar when done.
- **Search and print.** `findInPage` in the active snapshot; a text index in the main process for the search across open
  snapshots. Printing uses `printToPDF` or `print()` with header and footer.
- **Password protection.** PBKDF2-SHA-256 and chunked AES-256-GCM with Node's `crypto`, decrypting only the chunks needed,
  in memory only.
- **`.wsnpx`, last.** The application runs in a sandboxed `<iframe>` inside a view of the shell, the reader API of
  `FORMAT.md` section 8.5 is checked by the main process (source frame, granted permissions), and trust is remembered per hash set.

### Conversion

`core/convert` turns a PageKeep ZIP into the entries of a `.wsnp` following [`PAGEKEEP-ZIP.md`](PAGEKEEP-ZIP.md): HTML
rewritten with `parse5`, CSS with `css-tree`, ZIP written as a stream with `yazl`, then checked by the viewer's validator
before the file is delivered. Opening a ZIP converts it in memory; **Save as .wsnp** writes it; a batch mode converts many.

### Export

Both exports run in a hidden view with the same partition, protocol and network blocking as a normal snapshot view.

- **JPG / PNG.** Width defaults to the manifest's `viewport.width`, with scale, JPG quality, and "whole page" or "visible
  area". Uses the DevTools protocol (`Emulation.setDeviceMetricsOverride`, `Page.getLayoutMetrics`, `Page.captureScreenshot`).
  Tall pages are captured in strips (GPU texture limit around 16 384 px) and stitched in an `OffscreenCanvas`; beyond the
  canvas limit the export is split into numbered files, with a notice. Fixed and sticky elements may repeat in strips.
- **PDF.** `printToPDF` with background, page size, orientation, margins, scale, and header and footer (source address,
  capture date, page x of y). A "as on screen" option emulates the `screen` media instead of `print`, because many sites hide
  content in their print CSS. A "single long page" option uses the content height, falling back to pages if refused.

## Packaging

Releases are four kinds of file, built with `electron-builder`:

| System | Release file | Target |
| --- | --- | --- |
| Windows | `.exe` | NSIS installer |
| macOS | `.dmg` | one universal disk image (Apple Silicon and Intel) |
| Debian and derivatives | `.deb` | `deb` |
| Fedora and Red Hat | `.rpm` | `rpm` |

There is no AppImage. Architectures: x64 on Windows and Linux; the macOS build is universal (`arch: universal`), so a
single `.dmg` runs on Apple Silicon and Intel, at the cost of a larger file. The Linux packages declare the libraries Electron needs, so the package manager installs them.

- **File association** through `fileAssociations` (Windows, macOS) and, on Linux, the `.desktop` file plus a shared-mime-info
  XML with a magic rule (the `mimetype` at byte 38) so `.wsnp` is not taken for `application/zip`. `open-file` on macOS,
  `requestSingleInstanceLock` elsewhere.
- **Updates.** `electron-updater` can update the Windows installer, and the macOS app if a `.zip` is built beside the `.dmg`.
  It cannot update `.deb` or `.rpm`: on Linux the viewer only tells the user that a new release exists, and installing it is
  done with the package manager (a signed apt/dnf repository is a later option).
- **Signing.** A code-signing certificate on Windows; Developer ID and notarisation on macOS. The `.deb` and `.rpm` can be
  signed with a GPG key.
- **CI.** GitHub Actions with one job per system, publishing the four files to a GitHub Release: the `.exe` on a Windows
  runner, the `.dmg` on a macOS runner, and the `.deb` and `.rpm` on a Linux runner (the `rpm` tool must be installed there).

## Phases

From phase 0 on, each phase is developed on its own branch and delivered as its own pull request.

0. **Throwaway prototype, no UI**, on the three systems: per-snapshot `wsnp://` with the policy and network blocking; ranged
   reads of a ~1 GB `.wsnp`; whole-page capture of a tall page with strips; `printToPDF` with header and footer and `screen`
   emulation; conversion of a real PageKeep ZIP checked by a minimal validator; installer size, idle memory, start-up time.
1. **MVP `.wsnp`.** `archive` and `validate`, protocol, open several files (picker, drag, double-click), tabs or list,
   information bar and integrity, links, en / pt-BR, then the four release files (`.deb` and `.rpm` first, on Linux, then `.exe` and `.dmg`).
2. **Conversion.** `core/convert`, open a PageKeep ZIP in memory, Save as `.wsnp`, batch.
3. **Export.** PNG, JPG and PDF, with options and batch.
4. **Search, print, password protection.**
5. **`.wsnpx`.**

Conversion and export come right after the MVP because both reuse the rendering pipeline (the conversion's preview is an
image capture).

## Risks

- Whole-page capture of very tall or `100vh`-based pages, and fixed elements repeating in strips (phase 0, item 3).
- Print CSS that hides content: mitigated by the "as on screen" option.
- Fonts under an opaque origin need CORS headers if the `sandbox` directive is used.
- Electron security updates: budget a version bump every few months.
- The PageKeep ZIP has no viewport, so converted files carry default values, shown as "not recorded".
