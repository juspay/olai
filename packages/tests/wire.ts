/**
 * What a reading session costs the wire, measured rather than argued.
 *
 * Not part of the suite and not a gate — the promises live in the features.
 * This is the instrument that produced the numbers in two PR bodies, and it is
 * kept so the next person can re-run them rather than believe them.
 *
 * WHAT IT MEASURES is the two ways bytes reach a reader — every byte the
 * WEBSOCKET delivered to the tab, and every byte fetched over HTTP off
 * `/media/` — and what the tab ASKED FOR to get them, counted per procedure.
 * THREE SESSIONS ask different questions of that one instrument, and `SESSION`
 * picks which:
 *
 *   - `preview` — an edit-while-previewing session. The defect it was built for
 *     was that a previewed `.html` paid both legs: the collection streamed the
 *     whole body to a page that draws none of it, and the frame then fetched
 *     the same file for itself. So the interesting number is the first one, and
 *     the second is what it is supposed to be beside
 *     (`preview-body-not-shipped`).
 *   - `pages` — an ORDINARY READING session over a realistic vault: open the
 *     app, then walk the routes. Before `docs/brainstorming/vault-in-browser.md`'s
 *     PR 10 the first frame carried every record of every outline and no
 *     navigation cost a byte; after it, the first frame carries the file list
 *     and each page asks for itself. That is the trade the design demands land
 *     as a number rather than a feeling, so this session is measured on both
 *     sides of it — and it is the SAME driver, which is what makes the two
 *     numbers comparable.
 *   - `filter` — a page somebody has NARROWED, with the vault moving under it.
 *     A filter is a standing view, so every frame the open page drew used to be
 *     a reason to ask the matcher again — one whole-vault `search.matching` PER
 *     FRAME, uncoalesced (`docs/brainstorming/reactivity-after-the-flip.md`
 *     §3.5). So this one counts ASKS rather than bytes: it opens a filtered
 *     outline, picks a section of it and ticks the pick off — one gesture, one
 *     write per topmost row, one page frame back per write — and reports what
 *     that burst cost the matcher. Over the BIG vault below, because what a
 *     whole-vault search costs is a function of the vault.
 *
 *     It is the acceptance test for `filter-ask-carries-revision`
 *     (docs/brainstorming/filter-rides-the-page.md), which is why the counter
 *     knows both spellings of the ask ({@link MATCHER}): the narrowing is a
 *     stream over the page now, so the gesture should cost the matcher NOTHING
 *     — the subscription is opened once, when the query is, and thirty writes
 *     that move no match send no frame and ask no question.
 *
 * It is VERSION-INDEPENDENT on purpose — Playwright, a URL, and this package's
 * own browser argv, with no `@olai/*` import anywhere — so the same driver
 * measures a server built from this branch and one from master, and the two
 * numbers are of the same session. `wire.sh` is what stands each of those
 * up.
 */
import { chromium, type Page } from "playwright"
import { mkdirSync, writeFileSync } from "node:fs"
import * as path from "node:path"

import { BROWSER_ARGS } from "./support/browser.ts"

const BASE = process.env["BASE"] ?? "http://127.0.0.1:7788"
const VAULT = process.env["VAULT"] ?? ""
const LABEL = process.env["LABEL"] ?? "unlabelled"
const SESSION = process.env["SESSION"] ?? "preview"

/** The saved page under test, and the note beside it. Both are written by this
 *  driver rather than taken from a fixture corpus, so the two runs measure the
 *  same bytes whatever either branch's fixtures happen to hold. */
const PAGE = "dashboard.html"
const NOTE = "manual.md"

/** How big a saved page is, in the case this is about. A dashboard exported
 *  with its data inlined is megabytes; a megabyte is the conservative end of
 *  that and it keeps the run quick. */
const FILLER = "x".repeat(1_000_000)

const pageAt = (heading: string) =>
  `<h1>${heading}</h1>\n<!-- ${FILLER} -->\n`

