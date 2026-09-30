import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Icon } from './Icon.tsx'

export type MenuEntry =
  | { separator: true }
  | { id: string; label: string; shortcut?: string; disabled?: boolean; checked?: boolean; run?: () => void }

export const isSeparator = (entry: MenuEntry): entry is { separator: true } => 'separator' in entry

/** A drop-down list in VS Code's style: arrows move, Enter runs, Esc closes. Plain HTML, so it can sit over a page. */
export function MenuList({ entries, label, onClose, onSide }: { entries: MenuEntry[]; label: string; onClose: () => void; onSide?: (direction: -1 | 1) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const items = () => [...(ref.current?.querySelectorAll<HTMLButtonElement>('button[role^="menuitem"]:not(:disabled)') ?? [])]

  useEffect(() => items()[0]?.focus(), [])

  const onKeyDown = (event: KeyboardEvent) => {
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown') list[(at + 1) % list.length]?.focus()
    else if (event.key === 'ArrowUp') list[(at - 1 + list.length) % list.length]?.focus()
    else if (event.key === 'Home') list[0]?.focus()
    else if (event.key === 'End') list.at(-1)?.focus()
    else if (event.key === 'ArrowLeft' && onSide) onSide(-1)
    else if (event.key === 'ArrowRight' && onSide) onSide(1)
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
          <button
            key={entry.id}
            type="button"
            role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={entry.checked}
            disabled={entry.disabled}
            onClick={() => {
              onClose()
              entry.run?.()
            }}
            className="flex h-[22px] w-full items-center gap-2 px-2 text-left text-[13px] leading-[22px] outline-none hover:bg-menu-select hover:text-menu-select-fg focus:bg-menu-select focus:text-menu-select-fg disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-menu-fg"
          >
            <span className="flex w-4 justify-center">{entry.checked ? <Icon name="check" /> : null}</span>
            <span className="flex-1 whitespace-nowrap">{entry.label}</span>
            {entry.shortcut ? <span className="ml-6 whitespace-nowrap opacity-70">{entry.shortcut}</span> : null}
          </button>
        ),
      )}
    </div>
  )
}

/**
 * Calls `onClose` when the user clicks elsewhere, and also when the window loses focus: a click inside a snapshot's
 * iframe never reaches this document, but it takes the focus away.
 */
export function useDismiss(active: boolean, inside: React.RefObject<HTMLElement | null>, onClose: () => void): void {
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
