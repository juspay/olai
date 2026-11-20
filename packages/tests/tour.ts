import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium, type Page } from "playwright"

import { BROWSER_ARGS } from "./support/browser.ts"
import { EXCHANGES } from "./tour-agent.ts"

const FIXTURE_TODAY = Date.UTC(2026, 7, 12)
const DAY = 86_400_000
const MAX_PICTURE = 400 * 1024

const shiftDates = (dir: string): void => {
  const now = new Date()
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - FIXTURE_TODAY) / DAY)
  for (const name of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    const file = join(dir, name)
    if (!/\.(olai|md)$/.test(name) || !statSync(file).isFile()) continue
    const text = readFileSync(file, "utf8")
    const shifted = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y: string, m: string, d: string) =>
      new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)) + days * DAY).toISOString().slice(0, 10),
    )
    writeFileSync(file, shifted)
  }
}

const card = async (html: string, png: string): Promise<void> => {
  const browser = await chromium.launch({ args: [...BROWSER_ARGS] })
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 })
  await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" })
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.screenshot({ path: png })
  await browser.close()
}

const env = (name: string): string => {
  const value = process.env[name]
  if (value === undefined || value === "") throw new Error(`tour.ts needs ${name}`)
  return value
}

const shoot = async (page: Page, out: string, name: string): Promise<void> => {
  await page.mouse.move(4, 896)
  await page.waitForTimeout(500)
  const path = join(out, name)
  await page.screenshot({ path })
  const size = statSync(path).size
  if (size > MAX_PICTURE) throw new Error(`${name} is ${size} bytes, over the limit of ${MAX_PICTURE}`)
  console.log(`${name}: ${size} bytes`)
}

const noticeOutOfView = async (page: Page): Promise<void> => {
  const notice = page.getByText("This conversation is the node agent").first()
  const seen = await notice.evaluate((element) => {
    const own = element.getBoundingClientRect()
    for (let y = Math.max(own.top, 0); y < Math.min(own.bottom, window.innerHeight); y += 4) {
      const hit = document.elementFromPoint(own.left + 8, y)
      if (hit !== null && element.contains(hit)) return true
    }
    return false
  })
  if (seen) throw new Error("the instruction notice is inside the visible part of the chat: add an exchange")
}