/** A note with a body worth seeing in the numbers — this is the reader the fix
 *  must not have broken, so its body had better still be on the wire. */
const note = () => `# Manual\n\n${"a note about the cabinets. ".repeat(2_000)}\n`

interface Reading {
  readonly what: string
  /** Bytes the websocket delivered to this tab, cumulative. */
  readonly socket: number
  /** Bytes fetched off `/media/`, cumulative. */
  readonly media: number
  /** What the tab ASKED THE MATCHER FOR, cumulative — the `filter` session's
   *  number, and zero for the other two, which never narrow a page. Both
   *  spellings are counted ({@link MATCHER}), because one driver measures two
   *  worktrees and the member changed shape between them. */
  readonly asks: number
}

/**
 * HOW A PAGE ASKS THE MATCHER, on the wire, going out — in BOTH spellings the
 * two sides of this measurement use.
 *
 * The surface's own request tags, which are the one thing about the protocol
 * this driver knows, and it counts the frames the TAB SENT rather than the
 * answers it was given: what is being measured is what this page asked for.
 *
 * TWO of them, because `ROOT=` is the whole point of this file — the same
 * driver measures a server from master and one from a branch, and
 * `filter-ask-carries-revision` changed which member a narrowed page asks.
 * `search/matching` is the PROCEDURE it used to call, once per page frame;
 * `narrowing/get` is the STREAM it subscribes to instead, once per settled
 * query. Counted together, the column means one thing on both sides: how many
 * times this page asked what its filter selects.
 */
const MATCHER = [
  `"tag":"surface/search/matching"`,
  `"tag":"surface/narrowing/get"`,
]

/**
 * THE VAULT — written here rather than taken from a fixture corpus, for the
 * reason the two files above are: the two runs must measure the same directory,
 * whatever either branch's fixtures hold.
 *
 * TWO SIZES, because the two sessions that use it are asking different
 * questions. `pages` is about what an ORDINARY reading session costs, so its
 * vault is a working one somebody has kept for a couple of years — a few dozen
 * outlines, a couple of hundred rows each, notes on a third of them, a
 * scattering of dates, mirrors and edges, and a folder of documents beside.
 * (Those numbers are quoted in the PR body that measured them, which is why
 * they are a constant and not a knob.)
 *
 * `filter` is about the vault the `vault-in-browser` design was RULED for —
 * "when we have 1000s of .md files it will start to suck" — because the thing
 * it counts is what a page asks the matcher, and what one whole-vault answer
 * costs is a function
 * of the vault. On the small one the matcher answers faster than a write's
 * round trip, so nothing about coalescing is visible either way; the number to
 * measure is the one a reader with a real vault pays.
 *
 * Every number is deterministic, so a re-run measures the same bytes.
 */
interface Size {
  readonly outlines: number
  readonly rows: number
  readonly documents: number
}
const READING: Size = { outlines: 40, rows: 200, documents: 60 }
const BIG: Size = { outlines: 300, rows: 300, documents: 200 }

const outlineFile = (file: number) =>
  `notes/outline-${String(file).padStart(3, "0")}.olai`

/** One outline's records. */
const outlineAt = (file: number, rows: number): string => {
  const lines: Array<string> = []
  for (let row = 0; row < rows; row += 1) {
    const id = `n${file}-${row}`
    // Every tenth row is a section; the rest hang under the last one, which
    // is the shape an outline somebody keeps actually has.
    const parent = row % 10 === 0 ? undefined : `n${file}-${row - (row % 10)}`
    const title = `row ${row} of outline ${file} — a title of the length people write`
    const fields: Array<string> = [
      `"id":"${id}"`,
      ...(parent === undefined ? [] : [`"parent":"${parent}"`]),
      `"ord":"a${String(row).padStart(4, "0")}"`,
      `"title":"${title}"`,
    ]
    // At most ONE mark per record — the format refuses two, and a file that
    // will not parse is a file with no rows to measure.
    if (row % 7 === 0) fields.push(`"done":"2026-08-0${(row % 9) + 1}"`)
    else if (row % 3 === 0) fields.push(`"todo":true`)
    if (row % 5 === 0) {
      fields.push(
        `"desc":"a note under this row, two sentences long, of the kind a person writes when they are thinking. It is here because a third of rows in a real vault carry one."`,
      )
    }
    if (row % 11 === 0) fields.push(`"date":"2026-08-${String((row % 28) + 1).padStart(2, "0")}"`)
    if (row % 13 === 0 && row > 0) fields.push(`"see":["n${file}-${row - 13}"]`)
    if (row % 17 === 0 && row > 0) fields.push(`"after":["n${file}-${row - 17}"]`)
    lines.push(`{${fields.join(",")}}`)
  }
  return `${lines.join("\n")}\n`
}

