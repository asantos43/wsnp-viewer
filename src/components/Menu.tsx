import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Icon } from './Icon.tsx'

export type MenuEntry =
  | { separator: true }
  | { id: string; label: string; shortcut?: string; disabled?: boolean; checked?: boolean; run?: () => void; submenu?: MenuEntry[] }

export const isSeparator = (entry: MenuEntry): entry is { separator: true } => 'separator' in entry

/**
 * A drop-down list in VS Code's style: arrows move, Enter runs, Esc closes, Right opens a submenu and Left goes back.
 * Plain HTML, so it can sit over a page.
 */
export function MenuList({ entries, label, onClose, onSide, onBack }: { entries: MenuEntry[]; label: string; onClose: () => void; onSide?: (direction: -1 | 1) => void; onBack?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [sub, setSub] = useState<string | null>(null)
  const items = () => [...(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > div > button[role^="menuitem"]:not(:disabled)') ?? [])]

  useEffect(() => items()[0]?.focus(), [])

  const openSub = (id: string) => setSub(id)
  const onKeyDown = (event: KeyboardEvent) => {
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    const entry = entries.find((e) => !isSeparator(e) && e.id === (document.activeElement as HTMLElement | null)?.dataset.id)
    if (event.key === 'ArrowDown') list[(at + 1) % list.length]?.focus()
    else if (event.key === 'ArrowUp') list[(at - 1 + list.length) % list.length]?.focus()
    else if (event.key === 'Home') list[0]?.focus()
    else if (event.key === 'End') list.at(-1)?.focus()
    else if (event.key === 'ArrowRight' && entry && !isSeparator(entry) && entry.submenu) openSub(entry.id)
    else if (event.key === 'ArrowRight' && onSide) onSide(1)
    else if (event.key === 'ArrowLeft' && onBack) onBack()
    else if (event.key === 'ArrowLeft' && onSide) onSide(-1)
    else if (event.key === 'Escape') onClose()
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div ref={ref} role="menu" aria-label={label} onKeyDown={onKeyDown} className="no-drag min-w-56 border border-menu-border bg-menu py-1.5 text-menu-fg shadow-[0_2px_8px_var(--vscode-widget-shadow)]">
      {entries.map((entry, i) =>
        isSeparator(entry) ? (
          <div key={`s${i}`} role="separator" className="mx-2 my-1.5 h-px bg-menu-separator" />
        ) : (
          <div key={entry.id} className="relative">
            <button
              type="button"
              data-id={entry.id}
              role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={entry.checked}
              aria-haspopup={entry.submenu ? 'menu' : undefined}
              aria-expanded={entry.submenu ? sub === entry.id : undefined}
              disabled={entry.disabled}
              onMouseEnter={() => setSub(entry.submenu && !entry.disabled ? entry.id : null)}
              onClick={() => {
                if (entry.submenu) return openSub(entry.id)
                onClose()
                entry.run?.()
              }}
              className="flex h-[22px] w-full items-center gap-2 px-2 text-left text-[13px] leading-[22px] outline-none hover:bg-menu-select hover:text-menu-select-fg focus:bg-menu-select focus:text-menu-select-fg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-menu-fg"
            >
              <span className="flex w-4 justify-center">{entry.checked ? <Icon name="check" /> : null}</span>
              <span className="flex-1 whitespace-nowrap">{entry.label}</span>
              {entry.shortcut ? <span className="ml-6 whitespace-nowrap opacity-70">{entry.shortcut}</span> : null}
              {entry.submenu ? <Icon name="chevron-right" /> : null}
            </button>
            {entry.submenu && sub === entry.id ? (
              <div className="absolute top-[-7px] left-full z-10">
                <MenuList entries={entry.submenu} label={entry.label} onClose={onClose} onBack={() => setSub(null)} />
              </div>
            ) : null}
          </div>
        ),
      )}
    </div>
  )
}

/**
 * Calls `onClose` when the user clicks elsewhere, and also when the window loses focus: a click inside a snapshot's
 * iframe never reaches this document, but it takes the focus away.
 */
export function useDismiss(active: boolean, inside: RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    if (!active) return
    const down = (e: PointerEvent) => {
      if (!inside.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', down, true)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      window.removeEventListener('blur', onClose)
    }
  }, [active, inside, onClose])
}
