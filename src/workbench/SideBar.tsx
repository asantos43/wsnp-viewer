import { useState } from 'react'
import { Icon } from '@/components/Icon.tsx'
import { useI18n } from '@/i18n/context.tsx'
import type { MessageKey } from '@/i18n/index.ts'

function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="border-t border-section-border first:border-t-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-[22px] w-full items-center gap-0.5 pl-0.5 text-left text-[11px] font-bold uppercase text-sidebar-fg hover:bg-list-hover">
        <Icon name={open ? 'chevron-down' : 'chevron-right'} className="text-[16px]" />
        {title}
      </button>
      {open ? <div className="px-5 py-2 text-[13px]">{children}</div> : null}
    </section>
  )
}

/** The side bar of the Snapshots view: open snapshots above the files of the selected one (nothing opens yet). */
export function SideBar({ title }: { title: MessageKey }) {
  const { t } = useI18n()
  return (
    <aside aria-label={t(title)} className="flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-fg">
      <h2 className="m-0 flex h-[35px] shrink-0 items-center pl-5 text-[11px] font-normal uppercase text-sidebar-title">{t(title)}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title={t('sidebar.openSnapshots')}>
          <p className="m-0 mb-3 text-fg-muted">{t('sidebar.noSnapshot')}</p>
          <button type="button" disabled className="h-[26px] w-full rounded-sm bg-button px-3 text-[13px] text-button-fg opacity-50">
            {t('sidebar.openFile')}
          </button>
        </Section>
        <Section title={t('sidebar.files')}>
          <p className="m-0 text-fg-muted">{t('sidebar.noFiles')}</p>
        </Section>
      </div>
    </aside>
  )
}
