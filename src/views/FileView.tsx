import { effectiveType, languageOf, type ViewKind } from '@core/filekind.ts'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/i18n/context.tsx'
import { basename } from '@/lib/format.ts'
import { TextView } from './TextView.tsx'
import { FontView } from './FontView.tsx'
import { ImageView } from './ImageView.tsx'
import { OtherView } from './OtherView.tsx'
import { PdfView } from './PdfView.tsx'
import { ZipView } from './ZipView.tsx'
import type { ZipEntryInfo } from '@core/api.ts'
import type { Notice } from '@/state/messages.ts'

type Loaded = { state: 'loading' } | { state: 'ready'; bytes: Uint8Array } | { state: 'failed'; error: string }

/**
 * The files read lately, so that going back to one (or to the one next to it in the tree) shows it at once instead of a moment of nothing. Only what is read
 * into the interface anyway, at most `BUDGET` bytes in all, the one used longest ago let go first.
 */
const BUDGET = 48 * 2 ** 20
const recentlyRead = new Map<string, Uint8Array>()
let cached = 0
function remember(key: string, bytes: Uint8Array): void {
  if (bytes.length > BUDGET / 3) return
  if (recentlyRead.has(key)) cached -= recentlyRead.get(key)!.length
  recentlyRead.delete(key)
  recentlyRead.set(key, bytes)
  cached += bytes.length
  for (const [old, value] of recentlyRead) {
    if (cached <= BUDGET) break
    recentlyRead.delete(old)
    cached -= value.length
  }
}
/** A snapshot was closed: what was read from it goes (its id is never used again, so this only frees the memory). */
export function forgetReads(snapshotId?: string): void {
  for (const [key, bytes] of [...recentlyRead]) {
    if (snapshotId === undefined || key.startsWith(`${snapshotId}:`)) {
      recentlyRead.delete(key)
      cached -= bytes.length
    }
  }
}
function recall(key: string): Uint8Array | undefined {
  const bytes = recentlyRead.get(key)
  if (bytes) {
    recentlyRead.delete(key)
    recentlyRead.set(key, bytes)
  }
  return bytes
}

/** Whether `ms` have passed since this mounted: a message for something that takes no time at all would only flash. */
function useLate(ms: number): boolean {
  const [late, setLate] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), ms)
    return () => clearTimeout(timer)
  }, [ms])
  return late
}

/** The tab of one file of a snapshot: source, picture or font when it can be shown, and a way to save it when it cannot. */
export function FileView({ snapshotId, path, kind, mediaType, size, onSave, onViewEntry, onNotify }: { onViewEntry: (entry: ZipEntryInfo) => void; onNotify: (notice: Notice) => void; snapshotId: string; path: string; kind: ViewKind; mediaType: string | undefined; size: number; onSave: () => void }) {
  const { t } = useI18n()
  const key = `${snapshotId}:${path}`
  const [loaded, setLoaded] = useState<Loaded>(() => {
    const bytes = kind === 'other' || kind === 'zip' ? undefined : recall(key)
    return bytes ? { state: 'ready', bytes } : { state: 'loading' }
  })
  const late = useLate(150)
  const name = basename(path)

  useEffect(() => {
    if (kind === 'other' || kind === 'zip') return
    let alive = true
    const again = recall(key)
    if (again) {
      setLoaded((old) => (old.state === 'ready' && old.bytes === again ? old : { state: 'ready', bytes: again }))
      return
    }
    setLoaded({ state: 'loading' })
    void window.wsnp?.readFile(snapshotId, path).then((result) => {
      if (!alive) return
      if ('bytes' in result) remember(key, result.bytes)
      setLoaded('bytes' in result ? { state: 'ready', bytes: result.bytes } : { state: 'failed', error: result.error })
    })
    return () => {
      alive = false
    }
  }, [snapshotId, path, kind, key])

  const text = useMemo(() => (kind === 'text' && loaded.state === 'ready' ? new TextDecoder('utf-8').decode(loaded.bytes) : ''), [kind, loaded])

  // A ZIP is listed by the main process, which keeps it: nothing is read into the interface.
  if (kind === 'zip') return <ZipView snapshotId={snapshotId} path={path} name={name} size={size} onSave={onSave} onView={onViewEntry} onNotify={onNotify} />
  if (kind === 'other') return <OtherView name={name} mediaType={mediaType} size={size} onSave={onSave} />
  // A moment of nothing, not of a message that flashes: "Loading…" appears only when the file is slow.
  if (loaded.state === 'loading') return late ? <p className="m-0 p-6 text-fg-muted">{t('file.loading')}</p> : <div className="min-h-0 flex-1 bg-editor" />
  if (loaded.state === 'failed') return <OtherView name={name} mediaType={mediaType} size={size} reason={loaded.error === 'too-large' ? 'tooLarge' : 'readError'} onSave={onSave} />
  if (kind === 'text') return <TextView text={text} language={languageOf(mediaType, path)} size={size} onSave={onSave} />
  if (kind === 'image') return <ImageView id={`${snapshotId}:${path}`} bytes={loaded.bytes} mediaType={effectiveType(mediaType, path)} name={name} onSave={onSave} />
  if (kind === 'pdf') return <PdfView id={`${snapshotId}:${path}`} bytes={loaded.bytes} name={name} onSave={onSave} />
  return <FontView bytes={loaded.bytes} />
}
