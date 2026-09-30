import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { systemLanguage, translator, type Language, type MessageKey } from './index.ts'

interface I18n {
  language: Language
  t: (key: MessageKey) => string
}

const Context = createContext<I18n>({ language: 'en', t: translator('en') })

export function I18nProvider({ language = systemLanguage(), children }: { language?: Language; children: ReactNode }) {
  const value = useMemo(() => ({ language, t: translator(language) }), [language])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useI18n = (): I18n => useContext(Context)
