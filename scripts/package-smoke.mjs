#!/usr/bin/env node
// Smoke test of the release files in release/ (docs/ARCHITECTURE.md, "Testing", packaging): each file that is there is opened with the tool
// of its system, and the application inside is started and asked for its version. What cannot be checked on this system is skipped and said.
//
//   node scripts/package-smoke.mjs [--dir=release] [--no-sandbox]
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const dir = path.resolve(root, args.find((a) => a.startsWith('--dir='))?.slice(6) ?? 'release')
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
const MIME = 'application/vnd.wsnp+zip'

let failed = 0
const check = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `: ${detail}`}`)
  if (!ok) failed++
}
const skip = (name, why) => console.log(`SKIP  ${name}: ${why}`)
const has = (tool) => spawnSync(tool, ['--version'], { stdio: 'ignore' }).error === undefined || spawnSync('which', [tool], { stdio: 'ignore' }).status === 0
const out = (cmd, ...a) => execFileSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 28 })

/** What the file association needs on Linux, from a list of the files of a package and its install script. */
function linuxPackage(kind, file, listing, scripts) {
  check(listing.includes('/usr/share/applications/wsnp-viewer.desktop'), `${kind}: has the menu entry`)
  check(listing.includes('/usr/share/mime/packages/wsnp-viewer.xml') && listing.includes('/usr/share/mime/packages/wsnp-viewer-magic.xml'), `${kind}: has the file type (by name, and by the first entry of the ZIP)`)
  check(/wsnp-viewer\.png/.test(listing), `${kind}: has the icon`)
  check(/update-mime-database/.test(scripts), `${kind}: its install script tells the desktop about the new file type`)
  check(/chrome-sandbox/.test(scripts), `${kind}: its install script sets the permission of the sandbox helper`)
}

const files = fs.existsSync(dir) ? fs.readdirSync(dir) : []
if (!files.length) {
  console.error(`nothing in ${dir}: run npm run package:linux|win|mac first`)
  process.exit(2)
}

for (const name of files.filter((f) => f.endsWith('.deb'))) {
  if (!has('dpkg-deb')) {
    skip(name, 'dpkg-deb is not here')
    continue
  }
  const file = path.join(dir, name)
  check(out('dpkg-deb', '-f', file, 'Version') .trim() === version, `${name}: the package says version ${version}`)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wsnp-deb-'))
  try {
    execFileSync('dpkg-deb', ['-e', file, path.join(tmp, 'ctl')])
    execFileSync('dpkg-deb', ['-x', file, path.join(tmp, 'root')])
    const desktop = fs.readFileSync(path.join(tmp, 'root/usr/share/applications/wsnp-viewer.desktop'), 'utf8')
    check(desktop.includes(`MimeType=${MIME}`), `${name}: the menu entry handles ${MIME}`)
    check(/^Exec=.*%U$/m.test(desktop), `${name}: the menu entry takes the files it is opened with (%U)`)
    check(/^Icon=wsnp-viewer$/m.test(desktop), `${name}: the menu entry has the icon`)
    const magic = fs.readFileSync(path.join(tmp, 'root/usr/share/mime/packages/wsnp-viewer-magic.xml'), 'utf8')
    check(magic.includes(`type="${MIME}"`) && magic.includes('mimetypeapplication/vnd.wsnp+zip') && magic.includes('offset="30"'), `${name}: a file is told from a plain ZIP by its first entry`)
    linuxPackage(`${name}`, file, out('dpkg-deb', '-c', file).replace(/\/\.\//g, '/'), fs.readFileSync(path.join(tmp, 'ctl/postinst'), 'utf8'))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

for (const name of files.filter((f) => f.endsWith('.rpm'))) {
  if (!has('rpm')) {
    skip(name, 'rpm is not here')
    continue
  }
  const file = path.join(dir, name)
  check(out('rpm', '-qp', '--qf', '%{VERSION}', file).trim() === version, `${name}: the package says version ${version}`)
  linuxPackage(name, file, out('rpm', '-qpl', file), out('rpm', '-qp', '--scripts', file))
}

for (const name of files.filter((f) => f.endsWith('.exe') || f.endsWith('.dmg'))) {
  const size = fs.statSync(path.join(dir, name)).size
  check(size > 50 * 2 ** 20, `${name}: is there and is a whole installer (${Math.round(size / 2 ** 20)} MB)`)
}

// The application itself starts and says its version (Linux: the unpacked folder electron-builder leaves next to the packages).
const unpacked = path.join(dir, 'linux-unpacked')
if (fs.existsSync(unpacked) && process.platform === 'linux') {
  const exe = path.join(unpacked, 'wsnp-viewer')
  const run = spawnSync(exe, [...(args.includes('--no-sandbox') ? ['--no-sandbox'] : []), '--app-version'], { encoding: 'utf8', timeout: 60_000 })
  check(run.status === 0 && run.stdout.trim().split('\n').pop() === version, 'the application starts and says its version', `${run.status} ${run.stdout} ${run.stderr.slice(-300)}`)
} else skip('the application starts and says its version', 'no linux-unpacked folder on this system')

console.log(failed ? `\n${failed} check(s) failed` : '\nall packaging checks passed')
process.exit(failed ? 1 : 0)
