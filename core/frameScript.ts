/**
 * What a snapshot's page cannot tell the interface by itself: the zoom keys and the wheel with Control held, which Chromium would otherwise zoom the whole
 * window by (or ignore, in another process). Run in each frame of a snapshot by the main process after it loads, it stops those and posts a message to the
 * interface (`parent`), which zooms the tab. A page could post the same message: all that comes of it is its own tab zooming.
 */
export const ZOOM_MESSAGE = 'wsnp-zoom'

export const FRAME_SCRIPT = `(() => {
  if (window.__wsnpZoom) return
  window.__wsnpZoom = true
  const send = (message) => { try { parent.postMessage(message, '*') } catch (e) {} }
  addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey) || !e.deltaY) return
    e.preventDefault()
    send({ wsnp: '${ZOOM_MESSAGE}', wheel: e.deltaY })
  }, { capture: true, passive: false })
  addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    const key = e.key
    const direction = key === '=' || key === '+' ? 'in' : key === '-' ? 'out' : key === '0' ? 'reset' : null
    if (!direction) return
    e.preventDefault()
    send({ wsnp: '${ZOOM_MESSAGE}', direction })
  }, true)
})()`

/** What the interface takes from a message of a page: a direction of the zoom, or a turn of the wheel; nothing else. */
export type ZoomMessage = { direction: 'in' | 'out' | 'reset' } | { wheel: number }

export function readZoomMessage(data: unknown): ZoomMessage | null {
  const m = data as { wsnp?: unknown; direction?: unknown; wheel?: unknown } | null
  if (!m || m.wsnp !== ZOOM_MESSAGE) return null
  if (m.direction === 'in' || m.direction === 'out' || m.direction === 'reset') return { direction: m.direction }
  if (typeof m.wheel === 'number' && Number.isFinite(m.wheel) && m.wheel !== 0) return { wheel: m.wheel }
  return null
}

/**
 * Turns of the wheel into steps of the zoom (up zooms in): a notch of a mouse (100 or so) is one step, and the small turns a trackpad sends are added up
 * until they make one. Returns the steps (1, -1 or 0) and what is carried to the next turn.
 */
export const WHEEL_STEP = 50
export function wheelSteps(carried: number, deltaY: number): { steps: number; rest: number } {
  if (Math.abs(deltaY) >= WHEEL_STEP) return { steps: deltaY < 0 ? 1 : -1, rest: 0 }
  const total = carried - deltaY
  return Math.abs(total) >= WHEEL_STEP ? { steps: total > 0 ? 1 : -1, rest: 0 } : { steps: 0, rest: total }
}
