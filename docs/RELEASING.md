# Releasing

A release is up to four files (`.exe`, `.dmg`, `.deb`, `.rpm`). The `.exe`, `.deb` and `.rpm` are checked and built **on the maintainer's computer** by `scripts/release-local.mjs`, and published to GitHub as a
release with their checksums and the notes from `CHANGELOG.md`; GitHub only hosts them. The `.dmg` needs a Mac, so it is the one thing GitHub Actions does: `.github/workflows/release-mac.yml`, which is run by hand
**after** the release exists and adds the `.dmg` to it. No check and no other build runs on GitHub Actions, and nothing runs by itself (no push, no tag, no pull request starts a workflow).

## What the computer needs

**Docker**, and nothing else installed for the build: the files are made in a container (`docker/release/Dockerfile`: Node 24, wine for the `.exe`, `rpm` for the `.rpm`), from a copy of the working tree,
so the host's `node_modules` are not touched. The image is made the first time (a few minutes, a few hundred MB) and kept; `--rebuild-image` makes it again for a new Node or wine. The dependencies, Electron and
electron-builder's tools are cached in two Docker volumes (`wsnp-release-npm`, `wsnp-release-cache`), so the next build downloads nothing. To free the space: `docker volume rm wsnp-release-npm wsnp-release-cache`
and `docker rmi wsnp-viewer-release:node24`.

On the host itself: Node (the checks run there, with the project's `node_modules`), `dpkg-deb` and `rpm` (the smoke test opens the `.deb` and `.rpm`), a screen (it starts the application; `xvfb-run` serves a
computer without one), and `gh`, logged in (`gh auth login`), to publish. The `.exe` is unsigned and **cannot be started on Linux**: install it on a Windows machine (a virtual machine is enough) before publishing.

`node scripts/release-local.mjs` checks that Docker answers, before it does anything slow.

## Making a release

1. **Prepare it on a branch from an up-to-date `main`** (never commit to `main`):

   ```sh
   git checkout main && git pull --ff-only && git checkout -b release-0.1.0
   node scripts/release.mjs prepare 0.1.0
   ```

   This moves what is under **Unreleased** in `CHANGELOG.md` into a section for `0.1.0` with today's date (and leaves an empty **Unreleased**), and sets `0.1.0` in `package.json` and
   `package-lock.json`. It refuses a version that exists, and an empty **Unreleased**. Read the notes: they become the release's text. A pre-release is `0.1.0-beta.1`.
2. **Open a pull request** and merge it. Nothing runs on GitHub; the checks are the next step, here.
3. **Build and check, from the merged `main`**:

   ```sh
   git checkout main && git pull --ff-only
   node scripts/release-local.mjs --e2e
   ```

   This runs `lint`, `typecheck`, `test` and `notices:check` (and, with `--e2e`, the end-to-end tests, which open windows: leave the computer alone while they run), builds the files into
   `release/`, opens the `.deb` and `.rpm` and starts the application in them (`scripts/package-smoke.mjs`), and writes `release/SHA256SUMS.txt` and `release/RELEASE-NOTES.md`. `--targets=linux` or
   `--targets=win` builds one system; `--skip-checks` is only to try the build.
4. **Try the files**: install the `.rpm` (`sudo dnf reinstall ./release/wsnp-viewer-0.1.0-linux-x86_64.rpm`) and, on a Windows machine, the `.exe`; open a `.wsnp` from a double click.
5. **Publish**:

   ```sh
   node scripts/release-local.mjs --publish
   ```

   With the same checks and build, then (it refuses unless the branch is `main`, as `origin/main`, with nothing uncommitted) it asks, and creates the GitHub Release `v0.1.0` **and its tag at that commit**
   with the files, `SHA256SUMS.txt` and the notes (a version with `-` in it is marked a pre-release). To skip the question: `--yes`. To build once and publish what was built, run it without
   `--publish` first, then with it (it builds again: the files are the ones of that run).
6. **Check the release page**: the files are there, the notes read well, and a file's checksum matches (`sha256sum -c SHA256SUMS.txt`).
7. **The macOS file**, when the release is out (and only when you ask for it):

   ```sh
   gh workflow run release-mac.yml -f tag=v0.1.0
   gh run watch
   ```

   It builds the universal `.dmg` of that tag on a macOS runner, runs the packaging smoke test on it (the test of `main`, so that a fix to it reaches an older tag), and adds it to the release, with `SHA256SUMS.txt` and the notes updated (the notes then say that macOS warns too).
   It can be run again for the same tag: the `.dmg` and the checksums are replaced. Minutes on a macOS runner count ten times in a private repository, and a run takes about ten to fifteen. The `.dmg` is unsigned
   and has not been tried on a real Mac by the maintainer: say so in the notes if nobody has.


If something fails half way nothing is published (the release is created last). To change the files or the notes of a release that exists, run it again with `--replace`. To withdraw a release:
`gh release delete v0.1.0 --cleanup-tag`.

## The files

| System | File | Target |
| --- | --- | --- |
| Windows | `wsnp-viewer-<version>-win-x64.exe` | NSIS installer |
| macOS | `wsnp-viewer-<version>-mac-universal.dmg` | one universal disk image (Apple Silicon and Intel); built by the `release-mac.yml` workflow (needs a Mac) |
| Debian, Ubuntu | `wsnp-viewer-<version>-linux-amd64.deb` | `deb` |
| Fedora, Red Hat | `wsnp-viewer-<version>-linux-x86_64.rpm` | `rpm` |

There is no AppImage. The installers register `.wsnp` (and on Linux a file type told from a plain ZIP by its first entry). They carry `LICENSE` and `THIRD-PARTY-NOTICES.md`, which the About window shows.

## Signing

**The files are not signed yet**, so Windows SmartScreen and macOS Gatekeeper warn on the first launch (the README says how to get past it). To sign, the secrets below are set in the repository
(**Settings › Secrets and variables › Actions**) for the macOS workflow, or as environment variables of the shell that runs `release-local.mjs` (it passes them to electron-builder, which ignores them when they are empty).

| Secret | For |
| --- | --- |
| `CSC_LINK`, `CSC_KEY_PASSWORD` | the code-signing certificate (a `.p12` or `.pfx`, as a file link or base64), and its password: Windows code signing and the macOS Developer ID certificate |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | macOS notarisation |

The macOS build has `"identity": null` in `package.json` (it does not sign); once the certificate and notarisation secrets exist, remove that line and add `"notarize": true` under `mac`. The `.deb` and `.rpm` can be signed with a
GPG key later (and a signed apt/dnf repository is a further option). Linux packages cannot be updated from inside the application: a new release is installed with the package manager.

## Updates

There is no automatic update yet. The release notes say which Electron a version has: a new Electron (which carries Chromium) is taken every few months, and at once for a security fix (`SECURITY.md`). Dependabot opens
the pull requests (Electron on its own).

## Checklist

- [ ] `CHANGELOG.md` read: every user-facing change is there, in words a user understands.
- [ ] If the release changes what the format says: the change is in [`wsnp-format`](https://github.com/asantos43/wsnp-format) first.
- [ ] `THIRD-PARTY-NOTICES.md` is up to date (`npm run notices:check`).
- [ ] `node scripts/release-local.mjs` passes (checks, build, packaging smoke test), with `--e2e` where you can.
- [ ] The `.exe` was installed and started on a Windows machine.
- [ ] The release page has the `.exe`, `.deb`, `.rpm` and `SHA256SUMS.txt`; after the macOS workflow, the `.dmg` too.
