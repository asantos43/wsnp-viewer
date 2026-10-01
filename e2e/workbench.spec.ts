import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'

// End-to-end: the real app with its interface. Each launch has a profile folder of its own, so nothing
// touches the developer's settings and the second launch of a test can prove that a setting is remembered.
// On macOS the menu is the native one (outside the window), so the HTML menu bar is not there to be tested.
const htmlMenu = process.platform !== 'darwin'
const noSandbox = process.env.CI && process.platform === 'linux' ? ['--no-sandbox'] : []
let profile: string
let app: ElectronApplication | undefined

test.beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wsnp-e2e-'))
})
test.afterEach(async () => {
  await app?.close().catch(() => {})
  app = undefined
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

async function launch(...extra: string[]): Promise<Page> {
  app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`, ...noSandbox, ...extra] })
  const page = await app.firstWindow()
  await page.getByTestId('titlebar').waitFor()
  return page
}

const background = (page: Page, selector: string) => page.locator(selector).evaluate((el) => getComputedStyle(el).backgroundColor)

test('the window is the workbench: title bar, menu, activity bar, side bar, editor, status bar', async () => {
  const page = await launch('--force-dark-mode')
  await expect(page).toHaveTitle('WSNP Viewer')
  if (htmlMenu) await expect(page.getByRole('menubar').getByRole('menuitem')).toHaveText(['File', 'Edit', 'View', 'Go', 'Help'])
  await expect(page.getByRole('navigation', { name: 'Activity Bar' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Snapshots' })).toBeVisible()
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('contentinfo')).toContainText('No snapshot open')
  const bar = await page.getByTestId('titlebar').boundingBox()
  expect(bar?.height).toBe(30)
  expect(await page.getByRole('contentinfo').boundingBox().then((b) => b?.height)).toBe(22)
  expect(await page.getByRole('navigation', { name: 'Activity Bar' }).boundingBox().then((b) => b?.width)).toBe(48)
})

test('Ctrl+B (and the View menu) hide and show the side bar', async () => {
  const page = await launch()
  const side = page.getByRole('complementary', { name: 'Snapshots' })
  await page.keyboard.press('ControlOrMeta+B')
  await expect(side).toBeHidden()
  if (htmlMenu) {
    await page.getByRole('menuitem', { name: 'View' }).click()
    await page.getByRole('menuitem', { name: /Toggle Side Bar/ }).click()
  } else {
    await page.keyboard.press('ControlOrMeta+B')
  }
  await expect(side).toBeVisible()
})

test('the theme can be chosen, changes the colours, and is remembered', async () => {
  let page = await launch()
  await page.getByRole('button', { name: 'Manage' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Light+' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await background(page, 'main')).toBe('rgb(255, 255, 255)')
  expect(await background(page, 'aside')).toBe('rgb(243, 243, 243)')
  expect(await background(page, 'footer')).toBe('rgb(0, 122, 204)')
  await app?.close()
  page = await launch()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Manage' }).click()
  await page.getByRole('menuitemcheckbox', { name: 'Dark+' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await background(page, 'main')).toBe('rgb(30, 30, 30)')
  expect(await background(page, 'aside')).toBe('rgb(37, 37, 38)')
  expect(await background(page, '[data-testid=titlebar]')).toBe('rgb(60, 60, 60)')
})

test('the interface follows the system language: Brazilian Portuguese', async () => {
  const page = await launch('--lang=pt-BR')
  if (htmlMenu) await expect(page.getByRole('menubar').getByRole('menuitem')).toHaveText(['Arquivo', 'Editar', 'Exibir', 'Ir', 'Ajuda'])
  await expect(page.getByRole('contentinfo')).toContainText('Nenhum snapshot aberto')
  await expect(page.getByRole('button', { name: 'Gerenciar' })).toBeVisible()
})

test('the interface reaches nothing outside itself', async () => {
  const page = await launch()
  const attempts = await page.evaluate(async () => {
    const tries = ['https://example.com/', 'http://127.0.0.1:9/', 'wsnp://unknown/index.html']
    return Promise.all(tries.map((url) => fetch(url).then((r) => `reached ${r.status}`, () => 'refused')))
  })
  expect(attempts).toEqual(['refused', 'refused', 'refused'])
  // The window has no Node and offers only what the preload exposes.
  expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
  expect(await page.evaluate(() => Object.keys((window as unknown as { wsnp: object }).wsnp).sort())).toEqual(['appInfo', 'clearFindInPage', 'close', 'copyFromPage', 'copyText', 'findInPage', 'onCommand', 'onIntegrity', 'onOpenFile', 'onOpened', 'onPageContext', 'onSaved', 'openDialog', 'openExternal', 'openPaths', 'openWith', 'openWithApp', 'openWithCancel', 'pathForFile', 'platform', 'print', 'readFile', 'ready', 'recent', 'reveal', 'saveConverted', 'saveFileAs', 'savePdf', 'selectAllInPage', 'session', 'setTitleBar', 'setZoomLevel', 'signers', 'verify', 'zipExtract', 'zipList'])
})

test('Settings opens in a tab (Ctrl+, or the gear), changes the language at once and remembers it', async () => {
  let page = await launch('--lang=en-US')
  await page.keyboard.press('ControlOrMeta+,')
  await expect(page.getByRole('tab', { name: /Settings/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Breadcrumbs' })).toHaveText('Settings')
  await page.getByRole('combobox', { name: 'Display Language' }).selectOption('pt-BR')
  await expect(page.getByRole('tab', { name: /Configurações/ })).toBeVisible()
  if (htmlMenu) await expect(page.getByRole('menubar').getByRole('menuitem')).toHaveText(['Arquivo', 'Editar', 'Exibir', 'Ir', 'Ajuda'])
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await app?.close()
  page = await launch('--lang=en-US')
  if (htmlMenu) await expect(page.getByRole('menubar').getByRole('menuitem')).toHaveText(['Arquivo', 'Editar', 'Exibir', 'Ir', 'Ajuda'])
  await page.getByRole('button', { name: 'Gerenciar' }).click()
  await page.getByRole('menuitem', { name: /Configurações/ }).click()
  await page.getByRole('combobox', { name: 'Idioma de Exibição' }).selectOption('auto')
  await expect(page.getByRole('contentinfo')).toContainText('English')
})

test('the zoom of the interface: Ctrl+=, Ctrl+-, Ctrl+0 and Settings change it, and it is remembered', async () => {
  let page = await launch()
  const ratio = () => page.evaluate(() => window.devicePixelRatio)
  const start = await ratio()
  await page.keyboard.press('ControlOrMeta+=')
  await expect.poll(ratio).toBeCloseTo(start * 1.2, 2)
  await page.keyboard.press('ControlOrMeta+=')
  await expect.poll(ratio).toBeCloseTo(start * 1.44, 2)
  await page.keyboard.press('ControlOrMeta+-')
  await expect.poll(ratio).toBeCloseTo(start * 1.2, 2)
  await app?.close()
  page = await launch()
  await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBeCloseTo(start * 1.2, 2)
  await page.keyboard.press('ControlOrMeta+,')
  await expect(page.getByText('120%')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBeCloseTo(start, 2)
})

test('the settings can be searched', async () => {
  const page = await launch()
  await page.keyboard.press('ControlOrMeta+,')
  await page.getByRole('searchbox', { name: 'Search settings' }).fill('zoom')
  await expect(page.getByRole('heading', { name: 'Zoom Level' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Display Language' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search settings' }).fill('no such setting')
  await expect(page.getByText('No setting matches “no such setting”.')).toBeVisible()
})

test('Help > About shows the version, the licence and the notices of the libraries, and closes with Escape', async () => {
  test.skip(!htmlMenu, 'macOS has the native menu')
  const page = await launch()
  await page.getByRole('menuitem', { name: 'Help' }).click()
  await page.getByRole('menuitem', { name: 'About WSNP Viewer' }).click()
  const dialog = page.getByRole('dialog', { name: 'About WSNP Viewer' })
  await expect(dialog).toBeVisible()
  const { version } = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { version: string }
  await expect(dialog).toContainText(`Version ${version}`)
  await expect(dialog).toContainText('MIT License')
  await expect(dialog).toContainText('Electron')
  await dialog.getByRole('button', { name: /Show the notices/ }).click()
  const notices = dialog.getByLabel('Third-party notices')
  await expect(notices).toContainText('# Third-party notices')
  await expect(notices).toContainText('pdfjs-dist')
  await expect(notices).toContainText('Apache License')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

