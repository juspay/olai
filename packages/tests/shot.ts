import { chromium } from "playwright"

import { BROWSER_ARGS } from "./support/browser.ts"

const url = process.argv[2]
if (url === undefined) {
  throw new Error("shot.ts takes the URL to photograph: bun shot.ts <url>")
}
const b = await chromium.launch({ args: [...BROWSER_ARGS] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(url)
await p.waitForSelector('[data-testid="outline-list"]')
// A new chat from the `+` on the sidebar's Chats heading: the palette opens
// at New chat, the default place is taken, and the first message creates it.
await p.locator('[data-testid="chat-new"]').click()
await p.locator('[data-testid="palette-item"][data-id="new-chat-default"]').click()
await p.locator('[data-testid="palette-input"]').fill("hold")
await p.locator('[data-testid="palette-input"]').press("Enter")
await p.locator('[data-testid="chat-input"]').waitFor()
await p.waitForTimeout(1200)
await p.screenshot({ path: "/tmp/merged.png" })
await b.close()
