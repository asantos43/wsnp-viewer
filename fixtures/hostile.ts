// Files the viewer must refuse or flag, for the end-to-end tests. All synthetic.
import fs from 'node:fs'
import { writeZip } from '../core/archive/writer.ts'
import { manifestFor, richFiles, WSNP_TYPE, writeRichWsnp } from './build.ts'

const zipOf = (path: string, mimetype: string, manifest: unknown, files: { path: string; data: Buffer | string }[] = []) =>
  writeZip(path, [{ name: 'mimetype', data: mimetype }, { name: 'manifest.json', data: JSON.stringify(manifest) }, ...files.map((f) => ({ name: f.path, data: f.data }))])

export const writeNotAZip = (path: string) => fs.promises.writeFile(path, 'This is only text, not a ZIP file, and it is long enough to be scanned.')
export const writeApplication = (path: string) => zipOf(path, 'application/vnd.wsnp.x+zip', { format: 'wsnpx' })
export const writeProtected = (path: string) =>
  writeZip(path, [{ name: 'mimetype', data: WSNP_TYPE }, { name: 'encryption.json', data: '{"encryption_version":"1.0"}' }, { name: '_wsnp/encrypted', data: Buffer.alloc(64, 7) }])
export async function writeNewer(path: string) {
  const files = richFiles()
  await zipOf(path, WSNP_TYPE, { ...manifestFor(files), format_version: '2.0' }, files)
}
/** Opens, but one stylesheet was changed after it was saved (the same size, so only the SHA-256 tells). */
export async function writeTampered(path: string) {
  const files = richFiles()
  const manifest = manifestFor(files, { title: 'Tampered page' })
  const changed = files.map((f) => (f.path === 'assets/styles/site.css' ? { ...f, data: String(f.data).replace('rgb(0,128,128)', 'rgb(0,128,127)') } : f))
  await zipOf(path, WSNP_TYPE, manifest, changed)
}
export { writeRichWsnp }
