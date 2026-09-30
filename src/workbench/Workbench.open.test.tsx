// @vitest-environment happy-dom
import type { IntegrityEvent, OpenResult, WsnpApi } from '@core/api.ts'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/context.tsx'
import type { SnapshotInfo } from '@core/snapshots.ts'
import { snapshotInfo } from '@/test/fixtures.ts'
import { Workbench } from './Workbench.tsx'

/** The main process, as far as the interface sees it: what it is asked, and what it answers. */
function fakeApi(initial: OpenResult[] = []) {
  const listeners = { opened: new Set<(r: OpenResult[]) => void>(), integrity: new Set<(e: IntegrityEvent) => void>(), command: new Set<(c: string) => void>(), openFile: new Set<(t: { snapshotId: string; path: string }) => void>() }
  const api = {
    platform: 'linux',
    setTitleBar: vi.fn(),
    onCommand: (l: (c: string) => void) => (listeners.command.add(l), () => void listeners.command.delete(l)),
    pathForFile: vi.fn((file: File) => `/dropped/${file.name}`),
    ready: vi.fn(async () => initial),
    openDialog: vi.fn(async (): Promise<OpenResult[]> => []),
    openPaths: vi.fn(async (): Promise<OpenResult[]> => []),
    onOpened: (l: (r: OpenResult[]) => void) => (listeners.opened.add(l), () => void listeners.opened.delete(l)),
    close: vi.fn(async (_id: string) => {}),
    readFile: vi.fn(async (_id: string, path: string) => ({ bytes: new TextEncoder().encode(`contents of ${path}`) })),
    saveFileAs: vi.fn(async (_id: string, path: string) => ({ saved: true as const, path: `/home/me/${path.split('/').at(-1)}` })),
    verify: vi.fn(async (_id: string) => {}),
    onIntegrity: (l: (e: IntegrityEvent) => void) => (listeners.integrity.add(l), () => void listeners.integrity.delete(l)),
    onOpenFile: (l: (t: { snapshotId: string; path: string }) => void) => (listeners.openFile.add(l), () => void listeners.openFile.delete(l)),
    onSaved: () => () => {},
    openExternal: vi.fn(async () => {}),
    copyText: vi.fn(async () => {}),
    reveal: vi.fn(async (_id: string) => {}),
    recent: { list: vi.fn(async () => ['/home/me/a.wsnp']), clear: vi.fn(async () => {}) },
    signers: { list: vi.fn(async (): Promise<Record<string, { name?: string }>> => ({})), trust: vi.fn(async (_fingerprint: string, _name?: string) => {}), forget: vi.fn(async (_fingerprint: string) => {}) },
  }
  const emit = {
    opened: (r: OpenResult[]) => act(() => listeners.opened.forEach((l) => l(r))),
    integrity: (e: IntegrityEvent) => act(() => listeners.integrity.forEach((l) => l(e))),
    command: (c: string) => act(() => listeners.command.forEach((l) => l(c))),
  }
  return { api: api as unknown as WsnpApi & typeof api, emit }
}
const ok = (id: string, title?: string, already = false, signature?: SnapshotInfo['signature']): OpenResult => ({ ok: true, snapshot: snapshotInfo(id, title, signature ? { signature } : {}), already })
const FP = 'ab'.repeat(32)
const signedBy = (): SnapshotInfo['signature'] => ({ state: 'valid', algorithm: 'Ed25519', publicKey: 'AAAA', fingerprint: FP, fingerprintShort: 'ABAB-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB' })

function show(initial: OpenResult[] = []) {
  const fake = fakeApi(initial)
  window.wsnp = fake.api
  render(<I18nProvider language="en"><Workbench /></I18nProvider>)
  return fake
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  delete window.wsnp
})

