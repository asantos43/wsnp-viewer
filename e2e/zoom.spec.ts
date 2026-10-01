import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Frame, type Page } from '@playwright/test'
import { writeSampleWsnp, writeViewerWsnp } from '../fixtures/build.ts'

// End-to-end: each tab has its own zoom (the page of a snapshot, a text), by the keys and by Control and the wheel, also over the page; nothing zooms the whole interface.
const noSandbox = process.env.CI && process.platform === 'linux' ? ['--no-sandbox'] : []
let dir: string
let app: ElectronApplication | undefined

test.beforeEach(() => void (dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsnp-e2e-zoom-'))))
test.afterEach(async () => {
  await app?.close().catch(() => {})
  app = undefined
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

async function launch(...extra: string[]): Promise<Page> {
  const file = path.join(dir, 'viewer.wsnp')
  if (!fs.existsSync(file)) await writeViewerWsnp(file, { title: 'Harbor Times', url: 'https://harbortimes.example/' })
  app = await electron.launch({ args: ['.', `--user-data-dir=${path.join(dir, 'profile')}`, ...noSandbox, file, ...extra] })
  const page = await app.firstWindow()
  await page.getByRole('tab').first().waitFor()
  await page.frameLocator('iframe').first().locator('#end').waitFor({ state: 'attached' })
  return page
}
const pageFrame = (page: Page): Frame => page.frames().find((f) => f.url().startsWith('wsnp://'))!
const status = (page: Page) => page.getByRole('contentinfo')
// (Playwright's box of an element in a frame leaves out the scale of the frame itself: the width the page is laid out at says the zoom.)
const layoutWidth = (page: Page) => pageFrame(page).evaluate(() => window.innerWidth)
/** A turn of the wheel with Control held, as a person's: through the DevTools protocol, which reaches a page in its own process. */
async function wheel(page: Page, x: number, y: number, deltaY: number) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY, modifiers: 2 })
  await cdp.detach()
}
const middleOf = async (page: Page, selector = 'iframe') => {
  const box = (await page.locator(selector).first().boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test.describe('the page of a snapshot', () => {
  test('Ctrl+= and Ctrl+- zoom the page as a browser does: its layout is redone at 1/zoom of the width, and the status bar says so; Ctrl+0 goes back', async () => {
    const page = await launch()
    const room = await page.locator('iframe').evaluate((el) => (el.parentElement as HTMLElement).clientWidth)
    expect(await layoutWidth(page)).toBe(room)
    await expect(status(page)).not.toContainText('%')
    for (let i = 0; i < 5; i++) await page.keyboard.press('ControlOrMeta+=')
    await expect(status(page)).toContainText('200%')
    await expect.poll(() => layoutWidth(page)).toBe(Math.round(room / 2))
    // The frame fills the same room: scaled up, not bigger.
    const box = (await page.locator('iframe').boundingBox())!
    const roomBox = (await page.locator('iframe').evaluate((el) => (el.parentElement as HTMLElement).getBoundingClientRect().width))
    expect(box.width).toBeCloseTo(roomBox, 0)
    await page.keyboard.press('ControlOrMeta+-')
    await expect(status(page)).toContainText('175%')
    await page.keyboard.press('ControlOrMeta+0')
    await expect(status(page)).not.toContainText('%')
    await expect.poll(() => layoutWidth(page)).toBe(room)
  })

  test('the keys work with the focus inside the page too (the main process reads them first)', async () => {
    const page = await launch()
    await page.frameLocator('iframe').first().locator('#end').click()
    await page.keyboard.press('ControlOrMeta+=')
    await expect(status(page)).toContainText('110%')
  })

  test('Control and the wheel zoom the page, over the page itself: up goes in, down goes out', async () => {
    const page = await launch()
    const at = await middleOf(page)
    await wheel(page, at.x, at.y, -120)
    await expect(status(page)).toContainText('110%')
    await wheel(page, at.x, at.y, -120)
    await expect(status(page)).toContainText('125%')
    await wheel(page, at.x, at.y, 120)
    await expect(status(page)).toContainText('110%')
  })

  test('is the tab’s own, and the status bar item takes it back to 100 %', async () => {
    const second = path.join(dir, 'second.wsnp')
    await writeSampleWsnp(second, { title: 'Second page', url: 'https://second.example/' })
    const page = await launch(second)
    await expect(page.getByRole('tab')).toHaveCount(2)
    await page.keyboard.press('ControlOrMeta+=')
    await page.keyboard.press('ControlOrMeta+=')
    await expect(status(page)).toContainText('125%')
    await page.getByRole('tab', { name: /Harbor Times/ }).click()
    await expect(status(page)).not.toContainText('%')
    await page.getByRole('tab', { name: /Second page/ }).click()
    await expect(status(page)).toContainText('125%')
    await page.getByRole('button', { name: /125%/ }).click()
    await expect(status(page)).not.toContainText('%')
  })

  test('nothing else is zoomed: the interface stays as it was, and a text file has its own zoom', async () => {
    const page = await launch()
    const ratio = () => page.evaluate(() => window.devicePixelRatio)
    const start = await ratio()
    await page.keyboard.press('ControlOrMeta+=')
    expect(await ratio()).toBeCloseTo(start, 2)
    const tabHeight = (await page.getByRole('tab').first().boundingBox())!.height
    await page.keyboard.press('ControlOrMeta+=')
    expect((await page.getByRole('tab').first().boundingBox())!.height).toBeCloseTo(tabHeight, 0)
  })
})

test.describe('a text, a picture and an SVG', () => {
  const open = async (page: Page, folder: string[], name: string) => {
    for (const f of folder) {
      const item = page.getByRole('treeitem', { name: f, exact: true })
      if ((await item.getAttribute('aria-expanded')) === 'false') await item.click()
    }
    await page.getByRole('treeitem', { name, exact: true }).dblclick()
  }

  test('a source file is zoomed on its own: the keys and the wheel change the size of its text, and the page of the snapshot is not touched', async () => {
    const page = await launch()
    await open(page, ['assets', 'files'], 'long.txt')
    await expect(page.locator('.cm-content')).toContainText('THE END')
    const size = () => page.locator('.cm-line').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    const start = await size()
    await page.keyboard.press('ControlOrMeta+=')
    await page.keyboard.press('ControlOrMeta+=')
    await expect(status(page)).toContainText('125%')
    expect(await size()).toBeCloseTo(start * 1.25, 1)
    const at = await middleOf(page, '.cm-editor')
    await wheel(page, at.x, at.y, 120)
    await expect(status(page)).toContainText('110%')
    expect(await size()).toBeCloseTo(start * 1.1, 1)
    await page.keyboard.press('ControlOrMeta+0')
    expect(await size()).toBeCloseTo(start, 1)
    await page.getByRole('tab', { name: /Harbor Times/ }).click()
    await expect(status(page)).not.toContainText('%')
  })

  test('a picture keeps its own zoom: the keys step it, Ctrl+0 fits it again, and the status bar has no zoom for it', async () => {
    const page = await launch()
    await open(page, ['assets', 'images'], 'tiny.png')
    await expect(page.getByRole('img', { name: 'tiny.png' })).toBeVisible()
    const zoom = page.getByRole('toolbar').getByLabel('Zoom', { exact: true })
    const level = () => page.getByRole('toolbar').locator('[aria-live=polite]').textContent()
    const fitted = await level()
    await page.keyboard.press('ControlOrMeta+=')
    await expect.poll(level).not.toBe(fitted)
    await page.keyboard.press('ControlOrMeta+0')
    await expect.poll(level).toBe(fitted)
    await expect(zoom).toBeVisible()
    await expect(status(page)).not.toContainText('%')
  })

  test('an SVG is a picture at first, with a switch to its source in the toolbar, and the choice is kept', async () => {
    let page = await launch()
    await open(page, ['assets', 'images'], 'mark.svg')
    await expect(page.getByRole('img', { name: 'mark.svg' })).toBeVisible()
    await expect(page.locator('.cm-content')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Show the SVG as a picture' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Show the SVG as source code' }).click()
    await expect(page.locator('.cm-content')).toContainText('<circle cx="20"')
    await expect(page.getByRole('img', { name: 'mark.svg' })).toHaveCount(0)
    // Find is for the source only.
    await page.keyboard.press('ControlOrMeta+f')
    await page.getByRole('textbox', { name: 'Find' }).fill('circle')
    await expect(page.getByRole('search').getByText(/^1 of \d+$/)).toBeVisible()
    await page.keyboard.press('Escape')
    // Kept for the next SVG, and for the next start.
    await app!.close()
    page = await launch()
    await open(page, ['assets', 'images'], 'mark.svg')
    await expect(page.locator('.cm-content')).toContainText('<circle cx="20"')
    await page.getByRole('button', { name: 'Show the SVG as a picture' }).click()
    await expect(page.getByRole('img', { name: 'mark.svg' })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+f')
    await expect(page.getByRole('search')).toHaveCount(0)
  })
})