const stills = async (): Promise<void> => {
  const base = env("BASE")
  const out = env("OUT")
  const browser = await chromium.launch({ args: [...BROWSER_ARGS] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await context.newPage()

  await page.goto(`${base}/agenda`)
  await page.getByText("Book the plumber").first().waitFor()
  await shoot(page, out, "agenda.png")

  await page.goto(`${base}/house.olai`)
  await page.locator('[data-testid="outline-list"]').waitFor()
  await page.keyboard.press("Control+k")
  await page.locator('[data-testid="palette-input"]').fill("capture")
  await page.getByText("Capture to the Inbox").first().waitFor()
  await shoot(page, out, "capture.png")
  await page.keyboard.press("Escape")

  await page.locator("header [data-health]").first().click()
  await page.getByRole("button", { name: "Plugins" }).click()
  const plugins = page.locator('[data-testid="plugins-panel"]')
  await plugins.getByText("Agents", { exact: true }).click()
  await plugins.getByText("Claude Code", { exact: true }).waitFor()
  await shoot(page, out, "plugins-panel.png")
  await page.keyboard.press("Escape")

  await page.getByRole("checkbox", { name: "Show finished" }).check()
  await page.goto(`${base}/s/house.olai/notes%2Fcabinets.md`)
  await page.getByRole("heading", { name: "Sizes" }).waitFor()
  await shoot(page, out, "outline-and-document.png")

  await page.goto(`${base}/notes/cabinets.md`)
  await page.getByText("Referenced by").first().click()
  await page.getByText("Order the new cabinets").last().waitFor()
  await shoot(page, out, "document.png")

  await page.goto(`${base}/house.olai`)
  await page.locator('[data-testid="outline-list"]').waitFor()
  await page.getByRole("checkbox", { name: "Show finished" }).check()
  await page.getByRole("button", { name: "Start an agent" }).first().click()
  await page.locator('[data-testid="chat-input"]').waitFor()
  await page.waitForTimeout(2500)
  await page.getByRole("button", { name: /Open beside/ }).first().click()
  await page.waitForTimeout(2500)
  for (const exchange of EXCHANGES) {
    const input = page.locator('[data-testid="chat-input"]').last()
    await input.click()
    await input.pressSequentially(exchange.said, { delay: 10 })
    await page.keyboard.press("Enter")
    await page.getByText(exchange.replyAs).first().waitFor({ timeout: 20_000 })
  }
  await noticeOutOfView(page)
  await shoot(page, out, "outline-and-chat.png")

  await page.locator("header [data-health]").first().click()
  await page.getByText(/uncommitted$/).first().click()
  await page.getByText("Book the plumber").last().waitFor()
  await shoot(page, out, "commit-panel.png")

  await browser.close()
}

const recording = async (): Promise<void> => {
  const base = env("BASE")
  const raw = env("RAW")
  const plumber = EXCHANGES.find((exchange) => exchange.line === "done plumber")
  if (plumber === undefined) throw new Error("tour-agent.ts has no exchange for the plumber")
  const viewport = { width: 1280, height: 800 }
  const browser = await chromium.launch({ args: [...BROWSER_ARGS] })
  const context = await browser.newContext({ viewport, recordVideo: { dir: raw, size: { width: 1024, height: 640 } } })
  const started = Date.now()
  const page = await context.newPage()

  await page.goto(`${base}/house.olai`)
  await page.locator('[data-testid="outline-list"]').waitFor()
  await page.mouse.move(1260, 780)
  await page.waitForTimeout(800)
  writeFileSync(join(raw, "lead"), String((Date.now() - started) / 1000))
  await page.waitForTimeout(1200)

  await page.getByRole("button", { name: "Collapse sidebar" }).click()
  await page.waitForTimeout(800)
  await page.getByRole("checkbox", { name: "Show finished" }).check()
  await page.waitForTimeout(1200)

  await page.getByText("Paint samples on the north wall", { exact: true }).click()
  await page.keyboard.press("End")
  await page.keyboard.press("Enter")
  await page.keyboard.type("Choose the wall paint", { delay: 70 })
  await page.mouse.click(900, 600)
  await page.waitForTimeout(1500)

  await page.getByText("¶").nth(1).click()
  await page.waitForTimeout(1000)
  await page.getByRole("link", { name: "cabinets", exact: true }).first().click()
  await page.getByText("Corner carousel").first().waitFor()
  await page.mouse.move(1260, 780)
  await page.waitForTimeout(3000)
  await page.goBack()
  await page.waitForTimeout(2000)

  await page.getByRole("button", { name: "Start an agent" }).first().click()
  await page.locator('[data-testid="chat-input"]').waitFor()
  await page.waitForTimeout(2500)
  await page.getByRole("button", { name: /Open beside/ }).first().click()
  await page.waitForTimeout(2500)
  const input = page.locator('[data-testid="chat-input"]').last()
  await input.click()
  await input.pressSequentially(plumber.said, { delay: 60 })
  await page.waitForTimeout(500)
  await page.keyboard.press("Enter")
  await page.getByText(plumber.replyAs).first().waitFor({ timeout: 20_000 })
  await page.mouse.move(1260, 780)
  await page.waitForTimeout(3000)

  await page.locator("header [data-health]").first().click()
  await page.getByText(/uncommitted$/).first().click()
  await page.getByText("Choose the wall paint").last().waitFor()
  await page.mouse.move(1260, 780)
  await page.waitForTimeout(4000)

  const video = page.video()
  await context.close()
  if (video === null) throw new Error("Playwright recorded no video")
  await video.saveAs(join(raw, "take.webm"))
  await browser.close()
}

const [mode, ...rest] = process.argv.slice(2)
if (mode === "shift" && rest[0] !== undefined) shiftDates(rest[0])
else if (mode === "card" && rest[0] !== undefined && rest[1] !== undefined) await card(rest[0], rest[1])
else if (mode === "stills") await stills()
else if (mode === "recording") await recording()
else throw new Error("usage: bun tour.ts shift <dir> | card <html> <png> | stills | recording")