const corpus = (
  write: (file: string, text: string) => void,
  { outlines, rows, documents }: Size,
): void => {
  for (let file = 0; file < outlines; file += 1) {
    write(outlineFile(file), outlineAt(file, rows))
  }
  for (let doc = 0; doc < documents; doc += 1) {
    write(
      `notes/doc-${String(doc).padStart(2, "0")}.md`,
      `# Document ${doc}\n\n${"prose about the work. ".repeat(200)}\n`,
    )
  }
  // One day's note, so the day page has both halves of what it draws.
  write("notes/2026-08-11.md", "# The eleventh\n\nwhat happened.\n")
}

const main = async () => {
  if (VAULT === "") throw new Error("VAULT must name the directory being served")

  let socket = 0
  let media = 0
  let asks = 0
  const readings: Array<Reading> = []
  const write = (file: string, text: string) => {
    const full = path.join(VAULT, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, text)
  }

  if (SESSION === "pages" || SESSION === "filter") {
    corpus(write, SESSION === "filter" ? BIG : READING)
    // WRITTEN BEFORE THE TAB OPENS, and given a beat to be read: the server is
    // already up (`wire.sh` needed a URL to hand over), so the store learns
    // this directory from its watcher — and a first frame measured while the
    // corpus was still arriving would be a first frame of some prefix of it.
    await new Promise((settled) => setTimeout(settled, 5_000))
  } else {
    write(PAGE, pageAt("Before"))
    write(NOTE, note())
  }

  const browser = await chromium.launch({ args: [...BROWSER_ARGS] })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()

  // EVERY frame the tab was delivered, counted as bytes. `framereceived` is the
  // browser's own accounting of what arrived, which is the number this is
  // about: what the server chose to send this reader.
  page.on("websocket", (socketed) => {
    socketed.on("framereceived", (frame) => {
      socket += typeof frame.payload === "string"
        ? Buffer.byteLength(frame.payload)
        : frame.payload.byteLength
    })
    // …and the other direction, which is what the `filter` session is about:
    // every whole-vault matcher call this page CHOSE TO MAKE.
    socketed.on("framesent", (frame) => {
      const text = typeof frame.payload === "string"
        ? frame.payload
        : frame.payload.toString("utf8")
      if (MATCHER.some((tag) => text.includes(tag))) asks += 1
    })
  })
  // …and the other leg: what the preview frame fetched for itself. Counted off
  // the response rather than off the file's size, so a 304 or an empty answer
  // counts as what it was.
  page.on("response", (response) => {
    if (!response.url().includes("/media/")) return
    void response
      .body()
      .then((body) => {
        media += body.byteLength
      })
      .catch(() => {})
  })

  const mark = async (what: string) => {
    // One beat for the last frames and the last fetch to be accounted.
    await page.waitForTimeout(500)
    readings.push({ what, socket, media, asks })
  }

  if (SESSION === "pages") await pages(page, mark)
  else if (SESSION === "filter") await filtered(page, mark, () => asks)
  else await preview(page, mark, write)

  await browser.close()
  report(LABEL, readings)
}

