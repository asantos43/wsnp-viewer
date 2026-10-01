import { useSyncExternalStore } from 'react'
import { readStored, writeStored } from '@/lib/storage.ts'

/** The zoom of the whole interface, as Electron counts it: a step is 20 % (the factor is 1.2 to the level), as in VS Code. */
export const ZOOM_MIN = -3
export const ZOOM_MAX = 5

export const zoomPercent = (level: number): number => Math.round(1.2 ** level * 100)
export const clampLevel = (level: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(level)))

const isLevel = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const listeners = new Set<() => void>()
let level = clampLevel(readStored('zoomLevel', 0, isLevel))

export const getZoomLevel = (): number => level

/** Applies the level to the window (the preload asks the page to zoom). */
export const applyZoom = (): void => window.wsnp?.setZoomLevel(level)

export function setZoomLevel(next: number): void {
  level = clampLevel(next)
  writeStored('zoomLevel', level)
  applyZoom()
  listeners.forEach((l) => l())
}

export const zoomBy = (steps: number): void => setZoomLevel(level + steps)
export const resetZoom = (): void => setZoomLevel(0)

/** Reads the level again from storage (a test that cleared it). */
export function reloadZoom(): void {
  level = clampLevel(readStored('zoomLevel', 0, isLevel))
  listeners.forEach((l) => l())
}

export function useZoomLevel(): number {
  return useSyncExternalStore((listener) => (listeners.add(listener), () => void listeners.delete(listener)), getZoomLevel)
}
