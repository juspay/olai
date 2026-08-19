import { chromium } from "playwright"
const BASE = process.env["BASE"]!
const browser = await chromium.launch({ args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"] })
const page = await browser.newPage()
await page.goto(`${BASE}/o/Pins.olai`)
await page.waitForTimeout(1500)
await page.evaluate(() => {
  document.addEventListener("click", (e) => {
    const t = e.target as Element
    console.log("CLICK phase=capture prevented=" + e.defaultPrevented + " target=" + t.tagName + " closestA=" + (t.closest("a")?.getAttribute("href") ?? "none"))
  }, true)
  document.addEventListener("click", (e) => {
    console.log("CLICK phase=bubble prevented=" + e.defaultPrevented)
  })
})
page.on("console", (m) => console.log("PAGE:", m.text()))
await page.locator('[data-testid="address-name"]').first().click()
await page.waitForTimeout(800)
console.log("url:", page.url())
await browser.close()
