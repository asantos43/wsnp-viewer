// @vitest-environment happy-dom
import type { WsnpApi } from '@core/api.ts'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/context.tsx'
import { svgView } from '@/state/setting.ts'
import { FileView, forgetReads } from './FileView.tsx'
import { ImageView } from './ImageView.tsx'

beforeEach(() => {
  forgetReads()
  localStorage.clear()
  svgView.reload()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  delete window.wsnp
})

const PNG = new Uint8Array([137, 80, 78, 71])
const show = (path = 'a.txt', id = 's1') =>
  render(
    <I18nProvider language="en">
      <FileView snapshotId={id} path={path} kind="text" mediaType="text/plain" size={5} onSave={() => {}} onViewEntry={() => {}} onNotify={() => {}} />
    </I18nProvider>,
  )

describe('FileView: no flash between one file and the next', () => {
  it('shows a blank ground, not a message, while a file is read, and the message only when it is slow', async () => {
    vi.useFakeTimers()
    let done: (r: { bytes: Uint8Array }) => void = () => {}
    window.wsnp = { readFile: vi.fn(() => new Promise((resolve) => void (done = resolve))) } as unknown as WsnpApi
    show()
    expect(screen.queryByText('Loading…')).toBeNull()
    act(() => void vi.advanceTimersByTime(100))
    expect(screen.queryByText('Loading…')).toBeNull()
    act(() => void vi.advanceTimersByTime(100))
    expect(screen.getByText('Loading…')).toBeTruthy()
    await act(async () => done({ bytes: new TextEncoder().encode('hello') }))
    expect(screen.queryByText('Loading…')).toBeNull()
    vi.useRealTimers()
    await waitFor(() => expect(document.querySelector('.cm-content')?.textContent).toBe('hello'))
  })

  it('reads a file once: shown again it is there at once, from what was read', async () => {
    const readFile = vi.fn(async () => ({ bytes: new TextEncoder().encode('hello') }))
    window.wsnp = { readFile } as unknown as WsnpApi
    const first = show()
    await waitFor(() => expect(document.querySelector('.cm-content')?.textContent).toBe('hello'))
    first.unmount()
    show()
    await waitFor(() => expect(document.querySelector('.cm-content')?.textContent).toBe('hello'))
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(readFile).toHaveBeenCalledTimes(1)
  })

  it('reads again a file of another snapshot, and what belongs to a closed snapshot is forgotten', async () => {
    const readFile = vi.fn(async () => ({ bytes: new TextEncoder().encode('hello') }))
    window.wsnp = { readFile } as unknown as WsnpApi
    const shown = async (id: string) => {
      const view = show('a.txt', id)
      await waitFor(() => expect(document.querySelector('.cm-content')?.textContent).toBe('hello'))
      view.unmount()
    }
    await shown('s1')
    await shown('s2')
    expect(readFile).toHaveBeenCalledTimes(2)
    forgetReads('s1')
    await shown('s2')
    expect(readFile).toHaveBeenCalledTimes(2)
    await shown('s1')
    expect(readFile).toHaveBeenCalledTimes(3)
  })

  it('does not keep a file that is large, nor more than its budget', async () => {
    const big = new Uint8Array(20 * 2 ** 20)
    const readFile = vi.fn(async () => ({ bytes: big }))
    window.wsnp = { readFile } as unknown as WsnpApi
    render(
      <I18nProvider language="en">
        <FileView snapshotId="s1" path="big.png" kind="image" mediaType="image/png" size={big.length} onSave={() => {}} onViewEntry={() => {}} onNotify={() => {}} />
      </I18nProvider>,
    ).unmount()
    render(
      <I18nProvider language="en">
        <FileView snapshotId="s1" path="big.png" kind="image" mediaType="image/png" size={big.length} onSave={() => {}} onViewEntry={() => {}} onNotify={() => {}} />
      </I18nProvider>,
    )
    await waitFor(() => expect(readFile).toHaveBeenCalledTimes(2))
  })
})

