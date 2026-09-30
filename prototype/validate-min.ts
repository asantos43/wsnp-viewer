// THROWAWAY minimal validator: the checks of docs/FORMAT.md section 10 that the conversion prototype
// needs. The real one is core/validate (phase 1).
import crypto from 'node:crypto'
import fs from 'node:fs'
import { openArchive } from '../core/archive/reader.ts'

const WSNP_TYPE = 'application/vnd.wsnp+zip'
const FOLDERS = ['images', 'styles', 'fonts', 'media', 'files']
const safe = (p: string) => p.length <= 255 && /^[A-Za-z0-9._/-]+$/.test(p) && p.split('/').every((part) => part && part !== '.' && part !== '..')
const cssNetwork = /url\(\s*["']?(?:https?:)?\/\/|@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i

export async function validateWsnp(file: string): Promise<string[]> {
  const errors: string[] = []
  // 1. the first entry is `mimetype`, stored, no extra field, its text at byte 38
  const head = Buffer.alloc(38 + WSNP_TYPE.length)
  const fd = fs.openSync(file, 'r')
  fs.readSync(fd, head, 0, head.length, 0)
  fs.closeSync(fd)
  if (head.readUInt32LE(0) !== 0x04034b50 || head.toString('latin1', 30, 38) !== 'mimetype') return ['the first entry is not "mimetype"']
  if (head.readUInt16LE(8) !== 0) errors.push('"mimetype" is compressed')
  if (head.readUInt16LE(28) !== 0) errors.push('"mimetype" has an extra field')
  if (head.toString('latin1', 38) !== WSNP_TYPE) errors.push('the media type is not application/vnd.wsnp+zip')

  const zip = await openArchive(file) // also refuses ZIP64, ZIP encryption and other methods
  try {
    // 4. the manifest
    const raw = zip.get('manifest.json') ? (await zip.read('manifest.json')).toString('utf8') : ''
    let m: any
    try {
      m = JSON.parse(raw)
    } catch {
      return [...errors, 'manifest.json is missing or not valid JSON']
    }
    if (m.format !== 'wsnp') errors.push('manifest: "format" must be "wsnp"')
    if (!/^1\.\d+$/.test(m.format_version ?? '')) errors.push('manifest: unknown format_version')
    // 5. required fields
    for (const [key, ok] of Object.entries({
      generator: typeof m.generator?.name === 'string' && typeof m.generator?.version === 'string',
      created: typeof m.created === 'string' && !Number.isNaN(Date.parse(m.created)),
      title: typeof m.title === 'string',
      description: typeof m.description === 'string',
      viewport: Number.isFinite(m.viewport?.width) && Number.isFinite(m.viewport?.height),
      pages: Array.isArray(m.pages) && m.pages.length === 1,
      files: Array.isArray(m.files),
      failed: Array.isArray(m.failed),
    })) if (!ok) errors.push(`manifest: "${key}" is missing or wrong`)
    try {
      if (!/^(https?|file):$/.test(new URL(m.source?.url).protocol)) errors.push('manifest: source.url is not an address')
    } catch {
      errors.push('manifest: source.url is not an address')
    }
    if (errors.length) return errors
    // 6. names and folders
    const seen = new Set<string>()
    for (const e of zip.entries) {
      if (!safe(e.name)) errors.push(`unsafe path "${e.name}"`)
      if (seen.has(e.name.toLowerCase())) errors.push(`"${e.name}" clashes with another name when case is ignored`)
      seen.add(e.name.toLowerCase())
      const parts = e.name.split('/')
      if (parts[0] === 'assets' && (parts.length < 3 || !FOLDERS.includes(parts[1]))) errors.push(`${e.name} is not in one of the assets/ folders`)
    }
    // 7. every entry listed, with the same size, SHA-256 and media type; every listed file present
    const listed = new Map<string, any>((m.files as any[]).map((f) => [f.path, f]))
    for (const e of zip.entries) {
      if (e.name === 'mimetype' || e.name === 'manifest.json') continue
      const f = listed.get(e.name)
      if (!f) {
        errors.push(`${e.name} is not listed in the manifest`)
        continue
      }
      const bytes = await zip.read(e.name)
      if (f.bytes !== bytes.length) errors.push(`${e.name}: size ${bytes.length}, the manifest says ${f.bytes}`)
      if (f.sha256 !== crypto.createHash('sha256').update(bytes).digest('hex')) errors.push(`${e.name}: SHA-256 does not match`)
      if (typeof f.media_type !== 'string' || !/^[a-z]+\/[a-z0-9.+-]+$/.test(f.media_type)) errors.push(`${e.name}: no valid media_type`)
      // the page: no inline script, only the format's own scripts, nothing from the network
      if (/\.html?$/i.test(e.name)) {
        const text = bytes.toString('utf8')
        for (const s of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
          const isData = /\stype\s*=\s*["']?application\/(?:ld\+)?json/i.test(s[1])
          if (!isData && !/\ssrc\s*=/i.test(s[1])) errors.push(`${e.name}: inline script`)
          if (/\ssrc\s*=/i.test(s[1]) && !/\ssrc\s*=\s*["']?_wsnp\//i.test(s[1])) errors.push(`${e.name}: a script that is not the format's own`)
        }
        for (const ref of text.matchAll(/<(?:img|source|video|audio|track|embed|iframe|input|script)\b[^>]*?\s(?:src|poster|data)\s*=\s*["']?(?:https?:)?\/\/[^\s"'>]+/gi)) errors.push(`${e.name}: loads from the network: ${ref[0].slice(-60)}`)
        for (const on of text.matchAll(/<[a-z][^>]*\son[a-z]+\s*=/gi)) errors.push(`${e.name}: inline event handler: ${on[0].slice(0, 40)}`)
      }
      if (/\.css$/i.test(e.name) && cssNetwork.test(bytes.toString('utf8'))) errors.push(`${e.name}: loads from the network`)
    }
    for (const p of listed.keys()) if (!zip.get(p)) errors.push(`${p} is listed in the manifest but missing`)
    // 8. the page and the preview exist
    if (!zip.get(m.pages[0].entry)) errors.push(`page ${m.pages[0].entry} is missing`)
    if (m.preview !== undefined && !zip.get(m.preview)) errors.push(`preview ${m.preview} is missing`)
    return errors
  } finally {
    await zip.close()
  }
}