/** The edit-while-previewing session — see the header. */
const preview = async (
  page: Page,
  mark: (what: string) => Promise<void>,
  write: (file: string, text: string) => void,
): Promise<void> => {
  const heading = async (text: string) => {
    await page
      .frameLocator('[data-testid="hypertext-preview"]')
      .locator("h1")
      .filter({ hasText: text })
      .waitFor({ timeout: 15_000 })
  }

  await page.goto(BASE)
  await page.locator('[data-testid="outline-link"]').first().waitFor()
  await mark("the app opens")

  await page.locator(`[data-testid="hypertext-link"][data-file="${PAGE}"]`).click()
  await heading("Before")
  await mark(`the preview opens (${PAGE}, ${(FILLER.length / 1e6).toFixed(1)} MB)`)

  for (const at of ["First edit", "Second edit", "Third edit"]) {
    write(PAGE, pageAt(at))
    await heading(at)
    await mark(`the file is rewritten (${at.toLowerCase()})`)
  }

  await page.locator(`[data-testid="document-link"][data-file="${NOTE}"]`).click()
  await page.locator('[data-testid="document-body"]').waitFor()
  await mark(`a note is opened (${NOTE}, ${(note().length / 1e3).toFixed(0)} kB)`)
}

/**
 * The ordinary reading session — open the app, then walk the routes.
 *
 * WHAT THE FIRST MARK IS worth reading twice: on the old wire it is the whole
 * corpus, because a tab subscribed to every outline's records and derived every
 * page locally; on the new one it is the file list, because a tab subscribes to
 * the address it is drawing. Every mark after it is a NAVIGATION, which used to
 * be free and is now a page.
 */
const pages = async (
  page: Page,
  mark: (what: string) => Promise<void>,
): Promise<void> => {
  const FIRST = outlineFile(0)
  const SECOND = outlineFile(1)
  const rows = page.locator("[data-row-key]")

  // ONE LOAD, and everything after it is a NAVIGATION somebody makes — a link
  // in the sidebar, a bullet, a day in the calendar. That is the whole point of
  // clicking rather than calling `goto`: a reload re-subscribes to everything,
  // so a session of reloads would measure the first frame eight times and say
  // nothing about what moving between pages costs.
  await page.goto(`${BASE}/${FIRST}`)
  await page.locator('[data-testid="outline-link"]').first().waitFor({ timeout: 30_000 })
  await rows.first().waitFor({ timeout: 30_000 })
  await mark(
    `the app opens (${READING.outlines} outlines × ${READING.rows} rows, ${READING.documents} documents)`,
  )

  await page.locator(`[data-testid="outline-link"][data-file="${SECOND}"]`).click()
  await page.locator(`[data-node-id="n1-0"]`).first().waitFor({ timeout: 30_000 })
  await mark("a second outline is opened")

  await page.locator('[data-testid="zoom"]').first().click()
  await page.locator('[data-testid="zoom-title"]').waitFor({ timeout: 30_000 })
  await mark("a node is zoomed")

  await page.locator(`[data-testid="outline-link"][data-file="${FIRST}"]`).click()
  await page.locator(`[data-node-id="n0-0"]`).first().waitFor({ timeout: 30_000 })
  await mark("back to the first outline")

  await page.locator('[data-testid="document-link"]').first().click()
  await page.locator('[data-testid="document-body"]').waitFor({ timeout: 30_000 })
  await mark("a document is opened")

  await page.locator('[data-testid="calendar-day"][data-date="2026-08-12"] a').click()
  await page.locator('[data-testid="day-page"]').waitFor({ timeout: 30_000 })
  await mark("a day page is opened")

  await page.locator('[data-testid="agenda-link"]').click()
  await page.locator('[data-testid="agenda-page"]').waitFor({ timeout: 30_000 })
  await mark("the agenda is opened")

  await page.locator('[data-testid="trash-link"]').click()
  await page.locator('[data-testid="trash-page"]').waitFor({ timeout: 30_000 })
  await mark("the trash is opened")
}

