import { useCallback, useRef, useState } from 'react'
import { useDismiss, MenuList } from '@/components/Menu.tsx'
import { useI18n } from '@/i18n/context.tsx'
import { MENUS, type Commands } from './commands.ts'

/** VS Code's menu bar, drawn in the title bar on Windows and Linux (macOS has the native menu). */
export function MenuBar({ commands }: { commands: Commands }) {
  const { t } = useI18n()
  const [open, setOpen] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(null), [])
  useDismiss(open !== null, ref, close)
  const move = (direction: -1 | 1) => setOpen((i) => (i === null ? i : (i + direction + MENUS.length) % MENUS.length))

  return (
    <div ref={ref} role="menubar" className="no-drag flex h-full items-center">
      {MENUS.map((menu, i) => (
        <div key={menu.id} className="relative h-full">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => open !== null && setOpen(i)}
            className={`h-full rounded px-2 text-[13px] leading-[30px] hover:bg-toolbar-hover ${open === i ? 'bg-toolbar-hover' : ''}`}
          >
            {t(menu.label)}
          </button>
          {open === i ? (
            <div className="absolute top-full left-0 z-50">
              <MenuList entries={menu.entries(t, commands)} label={t(menu.label)} onClose={close} onSide={move} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
