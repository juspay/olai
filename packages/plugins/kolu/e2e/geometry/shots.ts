import { chromium } from "playwright"
import { join, resolve } from "node:path"
import { mkdirSync } from "node:fs"

import { BROWSER_ARGS } from "@olai/tests/harness/browser.ts"

const built = resolve(process.argv[2] ?? "/tmp/geo")
const out = resolve(process.argv[3] ?? "/tmp/geo/shots")
mkdirSync(out, { recursive: true })

const server = Bun.serve({
  port: 0,
  fetch: (request) => {
    const path = new URL(request.url).pathname
    return new Response(Bun.file(join(built, path === "/" ? "index.html" : path)))
  },
})

const browser = await chromium.launch({ channel: "chromium", args: [...BROWSER_ARGS] })
const page = await browser.newPage({
  viewport: { width: 900, height: 560 },
  deviceScaleFactor: 2,
})
page.on("pageerror", (e) => console.error("harness threw:", e.message))
page.on("console", (m) => {
  if (m.type() === "error") console.error("console:", m.text())
})
for (const v of ["A", "B", "C"]) {
  await page.goto(`http://localhost:${server.port}/index.html?v=${v}`)
  await page.waitForSelector("[data-dock-row]")
  await page.waitForTimeout(300)
  await page.locator("#root > div").screenshot({ path: resolve(out, `geometry-${v}.png`) })
  console.log(`geometry-${v}.png`)
}
await browser.close()
await server.stop(true)
