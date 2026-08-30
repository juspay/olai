import { chromium } from "playwright"

const browser = await chromium.launch()
const page = await browser.newPage()
page.on("console", (m) => console.log("console:", m.type(), m.text().slice(0, 200)))
await page.goto(`http://127.0.0.1:8833/house.olai#demo`)
await page.waitForTimeout(5000)
console.log("landing-said:", await page.locator('[data-testid="landing-said"]').count(), await page.locator('[data-testid="landing-said"]').textContent().catch(() => ""))
console.log("demo rows drawn:", await page.locator('[data-testid="node"][data-node-id="demo"]').count())
console.log("focused:", await page.locator('[data-focused="true"]').getAttribute("data-node-id").catch(() => "none"))
await browser.close()
