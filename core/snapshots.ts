import crypto from 'node:crypto'
import type { Archive, ByteRange } from './archive/reader.ts'
import type { Manifest } from './manifest.ts'
import { serveEntry, type ServeResult } from './serve.ts'
import { openWsnp, type Issue } from './validate/index.ts'

/** A snapshot that is open: its archive, its manifest, and the name its files are served under (`wsnp://<id>/`). */
export interface OpenSnapshot {
  /** Unguessable: it is the only thing that keeps one snapshot's page from asking for another's files. */
  id: string
  path: string
  archive: Archive
  manifest: Manifest
  /** `media_type` of every file listed in the manifest. */
  types: ReadonlyMap<string, string>
}

export type OpenOutcome =
  | { ok: true; snapshot: OpenSnapshot; already: boolean }
  | { ok: false; path: string; issues: Issue[]; omitted: number }

/** What the interface needs of an open snapshot: plain data, nothing that can read the archive. */
export interface SnapshotInfo {
  id: string
  path: string
  manifest: Manifest
  /** Every entry of the archive with its size, for the tree. */
  files: { path: string; size: number; mediaType?: string }[]
}

export function infoOf(snapshot: OpenSnapshot): SnapshotInfo {
  return {
    id: snapshot.id,
    path: snapshot.path,
    manifest: snapshot.manifest,
    files: snapshot.archive.entries.map((e) => ({ path: e.name, size: e.size, mediaType: snapshot.types.get(e.name) })),
  }
}

/** The open snapshots. A file that is already open is not opened twice: the caller shows the tab it has. */
export class SnapshotRegistry {
  private readonly open = new Map<string, OpenSnapshot>()

  get ids(): string[] {
    return [...this.open.keys()]
  }

  get(id: string): OpenSnapshot | undefined {
    return this.open.get(id)
  }

  has(id: string): boolean {
    return this.open.has(id)
  }

  async openPath(path: string): Promise<OpenOutcome> {
    for (const snapshot of this.open.values()) if (snapshot.path === path) return { ok: true, snapshot, already: true }
    const result = await openWsnp(path)
    if (!result.ok) return { ok: false, path, issues: result.issues, omitted: result.omitted }
    const snapshot: OpenSnapshot = {
      id: `s${crypto.randomBytes(8).toString('hex')}`,
      path,
      archive: result.archive,
      manifest: result.manifest,
      types: new Map(result.manifest.files.map((f) => [f.path, f.media_type])),
    }
    this.open.set(snapshot.id, snapshot)
    return { ok: true, snapshot, already: false }
  }

  async close(id: string): Promise<void> {
    const snapshot = this.open.get(id)
    if (!snapshot) return
    this.open.delete(id)
    await snapshot.archive.close()
  }

  async closeAll(): Promise<void> {
    await Promise.all(this.ids.map((id) => this.close(id)))
  }

  /** The answer to a request for a file of snapshot `id`, with the policy of FORMAT.md section 10 and the `sandbox` directive. */
  async serve(id: string, urlPath: string, range?: string | null): Promise<ServeResult> {
    const snapshot = this.open.get(id)
    if (!snapshot) return { status: 403, headers: {}, body: null }
    return serveEntry(snapshot.archive, urlPath, { range }, { types: snapshot.types, entry: snapshot.manifest.pages[0].entry, sandbox: true })
  }

  /** A whole file, for a tab. Refuses what is not in the archive and what is over `limit`. */
  async read(id: string, name: string, limit: number): Promise<{ bytes: Buffer } | { error: 'no-snapshot' | 'no-file' | 'too-large' }> {
    const snapshot = this.open.get(id)
    if (!snapshot) return { error: 'no-snapshot' }
    const entry = snapshot.archive.get(name)
    if (!entry) return { error: 'no-file' }
    if (entry.size > limit) return { error: 'too-large' }
    return { bytes: await snapshot.archive.read(name) }
  }

  /** A file as a stream (to save it to disk), whatever its size. */
  async stream(id: string, name: string, range?: ByteRange) {
    const snapshot = this.open.get(id)
    if (!snapshot?.archive.get(name)) return undefined
    return snapshot.archive.stream(name, range)
  }
}
