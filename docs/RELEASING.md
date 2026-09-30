# Releasing

A release is four files (`.exe`, `.dmg`, `.deb`, `.rpm`) built by GitHub Actions on their own systems, checked, and published with their checksums and the notes from `CHANGELOG.md`.
Nothing is published from a computer by hand.

## Making a release

1. **Prepare it on a branch from an up-to-date `main`** (never commit to `main`):

   ```sh
   git checkout main && git pull --ff-only && git checkout -b release-0.1.0
   node scripts/release.mjs prepare 0.1.0
   ```

   This moves what is under **Unreleased** in `CHANGELOG.md` into a section for `0.1.0` with today's date (and leaves an empty **Unreleased**), and sets `0.1.0` in `package.json` and
   `package-lock.json`. It refuses a version that exists, and an empty **Unreleased**. Read the notes: they become the release's text. A pre-release is `0.1.0-beta.1`.
2. **Run the checks**: `npm run lint && npm run typecheck && npm test && npm run notices:check && npm run format-sync`, and `npm run test:e2e` where you can.
3. **Open a pull request** and let CI pass on the three systems (it also builds the four files, and the packaging smoke test opens them).
4. **After the merge**, tag the merge commit and push the tag:

   ```sh
   git checkout main && git pull --ff-only
   git tag v0.1.0 && git push origin v0.1.0
   ```

   The `Release` workflow then: checks that the tag's version is `package.json`'s and that `CHANGELOG.md` has its notes; builds and tests on Linux, Windows and macOS; runs the packaging smoke test on each; and
   creates the GitHub Release `v0.1.0` with the four files, `SHA256SUMS.txt`, and the notes (a version with `-` in it is marked a pre-release).
5. **Check the release page**: the four files are there, the notes read well, and a file's checksum matches. Install one file on each system you can, and open a `.wsnp` from a double click.

If the workflow fails half way, nothing is published (the release is created last). Fix the cause and run it again: **Actions › Release › Run workflow** with the same tag, which rebuilds and replaces the files
of a release that exists. To withdraw a release, delete it and its tag.

## The files

| System | File | Target |
| --- | --- | --- |
| Windows | `wsnp-viewer-<version>-win-x64.exe` | NSIS installer |
| macOS | `wsnp-viewer-<version>-mac-universal.dmg` | one universal disk image (Apple Silicon and Intel) |
| Debian, Ubuntu | `wsnp-viewer-<version>-linux-amd64.deb` | `deb` |
| Fedora, Red Hat | `wsnp-viewer-<version>-linux-x86_64.rpm` | `rpm` |

There is no AppImage. The installers register `.wsnp` (and on Linux a file type told from a plain ZIP by its first entry). They carry `LICENSE` and `THIRD-PARTY-NOTICES.md`, which the About window shows.

## Signing

**The files are not signed yet**, so Windows SmartScreen and macOS Gatekeeper warn on the first launch (the README says how to get past it). To sign, the secrets below are set in the repository
(**Settings › Secrets and variables › Actions**); the workflow already passes them to electron-builder, which ignores them when they are empty.

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
- [ ] `docs/FORMAT.md` (and `docs/MANIFEST-SIGNING.md`) are the same in PageKeep (`npm run format-sync`).
- [ ] `THIRD-PARTY-NOTICES.md` is up to date (`npm run notices:check`).
- [ ] CI passes on the three systems, the packaging smoke test included.
- [ ] The release page has the four files and `SHA256SUMS.txt`.
