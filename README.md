# WSNP Viewer

A desktop viewer for **WSNP** files (`.wsnp`): web pages saved to be read offline, written by the
[PageKeep](https://github.com/asantos43/webpage-snapshot) browser extension. It runs on Linux, Windows and
macOS, and is built with Electron and TypeScript.

> **Status: phase 0, a prototype.** There is no interface yet. This phase proves the parts that carry the
> risk (isolated pages, big files, image and PDF export, converting PageKeep ZIPs) and measures them on the
> three systems. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the plan and the measurements.

## What it will do

- Open `.wsnp` files (and, later, `.wsnpx`): several at once, each page isolated, with no network access.
- Read a plain ZIP saved by PageKeep and convert it to `.wsnp`.
- Export a snapshot to PNG, JPG and PDF.
- Search, print, and protect snapshots with a password.

The file format is in [`docs/FORMAT.md`](docs/FORMAT.md), and what the viewer must do is in
[`docs/VIEWER-GUIDELINES.md`](docs/VIEWER-GUIDELINES.md).

## Try the prototype

You need Node.js 22 or newer.

```sh
npm ci
npm run prototype                      # every experiment
npm run prototype -- --experiments=isolation,convert
```

The experiments print `PASS` or `FAIL` for each check, and write a JSON file to `prototype/results/`. Options:
`--big-mb=N` (size of the big-file test, default 256; use 1024 for the 1 GB test), `--real-zip=FILE` (also convert
a real PageKeep ZIP), `--timeout=SECONDS`. More in [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

## Documentation

| | |
| --- | --- |
| [`docs/FORMAT.md`](docs/FORMAT.md) | The WSNP file format |
| [`docs/VIEWER-GUIDELINES.md`](docs/VIEWER-GUIDELINES.md) | What the viewer must do |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Decisions, plan, phases and measurements |
| [`docs/PAGEKEEP-ZIP.md`](docs/PAGEKEEP-ZIP.md) | The PageKeep ZIP and how it is converted |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Setting up, running and testing |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How changes are made |
| [`CHANGELOG.md`](CHANGELOG.md) | What changed, by version |

## Licence

MIT. See [`LICENSE`](LICENSE).
