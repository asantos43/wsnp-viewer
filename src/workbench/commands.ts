import type { MessageKey, Translate } from '@/i18n/index.ts'
import type { MenuEntry } from '@/components/Menu.tsx'
import { basename } from '@/lib/format.ts'

/** What the workbench can do; the menus, the keyboard and the native menu of macOS all end up here. */
export interface Commands {
  toggleSideBar: () => void
  setTheme: (theme: 'auto' | 'dark' | 'light') => void
  openFile: () => void
  openRecent: (path: string) => void
  clearRecent: () => void
  closeEditor: () => void
  closeAll: () => void
  nextEditor: () => void
  previousEditor: () => void
  /** A tab is open: the commands that act on it can run. */
  hasEditor: boolean
  /** The files opened lately, the latest first. */
  recent: string[]
}

export const platform = (): string => window.wsnp?.platform ?? (navigator.platform.toLowerCase().startsWith('mac') ? 'darwin' : 'linux')
export const isMac = (): boolean => platform() === 'darwin'

/** VS Code writes a shortcut as `Ctrl+Shift+P`, and on macOS as symbols in the order ⌃⌥⇧⌘. */
export function shortcut(keys: string): string {
  if (!isMac()) return keys
  const parts = keys.split('+')
  const key = parts.pop() ?? ''
  const has = (m: string) => parts.includes(m)
  return [has('Alt') ? '⌥' : '', has('Shift') ? '⇧' : '', has('Ctrl') ? '⌘' : '', key].join('')
}

export interface MenuDef {
  id: string
  label: MessageKey
  entries: (t: Translate, commands: Commands) => MenuEntry[]
}

/**
 * VS Code's menus, trimmed to what the viewer does (docs/UI-DESIGN.md, "Behaviour taken from VS Code"). Items of features
 * that do not exist yet are disabled, not hidden, so the structure is the final one.
 */
export const MENUS: MenuDef[] = [
  {
    id: 'file',
    label: 'menu.file',
    entries: (t, c) => [
      { id: 'open', label: t('menu.openFile'), shortcut: shortcut('Ctrl+O'), run: c.openFile },
      {
        id: 'recent',
        label: t('menu.openRecent'),
        submenu: [
          ...(c.recent.length ? c.recent.map((path): MenuEntry => ({ id: `recent:${path}`, label: basename(path), run: () => c.openRecent(path) })) : [{ id: 'none', label: t('menu.noRecent'), disabled: true } as MenuEntry]),
          { separator: true },
          { id: 'clear', label: t('menu.clearRecent'), disabled: !c.recent.length, run: c.clearRecent },
        ],
      },
      { separator: true },
      { id: 'close', label: t('menu.closeEditor'), shortcut: shortcut('Ctrl+W'), disabled: !c.hasEditor, run: c.closeEditor },
      { id: 'closeAll', label: t('menu.closeAll'), disabled: !c.hasEditor, run: c.closeAll },
      ...(isMac() ? [] : [{ separator: true } as const, { id: 'exit', label: t('menu.exit'), run: () => window.close() }]),
    ],
  },
  {
    id: 'edit',
    label: 'menu.edit',
    entries: (t) => [
      { id: 'copy', label: t('menu.copy'), shortcut: shortcut('Ctrl+C'), disabled: true },
      { separator: true },
      { id: 'find', label: t('menu.find'), shortcut: shortcut('Ctrl+F'), disabled: true },
    ],
  },
  {
    id: 'view',
    label: 'menu.view',
    entries: (t, c) => [
      { id: 'palette', label: t('menu.commandPalette'), shortcut: shortcut('Ctrl+Shift+P'), disabled: true },
      { separator: true },
      { id: 'sidebar', label: t('menu.toggleSideBar'), shortcut: shortcut('Ctrl+B'), run: c.toggleSideBar },
      { separator: true },
      { id: 'zoomIn', label: t('menu.zoomIn'), shortcut: shortcut('Ctrl+='), disabled: true },
      { id: 'zoomOut', label: t('menu.zoomOut'), shortcut: shortcut('Ctrl+-'), disabled: true },
      { id: 'zoomReset', label: t('menu.resetZoom'), shortcut: shortcut('Ctrl+0'), disabled: true },
    ],
  },
  {
    id: 'go',
    label: 'menu.go',
    entries: (t, c) => [
      { id: 'next', label: t('menu.nextEditor'), shortcut: shortcut('Ctrl+PageDown'), disabled: !c.hasEditor, run: c.nextEditor },
      { id: 'previous', label: t('menu.previousEditor'), shortcut: shortcut('Ctrl+PageUp'), disabled: !c.hasEditor, run: c.previousEditor },
    ],
  },
  { id: 'help', label: 'menu.help', entries: (t) => [{ id: 'about', label: t('menu.about'), disabled: true }] },
]
