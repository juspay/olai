import { chromium } from "playwright"
const url = process.argv[2]
const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu", "--headless=new"] })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(url)
await p.waitForSelector('[data-testid="outline-list"]')
await p.locator('[data-testid="chat-toggle"]').click()
await p.waitForSelector('[data-testid="chat-input"]')
await p.waitForTimeout(1200)
await p.locator('[data-testid="chat-input"]').fill("hold")
await p.locator('[data-testid="chat-send"]').click()
await p.waitForTimeout(1200)
await p.screenshot({ path: "/tmp/merged.png" })
await b.close()
