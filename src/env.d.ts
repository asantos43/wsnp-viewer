/// <reference types="vite/client" />

/** What electron/preload.ts exposes; missing when the interface runs outside Electron (tests). */
interface Window {
  wsnp?: {
    platform: string
    setTitleBar: (colors: { color: string; symbolColor: string }) => void
    onCommand: (listener: (command: string) => void) => () => void
  }
}
