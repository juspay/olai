/** Photograph the three chip geometries — see `./harness.tsx`.
 *  `bun packages/tests/geometry/shots.ts <builtdir> <outdir>`
 *
 *  Served over http rather than opened as a `file://`: the harness is an ES
 *  module, and a module script from a `file://` origin is a cross-origin
 *  request every browser refuses. */
import { chromium } from "playwright"
import { join, resolve } from "node:path"
import { mkdirSync } from "node:fs"

import { BROWSER_ARGS } from "../support/browser.ts"

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
// A realistic reading width and a 2× pixel ratio: the point of the shot is
// whether a pip and a two-line row are legible AT CHIP SCALE, and a 1× capture
// of 13px type is not what anybody's screen shows them.
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
