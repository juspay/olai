/**
 * The SKEW driver: hold one frame back, and photograph the window it opens.
 *
 * The fourth driver in this package, and the question it answers is not the
 * other three's. `evidence.ts` photographs a LOOK, `wire.ts` counts a COST,
 * `reads.ts` prints what a tool surface ANSWERS — each of them over a wire
 * behaving exactly as it does for everybody. What this one is about is a wire
 * behaving in one of the two ways it is ALLOWED to and normally does not: the
 * `manifest` cell and the `heads` collection are two members on two channels,
 * and the server declines to promise an order between them (`@olai/server`'s
 * `runtime.ts`, where a revision is published — "a reader tolerates the skew
 * either way"). A reader that tolerates only one of them is wrong in a window
 * nobody can photograph by waiting for it, because the order that exposes the
 * bug is the one the server happens not to produce.
 *
 * WHAT IS FORCED, and what is not. Nothing is fabricated and no frame is
 * rewritten. The server is a real `olai web` over a real directory that really
 * does not parse, so the manifest cell really does say `null`. The only
 * interference is a DELAY: the SECOND frame of `surface/manifest/get` — the
 * `{}` that says the set finally loaded — is held for {@link HOLD_MS} by a
 * Playwright `routeWebSocket`, and the heads of that same revision pass
 * through untouched. Every frame this driver touches is announced on stdout
 * with the clock beside it, so the transcript says what was held and what was
 * not.
 *
 * WHAT IT PHOTOGRAPHS, in order:
 *
 *   1. the boot over a set that never validated — the honest error report
 *   2. THE WINDOW: {@link WINDOW_MS} after the files are repaired on disk, with
 *      that revision's heads already here and the cell's `{}` still held. This
 *      is the shot. Before `manifest-fold-skew` it is the error report drawn
 *      over a directory the tab is holding — and the report is EMPTY, because
 *      the set parses now and the errors cell has been emptied.
 *   3. the same page once the held frame is let through, which is the control:
 *      both sides of that change agree here.
 *
 * `ROOT=` is the knob it exists for, exactly as `wire.ts` has one: this file
 * imports no olai package, so pointing the runner at a second worktree
 * photographs THAT branch's client through the same frames, and the two runs
 * are of the same window. Everything else — the vault, the repair, the hold —
 * is this driver's.
 *
 * NOT part of the suite: nothing imports it and `just e2e` never runs it. What
 * the behaviour itself is held by is two unit suites — `@olai/web`'s
 * `directory.browsertest.ts` orders the two arrivals deterministically, and
 * `@olai/server`'s `runtime.test.ts` pins the fact the browser's rule rests on
 * (a head only reaches the wire out of a published revision). This is the
 * picture, and a picture is all it is.
 */
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { chromium, type Page } from "playwright"

import { BROWSER_ARGS } from "./support/browser.ts"

const VAULT = process.env["VAULT"]
if (VAULT === undefined) throw new Error("skew.ts is run by skew.sh, which exports VAULT")
const OUT = process.env["SHOTS"] ?? "."
const LABEL = process.env["LABEL"] ?? "skew"

/** How long the manifest's "the set loaded" frame is held back. Long enough to
 *  photograph the window and to read a number off the transcript, short enough
 *  that a run is over in seconds. */
const HOLD_MS = Number(process.env["HOLD_MS"] ?? 8000)
/** How long after the repair the window is photographed. The heads reach the
 *  tab on the store's own settle delay, so this is well past that and well
 *  inside {@link HOLD_MS} — the shot has to be of the window and not of either
 *  edge of it. */
const WINDOW_MS = Number(process.env["WINDOW_MS"] ?? 3000)

/**
 * The two files, in the two states this driver writes them in.
 *
 * A MEANING error and not a syntax one, which is the whole reason the boot
 * state is what it is: a file that will not PARSE keeps its key and carries its
 * errors (`@olai/surface`'s `Head.broken`), so that set still validates and its
 * heads still travel. `shed.olai`'s rake hangs off a parent nothing declares,
 * which no file can own — so the set is refused, the store publishes no
 * snapshot, and the manifest says `null`. That is the state the window opens
 * out of.
 *
 * WRITTEN BY THE DRIVER rather than taken from `fixtures/`, on `reads.ts`'s
 * argument one section over: the exhibit is the TRANSITION between these two
 * states, and a corpus shared with the suite would drift away from it the
 * moment a scenario needed a row.
 */
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
/** The same directory with the one bad parent corrected — one write, and the
 *  set validates. */
const REPAIRED: ReadonlyArray<readonly [string, string]> = REFUSED.map((
  [file, text],
) => [file, text.replace(`"parent":"shhed"`, `"parent":"shed"`)] as const)

let wroteAt = 0
/** Seconds since the repair, so the transcript reads as a clock and the shot
 *  can be placed on it. */
const at = () => (wroteAt === 0 ? "  boot" : `T+${((Date.now() - wroteAt) / 1000).toFixed(1)}s`)

const drawn = async (page: Page, testid: string) =>
  (await page.locator(`[data-testid="${testid}"]`).count()) > 0

/** What the page is showing, said in the two words that matter here: the error
 *  report is the whole page when a set never loaded, and the file tree is the
 *  directory. Printed at every step so the transcript stands beside the shots
 *  rather than needing them. */
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

// THE SEED PASS, which runs before the server does and then leaves: the boot
// this photographs is a boot over a set that never validated, so the refused
// files have to be on disk when the store first probes. An empty directory is
// a VALID set — it would boot to a directory and there would be no `null` to
// skew against. Both states live here so the repair cannot drift from what was
// refused (skew.sh's own note).
if (process.argv.includes("--seed")) {
  for (const [file, text] of REFUSED) writeFileSync(join(VAULT, file), text)
  process.exit(0)
}

const BASE = process.env["BASE"]
if (BASE === undefined) throw new Error("skew.ts is run by skew.sh, which exports BASE")

const browser = await chromium.launch({ args: [...BROWSER_ARGS] })
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })

/** The one frame that is interfered with, and the accounting that proves it is
 *  the only one: which request the manifest's subscription is, how many of its
 *  frames have gone by, and when the second was taken out of the stream. */
let manifestRequest: number | null = null
let headsRequest: number | null = null
let manifestFrames = 0
let heldAt: number | null = null

await page.routeWebSocket("**/rpc/ws", (ws) => {
  const server = ws.connectToServer()
  // The tab's own questions, passed through whole. Read only for the two
  // request ids: a member's frames are answered under the id its subscription
  // was opened with, and that is the only handle on which frame is whose.
  ws.onMessage((message) => {
    for (const line of String(message).split("\n")) {
      if (line.trim() === "") continue
      try {
        const frame = JSON.parse(line)
        if (frame._tag !== "Request") continue
        if (frame.tag === "surface/manifest/get") manifestRequest = frame.id
        if (frame.tag === "surface/heads/deltas") headsRequest = frame.id
      } catch {
        // Not ours to read. The transport is ndjson and this driver is only
        // ever looking for two lines of it.
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

// A FIXED WAIT and not a selector, which is the one thing this driver may not
// take a shortcut on: waiting for the tree would be waiting for the very thing
// the two sides of `manifest-fold-skew` disagree about, so one side would be
// photographed at its window and the other after a timeout. The same duration
// for both is what makes the two runs comparable.
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
