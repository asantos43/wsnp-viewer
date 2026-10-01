import type { PrintRequest } from '@core/api.ts'
import { languageOf } from '@core/filekind.ts'
import { isInner } from '@core/vpath.ts'
import { basename } from '@/lib/format.ts'
import { isHeldBack, isSnapshotTab, type Tab, type Workspace } from '@/state/workspace.ts'
import { kindOf } from './tabInfo.ts'

export const activeTabOf = (ws: Workspace): Tab | undefined => ws.tabs.find((tab) => tab.key === ws.active)

/** Everything that shows text can be searched: a page, source, a PDF, the metadata, a ZIP's list, Settings. A picture and a font sample have none. */
export function canFind(ws: Workspace): boolean {
  const tab = activeTabOf(ws)
  if (!tab) return false
  if (tab.path === undefined) return true
  const { kind } = kindOf(ws, tab)
  return kind !== 'image' && kind !== 'font'
}

/** What can be printed: the page of a snapshot that is shown, a text, a picture. */
export function canPrint(ws: Workspace): boolean {
  const tab = activeTabOf(ws)
  if (!tab) return false
  if (isSnapshotTab(tab)) return !isHeldBack(ws, tab.snapshotId)
  if (tab.path === undefined) return false
  const { kind } = kindOf(ws, tab)
  return kind === 'text' || kind === 'image'
}

/**
 * What Print and Save as PDF act on, for the tab on screen: the page of a snapshot; an HTML file of the snapshot, shown as the page it is;
 * any other text, as the tab shows it (`shown` gives that text); a picture. Nothing for a ZIP's list, a PDF, the metadata or Settings.
 */
export function printRequestOf(ws: Workspace, shown: () => string | null): PrintRequest | null {
  const tab = activeTabOf(ws)
  if (!tab || !canPrint(ws)) return null
  if (isSnapshotTab(tab)) return { kind: 'snapshot', id: tab.snapshotId }
  const path = tab.path!
  const { kind, file } = kindOf(ws, tab)
  if (kind === 'image') return { kind: 'image', id: tab.snapshotId, path }
  if (languageOf(file?.mediaType, path) === 'html' && !isInner(path)) return { kind: 'html', id: tab.snapshotId, path }
  return { kind: 'text', title: basename(path), text: shown() ?? '', name: basename(path) }
}

/** The snapshot of the tab on screen was made from a ZIP saved by PageKeep: it can be saved as a `.wsnp`. */
export function canSaveWsnp(ws: Workspace): boolean {
  const tab = activeTabOf(ws)
  return Boolean(tab && ws.snapshots[tab.snapshotId]?.converted)
}
