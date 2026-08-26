/**
 * The terminal door's evidence shots — three states, photographed on a real
 * lanes outline served by a real olai against a real (fake) padi.
 *
 * Not part of the suite: a one-off driver for the PR's evidence, run by hand
 * against a server the caller started. `packages/tests/shot.ts` is the same
 * shape one screenshot over.
 */
import { chromium } from "playwright"

import { BROWSER_ARGS } from "./support/browser.ts"

const [, , url, out, mode] = process.argv
if (url === undefined || out === undefined) {
  throw new Error("door-shots.ts <url> <out.png> [pane]")
}

const browser = await chromium.launch({
  // `channel: "chromium"` for the reason the suite's `--headless=new` implies:
  // the pinned browser bundle carries the full chromium, not the headless
  // shell playwright reaches for by default.
  channel: "chromium",
  args: [...BROWSER_ARGS],
})
const page = await browser.newPage({ viewport: { width: 1180, height: 760 } })
await page.goto(url)
await page.waitForSelector('[data-testid="outline-list"]')
// Open the lanes outline the way a person does.
await page.locator('[data-testid="outline-link"]', { hasText: "lanes" }).first().click()
await page.waitForSelector('[data-testid="outline-tree"]')
// Let the fleet's first frame land — the dots fill in a beat after the rows.
await page.waitForTimeout(2500)

if (mode === "pane") {
  await page
    .locator('[data-node-id="door-implement"] [data-testid="terminal-dot"]')
    .first()
    .click()
  await page.waitForSelector('[data-testid="terminal-screen"][data-state="text"]')
  await page.waitForTimeout(400)
}

await page.screenshot({ path: out })
await browser.close()
