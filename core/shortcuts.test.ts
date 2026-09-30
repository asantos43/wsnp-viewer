import { describe, expect, it } from 'vitest'
import { commandFor } from './shortcuts.ts'

describe('commandFor', () => {
  it('uses Ctrl on Windows and Linux', () => {
    expect(commandFor({ key: 'b', control: true }, false)).toBe('toggleSideBar')
    expect(commandFor({ key: 'B', control: true }, false)).toBe('toggleSideBar')
    expect(commandFor({ key: 'o', control: true }, false)).toBe('openFile')
    expect(commandFor({ key: 'w', control: true }, false)).toBe('closeEditor')
    expect(commandFor({ key: 'PageDown', control: true }, false)).toBe('nextEditor')
    expect(commandFor({ key: 'PageUp', control: true }, false)).toBe('previousEditor')
    expect(commandFor({ key: 'b', meta: true }, false)).toBeNull()
  })
  it('uses Command on macOS', () => {
    expect(commandFor({ key: 'b', meta: true }, true)).toBe('toggleSideBar')
    expect(commandFor({ key: 'w', meta: true }, true)).toBe('closeEditor')
    expect(commandFor({ key: 'b', control: true }, true)).toBeNull()
  })
  it('goes to tab N with Alt+N, or Command+N on macOS', () => {
    expect(commandFor({ key: '3', alt: true }, false)).toBe('goToTab3')
    expect(commandFor({ key: '9', alt: true }, false)).toBe('goToTab9')
    expect(commandFor({ key: '0', alt: true }, false)).toBeNull()
    expect(commandFor({ key: '2', meta: true }, true)).toBe('goToTab2')
    expect(commandFor({ key: '2', control: true }, false)).toBeNull()
  })
  it('cycles through the tabs in the order of use with Ctrl+Tab and Ctrl+Shift+Tab, everywhere', () => {
    for (const mac of [false, true]) {
      expect(commandFor({ key: 'Tab', control: true }, mac)).toBe('cycleRecent')
      expect(commandFor({ key: 'Tab', control: true, shift: true }, mac)).toBe('cycleRecentBack')
    }
  })
  it('leaves everything else to the page: no modifier, other modifiers, other keys', () => {
    expect(commandFor({ key: 'b' }, false)).toBeNull()
    expect(commandFor({ key: 'b', control: true, shift: true }, false)).toBeNull()
    expect(commandFor({ key: 'b', control: true, alt: true }, false)).toBeNull()
    expect(commandFor({ key: 'c', control: true }, false)).toBeNull()
    expect(commandFor({ key: 'Tab' }, false)).toBeNull()
  })
})
