// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MenuList, type MenuEntry } from './Menu.tsx'

afterEach(cleanup)

const entries = (run = vi.fn()): MenuEntry[] => [
  { id: 'a', label: 'Alpha', shortcut: 'Ctrl+A', run },
  { separator: true },
  { id: 'b', label: 'Beta', disabled: true },
  { id: 'c', label: 'Gamma', checked: true },
]

describe('MenuList', () => {
  it('focuses the first enabled item and shows the shortcut and the check', () => {
    render(<MenuList entries={entries()} label="Test" onClose={() => {}} />)
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Alpha/ }))
    expect(screen.getByText('Ctrl+A')).toBeTruthy()
    expect(screen.getByRole('menuitemcheckbox', { name: /Gamma/ }).getAttribute('aria-checked')).toBe('true')
  })
  it('moves with the arrows, skipping the disabled item and wrapping around', () => {
    render(<MenuList entries={entries()} label="Test" onClose={() => {}} />)
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitemcheckbox', { name: /Gamma/ }))
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Alpha/ }))
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(screen.getByRole('menuitemcheckbox', { name: /Gamma/ }))
  })
  it('runs an item and closes; a disabled item does nothing', () => {
    const run = vi.fn()
    const onClose = vi.fn()
    render(<MenuList entries={entries(run)} label="Test" onClose={onClose} />)
    fireEvent.click(screen.getByRole('menuitem', { name: /Beta/ }))
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('menuitem', { name: /Alpha/ }))
    expect(run).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('opens a submenu with the right arrow, closes it with the left one, and runs an item of it', () => {
    const run = vi.fn()
    const onClose = vi.fn()
    const items: MenuEntry[] = [{ id: 'recent', label: 'Open Recent', submenu: [{ id: 'one', label: 'One.wsnp', run }, { id: 'clear', label: 'Clear' }] }, { id: 'x', label: 'Other' }]
    render(<MenuList entries={items} label="File" onClose={onClose} />)
    expect(screen.queryByRole('menu', { name: 'Open Recent' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('menu', { name: 'File' }), { key: 'ArrowRight' })
    const submenu = screen.getByRole('menu', { name: 'Open Recent' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'One.wsnp' }))
    fireEvent.keyDown(submenu, { key: 'ArrowLeft' })
    expect(screen.queryByRole('menu', { name: 'Open Recent' })).toBeNull()
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: /Open Recent/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'One.wsnp' }))
    expect(run).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
  it('closes on Escape and hands over to the neighbouring menu on the side arrows', () => {
    const onClose = vi.fn()
    const onSide = vi.fn()
    render(<MenuList entries={entries()} label="Test" onClose={onClose} onSide={onSide} />)
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'ArrowRight' })
    fireEvent.keyDown(menu, { key: 'ArrowLeft' })
    expect(onSide.mock.calls).toEqual([[1], [-1]])
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