describe('ImageView: no flash while the picture is fitted', () => {
  it('loads the picture out of sight until its size is known, then shows it at the size it is fitted to', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    render(
      <I18nProvider language="en">
        <ImageView id="s:p" bytes={PNG} mediaType="image/png" name="p.png" onSave={() => {}} />
      </I18nProvider>,
    )
    const img = screen.getByRole('img', { name: 'p.png' }) as HTMLImageElement
    expect(img.style.opacity).toBe('0')
    expect(img.style.position).toBe('absolute')
    Object.defineProperty(img, 'naturalWidth', { value: 320 })
    Object.defineProperty(img, 'naturalHeight', { value: 160 })
    fireEvent.load(img)
    expect(img.style.opacity).toBe('')
    expect(img.style.position).toBe('')
    expect(img.style.width).not.toBe('1px')
  })
})

describe('FileView: an SVG is a picture and its source', () => {
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="teal"/></svg>'
  const showSvg = (path = 'mark.svg') => {
    URL.createObjectURL = vi.fn(() => 'blob:svg')
    URL.revokeObjectURL = vi.fn()
    window.wsnp = { readFile: vi.fn(async () => ({ bytes: new TextEncoder().encode(SVG) })) } as unknown as WsnpApi
    return render(
      <I18nProvider language="en">
        <FileView snapshotId="s1" path={path} kind="text" mediaType="image/svg+xml" size={SVG.length} onSave={() => {}} onViewEntry={() => {}} onNotify={() => {}} />
      </I18nProvider>,
    )
  }
  const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

  it('is shown as a picture at first, with the switch to its source at the start of the toolbar', async () => {
    showSvg()
    expect(await screen.findByRole('img', { name: 'mark.svg' })).toBeTruthy()
    expect(document.querySelector('.cm-content')).toBeNull()
    expect(pressed('Show the SVG as a picture')).toBe('true')
    expect(pressed('Show the SVG as source code')).toBe('false')
    // The picture's own toolbar is there too.
    expect(screen.getByRole('combobox', { name: 'Zoom' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save As…' })).toBeTruthy()
  })

  it('switches to the source and back, with the same switch in the toolbar of either, and keeps the choice for every SVG', async () => {
    const first = showSvg()
    await screen.findByRole('img', { name: 'mark.svg' })
    fireEvent.click(screen.getByRole('button', { name: 'Show the SVG as source code' }))
    await waitFor(() => expect(document.querySelector('.cm-content')?.textContent).toContain('<circle cx="20"'))
    expect(screen.queryByRole('img', { name: 'mark.svg' })).toBeNull()
    expect(pressed('Show the SVG as source code')).toBe('true')
    // Source is coloured as XML, and has its own toolbar (Word Wrap, Save As).
    expect(screen.getByRole('button', { name: /Wrap long lines/ })).toBeTruthy()
    expect(localStorage.getItem('wsnp:svgView')).toBe('"code"')
    first.unmount()
    showSvg('other.svg')
    await waitFor(() => expect(document.querySelector('.cm-content')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Show the SVG as a picture' }))
    expect(await screen.findByRole('img', { name: 'other.svg' })).toBeTruthy()
    expect(localStorage.getItem('wsnp:svgView')).toBe('"image"')
  })

  it('is not offered for a text that is not an SVG', async () => {
    window.wsnp = { readFile: vi.fn(async () => ({ bytes: new TextEncoder().encode('<a/>') })) } as unknown as WsnpApi
    render(
      <I18nProvider language="en">
        <FileView snapshotId="s1" path="a.xml" kind="text" mediaType="application/xml" size={4} onSave={() => {}} onViewEntry={() => {}} onNotify={() => {}} />
      </I18nProvider>,
    )
    await waitFor(() => expect(document.querySelector('.cm-content')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Show the SVG as a picture' })).toBeNull()
  })

  it('gives its source the zoom of the tab', async () => {
    svgView.set('code')
    window.wsnp = { readFile: vi.fn(async () => ({ bytes: new TextEncoder().encode(SVG) })) } as unknown as WsnpApi
    render(
      <I18nProvider language="en">
        <FileView snapshotId="s1" path="z.svg" kind="text" mediaType="image/svg+xml" size={SVG.length} onSave={() => {}} onViewEntry={() => {}} onNotify={() => {}} zoom={1.5} />
      </I18nProvider>,
    )
    await waitFor(() => expect(document.querySelector('.cm-editor')?.closest('div[style]')?.getAttribute('style')).toContain('--wsnp-zoom: 1.5'))
  })
})
