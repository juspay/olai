import { chromium } from "playwright"
import { BROWSER_ARGS } from "./support/browser.ts"

const [, , url, out] = process.argv
const browser = await chromium.launch({ channel: "chromium", args: [...BROWSER_ARGS] })
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })
page.on("pageerror", (e) => console.error("PAGEERROR", e.message))
await page.goto(url!)
await page.waitForSelector('[data-testid="outline-list"]')
await page.locator('[data-testid="outline-link"]', { hasText: "lanes" }).first().click()
await page.waitForSelector('[data-testid="outline-tree"]')
await page.waitForTimeout(3000)
await page.locator('[data-node-id="real-busy"] [data-testid="terminal-block"] [data-dock-row]').first().click()
await page.waitForSelector('[data-testid="terminal-screen"][data-state="attached"]')
// Let a busy agent stream deltas into it.
await page.waitForTimeout(6000)
const facts = await page.evaluate(() => {
  const host = document.querySelector('[data-testid="terminal-screen"]') as HTMLElement | null
  const xterm = host?.querySelector(".xterm") as HTMLElement | null
  const screen = host?.querySelector(".xterm-screen") as HTMLElement | null
  const rows = host?.querySelector(".xterm-rows") as HTMLElement | null
  return {
    host: host && { w: host.clientWidth, h: host.clientHeight, style: host.getAttribute("style") },
    xterm: xterm && { w: xterm.offsetWidth, h: xterm.offsetHeight },
    screen: screen && { w: screen.offsetWidth, h: screen.offsetHeight, style: screen.getAttribute("style") },
    renderedRows: rows?.children.length ?? null,
    bg: {
      host: host && getComputedStyle(host).backgroundColor,
      xterm: xterm && getComputedStyle(xterm).backgroundColor,
      viewport: host?.querySelector(".xterm-viewport")
        ? getComputedStyle(host.querySelector(".xterm-viewport") as Element).backgroundColor
        : null,
      screenBg: screen && getComputedStyle(screen).backgroundColor,
      pad: xterm && getComputedStyle(xterm).padding,
    },
    firstRowText: (rows?.children[0] as HTMLElement | undefined)?.textContent?.slice(0, 60) ?? null,
  }
})
console.log(JSON.stringify(facts, null, 2))
await page.locator('[data-testid="terminal-pane"]').first().screenshot({ path: out! })
await browser.close()
