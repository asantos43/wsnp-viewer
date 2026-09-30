import type { SnapshotInfo } from './snapshots.ts'
import type { IntegrityReport, Issue } from './validate/index.ts'

/** What the main process offers the interface (through the preload). Plain data only: nothing here can read an archive. */
export type OpenResult =
  | { ok: true; snapshot: SnapshotInfo; /** The file was open already: show its tab. */ already: boolean }
  | { ok: false; path: string; issues: Issue[]; omitted: number }

export type ReadResult = { bytes: Uint8Array } | { error: 'no-snapshot' | 'no-file' | 'too-large' }
export type SaveResult = { saved: true; path: string } | { saved: false; reason: 'cancelled' | 'error'; message?: string }
export type IntegrityEvent = { id: string; state: 'running'; done: number; total: number } | { id: string; state: 'done'; report: IntegrityReport }

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  /** The licence of the application (LICENSE), and the notices of the libraries inside it (THIRD-PARTY-NOTICES.md). */
  licence: string
  notices: string
}

export interface WsnpApi {
  platform: string
  /** Zooms the whole interface (Electron's zoom level: a step is 20 %). */
  setZoomLevel(level: number): void
  /** The colours of the title bar (the native window buttons are drawn with them on Windows and Linux). */
  setTitleBar(colors: { color: string; symbolColor: string }): void
  /** A command from the native menu (macOS). */
  onCommand(listener: (command: string) => void): () => void
  /** The path of a file dropped on the window (the page itself never sees paths). */
  pathForFile(file: File): string
  /** Tells the main process the interface is listening; answers with what the command line asked to open. */
  ready(): Promise<OpenResult[]>
  /** The file picker; opens what is chosen. */
  openDialog(): Promise<OpenResult[]>
  openPaths(paths: string[]): Promise<OpenResult[]>
  /** Files the system asked for while the app runs (double-click, a second launch, `open-file`). */
  onOpened(listener: (results: OpenResult[]) => void): () => void
  close(id: string): Promise<void>
  /** A whole file of a snapshot, for a tab. */
  readFile(id: string, path: string): Promise<ReadResult>
  /** Asks where to save a file of a snapshot and writes it there, streamed. */
  saveFileAs(id: string, path: string): Promise<SaveResult>
  /** Starts the integrity pass (SHA-256 of every file); progress and the result arrive through `onIntegrity`. */
  verify(id: string): Promise<void>
  onIntegrity(listener: (event: IntegrityEvent) => void): () => void
  /** A click on a link to a file of the snapshot that a tab can show: open it in a tab. */
  onOpenFile(listener: (target: { snapshotId: string; path: string }) => void): () => void
  /** A click on a link to a file that cannot be shown (a PDF, a ZIP…): the Save As dialog was offered, and this is how it ended. */
  onSaved(listener: (saved: { name: string; result: SaveResult }) => void): () => void
  /** Opens a web address in the default browser (http, https and mailto only). */
  openExternal(url: string): Promise<void>
  /** The signers the user trusts, by the fingerprint of their key (docs/MANIFEST-SIGNING.md). */
  signers: { list(): Promise<Record<string, { name?: string }>>; trust(fingerprint: string, name?: string): Promise<void>; forget(fingerprint: string): Promise<void> }
  /** The version, what it runs on, its licence and the notices of the libraries inside it, for the About window. */
  appInfo(): Promise<AppInfo>
  /** Puts text on the clipboard. */
  copyText(text: string): Promise<void>
  /** Shows the snapshot's file in the system's file manager. */
  reveal(id: string): Promise<void>
  recent: { list(): Promise<string[]>; clear(): Promise<void> }
}
