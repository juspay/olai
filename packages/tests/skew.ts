import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium, type Page } from "playwright"

import { BROWSER_ARGS } from "./support/browser.ts"

const VAULT = process.env["VAULT"]
if (VAULT === undefined) throw new Error("skew.ts is run by skew.sh, which exports VAULT")
const OUT = process.env["SHOTS"] ?? "."
const LABEL = process.env["LABEL"] ?? "skew"

const HOLD_MS = Number(process.env["HOLD_MS"] ?? 8000)
const WINDOW_MS = Number(process.env["WINDOW_MS"] ?? 3000)

const REFUSED: ReadonlyArray<readonly [string, string]> = [
  [
    "pantry.olai",
    `{"id":"pantry","ord":"a0","title":"restock the pantry"}
{"id":"flour","parent":"pantry","ord":"a0","title":"buy flour"}
{"id":"rice","parent":"pantry","ord":"a1","title":"buy rice"}
{"id":"beans","parent":"pantry","ord":"a2","title":"buy beans"}
`,
  ],
  [
    "shed.olai",
    `{"id":"shed","ord":"a0","title":"clear out the shed"}
{"id":"rake","parent":"shhed","ord":"a0","title":"hang up the rake"}
`,
  ],
]
const REPAIRED: ReadonlyArray<readonly [string, string]> = REFUSED.map((
  [file, text],
) => [file, text.replace(`"parent":"shhed"`, `"parent":"shed"`)] as const)

let wroteAt = 0
const at = () => (wroteAt === 0 ? "  boot" : `T+${((Date.now() - wroteAt) / 1000).toFixed(1)}s`)

const drawn = async (page: Page, testid: string) =>
  (await page.locator(`[data-testid="${testid}"]`).count()) > 0

const showing = async (page: Page, when: string) => {
  const report = await drawn(page, "error-view")
  const tree = await drawn(page, "outline-list")
  console.log(
    `${at()}  ${when.padEnd(26)} error report: ${report ? "SHOWN" : "no   "}   file tree: ${
      tree ? "SHOWN" : "no   "
    }`,
  )
  return { report, tree }
}

let shots = 0
const shot = async (page: Page, name: string) => {
  shots += 1
  await page.screenshot({ path: `${OUT}/${LABEL}-${shots}-${name}.png` })
}

if (process.argv.includes("--seed")) {
  for (const [file, text] of REFUSED) writeFileSync(join(VAULT, file), text)
  process.exit(0)
}

const BASE = process.env["BASE"]
if (BASE === undefined) throw new Error("skew.ts is run by skew.sh, which exports BASE")

const browser = await chromium.launch({ args: [...BROWSER_ARGS] })
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })

let manifestRequest: number | null = null
let headsRequest: number | null = null
let manifestFrames = 0
let heldAt: number | null = null

await page.routeWebSocket(url => url.pathname === "/rpc/ws", (ws) => {
  const server = ws.connectToServer()
  ws.onMessage((message) => {
    for (const line of String(message).split("\n")) {
      if (line.trim() === "") continue
      try {
        const frame = JSON.parse(line)
        if (frame._tag !== "Request") continue
        if (frame.tag === "surface/vault/manifest/get") manifestRequest = frame.id
        if (frame.tag === "surface/vault/heads/deltas") headsRequest = frame.id
      } catch {
      }
    }
    server.send(message)
  })
  server.onMessage((message) => {
    const text = String(message)
    const lines = text.split("\n").filter((line) => line.trim() !== "")
    let frame: { _tag?: string; requestId?: number; values?: ReadonlyArray<unknown> } | null = null
    try {
      frame = lines.length === 1 ? JSON.parse(lines[0]!) : null
    } catch {
      frame = null
    }
    if (frame?._tag === "Chunk" && frame.requestId === headsRequest) {
      for (const value of frame.values ?? []) {
        const said = value as { kind: string; entries?: ReadonlyArray<unknown>; upserts?: ReadonlyArray<unknown> }
        const files = (said.kind === "snapshot" ? said.entries : said.upserts)?.length ?? 0
        console.log(`${at()}  heads ${said.kind}: ${files} file(s) — PASSED THROUGH`)
      }
    }
    if (frame?._tag === "Chunk" && frame.requestId === manifestRequest) {
      manifestFrames += 1
      if (manifestFrames === 2) {
        heldAt = Date.now()
        console.log(`${at()}  manifest frame #2 ${text.trim()} — HELD for ${HOLD_MS}ms`)
        setTimeout(() => {
          console.log(`${at()}  manifest frame #2 — let through`)
          ws.send(message)
        }, HOLD_MS)
        return
      }
      console.log(`${at()}  manifest frame #${manifestFrames} ${text.trim()} — PASSED THROUGH`)
    }
    ws.send(message)
  })
})

await page.goto(BASE)
await page.waitForSelector('[data-testid="error-view"]', { timeout: 30_000 })
await showing(page, "1 · booted, set refused")
await shot(page, "boot-over-a-refused-set")

wroteAt = Date.now()
for (const [file, text] of REPAIRED) writeFileSync(join(VAULT, file), text)
console.log(`${at()}  both files repaired on disk`)

await page.waitForTimeout(WINDOW_MS)
const window = await showing(page, "2 · IN THE SKEW WINDOW")
await shot(page, "in-the-skew-window")

if (heldAt === null) {
  throw new Error(
    "the manifest never sent a second frame, so nothing was ever skewed — the " +
      "repair did not reach the store, or this server had already loaded",
  )
}

await page.waitForTimeout(HOLD_MS - (Date.now() - heldAt) + 1500)
await showing(page, "3 · the frame let through")
await shot(page, "frame-let-through")

console.log(
  `\n${LABEL}: in the window — ${WINDOW_MS}ms after the repair, the manifest's` +
    ` frame still held, the heads already here:\n` +
    `  the error report is ${window.report ? "DRAWN" : "not drawn"}` +
    `, the file tree is ${window.tree ? "DRAWN" : "not drawn"}\n` +
    `  ${shots} shots in ${OUT}`,
)
await browser.close()
