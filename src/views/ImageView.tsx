import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/i18n/context.tsx'
import { formatBytes } from '@/lib/format.ts'

/** A picture of the snapshot, at its size, on a chequered ground; its size in pixels and bytes below. */
export function ImageView({ bytes, mediaType, name }: { bytes: Uint8Array; mediaType: string; name: string }) {
  const { t } = useI18n()
  const url = useMemo(() => URL.createObjectURL(new Blob([bytes as BlobPart], { type: mediaType })), [bytes, mediaType])
  const [size, setSize] = useState<{ width: number; height: number } | 'broken' | null>(null)
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[repeating-conic-gradient(var(--vscode-editorGroup-border)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-4">
        {size === 'broken' ? (
          <p className="rounded bg-editor p-3 text-fg-muted">{t('file.imageBroken')}</p>
        ) : (
          <img src={url} alt={name} className="max-h-full max-w-full object-contain" onLoad={(e) => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} onError={() => setSize('broken')} />
        )}
      </div>
      {size && size !== 'broken' ? <p className="m-0 shrink-0 bg-editor px-3 py-1 text-[12px] text-fg-muted">{t('file.image', { width: size.width, height: size.height, size: formatBytes(bytes.length) })}</p> : null}
    </div>
  )
}