/**
 * How many rows the bulk op is over.
 *
 * A BULK OP IS THE BURST, and it has to be — a `git pull` or an agent rewriting
 * the FILE is coalesced by the store's own settle before a single revision is
 * published, so a session that wrote the file in a loop would be measuring that
 * settle. A pick ticked off goes the other way: the edits leave this tab one at
 * a time through the editor's queue (`client/writes.ts`'s `applyingAll`), the
 * server publishes a revision inside each commit, and the page frames come back
 * a round trip apart — which is exactly the shape §3.5 is about.
 *
 * Thirty rows of one section, which is an ordinary thing to select and tick off
 * and long enough that a per-frame ask is unmistakable in the count.
 */
const PICKED = 30

/**
 * A NARROWED page with the vault moving under it — see the header.
 *
 * The query is a word every row of the corpus holds, so the answer is the whole
 * outline: the point is not what it selects but that it is a STANDING view, and
 * every frame the page draws is a reason to ask for it again.
 *
 * The rows are ticked off ON THE PAGE BEING READ, because a revision that
 * changed nothing on this page sends it no frame at all (the server's
 * `samePageReading`) — a bulk op somewhere else would measure nothing.
 */
const filtered = async (
  page: Page,
  mark: (what: string) => Promise<void>,
  counted: () => number,
): Promise<void> => {
  const title = (id: string) =>
    page.locator(`[data-testid="node"][data-node-id="${id}"]`)
      .locator('[data-testid="node-title"]').first()

  await page.goto(`${BASE}/${outlineFile(0)}?q=title`)
  await page.locator('[data-testid="outline-link"]').first().waitFor({ timeout: 30_000 })
  // The bar drawn on the address, and the rows under it — so the burst starts
  // from a page that is narrowed rather than one still waiting for its first
  // answer.
  await page.locator('[data-testid="filter-bar"]').waitFor({ timeout: 30_000 })
  await title("n0-1").waitFor({ timeout: 30_000 })
  await mark(
    `a filtered outline is opened (${BIG.rows} rows of ${BIG.outlines} outlines — ` +
      `${(BIG.outlines * BIG.rows).toLocaleString("en")} nodes)`,
  )
  // THE INSTRUMENT PROVES ITSELF FIRST. Everything else in this file fails
  // loudly (a `waitFor` that times out); a counter keyed on a protocol string
  // fails SILENTLY — the day that tag is renamed on one of the two worktrees
  // `ROOT=` points at, the run reports zero asks, which reads as a
  // spectacular win rather than a broken driver. A narrowed page that has drawn
  // its rows has asked at least once.
  if (counted() === 0) {
    throw new Error(
      `a filtered page was opened and none of ${MATCHER.join(" / ")} was seen ` +
        "on the wire — the request tags this driver counts have moved, so every " +
        "number below would be a zero that means nothing",
    )
  }

  // The pick: one row, then everything down to the last of the section.
  await title("n0-1").click({ modifiers: ["ControlOrMeta"] })
  await title(`n0-${PICKED}`).click({ modifiers: ["Shift"] })
  await page.locator('[data-testid="selection-bar"]').waitFor({ timeout: 30_000 })
  await mark(`${PICKED} rows are picked`)

  // …and ticked off, which is one gesture and that many writes.
  await page.keyboard.press("ControlOrMeta+Enter")
  await page.waitForTimeout(5_000)
  await mark(`the pick is ticked off (${PICKED} writes, one gesture)`)
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

const report = (label: string, readings: ReadonlyArray<Reading>) => {
  console.log(`\n── ${label} ─────────────────────────────────────`)
  console.log(
    ["step", "socket (total)", "media (total)", "matcher asks (total)"].join("\t"),
  )
  for (const reading of readings) {
    console.log(
      [reading.what, kb(reading.socket), kb(reading.media), String(reading.asks)]
        .join("\t"),
    )
  }
  const last = readings[readings.length - 1]
  console.log(
    `TOTAL\t${kb(last?.socket ?? 0)}\t${kb(last?.media ?? 0)}\t${last?.asks ?? 0}`,
  )
}

await main()

// A driver, not a step: nothing above throws for a wrong number, and there is
// nothing here for a runner to collect.
export {}