describe('the workbench with snapshots', () => {
  it('opens what the command line named when the interface says it is ready, and checks its integrity', async () => {
    const { api } = show([ok('a', 'Alpha'), ok('b', 'Beta')])
    await screen.findAllByRole('tab')
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(api.ready).toHaveBeenCalledOnce()
    expect(api.verify.mock.calls.map((c) => c[0])).toEqual(['a', 'b'])
    expect(screen.getByRole('listbox', { name: 'Open Snapshots' }).querySelectorAll('[role=option]')).toHaveLength(2)
  })
  it('shows each snapshot in an iframe with the sandbox and its own origin, and only the active one is visible', async () => {
    show([ok('a', 'Alpha'), ok('b', 'Beta')])
    await screen.findAllByRole('tab')
    const frames = document.querySelectorAll('iframe')
    expect([...frames].map((f) => f.getAttribute('src'))).toEqual(['wsnp://a/', 'wsnp://b/'])
    expect([...frames].every((f) => f.getAttribute('sandbox') === 'allow-scripts')).toBe(true)
    expect([...frames].map((f) => f.hidden)).toEqual([true, false])
    fireEvent.click(screen.getAllByRole('tab')[0])
    expect([...document.querySelectorAll('iframe')].map((f) => f.hidden)).toEqual([false, true])
  })
  it('a file opened from the system while the app runs gets its tab; the same file again only shows its tab', async () => {
    const { emit, api } = show([ok('a', 'Alpha')])
    await screen.findAllByRole('tab')
    await emit.opened([ok('b', 'Beta')])
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    await emit.opened([ok('a', 'Alpha', true)])
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('Alpha')
    expect(api.verify.mock.calls.map((c) => c[0])).toEqual(['a', 'b'])
  })
  it('says why a file was refused, in plain words, and keeps the open ones', async () => {
    const { emit } = show([ok('a', 'Alpha')])
    await screen.findAllByRole('tab')
    await emit.opened([{ ok: false, path: '/x/Bad.wsnp', issues: [{ code: 'not-zip' }], omitted: 0 }, { ok: false, path: '/x/Locked.wsnp', issues: [{ code: 'protected' }], omitted: 0 }])
    expect(screen.getByRole('alert').textContent).toContain('Could not open Bad.wsnp: This is not a WSNP file')
    expect(screen.getByRole('status').textContent).toContain('Locked.wsnp can’t be opened: It is password-protected')
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('lets the main process release a snapshot when its tab closes', async () => {
    const { api, emit } = show([ok('a', 'Alpha'), ok('b', 'Beta')])
    await screen.findAllByRole('tab')
    await emit.command('closeEditor')
    await waitFor(() => expect(api.close).toHaveBeenCalledWith('b'))
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    expect(document.querySelectorAll('iframe')).toHaveLength(1)
  })
  it('opens the picker from the menu, the shortcut and the button', async () => {
    const { api } = show()
    fireEvent.click(screen.getByRole('menuitem', { name: 'File' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Open File/ }))
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true })
    fireEvent.click(screen.getByRole('button', { name: 'Open File' }))
    await waitFor(() => expect(api.openDialog).toHaveBeenCalledTimes(3))
  })
  it('opens a recent file from the File menu', async () => {
    const { api } = show()
    await waitFor(() => expect(api.recent.list).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('menuitem', { name: 'File' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Open Recent/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'a.wsnp' }))
    expect(api.openPaths).toHaveBeenCalledWith(['/home/me/a.wsnp'])
  })
  it('shows progress, then the result, of the integrity check, in the status bar and the Integrity view', async () => {
    const { emit } = show([ok('a', 'Alpha')])
    await screen.findAllByRole('tab')
    await emit.integrity({ id: 'a', state: 'running', done: 50, total: 100 })
    expect(screen.getByRole('contentinfo').textContent).toContain('Checking 50%')
    await emit.integrity({ id: 'a', state: 'done', report: { checked: 7, bytes: 100, problems: [{ code: 'inline-script', path: 'index.html' }], aborted: false } })
    expect(screen.getByRole('contentinfo').textContent).toContain('1 problem')
    fireEvent.click(screen.getByRole('button', { name: 'Integrity' }))
    fireEvent.click(screen.getByRole('button', { name: 'index.html has a script written into the page.' }))
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('index.html')]))
  })
  it('shows a file of the snapshot as source and offers Save As for one that cannot be shown', async () => {
    const { api } = show([ok('a', 'Alpha')])
    await screen.findAllByRole('tab')
    fireEvent.click(screen.getByRole('treeitem', { name: 'assets' }))
    fireEvent.click(screen.getByRole('treeitem', { name: 'files' }))
    fireEvent.doubleClick(screen.getByRole('treeitem', { name: 'bundle.zip' }))
    expect(screen.getByText('This kind of file is not shown here.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save As…' }))
    await waitFor(() => expect(api.saveFileAs).toHaveBeenCalledWith('a', 'assets/files/bundle.zip'))
    expect((await screen.findByRole('status')).textContent).toContain('Saved bundle.zip.')
    expect(api.readFile).not.toHaveBeenCalled()
  })
  it('holds back a snapshot whose files are not what the manifest says, until the user insists', async () => {
    const { emit } = show([ok('a', 'Alpha')])
    await screen.findAllByRole('tab')
    expect(document.querySelector('iframe')?.hidden).toBe(false)
    await emit.integrity({ id: 'a', state: 'done', report: { checked: 7, bytes: 100, problems: [{ code: 'hash-mismatch', path: 'assets/styles/site.css' }], aborted: false } })
    expect(screen.getByRole('alert').textContent).toContain('This snapshot is not valid')
    expect(screen.getByRole('alert').textContent).toContain('assets/styles/site.css')
    expect(document.querySelector('iframe')?.hidden).toBe(true)
    expect(screen.getByRole('contentinfo').textContent).toContain('Invalid')
    fireEvent.click(screen.getByRole('button', { name: 'Show Anyway' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.querySelector('iframe')?.hidden).toBe(false)
  })
  it('can close a snapshot that is not valid, or look at its metadata', async () => {
    const { emit, api } = show([ok('a', 'Alpha')])
    await screen.findAllByRole('tab')
    await emit.integrity({ id: 'a', state: 'done', report: { checked: 7, bytes: 100, problems: [{ code: 'size-mismatch', path: 'index.html' }], aborted: false } })
    fireEvent.click(screen.getByRole('button', { name: 'Show Metadata' }))
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('Metadata')
    fireEvent.click(screen.getByRole('tab', { name: /Alpha$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Close Snapshot' }))
    await waitFor(() => expect(api.close).toHaveBeenCalledWith('a'))
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })
  it('shows the metadata of a snapshot in a tab: what the manifest says and what was checked', async () => {
    show([ok('a', 'Alpha')])
    await screen.findAllByRole('tab')
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show Metadata' }))
    const view = screen.getByLabelText('Metadata')
    expect(view.textContent).toContain('PageKeep 1.5.0')
    expect(view.textContent).toContain('https://a.example/')
    expect(view.textContent).toContain('1280 × 800')
    expect(view.textContent).toContain('HTTP 404')
    expect(view.textContent).toContain('Not signed.')
    expect(screen.getByRole('navigation', { name: 'Breadcrumbs' }).textContent).toBe('AlphaMetadata')
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Alpha', 'Alpha — Metadata'])
  })
  it('opens a file for a tab through the main process, and a link click can ask for one too', async () => {
    const { api } = show([ok('a', 'Alpha')])
    await screen.findAllByRole('tab')
    fireEvent.click(screen.getByRole('treeitem', { name: 'index.html' }))
    await waitFor(() => expect(api.readFile).toHaveBeenCalledWith('a', 'index.html'))
    expect(screen.getByRole('navigation', { name: 'Breadcrumbs' }).textContent).toBe('Alphaindex.html')
  })
  it('takes files dropped on the window by their path, and shows a hint while they are over it', async () => {
    const { api } = show()
    const file = new File(['x'], 'trip.wsnp')
    const data = { types: ['Files'], files: [file] }
    fireEvent(window, Object.assign(new Event('dragenter', { cancelable: true }), { dataTransfer: data }))
    expect(await screen.findByText('Drop .wsnp files to open them')).toBeTruthy()
    fireEvent(window, Object.assign(new Event('drop', { cancelable: true }), { dataTransfer: data }))
    await waitFor(() => expect(api.openPaths).toHaveBeenCalledWith(['/dropped/trip.wsnp']))
    expect(screen.queryByText('Drop .wsnp files to open them')).toBeNull()
  })
  it('handles the commands of the native menu and of the main process shortcuts', async () => {
    const { emit } = show([ok('a', 'Alpha'), ok('b', 'Beta'), ok('c', 'Gamma')])
    await screen.findAllByRole('tab')
    const active = () => screen.getByRole('tab', { selected: true }).textContent
    await emit.command('goToTab1')
    expect(active()).toContain('Alpha')
    await emit.command('nextEditor')
    expect(active()).toContain('Beta')
    await emit.command('previousEditor')
    expect(active()).toContain('Alpha')
    // Used last: Alpha, Beta, Gamma. Ctrl+Tab goes down that list, and letting go of Control makes the last one shown the most recent.
    await emit.command('cycleRecent')
    expect(active()).toContain('Beta')
    await emit.command('cycleRecent')
    expect(active()).toContain('Gamma')
    await emit.command('cycleEnd')
    await emit.command('cycleRecent')
    expect(active()).toContain('Alpha')
    await emit.command('cycleEnd')
    await emit.command('goToTab9')
    expect(active()).toContain('Gamma')
    await emit.command('toggleSideBar')
    expect(screen.getByRole('button', { name: 'Toggle Primary Side Bar' }).getAttribute('aria-pressed')).toBe('false')
  })
  it('says a snapshot is not signed, quietly, in the status bar and the metadata', async () => {
    show([ok('a', 'Alpha')])
    await screen.findAllByRole('tab')
    expect(screen.getByRole('contentinfo').textContent).toContain('Not signed')
    fireEvent.click(screen.getByRole('button', { name: /Not signed/ }))
    expect(screen.getByLabelText('Metadata').textContent).toContain('if someone unzipped the file and edited the manifest')
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('shows a signature that checks with a key the viewer does not know, and trusts it when the user says so, with a name', async () => {
    const { api } = show([ok('a', 'Alpha', false, signedBy())])
    await screen.findAllByRole('tab')
    expect(screen.getByRole('contentinfo').textContent).toContain('Signed (new key)')
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Signed \(new key\)/ }))
    const view = screen.getByLabelText('Metadata')
    expect(view.textContent).toContain('Signed by a key this viewer does not know yet (ABAB-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB)')
    expect(view.textContent).toContain('Ed25519')
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'PageKeep at work' } })
    api.signers.list.mockResolvedValue({ [FP]: { name: 'PageKeep at work' } })
    fireEvent.click(screen.getByRole('button', { name: 'Trust this signer' }))
    await waitFor(() => expect(api.signers.trust).toHaveBeenCalledWith(FP, 'PageKeep at work'))
    await waitFor(() => expect(screen.getByLabelText('Metadata').textContent).toContain('Signed by PageKeep at work'))
    expect(screen.getByRole('contentinfo').textContent).toContain('Signed')
    expect(screen.getByRole('contentinfo').textContent).not.toContain('new key')
    api.signers.list.mockResolvedValue({})
    fireEvent.click(screen.getByRole('button', { name: 'Stop trusting' }))
    await waitFor(() => expect(api.signers.forget).toHaveBeenCalledWith(FP))
  })
  it('remembers the signers the user trusts, from the main process', async () => {
    const fake = fakeApi([ok('a', 'Alpha', false, signedBy())])
    fake.api.signers.list.mockResolvedValue({ [FP]: {} })
    window.wsnp = fake.api
    render(<I18nProvider language="en"><Workbench /></I18nProvider>)
    await screen.findAllByRole('tab')
    await waitFor(() => expect(screen.getByRole('contentinfo').textContent).toContain('Signed'))
    fireEvent.click(screen.getByRole('button', { name: /^Signed/ }))
    expect(screen.getByLabelText('Metadata').textContent).toContain('Signed by a key you trust (ABAB-')
  })
  it('holds back at once a snapshot whose manifest was edited after it was signed, and says why', async () => {
    show([ok('a', 'Alpha', false, { state: 'invalid', reason: 'manifest-mismatch' })])
    await screen.findAllByRole('tab')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('This snapshot is not valid')
    expect(alert.textContent).toContain('The metadata of the snapshot was edited after it was signed')
    expect(document.querySelector('iframe')?.hidden).toBe(true)
    expect(screen.getByRole('contentinfo').textContent).not.toContain('Signed')
  })
})
