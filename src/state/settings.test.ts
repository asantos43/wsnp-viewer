// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLanguageSetting, reloadLanguageSetting, resolveLanguage, setLanguageSetting } from './language.ts'
import { clampLevel, getZoomLevel, reloadZoom, resetZoom, setZoomLevel, zoomBy, zoomPercent, ZOOM_MAX, ZOOM_MIN } from './zoom.ts'

beforeEach(() => {
  localStorage.clear()
  reloadLanguageSetting()
  reloadZoom()
})
afterEach(() => void delete window.wsnp)

describe('the display language', () => {
  it('follows the system until the user chooses, and remembers the choice', () => {
    expect(getLanguageSetting()).toBe('auto')
    setLanguageSetting('pt-BR')
    expect(getLanguageSetting()).toBe('pt-BR')
    expect(localStorage.getItem('wsnp:language')).toBe('"pt-BR"')
    reloadLanguageSetting()
    expect(getLanguageSetting()).toBe('pt-BR')
  })
  it('resolves auto to the system language and a choice to itself', () => {
    expect(resolveLanguage('en')).toBe('en')
    expect(resolveLanguage('pt-BR')).toBe('pt-BR')
    expect(['en', 'pt-BR']).toContain(resolveLanguage('auto'))
  })
  it('ignores a stored value that is not a language', () => {
    localStorage.setItem('wsnp:language', '"klingon"')
    reloadLanguageSetting()
    expect(getLanguageSetting()).toBe('auto')
  })
})

describe('the zoom of the interface', () => {
  it('counts 20 % a step, from 100 %', () => {
    expect([ZOOM_MIN, -1, 0, 1, 2, ZOOM_MAX].map(zoomPercent)).toEqual([58, 83, 100, 120, 144, 249])
  })
  it('zooms by steps, stays inside its limits, resets, and tells the window', () => {
    const setZoomLevelOnWindow = vi.fn()
    window.wsnp = { setZoomLevel: setZoomLevelOnWindow } as unknown as typeof window.wsnp
    zoomBy(1)
    zoomBy(1)
    expect(getZoomLevel()).toBe(2)
    expect(setZoomLevelOnWindow).toHaveBeenLastCalledWith(2)
    zoomBy(100)
    expect(getZoomLevel()).toBe(ZOOM_MAX)
    zoomBy(-100)
    expect(getZoomLevel()).toBe(ZOOM_MIN)
    resetZoom()
    expect(getZoomLevel()).toBe(0)
    expect(setZoomLevelOnWindow).toHaveBeenLastCalledWith(0)
  })
  it('is kept between runs, and a stored nonsense is taken as 100 %', () => {
    setZoomLevel(3)
    reloadZoom()
    expect(getZoomLevel()).toBe(3)
    localStorage.setItem('wsnp:zoomLevel', '"big"')
    reloadZoom()
    expect(getZoomLevel()).toBe(0)
    localStorage.setItem('wsnp:zoomLevel', '99')
    reloadZoom()
    expect(getZoomLevel()).toBe(ZOOM_MAX)
  })
  it('rounds to a whole step', () => {
    expect(clampLevel(1.4)).toBe(1)
    expect(clampLevel(-7)).toBe(ZOOM_MIN)
  })
})
