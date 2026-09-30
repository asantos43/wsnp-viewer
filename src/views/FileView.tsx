import { effectiveType, languageOf, type ViewKind } from '@core/filekind.ts'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/i18n/context.tsx'
import { basename } from '@/lib/format.ts'
import { CodeView } from './CodeView.tsx'
import { FontView } from './FontView.tsx'
import { ImageView } from './ImageView.tsx'
import { OtherView } from './OtherView.tsx'
import { PdfView } from './PdfView.tsx'

type Loaded = { state: 'loading' } | { state: 'ready'; bytes: Uint8Array } | { state: 'failed'; error: string }

/** The tab of one file of a snapshot: source, picture or font when it can be shown, and a way to save it when it cannot. */
export function FileView({ snapshotId, path, kind, mediaType, size, onSave }: { snapshotId: string; path: string; kind: ViewKind; mediaType: string | undefined; size: number; onSave: () => void }) {
  const { t } = useI18n()
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' })
  const name = basename(path)

  useEffect(() => {
    if (kind === 'other') return
    let alive = true
    setLoaded({ state: 'loading' })
    void window.wsnp?.readFile(snapshotId, path).then((result) => {
      if (!alive) return
      setLoaded('bytes' in result ? { state: 'ready', bytes: result.bytes } : { state: 'failed', error: result.error })
    })
    return () => {
      alive = false
    }
  }, [snapshotId, path, kind])

  const text = useMemo(() => (kind === 'text' && loaded.state === 'ready' ? new TextDecoder('utf-8').decode(loaded.bytes) : ''), [kind, loaded])

  if (kind === 'other') return <OtherView name={name} mediaType={mediaType} size={size} onSave={onSave} />
  if (loaded.state === 'loading') return <p className="m-0 p-6 text-fg-muted">{t('file.loading')}</p>
  if (loaded.state === 'failed') return <OtherView name={name} mediaType={mediaType} size={size} reason={loaded.error === 'too-large' ? 'tooLarge' : 'readError'} onSave={onSave} />
  if (kind === 'text') return <CodeView text={text} language={languageOf(mediaType, path)} />
  if (kind === 'image') return <ImageView id={`${snapshotId}:${path}`} bytes={loaded.bytes} mediaType={effectiveType(mediaType, path)} name={name} onSave={onSave} />
  if (kind === 'pdf') return <PdfView id={`${snapshotId}:${path}`} bytes={loaded.bytes} name={name} onSave={onSave} />
  return <FontView bytes={loaded.bytes} />
}
