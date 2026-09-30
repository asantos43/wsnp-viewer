import { Allotment } from 'allotment'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { readStored, writeStored } from '@/lib/storage.ts'
import { useTheme } from '@/theme/theme.ts'
import { ActivityBar, type ViewId } from './ActivityBar.tsx'
import { EditorGroup } from './EditorGroup.tsx'
import { SideBar } from './SideBar.tsx'
import { StatusBar } from './StatusBar.tsx'
import { TitleBar } from './TitleBar.tsx'
import { isMac, platform, type Commands } from './commands.ts'

const SIDE_BAR_WIDTH = 300
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'

/** VS Code's layout: title bar, activity bar, side bar, editor group and status bar. */
export function Workbench() {
  const { setting, setSetting } = useTheme()
  const [sideBarVisible, setSideBarVisible] = useState(() => readStored('sideBarVisible', true, isBoolean))
  const [sideBarWidth, setSideBarWidth] = useState(() => readStored('sideBarWidth', SIDE_BAR_WIDTH, isNumber))
  const [view, setView] = useState<ViewId>('snapshots')

  const toggleSideBar = useCallback(() => setSideBarVisible((v) => !v), [])
  useEffect(() => writeStored('sideBarVisible', sideBarVisible), [sideBarVisible])
  useEffect(() => void (document.documentElement.dataset.platform = platform()), [])

  const commands: Commands = useMemo(() => ({ toggleSideBar, setTheme: setSetting }), [toggleSideBar, setSetting])

  // Ctrl+B (⌘B on macOS) as in VS Code, and the same command from the native menu of macOS.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = isMac() ? event.metaKey : event.ctrlKey
      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggleSideBar()
      }
    }
    window.addEventListener('keydown', onKey)
    const off = window.wsnp?.onCommand((command) => {
      if (command === 'toggleSideBar') toggleSideBar()
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      off?.()
    }
  }, [toggleSideBar])

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
              <SideBar title="sidebar.snapshots" />
            </Allotment.Pane>
            <Allotment.Pane minSize={200}>
              <EditorGroup />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
