import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { INNER_ZIP, PNG_1X1, richFiles, writeWsnp } from '../fixtures/build.ts'
import { renameInZip, zipBuffer } from '../fixtures/zip.ts'

// End-to-end: a ZIP inside a snapshot is listed in a tab; entries are selected, extracted, or viewed in tabs of their own.
const noSandbox = process.env.CI && process.platform === 'linux' ? ['--no-sandbox'] : []
let dir: string
let app: ElectronApplication | undefined

test.beforeEach(() => void (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsnp-e2e-zip-'))))
test.afterEach(async () => {
  await app?.close().catch(() => {})
  app = undefined
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

async function launch(file: string): Promise<Page> {
  app = await electron.launch({ args: ['.', `--user-data-dir=${path.join(dir, 'profile')}`, ...noSandbox, file] })
  const page = await app.firstWindow()
  await page.getByRole('tab').first().waitFor()
  return page
}
async function harbor(extra: { path: string; type: string; data: Buffer }[] = []) {
  const file = path.join(dir, 'harbor.wsnp')
  await writeWsnp(file, [...richFiles(), ...extra], { title: 'Harbor Times', url: 'https://harbortimes.example/' })
  return file
}
async function openZip(page: Page, name = 'bundle.zip') {
  await page.getByRole('treeitem', { name: 'assets', exact: true }).click()
  await page.getByRole('treeitem', { name: 'files', exact: true }).click()
  await page.getByRole('treeitem', { name, exact: true }).dblclick()
  await page.getByRole('table', { name: /Files in the ZIP/ }).waitFor()
}
/** The dialogs cannot be driven: the main process answers for them. */
async function answer(options: { save?: string; folder?: string }) {
  await app!.evaluate(({ dialog }, o) => {
    dialog.showSaveDialog = (async () => (o.save ? { canceled: false, filePath: o.save } : { canceled: true })) as unknown as typeof dialog.showSaveDialog
    dialog.showOpenDialog = (async () => (o.folder ? { canceled: false, filePaths: [o.folder] } : { canceled: true, filePaths: [] })) as unknown as typeof dialog.showOpenDialog
  }, options)
}
const row = (page: Page, name: string) => page.getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) })
const selectedText = (page: Page, n: number) => page.getByText(new RegExp(`^${n} selected ·`))
const names = (page: Page) => page.getByRole('row').evaluateAll((rows) => rows.slice(1).map((r) => r.querySelectorAll('[role=cell]')[1]?.textContent ?? ''))

test('a ZIP in a snapshot opens as a list of its files, with sizes, and a summary', async () => {
  const page = await launch(await harbor())
  await openZip(page)
  expect(await names(page)).toEqual(['docs/', 'docs/readme.txt', 'docs/data.json', 'img/', 'img/dot.png', 'top.txt', 'nested.zip'])
  await expect(row(page, 'docs/readme.txt').getByRole('cell').nth(2)).toHaveText('40 B')
  await expect(page.getByRole('navigation', { name: 'Breadcrumbs' })).toHaveText('Harbor Timesassetsfilesbundle.zip')
  await expect(page.getByText(/7 items/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save As…' })).toBeVisible()
})

test('selected entries are extracted to a folder, folders of the ZIP kept, and the status says where', async () => {
  const page = await launch(await harbor())
  await openZip(page)
  const out = path.join(dir, 'out')
  fs.mkdirSync(out)
  await answer({ folder: out })
  await row(page, 'docs/readme.txt').click()
  await row(page, 'img/dot.png').click({ modifiers: ['ControlOrMeta'] })
  await expect(page.getByRole('button', { name: 'Extract Selected…' })).toContainText('Extract 2 Selected…')
  await page.getByRole('button', { name: 'Extract Selected…' }).click()
  await expect(page.getByRole('status')).toContainText(`Extracted 2 files to ${out}.`)
  expect(fs.readFileSync(path.join(out, 'docs/readme.txt'), 'utf8')).toBe('Harbor notes: the ferry leaves at noon.\n')
  expect(fs.readFileSync(path.join(out, 'img/dot.png')).equals(PNG_1X1)).toBe(true)
  expect(fs.existsSync(path.join(out, 'top.txt'))).toBe(false)
})

test('the boxes select, Extract All writes everything, and a file that is there is never overwritten', async () => {
  const page = await launch(await harbor())
  await openZip(page)
  const out = path.join(dir, 'all')
  fs.mkdirSync(out)
  fs.writeFileSync(path.join(out, 'top.txt'), 'mine')
  await answer({ folder: out })
  await page.getByRole('checkbox', { name: 'Select all' }).check()
  await expect(selectedText(page, 7)).toBeVisible()
  await page.getByRole('checkbox', { name: 'Select all' }).uncheck()
  await expect(page.getByText(/^\d+ selected ·/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Extract All…' }).click()
  await expect(page.getByRole('status')).toContainText('Extracted 5 files')
  expect(fs.readFileSync(path.join(out, 'top.txt'), 'utf8')).toBe('mine')
  expect(fs.readFileSync(path.join(out, 'top (2).txt'), 'utf8')).toBe('top level file\n')
  expect(fs.readFileSync(path.join(out, 'docs/data.json'), 'utf8')).toBe('{"boats":3,"open":true}')
  expect(fs.readFileSync(path.join(out, 'nested.zip')).equals(INNER_ZIP)).toBe(true)
})

test('the context menu extracts one file under the name the user picks, or views it', async () => {
  const page = await launch(await harbor())
  await openZip(page)
  const target = path.join(dir, 'picked-name.txt')
  await answer({ save: target })
  await row(page, 'top.txt').click({ button: 'right' })
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['View', 'Extract…'])
  await page.getByRole('menuitem', { name: 'Extract…' }).click()
  await expect(page.getByRole('status')).toContainText('Saved picked-name.txt.')
  expect(fs.readFileSync(target, 'utf8')).toBe('top level file\n')
  // A folder can only be extracted.
  await row(page, 'docs/').click({ button: 'right' })
  await expect(page.getByRole('menu').getByRole('menuitem', { name: 'View' })).toBeDisabled()
  await page.keyboard.press('Escape')
  // A cancelled dialog writes nothing and says nothing.
  await answer({})
  await row(page, 'top.txt').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Extract…' }).click()
  await page.waitForTimeout(300)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a double click views an entry in a tab of its own: text as source, a picture as a picture, a ZIP as a list again', async () => {
  const page = await launch(await harbor())
  await openZip(page)
  await row(page, 'docs/data.json').dblclick()
  await expect(page.getByRole('tab', { selected: true })).toContainText('data.json')
  await expect(page.locator('.cm-content')).toContainText('"boats": 3')
  await expect(page.getByRole('navigation', { name: 'Breadcrumbs' })).toHaveText('Harbor Timesassetsfilesbundle.zipdocsdata.json')
  await page.getByRole('tab', { name: /bundle.zip/ }).click()
  await row(page, 'img/dot.png').dblclick()
  await expect(page.getByRole('img', { name: 'dot.png' })).toBeVisible()
  await page.getByRole('tab', { name: /bundle.zip/ }).click()
  await row(page, 'nested.zip').dblclick()
  await expect(page.getByRole('table', { name: /nested.zip/ })).toBeVisible()
  expect(await names(page)).toEqual(['deep.txt'])
  await row(page, 'deep.txt').dblclick()
  await expect(page.locator('.cm-content')).toContainText('a file in a ZIP in a ZIP')
  await expect(page.getByRole('navigation', { name: 'Breadcrumbs' })).toHaveText('Harbor Timesassetsfilesbundle.zipnested.zipdeep.txt')
})

test('an entry opened from a ZIP can be saved from its own tab', async () => {
  const page = await launch(await harbor())
  await openZip(page)
  await row(page, 'docs/readme.txt').dblclick()
  await expect(page.locator('.cm-content')).toContainText('the ferry leaves at noon')
  const target = path.join(dir, 'saved-readme.txt')
  await answer({ save: target })
  await page.getByRole('toolbar').getByRole('button', { name: 'Save As…' }).click()
  await expect(page.getByRole('status')).toContainText('Saved saved-readme.txt.')
  expect(fs.readFileSync(target, 'utf8')).toBe('Harbor notes: the ferry leaves at noon.\n')
})

test('the keyboard walks the list: arrows select, Space ticks, Enter views', async () => {
  const page = await launch(await harbor())
  await openZip(page)
  await page.getByRole('table').locator('[aria-multiselectable]').focus()
  await page.keyboard.press('ArrowDown')
  await expect(row(page, 'docs/readme.txt')).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Control+ArrowDown')
  await page.keyboard.press(' ')
  await expect(selectedText(page, 2)).toBeVisible()
  await page.keyboard.press('Control+a')
  await expect(selectedText(page, 7)).toBeVisible()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('tab', { selected: true })).toContainText(/nested|data|readme|top|dot/)
})

test('a ZIP that cannot be read says so, and can still be saved; an empty one says it is empty', async () => {
  const empty = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)])
  const page = await launch(await harbor([{ path: 'assets/files/empty.zip', type: 'application/zip', data: empty }, { path: 'assets/files/broken.zip', type: 'application/zip', data: Buffer.from('PK\u0003\u0004 not really a zip at all') }]))
  await page.getByRole('treeitem', { name: 'assets', exact: true }).click()
  await page.getByRole('treeitem', { name: 'files', exact: true }).click()
  await page.getByRole('treeitem', { name: 'empty.zip', exact: true }).dblclick()
  await expect(page.getByText('This ZIP file is empty.')).toBeVisible()
  await page.getByRole('treeitem', { name: 'broken.zip', exact: true }).dblclick()
  await expect(page.getByRole('alert')).toHaveText('This file is not a valid ZIP file.')
  await expect(page.getByRole('button', { name: 'Save As…' })).toBeVisible()
})

test('a hostile ZIP: names that leave the folder and links are listed as unsafe and never written', async () => {
  const hostile = renameInZip(await zipBuffer([{ name: 'xx/evil.txt', data: 'x' }, { name: 'link', data: '/etc/passwd', symlink: true }, { name: 'fine.txt', data: 'fine' }]), 'xx/evil.txt', '../evil.txt')
  const page = await launch(await harbor([{ path: 'assets/files/hostile.zip', type: 'application/zip', data: hostile }]))
  await openZip(page, 'hostile.zip')
  await expect(row(page, '../evil.txt')).toHaveAttribute('title', 'Its name is not safe to write to disk.')
  await expect(row(page, 'link')).toHaveAttribute('title', 'A link to another file: it is not followed.')
  const out = path.join(dir, 'inside')
  fs.mkdirSync(out)
  await answer({ folder: out })
  await page.getByRole('button', { name: 'Extract All…' }).click()
  await expect(page.getByRole('status')).toContainText('Extracted 1 files')
  await expect(page.getByRole('status')).toContainText('2 could not be extracted')
  expect(fs.readdirSync(out)).toEqual(['fine.txt'])
  expect(fs.existsSync(path.join(dir, 'evil.txt'))).toBe(false)
})
