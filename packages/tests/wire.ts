/**
 * What a reading session costs the wire, measured rather than argued.
 *
 * Not part of the suite and not a gate — the promises live in the features.
 * This is the instrument that produced the numbers in two PR bodies, and it is
 * kept so the next person can re-run them rather than believe them.
 *
 * WHAT IT MEASURES is the two ways bytes reach a reader: every byte the
 * WEBSOCKET delivered to the tab, and every byte fetched over HTTP off
 * `/media/`. TWO SESSIONS ask different questions of that one instrument, and
 * `SESSION` picks which:
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
}

/**
 * THE VAULT the `pages` session reads — written here rather than taken from a
 * fixture corpus, for the reason the two files above are: the two runs must
 * measure the same directory, whatever either branch's fixtures hold.
 *
 * Sized to be REALISTIC rather than adversarial: a working vault somebody has
 * kept for a couple of years — a few dozen outlines, a couple of hundred rows
 * each, notes on a third of them, a scattering of dates, mirrors and edges, and
 * a folder of documents beside. Every number is deterministic, so a re-run
 * measures the same bytes.
 */
const OUTLINES = 40
const ROWS = 200
const DOCUMENTS = 60

const corpus = (write: (file: string, text: string) => void): void => {
  for (let file = 0; file < OUTLINES; file += 1) {
    const lines: Array<string> = []
    for (let row = 0; row < ROWS; row += 1) {
      const id = `n${file}-${row}`
      // Every tenth row is a section; the rest hang under the last one, which
      // is the shape an outline somebody keeps actually has.
      const parent = row % 10 === 0 ? undefined : `n${file}-${row - (row % 10)}`
      const fields: Array<string> = [
        `"id":"${id}"`,
        ...(parent === undefined ? [] : [`"parent":"${parent}"`]),
        `"ord":"a${String(row).padStart(4, "0")}"`,
        `"title":"row ${row} of outline ${file} — a title of the length people write"`,
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
    write(`notes/outline-${String(file).padStart(2, "0")}.olai`, `${lines.join("\n")}\n`)
  }
  for (let doc = 0; doc < DOCUMENTS; doc += 1) {
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
  const readings: Array<Reading> = []
  const write = (file: string, text: string) => {
    const full = path.join(VAULT, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, text)
  }

  if (SESSION === "pages") {
    corpus(write)
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
    readings.push({ what, socket, media })
  }

  if (SESSION === "pages") await pages(page, mark)
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
  const FIRST = "notes/outline-00.olai"
  const SECOND = "notes/outline-01.olai"
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
    `the app opens (${OUTLINES} outlines × ${ROWS} rows, ${DOCUMENTS} documents)`,
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

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} kB`

const report = (label: string, readings: ReadonlyArray<Reading>) => {
  console.log(`\n── ${label} ─────────────────────────────────────`)
  console.log(
    ["step", "socket (total)", "media (total)"].join("\t"),
  )
  for (const reading of readings) {
    console.log([reading.what, kb(reading.socket), kb(reading.media)].join("\t"))
  }
  const last = readings[readings.length - 1]
  console.log(`TOTAL\t${kb(last?.socket ?? 0)}\t${kb(last?.media ?? 0)}`)
}

await main()

// A driver, not a step: nothing above throws for a wrong number, and there is
// nothing here for a runner to collect.
export {}
