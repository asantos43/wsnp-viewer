import type { ReactNode } from 'react'
import { Icon } from '@/components/Icon.tsx'
import { useI18n } from '@/i18n/context.tsx'
import { LANGUAGE_NAMES } from '@/i18n/index.ts'
import { formatDate } from '@/lib/format.ts'
import { describeSignature, type Signers } from './signature.ts'
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
export function StatusBar({ zoom, showZoom, onResetZoom, ws, signers, onOpenSettings, onShowMetadata, onOpenExternal, onShowIntegrity }: { zoom: number; showZoom: boolean; onResetZoom: () => void; ws: Workspace; signers: Signers; onOpenSettings: () => void; onShowMetadata: () => void; onOpenExternal: (url: string) => void; onShowIntegrity: () => void }) {
  const { t, language } = useI18n()
  const snapshot = ws.selected ? ws.snapshots[ws.selected] : undefined
  const m = snapshot?.manifest
  let host = ''
  try {
    host = m ? new URL(m.source.url).host : ''
  } catch {
    host = m?.source.url ?? ''
  }
  const sig = snapshot ? describeSignature(t, snapshot.signature, signers) : undefined
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
      {sig && sig.level !== 'invalid' ? (
        <button type="button" onClick={onShowMetadata} className={clickable} title={sig.text}>
          <Icon name={sig.icon} className="text-[16px]" />
          {sig.short}
        </button>
      ) : null}
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
        {showZoom && zoom !== 1 ? (
          <button type="button" onClick={onResetZoom} className={clickable} title={t('status.zoom')}>
            <Icon name="zoom-in" className="text-[16px]" />
            {Math.round(zoom * 100)}%
          </button>
        ) : null}
        {m ? (
          <span className={item} title={t('info.generator')}>
            {m.generator.name} {m.generator.version}
          </span>
        ) : null}
        <button type="button" onClick={onOpenSettings} className={clickable} title={t('settings.language')}>
          {LANGUAGE_NAMES[language]}
        </button>
      </div>
    </footer>
  )
}
