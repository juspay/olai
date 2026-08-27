/**
 * THE LIVE PANE, RECORDED — #405's video evidence.
 *
 * Stills cannot show what this pane is FOR. A photograph of a terminal and a
 * photograph of a live terminal are the same picture; what separates them is
 * that one of them moves. So the evidence for a streaming pane is a recording:
 * the row pressed, the snapshot painting, and then a real agent's deltas
 * arriving on their own.
 *
 * A ONE-OFF DRIVER against a server the caller started, in `./doorShots.ts`'s
 * shape — and pointed at a REAL padi rather than the suite's fake, because the
 * thing being shown is exactly what a fixture cannot produce: cursor-heavy
 * output from an agent that is working.
 *
 * `bun paneVideo.ts <url> <node-id> <out-dir> [seconds]`
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

import { BROWSER_ARGS } from "./support/browser.ts"

const [, , url, node, outDir, secondsArg] = process.argv
if (url === undefined || node === undefined || outDir === undefined) {
  throw new Error("paneVideo.ts <url> <node-id> <out-dir> [seconds]")
}
const seconds = Number(secondsArg ?? "40")
const dir = resolve(outDir)
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch({ channel: "chromium", args: [...BROWSER_ARGS] })
// A READING WINDOW, not a desktop: the pane is a box inside an outline, and a
// recording at a size nobody reads at would be evidence about a layout that
// does not exist.
const size = { width: 1280, height: 860 }
const context = await browser.newContext({
  viewport: size,
  deviceScaleFactor: 1,
  recordVideo: { dir, size },
})
const page = await context.newPage()
page.on("pageerror", (e) => console.error("PAGEERROR", e.message))

await page.goto(url)
await page.waitForSelector('[data-testid="outline-list"]')
await page.locator('[data-testid="outline-link"]', { hasText: "lanes" }).first().click()
await page.waitForSelector('[data-testid="outline-tree"]')
// Let the fleet land, and hold a beat on the ROW before opening anything — the
// row is half of what this PR is, and a video that opened the pane instantly
// would skip it.
await page.waitForTimeout(4000)

await page
  .locator(`[data-node-id="${node}"] [data-testid="terminal-block"] [data-dock-row]`)
  .first()
  .click()
await page.waitForSelector('[data-testid="terminal-screen"][data-state="attached"]')
// ...and now just watch. Nothing is driven from here: every frame after this is
// the agent's own output arriving over padi.
await page.waitForTimeout(seconds * 1_000)

await context.close()
await browser.close()
console.log(dir)
