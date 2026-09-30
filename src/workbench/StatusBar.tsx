import type { ReactNode } from 'react'
import { Icon } from '@/components/Icon.tsx'
import { useI18n } from '@/i18n/context.tsx'
import { LANGUAGE_NAMES } from '@/i18n/index.ts'
import { formatDate } from '@/lib/format.ts'
import { invalidProblems, type IntegrityState, type Workspace } from '@/state/workspace.ts'

const item = 'flex h-full items-center gap-1 px-2'
const clickable = `${item} hover:bg-status-hover`

function Integrity({ state, invalid, onClick }: { state: IntegrityState | undefined; invalid: boolean; onClick: () => void }) {
  const { t } = useI18n()
  if (!state) return null
  if (invalid) {
    return (
      <button type="button" onClick={onClick} className={`${clickable} bg-error/30 font-bold`} title={t('invalid.title')}>
        <Icon name="error" className="text-[16px]" />
        {t('status.invalid')}
      </button>
    )
  }
  let icon = 'pass'
  let text: string
  if (state.state === 'running') {
    icon = 'sync'
    text = t('integrity.checking', { percent: state.total ? Math.min(100, Math.floor((state.done / state.total) * 100)) : 0 })
  } else if (state.report.problems.length) {
    icon = 'warning'
    text = t(state.report.problems.length === 1 ? 'integrity.problemsShortOne' : 'integrity.problemsShort', { count: state.report.problems.length })
  } else text = t('integrity.intactShort')
  return (
    <button type="button" onClick={onClick} className={clickable} title={t('sidebar.integrity')}>
      <Icon name={icon} className="text-[16px]" />
      {text}
    </button>
  )
}

/** The 22 px status bar: what the selected snapshot is, and the language. Items open the related view. */
export function StatusBar({ ws, onOpenExternal, onShowIntegrity }: { ws: Workspace; onOpenExternal: (url: string) => void; onShowIntegrity: () => void }) {
  const { t, language } = useI18n()
  const snapshot = ws.selected ? ws.snapshots[ws.selected] : undefined
  const m = snapshot?.manifest
  let host = ''
  try {
    host = m ? new URL(m.source.url).host : ''
  } catch {
    host = m?.source.url ?? ''
  }
  const left: ReactNode = m ? (
    <>
      <button type="button" onClick={() => onOpenExternal(m.source.url)} className={clickable} title={t('status.source', { url: m.source.url })}>
        <Icon name="globe" className="text-[16px]" />
        {host}
      </button>
      <span className={item}>
        <Icon name="calendar" className="text-[16px]" />
        {formatDate(m.created, language)}
      </span>
      <Integrity state={ws.integrity[snapshot!.id]} invalid={invalidProblems(ws, snapshot!.id).length > 0} onClick={onShowIntegrity} />
    </>
  ) : (
    <span className={item}>
      <Icon name="file-zip" className="text-[16px]" />
      {t('status.noSnapshot')}
    </span>
  )
  return (
    <footer className="flex h-[22px] shrink-0 items-center justify-between bg-status text-[12px] text-status-fg">
      <div className="flex h-full min-w-0 items-center">{left}</div>
      <div className="flex h-full items-center">
        {m ? (
          <span className={item} title={t('info.generator')}>
            {m.generator.name} {m.generator.version}
          </span>
        ) : null}
        <span className={item} title={t('settings.language')}>
          {LANGUAGE_NAMES[language]}
        </span>
      </div>
    </footer>
  )
}
