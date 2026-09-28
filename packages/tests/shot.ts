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
// A new chat from the `+` on the sidebar's Chats heading (there is no chat
// side panel): it starts at once with one agent and asks which with several,
// and the conversation folds open under its Inbox row.
await p.locator('[data-testid="chat-new"]').click()
const agents = p.locator('[data-testid="agent-engine-menu"]')
const input = p.locator('[data-testid="chat-input"]')
await agents.or(input).first().waitFor()
if (await agents.isVisible()) await agents.locator("[data-engine]").first().click()
await input.waitFor()
await p.waitForTimeout(1200)
await input.fill("hold")
await p.locator('[data-testid="chat-send"]').click()
await p.waitForTimeout(1200)
await p.screenshot({ path: "/tmp/merged.png" })
await b.close()
