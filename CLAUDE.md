# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

The WSNP viewer is **not built yet**: there is no `package.json`, source tree, build, lint or test setup, so do not assume or invent commands. The repository holds the specification and the plan:

- `docs/FORMAT.md`: the WSNP v1.0 file format (source of truth for the format).
- `docs/VIEWER-GUIDELINES.md`: what the viewer must do (open, show, search, print, protect, convert, export, `.wsnpx`).
- `docs/ARCHITECTURE.md`: the decision (Electron + TypeScript), planned code layout, packaging and phases. Start here before writing code.
- `docs/PAGEKEEP-ZIP.md`: the plain ZIP that PageKeep saves, and the rules for converting it to `.wsnp`.
- `tests/`: **reference for the format only.** These Node scripts (`wsnp-check.mjs`, `wsnp-crypt.mjs`, `zip.js`, `wsnp.mjs`) were copied from the PageKeep extension repo to show how the format is validated, encrypted and packed. Read them like a spec; do not run them, list them as project commands, or build on them as a test suite, oracle or dependency. The viewer's own validator, crypto and ZIP code are written from `docs/FORMAT.md`.

Keep the docs and code in step: a behaviour change belongs in the doc as well.

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
