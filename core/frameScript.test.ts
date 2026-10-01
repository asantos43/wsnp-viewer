// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FRAME_SCRIPT, readZoomMessage, WHEEL_STEP, wheelSteps } from './frameScript.ts'

const added: [string, EventListenerOrEventListenerObject, AddEventListenerOptions | boolean | undefined][] = []
const add = window.addEventListener.bind(window)
window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
  added.push([type, fn, options])
  add(type, fn, options)
}) as typeof window.addEventListener
// Each test has a page of its own: what the script of the one before listened to goes.
afterEach(() => {
  for (const [type, fn, options] of added.splice(0)) window.removeEventListener(type, fn, options)
})

/** The script run in a page: its wheel and key events, and what it posts to the parent. */
function runInPage() {
  const posted: unknown[] = []
  const window_ = window as unknown as { parent: unknown; __wsnpZoom?: boolean }
  const parent = { postMessage: vi.fn((m: unknown) => void posted.push(m)) }
  Object.defineProperty(window_, 'parent', { value: parent, configurable: true })
  delete window_.__wsnpZoom
  new Function(FRAME_SCRIPT)()
  return posted
}
const key = (init: KeyboardEventInit) => {
  const e = new KeyboardEvent('keydown', { cancelable: true, bubbles: true, ...init })
  window.dispatchEvent(e)
  return e
}
// (happy-dom's WheelEvent does not take the modifier keys of its init.)
const wheel = (init: WheelEventInit) => {
  const e = new WheelEvent('wheel', { cancelable: true, bubbles: true, ...init })
  if (init.ctrlKey) Object.defineProperty(e, 'ctrlKey', { value: true })
  window.dispatchEvent(e)
  return e
}

describe('the script run in a page of a snapshot', () => {
  it('posts the direction of the zoom keys, with Control or Command, and keeps them from the page', () => {
    const posted = runInPage()
    for (const [init, direction] of [[{ key: '=', ctrlKey: true }, 'in'], [{ key: '+', ctrlKey: true, shiftKey: true }, 'in'], [{ key: '-', ctrlKey: true }, 'out'], [{ key: '0', metaKey: true }, 'reset']] as const) {
      expect(key(init).defaultPrevented, `${init.key}`).toBe(true)
      expect(posted.at(-1)).toEqual({ wsnp: 'wsnp-zoom', direction })
    }
    expect(posted).toHaveLength(4)
  })

  it('leaves every other key to the page, and the zoom keys without Control, or with Alt', () => {
    const posted = runInPage()
    expect(key({ key: '=' }).defaultPrevented).toBe(false)
    expect(key({ key: 'a', ctrlKey: true }).defaultPrevented).toBe(false)
    expect(key({ key: '=', ctrlKey: true, altKey: true }).defaultPrevented).toBe(false)
    expect(posted).toEqual([])
  })

  it('posts the turn of the wheel with Control held, and keeps the browser from zooming the window; an ordinary wheel scrolls', () => {
    const posted = runInPage()
    expect(wheel({ deltaY: -100, ctrlKey: true }).defaultPrevented).toBe(true)
    expect(posted).toEqual([{ wsnp: 'wsnp-zoom', wheel: -100 }])
    expect(wheel({ deltaY: 100 }).defaultPrevented).toBe(false)
    expect(wheel({ deltaY: 0, ctrlKey: true }).defaultPrevented).toBe(false)
    expect(posted).toHaveLength(1)
  })

  it('is put in a page once', () => {
    const posted = runInPage()
    new Function(FRAME_SCRIPT)()
    key({ key: '=', ctrlKey: true })
    expect(posted).toHaveLength(1)
  })
})

describe('readZoomMessage', () => {
  it('takes a direction or a turn of the wheel, and nothing else', () => {
    expect(readZoomMessage({ wsnp: 'wsnp-zoom', direction: 'out' })).toEqual({ direction: 'out' })
    expect(readZoomMessage({ wsnp: 'wsnp-zoom', wheel: -120 })).toEqual({ wheel: -120 })
    for (const bad of [null, 'x', {}, { wsnp: 'other', direction: 'in' }, { wsnp: 'wsnp-zoom' }, { wsnp: 'wsnp-zoom', direction: 'sideways' }, { wsnp: 'wsnp-zoom', wheel: 'big' }, { wsnp: 'wsnp-zoom', wheel: 0 }, { wsnp: 'wsnp-zoom', wheel: Infinity }]) {
      expect(readZoomMessage(bad)).toBeNull()
    }
  })
})

describe('wheelSteps', () => {
  it('makes a step for a notch of a mouse, up zooming in and down out', () => {
    expect(wheelSteps(0, -100)).toEqual({ steps: 1, rest: 0 })
    expect(wheelSteps(0, 100)).toEqual({ steps: -1, rest: 0 })
    expect(wheelSteps(30, -120)).toEqual({ steps: 1, rest: 0 })
  })
  it('adds up the small turns of a trackpad, and carries what is left over', () => {
    let carried = 0
    let total = 0
    for (let i = 0; i < 30; i++) {
      const { steps, rest } = wheelSteps(carried, -10)
      total += steps
      carried = rest
    }
    expect(total).toBe(300 / WHEEL_STEP)
    expect(wheelSteps(0, -30)).toEqual({ steps: 0, rest: 30 })
    // Turning back before a step is made takes the carried turns back.
    expect(wheelSteps(30, 20)).toEqual({ steps: 0, rest: 10 })
  })
})
