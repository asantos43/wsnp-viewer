import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from './i18n/context.tsx'
import { applyInitialTheme } from './theme/theme.ts'
import { Workbench } from './workbench/Workbench.tsx'
import './index.css'

applyInitialTheme()
document.documentElement.lang = navigator.language

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Workbench />
    </I18nProvider>
  </StrictMode>,
)
