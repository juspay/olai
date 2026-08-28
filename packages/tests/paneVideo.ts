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
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

import { BROWSER_ARGS } from "./support/browser.ts"

const [, , url, node, outDir, secondsArg, resizeAfter, socket, terminal] = process.argv
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

// THE FOREIGN RESIZE, if the caller asked for one — a SECOND VIEWER attaching
// at its own size, which is what a kolu window on the same terminal does.
// Driven from outside this page on purpose: the recovery being shown is the
// mirror noticing the record's grid move, and a resize this page caused would
// be a different story with the same pictures.
if (resizeAfter !== undefined) {
  const [cols, rows] = resizeAfter.split("x")
  const held = spawn(
    "bun",
    [resolve(import.meta.dirname, "foreignResize.ts"), socket!, terminal!, cols!, rows!, "12"],
    { stdio: "inherit" },
  )
  // Long enough to see it land and settle: the pane goes wrong for the moment
  // it is rendering deltas for a grid it is not at, then the record moves, the
  // mirror re-attaches, and the fresh snapshot repaints it whole.
  await page.waitForTimeout(18_000)
  held.kill()
}

await context.close()
await browser.close()
console.log(dir)
