import { useI18n } from '@/i18n/context.tsx'
import { shortcut } from './commands.ts'

/** The editor group: the tab strip (35 px) and the area that will hold the snapshot, or its watermark when none is open. */
export function EditorGroup() {
  const { t } = useI18n()
  return (
    <main aria-label="Editor" className="flex h-full min-w-0 flex-col bg-editor text-editor-fg">
      <div role="tablist" className="h-[35px] shrink-0 bg-tabs" />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-fg-muted">
        <img src="./icon.svg" alt="" className="h-40 w-40 opacity-15 grayscale" />
        <p className="m-0 text-[15px]">{t('editor.empty')}</p>
        <dl className="m-0 grid grid-cols-[auto_auto] gap-x-6 gap-y-2 text-[13px]">
          <dt className="text-right">{t('editor.hintOpen')}</dt>
          <dd className="m-0"><kbd className="rounded-sm border border-group-border px-1.5 font-sans">{shortcut('Ctrl+O')}</kbd></dd>
          <dt className="text-right">{t('editor.hintPalette')}</dt>
          <dd className="m-0"><kbd className="rounded-sm border border-group-border px-1.5 font-sans">{shortcut('Ctrl+Shift+P')}</kbd></dd>
        </dl>
      </div>
    </main>
  )
}
