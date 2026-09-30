import type { MessageKey } from '@/i18n/index.ts'
import type { MenuEntry } from '@/components/Menu.tsx'

/** What the workbench can do; the menus, the keyboard and the native menu of macOS all end up here. */
export interface Commands {
  toggleSideBar: () => void
  setTheme: (theme: 'auto' | 'dark' | 'light') => void
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
  entries: (t: (key: MessageKey) => string, commands: Commands) => MenuEntry[]
}

/**
 * VS Code's menus, trimmed to what the viewer does (docs/UI-DESIGN.md, "Behaviour taken from VS Code"). Items of features
 * that do not exist yet are disabled, not hidden, so the structure is the final one.
 */
export const MENUS: MenuDef[] = [
  {
    id: 'file',
    label: 'menu.file',
    entries: (t) => [
      { id: 'open', label: t('menu.openFile'), shortcut: shortcut('Ctrl+O'), disabled: true },
      { id: 'recent', label: t('menu.openRecent'), disabled: true },
      { separator: true },
      { id: 'close', label: t('menu.closeEditor'), shortcut: shortcut('Ctrl+W'), disabled: true },
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
    entries: (t, commands) => [
      { id: 'palette', label: t('menu.commandPalette'), shortcut: shortcut('Ctrl+Shift+P'), disabled: true },
      { separator: true },
      { id: 'sidebar', label: t('menu.toggleSideBar'), shortcut: shortcut('Ctrl+B'), run: commands.toggleSideBar },
      { separator: true },
      { id: 'zoomIn', label: t('menu.zoomIn'), shortcut: shortcut('Ctrl+='), disabled: true },
      { id: 'zoomOut', label: t('menu.zoomOut'), shortcut: shortcut('Ctrl+-'), disabled: true },
      { id: 'zoomReset', label: t('menu.resetZoom'), shortcut: shortcut('Ctrl+0'), disabled: true },
    ],
  },
  {
    id: 'go',
    label: 'menu.go',
    entries: (t) => [
      { id: 'next', label: t('menu.nextEditor'), shortcut: shortcut('Ctrl+Tab'), disabled: true },
      { id: 'previous', label: t('menu.previousEditor'), shortcut: shortcut('Ctrl+Shift+Tab'), disabled: true },
    ],
  },
  { id: 'help', label: 'menu.help', entries: (t) => [{ id: 'about', label: t('menu.about'), disabled: true }] },
]
