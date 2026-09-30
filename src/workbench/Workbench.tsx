import type { OpenResult, SaveResult } from '@core/api.ts'
import { commandFor, type CommandName } from '@core/shortcuts.ts'
import { Allotment } from 'allotment'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useI18n } from '@/i18n/context.tsx'
import { basename } from '@/lib/format.ts'
import { readStored, writeStored } from '@/lib/storage.ts'
import { refusalNotice } from '@/state/messages.ts'
import { useNotifications } from '@/state/notifications.ts'
import { empty, isSnapshotTab, reduce, released, snapshotKey } from '@/state/workspace.ts'
import { useTheme } from '@/theme/theme.ts'
import { ActivityBar, type ViewId } from './ActivityBar.tsx'
import { EditorGroup } from './EditorGroup.tsx'
import { Notifications } from './Notifications.tsx'
import { SideBar } from './SideBar.tsx'
import { StatusBar } from './StatusBar.tsx'
import type { Signers } from './signature.ts'
import { TitleBar } from './TitleBar.tsx'
import { isMac, platform, type Commands } from './commands.ts'

const SIDE_BAR_WIDTH = 300
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'

/** VS Code's layout: title bar, activity bar, side bar, editor group and status bar; and what ties them to the open snapshots. */
export function Workbench() {
  const { t } = useI18n()
  const { setting, setSetting } = useTheme()
  const { notifications, notify, dismiss } = useNotifications()
  const [ws, dispatch] = useReducer(reduce, empty)
  const [sideBarVisible, setSideBarVisible] = useState(() => readStored('sideBarVisible', true, isBoolean))
  const [sideBarWidth, setSideBarWidth] = useState(() => readStored('sideBarWidth', SIDE_BAR_WIDTH, isNumber))
  const [view, setView] = useState<ViewId>('snapshots')
  const [recent, setRecent] = useState<string[]>([])
  const [signers, setSigners] = useState<Signers>({})
  const [dragging, setDragging] = useState(false)
  const api = window.wsnp

  const toggleSideBar = useCallback(() => setSideBarVisible((v) => !v), [])
  useEffect(() => writeStored('sideBarVisible', sideBarVisible), [sideBarVisible])
  useEffect(() => void (document.documentElement.dataset.platform = platform()), [])

  const reportSave = useCallback(
    (name: string, result: SaveResult) => {
      if (result.saved) notify({ level: 'info', text: t('file.saved', { name: basename(result.path) }) })
      else if (result.reason === 'error') notify({ level: 'error', text: t('file.saveFailed', { name: basename(name), message: result.message ?? '' }) })
    },
    [notify, t],
  )

  // ---- the signers the user trusts
  const refreshSigners = useCallback(() => void api?.signers.list().then(setSigners), [api])
  useEffect(refreshSigners, [refreshSigners])
  const trustSigner = useCallback((fingerprint: string, name?: string) => void api?.signers.trust(fingerprint, name).then(refreshSigners), [api, refreshSigners])
  const forgetSigner = useCallback((fingerprint: string) => void api?.signers.forget(fingerprint).then(refreshSigners), [api, refreshSigners])

  // ---- opening files: the picker, the recent list, a drop, and what the system asks for
  const refreshRecent = useCallback(() => void api?.recent.list().then(setRecent), [api])
  const handleResults = useCallback(
    (results: OpenResult[]) => {
      for (const result of results) {
        if (result.ok) {
          dispatch({ type: 'snapshot-opened', snapshot: result.snapshot })
          if (!result.already) void api?.verify(result.snapshot.id)
        } else notify(refusalNotice(t, result))
      }
      if (results.length) refreshRecent()
    },
    [api, notify, refreshRecent, t],
  )
  useEffect(() => {
    if (!api) return
    const offOpened = api.onOpened(handleResults)
    const offIntegrity = api.onIntegrity((event) => dispatch({ type: 'integrity', event }))
    const offFile = api.onOpenFile(({ snapshotId, path }) => dispatch({ type: 'open-file', snapshotId, path, keep: false }))
    const offSaved = api.onSaved(({ name, result }) => reportSave(name, result))
    void api.ready().then(handleResults)
    refreshRecent()
    return () => {
      offOpened()
      offIntegrity()
      offFile()
      offSaved()
    }
  }, [api, handleResults, refreshRecent, reportSave])

  // Closing the last tab of a snapshot lets the main process release its archive.
  const before = useRef(ws)
  useEffect(() => {
    for (const id of released(before.current, ws)) void api?.close(id)
    before.current = ws
  }, [ws, api])

  // ---- saving a file of a snapshot to disk
  const saveFile = useCallback(
    (snapshotId: string, path: string) => {
      void api?.saveFileAs(snapshotId, path).then((result) => reportSave(path, result))
    },
    [api, reportSave],
  )
  const copy = useCallback((text: string) => void api?.copyText(text), [api])
  const openExternal = useCallback((url: string) => void api?.openExternal(url), [api])

  // ---- commands: from the menu, from the keyboard, and from the native menu of macOS
  const cycle = useRef<{ list: string[]; at: number } | null>(null)
  const wsNow = useRef(ws)
  wsNow.current = ws
  const run = useCallback(
    (command: CommandName | 'cycleEnd') => {
      const current = wsNow.current
      if (command === 'toggleSideBar') return toggleSideBar()
      if (command === 'openFile') return void api?.openDialog().then(handleResults)
      if (command === 'closeEditor') return current.active ? dispatch({ type: 'close', key: current.active }) : undefined
      if (command === 'nextEditor') return dispatch({ type: 'step', direction: 1 })
      if (command === 'previousEditor') return dispatch({ type: 'step', direction: -1 })
      if (command === 'cycleEnd') {
        if (cycle.current) dispatch({ type: 'touch' })
        cycle.current = null
        return
      }
      if (command === 'cycleRecent' || command === 'cycleRecentBack') {
        const direction = command === 'cycleRecent' ? 1 : -1
        cycle.current ??= { list: current.recent.length ? current.recent : current.tabs.map((tab) => tab.key), at: 0 }
        const { list } = cycle.current
        if (list.length < 2) return
        cycle.current.at = (cycle.current.at + direction + list.length) % list.length
        return dispatch({ type: 'activate', key: list[cycle.current.at], transient: true })
      }
      const n = /^goToTab(\d)$/.exec(command)?.[1]
      if (n) {
        const tab = Number(n) === 9 ? current.tabs.at(-1) : current.tabs[Number(n) - 1]
        if (tab) dispatch({ type: 'activate', key: tab.key })
      }
    },
    [api, handleResults, toggleSideBar],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command = commandFor({ key: event.key, control: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, alt: event.altKey }, isMac())
      if (!command) return
      event.preventDefault()
      run(command)
    }
    // Ctrl+Tab ends when Control is let go, or when the window loses the focus.
    const onKeyUp = (event: KeyboardEvent) => (event.key === 'Control' || event.key === 'Meta') && run('cycleEnd')
    const onBlur = () => run('cycleEnd')
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    const off = api?.onCommand((command) => run(command as CommandName | 'cycleEnd'))
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      off?.()
    }
  }, [api, run])

  // ---- dropping files on the window opens them; the window itself never navigates to them
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
    const enter = (e: DragEvent) => hasFiles(e) && (depth++, setDragging(true))
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault()
    const leave = (e: DragEvent) => hasFiles(e) && ((depth = Math.max(0, depth - 1)) === 0 ? setDragging(false) : undefined)
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const paths = [...(e.dataTransfer?.files ?? [])].map((f) => api?.pathForFile(f) ?? '').filter(Boolean)
      if (paths.length) void api?.openPaths(paths).then(handleResults)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [api, handleResults])

  const commands: Commands = useMemo(
    () => ({
      toggleSideBar,
      setTheme: setSetting,
      openFile: () => run('openFile'),
      openRecent: (path) => void api?.openPaths([path]).then(handleResults),
      clearRecent: () => void api?.recent.clear().then(refreshRecent),
      closeEditor: () => run('closeEditor'),
      closeAll: () => dispatch({ type: 'close-all' }),
      nextEditor: () => run('nextEditor'),
      previousEditor: () => run('previousEditor'),
      showMetadata: () => wsNow.current.selected && dispatch({ type: 'open-metadata', snapshotId: wsNow.current.selected }),
      hasEditor: ws.tabs.length > 0,
      recent,
    }),
    [toggleSideBar, setSetting, run, api, handleResults, refreshRecent, ws.tabs.length, recent],
  )

  const sideBarActions = useMemo(
    () => ({
      openFile: () => run('openFile'),
      openTreeFile: (snapshotId: string, path: string, keep: boolean) => dispatch({ type: 'open-file', snapshotId, path, keep }),
      saveFile,
      copy,
      openExternal,
      showMetadata: (snapshotId: string) => dispatch({ type: 'open-metadata', snapshotId }),
    }),
    [run, saveFile, copy, openExternal],
  )

  return (
    <div className="flex h-full flex-col">
      <TitleBar commands={commands} sideBarVisible={sideBarVisible} />
      <div className="flex min-h-0 flex-1">
        <ActivityBar
          active={view}
          sideBarVisible={sideBarVisible}
          onSelect={(next) => (next === view ? toggleSideBar() : (setView(next), setSideBarVisible(true)))}
          theme={setting}
          setTheme={setSetting}
        />
        <div className="min-w-0 flex-1">
          <Allotment onChange={(sizes) => sizes[0] && sideBarVisible && (setSideBarWidth(sizes[0]), writeStored('sideBarWidth', Math.round(sizes[0])))}>
            <Allotment.Pane preferredSize={sideBarWidth} minSize={170} maxSize={640} visible={sideBarVisible} snap>
              <SideBar ws={ws} dispatch={dispatch} actions={sideBarActions} signers={signers} />
            </Allotment.Pane>
            <Allotment.Pane minSize={200}>
              <EditorGroup ws={ws} dispatch={dispatch} onSaveFile={saveFile} onReveal={(id) => void api?.reveal(id)} onCopy={copy} onOpenExternal={openExternal} signers={signers} onTrust={trustSigner} onForget={forgetSigner} />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
      <StatusBar
        ws={ws}
        signers={signers}
        onShowMetadata={() => ws.selected && dispatch({ type: 'open-metadata', snapshotId: ws.selected })}
        onOpenExternal={openExternal}
        onShowIntegrity={() => {
          setSideBarVisible(true)
          setView('snapshots')
          if (ws.selected) dispatch({ type: 'activate', key: ws.tabs.find((tab) => tab.snapshotId === ws.selected && isSnapshotTab(tab))?.key ?? snapshotKey(ws.selected) })
        }}
      />
      <Notifications notifications={notifications} onDismiss={dismiss} />
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-2 border-dashed border-focus bg-editor/80 text-[16px] text-fg">{t('dropzone.text')}</div>
      ) : null}
    </div>
  )
}

