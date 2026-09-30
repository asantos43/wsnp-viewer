import { Icon } from '@/components/Icon.tsx'
import { useI18n } from '@/i18n/context.tsx'
import { LANGUAGE_NAMES } from '@/i18n/index.ts'

/** The 22 px status bar: what the selected snapshot is at the left, the language at the right. */
export function StatusBar() {
  const { t, language } = useI18n()
  const item = 'flex h-full items-center gap-1 px-2 hover:bg-status-hover'
  return (
    <footer className="flex h-[22px] shrink-0 items-center justify-between bg-status text-[12px] text-status-fg">
      <div className="flex h-full items-center">
        <span className={item}>
          <Icon name="file-zip" className="text-[16px]" />
          {t('status.noSnapshot')}
        </span>
      </div>
      <div className="flex h-full items-center">
        <span className={item} title={t('settings.language')}>
          {LANGUAGE_NAMES[language]}
        </span>
      </div>
    </footer>
  )
}
