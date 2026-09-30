import { useMemo } from 'react'
import { useI18n } from '@/i18n/context.tsx'
import type { Action, Workspace } from '@/state/workspace.ts'
import { FileView } from '@/views/FileView.tsx'
import { Breadcrumbs } from './Breadcrumbs.tsx'
import { shortcut } from './commands.ts'
import { describeTabs, kindOf, snapshotTitle } from './tabInfo.ts'
import { TabStrip } from './TabStrip.tsx'

/**
 * The editor group: the tab strip, the breadcrumbs and the area of the active tab. Every open snapshot keeps its `<iframe sandbox>`
 * (hidden while another tab shows), so its scroll and state stay as they were; a file tab shows the file.
 */
export function EditorGroup({ ws, dispatch, onSaveFile, onReveal, onCopy }: { ws: Workspace; dispatch: (a: Action) => void; onSaveFile: (snapshotId: string, path: string) => void; onReveal: (snapshotId: string) => void; onCopy: (text: string) => void }) {
  const { t } = useI18n()
  const views = useMemo(() => describeTabs(ws), [ws])
  const active = ws.tabs.find((tab) => tab.key === ws.active)
  // The frames keep the order in which the snapshots were opened, whatever the order of the tabs: moving an iframe in the page reloads it.
  const frames = Object.keys(ws.snapshots).flatMap((id) => ws.tabs.filter((tab) => tab.snapshotId === id && tab.path === undefined))
  const trail = active ? [snapshotTitle(ws, active.snapshotId), ...(active.path ? active.path.split('/') : [])] : []
  const fileTab = active?.path !== undefined ? active : undefined
  const info = fileTab ? kindOf(ws, fileTab) : undefined

  return (
    <main aria-label="Editor" className="flex h-full min-w-0 flex-col bg-editor text-editor-fg">
      <TabStrip ws={ws} views={views} dispatch={dispatch} onReveal={onReveal} onCopy={onCopy} />
      {active ? <Breadcrumbs trail={trail} /> : null}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {frames.map((tab) => (
          <iframe
            key={tab.snapshotId}
            id={`frame-${tab.snapshotId}`}
            title={t('editor.snapshotFrame', { name: snapshotTitle(ws, tab.snapshotId) })}
            src={`wsnp://${tab.snapshotId}/`}
            sandbox="allow-scripts"
            hidden={ws.active !== tab.key}
            className="h-full w-full flex-1 border-0 bg-white"
          />
        ))}
        {fileTab && info?.file ? (
          <FileView key={fileTab.key} snapshotId={fileTab.snapshotId} path={fileTab.path!} kind={info.kind} mediaType={info.file.mediaType} size={info.file.size} onSave={() => onSaveFile(fileTab.snapshotId, fileTab.path!)} />
        ) : null}
        {!active ? (
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
        ) : null}
      </div>
    </main>
  )
}

